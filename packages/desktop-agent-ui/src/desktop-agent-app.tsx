import { DesktopAgentTrayController } from "@project-wing/desktop-agent/tray";
import { useEffect, useSyncExternalStore } from "react";
import { Alert, Linking, useColorScheme } from "react-native";

import { resolveDesktopAgentCopy } from "./copy";
import { DesktopAgentPanel } from "./desktop-agent-panel";
import { readProjectUrl, readProjectsUrl } from "./project-links";
import type { DesktopAgentWindowControls } from "./window-controls";

const trayController = new DesktopAgentTrayController();

export function DesktopAgentApp({
  windowControls,
}: {
  windowControls?:
    | (Omit<DesktopAgentWindowControls, "onClose"> & { quit: () => void })
    | undefined;
}) {
  const controllerState = useSyncExternalStore(
    trayController.subscribe,
    trayController.getSnapshot,
    trayController.getSnapshot
  );
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";

  useEffect(() => {
    trayController.start();
    return () => trayController.stop();
  }, []);

  return (
    <DesktopAgentPanel
      action={controllerState.action}
      actionError={controllerState.actionError}
      colorScheme={colorScheme}
      onCheckIn={(sessionId) =>
        ignoreFailure(trayController.checkInSession(sessionId))
      }
      onOpenProject={(projectId) =>
        ignoreFailure(Linking.openURL(readProjectUrl(projectId)))
      }
      onOpenProjects={() => ignoreFailure(Linking.openURL(readProjectsUrl()))}
      onRecoverRelease={(sessionId) =>
        ignoreFailure(trayController.recoverLaunchFailedRelease(sessionId))
      }
      onRefresh={() => ignoreFailure(trayController.refresh())}
      onRelease={(sessionId) =>
        ignoreFailure(trayController.releaseSession(sessionId))
      }
      onUpdate={(expectedVersion) =>
        ignoreFailure(trayController.startUpdate(expectedVersion))
      }
      refreshing={controllerState.refreshing}
      viewModel={controllerState.viewModel}
      windowControls={
        windowControls
          ? {
              ...windowControls,
              onClose: () => requestClose(windowControls.quit, controllerState),
            }
          : undefined
      }
    />
  );
}

function requestClose(
  quit: () => void,
  state: ReturnType<typeof trayController.getSnapshot>
) {
  const hasWorkInProgress =
    state.viewModel.sessions.length > 0 ||
    state.refreshing ||
    state.action !== null;
  if (!hasWorkInProgress) {
    quit();
    return;
  }
  const copy = resolveDesktopAgentCopy();
  Alert.alert(copy.closeConfirmTitle, copy.closeConfirmMessage, [
    { text: copy.cancel, style: "cancel" },
    { text: copy.close, style: "destructive", onPress: quit },
  ]);
}

function ignoreFailure(operation: Promise<unknown>) {
  void operation.catch(() => {});
}
