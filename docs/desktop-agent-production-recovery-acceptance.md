# Production Desktop Agent acceptance

Requested by the user: fix and deploy, then update this PC from the production app through the **normal user-facing path**. Inject failures and judge whether a human can understand and recover, not whether an engineer can repair it with shell commands.

## Execution stages

1. Finish local fixes and regression gates; integrate current main through a PR.
2. Start the native stable-release workflow and the ordinary Web/API deployment triggered by main. Record commit, workflow IDs, release version and URLs separately. A started workflow or successful validation is not a completed deployment.
3. Schedule a quiet follow-up approximately an hour later, not a tight polling loop. Verify both web activation and published native assets for the intended generation. If still running, remain quiet and check on the next scheduled run; surface failures needing action.
4. Visit the production EMP app, log in through its normal web flow, and use its Desktop Agent entry plus the installed app's Check for updates / Download and restart flow. Do not substitute a command-line install, registry rewrite, direct cache edit or process kill for this update path. If OS security or an installation approval needs user action, pause and ask rather than bypassing it.
5. Confirm the new version in the app, the usable web connection and existing local-file status before injecting faults.

## Safety boundaries

- Before any installed-process fault, inspect the visible file list and ensure there are no non-test unsynchronized/open files at risk. If uncertain, do not inject the fault.
- Use a dedicated test-only project/files, no invitations, emails or notifications to other users. Preserve test outputs as evidence; cleanup is a separate deliberate action.
- Fault injection may use developer tooling on exactly verified test/Agent-owned processes; recovery must use the same buttons and messages an ordinary user sees. Record both explicitly.
- Never terminate Office, kill an unverified/reused PID, corrupt the user's session/cache store, change global network/security settings, delete working copies or downgrade a real installation merely to manufacture a failure.
- Destructive state corruption, duplicate-install races and cache-capacity boundary experiments remain isolated fixture tests unless a separate safe acceptance environment is established.

## Human-centered scenarios

| Scenario | Observe | Desired recovery |
| --- | --- | --- |
| Normal old-to-new update | Visible progress, old version stops, new version shown, pairing/files retained | One normal update flow; no manual uninstall or console |
| Worker exits unexpectedly | How quickly disruption is noticed; whether errors multiply | Automatic bounded recovery; useful progress if work is temporarily blocked |
| Manager exits unexpectedly | Whether old worker becomes orphaned; visible app state | Automatic lifecycle cleanup/restart or one clear recovery action |
| Worker unresponsive | Finite health/request deadlines and no frozen recovery control | Automatic sustained-failure recovery, avoiding repeated-click loops |
| Tray UI failure | Whether service remains usable and tray can be recreated | Bounded UI recovery; no false claim that a blank interface is repaired |
| Repeated recovery/update actions | Duplicate dialogs, conflicting progress, disappearing UI | Single shared operation and consistent final outcome |
| Pending/failed upload | Exact file identified; action wording; retained bytes | Close/save instructions and safe retry, never implicit discard |
| Unresolved file records | "No files" vs explicit retained-work warning | Preserve evidence and provide a visible retained-files action |

For each case record environment/version, trigger, first visible feedback, final state, elapsed time, screenshots, user actions required, any confusing terminology, and whether an engineer-only intervention was necessary. An engineer-only recovery is a failed usability outcome even if functionality is eventually restored.

## Current status

2026-09-08 0.3.8 working acceptance and user-authorized legacy UI retirement:

