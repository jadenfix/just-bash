# Contributing to just-bash

Thanks for helping improve just-bash. This guide covers how to report issues and how we label them.

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

## Labels

Issues carry a type label that says what kind of report it is, and can carry topic labels that say which parts of the project it touches.

### Type labels

Each issue form adds one type label automatically.

| Label | Meaning | Commit type |
| --- | --- | --- |
| `bug` | Existing behavior is wrong | `fix:` |
| `enhancement` | A capability is missing, or should work differently | `feat:` |
| `documentation` | Documentation needs a correction or an addition | `docs:` |
| `chore` | Repository maintenance: dependencies, tooling, CI, or internal work | `chore:` |

The commit type column shows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) type that usually fixes the issue. There is deliberately no label for every commit type: a `chore` issue can be fixed with a `ci:`, `build:`, `test:`, `refactor:`, or `perf:` commit when one of those is more accurate.

GitHub's standard labels (`duplicate`, `invalid`, `question`, `wontfix`, `good first issue`, `help wanted`) are also in use for triage.

### Topic labels

Topic labels group related issues, so it is easy to see which issues belong to the same area of the project. They are additive: an issue can have several, and a change that spans areas can have several.

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

Maintainers add topic labels during triage, so you do not need to add them yourself.

## Commits and releases

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and releases are managed with [changesets](https://changesets.dev/). Changesets decide what ships and how versions move, so a commit type does not trigger a release on its own: a change is released when it has a changeset.

## Development

[CLAUDE.md](./CLAUDE.md) covers the architecture, the available commands, and the test workflow. Package-level agent instructions live in [packages/just-bash/AGENTS.md](./packages/just-bash/AGENTS.md).
