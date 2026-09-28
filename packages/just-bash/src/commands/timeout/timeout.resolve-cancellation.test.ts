import { describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";
import { _setTimeout } from "../../timers.js";

/**
 * Track process-level unhandled rejections. A cancelled invocation abandons the
 * work it was waiting for, and an abandoned promise that later rejects would
 * otherwise escape into a host that treats unhandled rejections as fatal.
 */
function collectUnhandledRejections(): {
  rejections: unknown[];
  stop(): void;
} {
  const rejections: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", onUnhandledRejection);
  return {
    rejections,
    stop() {
      process.off("unhandledRejection", onUnhandledRejection);
    },
  };
}

describe("timeout cancellation while a command resolves", () => {
  it("keeps the caller running when the command never finishes loading", async () => {
    const unhandled = collectUnhandledRejections();
    const bash = new Bash({
      customCommands: [
        {
          name: "pending-import",
          load: () => new Promise<never>(() => {}),
        },
      ],
    });

    const result = await bash.exec(`
      timeout 0.01 pending-import
      echo "TIMEOUT_EXIT=$?"
      echo AFTER
    `);
    unhandled.stop();

    expect(result.stdout).toBe("TIMEOUT_EXIT=124\nAFTER\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(unhandled.rejections).toEqual([]);
  });

  it("does not start a command whose module finishes loading after cancellation", async () => {
    const unhandled = collectUnhandledRejections();
    let releaseLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const bash = new Bash({
      customCommands: [
        {
          name: "late-import",
          load: async () => {
            await loadGate;
            return {
              name: "late-import",
              async execute(_args, ctx) {
                await ctx.fs.writeFile("/late-import-ran", "ran");
                return { stdout: "LATE_BODY\n", stderr: "", exitCode: 0 };
              },
            };
          },
        },
      ],
    });

    const result = await bash.exec(`
      timeout 0.01 late-import
      echo "TIMEOUT_EXIT=$?"
      echo AFTER
    `);
    releaseLoad();
    await new Promise((resolve) => _setTimeout(resolve, 20));
    unhandled.stop();

    expect(result.stdout).toBe("TIMEOUT_EXIT=124\nAFTER\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    await expect(bash.fs.exists("/late-import-ran")).resolves.toBe(false);
    expect(unhandled.rejections).toEqual([]);
  });

  it("keeps a module load that fails after cancellation observed, and retries it", async () => {
    const unhandled = collectUnhandledRejections();
    let releaseLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    let loadCalls = 0;
    const bash = new Bash({
      customCommands: [
        {
          name: "failing-import",
          load: async () => {
            loadCalls += 1;
            if (loadCalls === 1) {
              await loadGate;
              throw new Error("module unavailable");
            }
            return {
              name: "failing-import",
              async execute() {
                return { stdout: "LOADED\n", stderr: "", exitCode: 0 };
              },
            };
          },
        },
      ],
    });

    const cancelled = await bash.exec(`
      timeout 0.01 failing-import
      echo "TIMEOUT_EXIT=$?"
      echo AFTER
    `);
    releaseLoad();
    await new Promise((resolve) => _setTimeout(resolve, 20));
    const retried = await bash.exec("failing-import");
    unhandled.stop();

    expect(cancelled.stdout).toBe("TIMEOUT_EXIT=124\nAFTER\n");
    expect(cancelled.stderr).toBe("");
    expect(cancelled.exitCode).toBe(0);
    // The abandoned failure must not be replayed to the next invocation.
    expect(retried.stdout).toBe("LOADED\n");
    expect(retried.stderr).toBe("");
    expect(retried.exitCode).toBe(0);
    expect(loadCalls).toBe(2);
    expect(unhandled.rejections).toEqual([]);
  });

  it("does not start a competing load when a waiter is cancelled", async () => {
    let loadCalls = 0;
    const bash = new Bash({
      customCommands: [
        {
          name: "pending-import",
          load: () => {
            loadCalls += 1;
            return new Promise<never>(() => {});
          },
        },
      ],
    });

    const result = await bash.exec(`
      timeout 0.01 pending-import
      timeout 0.01 pending-import
      echo "TIMEOUT_EXIT=$?"
    `);

    expect(result.stdout).toBe("TIMEOUT_EXIT=124\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(loadCalls).toBe(1);
  });

  it("retries a load that failed instead of replaying the failure", async () => {
    let loadCalls = 0;
    const bash = new Bash({
      customCommands: [
        {
          name: "flaky-import",
          load: async () => {
            loadCalls += 1;
            if (loadCalls === 1) {
              throw new Error("module unavailable");
            }
            return {
              name: "flaky-import",
              async execute() {
                return { stdout: "LOADED\n", stderr: "", exitCode: 0 };
              },
            };
          },
        },
      ],
    });

    const failed = await bash.exec("flaky-import");
    const retried = await bash.exec("flaky-import");

    expect(failed.stdout).toBe("");
    expect(failed.stderr).toBe("flaky-import: module unavailable\n");
    expect(failed.exitCode).toBe(1);
    expect(retried.stdout).toBe("LOADED\n");
    expect(retried.stderr).toBe("");
    expect(retried.exitCode).toBe(0);
    expect(loadCalls).toBe(2);
  });
});
