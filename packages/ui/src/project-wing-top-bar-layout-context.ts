import { createContext, useContext } from "react";

import type { TopBarSideMode } from "./project-wing-top-bar-layout";

export type ProjectWingTopBarLayoutContextValue = {
  coordinated: boolean;
  ready: boolean;
  leadingMode: TopBarSideMode;
  actionsMode: TopBarSideMode;
};

const defaultValue: ProjectWingTopBarLayoutContextValue = {
  coordinated: false,
  ready: false,
  leadingMode: "collapsed",
  actionsMode: "collapsed",
};

export const ProjectWingTopBarLayoutContext = createContext(defaultValue);

export function useProjectWingTopBarLayout() {
  return useContext(ProjectWingTopBarLayoutContext);
}
