"use client";

import { CircleAlert, FolderOpen, LoaderCircle, SearchX } from "lucide-react";

import { Button } from "./button";
import { cn } from "./utils";

export type CollectionStateProps = {
  kind: "loading" | "error" | "empty" | "filtered";
  locale?: "zh-CN" | "en-US";
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  onRetry?: () => void;
  className?: string;
};

const copy = {
  "zh-CN": {
    loading: ["正在加载…", ""],
    error: ["暂时无法加载", "请重试；若问题持续，请稍后再试。"],
    empty: ["暂无内容", ""],
    filtered: ["没有匹配结果", "请调整搜索词或筛选条件。"],
  },
  "en-US": {
    loading: ["Loading…", ""],
    error: [
      "Unable to load",
      "Try again. If the problem continues, try again later.",
    ],
    empty: ["No items yet", ""],
    filtered: ["No matching results", "Try changing your search or filters."],
  },
} as const;
const icons = {
  loading: LoaderCircle,
  error: CircleAlert,
  empty: FolderOpen,
  filtered: SearchX,
};

/** A list's state, not a decorative card or a replacement for its toolbar. */
export function CollectionState({
  kind,
  locale = "en-US",
  title,
  description,
  action,
  onRetry,
  className,
}: CollectionStateProps) {
  const Icon = icons[kind];
  const text = copy[locale][kind];
  const resolvedAction =
    action ??
    (kind === "error" && onRetry
      ? { label: locale === "zh-CN" ? "重试" : "Retry", onClick: onRetry }
      : undefined);
  const handleAction = resolvedAction?.onClick;
  return (
    <div
      data-slot="collection-state"
      data-state={kind}
      className={cn(
        "flex min-h-48 h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center",
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-6 text-muted-foreground",
          kind === "loading" && "animate-spin motion-reduce:animate-none",
          kind === "error" && "text-destructive-accent"
        )}
      />
      <div
        className="max-w-sm space-y-1"
        role={kind === "error" ? "alert" : "status"}
      >
        <p className="text-foreground text-sm font-medium">
          {title ?? text[0]}
        </p>
        {(description ?? text[1]) ? (
          <p className="text-muted-foreground text-sm leading-6">
            {description ?? text[1]}
          </p>
        ) : null}
      </div>
      {resolvedAction && kind !== "loading" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAction}
          disabled={resolvedAction.disabled}
        >
          {resolvedAction.label}
        </Button>
      ) : null}
    </div>
  );
}
