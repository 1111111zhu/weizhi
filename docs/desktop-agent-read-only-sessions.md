# Read-only session compatibility — 2026-09-07

## Confirmed cause

After the user updated to 0.3.7 and paired successfully, read-only GET checks of `/health`, `/auth/status` and `/sessions` confirmed version 0.3.7, READY_WITH_ATTENTION, restored state READY/quarantineCount 0, authenticated=true and six session records. Four reported LOCAL_FILE_MISSING and two LEASE_LOST. One of the six was READ_ONLY and legitimately omitted checkInUrl/releaseUrl. No session tokens, file URLs or user file contents are recorded here.

The desktop parser required both mutation URLs for every display row, then rejected the entire snapshot when the parsed count differed from the raw count. A legitimate read-only record therefore produced the generic stale/disconnected list warning.

## Change

- Display validation requires stable identity/name/project/status metadata, not mutation URLs. Preserve read-only, missing-file and lease-loss rows.
- Main-process normalization exposes mode and computed canCheckIn, but never mutation URLs. Explicit unknown modes and partial MASTER records remain visible and non-actionable. Legacy mode-less records with both URLs retain their previous writable interpretation.
- Revalidate capability on every check-in/release IPC invocation. READ_ONLY is refused even if the payload contains mutation URLs or a forged capability. Only closed/retryable MASTER states with both URLs can use upload-before-release; open, missing-file, lease-loss and unknown states are refused.
- UI adds localized read-only text and disables unavailable synchronization actions. Truly malformed metadata still invokes the existing fail-closed stale snapshot behavior; no records are silently discarded to make health green.
- No native service, persistent session/cache store, user file, server API or permission policy was modified. Existing missing-file and lease-loss conditions still need separate review; do not equate their visibility with recovery.

## Current validation

- `corepack pnpm --filter @project-wing/desktop-agent-desktop test`: 144 passed, 2 opt-in process tests skipped in the ordinary suite.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop lint`: passed after explicitly typing the malformed-record test fixture.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop build`: passed.
- Touched-file `corepack pnpm exec ultracite check ...`: passed after fixture formatting/loop cleanup; `git diff --check` passed.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop exec electron scripts/verify-launch-window.cjs --sessions-fixture`: passed with six synthetic records rendered and no false stale/disconnected message. Isolated profile/StateRoot/CacheRoot, no file launch, no real service/network reads or writes. Fixture waits for IPC rendering and paint before screenshot capture.
- Screenshot inspected: `C:/Users/LHX/AppData/Local/Temp/project-wing-launch-fixture-h35r9T/window.png`; result.json and rendered-text.txt in the same directory. All six rows appear, readonly row marked and error/lease states retained. Earlier immediate capture showed a skeleton; the final capture was taken after rendering settled.
- Installed new-package acceptance is pending publication and user-side normal update. No check-in/release, file deletion, lock cleanup, process kill or real-file fault injection was performed.
