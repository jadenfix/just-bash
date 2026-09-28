---
"just-bash": major
---

Add the `realpath` command for resolving canonical virtual filesystem paths.

Custom `IFileSystem` implementations must now implement `realpathFromCwd()`.