- Installed `current/sq.version` and live `/health` both report 0.3.8; `/auth/status` reports authenticated=true. User explicitly reported that normal work now succeeds. This confirms user-reported functional recovery, not completion of every isolated failure scenario below.
- The remaining old window was PID36400 from `ProjectWing/DesktopAgent/app-0.2.11/ui/ProjectWingDesktopAgent.exe`. Its displayed 0.3.8 comes from the shared backend health, not the UI binary version. Source confirms its close control POSTs to the shared `/control/shutdown`; it is not safe to treat that button as UI-only retirement while the new backend is active.
- After the user authorized retiring this window, Computer Use identified its exact legacy window/accessibility controls. No close input was sent. An initial process identity check refused action because CIM truncates timestamps to microseconds (639244177600495780 vs Process.StartTime ticks639244177600495785). Fresh inspection established the exact process path and full-resolution creation timestamp. A retained process handle was checked against both before terminating only the legacy UI. This was explicit engineer-assisted process retirement, not normal UI acceptance.
- Post-action checks confirm no legacy UI remains, current Manager process identity and worker PID are unchanged, runtime is still0.3.8, and authentication is stilltrue. The retired legacy Run startup remains absent. No cache, session, working file, lock, installation directory, or current backend process was removed or changed. The four LOCAL_FILE_MISSING and two LEASE_LOST historical records remain separate unresolved work.
- The maintenance copy-target fix remains source-only and unpublished. Do not ask the user to install0.3.8 again or repeat the broken restart/update path. Preserve the separate release-publisher hardening worktree. No new PR, merge or native release has been authorized this turn.
- Validation this turn: `corepack pnpm --filter @project-wing/desktop-agent-desktop test` passed145 tests with2 opt-in tests skipped. After strengthening the synthetic staging test to verify collision refusal preserves the first helper and leaves each fresh target absent, `corepack pnpm --filter @project-wing/desktop-agent-desktop test src/main/maintenance-handoff.test.ts src/main/update-package-integrity.test.ts` passed13 tests. `corepack pnpm --filter @project-wing/desktop-agent-desktop lint` and `git diff --check` passed. No real update was applied, no native release/build was run, and no new installed-app fault injection was performed. Interactive evidence this turn is the identified legacy window; user-provided0.3.8 screenshot and explicit normal-work confirmation provide the functional acceptance evidence, not an independently automated edit/save/check-in replay.

2026-09-08 in-app restart/update failure reproduced and locally fixed:

- After the user clicked “重启并更新”, the app did not exit. Read-only process paths and `/health` now show the current-installation 0.3.7 Manager40840 and Runtime39508 running; the legacy Manager/Runtime remains stopped. The old-port conflict is no longer the immediate failure. The VeloPack log still shows download/pending-package lookup but no 0.3.8 apply completion.
- New handoff directories are created on each attempt but remain empty. The exact installed-runtime directory-copy operation was reproduced in isolated temp storage using the existing development Electron43.4.1 / Node24.18.1, with no windows, no Agent execution and a separate temporary profile. It fails with `ERR_FS_CP_EEXIST`: mkdtemp created the destination and fs.cp({recursive:true,errorOnExist:true,force:false}) rejected it before copying. An ordinary Node22 single-file diagnostic did not exhibit that behavior; the Electron reproduction is the relevant evidence.
- Local fix in `maintenance-handoff.ts`: reserve a unique container and copy into its not-yet-created `runtime` child. It retains errorOnExist/force:false and all subsequent integrity/ownership checks. The same Electron diagnostic then copied all401 top-level entries successfully. Evidence: ignored `output/diagnostics/helper-copy-output.log` (failure), `helper-copy-fixed.log` (success), and `check-helper-copy.cjs`; test copies reside only in `project-wing-electron-copy-check-*` temp directories. No installed files/cache/session records were patched or deleted.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop test src/main/maintenance-handoff.test.ts src/main/update-package-integrity.test.ts`: 13 passed. Full `corepack pnpm --filter @project-wing/desktop-agent-desktop test`: 145 passed, 2 opt-in skipped. Desktop lint and formatting fixes passed; `git diff --check` passed. Source fix is uncommitted/unpublished in this worktree, not installed into 0.3.7 or released0.3.8.
- Production manifest GET confirms version0.3.8 and the normal full-installer URL `https://emp.superfx.cn/api/downloads/desktop-agent/windows/releases/0.3.8` (255581885 bytes). The old in-app updater cannot replace its own failing preparation code; use the normal full installer for this upgrade, without uninstall/cache cleanup. Any automated installer launch still needs action-time confirmation; user installation has not yet occurred. Do not ask the user to keep clicking the known-broken restart/update button.

2026-09-08 user-approved controlled handover, steps 1–2 completed:

