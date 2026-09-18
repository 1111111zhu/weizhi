import { describe, expect, it, vi } from "vitest";

import type { DesktopAgentSnapshot } from "../shared/desktop-agent-api";
import { createTrayMenuTemplate, getStatusLabel } from "./tray-menu";

const actions = {
  onOpen: vi.fn(),
  onOpenSettings: vi.fn(),
  onQuit: vi.fn(),
  onRefresh: vi.fn(),
  onSignOut: vi.fn(),
};

const snapshot: DesktopAgentSnapshot = {
  state: "READY",
  version: "0.3.0",
  attentionCount: 0,
  error: null,
  user: {
    id: "user-1",
    email: "alex@example.com",
    name: "Alex",
    globalRole: "USER",
  },
  sessions: [],
};

describe(createTrayMenuTemplate, () => {
  it("keeps the requested menu order and account actions", () => {
    const menu = createTrayMenuTemplate(snapshot, actions);

    expect(menu.map((item) => item.label)).toStrictEqual([
      "Desktop Agent is ready",
      "Signed in as Alex",
      "Open",
      "Settings…",
      "Refresh",
      "Quit",
    ]);
    expect(menu[0]?.enabled).toBeFalsy();
    expect(menu[1]?.submenu).toStrictEqual([
      { label: "alex@example.com", enabled: false },
      { label: "Log out", click: actions.onSignOut },
    ]);
    expect(menu[3]?.click).toBe(actions.onOpenSettings);
  });

  it("shows a non-interactive signed-out identity", () => {
    const menu = createTrayMenuTemplate({ ...snapshot, user: null }, actions);

    expect(menu[1]).toStrictEqual({ label: "Not signed in", enabled: false });
  });
});

describe(getStatusLabel, () => {
  it("describes attention counts in natural language", () => {
    const oneAttention = getStatusLabel({
      ...snapshot,
      state: "ATTENTION",
      attentionCount: 1,
    });
    const multipleAttention = getStatusLabel({
      ...snapshot,
      state: "ATTENTION",
      attentionCount: 2,
    });

    expect(multipleAttention).not.toBe(oneAttention);
    expect(multipleAttention).toContain(String(2));
  });
});
