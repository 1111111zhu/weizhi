# Desktop Agent adversarial review — 2026-09-06

Target: the uncommitted `codex/desktop-agent-recovery` worktree based on `bf71c655`, not the older shared main checkout. Requested scope: three independent adversarial reviews of recovery traps and unreasonable user intervention. This is an audit, not a production-fix or release approval.

This document records **pre-fix findings**. Subsequent fixes and acceptance gates are tracked in [the implementation record](desktop-agent-recovery-implementation-2026-09-06.md). Audit witnesses were converted into assertions for the desired fixed behavior; their original passing results below are historical defect evidence, not current behavior promises.

## User-facing acceptance bar

- Common transient failures should recover automatically with bounded backoff and without repeated dialogs.
- If automatic recovery stops, one product-level action should resume a safe, observable recovery operation; users should not have to infer which process to terminate.
- A service being reachable, an operation being accepted, and a file being durably uploaded are distinct outcomes.
- If user judgment is needed, ask a domain question (which conflicting version to keep), not an infrastructure question (which PID to kill).
- Redownload/reinstallation is a last resort for missing/untrusted local repair material, not the default response to every timeout or ownership mismatch.
- Never silently discard local edits, hide unresolved files, or declare success while a repairable fault remains blocked.

## Evidence categories

- Native fixture: actual Manager/Runtime processes, with independent ports, temporary StateRoot **and** CacheRoot, synthetic files, and file launch disabled.
- Mock witness: real application methods called with mocked OS/network/updater dependencies. A passing witness establishes the reported undesirable behavior; it is not evidence that the behavior is safe.
- Static trace: a complete source call chain establishes a risk, but the relevant installed application/Office/OS event was not performed.

No real installer, registered protocol handler, scheduled task, registry entry, Office session, production lease, or installed Agent is mutated in this audit. No remote push, merge, release or deployment is authorized by this review.

## Findings: process ownership and liveness

### R1 — P1: hard Manager termination leaves a Runtime that defeats recovery

Trace: `apps/desktop-agent/manager/ProjectWing.AgentManager/ManagedRuntimeHost.cs:49`, `:145`; `apps/desktop-agent-desktop/src/main/managed-runtime-host.ts:190`.

Native sequence: start isolated Manager/Runtime → forcibly terminate only that test Manager → start a replacement against the same isolated state/cache/ports → request native recovery. The original Runtime survives and retains the ownership locks. The new Manager exhausts five retries in approximately 35 seconds and becomes `DEGRADED_NEEDS_ATTENTION`. Recovery accepts the request (202), but approximately 35 seconds later reaches the same degraded state with the original Runtime still alive.

Evidence: actual native characterization passed in 72.30 seconds. `ProcessExit` cleanup does not cover hard process termination; the spawn path has neither parent-death binding nor authenticated orphan adoption/retirement. The locks prevent unsafe double-writing, but provide no recovery exit from that safe refusal state. The Electron fallback Manager kill is another possible entry into this path (static inference).

Required direction: recover verifiably owned orphan service processes automatically through lifecycle binding or authenticated adoption/retirement. Do not indiscriminately kill a process tree: Office and user work must remain outside forced service cleanup.

### R2 — P1: a partial health body wedges both health and recovery

Trace: `apps/desktop-agent/manager/ProjectWing.AgentManager/WorkerHealthProbeService.cs:19`, `:25`.

A synthetic Worker is initially healthy, then responds to health with HTTP 200 and a declared body length but sends only the first byte and holds the connection. Both Manager health and native recovery with a valid generation exceed a 5-second client deadline without replacing the Worker. `ResponseHeadersRead` followed by `ReadAsStringAsync()` lacks a cancellation deadline covering the full response body; the HttpClient 1.5-second timeout is not a complete bound for that sequence. The tray's 3-second identity probe then fails closed as an unknown listener.

Evidence: native fixture characterization passed in 11.77 seconds. Fixture is self-stopping after 45 seconds, and the harness cleans up only its owned processes. Source retained at `apps/desktop-agent/test-fixtures/PartialHealthWorker` for reproduction.

Required direction: bound headers **and** body reading/size with a shared deadline. Manager identity/control availability must not depend on obtaining a complete Worker health response. Consecutive bounded failures should feed supervised automatic recovery.

