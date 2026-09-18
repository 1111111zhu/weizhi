"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DocsTocDropdown, DocsTocList } from "@/components/docs-toc-content";
import type { TocItem } from "@/components/docs-toc-content";
import { useFeedback } from "@/hooks/use-feedback";

const headingById = (id: string): Element | null =>
  document.querySelector(`#${CSS.escape(id)}`);

const useActiveItem = (itemIds: string[]) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0% 0% -80% 0%" }
    );

    for (const id of itemIds ?? []) {
      if (!id) {
        continue;
      }
      const element = headingById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => {
      for (const id of itemIds ?? []) {
        if (!id) {
          continue;
        }
        const element = headingById(id);
        if (element) {
          observer.unobserve(element);
        }
      }
    };
  }, [itemIds]);

  return activeId;
};

export const DocsTableOfContents = ({
  toc,
  variant = "list",
  className,
}: {
  toc: TocItem[];
  variant?: "dropdown" | "list";
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);
  const itemIds = useMemo(
    () => toc.map((item) => item.url.replace("#", "")),
    [toc]
  );
  const activeHeading = useActiveItem(itemIds);
  const playTick = useFeedback({ sound: "tick" });

  if (!toc?.length) {
    return null;
  }

  return variant === "dropdown" ? (
    <DocsTocDropdown
      toc={toc}
      open={open}
      setOpen={setOpen}
      handleClose={handleClose}
      className={className}
    />
  ) : (
    <DocsTocList
      toc={toc}
      activeHeading={activeHeading}
      playTick={playTick}
      className={className}
    />
  );
};
