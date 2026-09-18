"use client";

import type {
  ConfirmationStatus,
  ConfirmationType,
} from "@project-wing/shared";
import { ChevronRight, RefreshCw, X } from "lucide-react";
import * as React from "react";

import { SplitterRail } from "@/components/splitter-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { ProjectConfirmation } from "../../api/client";
import type { Dictionary } from "../../i18n/dictionaries";

const EMPTY_DEFAULT_ARRAY: never[] = [];

const DAY_MS = 24 * 60 * 60 * 1000;
const DETAIL_DEFAULT_WIDTH = 640;
const DETAIL_MAX_WIDTH = 900;
const DETAIL_MIN_WIDTH = 420;
const MAIN_MIN_WIDTH = 520;
const BAR_HEIGHT_CLASSES = [
  "h-1",
  "h-4",
  "h-8",
  "h-12",
  "h-16",
  "h-20",
  "h-24",
  "h-28",
  "h-32",
  "h-36",
  "h-40",
] as const;
const PROGRESS_STAGES: {
  status: Exclude<ConfirmationStatus, "VOIDED">;
  labelKey: keyof Dictionary["confirmations"]["overview"]["stages"];
}[] = [
  { status: "DRAFT", labelKey: "draft" },
  { status: "PREPARED", labelKey: "prepared" },
  { status: "AWAITING_RESPONSE", labelKey: "sent" },
  { status: "RESPONSE_RECEIVED", labelKey: "received" },
  { status: "CLOSED", labelKey: "completed" },
];
const CATEGORY_ROWS: {
  type: ConfirmationType;
  labelKey: keyof Dictionary["confirmations"]["register"];
}[] = [
  { type: "BANK", labelKey: "bank" },
  { type: "INTERMEDIARY", labelKey: "otherFinancialInstitution" },
  { type: "BALANCE", labelKey: "thirdParty" },
  { type: "RELATED_PARTY", labelKey: "relatedParty" },
  { type: "LAWYER", labelKey: "lawyer" },
  { type: "INVENTORY", labelKey: "inventory" },
  { type: "OTHER", labelKey: "miscellaneous" },
];
const AGE_BUCKETS = [
  { id: "0-3", min: 0, max: 3, labelKey: "days0To3" },
  { id: "4-7", min: 4, max: 7, labelKey: "days4To7" },
  { id: "8-14", min: 8, max: 14, labelKey: "days8To14" },
  { id: "15-21", min: 15, max: 21, labelKey: "days15To21" },
  { id: "22-30", min: 22, max: 30, labelKey: "days22To30" },
  { id: "31-45", min: 31, max: 45, labelKey: "days31To45" },
  { id: "46-60", min: 46, max: 60, labelKey: "days46To60" },
  {
    id: "61-plus",
    min: 61,
    max: Number.POSITIVE_INFINITY,
    labelKey: "days61Plus",
  },
] as const;

export type AwaitingConfirmation = {
  confirmation: ProjectConfirmation;
  sentAt: string | null;
  waitingDays: number | null;
};

type DetailSelection =
  | { kind: "status"; status: ConfirmationStatus; title: string }
  | { kind: "type"; type: ConfirmationType; title: string }
  | {
      kind: "age";
      bucketId: (typeof AGE_BUCKETS)[number]["id"] | "unknown";
      title: string;
    };

type ConfirmationStatusOverviewProps = {
  confirmations: ProjectConfirmation[];
  copy: Dictionary["confirmations"];
  locale: string;
  isRefreshing?: boolean;
  onRefresh: () => void;
  onConfirmationSelect: (confirmation: ProjectConfirmation) => void;
};

