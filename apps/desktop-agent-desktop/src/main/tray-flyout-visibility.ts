import type { BrowserWindowConstructorOptions } from "electron";

export interface TrayFlyoutWindow {
  focus: () => void;
  hide: () => void;
  isVisible: () => boolean;
  setIgnoreMouseEvents: (ignore: boolean) => void;
  setOpacity: (opacity: number) => void;
  setSkipTaskbar: (skip: boolean) => void;
  show: () => void;
  showInactive: () => void;
}

export function getTrayWindowPlatformOptions(
  _platform: NodeJS.Platform
): Pick<
  BrowserWindowConstructorOptions,
  "skipTaskbar" | "type" | "frame" | "transparent" | "minimizable"
> {
  return {
    frame: true,
    transparent: false,
    minimizable: true,
    skipTaskbar: false,
    type: undefined,
  };
}

export class TrayFlyoutVisibility {
  private mounted = false;
  private visible = false;

  constructor(private readonly resident: boolean) {}

  handleReady(window: TrayFlyoutWindow) {
    if (!this.resident) {
      return;
    }
    window.setSkipTaskbar(true);
    window.setOpacity(0);
    window.setIgnoreMouseEvents(true);
    window.showInactive();
    window.setSkipTaskbar(true);
    this.mounted = true;
    if (this.visible) {
      this.revealResidentWindow(window);
    }
  }

  isVisible(window: TrayFlyoutWindow) {
    return this.resident ? this.visible : window.isVisible();
  }

  show(window: TrayFlyoutWindow) {
    this.visible = true;
    if (!this.resident) {
      window.show();
      return;
    }
    if (this.mounted) {
      this.revealResidentWindow(window);
    }
  }

  hide(window: TrayFlyoutWindow) {
    this.visible = false;
    if (!this.resident) {
      window.hide();
      return;
    }
    if (!this.mounted) {
      return;
    }
    window.setOpacity(0);
    window.setIgnoreMouseEvents(true);
    window.setSkipTaskbar(true);
  }

  private revealResidentWindow(window: TrayFlyoutWindow) {
    window.setIgnoreMouseEvents(false);
    window.focus();
    window.setOpacity(1);
    window.setSkipTaskbar(true);
  }
}
