# Manual launch and background startup — 2026-09-07

## Scope

Manual Desktop/Start-menu launches now reveal the window on cold start and on a second-instance activation. Explicit `--background` startup stays quiet, as does macOS login launch (`wasOpenedAtLogin`). Valid open/start URLs explicitly show the UI; recovery stays separate; malformed/external URLs do not become ordinary launch requests. Velopack lifecycle callback invocations remain quiet.

Windows keeps the installer-managed Startup shortcut. The application amends only that existing link, only when running from the exact standard installed `current` path, only when its target matches that executable, and only when its arguments are empty. It adds `--background` without changing icon/name/working directory or Desktop/Start-menu links. Deleted login items are not recreated; custom/foreign targets and arguments are preserved. Shortcut failures cannot block manual UI startup. An unmarked shortcut from an older package may show the UI on its first launch, after which the owned shortcut is marked for future logins.

No changes to installed-user files, registry entries, process termination or legacy cleanup authority were made during implementation. Existing legacy cleanup remains installer-owned and does not run during ordinary application startup. The PC's old 0.2.11/current 0.3.4 coexistence and historical bind conflict still require normal installed-app update and safety checks; this change alone is not that acceptance.

## Validation

- `corepack pnpm --filter @project-wing/desktop-agent-desktop test`: 129 passed, 2 opt-in process cases skipped in the ordinary run.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop lint`: passed after correcting optional ShortcutDetails arguments.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop build`: passed.
- Targeted protocol, startup ownership, flyout and migration suite: 37 passed.
- `corepack pnpm --filter @project-wing/desktop-agent-desktop exec electron scripts/verify-launch-window.cjs`: passed, one visible window.
- Same command with `--background`: passed, one resident but non-visible window.
- The smoke fixture uses independent temporary user/session profiles, StateRoot/CacheRoot, disables file launch, denies all service fetches and cannot resolve a native Runtime. Its expected missing-runtime console error is intentional. It uses software rendering only inside the fixture for deterministic screenshot capture; production GPU settings are untouched. Initial GPU capture failed and an early pre-ready visibility sample was unreliable; the final fixture waits for `ready-to-show` and records the real rendered window.
- Final manual evidence: `C:/Users/LHX/AppData/Local/Temp/project-wing-launch-fixture-pxWR25/result.json` and `window.png` (visually inspected). Background evidence: `C:/Users/LHX/AppData/Local/Temp/project-wing-launch-fixture-eu1CVa/result.json` and `window.png`. Native Computer Use discovery during earlier short-lived fixture runs did not find a lasting window; no installed-app success is inferred from those attempts.
- Installed update, reboot, macOS installed launch and production fault acceptance remain unrun. No user files were deleted, moved, uploaded or released.

Electron API references: [Shortcut read/update](https://www.electronjs.org/docs/latest/api/shell), [macOS login-launch detection](https://www.electronjs.org/docs/latest/api/app#appgetloginitemsettingsoptions-macos-windows).
