"use client";

import { useEffectEvent, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import type { GroupImperativeHandle } from "react-resizable-panels";

import {
  compactWorkbenchLayout,
  reconcileWorkbenchLayout,
} from "@/lib/workbench-compact-layout";
import type { WorkbenchPane } from "@/lib/workbench-compact-layout";

type WorkbenchLayout = {
  horizontal: Record<string, number>;
  vertical: Record<string, number>;
};

/** Adapt the existing groups without remounting file editors or discarding their local state. */
export function WorkbenchCompactController({
  compact,
  pane,
  tasksOpen,
  horizontal,
  vertical,
  element,
  onRestore,
}: {
  compact: boolean;
  pane: WorkbenchPane;
  tasksOpen: boolean;
  horizontal: RefObject<GroupImperativeHandle | null>;
  vertical: RefObject<GroupImperativeHandle | null>;
  element: RefObject<HTMLDivElement | null>;
  onRestore: (layout: WorkbenchLayout | null) => void;
}) {
  const saved = useRef<WorkbenchLayout | null>(null);
  const restore = useEffectEvent(onRestore);
  useLayoutEffect(() => {
    let frame = 0;
    const apply = () => {
      const row = horizontal.current;
      const column = vertical.current;
      if (!row || !column) {
        return;
      }
      if (compact) {
        saved.current ??= {
          horizontal: row.getLayout(),
          vertical: column.getLayout(),
        };
        const next = compactWorkbenchLayout(pane, tasksOpen);
        row.setLayout(next.horizontal);
        column.setLayout(next.vertical);
      } else if (saved.current) {
        row.setLayout(
          reconcileWorkbenchLayout(saved.current.horizontal, row.getLayout())
        );
        column.setLayout(
          reconcileWorkbenchLayout(saved.current.vertical, column.getLayout())
        );
        restore(saved.current);
        saved.current = null;
      } else {
        // A workspace can remount wide after navigating away while compact.
        restore(null);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    if (element.current) {
      observer.observe(element.current);
    }
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [compact, pane, tasksOpen, horizontal, vertical, element]);
  return null;
}
