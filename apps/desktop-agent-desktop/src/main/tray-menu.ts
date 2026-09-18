import type { MenuItemConstructorOptions } from "electron";

import type {
  DesktopAgentSnapshot,
  DesktopAgentState,
} from "../shared/desktop-agent-api";

type TrayMenuActions = {
  onOpen: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
  onRefresh: () => void;
  onRecover?: () => void;
  onSignOut: () => void;
};

export function createTrayMenuTemplate(
  snapshot: DesktopAgentSnapshot,
  actions: TrayMenuActions
): MenuItemConstructorOptions[] {
  return [
    { label: getStatusLabel(snapshot), enabled: false },
    createIdentityItem(snapshot, actions.onSignOut),
    { label: "Open", click: actions.onOpen },
    { label: "Settings…", click: actions.onOpenSettings },
    { label: "Refresh", click: actions.onRefresh },
    ...(actions.onRecover
      ? [{ label: "Recover local service", click: actions.onRecover }]
      : []),
    { label: "Quit", click: actions.onQuit },
  ];
}

export function getStatusLabel(snapshot: DesktopAgentSnapshot) {
  if (snapshot.state === "ATTENTION" && snapshot.attentionCount > 0) {
    const suffix = snapshot.attentionCount === 1 ? "item" : "items";
    return `Desktop Agent needs attention (${snapshot.attentionCount} ${suffix})`;
  }
  return statusLabels[snapshot.state];
}

function createIdentityItem(
  snapshot: DesktopAgentSnapshot,
  onSignOut: () => void
): MenuItemConstructorOptions {
  if (!snapshot.user) {
    return { label: "Not signed in", enabled: false };
  }
  return {
    label: `Signed in as ${snapshot.user.name}`,
    submenu: [
      { label: snapshot.user.email, enabled: false },
      { label: "Log out", click: onSignOut },
    ],
  };
}

const statusLabels: Record<DesktopAgentState, string> = {
  OFFLINE: "Desktop Agent is offline",
  STARTING: "Desktop Agent is starting",
  PAIR_REQUIRED: "Desktop Agent needs you to sign in",
  PAIRING: "Desktop Agent is signing in",
  READY: "Desktop Agent is ready",
  UPDATING: "Desktop Agent is updating",
  ATTENTION: "Desktop Agent needs attention",
  FAILED: "Desktop Agent could not start",
};

export type { TrayMenuActions };
