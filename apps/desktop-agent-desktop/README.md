# Desktop Agent Electron Host

This package is the per-user Electron host for the Desktop Agent tray UI. It owns the tray window, the managed runtime child process, and the cross-platform VeloPack update lifecycle. The managed runtime is not installed as a system service.

## Local development

Run the renderer and Electron host from WSL:

```bash
corepack pnpm --filter @project-wing/desktop-agent-desktop dev
```

The packaged Windows payload can be built in WSL when a Windows Electron distribution is provided through `PROJECT_WING_DESKTOP_ELECTRON_DIST`.

## Release packaging

VeloPack packages each platform's Electron output. Run each target on its matching operating system with a .NET 8 SDK:

```powershell
corepack pnpm build:desktop-agent:win
```

```bash
corepack pnpm build:desktop-agent:mac
```

If the managed runtime and Electron payload were built elsewhere, a machine that only has the .NET runtime can run the VeloPack CLI by pointing `VPK_DLL` at the extracted `vpk.dll` and keeping its sibling `vendor` directory beside the tool assets. A full release from source still requires the .NET 8 SDK.

Each script publishes the managed .NET processes into `DesktopRuntime/managed`, builds the Electron platform payload, and creates the VeloPack full, portable, installer, and update-feed artifacts. Set `PROJECT_WING_DESKTOP_VPK_PROVIDER` to download a previous release for delta generation and upload the new assets to the configured provider.

For a published build, set `PROJECT_WING_DESKTOP_UPDATE_URL` to the public API update directory, for example `https://emp.example/api/downloads/desktop-agent/windows/updates`. The package script writes it into `desktop-release.json` inside the installed app; it is not dependent on a user environment variable. The release workflow requires this value through `DESKTOP_AGENT_VELOPACK_UPDATE_URL`.

Windows keeps the public installer names `desktop-agent-win-x64.exe` and `desktop-agent-win-x64-{version}.exe`; macOS uses the native package names emitted by VeloPack. Both platform packages are intentionally unsigned because Desktop Agent is distributed internally.