### R3 — P2: a live deadlocked Worker does not trigger automatic recovery

Trace: `apps/desktop-agent/manager/ProjectWing.AgentManager/WorkerSupervisor.cs:171`.

The watchdog checks process exit, not a threshold of failed health probes. An ordinary deadlock can therefore require the user to discover and manually request recovery even when it is safe for the product to diagnose the condition itself.

Evidence: static supervision-policy trace. Add startup/busy/update-aware grace periods and consecutive health-failure thresholds; a single slow response must not trigger disruptive restart.

### R4 — P2: service recovery does not repair a crashed tray renderer

Trace: `apps/desktop-agent-desktop/src/main/tray-window-events.ts:31`; `managed-runtime-host.ts:66`.

The event wiring records preload errors but has no corresponding renderer-crash/unresponsive repair path. If the service remains READY, recovery returns success without recreating the UI. A blank/broken tray can therefore coexist with "service healthy".

Evidence: static inference, packaged Electron crash was not injected. Add bounded renderer reload/recreation under the same user-facing recovery operation, while distinguishing UI health from local-service and file health.

## Findings: file state and user actions

### F1 — P1: ordinary release can discard failed-upload local edits

Trace: `apps/desktop-agent-desktop/src/renderer/tray-content.tsx:128` → `src/main/runtime-client.ts:114` → `apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime/DesktopAgentSessionSyncService.cs:367`, `:374`, `:447`.

After a changed file is closed and upload fails (`CHECKIN_FAILED`), the ordinary tray "Release file" action sends release without a discard decision. `MarkReleasePendingAsync` accepts that lifecycle and marks `UNCHANGED_RELEASE` without checking/uploading local changes. Release success, or the handled revoked/mismatched-lock outcomes, proceeds to snapshot/master cleanup. There is no preserve/discard flag or intervening user confirmation in this chain.

Evidence: full static cleanup trace plus mock witness proving the ordinary client release is forwarded for dirty failed-upload work without a discard decision. Actual bytes were **not** deleted during the audit. This is not a claim that every release loses data; the trigger is unuploaded local changes followed by ordinary release.

Required direction: ordinary release must verify/upload changes before cleanup. On uncertainty, keep the bytes. A separate explicit discard operation needs a recoverable local copy and a clear domain-level choice. Relabeling the same destructive behavior is insufficient.

### F2 — P1: quarantine protection blocks safe allocation, not just unsafe eviction

Trace: `DesktopAgentCacheService.cs:35`, `DesktopAgentRuntimeState.cs:592`, `DesktopAgentUploadSnapshotService.cs:17` under the Runtime project; `apps/desktop-agent-desktop/src/main/managed-runtime-host.ts:66`.

A corrupted sessions file can be recovered from a good backup while leaving an historical quarantine JSON. Diagnostics count that file on subsequent runs. The new capacity guard throws `CACHE_RECOVERY_REQUIRED` before checking whether there is already enough free capacity, so even safe upload-snapshot allocation is blocked. Restart does not resolve the historical quarantine, and service recovery can return immediately for `READY_WITH_ATTENTION`. There is no corresponding quarantine-resolution UI/API.

Evidence: static deterministic trace. This is a **regression introduced by the current hardening batch**: preserving uncertain bytes is correct, but freezing all new allocations is not.

Required direction: prohibit unsafe eviction while permitting allocation that requires no eviction; distinguish unresolved recovery from resolved quarantine history. Automatically validate/restore trusted backup state; expose specific affected files only when user judgment is genuinely needed.

### F3 — P1: cache-root changes strand existing sessions

Trace: `DesktopAgentCacheEndpoints.cs:113`, `:118` → `DesktopAgentSessionSyncService.cs:491`; UI `apps/emp/src/components/desktop-agent-cache-settings.tsx:59`.

With active sessions under root A, changing the setting to B persists it and exits the Runtime after 350 ms without session drain/migration or rollback. Restored sessions still reference A, but cleanup only trusts the current root B. They enter persistent `CLEANUP_FAILED`. A proposed B already owned by another Runtime passes the write probe but can prevent the next startup from acquiring ownership; the saved configuration is not rolled back.

