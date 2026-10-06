---
"just-bash": patch
---

Nested `sh` and `bash` enable supported options listed in exported `SHELLOPTS` and `BASHOPTS`, such as `pipefail`, `nounset`, and `nullglob`. Child shells initialize their own option state so unexported shopt settings and child option changes no longer leak across that boundary.
