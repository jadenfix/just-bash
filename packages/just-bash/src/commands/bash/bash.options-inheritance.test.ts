import { describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";

describe("nested shell option inheritance", () => {
  it.each(["bash", "sh"])("%s enables exported pipefail", async (shell) => {
    const bash = new Bash();
    const result = await bash.exec(
      `set -o pipefail; export SHELLOPTS; ${shell} -c 'false | true; echo $?'`,
    );
    expect(result.stdout).toBe("1\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("applies options across multiple generations and recursive wrappers", async () => {
    const bash = new Bash();
    const result = await bash.exec(
      `set -o pipefail; export SHELLOPTS; env bash -c 'command time bash -c "false | true; echo \\$?" 2>/dev/null'`,
    );
    expect(result.stdout).toBe("1\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("enables nounset before executing the child script", async () => {
    const bash = new Bash();
    const result = await bash.exec(
      `set -u; export SHELLOPTS; bash -c 'echo "$MISSING"'`,
    );
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("bash: MISSING: unbound variable\n");
    expect(result.exitCode).toBe(1);
  });

  it("enables exported nullglob and reports the effective options", async () => {
    const bash = new Bash();
    const result = await bash.exec(
      `shopt -s nullglob; export BASHOPTS; bash -c 'printf "<%s>\\n" missing-*; echo "$BASHOPTS"'`,
    );
    expect(result.stdout).toBe("<>\nglobskipdots:nullglob\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("does not inherit unexported shell or shopt options", async () => {
    const bash = new Bash();
    const result = await bash.exec(
      `set -o pipefail; shopt -s nullglob; bash -c 'false | true; echo $?; printf "<%s>\\n" missing-*'`,
    );
    expect(result.stdout).toBe("0\n<missing-*>\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("keeps child option changes out of its parent and sibling shells", async () => {
    const bash = new Bash();
    const result = await bash.exec(
      `shopt -s nullglob; export BASHOPTS; bash -c 'shopt -u nullglob; printf "<%s>\\n" missing-*'; printf "<%s>\\n" missing-*; bash -c 'printf "<%s>\\n" missing-*'`,
    );
    expect(result.stdout).toBe("<missing-*>\n<>\n<>\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("rebuilds option variables after importing host-provided child environments", async () => {
    const bash = new Bash();
    const result = await bash.exec(
      `bash -c 'false | true; echo $?; printf "<%s>\\n" missing-*; echo "$SHELLOPTS"; echo "$BASHOPTS"'`,
      {
        env: { SHELLOPTS: "pipefail:noglob", BASHOPTS: "nullglob" },
        replaceEnv: true,
      },
    );
    expect(result.stdout).toBe(
      "1\n<missing-*>\nbraceexpand:hashall:interactive-comments:noglob:pipefail\nglobskipdots:nullglob\n",
    );
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("does not import option strings into the host execution", async () => {
    const bash = new Bash();
    const result = await bash.exec("false | true; echo $?", {
      env: { SHELLOPTS: "pipefail" },
      replaceEnv: true,
    });
    expect(result.stdout).toBe("0\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("does not treat prototype property names as option state", async () => {
    const before = Object.getOwnPropertyDescriptors(Object.prototype);
    const bash = new Bash();
    const result = await bash.exec(
      `bash -c 'printf "<%s>\\n" missing-*; echo "$BASHOPTS"'`,
      {
        env: {
          BASHOPTS:
            "__proto__:constructor:prototype:hasOwnProperty:toString:valueOf:nullglob",
        },
        replaceEnv: true,
      },
    );
    expect(result.stdout).toBe("<>\nglobskipdots:nullglob\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    for (const name of Object.keys(before)) {
      expect(
        Object.getOwnPropertyDescriptor(Object.prototype, name),
      ).toStrictEqual(before[name]);
    }
  });
});