- User explicitly approved retiring the identified legacy startup, normally exiting the old backend and applying the downloaded 0.3.8 update. The exact HKCU Run value was first saved to `C:/Users/LHX/AppData/Local/ProjectWing/Recovery/legacy-startup-2026-09-08.json`, reread and compared against the registry, then only `ProjectWingDesktopAgent` was removed. Verification confirms the backup exists and that value is absent. This is an explicitly authorized, reversible engineer-assisted startup correction, not evidence of unattended installer migration success.
- Computer Use freshly identified the legacy app-0.2.11 window and clicked its observed “关闭桌面助手” button. Subsequent read-only CIM checks found no legacy managed Manager/Runtime processes; port17862 rejects connections. The legacy UI process/window remains discoverable, but its backend is stopped. No Stop-Process, taskkill or force termination was used.
- Normal launch of the verified current executable again returned `launched app did not expose a targetable window`. A fresh list_windows still returns only the legacy window, so no update/install action was automated. Current service downtime is the pending handover state, not a completed update. User needs to open the current dark Agent window and apply the already downloaded 0.3.8 package through its normal UI.
- Do not restart the legacy backend or re-enable its startup without an explicit rollback request. No caches, session records or real files were changed/deleted. Installation and final version/auth/session acceptance remain unverified; do not repeat launch attempts while awaiting user input.

2026-09-08 user-authorized read-only process/startup investigation:

- User explicitly says no work files are open. Do not infer that six attention records are six actively edited files.
- Fresh `/health` returned worker PID 38984, runtime 0.2.11, managerVersion 0.2.1, managerState STARTING, updateState FAILED, restore READY and attentionCount6. CIM executable-path/creation-time checks tie worker 38984 to legacy `app-0.2.11/managed/ProjectWing.DesktopAgent.Runtime.exe`, parent Manager38228 to the same legacy directory, and launcher cmd37476 to the legacy startup chain (06:42). Current Electron parent37780 runs from the VeloPack current installation (06:44); `sq.version` remains 0.3.7. This is not merely stale version metadata in a new backend.
- Win32_StartupCommand exposes the active HKCU Run value `ProjectWingDesktopAgent`, invoking `wscript.exe` with the legacy `StartProjectWingDesktopAgent.vbs`. Read-only VBS/PS1/CMD inspection resolves the chain to explicit old app-0.2.11 paths and ports17862/17863. No scheduled watchdog task was returned by the current task enumeration; do not claim that the historical watchdog registration still exists today.
- `AgentState/migrations/electron-host-v1.failed.json` reports "Legacy Desktop Agent watchdog task is still registered." at 2026-09-07 05:22:13 UTC. There is no completed migration marker. `update-status.json` is a historical 2026-09-07 05:22:15 UTC bind-conflict failure, not a freshly timed failure on today's health request. Current bootstrap source attaches legacy cleanup to the installation callback, not ordinary startup; source and historical evidence support an incomplete legacy handover, not proof of the exact current apply blocker.
- VeloPack's application log shows 0.3.8 downloaded successfully at06:57:32 today; subsequent attempts reuse the package. The 251,068,093-byte `com.superfx.projectwing.desktop-agent-0.3.8-full.nupkg` and a verification receipt exist. No 0.3.8 apply completion was found in the inspected log tail, and installed metadata is still0.3.7. Do not ask for redundant download as the first remedy.
- All actions this turn were read-only. No startup entry, registry value, process, installed package, cache or file record was changed. A proposed next action is a reversible, specifically scoped legacy startup retirement and normal application update; obtain authority before those state changes, with installation confirmation at action time where Computer Use applies.

2026-09-08 publication recovered; installed-window acceptance blocked:

- Existing scheduled native run `34166836507` succeeded, publishing **0.3.8** at 2026-09-07 22:48:28 UTC for `cd0415f53d2e2cef2e57549e16149c59afac4ee0`: https://github.com/fin-agent-lab/ProjectWing/releases/tag/desktop-agent-v0.3.8 . `gh release view ... --json tagName,targetCommitish,publishedAt,url,body` and commit-scoped `gh run list` verified release and successful Build 34140651312 / Deploy 34152540511 and 34155460971. All are terminal; do not redispatch or repeatedly poll them.
- Fresh local GET health/auth checks now report runtime 0.2.11 and authenticated=false, while current installation metadata remains 0.3.7. Do not describe this as failure to release 0.3.8 or claim that the installed version was downgraded. Computer Use independently found only the legacy 0.2.11 window. Launching the verified current executable returned no targetable window; refresh confirmed only the legacy window. Need the user to expose the current Agent or perform the normal 0.3.8 update. No old-process termination, cache change, real-record deletion or software installation performed.
- Local release-publisher hardening is prepared separately in `D:/Project_wing/.worktrees/desktop-agent-release-resume` (23 tests passed), not merged/published and not the cause of the scheduled release success. See its `docs/desktop-agent-release-resume-2026-09-08.md`. Preserve these changes pending delivery authorization.
- Continue quietly while awaiting the user's window/update response. Do not repeat launcher attempts or infer that the legacy empty list means the six current-version records were recovered or removed.

