/* eslint-disable react/hook-use-state -- the controlled/uncontrolled state pair follows Base UI's API. */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { SidebarContextProps } from "@/components/ui/sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

const useSidebarShortcut = (toggleSidebar: () => void) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);
};

export const useSidebarController = ({
  defaultOpen,
  openProp,
  setOpenProp,
}: {
  defaultOpen: boolean;
  openProp?: boolean;
  setOpenProp?: (open: boolean) => void;
}): SidebarContextProps => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);
  const [_open, _setOpen] = useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }
      // eslint-disable-next-line unicorn/no-document-cookie
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open]
  );
  const toggleSidebar = useCallback(
    () =>
      isMobile
        ? setOpenMobile((previous) => !previous)
        : setOpen((previous) => !previous),
    [isMobile, setOpen]
  );

  useSidebarShortcut(toggleSidebar);

  const state = open ? "expanded" : "collapsed";
  return useMemo(
    () => ({
      isMobile,
      open,
      openMobile,
      setOpen,
      setOpenMobile,
      state,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar]
  );
};
