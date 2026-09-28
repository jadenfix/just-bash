---
"just-bash": patch
---

timeout: keep the shell running when a deadline lands while a command is still loading

A cancelled command that had not started yet could not acknowledge cancellation until its module import finished, so a script that timed out a cold command lost every statement after it. Cancelled invocations now stop waiting for that import and report cancellation instead.
