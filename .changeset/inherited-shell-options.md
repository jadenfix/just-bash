---
"just-bash": patch
---

Nested `sh` and `bash` enable supported options listed in exported `SHELLOPTS` and `BASHOPTS`, such as `pipefail`, `nounset`, and `nullglob`. Child shells initialize their own option state so unexported shopt settings and child option changes no longer leak across that boundary.

Recursive command wrappers copy the active caller's option state. Alias definitions use shell-local storage, so `BASH_ALIAS_*` environment values remain data even when alias expansion is enabled.

Executable script files start without parent aliases, and shopt changes stay within each host execution. Command-context maps exposed through callbacks are revoked when the command completes, just like directly retained maps.
