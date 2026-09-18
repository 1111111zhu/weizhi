import type { Shell } from "electron";
import { describe, expect, it, vi } from "vitest";

import { configureWindowsStartupShortcut } from "./windows-startup-shortcut";

const options = {
  isPackaged: true,
  platform: "win32" as const,
  appDataPath: "C:\\Users\\test\\AppData\\Roaming",
  localAppDataPath: "C:\\Users\\test\\AppData\\Local",
  executablePath:
    "C:\\Users\\test\\AppData\\Local\\com.superfx.projectwing.desktop-agent\\current\\ProjectWingDesktopAgent.exe",
};
function shell(target = options.executablePath, args = "") {
  return {
    readShortcutLink: vi.fn(() => ({ target, args })),
    writeShortcutLink: vi.fn(() => true),
  } as unknown as Pick<Shell, "readShortcutLink" | "writeShortcutLink">;
}
describe("owned background startup shortcut", () => {
  it("changes only args on the matching existing Startup link", () => {
    const shortcuts = shell();
    expect(
      configureWindowsStartupShortcut(options, shortcuts, () => true)
    ).toBeTruthy();
    expect(shortcuts.writeShortcutLink).toHaveBeenCalledExactlyOnceWith(
      "C:\\Users\\test\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Project Wing Desktop Agent.lnk",
      "update",
      { target: options.executablePath, args: "--background" }
    );
  });

  it.each([
    [options.executablePath, "--background"],
    [options.executablePath, "--custom"],
    ["C:\\another-install\\agent.exe", ""],
  ])("preserves existing custom or foreign targets (%s %s)", (target, args) => {
    const shortcuts = shell(target, args);
    expect(
      configureWindowsStartupShortcut(options, shortcuts, () => true)
    ).toBeFalsy();
    expect(shortcuts.writeShortcutLink).not.toHaveBeenCalled();
  });

  it("does not recreate a removed startup shortcut", () => {
    const shortcuts = shell();
    expect(
      configureWindowsStartupShortcut(options, shortcuts, () => false)
    ).toBeFalsy();
    expect(shortcuts.readShortcutLink).not.toHaveBeenCalled();
    expect(shortcuts.writeShortcutLink).not.toHaveBeenCalled();
  });

  it.each([
    { ...options, isPackaged: false },
    { ...options, platform: "darwin" as const },
    { ...options, localAppDataPath: undefined },
    { ...options, executablePath: "C:\\portable\\ProjectWingDesktopAgent.exe" },
  ])(
    "does not change startup from unsupported or non-installed copies",
    (input) => {
      const shortcuts = shell();
      const exists = vi.fn(() => true);
      expect(
        configureWindowsStartupShortcut(input, shortcuts, exists)
      ).toBeFalsy();
      expect(exists).not.toHaveBeenCalled();
      expect(shortcuts.writeShortcutLink).not.toHaveBeenCalled();
    }
  );

  it("reports write failure rather than claiming the link was configured", () => {
    const shortcuts = shell();
    vi.mocked(shortcuts.writeShortcutLink).mockReturnValue(false);
    expect(() =>
      configureWindowsStartupShortcut(options, shortcuts, () => true)
    ).toThrow("could not be updated");
  });
});
