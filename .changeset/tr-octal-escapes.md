---
"just-bash": patch
---

tr: decode octal escapes and `\\`, `\a`, `\b`, `\f`, `\v` in SETs

`tr` only understood `\n`, `\t` and `\r`, so `\015` was read as `0` and `\101` as `1`. It now decodes `\NNN` (one to three octal digits) and the remaining POSIX escapes, and an escape can be a range endpoint, as in `tr -d '\000-\037'`. This fixes autoconf's `config.status`, which computes a carriage return with `tr X '\015'`.
