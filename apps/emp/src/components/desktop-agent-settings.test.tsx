import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultDesktopAgentManagementCopy } from "../i18n/dictionaries";
import type * as RecoveryModule from "./desktop-agent-recovery";
import {
  DesktopAgentSessionUpdateCheck,
  DesktopAgentSettings,
} from "./desktop-agent-settings";

const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getManifest: vi.fn(),
  getStatus: vi.fn(),
  getUpdateStatus: vi.fn(),
  info: vi.fn(),
  pair: vi.fn(),
  toast: vi.fn(),
  launchRecovery: vi.fn(),
  waitRecovery: vi.fn(),
}));

vi.mock("./desktop-agent-recovery", async (importOriginal) => ({
  ...(await importOriginal<typeof RecoveryModule>()),
  launchDesktopAgentRecovery: mocks.launchRecovery,
  waitForDesktopAgentRecovery: mocks.waitRecovery,
}));

vi.mock("@project-wing/ui", () => ({
  projectWingToast: {
    error: vi.fn(),
    info: mocks.info,
  },
}));

vi.mock("../api/desktop-agent", () => ({
  clearDesktopAgentReleaseManifestCache: vi.fn(),
  getDesktopAgentAuthStatus: mocks.getAuth,
  getDesktopAgentReleaseManifest: mocks.getManifest,
  getDesktopAgentStatus: mocks.getStatus,
  getDesktopAgentUpdateStatus: mocks.getUpdateStatus,
  pairDesktopAgentWithBetterAuth: mocks.pair,
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: "en-US",
    dictionary: {
      workbench: {
        settingsPanel: {
          desktopAgentManagement: defaultDesktopAgentManagementCopy,
        },
      },
    },
  }),
}));

