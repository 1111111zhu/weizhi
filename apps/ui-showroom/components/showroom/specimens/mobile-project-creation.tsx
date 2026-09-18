"use client";

import { MobilePageHeader, MobileScaffold } from "@project-wing/ui";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { ProjectCreationComposition } from "./guided-form-specimen";
import { useMobilePreferences } from "./mobile-appearance";
import {
  mobileCreationHash,
  parseMobileCreationStage,
  pushMobileCreationStage,
} from "./mobile-project-creation-model";
import type { MobileCreationStage } from "./mobile-project-creation-model";
import { advanceMobileTrail } from "./mobile-workspace-model";
import { useMobileStoredState } from "./mobile-workspace-state";

const readHash = () => window.location.hash;
const serverHash = () => "";
function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
}

/** Reuses the existing creation composition; no production creation API is called. */
export function MobileProjectCreation() {
  const state = useMobileStoredState();
  useMobilePreferences(state.preferences);
  const stage = parseMobileCreationStage(
    useSyncExternalStore(subscribe, readHash, serverHash)
  );
  const trail = useRef<{ entries: string[]; index: number }>({
    entries: [],
    index: 0,
  });
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    trail.current = advanceMobileTrail(
      trail.current,
      mobileCreationHash(stage),
      mobileCreationHash(parseMobileCreationStage(window.location.hash))
    );
    if (content.current) {
      content.current.scrollTop = 0;
    }
  }, [stage]);
  const navigate = (next: MobileCreationStage) => {
    trail.current = pushMobileCreationStage(trail.current, next);
    window.location.hash = mobileCreationHash(next);
  };
  const back = () => {
    if (trail.current.index > 0) {
      window.history.back();
    } else {
      window.location.replace(
        mobileCreationHash(stage === "review" ? "setup" : "source")
      );
    }
  };
  return (
    <MobileScaffold
      label="新建项目"
      density="compact"
      contentRef={content}
      header={
        <MobilePageHeader
          title={stage === "business" ? "选择业务" : "新建项目"}
          back={{
            label: stage === "source" ? "返回项目" : "返回上一步",
            href:
              stage === "source"
                ? "/specimens/MobileWorkspace#projects"
                : mobileCreationHash(stage === "review" ? "setup" : "source"),
            onBack: stage === "source" ? undefined : back,
          }}
        />
      }
    >
      <ProjectCreationComposition
        mobile
        mobileStage={stage}
        onMobileStageChange={navigate}
        onMobileBack={back}
      />
    </MobileScaffold>
  );
}