2026-09-07 user-reported publish failure confirmed:

- `gh run view 34117885132 --repo fin-agent-lab/ProjectWing --json status,conclusion,headSha,url`: completed/cancelled for `32ab3d6b2d28e92d640e6a025ee992ba723a4f7c`. `gh api repos/fin-agent-lab/ProjectWing/check-runs/101755628494/annotations` explicitly reports the publish job exceeded its 45-minute maximum. This is not a compilation/native safety gate failure.
- `gh run view 34117885132 --repo fin-agent-lab/ProjectWing --job 101755628494 --log` shows the 255,581,908-byte installer upload reached 100% at 13:44:39 UTC. The Windows publishing function emitted its 0.3.8 manifest/feed completion record at 14:11:36 UTC; cancellation followed at 14:12:16. Windows promotion may therefore already be live. Do not treat the overall cancelled run as proof that no release assets/feed were changed, and do not claim the live Windows endpoint has been verified yet.
- Windows/macOS builds, native safety and reusable bundle verification all succeeded. macOS publication is unconfirmed; GitHub release-note creation was skipped. `gh release list --repo fin-agent-lab/ProjectWing --limit 3` still lists 0.3.7 latest. No newer native run or rerun attempt exists at this check.
- Publisher inspection confirms serial Windows asset uploads and per-object metadata checks before moving to the next platform. The exact slow operation during the long interval is not isolated by current per-asset logs. Next remediation should measure that phase, preserve resumable uploads and integrity checks, and reuse verified bundles rather than blindly restarting full builds. No workflow/code mutation, rerun, installed update or file cleanup was performed in this diagnosis turn.

2026-09-07 13:56 UTC bounded release check:

- `gh run view 34117885132 --repo fin-agent-lab/ProjectWing --json status,conclusion,jobs,url`: reusable bundle verification succeeded; final publish job is in progress uploading Windows/macOS assets to OSS. GitHub release notes remain pending. `gh release list --repo fin-agent-lab/ProjectWing --limit 4` still lists 0.3.7 as latest; the new package version and final availability are not yet confirmed.
- `gh run view 34121252045 --repo fin-agent-lab/ProjectWing --json status,conclusion,headSha,url`: Deploy completed successfully for `32ab3d6b2d28e92d640e6a025ee992ba723a4f7c`. Do not re-poll this terminal Web run; native publication and installed-app acceptance remain outstanding.
- No actionable failure or ready-to-install release yet. Continue quietly at the next hourly check; no duplicate dispatch, installation, real-session cleanup or fault injection. Q polish PR #1164 is separate and does not change this native checkpoint.

2026-09-07 12:42 UTC bounded read-only compatibility release check:

- `gh run view 34117885132 --repo fin-agent-lab/ProjectWing --json status,conclusion,jobs`: contracts/native safety and Windows/macOS build jobs succeeded; reusable-bundle verification queued, final publication unconfirmed. No failure needing repair.
- Commit-scoped `gh run list` confirms Web Build `34117883439` succeeded and Deploy `34121252045` is in progress for `32ab3d6b2d28e92d640e6a025ee992ba723a4f7c`.
- Continue the hourly schedule quietly while running. No duplicate workflows, installed-app changes, session mutations or per-file cleanup performed.

2026-09-07 11:41 UTC read-only compatibility checkpoint:

- User returned, updated normally to 0.3.7, then paired. Screenshot shows 0.3.7/account initials. Read-only local GET checks confirm healthy service with attention, authenticated account, restore READY/quarantineCount0 and six sessions. One valid READ_ONLY record without mutation URLs triggered a desktop parser incompatibility; it was not a connection outage. Four missing-file and two lease-loss statuses remain unresolved.
- PR #1163 merged as `32ab3d6b2d28e92d640e6a025ee992ba723a4f7c`: https://github.com/fin-agent-lab/ProjectWing/pull/1163 . Display/capability fix details and exact test/evidence paths: `desktop-agent-read-only-sessions.md` (144 tests passed/2 opt-in skipped, typecheck/build passed, six-row isolated Electron screenshot inspected).
- New stable release dispatched once: https://github.com/fin-agent-lab/ProjectWing/actions/runs/34117885132 . Follow matching Web Build/Deploy for this SHA. New package version/publication not yet confirmed; do not redispatch. Hourly follow-up updated; user's earlier away/no-questions restriction is superseded by their return.
- No mutation of real sessions, cached files, locks, startup records or installed processes occurred in this fix. New-package installed-list acceptance and per-file recovery remain pending; never equate parser repair with restoration of missing bytes or editing access.

