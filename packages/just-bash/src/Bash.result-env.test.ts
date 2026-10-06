import { describe, expect, it } from "vitest";
import { Bash } from "./Bash.js";
import { nullPrototype } from "./commands/query-engine/safe-object.js";

describe("execution result environment", () => {
  it.each([
    undefined,
    "original",
  ])("unwinds temporary bindings after expansion failure (TEMP=%s)", async (original) => {
    const bash = new Bash();
    const result = await bash.exec(
      "MARKER=kept; TEMP=secret echo ${MISSING:?required}",
      {
        env: original === undefined ? {} : { TEMP: original },
        replaceEnv: true,
      },
    );
    expect(result.env).toStrictEqual(
      nullPrototype(
        original === undefined
          ? { MARKER: "kept", "?": "0" }
          : { MARKER: "kept", "?": "0", TEMP: original },
      ),
    );
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("bash: required\n");
    expect(result.exitCode).toBe(1);
  });

  it("retains prefix bindings when the command actually exits", async () => {
    const result = await new Bash().exec("TEMP=secret exit 7", {
      env: {},
      replaceEnv: true,
    });
    expect(result.env.TEMP).toBe("secret");
    expect(result.exitCode).toBe(7);
  });

  it("unwinds bindings when a later prefix value fails to expand", async () => {
    const result = await new Bash().exec(
      "MARKER=kept; TEMP=secret OTHER=${MISSING:?required} echo",
      {
        env: { TEMP: "original" },
        replaceEnv: true,
      },
    );
    expect(result.env).toStrictEqual(
      nullPrototype({ TEMP: "original", MARKER: "kept", "?": "0" }),
    );
    expect(result.exitCode).toBe(1);
  });

  it("retains prefix bindings after a completed POSIX special builtin", async () => {
    const result = await new Bash().exec("set -o posix; TEMP=kept :; exit", {
      env: {},
      replaceEnv: true,
    });
    expect(result.env.TEMP).toBe("kept");
    expect(result.exitCode).toBe(0);
  });
  it.each([
    ["normal execution", "echo ok", 0],
    ["empty script", "", 0],
    ["whitespace-only script", " \n\t", 0],
    ["exit", "exit 7", 7],
    ["syntax error", "if", 2],
    ["lexer error", "echo '", 2],
    ["arithmetic error", "echo $((1 / 0))", 1],
  ])("returns the replacement environment after %s", async (_name, script, status) => {
    const bash = new Bash({ env: { SECRET: "example-only" } });
    const result = await bash.exec(script, {
      env: { MARKER: "replacement" },
      replaceEnv: true,
    });
    expect(
      Object.keys(result.env).filter((name) => name !== "?"),
    ).toStrictEqual(["MARKER"]);
    expect(result.env.MARKER).toBe("replacement");
    expect(Object.getPrototypeOf(result.env)).toBeNull();
    expect(result.exitCode).toBe(status);
  });

  it("keeps assignments made before exit in the returned environment", async () => {
    const bash = new Bash({ env: { SECRET: "example-only" } });
    const result = await bash.exec("MARKER=changed; ADDED=value; exit 7", {
      env: { MARKER: "replacement" },
      replaceEnv: true,
    });
    expect(result.env).toStrictEqual(
      nullPrototype({ MARKER: "changed", ADDED: "value", "?": "0" }),
    );
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(7);
  });

  it("uses the replacement environment when source validation fails", async () => {
    const bash = new Bash({
      env: { SECRET: "example-only" },
      executionLimits: { maxSourceBytes: 4 },
    });
    const result = await bash.exec("echo too-long", {
      env: { MARKER: "replacement" },
      replaceEnv: true,
    });
    expect(result.env).toStrictEqual(nullPrototype({ MARKER: "replacement" }));
    expect(result.exitCode).toBe(126);
  });

  it("keeps runtime assignments when the execution limit is reached", async () => {
    const bash = new Bash({
      env: { SECRET: "example-only" },
      executionLimits: { maxLoopIterations: 2 },
    });
    const result = await bash.exec("MARKER=changed; while true; do :; done", {
      env: { MARKER: "replacement" },
      replaceEnv: true,
    });
    expect(result.env).toStrictEqual(
      nullPrototype({ MARKER: "changed", "?": "0" }),
    );
    expect(result.exitCode).toBe(126);
  });

  it("preserves merge semantics on empty and exit result paths", async () => {
    const bash = new Bash({ env: { KEEP: "constructor" } });
    const empty = await bash.exec("", { env: { MARKER: "per-exec" } });
    const exited = await bash.exec("exit", { env: { MARKER: "per-exec" } });
    expect(empty.env.KEEP).toBe("constructor");
    expect(empty.env.MARKER).toBe("per-exec");
    expect(exited.env).toStrictEqual(empty.env);
  });
});