Evidence: static source trace, no real cache setting changed. Refusing to delete A is a good safety boundary; the defect is the absence of a supported completion/recovery path.

Required direction: bind each existing session to its validated controlled root, using B only for new work, or transactionally drain/migrate before committing the switch. Validate new-root ownership and roll back failed activation automatically.

### F4 — P1: missing primary session state is treated as a fresh empty install

Trace: `DesktopAgentRuntimeState.cs:38`, `:40`, `:53`, `:592`.

When `sessions.json` is absent, loading returns an empty list before examining `.bak/.bak2`. Backup recovery only runs when a primary file exists but is invalid. Existing unuploaded work/backup state may therefore disappear from tracking, renewal and upload while health remains READY if no quarantine is recorded.

Evidence: static branch trace. Byte preservation by GC does not restore business ownership or provide a visible recovery route.

Required direction: distinguish first launch from state loss; validate backups and a persistent recovery manifest before accepting empty state. Historical state/work must not silently become "no active files".

### F5 — P2: a valid empty response can erase unresolved last-known files

Trace: `apps/desktop-agent-desktop/src/main/runtime-client.ts:81`, `:85`, `:88`; `src/renderer/tray-content.tsx:69`.

After previously displaying unuploaded work, return health with `READY_WITH_ATTENTION`, `quarantineCount:1`, `restoreState:READY_WITH_ATTENTION`, and a syntactically valid `sessions:[]`. The snapshot replaces the old list with `stale:false,error:null,sessions:[]`, and the tray's normal empty state says there are no active files. Recovery success is only service readiness and does not clear this data-recovery issue.

Evidence: second state-review mock witness. The blanket browser timeout guidance also does not distinguish slow startup, missing protocol registration, ownership conflicts, or unresolved file recovery.

Required direction: separate service availability from file recoverability. Keep unresolved file cards/recovery records until explicitly reconciled, and choose the next action from a structured failure cause rather than presenting reinstall as a general remedy.

## Findings: installation and update lifecycle

### I1 — P1: independent recovery creates a service the later UI cannot stop

Trace: `apps/desktop-agent-desktop/src/main/index.ts:100`; `managed-runtime-host.ts:121`, `:176`; `update-controller.ts:103`.

The recovery-only executable starts a Manager and exits. A subsequently launched ordinary Electron host sees a healthy same-version service and returns without adopting control. Its `stop()` returns immediately when `this.manager` is null. Updating still invokes the updater and exits the UI, despite no shutdown request having been sent to the existing service.

Evidence: two mock witnesses prove both no shutdown and update continuation. The audit did **not** run packaged Velopack against locked files, so installation failure itself remains unverified.

Required direction: separate durable service ownership from a particular UI process. Transfer authenticated lifecycle control using installation identity/generation, and require a verified stopped state before update activation. Do not solve this by allowing arbitrary PID takeover.

### I2 — P1: updater launch failure leaves an invisible quitting latch

Trace: `update-controller.ts:102`; `index.ts:138`, `:360`.

`onBeforeQuit()` sets `quitting=true` before `waitExitThenApplyUpdate()`, which can throw outside the subsequent cleanup block. There is no rollback of the quitting flag. The UI can remain open after an update error, but explicit recovery silently returns because it thinks shutdown is underway; a later quit skips ordinary shutdown handling.

Evidence: mock injected updater-launch failure leaves the latch true and calls neither stop nor quit.

Required direction: transactionally prepare/stop/handoff/exit, restoring an actionable normal state if preparation fails. Preserve the verified downloaded package for in-place retry. Every disabled recovery action must explain its current reason; stale historical flags must not disable it.

### I3 — P1: stale update state can permanently veto recovery

Trace: `apps/desktop-agent/manager/ProjectWing.AgentManager/RuntimeRequestHandler.cs:197`; Runtime `DesktopAgentUpdateStatusReader.cs:48`, `DesktopAgentHealthService.cs:65`.

An interrupted install/update can leave a valid active status such as INSTALLING. The status reader/recovery check does not bind it to a live transaction owner or maintenance lock. Restarting the process or machine leaves the JSON unchanged, health reports UPDATING and recovery refuses. The current Electron updater does not reconcile the old native status.

