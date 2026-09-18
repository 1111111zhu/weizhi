"use client";

import type { ConfirmationType } from "@project-wing/shared";
import {
  ProjectWingMasterDataGrid,
  Button as MobileButton,
  MobileActionSheet,
  SegmentedButtonGroup,
  ViewSwitcher,
  useCompactViewport,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getConfirmationOverviewMobileCopy } from "@/i18n/confirmation-overview-mobile";
import { cn } from "@/lib/utils";

import type { ProjectConfirmation } from "../../api/client";
import type { Dictionary } from "../../i18n/dictionaries";
import { ConfirmationMobileHeading } from "./confirmation-mobile-heading";
import type { ConfirmationSentAgeBucket } from "./confirmation-presentation";
import {
  getConfirmationRegisterRow,
  isUnclassifiedConfirmation,
} from "./confirmation-register-model";

import styles from "./confirmation-overview-matrix.module.css";
import mobileStyles from "./confirmation-overview-mobile.module.css";

type CategoryKey = "FINANCIAL" | "CORRESPONDENCE" | "OTHER";
export type ConfirmationMatrixColumn =
  | "DRAFT"
  | "PREPARED"
  | "SENT_0_7"
  | "SENT_8_14"
  | "SENT_15_21"
  | "SENT_22_30"
  | "SENT_31_45"
  | "SENT_46_PLUS"
  | "SENT_TOTAL"
  | "RECEIVED_PENDING"
  | "RECEIVED_MISMATCH"
  | "RECEIVED_TOTAL"
  | "PROCESSED"
  | "COMPLETED"
  | "TOTAL";

export type ConfirmationOverviewCellSelection = {
  navigation: "ALL";
  column: ConfirmationMatrixColumn;
  type?: ConfirmationType;
  category?: CategoryKey;
  unclassified?: boolean;
};

type OverviewCopy = Dictionary["confirmations"];
type MatrixMode = "COUNT" | "PERCENT";
type MatrixRowKind = "category" | "type" | "unclassified" | "total";
type MatrixRow = {
  category?: CategoryKey;
  counts: Record<ConfirmationMatrixColumn, number>;
  key: string;
  kind: MatrixRowKind;
  label: string;
  total: number;
  type?: ConfirmationType;
};
type MatrixMetric = {
  group: "preparation" | "sent" | "received" | "completion";
  id: ConfirmationMatrixColumn;
  label: string;
  tone?: "waiting" | "mismatch" | "complete";
};
type MatrixCellIntensity = "zero" | "low" | "medium" | "high";

const AGE_COLUMNS: {
  id:
    | "SENT_0_7"
    | "SENT_8_14"
    | "SENT_15_21"
    | "SENT_22_30"
    | "SENT_31_45"
    | "SENT_46_PLUS";
  bucket: Exclude<ConfirmationSentAgeBucket, "UNKNOWN">;
  labelKey:
    | "days0To7"
    | "days8To14"
    | "days15To21"
    | "days22To30"
    | "days31To45"
    | "days46Plus";
}[] = [
  { id: "SENT_0_7", bucket: "0_7", labelKey: "days0To7" },
  { id: "SENT_8_14", bucket: "8_14", labelKey: "days8To14" },
  { id: "SENT_15_21", bucket: "15_21", labelKey: "days15To21" },
  { id: "SENT_22_30", bucket: "22_30", labelKey: "days22To30" },
  { id: "SENT_31_45", bucket: "31_45", labelKey: "days31To45" },
  { id: "SENT_46_PLUS", bucket: "46_PLUS", labelKey: "days46Plus" },
];
const CATEGORY_TYPES: Record<CategoryKey, ConfirmationType[]> = {
  FINANCIAL: ["BANK", "INTERMEDIARY"],
  CORRESPONDENCE: ["BALANCE", "RELATED_PARTY"],
  OTHER: ["LAWYER", "INVENTORY", "OTHER"],
};

