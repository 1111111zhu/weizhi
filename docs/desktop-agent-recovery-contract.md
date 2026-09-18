# Desktop Agent adversarial recovery contract

Harden the existing Electron → Manager → Runtime architecture. Recovery must never delete working copies, release a server editing lease merely because a process disappeared, close Office, or terminate unrelated processes.

The first-iteration implementation/limits below are retained as history. See [the second-iteration implementation record](desktop-agent-recovery-implementation-2026-09-06.md) for subsequent audit fixes and current release acceptance. In particular, legacy directories are now retained in place rather than automatically archived.

Invariants:

1. One cooperating Manager and Runtime may own each state root. Duplicate starts fail before rewriting another instance's state.
2. HTTP reachability is not readiness. Recovering, updating, degraded, unauthenticated and unknown states remain distinct.
3. Failed reads do not imply zero sessions. Last-known sessions are explicitly stale and cannot authorize mutations.
4. Startup and recovery are single-flight. A late exit from an old process cannot replace or restart a newer process.
5. Only a process created/owned by the supervisor may be terminated. An unknown listener is a conflict, never an invitation to kill a PID.
6. Web-origin requests cannot use native recovery controls. Protocol activation accepts fixed commands, never executable paths, shell commands or arbitrary URLs.
7. Service availability and individual file recovery are separate results. Interrupted commits retain their checkpoints and idempotency identities; lost leases preserve conflict candidates.

Adversarial scenarios: worker crash; exhausted restart budget; hung worker; concurrent recover clicks; stale exit callbacks; foreign port listener; duplicate Managers on one state root/different ports; duplicate Runtime; corrupt session state; account changes during failed reads; offline recovery; obsolete protocol commands; duplicate Electron invocation; update/recovery overlap; legacy installers that do not obey ownership rules.

Tests use temporary state/cache directories, independent ports, synthetic files and fixture processes. Live user installations, Office sessions and production leases are excluded from destructive testing. Platform/package acceptance is distinct from unit tests. Old binaries cannot be made cooperative by new code; preserve their data and fail closed on ambiguous takeover.

Baseline correction: current main already removed hashing/reconciliation from the health endpoint; no repeat change is needed there.

## Implemented in this iteration

- Kernel-held ownership for Manager state, Runtime state and Runtime cache, including duplicate starts on different ports. Lock files are not deleted to recover from a crash.
- Bounded automatic restart; explicit native recovery resets the exhausted budget, checks the Manager generation and only replaces the supervisor's own child. Startup/recovery requests are coalesced.
- Recovery activation is a strict `projectwing-agent://recover` command. On Windows command-line activation, a recovery-only process runs before Electron singleton delegation and does not perform regular-start migration, protocol registration or automatic update application.
- Foreign/ambiguous listeners and incompatible active versions fail closed. The recovery client's health timeout exceeds the Manager's 1.5-second worker probe. Shutdown from the new tray host verifies its owned Manager PID and binds the request to its generation.
- Partial/malformed session reads retain explicitly stale last-known file rows and prohibit file actions. Signing out invalidates earlier in-flight snapshot reads.
- Cache eviction is limited to replaceable CONTENT/READ_ONLY entries. Master copies, snapshots, unknown/orphan files and uncertain restore state are not age/pressure-evicted. Legacy install retirement archives the old directory instead of recursively deleting it.
- EMP settings provide user-initiated OS protocol activation, bounded readiness confirmation, Chinese/English guidance and installer fallback. Reachability, pairing and service readiness are not the same state.

## Release blockers and remaining limits

This is a first hardening batch, not a claim that every installation/recovery scenario is resolved.

1. There is no independent stable launcher outside the versioned app yet. A damaged executable or hung Manager with no trustworthy response still needs installer/manual repair; no unknown process is killed.
2. Recovery checks the observed update state, but there is not yet an atomic maintenance lease shared by all installer/updater/recovery entry points. A concurrently starting update or obsolete setup that ignores new locks remains a release-blocking acceptance scenario.
3. Duplicate cooperative processes are excluded, but arbitrary old installers and copied packaged apps can still rewrite URL registration or scheduled tasks. Legacy scheduled-task deletion is still name-based. Installation identity, registration ownership and transaction/rollback require a separate implementation and Windows VM acceptance matrix. Do not describe this batch as solving two arbitrary setup.exe copies.
4. Recovery-only Windows executable activation is not equivalent to macOS LaunchServices activation. Native package tests on macOS/Linux and a hung Electron main process have not been performed. Electron documents these distinct [protocol activation paths](https://www.electronjs.org/docs/latest/api/app).
5. Disabling implicit startup update application is intentional; explicit updates still use the existing update controller. See [Velopack's startup update behavior](https://docs.velopack.io/integrating/overview). Update/install interruption, rollback and signature acceptance have not been exercised here.
6. Last-known UI rows are held in memory, not a new persistent recovery journal. Retained orphan files can increase disk usage; there is no new reviewed manual-cleanup UI yet. Archiving a legacy directory preserves bytes but may require manual path recovery for custom caches inside it.
7. Native-only controls exclude browser requests, not hostile software already running as the same OS user. Old native shutdown clients remain supported without the generation header; new tray hosts send it.

## Validation record — 2026-09-06

Worktree: `.worktrees/desktop-agent-recovery`, branch `codex/desktop-agent-recovery`, baseline `bf71c655`.

- `node apps/desktop-agent/scripts/verify-manager-runtime.mjs`: passed after the shutdown acknowledgement connection fix, using temporary state/cache roots and independently allocated ports (last successful Manager port 50804). It builds Manager, Runtime and RecoveryWorker. Scenarios: six worker exits/exhausted budget, browser-control rejection, stale generation, update-state refusal, concurrent recovery, hung child replacement, duplicate state/cache owners, sentinel workpaper/snapshot retention, and normal shutdown.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop test`: passed, 13 files / 75 tests after final snapshot/timeout changes.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop lint`: passed, TypeScript validation.
- `corepack pnpm --filter @project-wing/emp test src/components/desktop-agent-settings.test.tsx src/components/desktop-agent-recovery.test.ts`: passed, 2 files / 14 targeted recovery UI/policy tests.
- `corepack pnpm --filter @project-wing/emp lint`: passed after narrowing the legacy/native health union.
- `git -c core.safecrlf=false diff --check`: passed.
- Browser visual path: `http://127.0.0.1:3035/zh-CN/engagement/project-orchid-2026` → Settings → Desktop Agent. Chinese dark-mode unavailable state and recovery action verified; screenshot captured in the task. This was an isolated **mock** app with unused API/Agent ports, not backend-attached acceptance. OS activation was deliberately not clicked against the user's registered Agent. Backend-attached recovery, packaged Electron/tray UI, Office, installation and cross-platform end-to-end validation remain unrun.
- No commit, push, PR, release or deployment in this iteration.

### Validation incident

The first run of the pre-existing native verifier isolated StateRoot but omitted CacheRoot, inadvertently allowing startup cache GC to use the user's default cache. Four old cache directories were emptied: two DMS Declaration PPTX caches, one HSBC Hongkong PDF cache and one ShineWing bank-confirmation DOCX cache. This was disclosed immediately; the user confirmed these were test files. No recovery from an unverified older copy was attempted. Subsequent runs explicitly isolate both state and cache, disable file launch, and assert preservation of old orphan workpapers and unreferenced snapshots. The safe-eviction changes above address the underlying production risk as well as the test isolation defect.