Evidence: static source trace, no real status manipulated during this audit.

Required direction: bind persisted stages to an installation transaction and live ownership. Recover ownerless interrupted transactions by checking artifacts then finishing/rolling back; do not equate an old stage label with a live updater, and do not break a live lock merely because time elapsed.

### I4 — P1 candidate: packaged release identity may differ from reported app version

Trace: `apps/desktop-agent-desktop/scripts/package-velopack.mjs:15`, `:108`; `src/main/index.ts:62`; `package.json:3`; electron-builder configuration and local Electron `getVersion()` API declaration.

The release environment supplies a changing pack version to Velopack, while the packaged Electron manifest appears to retain `package.json` version 0.3.0 without an `extraMetadata.version` override. The host passes `app.getVersion()` to the Manager, so different published packages may report the same version and bypass the new different-version refusal.

Evidence: static publishing/source/API chain only. **Actual app.asar/installed artifact inspection is required to confirm the packaged outcome.**

Required direction: use one authoritative release/build identity in the package manifest, Manager, Runtime and handshake, with separate installation/channel identity. Do not infer executable compatibility from display text alone.

### I5 — P2: concurrent update requests run duplicate lifecycle chains

Trace: `apps/desktop-agent-desktop/src/main/update-controller.ts:92`.

Two concurrent apply calls are not coalesced and share mutable availableUpdate. The mock witness observes two downloads, updater applications, stops and quits. Real Velopack may reject one due to its own lock; this audit does not claim two real installers definitely execute. The application itself nevertheless lacks deterministic shared progress/outcome handling.

Required direction: one main-process update transaction and promise, with immutable selected release identity. Duplicate actions observe that transaction instead of launching another attempt or dialog.

### I6 — P2: ordinary startup synchronously retries legacy cleanup before showing UI

Trace: `legacy-windows-migration.ts:39`, `:177`; `index.ts:115`.

Three scheduled-task commands run before the migration-complete early return and before UI creation, each with a 15-second timeout. A degraded Task Scheduler can therefore leave a startup invocation without visible feedback for a long interval; failure is recorded to a diagnostic file rather than presented as a specific recovery state. Task removal is also still based on a fixed name, not verified installation ownership.

Evidence: static timing/ordering trace; no scheduled-task commands executed.

Required direction: make completed migration cheap, verify task ownership, avoid blocking the UI thread, and expose actionable progress/error if an actual migration is needed.

## Integration coverage finding

The native release verification job does not run the actual Manager crash/recovery verifier. `.github/workflows/desktop-agent-native.yml:175` invokes `verify-native-hosts.mjs`, but that entry point only calls `verifyDeliveryContract()` (`apps/desktop-agent/scripts/verify-native-hosts.mjs:1-3`), which reads/asserts packaging and publishing source contracts. The desktop Vitest/lint/build commands at workflow lines 184-186 do not substitute for actual native fault injection. `verify:manager` exists separately in `apps/desktop-agent/package.json:27` and is not invoked by the searched workflows/scripts.

Consequently, a green native release verification job is not evidence for recovery from a killed Manager, a stuck health response body, state-file loss, or interrupted installation. Add isolated native lifecycle acceptance gates on the supported platforms, while retaining static delivery checks for their separate purpose. This is a coverage gap, not a claim that any current workflow failed.

Read-only audit commands: `rg -n 'desktop-agent|AgentManager|native-shared' .github/workflows scripts/ci apps/desktop-agent-desktop/scripts -g '*.yml' -g '*.mjs' -g '*.ts'`; `rg -n 'verify:manager|verify-manager-runtime|verify:runtime|verify-runtime.mjs|verify:update' .github scripts -g '*.yml' -g '*.sh' -g '*.ps1' -g '*.mjs'`; targeted `Get-Content` reads of the workflow, delivery verifier and package manifest.

## Remediation order

