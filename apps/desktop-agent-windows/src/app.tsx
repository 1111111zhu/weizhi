import { DesktopAgentApp } from "@project-wing/desktop-agent-ui";
import { useEffect, useState } from "react";
import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

type DesktopAgentWindowModule = {
  isMaximized?: () => boolean;
  minimize: () => void;
  quit: () => void;
  toggleMaximize: () => Promise<boolean>;
};

const nativeWindow = NativeModules.DesktopAgentWindow as
  | DesktopAgentWindowModule
  | undefined;

export default function App() {
  const [isMaximized, setIsMaximized] = useState(
    Platform.OS === "windows" && nativeWindow?.isMaximized?.() === true
  );
  useEffect(() => {
    if (!nativeWindow) {
      return;
    }
    const subscription = DeviceEventEmitter.addListener(
      "desktopAgentWindowStateChanged",
      setIsMaximized
    );
    return () => subscription.remove();
  }, []);
  return (
    <DesktopAgentApp
      windowControls={
        nativeWindow
          ? {
              isMaximized,
              onMinimize: () => nativeWindow.minimize(),
              onToggleMaximize: () => {
                void nativeWindow
                  .toggleMaximize()
                  .then(setIsMaximized)
                  .catch(() => {});
              },
              quit: () => nativeWindow.quit(),
            }
          : undefined
      }
    />
  );
}
