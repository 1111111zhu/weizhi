# Mobile browser development environment

## Scope

The user confirmed on 2026-09-10 that EMP remains a browser application. Do not add an APK wrapper, native shell or separate mobile business implementation for this work. Use Android Chrome to test the existing Web application.

The user also requested a cleaner, neutral mobile appearance: reserve green for a small number of primary actions and current navigation states, rather than tinting ordinary rows, icons and controls. Preserve informative state text/icons; this is a design requirement, not a claim that the recoloring is already implemented.

## Installed dedicated device

- AVD: `ProjectWing_Pixel7_API36`
- Location: `D:\Dev\Android\Avd\ProjectWing_Pixel7_API36.avd`
- Android SDK: `D:\Android\Sdk`
- System image: `system-images;android-36;google_apis_playstore;x86_64`, revision 7 (official SDK Manager download).
- Device profile: Pixel 7, 1080 × 2400, density 420; 3 GB RAM, 6 GB data partition; Android soft keyboard enabled.
- Initial standalone launch used port 5556. Android Studio Device Manager may choose another port; on the verified run it used `emulator-5554`. Resolve the serial with `adb devices -l` and confirm `adb -s SERIAL emu avd name` before operating.
- Preinstalled Chrome: **133.0.6943.137**. This is not a latest-browser certification. Update through Google Play and recheck the version before latest-release acceptance.
- The previous `FindYou_API34` AVD and its data were not removed or modified.

To launch later, if this AVD is not already running:

```powershell
& 'D:\Android\Sdk\emulator\emulator.exe' -avd ProjectWing_Pixel7_API36 -port 5556 -no-snapshot-save
```

`-no-snapshot-save` avoids saving a quick-boot snapshot; it does not wipe persistent Android user data. Do not use `-wipe-data` or `avdmanager --force` as routine recovery.

## Local page

Preferred setup: map the host preview to Android localhost (replace the serial with the verified target):

```powershell
& 'D:\Android\Sdk\platform-tools\adb.exe' -s emulator-5554 reverse tcp:3047 tcp:3047
```

Inside the Android browser, use:

```text
http://127.0.0.1:3047/specimens/MobileWorkspace
```

No public tunnel or LAN exposure is required. The local showroom must still be running on host port 3047. The alternative `10.0.2.2` host alias is useful for connectivity checks, but HTTP on that address is **not a secure context**: Chrome does not expose `crypto.randomUUID`, which the fixture uses for local reply/draft identifiers. Do not disable browser security or count failed fixture submissions as passed tests. Prefer the localhost mapping.

The showroom's `allowedDevOrigins` now includes the exact `10.0.2.2` alias as well as localhost and 127.0.0.1. Previously the document returned 200 but JavaScript chunks returned 403, leaving a static screen with inert interactions. The config change is development-only, has no wildcard and does not change the server's bind address. Its watcher restarted the already-running dev server normally.

Network verification on 2026-09-10: Android guest ping to 10.0.2.2 succeeded; an HTTP GET from the guest to the specimen returned **200 OK**. An initial host-piped request had invalid framing and returned 400; repeating with CRLF generated in the guest returned 200. This proves connectivity, not browser rendering or workflow acceptance.

## Remaining acceptance

- Chrome first-run authentication/privacy choices are user-operated. No Google credentials or privacy selections were automated.
- A real Android Chrome walkthrough now verifies settings, theme/text-size reload persistence, local reply submission, Q1/Q2 draft isolation and Android Back from an attachment to its exact question. Detailed evidence is below. Full docked-keyboard obstruction, rotation, long-list performance, downloads/uploads and file picking remain unverified.
- Real API workflows require a backend-attached authenticated EMP environment. The showroom uses fixtures and does not establish production persistence/permission correctness.
- Android Chrome does not replace iPhone Safari acceptance. Use physical iPhone or macOS Xcode Simulator for that browser engine.

## Setup notes

The machine's pre-existing `JAVA_HOME` pointed to a missing Java 17 directory. SDK operations used Android Studio's bundled `C:\Program Files\Android\Android Studio\jbr` for the command process only; no global environment setting was changed. SDK Manager needed the machine's existing loopback proxy to fetch Google's package manifests/image. No security settings or firewall rules were changed.

Startup diagnostics are in the task worktree's `output/android-emulator/pixel7-api36.out.log` and `pixel7-api36.err.log`. Check `adb devices -l` and `sys.boot_completed` before relying on the visible window: during first boot it briefly reported offline while the Android package service was starting.

## Verified Android session — 2026-09-10

Started the existing dedicated AVD through Android Studio Device Manager, then undocked/maximized Running Devices. Chrome opened to its normal new-tab page; no account/privacy prompts were acted on. `computer-use` handled Windows app controls; Android SDK input and Chrome's own debugging endpoint handled guest input/browser inspection. No terminal commands were entered through UI automation.

An ADB forwarding command exposed the already-running Chrome debugging socket on an ephemeral host-local port:

```powershell
& 'D:\Android\Sdk\platform-tools\adb.exe' -s emulator-5554 forward tcp:0 localabstract:chrome_devtools_remote
npx --yes --package @playwright/cli playwright-cli -s=android-mobile attach --cdp http://127.0.0.1:60414
```

60414 was the returned port for this run; it is not a fixed configuration. The browser is the emulator's actual Chrome **133.0.6943.137**, not a desktop browser with a mobile viewport. Captured page screenshots and the Android screencap are under `docs/evidence/mobile-app-experience/`: `android-settings-dark.png`, `android-settings-index.png`, `android-reply-sent.png`, `android-device-settings.png`.

Walkthrough results:

- My → Settings → personalization: dark theme and large text apply and survive reload; return reaches settings.
- Tasks → Q1 → reply: failed on HTTP 10.0.2.2 with `TypeError: crypto.randomUUID is not a function`; unsent draft was not cleared. Repeated via Android localhost: secure-context/UUID checks passed, reply appeared once and composer cleared.
- Reading → question list → Q2: saved an unsent draft; Q1 did not inherit it. Opened the Q1 bank reference and used Android `KEYCODE_BACK`; returned to Q1 with its reply preserved. Reopened Q2 and confirmed its draft survived.
- Native input-method diagnostics showed `mInputShown=true`; this device was in stylus/floating-keyboard mode. On-screen keyboard was displayed via its own menu, and Back dismissed it. Floating input can cover page content and does not resize the visual viewport; this does **not** establish the standard docked-keyboard case. No pass is claimed for that case.

The run ends on the settings page with the emulator left running. All edits/replies were synthetic showroom state. No production API, project data or account setting was mutated. Config syntax (`node --check apps/ui-showroom/next.config.mjs`) and scoped formatting/lint were checked; no product build, PR, merge or deployment was performed for this testing pass.