1. **Preserve recoverable work and make it visible:** fix ordinary dirty release, missing-primary backup recovery, quarantine allocation, and historical cache-root ownership (F1-F5). No recovery/repair action should discard user edits to make status green.
2. **Close the process-recovery loop:** bounded independent Manager identity/control, parent-death/orphan policy excluding Office, UI-to-service control handoff, sustained-health monitoring and renderer recovery (R1-R4, I1). A one-click recovery action must perform a meaningful operation rather than repeat an impossible spawn.
3. **Make installation/update a recoverable transaction:** one authoritative installation/build identity, one maintenance owner, idempotent steps and rollback/reconciliation after interruption; reset failed exit intent, coalesce updates, verify registration/task ownership (I2-I6). Cached verified repair material should be reused before asking for a new installer download.
4. **Expose understandable outcomes and enforce them in acceptance tests:** distinguish interface, service, account and file recovery; show current progress and specific actionable causes. Reserve user decisions for conflicts or permission/installation approval. Add real native failure sequences to CI, then perform packaged Windows acceptance before release; macOS/Linux need their own actual platform acceptance.

The inability to recover these common conditions is not an unavoidable browser limitation. Browser/OS permissions still matter for activation, but they do not require the application to lose ownership, freeze behind stale JSON, hide unresolved work, or silently disable a recovery button. Missing executable/repair material may genuinely require download; that should not be the generic timeout remedy.

## Commands, outcomes and artifacts

All commands below ran in `D:/Project_wing/.worktrees/desktop-agent-recovery` unless explicitly pointing at a temporary fixture. Production implementation files were not changed in this review; additions are audit tests, a synthetic Worker and this report.

Mock witnesses (installation agent: 4 cases; state agent: 2 cases), also rerun together by the primary agent:

```powershell
corepack pnpm --filter @project-wing/desktop-agent-desktop test src/main/adversarial-install-review.test.ts src/main/adversarial-state-review.test.ts
```

Result: 2 test files / 6 witnesses passed. They assert **undesirable current behavior**, not desired safety contracts.

Native orphan process witness, run by the process agent:

```powershell
$env:PROJECT_WING_RUN_ADVERSARIAL_PROCESS_AUDIT='1'
corepack pnpm --filter @project-wing/desktop-agent-desktop test src/main/adversarial-process-review.test.ts
```

Result: orphan witness passed in 72.30 seconds. The partial-body test is opt-in through its fixture DLL environment variable. An initial assertion expected an explicit JSON null, while the serializer omitted the field; the witness was corrected to a nullish check and rerun. Product behavior was not changed. Isolated log: `C:/Users/LHX/AppData/Local/Temp/project-wing-process-audit-DzxtDz/audit-output.log`.

The partial-body witness first ran against the agent's temporary .NET fixture (11.77 seconds). Its exact source was retained in the repository, then the primary agent built that retained source and reran:

```powershell
dotnet build apps/desktop-agent/test-fixtures/PartialHealthWorker/PartialHealthWorker.csproj --nologo
$env:PROJECT_WING_RUN_ADVERSARIAL_PROCESS_AUDIT='1'
$env:PROJECT_WING_BODY_AUDIT_DLL='D:\Project_wing\.worktrees\desktop-agent-recovery\apps\desktop-agent\test-fixtures\PartialHealthWorker\bin\Debug\net8.0\PartialHealthWorker.dll'
corepack pnpm --filter @project-wing/desktop-agent-desktop test src/main/adversarial-process-review.test.ts -t 'partial health body' --reporter verbose
```

Result: build succeeded with 0 warnings/errors; 1 witness passed (12.53 seconds), orphan witness filtered/skipped. Independent ports 58730/58731; synthetic state/cache under `C:/Users/LHX/AppData/Local/Temp/project-wing-process-audit-1XMhiw`. Native witnesses remain opt-in rather than automatically running against default installations.

Additional primary validation: `corepack pnpm --filter @project-wing/desktop-agent-desktop lint` passed; `git -c core.safecrlf=false diff --check` passed. Agents formatted their TS witness files with `corepack pnpm exec oxfmt <test-path>`.

Not performed: actual dirty-file deletion, live Office operation, installed-app recovery, packaged Electron renderer crash, installed app.asar version inspection, updater/installer activation, registry/task changes, real browser UI interaction, backend-attached end-to-end acceptance, macOS/Linux native acceptance, commit/push/merge/deploy. Static findings are explicitly labeled above and must not be reported as native experiments.
