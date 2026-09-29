# Contributing to just-bash

Thanks for helping improve just-bash. This guide covers the contribution workflow: setting up the repository, making a change, filing an issue, and the maintenance process used to triage what comes in.

## Setting up

just-bash is a pnpm monorepo. It requires Node.js `>=20.19` and pnpm.

```sh
pnpm install
pnpm build
pnpm test:run
```

Focused checks:

```sh
pnpm test:unit   # fast unit tests, no comparison or spec tests
pnpm typecheck
pnpm lint
pnpm knip
```

`packages/just-bash` is the published package. Its architecture, the layout of commands, and the testing strategy are documented in [AGENTS.md](./AGENTS.md).

## Reporting an issue

Pick the form that matches your report when you open a new issue:

| Form | Use it for |
| --- | --- |
| Bug report | Behavior that differs from real bash, or that fails unexpectedly |
| Feature request | A command, flag, or capability that does not exist yet |
| Documentation issue | Documentation that is wrong, unclear, or missing |
| Maintenance task | Dependency, tooling, CI, or internal repository work |

Blank issues stay available for anything that does not fit a form.

A bug report is easiest to act on when it shows a small script, how you run it, and what real bash prints for the same script. just-bash targets bash compatibility, so a difference between the two shells is the clearest way to describe a bug.

## Making a change

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Run the tests, lint, and typecheck that cover your change before opening a pull request, and add a [changeset](https://changesets.dev/) for behavior changes so the release includes them.

Behavior is validated against real bash, so a command or interpreter change usually needs a comparison test. [AGENTS.md](./AGENTS.md) explains how to record one.

## Repo maintenance

Repository maintenance covers dependencies, CI, tooling, and internal work that does not change how just-bash behaves for users. Maintainers triage it through the issue labels below.

### Issue labels

Each issue form applies one type label automatically.

| Label | Meaning | Commit type |
| --- | --- | --- |
| `bug` | Existing behavior is wrong | `fix:` |
| `enhancement` | A capability is missing, or should work differently | `feat:` |
| `documentation` | Documentation needs a correction or an addition | `docs:` |
| `chore` | Repository maintenance: dependencies, tooling, CI, or internal work | `chore:` |

The commit type column shows the Conventional Commits type that usually fixes the issue. There is deliberately no label for every commit type: a `chore` issue can be fixed with a `ci:`, `build:`, `test:`, `refactor:`, or `perf:` commit when one of those is more accurate.

GitHub's standard labels (`duplicate`, `invalid`, `question`, `wontfix`, `good first issue`, `help wanted`) are also in use for triage.

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

### Releases

Releases are managed with [changesets](https://changesets.dev/). Changesets decide what ships and how versions move, so a commit type does not trigger a release on its own: a change ships when it has a changeset.
