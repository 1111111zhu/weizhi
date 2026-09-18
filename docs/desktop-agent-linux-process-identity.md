# Stable native process identity — release follow-up

The first release attempt for PR #1158 was stopped by its Linux native recovery gate (run `34027723534`, job `101472387935`). The Manager stayed alive, but each child rejected the parent generation and exited with `Manager lifetime identity no longer owns this Runtime`. No new native package was published by that failed attempt.

## Cause and fix

The original guard compared UTC ticks from `Process.StartTime` exactly across processes. [.NET 8's Linux implementation](https://raw.githubusercontent.com/dotnet/runtime/v8.0.0/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/Process.Linux.cs) derives that value by adding a boot-time estimate, cached independently in each process, to the kernel start counter. It is useful as a display timestamp, not an exact cross-process generation identifier.

The shared `ProcessGenerationIdentity` now uses Linux's boot ID, PID and raw start counter from [field 22 of `/proc/pid/stat`](https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html). It parses around the last closing parenthesis because the command name may include spaces/parentheses; it never converts the counter to floating point or a wall-clock timestamp. Windows retains its stable UTC creation-time identity. Manager-to-Runtime lifetime verification and persisted maintenance owner/updater records consume the same token. UTC fields remain diagnostic/backward-compatible fields, not a weaker fallback when a new token is invalid.

An existing Linux PID with only legacy approximate UTC evidence is not presumed recycled: its record is retained for review. An absent recorded PID can still prove that process ended. The guard also rechecks generation while monitoring and handles exit/read races through bounded self-shutdown rather than an unhandled watcher-thread exception. Nothing widens process-kill authority or disables the ownership gate.

## Regression evidence

- `dotnet run --project apps/desktop-agent/manager/RecoveryControl.Tests/RecoveryControl.Tests.csproj --no-launch-profile`: passed on Windows, including two actual child-process comparisons against the parent's token/maintenance record, boot and PID-reuse distinctions, parentheses/space parsing, counters above JavaScript's exact integer range, malformed input, and diagnostic timestamp drift. Existing maintenance/handoff/retained-file checks remain in the suite.
- Linux legacy behavior is explicitly checked when this suite runs on Linux. The native workflow still executes the real Manager/Runtime gate; it has not been weakened or skipped.
- Local Docker Linux engine was unavailable and the only installed WSL distribution was Docker Desktop; no daemon was started or existing installation modified to manufacture a local Linux pass. Linux end-to-end confirmation remains a requirement of the next CI release attempt.

See the production recovery acceptance record for subsequent PR/run IDs and publication outcome. No installed-app update or real user-file fault injection was performed during this fix.
