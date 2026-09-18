import "@fontsource-variable/geist";
import "./tray-activity.css";
import "./styles.css";
import { defaultTheme, ProjectWingThemeProvider } from "@project-wing/ui";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { DesktopAgentI18nProvider } from "./i18n";

const initialTheme = {
  ...defaultTheme,
  flavor: window.matchMedia("(prefers-color-scheme: dark)").matches
    ? ("mocha" as const)
    : ("latte" as const),
};

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Renderer root was not found.");
}
createRoot(root).render(
  <DesktopAgentI18nProvider>
    <ProjectWingThemeProvider initialTheme={initialTheme}>
      <App />
    </ProjectWingThemeProvider>
  </DesktopAgentI18nProvider>
);
