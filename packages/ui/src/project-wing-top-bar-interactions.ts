"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps, FocusEvent, RefObject } from "react";

const INTERACTION_EXIT_DELAY_MS = 120;
const SEARCH_HOVER_DELAY_MS = 80;

export type TopBarSide = "leading" | "actions";

export function shouldKeepTopBarSearchExpanded({
  hasQuery,
  hasResultsOpen,
}: {
  hasQuery: boolean;
  hasResultsOpen: boolean;
}) {
  return hasQuery || hasResultsOpen;
}

function searchIsLocked(center: HTMLElement | null) {
  const search = center?.querySelector<HTMLElement>("[data-top-bar-search]");
  const input = search?.querySelector<HTMLInputElement>("input");
  if (search?.contains(search.ownerDocument.activeElement)) {
    return true;
  }
  return shouldKeepTopBarSearchExpanded({
    hasQuery: Boolean(input?.value.trim()),
    hasResultsOpen: search?.dataset.open === "true",
  });
}

function findCenter(headerRef: RefObject<HTMLElement | null>) {
  return (
    headerRef.current?.querySelector<HTMLElement>(
      ".project-wing-top-bar-center"
    ) ?? null
  );
}

export function useSearchInteraction(
  headerRef: RefObject<HTMLElement | null>
): { engaged: boolean; regionProps: ComponentProps<"div"> } {
  const timer = useRef<number | null>(null);
  const [engaged, setEngaged] = useState(false);
  const clearTimer = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
    }
  }, []);
  useEffect(
    () => () => {
      clearTimer();
    },
    [clearTimer]
  );
  const release = () => {
    clearTimer();
    timer.current = window.setTimeout(() => {
      if (!searchIsLocked(findCenter(headerRef))) {
        setEngaged(false);
      }
    }, INTERACTION_EXIT_DELAY_MS);
  };
  return {
    engaged,
    regionProps: {
      onBlur: release,
      onFocus: () => setEngaged(true),
      onInput: () => {
        if (searchIsLocked(findCenter(headerRef))) {
          setEngaged(true);
        }
      },
      onMouseEnter: () => {
        clearTimer();
        timer.current = window.setTimeout(
          () => setEngaged(true),
          SEARCH_HOVER_DELAY_MS
        );
      },
      onMouseLeave: release,
    },
  };
}

export function useSideInteraction(identityOnly = false) {
  const timer = useRef<number | null>(null);
  const [engaged, setEngaged] = useState<TopBarSide | null>(null);
  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
      }
    },
    []
  );
  const enter = (side: TopBarSide) => {
    if (timer.current) {
      window.clearTimeout(timer.current);
    }
    setEngaged(side);
  };
  const release = (side: TopBarSide) => {
    if (timer.current) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(
      () => setEngaged((current) => (current === side ? null : current)),
      INTERACTION_EXIT_DELAY_MS
    );
  };
  const propsFor = (side: TopBarSide): ComponentProps<"div"> => ({
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        release(side);
      }
    },
    onFocus: (event) => {
      if (
        !identityOnly ||
        side !== "leading" ||
        (event.target as HTMLElement).closest(
          '[data-slot="constrained-top-bar-identity"]'
        )
      ) {
        enter(side);
      } else {
        release(side);
      }
    },
    onMouseOver: (event) => {
      if (
        !identityOnly ||
        side !== "leading" ||
        (event.target as HTMLElement).closest(
          '[data-slot="constrained-top-bar-identity"]'
        )
      ) {
        enter(side);
      } else {
        release(side);
      }
    },
    onMouseLeave: () => release(side),
  });
  return { engaged, propsFor };
}