2026-09-07 09:33 UTC publication complete (user away):

- Native run `34088512590` completed successfully, including contracts, isolated native recovery/file safety, platform packages, bundle verification and final publishing. Matching Web Deploy `34096404325` succeeded for `ab65c47dc761045be23adef92202efd18c2a013d`.
- `gh release list` followed by `gh release view desktop-agent-v0.3.7 --repo fin-agent-lab/ProjectWing --json tagName,targetCommitish,publishedAt,url,body,assets` confirms the launch fix is **0.3.7**, published at 09:11:41 UTC for that SHA: https://github.com/fin-agent-lab/ProjectWing/releases/tag/desktop-agent-v0.3.7 . Do not assume 0.3.6: it is an earlier release. Windows package `desktop-agent-win-x64-0.3.7.exe`, macOS package `desktop-agent-macos-arm64-0.3.7.pkg`; private OSS distribution has no public installer URL.
- All release/deployment runs tracked for this fix are terminal. Do not keep polling or redispatching them. No release failure needs repair.
- Exact remaining gate: inspect the installed app/file state and obtain required action-time confirmation before a normal UI software installation/update. User is away and requested no questions until returning; do not initiate installation, bypass its confirmation, kill the old installation, or modify caches/registrations as a workaround. No claim of installed 0.3.7, successful normal update, reboot or real-file recovery acceptance. Preserve this checkpoint quietly for the user's return.

2026-09-07 08:32 UTC bounded heartbeat check (user away):

- Native `34088512590`: contract/native recovery/file-safety gate, Windows/macOS builds and GHCR uploads succeeded. Reusable release-bundle verification is queued; final stable publication/version still unconfirmed.
- Web Build `34088491235` succeeded; matching Deploy `34096404325` is in progress for `ab65c47dc761045be23adef92202efd18c2a013d`. Checked with `gh run view 34088512590 --json status,conclusion,jobs` and commit-scoped `gh run list` (both with `--repo fin-agent-lab/ProjectWing`). No duplicate dispatch.
- No action-required failure. User asked not to be interrupted while away, so continue quietly at the next scheduled check. No installed update, permissions/security action, cache or process modification, or fault injection attempted.

2026-09-07 05:53 UTC launch-fix publishing checkpoint:

- User approved continuing the startup repair. PR #1162 merged at 05:52:52 UTC as `ab65c47dc761045be23adef92202efd18c2a013d`: https://github.com/fin-agent-lab/ProjectWing/pull/1162 . See `desktop-agent-launch-visibility.md` for scope, 129 passed/2 skipped desktop tests, build/typecheck and real isolated manual/background window evidence.
- Native stable publishing run explicitly dispatched once: https://github.com/fin-agent-lab/ProjectWing/actions/runs/34088512590 . Matching Web Build: https://github.com/fin-agent-lab/ProjectWing/actions/runs/34088491235 . New version/publication/activation not yet confirmed; do not duplicate these runs or confuse old 0.3.5 publication with this fix.
- Hourly follow-up updated to these IDs. No installed-user upgrade, legacy process termination, startup-link modification, cache cleanup or real-file fault injection occurred during local implementation. The original PC coexistence/bind issue remains subject to ordinary update and safe installed-app acceptance.

2026-09-07 user-requested Computer Use diagnosis:

