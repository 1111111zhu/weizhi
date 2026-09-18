# Desktop Agent Health Check

## Purpose

This runbook verifies Desktop Agent P0 behavior against the real Project Wing deployment. It covers the deployed browser app, backend, Desktop Agent installer, local Agent HTTP API, Excel launch, and Master lock release flow.

## Required Environment

- Windows with Microsoft Excel installed.
- Google Chrome installed, or `PROJECTWING_VERIFY_CHROME_PATH` set to a Chrome executable.
- Network access to `https://wing.superfx.cn`.
- A deployed Project Wing build containing the Desktop Agent install/open/release behavior under test.
- A published Windows Desktop Agent release matching `PROJECTWING_VERIFY_AGENT_VERSION`.
- Production releases must publish a manifest with the exact installer version, file size, and SHA-256 digest. The browser sends that manifest to the local Agent before an update starts; AgentManager refuses updates with missing or mismatched integrity metadata. Windows Authenticode is not required by the self-update path, so users may still see Windows trust warnings for an unsigned installer.

## Run

From the repository root in PowerShell:

```powershell
corepack pnpm install
$env:PROJECTWING_VERIFY_EMAIL="partner@projectwing.local"
$env:PROJECTWING_VERIFY_PASSWORD="Partner123!"
$env:PROJECTWING_VERIFY_PROJECT_ID="cmq7dop8x000301nwg59kj3p9"
$env:PROJECTWING_VERIFY_ATTACHMENT_ID="cmq7dq7z8000k01nw1vv2dwl1"
$env:PROJECTWING_VERIFY_AGENT_VERSION="0.1.11"
node scripts/desktop-agent/verify-real-server-master-flow.mjs
```

Optional overrides:

- `PROJECTWING_VERIFY_SITE_URL`, default `https://wing.superfx.cn`
- `PROJECTWING_VERIFY_API_BASE_URL`, default `PROJECTWING_VERIFY_SITE_URL + /api`
- `PROJECTWING_VERIFY_LOCALE`, default `zh-CN`
- `PROJECTWING_VERIFY_ATTACHMENT_ID`, optional target attachment id used to avoid matching older sessions for similarly named files
- `PROJECTWING_VERIFY_MASTER_BUTTON_PATTERN`, default `以 Master 打开 副本采购全量发票查询导出结果`
- `PROJECTWING_VERIFY_CHROME_PATH`, default `C:/Program Files/Google/Chrome/Application/chrome.exe`
- `PROJECTWING_VERIFY_OUTPUT_DIR`, default `output/playwright/desktop-agent-health`
- `PROJECTWING_VERIFY_STOP_AGENT_FIRST`, default `true`; set to `false` to keep any running Agent process

Non-`zh-CN` runs may need `PROJECTWING_VERIFY_MASTER_BUTTON_PATTERN` set to the localized Master button text.

Before stopping the Agent, the verifier checks the running local Agent for an existing target Master session. It releases only matching `OPEN` and `UNCHANGED` sessions, one at a time, through the Agent's normal release endpoint. It refuses to continue on a dirty pre-existing session so it cannot discard user edits.

## Expected Output

The script writes these artifacts:

- `output/playwright/desktop-agent-health/desktop-agent-health-report.json`
- `output/playwright/desktop-agent-health/01-agent-unavailable-dialog.png`
- `output/playwright/desktop-agent-health/02-after-install.png`
- `output/playwright/desktop-agent-health/03-master-open.png`
- `output/playwright/desktop-agent-health/04-after-release.png`

Successful verification means:

- The not-running dialog appears when the Desktop Agent is stopped.
- The Windows installer downloads and is larger than 50 MB.
- Local `GET http://127.0.0.1:17862/health` returns the expected Agent version.
- Clicking Master after install opens the workbook through the local Agent.
- The script observes an open Master session through `GET http://127.0.0.1:17862/sessions`.
- After the opened Excel workbook is closed, the Master row is released and the Master button is visible again.

## Cleanup Rules

- The script closes only the Excel workbook it opened, matched by the observed session `localPath`.
- If Windows exposes the opened workbook through a different Excel COM instance, the script falls back to closing a matching Excel window title only when the session is `UNCHANGED`.
- The script leaves Desktop Agent running after a successful install.
- Any unreleased Master lock is a failed verification and must be investigated before release sign-off.

## LAUNCH_FAILED Triage

Use `%LOCALAPPDATA%\ProjectWing\AgentState\sessions.json`, `%LOCALAPPDATA%\ProjectWing\DesktopAgent\agent.log`, and `%TEMP%\project-wing-runtime-logs\excel-watcher-*.timeline.log` as the first evidence sources. Group failures by `launchFailedReason` and `lastError` before changing code.

Known failure patterns:

- `COM_OPEN_FAILED` with `Specified cast is not valid.` or `TYPE_E_CANTLOADLIBRARY` means Excel COM automation started but the COM proxy/type library was not usable. The watcher must not leave the lock in limbo; it now attempts a Windows Shell open fallback and records `WATCHER_FILE_LOCK` once the workbook file is locked.
- `Excel open was not observed before the launch observation timeout.` means the Agent created a local session but neither the watcher nor monitor proved a user-visible workbook before the timeout. Check for missing watcher timeline logs, watcher processes stuck after `ComInitialize`, and stale hidden `EXCEL.EXE /automation -Embedding` processes.
- `Tracked file session is no longer launchable.` means the local session changed to a terminal or unsafe lifecycle while `openDesktopFile` was still waiting for open observation. Check whether another Master session superseded it or whether local cleanup marked the cache missing.

For close stability, if the watcher previously saw the file locked and later loses Excel COM with the file unlocked, it records `WorkbookClosedObservedByFileLockAfterComLoss` and posts `/closed`. This prevents an Excel RPC failure after launch from leaving the Master lock open indefinitely.
