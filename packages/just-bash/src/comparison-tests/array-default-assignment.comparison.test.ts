import { afterEach, beforeEach, describe, it } from "vitest";
import {
  cleanupTestDir,
  compareOutputs,
  createTestDir,
  setupFiles,
} from "./fixture-runner.js";

describe("assignment defaults containing arrays - GNU Bash Comparison", () => {
  let testDirectory: string;

  beforeEach(async () => {
    testDirectory = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDirectory);
  });

  it.each([
    "set +u",
    "set -u",
  ])("assigns array-valued defaults with %s", async (nounset) => {
    const env = await setupFiles(testDirectory, {});
    await compareOutputs(
      env,
      testDirectory,
      `${nounset}
unset value
defaults=('a b' c)
printf '<%s>\\n' "\${value:=\${defaults[@]}}"
printf 'assigned=<%s>\\n' "\${value-unset}"
printf 'again=<%s>\\n' "\${value:=ignored}"`,
    );
  });

  it("uses IFS for assignment while preserving separate arguments", async () => {
    const env = await setupFiles(testDirectory, {});
    await compareOutputs(
      env,
      testDirectory,
      `unset value star
IFS=:
defaults=('a b' c)
printf '<%s>\\n' "\${value=\${defaults[@]}}"
printf 'assigned=<%s>\\n' "$value"
printf '<%s>\\n' "\${star:=\${defaults[*]}}"
printf 'assigned=<%s>\\n' "$star"`,
    );
  });

  it("assigns empty defaults and respects the empty/unset distinction", async () => {
    const env = await setupFiles(testDirectory, {});
    await compareOutputs(
      env,
      testDirectory,
      `unset value
defaults=()
printf '<%s>\\n' "\${value:=\${defaults[@]}}"
printf 'set=<%s> value=<%s>\\n' "\${value+yes}" "\${value-unset}"
defaults=(one two)
printf '<%s>\\n' "\${value=\${defaults[@]}}"
printf '<%s>\\n' "\${value:=\${defaults[@]}}"
printf 'assigned=<%s>\\n' "$value"`,
    );
  });

  it("assigns a default to an indexed element", async () => {
    const env = await setupFiles(testDirectory, {});
    await compareOutputs(
      env,
      testDirectory,
      `defaults=(one two)
printf '<%s>\\n' "\${target[2]:=\${defaults[@]}}"
printf 'assigned=<%s>\\n' "\${target[2]-unset}"`,
    );
  });

  it("assigns the complete default word when literals surround the array", async () => {
    const env = await setupFiles(testDirectory, {});
    await compareOutputs(
      env,
      testDirectory,
      `defaults=(one two)
unset value
: "\${value:=pre\${defaults[@]}post}"
printf 'assigned=<%s>\\n' "$value"`,
    );
  });

  it("handles unset and empty IFS and scalar array fallbacks", async () => {
    const env = await setupFiles(testDirectory, {});
    await compareOutputs(
      env,
      testDirectory,
      `unset IFS first second third defaults
defaults=(one two)
printf '<%s>\\n' "\${first:=\${defaults[@]}}"
printf 'assigned=<%s>\\n' "$first"
IFS=
set -- "\${second:=\${defaults[@]}}"
printf 'arguments=%s value=<%s>\\n' "$#" "$1"
printf 'assigned=<%s>\\n' "$second"
unset defaults
defaults=scalar
printf '<%s>\\n' "\${third:=\${defaults[@]}}"
printf 'assigned=<%s>\\n' "$third"`,
    );
  });

  it("preserves one empty argument for an assigned empty array", async () => {
    const env = await setupFiles(testDirectory, {});
    await compareOutputs(
      env,
      testDirectory,
      `unset value
defaults=()
set -- "\${value:=\${defaults[@]}}"
printf 'arguments=%s value=<%s> assigned=<%s>\\n' "$#" "$1" "$value"`,
    );
  });
});
