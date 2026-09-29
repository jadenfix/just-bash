# AGENTS.md

This file provides guidance to coding agents working with the code in this repository.

just-bash is a TypeScript implementation of a bash interpreter with an in-memory virtual filesystem. It gives AI agents a secure, sandboxed bash environment.

Setup, build, test, lint, and release commands live in [CONTRIBUTING.md](./CONTRIBUTING.md). Package conventions, the full prototype-pollution rules, and the test layout live in [packages/just-bash/AGENTS.md](./packages/just-bash/AGENTS.md).

## Running just-bash

- `pnpm shell` opens an interactive sandboxed shell. Network access is disabled by default; pass `--network` to enable it.
- `pnpm dev:exec` executes a script from stdin while developing; see [Debugging](#debugging).

### Sandboxed CLI

`packages/just-bash` ships a `just-bash` CLI that mounts a real directory through OverlayFS. Run it from `packages/just-bash` after `pnpm build`:

```bash
node ./dist/cli/just-bash.js -c 'ls -la' --root .                        # Run a command
node ./dist/cli/just-bash.js -c 'cat package.json' --root . --json       # Output as JSON
node ./dist/cli/just-bash.js script.sh --root .                          # Run a script file
node ./dist/cli/just-bash.js -e -c 'false; echo "not reached"' --root .  # Exit on the first failure
node ./dist/cli/just-bash.js -c 'echo hi > /tmp/f' --root . --allow-write
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

`pnpm dev:exec` reads a script from stdin, executes it, and prints the result. Prefer it over ad-hoc test scripts, which need a one-off approval each time.

```bash
echo 'echo hello' | pnpm dev:exec
echo 'x=5; echo $((x + 3))' | pnpm dev:exec --real-bash             # also run the system bash and compare
echo 'for i in 1 2 3; do echo $i; done' | pnpm dev:exec --print-ast # print the parsed AST
```

It also accepts `--root <path>` to execute against a real directory, and `--no-limit` for large scripts.

## Architecture

Paths in this section are relative to `packages/just-bash/`.

```
Input Script → Parser (src/parser/) → AST (src/ast/) → Interpreter (src/interpreter/) → ExecResult
```

| Path | Responsibility |
| --- | --- |
| `src/parser/` | Recursive descent parser producing AST nodes. `lexer.ts` tokenizes bash syntax (heredocs, quotes, expansions); `expansion-parser.ts` and `compound-parser.ts` handle expansions and compound commands. |
| `src/interpreter/` | AST execution. `interpreter.ts` holds the execution loop and command dispatch, alongside word expansion, arithmetic, conditionals, control flow, and `builtins/`. |
| `src/commands/` | One directory per command, holding its implementation and its tests. Commands are registered in `registry.ts`. |
| `src/fs/` | Virtual filesystem: `overlay-fs/`, `read-write-fs/`, `in-memory-fs/`, `mountable-fs/`, and the shared `real-fs-utils.ts` security helpers. |
| `src/commands/awk/` | AWK interpreter. User-defined functions support a single return expression only. |
| `src/commands/sed/` | Stream editor, with addresses, ranges, and extended regex. |
| `src/commands/python3/` | CPython compiled to WebAssembly, running in a worker thread. |
| `src/commands/js-exec/` | Sandboxed JavaScript and TypeScript runtime built on QuickJS. |

## Security invariants

[THREAT_MODEL.md](./THREAT_MODEL.md) is the authoritative document. It covers the trust boundaries, the Python execution surface, and the residual risks that are accepted rather than fixed.

### Default-deny symlinks

`OverlayFs` and `ReadWriteFs` default to `allowSymlinks: false`, so `symlink()` throws `EPERM`, any path that traverses a real-filesystem symlink is rejected, and `readdir()` lists symlink entries that cannot be used. `lstat()` and `readlink()` still inspect a symlink without following it.

Validation is central. `src/fs/real-fs-utils.ts` holds the gates (`validateRealPath`, `resolveCanonicalPath`, `resolveCanonicalPathNoSymlinks`), and each class wraps them (`resolveAndValidate` in ReadWriteFs, `resolveRealPath_` in OverlayFs). A gate canonicalizes the path, checks that it is still inside the canonical root, and returns it for the caller to use for I/O. A path that traverses a symlink fails that comparison, which costs no extra I/O.

When you add a filesystem method, route real-filesystem access through those gates. Never call `fs.promises.stat()`, `fs.realpathSync()`, or similar on an unvalidated path, and for data I/O prefer `fs.promises.open()` over `fs.promises.readFile()`/`writeFile()`. ReadWriteFs opens data I/O with `O_NOFOLLOW` and re-validates after `mkdir()`, which closes the window between validation and use. A method that goes through a gate inherits that protection automatically.

In tests, pass `allowSymlinks: true` to the constructor when testing symlink behavior. `src/fs/cross-fs-no-symlinks.test.ts` covers the default-deny behavior and the `O_NOFOLLOW` protection.

### Prototype pollution

User-controlled data (stdin, arguments, file contents, HTTP headers, environment variables) can become JavaScript object keys, so every `Record<string, T>` needs a null prototype. `pnpm lint:banned` enforces it.

- Static lookup tables: `nullPrototype()` from `src/commands/query-engine/safe-object.ts`.
- Empty accumulators: `Object.create(null)`.
- Bundled workers, which cannot import `safe-object`: `Object.assign(Object.create(null) as Record<string, string>, { ... })`.
- Self-referential types, where `Object.assign` breaks inference: `Object.setPrototypeOf(map, null)`, with a `@banned-pattern-ignore` comment on the line above it.

Never read `obj[userInput]` on a plain `{}`. Guard with `Object.hasOwn()`, or store the data in a `Map` or a null-prototype object. `packages/just-bash/AGENTS.md` lists the remaining helpers (`safeSet`, `nullPrototypeCopy`, `nullPrototypeMerge`) and the tests to add.

## Constraints

- No dependency may use WebAssembly (exception: `sql.js` for SQLite, approved for security sandboxing). Binary npm packages are fine.
- 64-bit integers are explicitly unsupported.
- Parsing and execution must never hang, so every path needs a reasonable compute limit.
- Install dependencies with `pnpm` rather than editing `package.json` by hand.
- Prefer a comparison or unit test over an ad-hoc script when the behavior of a bash script or an API is unclear.
- Biome rules often share their names with ESLint rules.