export function ConfirmationStatusOverview({
  confirmations,
  copy,
  locale,
  isRefreshing = false,
  onRefresh,
  onConfirmationSelect,
}: ConfirmationStatusOverviewProps) {
  const mainRef = React.useRef<HTMLDivElement>(null);
  const [selection, setSelection] = React.useState<DetailSelection | null>(
    null
  );
  const [mainWidth, setMainWidth] = React.useState(0);
  const statusCounts = countBy(confirmations, (item) => item.status);
  const typeCounts = countBy(confirmations, (item) => item.type);
  const awaiting = confirmations
    .filter((confirmation) => confirmation.status === "AWAITING_RESPONSE")
    .map(toAwaitingConfirmation);
  const ageBuckets = AGE_BUCKETS.map((bucket) => ({
    ...bucket,
    label: copy.overview.ageBuckets[bucket.labelKey],
    confirmations: awaiting.filter(
      ({ waitingDays }) =>
        waitingDays !== null &&
        waitingDays >= bucket.min &&
        waitingDays <= bucket.max
    ),
  }));
  const unknownAge = awaiting.filter(({ waitingDays }) => waitingDays === null);
  const maxAgeCount = Math.max(
    1,
    ...ageBuckets.map((bucket) => bucket.confirmations.length),
    unknownAge.length
  );
  const maxTypeCount = Math.max(
    1,
    ...CATEGORY_ROWS.map(({ type }) => typeCounts.get(type) ?? 0)
  );
  const detailRows = getDetailRows(selection, confirmations, awaiting);

  React.useEffect(() => {
    const main = mainRef.current;
    if (!main || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setMainWidth(entry?.contentRect.width ?? 0);
    });
    observer.observe(main);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      aria-labelledby="confirmation-overview-title"
      className="relative flex h-full min-h-0 min-w-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div ref={mainRef} className="min-w-0 flex-1 overflow-auto">
        <header className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2
              id="confirmation-overview-title"
              className="truncate text-lg font-semibold tracking-tight"
            >
              {copy.overview.title}
            </h2>
            {(statusCounts.get("VOIDED") ?? 0) > 0 ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs text-muted-foreground tabular-nums"
                onClick={() =>
                  setSelection({
                    kind: "status",
                    status: "VOIDED",
                    title: copy.overview.voided.replace(
                      "{count}",
                      String(statusCounts.get("VOIDED") ?? 0)
                    ),
                  })
                }
              >
                {copy.overview.voided.replace(
                  "{count}",
                  String(statusCounts.get("VOIDED") ?? 0)
                )}
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={copy.overview.refresh}
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
          </Button>
        </header>

        <Separator />

        <section className="p-5">
          <h3 className="mb-4 font-semibold">{copy.overview.progress}</h3>
          <div className="overflow-x-auto pb-1">
            <div
              className="grid min-w-[42rem] grid-cols-5 gap-1 overflow-hidden"
              aria-label={copy.overview.chartLabel}
            >
              {PROGRESS_STAGES.map((stage, index) => {
                const count = statusCounts.get(stage.status) ?? 0;
                const selected =
                  selection?.kind === "status" &&
                  selection.status === stage.status;
                return (
                  <Button
                    type="button"
                    variant="ghost"
                    key={stage.status}
                    aria-label={`${copy.overview.stages[stage.labelKey]} ${count}`}
                    onClick={() =>
                      setSelection({
                        kind: "status",
                        status: stage.status,
                        title: copy.overview.stages[stage.labelKey],
                      })
                    }
                    className={cn(
                      "h-24 min-w-0 flex-col gap-1 rounded-none px-5 text-card-foreground hover:opacity-90",
                      "[clip-path:polygon(0_0,calc(100%-1rem)_0,100%_50%,calc(100%-1rem)_100%,0_100%,1rem_50%)]",
                      index === 0 &&
                        "[clip-path:polygon(0_0,calc(100%-1rem)_0,100%_50%,calc(100%-1rem)_100%,0_100%)]",
                      selected
                        ? "bg-primary text-primary-foreground shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--primary-foreground)_55%,transparent)] hover:bg-primary"
                        : count > 0
                          ? "bg-primary/65 text-primary-foreground hover:bg-primary/75"
                          : "bg-muted text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span className="truncate text-sm font-medium">
                      {copy.overview.stages[stage.labelKey]}
                    </span>
                    <span className="font-mono text-2xl font-semibold tabular-nums">
                      {count}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </section>

        <Separator />

        <div
          className={cn(
            "grid min-h-0",
            mainWidth >= 800 ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          <section className="min-w-0 border-b border-border p-5">
            <h3 className="mb-4 font-semibold">{copy.overview.byType}</h3>
            <div className="grid gap-3">
              {CATEGORY_ROWS.map(({ type, labelKey }) => {
                const count = typeCounts.get(type) ?? 0;
                const label = copy.register[labelKey] as string;
                const selected =
                  selection?.kind === "type" && selection.type === type;
                return (
                  <Button
                    type="button"
                    variant="ghost"
                    key={type}
                    aria-label={`${label} ${count}`}
                    className="grid h-auto w-full grid-cols-[minmax(6.5rem,8rem)_minmax(6rem,1fr)_2rem] items-center gap-3 rounded-md px-2 py-1 text-left"
                    onClick={() =>
                      setSelection({ kind: "type", type, title: label })
                    }
                  >
                    <span className="truncate text-sm text-muted-foreground">
                      {label}
                    </span>
                    <progress
                      value={count}
                      max={maxTypeCount}
                      className={cn(
                        "h-2 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full",
                        selected
                          ? "[&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                          : "[&::-webkit-progress-value]:bg-primary/60 [&::-moz-progress-bar]:bg-primary/60"
                      )}
                    />
                    <span className="text-right font-mono text-sm tabular-nums">
                      {count}
                    </span>
                  </Button>
                );
              })}
            </div>
          </section>

          <section className="min-w-0 border-b border-border p-5">
            <h3 className="font-semibold">{copy.overview.awaitingAge}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.overview.awaitingAgeDescription}
            </p>
            {awaiting.length > 0 ? (
              <div className="mt-5 overflow-x-auto pb-1">
                <div className="grid min-w-[44rem] grid-cols-8 gap-2">
                  {ageBuckets.map((bucket) => {
                    const count = bucket.confirmations.length;
                    const selected =
                      selection?.kind === "age" &&
                      selection.bucketId === bucket.id;
                    return (
                      <Button
                        type="button"
                        variant="ghost"
                        key={bucket.id}
                        aria-label={`${bucket.label} ${count}`}
                        className="group grid h-52 grid-rows-[1fr_auto] gap-2 rounded-md px-1 pt-2"
                        onClick={() =>
                          setSelection({
                            kind: "age",
                            bucketId: bucket.id,
                            title: bucket.label,
                          })
                        }
                      >
                        <span className="flex min-h-0 flex-col items-center justify-end">
                          <span className="mb-1 font-mono text-xs text-muted-foreground tabular-nums">
                            {count}
                          </span>
                          <span
                            className={cn(
                              "block w-8 rounded-t-sm transition-[height,background-color]",
                              getBarHeightClass(count, maxAgeCount),
                              selected
                                ? "bg-primary"
                                : "bg-primary/60 group-hover:bg-primary/75"
                            )}
                          />
                        </span>
                        <span className="text-center text-[0.6875rem] whitespace-nowrap text-muted-foreground">
                          {bucket.label}
                        </span>
                      </Button>
                    );
                  })}
                </div>
                {unknownAge.length > 0 ? (
                  <Button
                    type="button"
                    variant="link"
                    className="mt-2 h-auto px-1 text-xs text-muted-foreground"
                    onClick={() =>
                      setSelection({
                        kind: "age",
                        bucketId: "unknown",
                        title: copy.overview.sentAtMissing,
                      })
                    }
                  >
                    {copy.overview.unknownDates.replace(
                      "{count}",
                      String(unknownAge.length)
                    )}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 grid min-h-52 place-items-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
                {copy.overview.awaitingAgeEmpty}
              </div>
            )}
          </section>
        </div>
      </div>

      {selection ? (
        <ConfirmationDetailPane
          key={`${selection.kind}:${selection.title}`}
          title={selection.title}
          confirmations={detailRows}
          awaiting={awaiting}
          copy={copy}
          locale={locale}
          mode={selection.kind === "age" ? "age" : "summary"}
          onClose={() => setSelection(null)}
          onOpen={onConfirmationSelect}
        />
      ) : null}
    </section>
  );
}

export function ConfirmationDetailPane({
  title,
  confirmations,
  awaiting = EMPTY_DEFAULT_ARRAY,
  copy,
  locale,
  mode = "summary",
  minWidth = DETAIL_MIN_WIDTH,
  defaultWidth = DETAIL_DEFAULT_WIDTH,
  maxWidth = DETAIL_MAX_WIDTH,
  mainMinWidth = MAIN_MIN_WIDTH,
  isLoading = false,
  onClose,
  onOpen,
}: {
  title: string;
  confirmations: ProjectConfirmation[];
  awaiting?: AwaitingConfirmation[];
  copy: Dictionary["confirmations"];
  locale: string;
  mode?: "age" | "summary";
  minWidth?: number;
  defaultWidth?: number;
  maxWidth?: number;
  mainMinWidth?: number;
  isLoading?: boolean;
  onClose: () => void;
  onOpen: (confirmation: ProjectConfirmation) => void;
}) {
  const detailRef = React.useRef<HTMLElement>(null);
  const closeCompletedRef = React.useRef(false);
  const completeClose = React.useCallback(() => {
    if (!closeCompletedRef.current) {
      closeCompletedRef.current = true;
      onClose();
    }
  }, [onClose]);
  const [isClosing, setIsClosing] = React.useState(false);
  const closeDetail = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      completeClose();
    } else {
      setIsClosing(true);
    }
  };
  React.useEffect(() => {
    if (!isClosing) {
      return;
    }
    // Complete even if the browser cancels the closing animation.
    const duration = Number.parseFloat(
      window.getComputedStyle(detailRef.current!).animationDuration
    );
    const timer = window.setTimeout(completeClose, (duration || 0.18) * 1000 + 50);
    return () => window.clearTimeout(timer);
  }, [isClosing, completeClose]);
  const resizeSessionRef = React.useRef<{
    startWidth: number;
    availableMaxWidth: number;
  } | null>(null);
  const [detailWidth, setDetailWidth] = React.useState(() =>
    Math.max(minWidth, Math.min(maxWidth, defaultWidth))
  );
  const [availableMaxWidth, setAvailableMaxWidth] = React.useState(maxWidth);

  React.useLayoutEffect(() => {
    detailRef.current?.style.setProperty("width", `${detailWidth}px`);
    detailRef.current?.style.setProperty("min-width", `${minWidth}px`);
  }, [detailWidth, minWidth]);

  const getMaximumWidth = React.useCallback(() => {
    const containerWidth =
      detailRef.current?.parentElement?.getBoundingClientRect().width ??
      window.innerWidth;
    return Math.max(
      minWidth,
      Math.min(maxWidth, containerWidth - mainMinWidth)
    );
  }, [mainMinWidth, maxWidth, minWidth]);

  React.useLayoutEffect(() => {
    const detail = detailRef.current;
    if (!detail) {
      return;
    }
    const resize = () => {
      const nextMaxWidth = getMaximumWidth();
      setAvailableMaxWidth(nextMaxWidth);
      setDetailWidth((current) => clamp(current, minWidth, nextMaxWidth));
    };
    resize();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(resize);
    if (detail.parentElement) {
      observer.observe(detail.parentElement);
    }
    return () => observer.disconnect();
  }, [getMaximumWidth, minWidth]);

  const handleResizePointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    resizeSessionRef.current = {
      startWidth: detailWidth,
      availableMaxWidth: getMaximumWidth(),
    };
  };
  const handleResizeDrag = (deltaX: number) => {
    const session = resizeSessionRef.current;
    if (!session) {
      return;
    }
    setDetailWidth(
      clamp(session.startWidth - deltaX, minWidth, session.availableMaxWidth)
    );
  };
  const handleResizeCancel = () => {
    const session = resizeSessionRef.current;
    if (!session) {
      return;
    }
    setDetailWidth(session.startWidth);
    resizeSessionRef.current = null;
  };
  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const offset = event.key === "ArrowLeft" ? 16 : -16;
    setDetailWidth((current) =>
      clamp(current + offset, minWidth, getMaximumWidth())
    );
  };

  return (
    <aside
      ref={detailRef}
      aria-label={copy.overview.details.title.replace("{selection}", title)}
      className={`emp-splitter-panel relative shrink-0 border-l border-border bg-card${isClosing ? " emp-splitter-detail-closing" : ""}`}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && isClosing) {
          completeClose();
        }
      }}
    >
      <div
        role="presentation"
        className="absolute inset-y-0 -left-1.5 z-10 flex h-auto w-3 justify-center"
        onKeyDown={handleResizeKeyDown}
      >
        <SplitterRail
          expanded
          hitAreaTestId="confirmation-detail-resize-hit-area"
          label={copy.overview.details.resize}
          max={availableMaxWidth}
          min={minWidth}
          onDrag={handleResizeDrag}
          onDragCancel={handleResizeCancel}
          onPointerDown={handleResizePointerDown}
          onToggle={closeDetail}
          value={Math.round(detailWidth)}
        />
      </div>
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex min-h-14 items-center justify-between gap-4 px-5 py-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="truncate text-base font-semibold">
              {copy.overview.details.title.replace("{selection}", title)}
            </h3>
            <span className="shrink-0 text-sm whitespace-nowrap text-muted-foreground">
              {copy.overview.details.count.replace(
                "{count}",
                String(confirmations.length)
              )}
            </span>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={copy.overview.details.close}
            onClick={closeDetail}
          >
            <X />
          </Button>
        </header>
        <Separator />
        {isLoading ? (
          <div className="space-y-3 p-6" aria-busy="true">
            <Skeleton className="h-6 w-1/4 rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : (
          <ConfirmationDetailTable
            confirmations={confirmations}
            awaiting={awaiting}
            copy={copy}
            locale={locale}
            mode={mode}
            width={detailWidth}
            onOpen={onOpen}
          />
        )}
      </div>
    </aside>
  );
}

function ConfirmationDetailTable({
  confirmations,
  awaiting,
  copy,
  locale,
  mode,
  width,
  onOpen,
}: {
  confirmations: ProjectConfirmation[];
  awaiting: AwaitingConfirmation[];
  copy: Dictionary["confirmations"];
  locale: string;
  mode: "age" | "summary";
  width: number;
  onOpen: (confirmation: ProjectConfirmation) => void;
}) {
  const showType = width >= 540;
  const showCode = width >= 650;
  const showOwner = width >= 760;
  const waitingById = new Map(
    awaiting.map((item) => [item.confirmation.id, item])
  );
  const gridColumns = getDetailGridColumns({
    showCode,
    showOwner,
    showType,
  });

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div
        role="table"
        aria-label={copy.overview.details.table}
        className="min-w-0 text-sm"
      >
        <div
          role="row"
          className={cn(
            "grid items-center gap-2 border-b border-border bg-muted/50 px-4 py-2 font-medium text-foreground",
            gridColumns
          )}
        >
          {showCode ? (
            <span role="columnheader">{copy.register.columns.code}</span>
          ) : null}
          <span role="columnheader">{copy.register.columns.counterparty}</span>
          {showType ? (
            <span role="columnheader">{copy.register.columns.type}</span>
          ) : null}
          {showOwner ? (
            <span role="columnheader">{copy.register.columns.owner}</span>
          ) : null}
          <span role="columnheader">
            {mode === "age"
              ? copy.overview.details.sentAt
              : copy.register.columns.progress}
          </span>
          <span role="columnheader">
            {mode === "age"
              ? copy.overview.details.waitingTime
              : copy.register.columns.updatedAt}
          </span>
          <span role="columnheader">{copy.register.columns.actions}</span>
        </div>
        {confirmations.map((confirmation) => {
          const waiting = waitingById.get(confirmation.id);
          const confirmationCode = confirmation.confirmationCode ?? "—";
          const ownerName =
            confirmation.responsibleUser?.name ?? copy.register.ownerPending;
          return (
            <div
              role="row"
              key={confirmation.id}
              className={cn(
                "grid items-center gap-2 border-b border-border px-4 py-2.5 hover:bg-muted/50",
                gridColumns
              )}
            >
              {showCode ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        role="cell"
                        className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                      />
                    }
                  >
                    {confirmationCode}
                  </TooltipTrigger>
                  <TooltipContent>{confirmationCode}</TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      role="cell"
                      className="min-w-0 truncate font-medium"
                    />
                  }
                >
                  {confirmation.counterpartyName}
                </TooltipTrigger>
                <TooltipContent>{confirmation.counterpartyName}</TooltipContent>
              </Tooltip>
              {showType ? (
                <span role="cell" className="min-w-0">
                  <Badge variant="secondary" className="max-w-full truncate">
                    {getTypeLabel(copy, confirmation.type)}
                  </Badge>
                </span>
              ) : null}
              {showOwner ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        role="cell"
                        className="min-w-0 truncate text-muted-foreground"
                      />
                    }
                  >
                    {ownerName}
                  </TooltipTrigger>
                  <TooltipContent>{ownerName}</TooltipContent>
                </Tooltip>
              ) : null}
              <span
                role="cell"
                className="whitespace-nowrap text-muted-foreground tabular-nums"
              >
                {mode === "age"
                  ? formatDate(waiting?.sentAt ?? null, locale)
                  : getStatusLabel(copy, confirmation.status)}
              </span>
              <span
                role="cell"
                className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums"
              >
                {mode === "age"
                  ? waiting?.waitingDays === null ||
                    waiting?.waitingDays === undefined
                    ? copy.overview.sentAtMissing
                    : copy.overview.days.replace(
                        "{count}",
                        String(waiting.waitingDays)
                      )
                  : formatDate(confirmation.updatedAt, locale)}
              </span>
              <span role="cell">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`${copy.register.open}: ${confirmation.counterpartyName}`}
                  onClick={() => onOpen(confirmation)}
                >
                  <ChevronRight />
                </Button>
              </span>
            </div>
          );
        })}
        {confirmations.length > 0 ? null : (
          <div className="grid min-h-48 place-items-center px-6 text-center text-sm text-muted-foreground">
            {copy.overview.details.empty}
          </div>
        )}
      </div>
    </div>
  );
}

