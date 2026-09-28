---
"just-bash": patch
---

timeout: keep the caller running when the deadline lands while a command is still loading

A cancelled command that had not started yet could not acknowledge cancellation until its module import finished. When that import outlasted the cleanup grace window, the runtime treated the command as one that ignored cancellation and poisoned the shared execution scope, so the caller's remaining statements never ran: a script that timed out a cold command lost everything after it. Cancelled invocations now give up on the import immediately and report cancellation, and a command whose module finishes loading later is never started.
