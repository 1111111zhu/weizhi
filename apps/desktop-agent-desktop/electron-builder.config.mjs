import { createRequire } from "node:module";
import path from "node:path";

const appDirectory = import.meta.dirname;
const require = createRequire(import.meta.url);
const managedRuntimeSource = process.env.PROJECT_WING_DESKTOP_RUNTIME_SOURCE;
const releaseConfigSource = process.env.PROJECT_WING_DESKTOP_RELEASE_CONFIG;
const desktopIcon = path.join(appDirectory, "resources/icon.ico");
const darkTrayIcon = path.join(appDirectory, "resources/tray-dark.ico");
const velopackDirectory = path.dirname(
  require.resolve("velopack/package.json")
);
const neonLoadDirectory = path.dirname(
  require.resolve("@neon-rs/load/package.json", {
    paths: [velopackDirectory],
  })
);

if (!managedRuntimeSource) {
  throw new Error(
    "PROJECT_WING_DESKTOP_RUNTIME_SOURCE must point to the published managed runtime."
  );
}
if (!releaseConfigSource) {
  throw new Error(
    "PROJECT_WING_DESKTOP_RELEASE_CONFIG must point to the packaged update configuration."
  );
}

export default {
  appId: "com.superfx.projectwing.desktop-agent",
  asar: true,
  asarUnpack: ["**/node_modules/velopack/**"],
  beforeBuild: () => false,
  directories: {
    output: process.env.PROJECT_WING_DESKTOP_OUTPUT_DIR ?? "release",
  },
  electronDist: process.env.PROJECT_WING_DESKTOP_ELECTRON_DIST,
  executableName: "ProjectWingDesktopAgent",
  extraMetadata: process.env.PROJECT_WING_DESKTOP_VERSION
    ? { version: process.env.PROJECT_WING_DESKTOP_VERSION }
    : {},
  extraResources: [
    { from: managedRuntimeSource, to: "DesktopRuntime/managed" },
    { from: releaseConfigSource, to: "desktop-release.json" },
    {
      from: path.join(
        path.dirname(releaseConfigSource),
        "desktop-runtime-integrity.json"
      ),
      to: "desktop-runtime-integrity.json",
    },
    { from: desktopIcon, to: "tray.ico" },
    { from: darkTrayIcon, to: "tray-dark.ico" },
  ],
  files: [
    "out/**",
    "package.json",
    {
      from: velopackDirectory,
      to: "node_modules/velopack",
      filter: [
        "**/*",
        "!lib/native/velopack_nodeffi_linux_*.node",
        "!lib/native/velopack_nodeffi_osx.node",
      ],
    },
    {
      from: neonLoadDirectory,
      to: "node_modules/@neon-rs/load",
    },
  ],
  mac: {
    icon: process.env.PROJECT_WING_DESKTOP_MACOS_ICON,
    identity: null,
    target: ["dir"],
  },
  productName: "Project Wing Desktop Agent",
  win: {
    icon: desktopIcon,
    signExecutable: false,
    target: ["dir"],
  },
};