export const MATRIX_REVEAL_DURATION_CLASS = styles.revealDuration;
export const MATRIX_REVEAL_DURATION_MS = 180;
export const MATRIX_REDUCED_REVEAL_DURATION_CLASS =
  styles.reducedRevealDuration;
export const MATRIX_REDUCED_REVEAL_DURATION_MS = 80;
const DEFAULT_CONFIRMATION_OVERVIEW_NOW = new Date();

export function ConfirmationOverviewMatrix({
  confirmations,
  copy,
  locale,
  now = DEFAULT_CONFIRMATION_OVERVIEW_NOW,
  onCellSelect,
}: {
  confirmations: ProjectConfirmation[];
  copy: OverviewCopy;
  locale: string;
  now?: Date;
  onCellSelect: (selection: ConfirmationOverviewCellSelection) => void;
}) {
  const phone = useCompactViewport(767.98);
  const [mode, setMode] = useState<MatrixMode>("COUNT");
  const [sentExpanded, setSentExpanded] = useState(true);
  const [receivedExpanded, setReceivedExpanded] = useState(true);
  const activeConfirmations = useMemo(
    () => confirmations.filter((item) => item.status !== "VOIDED"),
    [confirmations]
  );
  const rows = useMemo(
    () => buildMatrixRows(activeConfirmations, copy, now),
    [activeConfirmations, copy, now]
  );
  const columns = useMemo<
    ProjectWingMasterDataGridProps<MatrixRow>["columns"]
  >(() => {
    const preparation: MatrixMetric[] = [
      {
        group: "preparation",
        id: "DRAFT",
        label: copy.overview.matrix.columns.draft,
      },
      {
        group: "preparation",
        id: "PREPARED",
        label: copy.overview.matrix.columns.prepared,
      },
    ];
    const sent: MatrixMetric[] = sentExpanded
      ? [
          ...AGE_COLUMNS.map((column) => ({
            group: "sent" as const,
            id: column.id,
            label: copy.overview.ageBuckets[column.labelKey],
          })),
          {
            group: "sent",
            id: "SENT_TOTAL",
            label: copy.overview.matrix.columns.sentSubtotal,
          } as const,
        ]
      : [
          {
            group: "sent",
            id: "SENT_TOTAL",
            label: copy.overview.matrix.columns.sentSubtotal,
          },
        ];
    const received: MatrixMetric[] = receivedExpanded
      ? [
          {
            group: "received",
            id: "RECEIVED_PENDING",
            label: copy.overview.matrix.columns.receivedPending,
            tone: "waiting",
          },
          {
            group: "received",
            id: "RECEIVED_MISMATCH",
            label: copy.overview.matrix.columns.receivedMismatch,
            tone: "mismatch",
          },
          {
            group: "received",
            id: "RECEIVED_TOTAL",
            label: copy.overview.matrix.columns.receivedSubtotal,
          },
        ]
      : [
          {
            group: "received",
            id: "RECEIVED_TOTAL",
            label: copy.overview.matrix.columns.receivedSubtotal,
          },
        ];
    const completion: MatrixMetric[] = [
      {
        group: "completion",
        id: "PROCESSED",
        label: copy.overview.matrix.columns.processed,
      },
      {
        group: "completion",
        id: "COMPLETED",
        label: copy.overview.matrix.columns.completed,
        tone: "complete",
      },
      {
        group: "completion",
        id: "TOTAL",
        label: copy.overview.matrix.columns.total,
      },
    ];
    const metricColumn = (metric: MatrixMetric) => ({
      accessorFn: (row: MatrixRow) => row.counts[metric.id],
      id: metric.id,
      header: () => (
        <div className="px-2 text-center text-xs font-normal whitespace-nowrap text-secondary-foreground/80">
          {metric.label}
        </div>
      ),
      cell: ({ row }: { row: { original: MatrixRow } }) => {
        const value = row.original.counts[metric.id];
        const display = formatValue(value, row.original.total, mode, locale);
        const intensity = getMatrixCellIntensity(value);
        return (
          <Button
            type="button"
            variant="ghost"
            aria-label={`${metric.label} ${row.original.label} ${display}`}
            className={matrixCellClass(
              intensity,
              metric.tone,
              row.original.kind
            )}
            data-matrix-cell="true"
            data-matrix-intensity={intensity}
            data-matrix-tone={metric.tone ?? "neutral"}
            onClick={() =>
              onCellSelect({
                navigation: "ALL",
                column: metric.id,
                type: row.original.type,
                category: row.original.category,
                unclassified: row.original.kind === "unclassified",
              })
            }
          >
            {display}
          </Button>
        );
      },
      enableSorting: false,
      meta: {
        cellClassName: "p-1 text-center",
        headerClassName: cn(
          "min-w-24 text-center",
          metric.group === "sent" && "bg-primary/[0.035]",
          metric.group === "received" && "bg-warning/[0.035]"
        ),
        headerTitle: metric.label,
      },
      minSize:
        metric.group === "sent" || metric.group === "received" ? 108 : 112,
      size: metric.group === "sent" || metric.group === "received" ? 116 : 124,
    });

    return [
      {
        id: "category-group",
        header: copy.register.columns.type,
        meta: {
          headerClassName:
            "sticky left-0 z-40 bg-muted text-center shadow-[inset_-1px_0_0_var(--border)]",
          headerTitle: copy.register.columns.type,
        },
        columns: [
          {
            accessorFn: (row) => row.label,
            id: "LABEL",
            header: () => (
              <div className="px-2 text-center text-xs font-normal whitespace-nowrap text-secondary-foreground/80">
                {copy.overview.matrix.columns.breakdown}
              </div>
            ),
            cell: ({ row }) => (
              <div
                className={cn(
                  "flex min-h-10 items-center px-4 py-2",
                  row.original.kind === "type" && "pl-9 text-muted-foreground",
                  row.original.kind === "category" && "font-semibold",
                  row.original.kind === "total" && "bg-muted/60 font-semibold"
                )}
              >
                {row.original.label}
              </div>
            ),
            enableSorting: false,
            meta: {
              cellClassName:
                "sticky left-0 z-20 bg-background p-0 shadow-[inset_-1px_0_0_var(--border)]",
              headerClassName:
                "sticky left-0 z-40 min-w-52 bg-muted shadow-[inset_-1px_0_0_var(--border)]",
              headerTitle: copy.overview.matrix.columns.breakdown,
            },
            minSize: 208,
            size: 224,
          },
        ],
      },
      {
        id: "preparation-group",
        header: copy.overview.matrix.groups.preparation,
        meta: {
          headerClassName: "bg-muted/80 text-center",
          headerTitle: copy.overview.matrix.groups.preparation,
        },
        columns: preparation.map(metricColumn),
      },
      {
        id: "sent-group",
        header: () => (
          <MatrixGroupToggle
            expanded={sentExpanded}
            label={copy.overview.matrix.columns.sent}
            testId="confirmation-matrix-sent-toggle"
            collapseLabel={copy.overview.matrix.collapseSent}
            expandLabel={copy.overview.matrix.expandSent}
            onToggle={() => setSentExpanded((current) => !current)}
          />
        ),
        meta: {
          headerClassName: "bg-primary/[0.08] p-1 text-center text-primary",
          headerTitle: copy.overview.matrix.columns.sent,
        },
        columns: sent.map(metricColumn),
      },
      {
        id: "received-group",
        header: () => (
          <MatrixGroupToggle
            expanded={receivedExpanded}
            label={copy.overview.matrix.columns.received}
            testId="confirmation-matrix-received-toggle"
            collapseLabel={copy.overview.matrix.collapseReceived}
            expandLabel={copy.overview.matrix.expandReceived}
            onToggle={() => setReceivedExpanded((current) => !current)}
          />
        ),
        meta: {
          headerClassName: "bg-warning/[0.08] p-1 text-center text-warning",
          headerTitle: copy.overview.matrix.columns.received,
        },
        columns: received.map(metricColumn),
      },
      {
        id: "completion-group",
        header: copy.overview.matrix.groups.completion,
        meta: {
          headerClassName: "bg-muted/80 text-center",
          headerTitle: copy.overview.matrix.groups.completion,
        },
        columns: completion.map(metricColumn),
      },
    ];
  }, [copy, locale, mode, onCellSelect, receivedExpanded, sentExpanded]);
  const widthClass = sentExpanded
    ? receivedExpanded
      ? "min-w-[118rem]"
      : "min-w-[94rem]"
    : receivedExpanded
      ? "min-w-[76rem]"
      : "w-full min-w-full";
  const groupsCollapsed = !sentExpanded && !receivedExpanded;

  if (phone) {
    return (
      <MobileConfirmationOverview
        rows={rows}
        copy={copy}
        locale={locale}
        mode={mode}
        onModeChange={setMode}
        onCellSelect={onCellSelect}
      />
    );
  }

  return (
    <section
      aria-label={copy.overview.title}
      className="h-full min-h-0 min-w-0 [&_[data-slot=data-grid-table-viewport]]:h-full [&_[data-slot=scroll-area-content]]:h-full"
    >
      <ProjectWingMasterDataGrid
        actions={
          <div className="flex items-center gap-2">
            <MatrixLegend copy={copy} />
            <Tabs
              className="block gap-0"
              value={mode}
              onValueChange={(value) => {
                if (value === "COUNT" || value === "PERCENT") {
                  setMode(value);
                }
              }}
            >
              <TabsList
                aria-label={`${copy.overview.matrix.countMode} / ${copy.overview.matrix.percentMode}`}
                data-confirmation-mode={mode}
                data-testid="confirmation-matrix-mode-toggle"
                className="grid h-8 w-28 grid-cols-2 rounded-full border border-border bg-muted/50 p-0.5"
              >
                <TabsTrigger
                  value="COUNT"
                  className="justify-center rounded-full text-xs after:hidden data-active:bg-primary data-active:text-primary-foreground"
                >
                  {copy.overview.matrix.countMode}
                </TabsTrigger>
                <TabsTrigger
                  value="PERCENT"
                  className="justify-center rounded-full text-xs after:hidden data-active:bg-primary data-active:text-primary-foreground"
                >
                  {copy.overview.matrix.percentMode}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
        columns={columns}
        data={rows}
        emptyMessage={copy.overview.empty}
        getRowId={(row) => row.key}
        rowClassName={(row) =>
          cn(
            row.kind === "category" && "bg-muted/20",
            row.kind === "total" && "bg-muted/60 font-semibold"
          )
        }
        showRecordCount={false}
        showRowSelection={false}
        tableClassNames={{
          base: cn(widthClass, "h-full border-separate border-spacing-0"),
          bodyRow: "hover:bg-muted/35",
          headerRow: "[&>th]:text-center",
        }}
        tableLabel={copy.overview.title}
        tableLayout={{
          cellBorder: true,
          columnsResizable: !groupsCollapsed,
          headerBackground: true,
          headerBorder: true,
        }}
        testId="confirmation-overview-data-grid"
        title={copy.overview.title}
        toolbarTestId="confirmation-overview-toolbar"
      />
    </section>
  );
}

function MobileConfirmationOverview({
  rows,
  copy,
  locale,
  mode,
  onModeChange,
  onCellSelect,
}: {
  rows: MatrixRow[];
  copy: OverviewCopy;
  locale: string;
  mode: MatrixMode;
  onModeChange: (mode: MatrixMode) => void;
  onCellSelect: (selection: ConfirmationOverviewCellSelection) => void;
}) {
  const [rowKey, setRowKey] = useState("TOTAL");
  const [sheet, setSheet] = useState<"legend" | "sent" | "received" | null>(
    null
  );
  const mobileCopy = getConfirmationOverviewMobileCopy(locale);
  const row =
    rows.find((item) => item.key === rowKey) ??
    rows.find((item) => item.kind === "total");
  if (!row) {
    return null;
  }
  const { columns } = copy.overview.matrix;
  const mainMetrics: MatrixMetric[] = [
    { id: "DRAFT", label: columns.draft, group: "preparation" },
    { id: "PREPARED", label: columns.prepared, group: "preparation" },
    { id: "SENT_TOTAL", label: columns.sent, group: "sent" },
    { id: "RECEIVED_TOTAL", label: columns.received, group: "received" },
    { id: "PROCESSED", label: columns.processed, group: "completion" },
    {
      id: "COMPLETED",
      label: columns.completed,
      group: "completion",
      tone: "complete",
    },
    { id: "TOTAL", label: columns.total, group: "completion" },
  ];
  const detailMetrics: MatrixMetric[] =
    sheet === "sent"
      ? [
          ...AGE_COLUMNS.map((column) => ({
            id: column.id,
            label: copy.overview.ageBuckets[column.labelKey],
            group: "sent" as const,
          })),
          { id: "SENT_TOTAL", label: columns.sentSubtotal, group: "sent" },
        ]
      : [
          {
            id: "RECEIVED_PENDING",
            label: columns.receivedPending,
            group: "received",
            tone: "waiting",
          },
          {
            id: "RECEIVED_MISMATCH",
            label: columns.receivedMismatch,
            group: "received",
            tone: "mismatch",
          },
          {
            id: "RECEIVED_TOTAL",
            label: columns.receivedSubtotal,
            group: "received",
          },
        ];
  const rowLabel = row.kind === "total" ? mobileCopy.allCategories : row.label;
  function metricButton(metric: MatrixMetric, detail = false) {
    if (!row) {
      return null;
    }
    const value = row.counts[metric.id];
    const display = formatValue(value, row.total, mode, locale);
    const intensity = getMatrixCellIntensity(value);
    const total =
      metric.id === "TOTAL" ||
      (detail &&
        (metric.id === "SENT_TOTAL" || metric.id === "RECEIVED_TOTAL"));
    return (
      <MobileButton
        key={metric.id}
        variant="quiet"
        className={cn(
          matrixCellClass(intensity, metric.tone, "type"),
          mobileStyles.metric,
          total && mobileStyles.total
        )}
        aria-label={`${metric.label} ${row.label} ${display}`}
        data-matrix-intensity={intensity}
        data-matrix-tone={metric.tone ?? "neutral"}
        onClick={() =>
          onCellSelect({
            navigation: "ALL",
            column: metric.id,
            type: row.type,
            category: row.category,
            unclassified: row.kind === "unclassified",
          })
        }
      >
        <span className={mobileStyles.metricLabel}>{metric.label}</span>
        <strong>{display}</strong>
      </MobileButton>
    );
  }
  return (
    <section
      className={mobileStyles.root}
      aria-label={copy.overview.title}
      data-testid="confirmation-overview-mobile"
    >
      <ConfirmationMobileHeading title={copy.overview.title} />
      <div className={mobileStyles.controls}>
        <SegmentedButtonGroup
          label={mobileCopy.displayMode}
          value={mode}
          options={[
            { value: "COUNT", label: copy.overview.matrix.countMode },
            { value: "PERCENT", label: copy.overview.matrix.percentMode },
          ]}
          onValueChange={(value) => {
            if (value === "COUNT" || value === "PERCENT") {
              onModeChange(value);
            }
          }}
        />
        <MobileButton
          variant="quiet"
          size="icon"
          aria-label={copy.overview.matrix.legend.trigger}
          title={copy.overview.matrix.legend.trigger}
          onClick={() => setSheet("legend")}
        >
          <Info />
        </MobileButton>
      </div>
      <ViewSwitcher
        label={copy.register.columns.type}
        mobilePresentation="sheet"
        wrapOptions
        value={row.key}
        onValueChange={setRowKey}
        options={[
          ...rows.filter((item) => item.kind === "total"),
          ...rows.filter((item) => item.kind !== "total"),
        ].map((item) => ({
          value: item.key,
          label:
            item.kind === "total"
              ? mobileCopy.allCategories
              : item.kind === "type" && item.category
                ? `${categoryLabel(copy, item.category)} · ${item.label}`
                : item.label,
          count: item.total,
        }))}
      />
      {mode === "PERCENT" ? (
        <p className={mobileStyles.hint}>{mobileCopy.percentHint}</p>
      ) : null}
      <div className={mobileStyles.metrics}>
        {mainMetrics.map((metric) => metricButton(metric))}
      </div>
      <div className={mobileStyles.detailActions}>
        <MobileButton variant="outline" onClick={() => setSheet("sent")}>
          {mobileCopy.sentAging}
          <ChevronRight />
        </MobileButton>
        <MobileButton variant="outline" onClick={() => setSheet("received")}>
          {mobileCopy.receivedDetails}
          <ChevronRight />
        </MobileButton>
      </div>
      <MobileActionSheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSheet(null);
          }
        }}
        title={
          sheet === "legend"
            ? copy.overview.matrix.legend.trigger
            : `${rowLabel} · ${sheet === "sent" ? mobileCopy.sentAging : mobileCopy.receivedDetails}`
        }
        closeLabel={mobileCopy.close}
      >
        {sheet === "legend" ? (
          <div className={mobileStyles.legend}>
            <p className={mobileStyles.hint}>
              {copy.overview.matrix.description}
            </p>
            <p className={mobileStyles.hint}>{mobileCopy.percentHint}</p>
            <MatrixLegendBody copy={copy} />
          </div>
        ) : (
          <div className={mobileStyles.metrics}>
            {detailMetrics.map((metric) => metricButton(metric, true))}
          </div>
        )}
      </MobileActionSheet>
    </section>
  );
}

