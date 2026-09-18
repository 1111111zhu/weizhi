"use client";

import { ProjectWingTopBar, ProjectWingTopBarBrand } from "@project-wing/ui";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import type {
  ComponentProps,
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";

import {
  EmpPortalAction,
  EmpTopBarControls,
} from "./project-wing-top-bar-controls";

type TopBarProps = ComponentProps<typeof ProjectWingTopBar>;
const TopBarRegistration = createContext<Dispatch<
  SetStateAction<TopBarProps | null>
> | null>(null);

/** The route owns its controls; the app layout owns the header's lifetime. */
export function EmpTopBarProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [header, setHeader] = useState<TopBarProps | null>(null);
  return (
    <TopBarRegistration.Provider value={enabled ? setHeader : null}>
      {enabled ? (
        <ProjectWingTopBar
          leading={
            <>
              <ProjectWingTopBarBrand />
              <EmpPortalAction />
            </>
          }
          actions={<EmpTopBarControls />}
          {...header}
          data-emp-persistent-header=""
        />
      ) : null}
      {children}
    </TopBarRegistration.Provider>
  );
}

export function EmpRouteTopBar({
  ready = true,
  ...props
}: TopBarProps & { ready?: boolean }) {
  const register = useContext(TopBarRegistration);
  useLayoutEffect(() => {
    if (!register || !ready) {
      return;
    }
    if (typeof window.requestIdleCallback !== "function") {
      register(props);
      return;
    }
    // Let the new page finish its layout before starting header motion.
    let idle: number | undefined;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        idle = window.requestIdleCallback(() => register(props), {
          timeout: 200,
        });
      });
    });
    // Do not clear on route disposal: keep the last header throughout Suspense
    // and data loading until the next ready page publishes its controls.
    return () => {
      window.cancelAnimationFrame(frame);
      if (idle !== undefined) {
        window.cancelIdleCallback(idle);
      }
    };
  }, [register, ready, props]);
  return register ? null : <ProjectWingTopBar {...props} />;
}
