import { ExecutionAbortedError } from "./interpreter/errors.js";

export interface CombinedAbortSignal {
  signal: AbortSignal | undefined;
  cleanup(): void;
}

/**
 * Compose abort signals without relying on AbortSignal.any(), which is not
 * available in every supported runtime. The first abort reason wins and all
 * listeners are removable by the caller's finally block.
 */
export function combineAbortSignals(
  ...signals: Array<AbortSignal | undefined>
): CombinedAbortSignal {
  const uniqueSignals = [
    ...new Set(
      signals.filter((signal): signal is AbortSignal => signal !== undefined),
    ),
  ];
  if (uniqueSignals.length === 0) {
    return { signal: undefined, cleanup() {} };
  }
  if (uniqueSignals.length === 1) {
    return { signal: uniqueSignals[0], cleanup() {} };
  }

  const controller = new AbortController();
  const listeners: Array<readonly [AbortSignal, () => void]> = [];

  for (const signal of uniqueSignals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const onAbort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    listeners.push([signal, onAbort]);
  }

  return {
    signal: controller.signal,
    cleanup() {
      for (const [signal, listener] of listeners) {
        signal.removeEventListener("abort", listener);
      }
    },
  };
}

/**
 * Wait for host work that cannot observe cancellation, and give up as soon as
 * `signal` aborts.
 *
 * Host work such as a dynamic import or a caller-provided loader cannot be
 * cancelled. A cancelled invocation must not keep waiting for it either: the
 * deadline machinery treats a command that does not settle within its cleanup
 * grace window as one that ignored cancellation, poisons the shared execution
 * scope, and the caller's remaining statements never run. Work that is still
 * resolving has nothing to unwind, so the invocation can report cancellation
 * immediately instead.
 *
 * Both paths keep the abandoned work observed, so a load that completes or
 * fails after this gives up cannot become an unhandled rejection.
 */
export async function raceCancellation<T>(
  work: Promise<T>,
  signal: AbortSignal | undefined,
  cancellationMessage: string,
): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) {
    // Work handed over by an already-cancelled invocation is nobody else's to
    // await, so keep its settlement observed here.
    work.catch(() => undefined);
    throw new ExecutionAbortedError("", cancellationMessage);
  }

  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        onAbort = () =>
          reject(new ExecutionAbortedError("", cancellationMessage));
        signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}
