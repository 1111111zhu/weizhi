# Desktop Agent recovery implementation — 2026-09-06

Scope: repair the [adversarial audit](desktop-agent-adversarial-review-2026-09-06.md), publish through the normal repository/release workflows, then perform [ordinary-user production acceptance](desktop-agent-production-recovery-acceptance.md). Local validation and production acceptance remain distinct.

Integration baseline was advanced to `b98442ea` (including PR #1157). Its stale-session cleanup and lease-loss routes were semantically reconciled with byte-preserving cleanup; no incoming shared styles/buttons/login fixes were replaced.

## Data and user actions

- Ordinary release verifies/synchronizes changes first. Open files cannot be silently released. Failed uploads retain local bytes and leases; edits during upload queue another synchronization. Cleanup checks for newly changed bytes instead of silently deleting them.
- Missing primary session state recovers valid backups. All-corrupt state is quarantined and remains diagnosable rather than crashing repeatedly. Historical quarantine prevents unsafe eviction, not allocations with sufficient capacity.
- Cache-root changes cannot strand active sessions: they are rejected without saving/restarting while sessions exist, atomically with session creation. A target owned by another Runtime is refused. Same-root capacity changes remain possible.
- Unresolved recovery does not silently become an empty healthy file list. The tray exposes per-file errors, safe retry wording, and a retained-files button that accepts no external path. It opens only the current verified local cache directory, never auto-uploads or guesses lost business associations.
- EMP distinguishes connection success from unresolved file work, refreshes status automatically and offers an installed-app entry. Failure guidance distinguishes unreachable service, pending update, unsupported version and other recovery needs instead of universally prescribing reinstall.

## Process recovery

- Manager and Runtime retain kernel-held state/cache ownership locks. A Runtime monitors its Manager's PID and creation time and self-stops if that owner dies; its forced fallback only terminates itself, never Office or an arbitrary process tree.
- Worker health is bounded over headers and body by one 1.5-second deadline, with a 64 KiB body bound and strict shape/app checks. Manager identity is available independently of Worker health.
- After a 30-second startup grace, three consecutive failed health probes cause bounded automatic replacement of the owned child. Automatic failures and crash exits share the restart budget.
- A same-installation Manager started by independent recovery can transfer lifecycle control to the normal UI. Stop must verify generation and actual service disappearance before update continues.
- The tray renderer has bounded crash/unresponsive recovery separate from service health, with a user-facing retry if its own budget is exhausted.

## Update and installation

- Check/download/apply share single-flight state. Preparation errors roll back the exiting state and restore the running service; repeated actions observe one operation.
- Windows updates use a verified, independent maintenance helper outside the replaceable installation directory. It holds maintenance ownership across UI exit, verifies the selected downloaded package, and launches only the package's verified updater with fixed arguments and the validated installation root. Update/quit acknowledgement failures must not leave a delayed updater contradicting a displayed failure.
- Release identity is written into the packaged Electron metadata. The runtime helper payload has a generated SHA256 integrity manifest. Cached update metadata needs trusted feed hashes or a verified receipt, not a newly computed hash treated as provenance.
- Existing `optional`/`required` signing policy is preserved. Genuinely unsigned releases are permitted only under the existing optional policy; invalid signatures are not silently accepted. No root certificates or security settings are installed/relaxed.
- Native maintenance records bind to process creation identities. Verifiably interrupted owned operations can reconcile. Unknown legacy ownership is explicitly reported as needing review, not indefinitely described as a live update.
- Development/portable copies do not blindly take over protocol registration. Legacy lifecycle cleanup is installation-hook work, not synchronous work on every ordinary launch. Old directories/custom-cache paths are retained in place; only verified legacy registrations/processes are retired.

## Acceptance and boundaries

The native workflow now runs real isolated Manager recovery, file-safety, maintenance-policy and liveness regression gates in addition to static packaging/publishing checks. Fixtures explicitly isolate StateRoot and CacheRoot, allocate independent ports, disable file launch and use synthetic files.

Known boundaries remain explicit: all lost/corrupt associations cannot be reconstructed by guessing; a non-cooperating old installer or unknown local service cannot be safely killed merely to make health green; actual Windows package replacement, signature behavior, old-to-new upgrade and restart need installed-app acceptance. macOS/Linux packaged behavior is not proven by Windows/local tests. These are not excuses to silently discard work or present a misleading ready/empty state.

## Validation record

- `corepack pnpm --filter @project-wing/emp test src/components/desktop-agent-settings.test.tsx src/components/desktop-agent-recovery.test.ts src/components/desktop-agent-cache-settings.test.tsx`: 21 passed.
- `corepack pnpm --filter @project-wing/emp lint`: passed.
- `dotnet run --project apps/desktop-agent/runtime/RecoverySafety.Tests/RecoverySafety.Tests.csproj --no-launch-profile`: initially 9 scenarios; 14 passed after semantic reconciliation with main (including unchanged lease-loss, cleanup routing and preservation of unconfirmed snapshots). Main's `src/runtime-session-endpoint-recovery.test.ts` also passed 5/5 without weakening its assertions.
- `dotnet run --project apps/desktop-agent/manager/RecoveryControl.Tests/RecoveryControl.Tests.csproj --no-launch-profile`: passed owner/status, exclusive maintenance, verified package/updater source and abnormal-health checks; rerun after final handoff changes before release.
- `node apps/desktop-agent/scripts/verify-manager-runtime.mjs`: passed; primary integration run used independent Manager port 50777.
- With `PROJECT_WING_RUN_ADVERSARIAL_PROCESS_AUDIT=1` and `PROJECT_WING_BODY_AUDIT_DLL` pointing to the built repository PartialHealthWorker DLL, `corepack pnpm --filter @project-wing/desktop-agent-desktop test src/main/adversarial-process-review.test.ts`: 2 fixed-behavior native scenarios passed in 42.07 seconds.
- `corepack pnpm format:dotnet` followed by `corepack pnpm format:dotnet:check`: passed at the integration checkpoint; rerun after final changes.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop test scripts/runtime-integrity.test.mjs`: 2 passed. An initial attempt incorrectly used Node's test runner for this Vitest test; it failed and was replaced by the proper Vitest command in CI.
- Integrated desktop suite: 117 passed, 2 opt-in native cases skipped in the ordinary run (those cases passed separately). Desktop TypeScript validation and `corepack pnpm --filter @project-wing/desktop-agent-desktop build` passed.
- Integrated targeted EMP recovery/cache/login suite: 35 passed; EMP TypeScript validation passed. Service-only update warnings are distinguished from pending-file warnings.
- `node --test scripts/pre-commit-selective-tests.test.mjs scripts/run-workspace-tests.test.mjs`: 30 passed. The active Electron workspace is now explicitly selected by commit checks and included in the full workspace runner, rather than treated as an unknown path or omitted.
- `node scripts/volatile-test-assertions.mjs`: passed. The full-repository Design-First boundary audit reported pre-existing unrelated findings; no debt baseline was expanded or UI restrictions weakened to hide them.
- `node --test scripts/ci/detect-desktop-agent-changes.test.mjs`: 12 passed. `node apps/desktop-agent/scripts/verify-native-hosts.mjs`: static delivery contract passed, not an installed recovery test.
- Browser screenshot/visual path: isolated **mock** EMP `http://127.0.0.1:3035/zh-CN/engagement/project-orchid-2026` → Settings → Desktop Agent, Chinese dark-mode recovery instructions/open-app button. No protocol activation against the installed app during this check. This is not backend-attached production acceptance.

At the 2026-09-06 10:32 UTC follow-up, full EMP regression was confirmed passed: 145 files, 1644 passed / 2 skipped (2016.79s). PR #1158 merged as `8ed6dd9d5a0b30a5fdbd49c574d10276f8841321`; Build run `34027702116` and native stable publish run `34027723534` were queued for that SHA. Production activation, release artifacts and installed-app acceptance are not yet confirmed; see the production acceptance record for the next checkpoint.