- Fresh `sky.list_apps/list_windows` discovered a minimized Agent window owned by the legacy `ProjectWing/DesktopAgent/app-0.2.11/ui/ProjectWingDesktopAgent.exe`. Activated that returned window and captured its screenshot/accessibility tree: Offline, local runtime not responding, version `—`. The no-active-files placeholder is not evidence of an empty cache while offline.
- Read-only process inventory also found the current Velopack application and its Electron children running from `com.superfx.projectwing.desktop-agent/current`. Its `sq.version` explicitly reports **0.3.4**, not released 0.3.5. Both versions coexist on this PC. Start-menu/Startup shortcuts and the `projectwing-agent` protocol point to the current installation, not the legacy directory.
- Read-only `AgentState/update-status.json` reports FAILED at `2026-09-07T05:22:15Z`: `Failed to listen on prefix 'http://127.0.0.1:17862/' because it conflicts with an existing registration on the machine.` A shutdown flag is timestamped `05:22:35Z`. No 17862 listener or native Manager process was present at inspection. Historical bind conflict is confirmed; the exact conflicting owner at that earlier moment is not proven. Coexisting legacy/current startup is a plausible contributing factor, not proof of continuous port occupation.
- Source inspection of tray startup and protocol handling explains a separate UX gap: the window defaults to hidden, startup only reveals it for an explicit open/start protocol request, and a second instance without such a command does not reveal it. The observed Start-menu shortcut has no arguments. This can make ordinary Start-menu activation appear to do nothing while Electron continues running.
- This turn diagnoses only. No reinstall/update, registry/startup edits, process kills, cache deletion, file upload or failure injection performed. Correct ordinary-launch UX and safely reconcile legacy startup before claiming normal update/recovery acceptance.

2026-09-06 18:32 UTC bounded heartbeat check:

- The only previously unfinished deployment, `34044054205`, is now confirmed successful for SHA `217bfa91282ebf866f7048af8e7924d90a2c47b9` via `gh run view 34044054205 --repo fin-agent-lab/ProjectWing --json status,conclusion,headSha,url`. All recorded publishing/deployment runs for this checkpoint are terminal; do not keep polling these completed runs.
- No user reply to the request to open the installed Agent window has arrived. Continue waiting quietly; do not repeat launch attempts, ask again, install software, or fault-inject. Version 0.3.5 publication is confirmed, but local update and ordinary-user recovery acceptance are still incomplete.

2026-09-06 17:31 UTC publication and normal-entry checkpoint:

- Native run `34042397095` succeeded, including Linux isolated recovery/file-safety gates, Windows/macOS package builds, GHCR verification and OSS publishing. Published stable version **0.3.5**, target SHA `217bfa91282ebf866f7048af8e7924d90a2c47b9`: https://github.com/fin-agent-lab/ProjectWing/releases/tag/desktop-agent-v0.3.5 . `gh release view ... --json tagName,targetCommitish,body,url,assets` confirms private OSS distribution (no public asset URL), Windows `desktop-agent-win-x64-0.3.5.exe` and macOS `desktop-agent-macos-arm64-0.3.5.pkg`.
- Web Build `34042395735` and Deploy `34044022950` succeeded for the same SHA. The additional Deploy `34044054205` was still in progress at the bounded check; no duplicate run was started by this heartbeat.
- Real production browser https://emp.superfx.cn/zh-CN/engagement → Settings → Desktop Agent, existing logged-in session. UI reports a new version available and displays the new recovery guidance. Clicked Open Desktop Agent once; no Agent window appeared.
- Read Computer Use skill/guidance/API/confirmation policy. `sky.list_apps()` returned installed app `velopack.com.superfx.projectwing.desktop-agent` with no windows; `sky.list_windows()` found no Agent window. Normal `sky.launch_app` returned `launched app did not expose a targetable window`. No terminal installation, registry edits, security changes, file release/upload or process termination performed.
- Need the user to open the installed Agent from its tray/Start menu and report/show its window. Installed version, normal update, retained-file status and actual fault acceptance remain unverified. Do not repeatedly invoke launch or notify unchanged state on subsequent hourly checks; wait for user input before installation/fault actions.

2026-09-06 16:29 UTC bounded heartbeat check:

- `gh run view 34042397095 --repo fin-agent-lab/ProjectWing --json status,conclusion,jobs`: native workflow still queued overall. Linux `Verify isolated native recovery and file safety` passed at 16:04:37 UTC, confirming the previously failing gate now passes. Windows and macOS package builds and GHCR uploads passed; `Verify reusable release bundles` is queued. Final stable publication/version/download availability is not yet confirmed.
- `gh run list --repo fin-agent-lab/ProjectWing --commit 217bfa91282ebf866f7048af8e7924d90a2c47b9 --limit 6 --json databaseId,name,status,conclusion,url`: Web Build `34042395735` succeeded; Deploy `34044022950` is in progress and Deploy `34044054205` is pending for this SHA. No new deploy was dispatched by this check; activation remains unverified.
- No failure requiring action is reported. Leave the hourly heartbeat active and wait for its next bounded check, without progress notifications while publishing/deployment is still running. No installed-app update or fault injection attempted.