function getDetailRows(
  selection: DetailSelection | null,
  confirmations: ProjectConfirmation[],
  awaiting: AwaitingConfirmation[]
) {
  if (!selection) {
    return [];
  }
  if (selection.kind === "status") {
    return confirmations.filter((item) => item.status === selection.status);
  }
  if (selection.kind === "type") {
    return confirmations.filter((item) => item.type === selection.type);
  }
  if (selection.bucketId === "unknown") {
    return awaiting
      .filter((item) => item.waitingDays === null)
      .map((item) => item.confirmation);
  }
  const bucket = AGE_BUCKETS.find((item) => item.id === selection.bucketId);
  if (!bucket) {
    return [];
  }
  return awaiting
    .filter(
      ({ waitingDays }) =>
        waitingDays !== null &&
        waitingDays >= bucket.min &&
        waitingDays <= bucket.max
    )
    .sort((left, right) => (right.waitingDays ?? 0) - (left.waitingDays ?? 0))
    .map((item) => item.confirmation);
}

function toAwaitingConfirmation(
  confirmation: ProjectConfirmation
): AwaitingConfirmation {
  const [dispatch] = [...(confirmation.dispatches ?? [])].sort(
    (left, right) => right.sequence - left.sequence
  );
  const sentAt = dispatch?.sentAt ?? dispatch?.createdAt ?? null;
  const timestamp = sentAt ? new Date(sentAt).getTime() : Number.NaN;
  return {
    confirmation,
    sentAt,
    waitingDays: Number.isFinite(timestamp)
      ? Math.max(0, Math.floor((Date.now() - timestamp) / DAY_MS))
      : null,
  };
}