vi.mock("./toast", () => ({
  useOptionalToast: () => null,
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

const release = {
  version: "0.2.1",
  platform: "windows",
  architecture: "x64",
  downloadUrl:
    "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.1",
  sha256: "a".repeat(64),
  fileSize: 123_456,
  publishedAt: "2026-07-27T12:00:00.000Z",
  minimumSupportedVersion: "0.2.0",
  minimumSelfUpdateVersion: "0.1.10",
  signaturePolicy: "optional",
} as const;

describe("lint test setup", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });
    mocks.getManifest.mockResolvedValue(release);
    mocks.getUpdateStatus.mockResolvedValue(null);
    mocks.getAuth.mockResolvedValue(null);
    mocks.waitRecovery.mockResolvedValue("ready");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("shows the normal update prompt for a 0.2.11 to 0.3.0 upgrade", async () => {
    window.sessionStorage.setItem(
      "project-wing-desktop-agent-release-checked",
      "0.2.11"
    );
    mocks.getStatus.mockResolvedValue({
      health: { version: "0.2.11" },
      isInstalled: true,
    });
    mocks.getManifest.mockResolvedValue({
      ...release,
      minimumSelfUpdateVersion: "0.2.10",
      version: "0.3.0",
    });

    render(createElement(DesktopAgentSessionUpdateCheck, { enabled: true }));

    await waitFor(() =>
      expect(mocks.info).toHaveBeenCalledWith(
        defaultDesktopAgentManagementCopy.updateAvailable,
        {
          description: `${defaultDesktopAgentManagementCopy.version}: 0.2.11 -> ${defaultDesktopAgentManagementCopy.latest}: 0.3.0`,
        }
      )
    );
  });

  describe(DesktopAgentSettings, () => {
    it("explains browser confirmation and manual startup when opening gets no response", async () => {
      mocks.getStatus.mockResolvedValue({ isInstalled: false, health: null });
      let rejectWait!: (error: Error) => void;
      mocks.waitRecovery.mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectWait = reject;
          })
      );
      renderSettings();
      await screen.findByRole("heading", {
        name: defaultDesktopAgentManagementCopy.notRunning,
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: defaultDesktopAgentManagementCopy.openAgent,
        })
      );
      await screen.findByRole("heading", {
        name: defaultDesktopAgentManagementCopy.waitingForApp,
      });
      expect(
        screen.getByText(defaultDesktopAgentManagementCopy.allowBrowserOpen)
      ).toBeTruthy();
      expect(mocks.launchRecovery).toHaveBeenCalledExactlyOnceWith("open");
      expect(
        screen.getByRole("button", {
          name: defaultDesktopAgentManagementCopy.waitingForApp,
        })
      ).toHaveAttribute("disabled");
      await act(async () => {
        rejectWait(new Error("unreachable"));
        await Promise.resolve();
      });
      await screen.findByText(
        defaultDesktopAgentManagementCopy.recoveryUnconfirmed
      );
      expect(
        screen.getByRole("button", {
          name: defaultDesktopAgentManagementCopy.openAgent,
        })
      ).not.toHaveAttribute("disabled");
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it("does not repeat an old startup error after a later successful connection", async () => {
      mocks.getStatus.mockResolvedValue({ isInstalled: false, health: null });
      mocks.waitRecovery.mockRejectedValue(new Error("unreachable"));
      const { queryClient } = renderSettings();
      await screen.findByRole("heading", {
        name: defaultDesktopAgentManagementCopy.notRunning,
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: defaultDesktopAgentManagementCopy.openAgent,
        })
      );
      await screen.findByText(
        defaultDesktopAgentManagementCopy.recoveryUnconfirmed
      );
      act(() => {
        queryClient.setQueryData(["desktop-agent-status"], {
          isInstalled: true,
          isSupported: true,
          health: {
            app: "project-wing-desktop-runtime",
            version: "0.3.10",
            agentState: "READY",
            restoreState: "READY",
          },
        });
      });
      await waitFor(() =>
        expect(
          screen.queryByText(
            defaultDesktopAgentManagementCopy.recoveryUnconfirmed
          )
        ).toBeNull()
      );
    });

    it("bounds the update-restart waiting state and never reuses stale signed-in state", async () => {
      vi.useFakeTimers();
      mocks.getStatus.mockResolvedValue({
        isInstalled: true,
        isSupported: false,
        health: {
          app: "project-wing-desktop-runtime",
          version: "0.3.9",
          agentState: "UPDATING",
        },
      });
      const { queryClient } = renderSettings();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      mocks.getStatus.mockResolvedValue({ isInstalled: false, health: null });
      await act(async () => {
        queryClient.setQueryData(["desktop-agent-status"], {
          isInstalled: false,
          health: null,
        });
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(
        screen.getByRole("heading", {
          name: defaultDesktopAgentManagementCopy.updateReconnecting,
        })
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", {
          name: defaultDesktopAgentManagementCopy.openAgent,
        })
      ).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_001);
      });
      expect(
        screen.getByRole("heading", {
          name: defaultDesktopAgentManagementCopy.connectionLost,
        })
      ).toBeTruthy();
      expect(
        screen.getByRole("button", {
          name: defaultDesktopAgentManagementCopy.openAgent,
        })
      ).not.toHaveAttribute("disabled");
    });

    it("does not treat an unreadable account response as a signed-out account", async () => {
      mocks.getStatus.mockResolvedValue({
        isInstalled: true,
        isSupported: true,
        health: {
          app: "project-wing-desktop-runtime",
          agentState: "READY",
          version: "0.2.1",
          restoreState: "READY",
        },
      });
      mocks.getAuth.mockResolvedValue(null);
      renderSettings();
      await screen.findByRole("heading", {
        name: defaultDesktopAgentManagementCopy.accountUnconfirmed,
      });
      expect(
        screen.queryByRole("button", { name: "Connect account" })
      ).toBeNull();
      expect(
        screen.queryByText(defaultDesktopAgentManagementCopy.readyHelp)
      ).toBeNull();
      expect(
        screen.getAllByRole("button", { name: "Check again" })
      ).toHaveLength(2);
    });

    it("keeps pending file recovery visible instead of announcing that everything is fixed", async () => {
      mocks.getStatus.mockResolvedValue({
        isInstalled: true,
        isSupported: true,
        health: {
          app: "project-wing-desktop-runtime",
          agentState: "READY_WITH_ATTENTION",
          version: "0.3.0",
          quarantineCount: 1,
        },
      });
      mocks.getAuth.mockResolvedValue({ authenticated: true });
      mocks.waitRecovery.mockResolvedValue("attention");
      renderSettings();
      await screen.findByText(defaultDesktopAgentManagementCopy.fileHelp);
      fireEvent.click(
        await screen.findByRole("button", {
          name: defaultDesktopAgentManagementCopy.moreActions,
        })
      );
      const recover = await screen.findByRole("button", {
        name: defaultDesktopAgentManagementCopy.recover,
      });
      await waitFor(() => expect(recover.hasAttribute("disabled")).toBeFalsy());
      fireEvent.click(recover);
      expect(mocks.launchRecovery).toHaveBeenCalledExactlyOnceWith("recover");
      await waitFor(() => expect(mocks.waitRecovery).toHaveBeenCalledOnce());
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: defaultDesktopAgentManagementCopy.fileAttention,
          variant: "info",
        })
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: defaultDesktopAgentManagementCopy.openAgent,
        })
      );
      expect(mocks.launchRecovery).toHaveBeenLastCalledWith("open");
    });

    it("blocks the pairing workflow while the local service is degraded", async () => {
      mocks.getStatus.mockResolvedValue({
        isInstalled: true,
        isSupported: false,
        health: {
          app: "project-wing-desktop-runtime",
          version: "0.3.0",
          agentState: "DEGRADED_NEEDS_ATTENTION",
        },
      });
      renderSettings();
      await screen.findAllByText(
        defaultDesktopAgentManagementCopy.needsAttention
      );
      expect(
        screen.queryByText(defaultDesktopAgentManagementCopy.ready)
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Pair again" })).toBeNull();
    });

    it("requires a user gesture and confirmed readiness before announcing recovery", async () => {
      mocks.getStatus.mockResolvedValue({ isInstalled: false, health: null });
      let finish!: () => void;
      mocks.waitRecovery.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
      );
      renderSettings();
      const button = await screen.findByRole("button", {
        name: defaultDesktopAgentManagementCopy.openAgent,
      });
      await waitFor(() => expect(button.hasAttribute("disabled")).toBeFalsy());
      expect(mocks.launchRecovery).not.toHaveBeenCalled();
      fireEvent.click(button);
      fireEvent.click(button);
      await waitFor(() => expect(mocks.waitRecovery).toHaveBeenCalledOnce());
      expect(mocks.launchRecovery).toHaveBeenCalledExactlyOnceWith("open");
      expect(mocks.toast).not.toHaveBeenCalled();
      finish();
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: defaultDesktopAgentManagementCopy.recoveryConfirmed,
          variant: "success",
        })
      );
    });

    it("offers a concise download action when the Agent is unavailable", async () => {
      mocks.getStatus.mockResolvedValue({
        health: null,
        isInstalled: false,
        isSupported: false,
        supportsSelfUpdate: false,
      });

      renderSettings();

      await expect(
        screen.findByRole("button", { name: "Download Windows 0.2.1" })
      ).resolves.toBeTruthy();
      expect(
        screen.queryByText(
          "Manage local Agent startup, installation, pairing, and updates."
        )
      ).toBeNull();
    });

    it("prioritizes account connection and keeps diagnostics behind more actions", async () => {
      mocks.getStatus.mockResolvedValue({
        health: {
          ok: true,
          app: "project-wing-desktop-runtime",
          version: "0.2.1",
          managerVersion: "0.2.1",
          agentVersion: "0.2.1",
          agentState: "READY",
          updateState: "IDLE",
          restoreState: "READY",
          attentionCount: 0,
        },
        isInstalled: true,
        isSupported: true,
        supportsSelfUpdate: true,
      });
      mocks.getAuth.mockResolvedValue({
        ok: true,
        authenticated: false,
        pairing: false,
      });

      renderSettings();
      await expect(
        screen.findByRole("heading", {
          name: defaultDesktopAgentManagementCopy.accountRequired,
        })
      ).resolves.toBeTruthy();
      expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Connect account" })
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Copy diagnostics" })
      ).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "More actions" }));
      expect(
        screen.getByRole("button", { name: "Copy diagnostics" })
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Download Windows 0.2.1" })
      ).toBeTruthy();
    });
  });

  function renderSettings() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const rendered = render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(DesktopAgentSettings)
      )
    );
    return { ...rendered, queryClient };
  }
});
