# Contributing to just-bash

Thanks for helping improve just-bash. This guide covers the contribution workflow: setting up the repository, making a change, and the maintenance process used to triage what comes in.

## Setting up

just-bash is a pnpm monorepo. It requires Node.js `>=20.19` and pnpm.

```sh
pnpm install
pnpm build     # required before anything reads dist/
pnpm test:run  # unit, comparison, and spec tests
```

Focused checks:

```sh
pnpm test:unit                                       # fast unit tests
pnpm test:run src/commands/grep/grep.basic.test.ts   # a single test file
pnpm test:comparison                                 # recorded bash fixtures
pnpm test:wasm                                       # python3, sqlite3, js-exec
pnpm typecheck
pnpm lint
pnpm knip
```

Spec tests have known failures, so exclude them when you want a clean run: `pnpm test:run --exclude src/spec-tests`.

`packages/just-bash` is the published package. Its architecture, the layout of commands, and the security model are documented in [AGENTS.md](./AGENTS.md).

## Making a change

The implementation must match real bash, not what is convenient for TypeScript. A command that behaves differently from bash is a bug, so check real bash whenever you are unsure.

### Adding a command

Commands live in `packages/just-bash/src/commands/<name>/`:

1. An implementation file with a usage statement.
2. Unit tests in a collocated `*.test.ts` file.
3. Comparison tests in `src/comparison-tests/` when the behavior is uncertain.

Commands error on unknown options unless real bash also ignores them, and `--help` reflects what the command actually supports rather than what bash prints.

### Testing

- **Unit tests** are fast and isolated, so edge cases belong here.
- **Comparison tests** compare output against recorded bash fixtures, which removes the differences between macOS and Linux. Add them for major command functionality and whenever you are unsure about bash behavior. Write them with `setupFiles()` and `compareOutputs()`; see [`packages/just-bash/src/comparison-tests/README.md`](./packages/just-bash/src/comparison-tests/README.md).
- **Spec tests** cover bash specification conformance and include known failures.

Assert the full stdout and stderr rather than matching fragments, because a partial match hides the surrounding behavior. Keep test files under 300 lines, and start a new file when you need another group.

To record fixtures:

```sh
RECORD_FIXTURES=1 pnpm test:run src/comparison-tests/mytest.comparison.test.ts
RECORD_FIXTURES=force pnpm test:comparison
```

Commit the generated fixture file together with the test. If you adjust a fixture for Linux behavior, mark it `"locked": true`.

Before finishing, run `pnpm typecheck && pnpm lint:fix && pnpm knip && pnpm test:run`.

### Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Whether a change ships is a separate decision; see [Releases](#releases).

## Repo maintenance

Repository maintenance covers dependencies, CI, tooling, and internal work that does not change how just-bash behaves for users. Maintainers triage it through the issue labels below.

### Issue labels

Each issue form applies one type label automatically.

| Label | Meaning |
| --- | --- |
| `bug` | Existing behavior is wrong |
| `enhancement` | A capability is missing, or should work differently |
| `documentation` | Documentation needs a correction or an addition |
| `chore` | Repository maintenance: dependencies, tooling, CI, or internal work |

GitHub's other standard labels (`invalid`, `question`, `good first issue`, `help wanted`) are also in use for triage.

Topic labels group related issues, so it is easy to see which issues belong to the same area of the project. They are additive: an issue can have several, and a change that spans areas can have several. Maintainers add them during triage, so you do not need to add them yourself.

| Label | Scope |
| --- | --- |
| `shell` | Parsing, quoting, expansion, pipelines, redirection, and shell execution |
| `commands` | Behavior of, or support for, individual commands |
| `filesystem` | Filesystem implementations, mounts, links, and file operations |
| `security` | Sandbox boundaries, trust, and vulnerability reports |
| `compatibility` | Running or bundling just-bash in browsers, Node.js, Bun, and other hosts |
| `network` | HTTP behavior, network permissions, and request configuration |
| `dependencies` | Dependency updates and dependency-related problems |
| `ci` | Automated checks and GitHub Actions |

### Closing issues

Add one of these only when it applies:

- `duplicate`: another issue or pull request already covers it. Link that item.
- `wontfix`: the change will not be made. Give a short reason.

Fixed work needs no closure label, so link the pull request that fixes it instead. For anything else, close the issue as **Not planned** with a short explanation.

### Releases

This repository uses [Changesets](https://changesets.dev/guide/getting-started), so commit types do not trigger releases. Only add a changeset when you intend to release the change, and be deliberate about why package users need that release. Add one with `pnpm changeset`.