function getTypeLabel(
  copy: Dictionary["confirmations"],
  type: ConfirmationType
) {
  const row = CATEGORY_ROWS.find((item) => item.type === type);
  return row ? (copy.register[row.labelKey] as string) : type;
}

function getStatusLabel(
  copy: Dictionary["confirmations"],
  status: ConfirmationStatus
) {
  if (status === "VOIDED") {
    return copy.overview.voided.replace("{count}", "1");
  }
  const stage = PROGRESS_STAGES.find((item) => item.status === status);
  return stage ? copy.overview.stages[stage.labelKey] : status;
}

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(locale).format(date);
}

function countBy<T, K>(items: T[], keyFor: (item: T) => K) {
  const counts = new Map<K, number>();
  items.forEach((item) => {
    const key = keyFor(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBarHeightClass(count: number, max: number) {
  if (count <= 0) {
    return BAR_HEIGHT_CLASSES[0];
  }
  const index = Math.max(
    1,
    Math.min(
      BAR_HEIGHT_CLASSES.length - 1,
      Math.ceil((count / max) * (BAR_HEIGHT_CLASSES.length - 1))
    )
  );
  return BAR_HEIGHT_CLASSES[index];
}

function getDetailGridColumns({
  showCode,
  showOwner,
  showType,
}: {
  showCode: boolean;
  showOwner: boolean;
  showType: boolean;
}) {
  if (showOwner) {
    return "grid-cols-[minmax(8rem,1.1fr)_minmax(8.5rem,1.5fr)_minmax(5rem,.7fr)_minmax(5.5rem,.75fr)_6.5rem_5.25rem_2.5rem]";
  }
  if (showCode) {
    return "grid-cols-[minmax(8rem,1.1fr)_minmax(8.5rem,1.5fr)_minmax(5rem,.7fr)_6.5rem_5.25rem_2.5rem]";
  }
  if (showType) {
    return "grid-cols-[minmax(8.5rem,1.5fr)_minmax(5rem,.7fr)_6.5rem_5.25rem_2.5rem]";
  }
  return "grid-cols-[minmax(8.5rem,1fr)_6.5rem_5.25rem_2.5rem]";
}
