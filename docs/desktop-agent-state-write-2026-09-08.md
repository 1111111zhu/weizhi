# Desktop Agent redirected state-directory repair

## Evidence and cause

The installed 0.3.9 Manager health response reported `DEGRADED_NEEDS_ATTENTION`, five restarts and an unexpectedly exited worker. Windows Application events identified an unhandled `IOException` in `WriteSessionsAsync`, reached during initial session reconciliation. Cache-index writes failed in the same way. These were not authentication failures.

Read-only inspection identified a Windows directory junction redirecting the logical ProjectWing application-data directory to another drive. Isolated synthetic probes in fresh sibling directories reproduced `FileMode.CreateNew` failing with HRESULT `0x80070050` (file exists) through the logical path although `File.Exists` was false before and after. Creating another new file through the physical path succeeded. Directory creation through that logical path also failed to produce the requested directory. No production sessions or cache files were used in these probes.

Both ordinary .NET 8.0.8 tests and self-contained .NET 8.0.30 tests passed before the fix because their temporary directories were not redirected. The actual packaged worker reproduced startup failure with isolated redirected state; the same worker with a physical state path remained available. This establishes a redirected-path trigger on this machine, not a claim that every Windows junction or every .NET 8.0.30 installation is faulty.

## Change

- Resolve existing Windows state-directory ancestor redirects before creating state files, including not-yet-created descendant directories. An unresolved/broken directory target fails closed.
- Read and write the same physical state store; do not migrate, clear or regenerate records. Keep existing session local paths, cache containment rules, configured cache identity and Manager identity unchanged.
- Retain exclusive `CreateNew`, flush-to-disk, atomic replacement and backup behavior. Do not replace it with truncation or deletion of pre-existing temporary files.
- Retry initial synchronization after state I/O/access failures, with a five-second delay. Heartbeat state-access failures are logged and retried on the next heartbeat rather than terminating the host. Cancellation and other fatal errors retain their existing behavior.

## Validation

Commands run from the isolated `desktop-agent-state-write` worktree:

| Command | Result |
| --- | --- |
| `dotnet run --project apps/desktop-agent/runtime/RecoverySafety.Tests` (before change) | 46 existing scenarios passed on .NET 8.0.8 |
| `dotnet publish apps/desktop-agent/runtime/RecoverySafety.Tests -r win-x64 --self-contained true -p:RuntimeFrameworkVersion=8.0.30 -o output/state-write-baseline` then `./output/state-write-baseline/RecoverySafety.Tests.exe` | Build and 46 baseline scenarios passed |
| `dotnet run --project apps/desktop-agent/runtime/RecoverySafety.Tests` (after change) | 50 scenarios passed |
| `dotnet publish apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime -r win-x64 --self-contained true -p:RuntimeFrameworkVersion=8.0.30 -p:Version=0.3.9 -o output/state-write-fixed` | Passed; local diagnostic output only, not a published version |
| `dotnet publish apps/desktop-agent/runtime/RecoverySafety.Tests -r win-x64 --self-contained true -p:RuntimeFrameworkVersion=8.0.30 -o output/state-write-tests` then `./output/state-write-tests/RecoverySafety.Tests.exe` | Build and all 50 scenarios passed on release-parity runtime |
| `./output/state-write-tests/RecoverySafety.Tests.exe --probe-packaged-runtime ./output/state-write-fixed/ProjectWing.DesktopAgent.Runtime.exe` | Passed; isolated packaged worker remained alive, health HTTP 200, synthetic invalid record preserved in quarantine and backup, cache index written |

The four new scenarios cover existing/new redirected directories, retaining pre-upgrade records, and temporary state-file lock recovery/cancellation in background services. The packaged probe creates its own junction, StateRoot, CacheRoot and allocated loopback port, disables file launch and uses only synthetic state. It stops only the exact child process it starts. Fixture evidence is retained under its generated temporary directories; it does not delete user data or alter the existing junction.

Limitations: no new installer was published or installed, no real installed process was restarted/replaced, and no real records or cache were changed. Full Electron UI, Manager-integrated recovery, macOS and production editing/synchronization acceptance were not rerun. Native worker health validation is not an installed-app acceptance claim. This fixes state I/O; cache path identities and general cache-file path behavior are intentionally not redesigned here.

Delivery still requires an authorized PR/release and installer update. Do not overwrite files in the running installation as a shortcut.
