# AGENTS.md

This file provides guidance to coding agents working with the code in this repository.

just-bash is a TypeScript implementation of a bash interpreter with an in-memory virtual filesystem. It gives AI agents a secure, sandboxed bash environment.

Source paths below are relative to `packages/just-bash`, the published package.

Setup, build, test, lint, and release commands live in [CONTRIBUTING.md](./CONTRIBUTING.md). Package conventions, the full prototype-pollution rules, and the test layout live in [packages/just-bash/AGENTS.md](./packages/just-bash/AGENTS.md).

## Running just-bash

`pnpm shell` opens an interactive sandboxed shell. Network access is disabled by default; pass `--network` to enable it.

### Sandboxed CLI

`packages/just-bash` ships a `just-bash` CLI that mounts a real directory through OverlayFS. Run it from `packages/just-bash` after `pnpm build`:

```bash
node ./dist/cli/just-bash.js -c 'ls -la' --root .                          # Run a command
node ./dist/cli/just-bash.js -c 'cat package.json' --root . --json         # Print JSON output
node ./dist/cli/just-bash.js script.sh --root .                            # Run a script file
node ./dist/cli/just-bash.js -c 'echo hi > /tmp/f' --root . --allow-write  # Allow in-memory writes
```

The sandbox is read-only by default, and writes stay in memory instead of reaching the real filesystem.

| Option | Meaning |
| --- | --- |
| `--root <path>` | Directory mounted at `/home/user/project` in the sandbox (default: current directory) |
| `--cwd <path>` | Working directory in the sandbox (default: the mount point) |
| `--allow-write` | Allow write operations, in memory only |
| `--json` | Output results as JSON (stdout, stderr, exitCode) |
| `-e, --errexit` | Exit on the first failing command |

## Debugging

`pnpm dev:exec` reads a script from stdin, executes it, and prints the result. Prefer it over ad-hoc test scripts.

```bash
echo 'echo hello' | pnpm dev:exec
echo 'x=5; echo $((x + 3))' | pnpm dev:exec --real-bash             # also run the system bash and compare
echo 'for i in 1 2 3; do echo $i; done' | pnpm dev:exec --print-ast # print the parsed AST
```

It also accepts `--root <path>` to execute against a real directory, and `--no-limit` for large scripts.

## Architecture

```
Input Script → Parser (src/parser/) → AST (src/ast/) → Interpreter (src/interpreter/) → ExecResult
```

| Path | Responsibility |
| --- | --- |
| `src/parser/` | Recursive descent parser producing AST nodes. `lexer.ts` tokenizes bash syntax (heredocs, quotes, expansions); `expansion-parser.ts` and `compound-parser.ts` handle expansions and compound commands. |
| `src/interpreter/` | AST execution. `interpreter.ts` holds the execution loop and command dispatch, alongside word expansion, arithmetic, conditionals, control flow, and `builtins/`. |
| `src/commands/` | One directory per command, holding its implementation and its tests. Commands are registered in `registry.ts`. |
| `src/fs/` | Virtual filesystem: `overlay-fs/`, `read-write-fs/`, `in-memory-fs/`, `mountable-fs/`, and the shared `real-fs-utils.ts` security helpers. |
| `src/commands/awk/` | AWK text-processing interpreter. |
| `src/commands/sed/` | Stream editor, with addresses, ranges, and extended regex. |
| `src/commands/python3/` | CPython compiled to WebAssembly, running in a worker thread. |
| `src/commands/js-exec/` | Sandboxed JavaScript and TypeScript runtime built on QuickJS. |

## Security invariants

[THREAT_MODEL.md](./THREAT_MODEL.md) is the authoritative document. It covers the trust boundaries, the Python execution surface, and the residual risks that are accepted rather than fixed.

### Default-deny symlinks

`OverlayFs` and `ReadWriteFs` default to `allowSymlinks: false`, so `symlink()` throws `EPERM`, any path that traverses a real-filesystem symlink is rejected, and `readdir()` lists symlink entries that cannot be used. `lstat()` and `readlink()` still inspect a symlink without following it.

Validation is central. `src/fs/real-fs-utils.ts` holds the shared gates: `resolveCanonicalPath` and `resolveCanonicalPathNoSymlinks` canonicalize a real path, check that it is still inside the canonical root, and return the path to use for I/O, or `null` when the path escapes the root or traverses a symlink. ReadWriteFs wraps them in `resolveAndValidate`; OverlayFs wraps them in `resolveRealPath_`.

When you add a filesystem method, route real-filesystem access through those gates and use the path they return for the actual I/O. Never call `fs.promises.stat()`, `fs.realpathSync()`, or similar on an unvalidated path, and prefer `fs.promises.open()` over `fs.promises.readFile()`/`writeFile()`. A gate is not enough on its own: validation and use are not atomic, and `O_NOFOLLOW` binds only the final component, so an intermediate directory can still be swapped between the two. ReadWriteFs opens data I/O with `O_NOFOLLOW` and re-validates after `mkdir()`; a new method needs its own equivalent checks for the operations it performs.

In tests, pass `allowSymlinks: true` to the constructor when testing symlink behavior. `src/fs/cross-fs-no-symlinks.test.ts` covers the default-deny behavior and the `O_NOFOLLOW` protection.

### Prototype pollution

User-controlled data (stdin, arguments, file contents, HTTP headers, environment variables) can become JavaScript object keys, so every `Record<string, T>` needs a null prototype. The banned-patterns linter, which `pnpm lint` runs, enforces it.

- Static lookup tables: `nullPrototype()` from `src/commands/query-engine/safe-object.ts`.
- Empty accumulators: `Object.create(null)`.
- Bundled workers, which cannot import `safe-object`: `Object.assign(Object.create(null) as Record<string, string>, { ... })`.
- Self-referential types, where `Object.assign` breaks inference: `Object.setPrototypeOf(map, null)`, with a `@banned-pattern-ignore` comment on the line above it.

Never read `obj[userInput]` on a plain `{}`. Guard with `Object.hasOwn()`, or store the data in a `Map` or a null-prototype object. The same module exports `safeSet`, `nullPrototypeCopy`, and `nullPrototypeMerge`; prefer the last two over object spread when the object holds user data.

## Constraints

These hold for every change in this repository.

- Do not add dependencies that use WebAssembly. The existing exceptions are `sql.js` for SQLite and the vendored CPython build, both approved for security sandboxing. Binary npm packages are fine.
- 64-bit integers are explicitly unsupported.
- Parsing and execution must never hang, so every path needs a reasonable compute limit.
