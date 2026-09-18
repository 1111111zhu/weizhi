"use client";

import * as React from "react";

import type { TextPreviewSearchResult } from "@/lib/text-preview-search";

type TextSearchContentProps = {
  activeResult: TextPreviewSearchResult | null;
  className?: string;
  results: TextPreviewSearchResult[];
  text: string;
};

export function TextSearchContent({
  activeResult,
  className,
  results,
  text,
}: TextSearchContentProps) {
  const activeMatchRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!activeResult) {
      return;
    }

    activeMatchRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeResult]);

  let cursor = 0;
  const content: React.ReactNode[] = [];
  results.forEach((result, index) => {
    const prefix = text.slice(cursor, result.start);
    const match = text.slice(result.start, result.end);
    cursor = result.end;
    const isActive =
      activeResult?.start === result.start && activeResult.end === result.end;

    if (prefix) {
      content.push(
        <React.Fragment key={`text-${result.start}`}>{prefix}</React.Fragment>
      );
    }
    content.push(
      <mark
        key={`match-${result.start}-${result.end}`}
        ref={isActive ? activeMatchRef : undefined}
        className="bg-warning text-warning-foreground underline decoration-2 underline-offset-2"
        data-search-result-index={index}
      >
        {match}
      </mark>
    );
  });

  if (cursor < text.length) {
    content.push(text.slice(cursor));
  }

  return className ? (
    <span className={className}>{content.length > 0 ? content : text}</span>
  ) : content.length > 0 ? (
    content
  ) : (
    text
  );
}