2026-09-06 15:28 UTC publishing checkpoint:

- PR #1160 merged as `217bfa91282ebf866f7048af8e7924d90a2c47b9`: https://github.com/fin-agent-lab/ProjectWing/pull/1160 . Latest UI main was integrated without conflict before merge. No automatic PR check lane was present.
- New native stable publishing run: https://github.com/fin-agent-lab/ProjectWing/actions/runs/34042397095 . Explicit inputs force_build=true, publish_release=true, release_channel=stable. Last checked queued. Do not duplicate.
- Matching Web Build: https://github.com/fin-agent-lab/ProjectWing/actions/runs/34042395735 . Last checked pending. Successful Build should trigger Deploy; activation not yet verified.
- Changed Manager/Runtime whitespace checks using `node scripts/format-dotnet.mjs --check <changed .cs files>` and static `node apps/desktop-agent/scripts/verify-native-hosts.mjs` passed. Linux release gate remains pending.
- Hourly `desktop-agent` follow-up resumed with these run IDs. No new native version, local installed-app update or production fault-injection success is claimed.

2026-09-06 resumed after project-creation UI PR #1159:

- User requested resuming the Desktop Agent repair/release/normal-update acceptance. The original native run `34027723534` remains failed; no duplicate retry of its unchanged code was started.
- Web Deploy `34029602379` for PR #1158 is confirmed successful. New-project UI PR #1159 is now on main; it does not modify the native recovery fix.
- Fresh local commands: `dotnet run --project apps/desktop-agent/manager/RecoveryControl.Tests/RecoveryControl.Tests.csproj --no-launch-profile` passed; `dotnet run --project apps/desktop-agent/runtime/RecoverySafety.Tests/RecoverySafety.Tests.csproj --no-launch-profile` passed all 14 scenarios; `node apps/desktop-agent/scripts/verify-manager-runtime.mjs` passed crash/hang/ownership/update-exclusion/concurrent-recovery/file-preservation checks on isolated port 53075.
- Synthetic evidence directories: `C:/Users/LHX/AppData/Local/Temp/project-wing-control-safety-68d66784c7214c7fb6d3fef27f173714` and `C:/Users/LHX/AppData/Local/Temp/project-wing-data-safety-1a5fa2138eac43f997833aa8317b2101`. No installed Agent, Office process or user cache was modified.
- Linux release-gate validation and new native publication remain pending. Installed-app update and ordinary-user fault acceptance remain not run.

2026-09-06 10:32 UTC checkpoint:

- Full EMP regression completed: 145 files passed, 1644 tests passed, 2 skipped, 2016.79 seconds (`corepack pnpm --filter @project-wing/emp exec vitest run --maxWorkers=2 --testTimeout=30000`).
- PR #1158 merged at 10:32:24 UTC. Merge SHA: `8ed6dd9d5a0b30a5fdbd49c574d10276f8841321`.
- Web/API Build started/queued: https://github.com/fin-agent-lab/ProjectWing/actions/runs/34027702116 . Successful Build should trigger Deploy; no production activation is claimed yet.
- Native stable publishing explicitly dispatched for the same SHA: https://github.com/fin-agent-lab/ProjectWing/actions/runs/34027723534 . Inputs: force_build=true, publish_release=true, release_channel=stable. Last observed queued; release version/artifacts not yet confirmed.
- Heartbeat `desktop-agent` will check later; do not duplicate these runs or repeat the merge.
- Installed-app update and ordinary-user failure acceptance remain **not run**. No live Agent/Office fault injection occurred at this checkpoint.

2026-09-06 11:42 UTC follow-up:

- Web Build `34027702116` completed successfully; Deploy `34029602379` was still in progress at this bounded check.
- Native run `34027723534` failed in `Verify isolated native recovery and file safety` on Linux; platform packaging and publication were skipped. Its Manager-to-Runtime generation guard rejected Linux UTC-derived start timestamps. This is an actual platform defect caught by the gate, not a skipped test or an installed-user failure.
- Follow-up fix uses stable kernel process identity and adds real cross-process identity/policy tests. See `desktop-agent-linux-process-identity.md`. Windows native recovery, 14 data-safety scenarios and the opt-in process tests passed locally; Linux end-to-end confirmation must come from the unchanged CI gate in the new release attempt.
- The original installed Agent has not been updated or fault-injected; publishing must succeed first.
