// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DesktopAgentSettingsPrompt,
  OPEN_DESKTOP_AGENT_SETTINGS,
} from "./desktop-agent-settings-prompt";

describe(DesktopAgentSettingsPrompt, () => {
  afterEach(cleanup);

  it("offers settings instead of launching an installer or a recovery workflow", async () => {
    const close = vi.fn();
    const openSettings = vi.fn();
    window.addEventListener(OPEN_DESKTOP_AGENT_SETTINGS, openSettings);
    render(<DesktopAgentSettingsPrompt open onOpenChange={close} />);
    expect(
      screen
        .getAllByRole("button")
        .filter((button) =>
          /Download|Start|Update/.test(button.textContent ?? "")
        )
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Go to settings" }));
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
    await waitFor(() => expect(openSettings).toHaveBeenCalledOnce());
    window.removeEventListener(OPEN_DESKTOP_AGENT_SETTINGS, openSettings);
  });

  it("cancel does not open settings", () => {
    const close = vi.fn();
    const openSettings = vi.fn();
    window.addEventListener(OPEN_DESKTOP_AGENT_SETTINGS, openSettings);
    render(<DesktopAgentSettingsPrompt open onOpenChange={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
    expect(openSettings).not.toHaveBeenCalled();
    window.removeEventListener(OPEN_DESKTOP_AGENT_SETTINGS, openSettings);
  });
});