function MatrixGroupToggle({
  collapseLabel,
  expandLabel,
  expanded,
  label,
  onToggle,
  testId,
}: {
  collapseLabel: string;
  expandLabel: string;
  expanded: boolean;
  label: string;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-testid={testId}
      aria-expanded={expanded}
      aria-label={expanded ? collapseLabel : expandLabel}
      onClick={onToggle}
      className="h-7 w-full justify-center gap-1"
    >
      {expanded ? <ChevronDown /> : <ChevronRight />}
      {label}
    </Button>
  );
}

function MatrixLegend({ copy }: { copy: OverviewCopy }) {
  const { legend } = copy.overview.matrix;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="confirmation-matrix-legend-trigger"
          />
        }
      >
        <Info />
        {legend.trigger}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-64 p-3"
        data-testid="confirmation-matrix-legend-content"
      >
        <MatrixLegendBody copy={copy} />
      </PopoverContent>
    </Popover>
  );
}

function MatrixLegendBody({ copy }: { copy: OverviewCopy }) {
  const { legend } = copy.overview.matrix;
  return (
    <>
      <p className="mb-2 text-sm font-semibold">{legend.label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <LegendItem
          tone="none"
          className="bg-muted-foreground/18"
          label={legend.none}
        />
        <LegendItem tone="low" className="bg-primary/25" label={legend.low} />
        <LegendItem
          tone="medium"
          className="bg-primary/55"
          label={legend.medium}
        />
        <LegendItem tone="high" className="bg-primary" label={legend.high} />
        <LegendItem
          tone="waiting"
          className="bg-warning"
          label={legend.waiting}
        />
        <LegendItem
          tone="mismatch"
          className="bg-destructive"
          label={legend.mismatch}
        />
        <LegendItem
          tone="complete"
          className="bg-success"
          label={legend.complete}
        />
      </div>
    </>
  );
}

function LegendItem({
  className,
  label,
  tone,
}: {
  className: string;
  label: string;
  tone:
    | "none"
    | "low"
    | "medium"
    | "high"
    | "waiting"
    | "mismatch"
    | "complete";
}) {
  return (
    <span className="confirmation-legend-item inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden="true"
        data-legend-tone={tone}
        className={cn("size-2.5 rounded-sm", className)}
      />
      {label}
    </span>
  );
}

function buildMatrixRows(
  confirmations: ProjectConfirmation[],
  copy: OverviewCopy,
  now: Date
): MatrixRow[] {
  const definitions: Omit<MatrixRow, "counts" | "total">[] = [
    ...(["FINANCIAL", "CORRESPONDENCE", "OTHER"] as CategoryKey[]).flatMap(
      (category) => [
        {
          key: `category-${category}`,
          category,
          kind: "category" as const,
          label: categoryLabel(copy, category),
        },
        ...CATEGORY_TYPES[category].map((type) => ({
          key: type,
          category,
          kind: "type" as const,
          type,
          label: subtypeLabel(copy, type),
        })),
      ]
    ),
    {
      key: "UNCLASSIFIED",
      kind: "unclassified",
      label: copy.register.unclassified,
    },
    {
      key: "TOTAL",
      kind: "total",
      label: copy.overview.matrix.total,
    },
  ];

  return definitions.map((definition) => {
    const rowConfirmations = getRowConfirmations(confirmations, definition);
    return {
      ...definition,
      counts: Object.fromEntries(
        ALL_MATRIX_COLUMNS.map((column) => [
          column,
          countForColumn(rowConfirmations, column, now),
        ])
      ) as Record<ConfirmationMatrixColumn, number>,
      total: rowConfirmations.length,
    };
  });
}

const ALL_MATRIX_COLUMNS: ConfirmationMatrixColumn[] = [
  "DRAFT",
  "PREPARED",
  ...AGE_COLUMNS.map((column) => column.id),
  "SENT_TOTAL",
  "RECEIVED_PENDING",
  "RECEIVED_MISMATCH",
  "RECEIVED_TOTAL",
  "PROCESSED",
  "COMPLETED",
  "TOTAL",
];

function matrixCellClass(
  intensity: MatrixCellIntensity,
  tone: MatrixMetric["tone"],
  rowKind: MatrixRowKind
) {
  const base =
    "h-8 w-full rounded-md border border-transparent tabular-nums focus-visible:border-ring/55 focus-visible:ring-2 focus-visible:ring-ring/35";
  if (tone === "waiting") {
    return cn(base, toneClass(intensity, "warning"));
  }
  if (tone === "mismatch") {
    return cn(base, toneClass(intensity, "mismatch"));
  }
  if (tone === "complete") {
    return cn(base, toneClass(intensity, "complete"));
  }
  if (intensity === "zero") {
    return cn(base, "text-muted-foreground/55 hover:bg-muted/70");
  }
  return cn(
    base,
    rowKind === "total"
      ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
      : intensity === "high"
        ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        : intensity === "medium"
          ? "bg-primary/55 font-semibold text-primary-foreground hover:bg-primary/65"
          : "bg-primary/20 font-semibold text-primary hover:bg-primary/30"
  );
}

function getMatrixCellIntensity(value: number): MatrixCellIntensity {
  if (value === 0) {
    return "zero";
  }
  if (value >= 5) {
    return "high";
  }
  if (value >= 2) {
    return "medium";
  }
  return "low";
}

function toneClass(
  intensity: MatrixCellIntensity,
  tone: "warning" | "mismatch" | "complete"
) {
  const palette = {
    warning: {
      zero: "text-muted-foreground hover:bg-warning-subtle",
      low: "bg-warning-subtle font-semibold text-warning-text hover:bg-warning/15",
      medium:
        "bg-warning/20 font-semibold text-warning-text hover:bg-warning/25",
      high: "bg-warning font-semibold text-warning-foreground hover:bg-warning/90",
    },
    mismatch: {
      zero: "text-muted-foreground hover:bg-destructive-subtle",
      low: "bg-destructive-subtle font-semibold text-destructive-text hover:bg-destructive/15",
      medium:
        "bg-destructive/20 font-semibold text-destructive-text hover:bg-destructive/25",
      high: "bg-destructive font-semibold text-destructive-foreground hover:bg-destructive/90",
    },
    complete: {
      zero: "text-muted-foreground hover:bg-success-subtle",
      low: "bg-success-subtle font-semibold text-success-text hover:bg-success/15",
      medium:
        "bg-success/20 font-semibold text-success-text hover:bg-success/25",
      high: "bg-success font-semibold text-success-foreground hover:bg-success/90",
    },
  } satisfies Record<
    "warning" | "mismatch" | "complete",
    Record<MatrixCellIntensity, string>
  >;
  return palette[tone][intensity];
}

function getRowConfirmations(
  confirmations: ProjectConfirmation[],
  row: { key: string; type?: ConfirmationType; category?: CategoryKey }
) {
  if (row.key === "TOTAL") {
    return confirmations;
  }
  if (row.key === "UNCLASSIFIED") {
    return confirmations.filter(isUnclassifiedConfirmation);
  }
  if (row.type) {
    return confirmations.filter((item) => item.type === row.type);
  }
  return confirmations.filter((item) =>
    CATEGORY_TYPES[row.category as CategoryKey]?.includes(item.type)
  );
}

function countForColumn(
  confirmations: ProjectConfirmation[],
  column: ConfirmationMatrixColumn,
  now: Date
) {
  if (column === "TOTAL") {
    return confirmations.length;
  }
  return confirmations.filter((confirmation) => {
    const row = getConfirmationRegisterRow(confirmation, now);
    const stage = row.currentStatus;
    if (column === "DRAFT" || column === "PREPARED") {
      return stage === column;
    }
    if (column === "PROCESSED" || column === "COMPLETED") {
      return stage === column;
    }
    if (column === "SENT_TOTAL") {
      return stage === "SENT";
    }
    if (column === "RECEIVED_TOTAL") {
      return stage === "RECEIVED";
    }
    if (column === "RECEIVED_PENDING") {
      return stage === "RECEIVED" && row.responseOutcome === "PENDING";
    }
    if (column === "RECEIVED_MISMATCH") {
      return stage === "RECEIVED" && row.responseOutcome === "MISMATCH";
    }
    return (
      stage === "SENT" && row.sentAgeBucket === column.replace("SENT_", "")
    );
  }).length;
}

function formatValue(
  value: number,
  total: number,
  mode: MatrixMode,
  locale: string
) {
  if (mode === "COUNT") {
    return new Intl.NumberFormat(locale).format(value);
  }
  if (!total) {
    return "—";
  }
  return `${Math.round((value / total) * 100)}%`;
}

function categoryLabel(copy: OverviewCopy, category: CategoryKey) {
  if (category === "FINANCIAL") {
    return copy.register.financialInstitutions;
  }
  if (category === "CORRESPONDENCE") {
    return copy.register.correspondence;
  }
  return copy.register.otherConfirmations;
}

function subtypeLabel(copy: OverviewCopy, type: ConfirmationType) {
  const labels: Record<ConfirmationType, string> = {
    BANK: copy.register.bank,
    INTERMEDIARY: copy.register.otherFinancialInstitution,
    BALANCE: copy.register.thirdParty,
    RELATED_PARTY: copy.register.relatedParty,
    LAWYER: copy.register.lawyer,
    INVENTORY: copy.register.inventory,
    OTHER: copy.register.miscellaneous,
    UNCLASSIFIED: copy.register.unclassified,
  };
  return labels[type];
}
