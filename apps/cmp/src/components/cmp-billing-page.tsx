"use client";

import type {
  CmpBilling,
  CmpBillingCollectionOverview,
  CmpBillingImportAudit,
  CmpBillingListQuery,
  CmpEngagement,
  CmpEngagementFeeNote,
  CmpFeeNoteLocale,
  CmpSettingsExchangeRatesResponse,
} from "@project-wing/shared";
import { CMP_BUDGET_CURRENCIES } from "@project-wing/shared";
import {
  Button as SharedButton,
  Button,
  ButtonGroup,
  FileInput,
  Input,
  Textarea,
  SelectField,
  MobileActionSheet,
  useCompactViewport,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  Download,
  Eye,
  FileDown,
  Landmark,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";

import { ApiError, api } from "@/api/client";
import { CmpAppShell } from "@/components/cmp-app-shell";
import { useCmpSignOut } from "@/components/cmp-auth-adapter";
import { CmpDataGridStatusBadge } from "@/components/cmp-data-grid-status-badge";
import {
  FeeNoteDocument,
  FeeNoteExportDialog,
} from "@/components/cmp-engagement-fee-note-page";
import type { FeeNoteField } from "@/components/cmp-engagement-fee-note-page";
import { SearchSelect } from "@/components/cmp-form-controls";
import type { SearchSelectOption } from "@/components/cmp-form-controls";
import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "@/components/cmp-master-data-grid";
import { useCmpToast } from "@/components/cmp-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { en, zh } from "@/i18n/billing";
import type { Copy } from "@/i18n/billing";
import { getCmpDictionary, useCmpI18n } from "@/i18n/client";
import { openAuthorizedPreviewWindow } from "@/lib/open-preview-window";

import { BillingCreateDialog as CreateBillingDialog } from "./cmp-billing/billing-create-dialog";
import { BillingDataImportDialog } from "./cmp-billing/billing-data-import-dialog";
import type { BillingImportDraftPatch } from "./cmp-billing/billing-data-import-dialog";
import {
  billingMoney as money,
  billingStatusLabel,
  billingStatusTone,
  formatBillingDate,
  latestBillingReceiptDate as latestReceiptDate,
} from "./cmp-billing/billing-format";

import mobileStyles from "./cmp-mobile.module.css";

type BillingPageProps = {
  engagementId?: string;
  financeCenter?: boolean;
};

type BillingQueue = NonNullable<CmpBillingListQuery["queue"]>;
type BillingStatusGroup =
  | "DRAFT"
  | "APPROVAL"
  | "SENT"
  | "CLIENT_PAID"
  | "RECONCILED";
type BillingColumn =
  ProjectWingMasterDataGridProps<CmpBilling>["columns"][number];
type BillingClaimState = {
  amount: string;
  currency: CmpBilling["currency"];
  paidAt: string;
  reference: string;
};
type BillingReceiptState = {
  amount: string;
  currency: CmpBilling["currency"];
  receiptDate: string;
  bankReference: string;
  internalNote: string;
};
type BillingExchangeRates = CmpSettingsExchangeRatesResponse;
type BillingWorkflowDialogProps = {
  billing: CmpBilling;
  copy: Copy;
  locale: CmpFeeNoteLocale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  returnReason: string;
  setReturnReason: Dispatch<SetStateAction<string>>;
  sentMethod: string;
  setSentMethod: Dispatch<SetStateAction<string>>;
  clientProof: File | null;
  setClientProof: Dispatch<SetStateAction<File | null>>;
  bankProof: File | null;
  setBankProof: Dispatch<SetStateAction<File | null>>;
  claim: BillingClaimState;
  setClaim: Dispatch<SetStateAction<BillingClaimState>>;
  receipt: BillingReceiptState;
  setReceipt: Dispatch<SetStateAction<BillingReceiptState>>;
  exchangeRates?: BillingExchangeRates;
  overrideReason: string;
  setOverrideReason: Dispatch<SetStateAction<string>>;
  perform: (operation: () => Promise<CmpBilling>) => Promise<void>;
};

const CURRENCIES = CMP_BUDGET_CURRENCIES;
const ALL_ENGAGEMENTS = "__all_engagements__";
const EMPTY_BILLINGS: CmpBilling[] = [];
const EMPTY_ENGAGEMENTS: CmpEngagement[] = [];

export function CmpBillingPage({
  engagementId,
  financeCenter = false,
}: BillingPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, localizedPath } = useCmpI18n();
  const signOut = useCmpSignOut();
  const { toast } = useCmpToast();
  const client = useQueryClient();
  const [queue, setQueue] = useState<BillingQueue>(() =>
    billingQueueFromSearchParams(
      searchParams.get("queue"),
      financeCenter ? "PENDING_RECONCILIATION" : "ALL"
    )
  );
  const [search, setSearch] = useState(() => searchParams.get("query") ?? "");
  const [statusGroup, setStatusGroup] = useState<BillingStatusGroup | null>(
    null
  );
  const urlEngagementId = searchParams.get("engagementId") ?? "";
  const [selectedEngagementId, setSelectedEngagementId] = useState(
    engagementId ?? urlEngagementId
  );
  const [newEngagementId, setNewEngagementId] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const canOpenFinanceCenter =
    !financeCenter ||
    me.data?.globalRole === "PARTNER" ||
    me.data?.globalRole === "MANAGER" ||
    me.data?.globalRole === "SUPER_ADMIN";
  const effectiveEngagementId = engagementId ?? selectedEngagementId;
  const bills = useQuery({
    queryKey: ["cmp-billing", effectiveEngagementId || "all", queue, search],
    queryFn: () =>
      api.cmpBillings({
        engagementId: effectiveEngagementId || undefined,
        queue,
        query: search || undefined,
      }),
    enabled: Boolean(me.data),
  });
  const engagements = useQuery({
    queryKey: ["cmp-engagements", "billing-picker"],
    queryFn: () => api.cmpEngagements(),
    enabled: Boolean(me.data),
  });
  const rows = bills.data?.billings ?? EMPTY_BILLINGS;
  const visibleRows = useMemo(
    () => rows.filter((billing) => billingMatchesGroup(billing, statusGroup)),
    [rows, statusGroup]
  );
  const copy = locale === "zh-CN" ? zh : en;

  const engagementOptions = useMemo<SearchSelectOption[]>(
    () => [
      {
        value: ALL_ENGAGEMENTS,
        label: copy.allEngagements,
        description: copy.allEngagementsDescription,
      },
      ...(engagements.data?.engagements ?? [])
        .filter((engagement) => engagement.status !== "ARCHIVED")
        .map((engagement) => ({
          value: engagement.id,
          label: engagement.engagementCode,
          description: `${engagement.client.clientCode} · ${engagement.client.nameZh || engagement.client.nameEn || copy.unnamedClient}`,
          keywords: [
            engagement.engagementCode,
            engagement.client.clientCode,
            engagement.client.nameZh,
            engagement.client.nameEn,
          ]
            .filter(Boolean)
            .join(" "),
        })),
    ],
    [copy, engagements.data?.engagements]
  );

  const scopeKey = `${engagementId ?? ""}:${urlEngagementId}`;
  const [previousScopeKey, setPreviousScopeKey] = useState(scopeKey);
  if (previousScopeKey !== scopeKey) {
    setPreviousScopeKey(scopeKey);
    if (!engagementId) {
      setSelectedEngagementId(urlEngagementId);
    }
  }

  useEffect(() => {
    if (!me.isError && (me.isLoading || me.data)) {
      return;
    }
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.replace(
      `${localizedPath("/login")}?redirect=${encodeURIComponent(returnTo)}`
    );
  }, [localizedPath, me.data, me.isError, me.isLoading, router]);

  useEffect(() => {
    if (me.data && !canOpenFinanceCenter) {
      router.replace(localizedPath("/dashboard"));
    }
  }, [canOpenFinanceCenter, localizedPath, me.data, router]);

  function changeEngagementScope(value: string) {
    const nextEngagementId = value === ALL_ENGAGEMENTS ? "" : value;
    setSelectedEngagementId(nextEngagementId);
    const params = new URLSearchParams(window.location.search);
    if (nextEngagementId) {
      params.set("engagementId", nextEngagementId);
    } else {
      params.delete("engagementId");
    }
    const suffix = params.size ? `?${params.toString()}` : "";
    router.replace(`${localizedPath("/billing")}${suffix}`);
  }

  function changeQueue(nextQueue: BillingQueue) {
    setQueue(nextQueue);
    setStatusGroup(null);
    const params = new URLSearchParams(window.location.search);
    params.set("queue", nextQueue);
    if (search) {
      params.set("query", search);
    } else {
      params.delete("query");
    }
    const suffix = params.size ? `?${params.toString()}` : "";
    const path = engagementId
      ? localizedPath(`/engagement/${engagementId}/billing`)
      : localizedPath("/billing");
    router.replace(`${path}${suffix}`);
  }

  function changeStatusGroup(nextGroup: BillingStatusGroup) {
    if (nextGroup === "CLIENT_PAID") {
      changeQueue("PENDING_RECONCILIATION");
      return;
    }
    if (nextGroup === "RECONCILED") {
      changeQueue("RECONCILED");
      return;
    }
    if (queue !== "ALL") {
      const params = new URLSearchParams(window.location.search);
      params.set("queue", "ALL");
      router.replace(
        `${engagementId ? localizedPath(`/engagement/${engagementId}/billing`) : localizedPath("/billing")}?${params.toString()}`
      );
      setQueue("ALL");
    }
    setStatusGroup((current) => (current === nextGroup ? null : nextGroup));
  }

  function changeSearch(value: string) {
    setSearch(value);
    const params = new URLSearchParams(window.location.search);
    if (value.trim()) {
      params.set("query", value);
    } else {
      params.delete("query");
    }
    const suffix = params.size ? `?${params.toString()}` : "";
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${suffix}`
    );
  }

  function detailHref(billingId: string) {
    const params = new URLSearchParams({
      source: financeCenter ? "finance" : "engagement",
      queue,
    });
    if (search) {
      params.set("query", search);
    }
    if (effectiveEngagementId) {
      params.set("engagementId", effectiveEngagementId);
    }
    return `${localizedPath(`/billing/${billingId}`)}?${params.toString()}`;
  }

  async function createBilling() {
    const target = effectiveEngagementId || newEngagementId;
    if (!target) {
      toast({ title: copy.chooseEngagement, variant: "destructive" });
      return;
    }
    setActionPending(true);
    try {
      const selectedEngagement = engagements.data?.engagements.find(
        (entry) => entry.id === target
      );
      const billing = await api.createCmpBilling({
        engagementId: target,
        currency:
          selectedEngagement?.feeCurrency ??
          bills.data?.collectionOverview.currency ??
          "HKD",
        lineItems: [{ descriptionZh: "", descriptionEn: "", amount: "0.00" }],
      });
      setCreating(false);
      await client.invalidateQueries({ queryKey: ["cmp-billing"] });
      toast({ title: copy.created, variant: "success" });
      router.push(detailHref(billing.id));
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : copy.failed,
        variant: "destructive",
      });
    } finally {
      setActionPending(false);
    }
  }

  if (me.isLoading || (me.data && bills.isLoading)) {
    return <BillingLoading />;
  }
  if (!me.data || !canOpenFinanceCenter) {
    return null;
  }

  return (
    <CmpAppShell
      activeSection="billing"
      user={me.data}
      onSignOut={() => {
        void signOut();
      }}
      searchValue={search}
      onSearchChange={changeSearch}
    >
      <div className="min-h-full bg-background">
        <section className="animate-in fade-in-0 slide-in-from-bottom-1 w-full duration-200 motion-reduce:animate-none">
          <header className="cmp-billing-list-heading mb-3 flex flex-wrap items-start justify-between gap-3 px-4 pt-3 sm:px-6">
            <div>
              {financeCenter ? null : (
                <SharedButton
                  variant="quiet"
                  size="sm"
                  type="button"
                  onClick={() => router.push(localizedPath("/engagement"))}
                  className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-4" /> {copy.back}
                </SharedButton>
              )}
              <h1 className="text-2xl font-semibold tracking-tight">
                {financeCenter ? copy.financeCenter : copy.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {financeCenter ? copy.financeHint : copy.hint}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => {
                  setNewEngagementId(effectiveEngagementId);
                  setCreating(true);
                }}
              >
                <Plus className="size-4" /> {copy.newBilling}
              </Button>
            </div>
          </header>

          {financeCenter ? (
            <section
              className="mb-3 border-y border-border bg-muted/20 px-4 py-3 sm:px-6"
              data-testid="cmp-billing-engagement-scope"
            >
              <div className="w-full max-w-3xl">
                <SearchSelect
                  label={copy.viewingScope}
                  value={effectiveEngagementId || ALL_ENGAGEMENTS}
                  options={engagementOptions}
                  placeholder={copy.chooseEngagement}
                  searchPlaceholder={copy.searchEngagement}
                  emptyText={copy.noMatchingEngagements}
                  onChange={changeEngagementScope}
                />
              </div>
            </section>
          ) : null}

          <CollectionOverview
            overview={bills.data?.collectionOverview}
            copy={copy}
            locale={locale}
            rows={rows}
            activeStatusGroup={statusGroup}
            onSelectStatusGroup={changeStatusGroup}
          />

          <BillingTable
            rows={visibleRows}
            onOpen={(billingId) => router.push(detailHref(billingId))}
            copy={copy}
            locale={locale}
            emptyMessage={billingEmptyMessage(queue, copy)}
            leadingActions={
              <div
                className="flex gap-1 rounded-lg bg-muted p-1"
                role="tablist"
                aria-label={copy.queues}
              >
                {(
                  [
                    ["ALL", copy.all],
                    ["PENDING_RECONCILIATION", copy.pending],
                    ["RECONCILED", copy.reconciled],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={queue === value}
                    onClick={() => changeQueue(value)}
                    size="sm"
                    variant={queue === value ? "outline" : "quiet"}
                    className={
                      queue === value
                        ? "bg-background font-medium shadow-sm"
                        : "text-muted-foreground"
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            }
            trailingActions={null}
          />
        </section>

        <CreateBillingDialog
          open={creating}
          copy={copy}
          engagementId={effectiveEngagementId || undefined}
          selectedEngagementId={newEngagementId}
          setSelectedEngagementId={setNewEngagementId}
          engagements={engagements.data?.engagements ?? EMPTY_ENGAGEMENTS}
          pending={actionPending}
          onClose={() => setCreating(false)}
          onCreate={() => {
            createBilling();
          }}
        />
      </div>
    </CmpAppShell>
  );
}

export function CmpBillingDetailPage({ billingId }: { billingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, localizedPath } = useCmpI18n();
  const signOut = useCmpSignOut();
  const client = useQueryClient();
  const [actionPending, setActionPending] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const billingQuery = useQuery({
    queryKey: ["cmp-billing", "detail", billingId],
    queryFn: () => api.cmpBilling(billingId),
    enabled: Boolean(me.data),
    retry: false,
  });
  const copy = locale === "zh-CN" ? zh : en;

  useEffect(() => {
    if (!me.isError && (me.isLoading || me.data)) {
      return;
    }
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.replace(
      `${localizedPath("/login")}?redirect=${encodeURIComponent(returnTo)}`
    );
  }, [localizedPath, me.data, me.isError, me.isLoading, router]);

  async function refresh(updated?: CmpBilling) {
    if (updated) {
      client.setQueryData(["cmp-billing", "detail", billingId], updated);
    }
    await client.invalidateQueries({ queryKey: ["cmp-billing"] });
  }

  if (me.isLoading || (me.data && billingQuery.isLoading)) {
    return <BillingLoading />;
  }
  if (!me.data) {
    return null;
  }
  if (!billingQuery.data) {
    return (
      <CmpAppShell
        activeSection="billing"
        user={me.data}
        onSignOut={() => {
          void signOut();
        }}
      >
        <div className="grid min-h-full place-items-center bg-muted/25 p-5">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">{copy.failed}</h1>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="size-4" />
                {copy.back}
              </Button>
              <Button
                onClick={() => {
                  billingQuery.refetch();
                }}
              >
                {copy.retry}
              </Button>
            </div>
          </div>
        </div>
      </CmpAppShell>
    );
  }

  const billing = billingQuery.data;
  const source =
    searchParams.get("source") === "engagement" ? "engagement" : "finance";
  const queue = billingQueueFromSearchParams(searchParams.get("queue"), "ALL");
  const search = searchParams.get("query") ?? "";
  const backParams = new URLSearchParams({ queue });
  if (search) {
    backParams.set("query", search);
  }
  const selectedEngagementId = searchParams.get("engagementId");
  if (selectedEngagementId) {
    backParams.set("engagementId", selectedEngagementId);
  }
  const backPath = `${localizedPath(
    source === "engagement"
      ? `/engagement/${billing.engagementId}/billing`
      : "/billing"
  )}?${backParams.toString()}`;

  return (
    <CmpAppShell
      activeSection="billing"
      user={me.data}
      onSignOut={() => {
        void signOut();
      }}
    >
      <div className="min-h-full bg-muted/25 px-4 py-5 sm:px-6 sm:py-8">
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 mx-auto w-full max-w-6xl duration-200 motion-reduce:animate-none">
          <BillingDetail
            billing={billing}
            locale={locale}
            copy={copy}
            pending={actionPending}
            setPending={setActionPending}
            refresh={refresh}
            onBack={() => router.push(backPath)}
            onDeleted={() => router.push(backPath)}
          />
        </div>
      </div>
    </CmpAppShell>
  );
}

function billingMatchesGroup(
  billing: CmpBilling,
  group: BillingStatusGroup | null
) {
  if (!group) {
    return true;
  }
  if (group === "APPROVAL") {
    return billing.status === "SUBMITTED" || billing.status === "APPROVED";
  }
  return billing.status === group;
}

function billingEmptyMessage(queue: BillingQueue, copy: Copy) {
  if (queue === "PENDING_RECONCILIATION") {
    return copy.emptyPending;
  }
  if (queue === "RECONCILED") {
    return copy.emptyReconciled;
  }
  return copy.empty;
}

function BillingTable({
  rows,
  onOpen,
  copy,
  locale,
  emptyMessage,
  leadingActions,
  trailingActions,
}: {
  rows: CmpBilling[];
  onOpen: (id: string) => void;
  copy: Copy;
  locale: CmpFeeNoteLocale;
  emptyMessage: string;
  leadingActions: ReactNode;
  trailingActions: ReactNode;
}) {
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const columns = useMemo<BillingColumn[]>(
    () => [
      {
        accessorKey: "billNumber",
        id: "billNumber",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.number}
          />
        ),
        cell: ({ row }) => (
          <span className="block min-w-0">
            <strong className="block truncate font-medium text-foreground">
              {row.original.billNumber}
            </strong>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {row.original.engagementCode}
            </span>
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.number },
        size: 170,
      },
      {
        accessorKey: "clientName",
        id: "client",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.client}
          />
        ),
        cell: ({ getValue }) => (
          <span className="block truncate font-medium">
            {String(getValue() || "—")}
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.client },
        size: 210,
      },
      {
        accessorFn: (billing) => billingStatusLabel(billing.status, copy),
        id: "status",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.status}
          />
        ),
        cell: ({ row }) => (
          <CmpDataGridStatusBadge tone={billingStatusTone(row.original.status)}>
            {billingStatusLabel(row.original.status, copy)}
          </CmpDataGridStatusBadge>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.status },
        size: 125,
      },
      {
        accessorKey: "issueDate",
        id: "issueDate",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.date}
          />
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatBillingDate(String(getValue() || ""), locale)}
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        meta: { autoSize: true, headerTitle: copy.date },
        size: 120,
      },
      {
        accessorFn: (billing) => Number(billing.totalAmount),
        id: "amount",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.amount}
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right font-medium whitespace-nowrap tabular-nums">
            {money(row.original.totalAmount, row.original.currency, locale)}
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        meta: {
          autoSize: true,
          cellClassName: "text-right",
          headerClassName: "text-right",
          headerTitle: copy.amount,
        },
        size: 140,
      },
      {
        accessorFn: (billing) => Number(billing.remainingAmount),
        id: "remainingAmount",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.remainingAmount}
          />
        ),
        cell: ({ row }) => {
          const remaining = Number(row.original.remainingAmount);
          return (
            <span
              className={`block text-right font-medium whitespace-nowrap tabular-nums ${remaining > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
            >
              {money(
                row.original.remainingAmount,
                row.original.currency,
                locale
              )}
            </span>
          );
        },
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        meta: {
          autoSize: true,
          cellClassName: "text-right cmp-grid-secondary-column",
          headerClassName: "text-right cmp-grid-secondary-column",
          headerTitle: copy.remainingAmount,
        },
        size: 145,
      },
      {
        accessorFn: latestReceiptDate,
        id: "latestReceipt",
        header: ({ column }) => (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={copy.latestReceipt}
          />
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {getValue() ? formatBillingDate(String(getValue()), locale) : "—"}
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        meta: {
          autoSize: true,
          cellClassName: "cmp-grid-secondary-column",
          headerClassName: "cmp-grid-secondary-column",
          headerTitle: copy.latestReceipt,
        },
        size: 125,
      },
      {
        id: "progress",
        header: copy.progress,
        cell: ({ row }) => (
          <BillingProgress status={row.original.status} copy={copy} compact />
        ),
        enableHiding: true,
        enableResizing: false,
        enableSorting: false,
        meta: {
          cellClassName: "cmp-grid-secondary-column",
          headerClassName: "cmp-grid-secondary-column",
          headerTitle: copy.progress,
        },
        size: 130,
      },
      {
        id: "open",
        header: "",
        cell: () => <ChevronRight className="size-4 text-muted-foreground" />,
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: { headerTitle: copy.openBilling },
        size: 42,
      },
    ],
    [copy, locale, menuCopy]
  );

  return (
    <div className="cmp-billing-flat-grid">
      <CmpMasterDataGrid
        mobile={{
          titleColumn: "billNumber",
          summaryColumns: ["client", "amount", "status"],
          filterColumn: "status",
        }}
        columns={columns}
        compactHiddenColumnIds={[
          "remainingAmount",
          "latestReceipt",
          "progress",
        ]}
        data={rows}
        emptyMessage={emptyMessage}
        initialSorting={[{ id: "issueDate", desc: true }]}
        leadingActions={leadingActions}
        onRowClick={(billing) => onOpen(billing.id)}
        recordCount={rows.length}
        showRowSelection={false}
        tableLabel={copy.billings}
        testId="cmp-billing-data-grid"
        title={copy.billings}
        trailingActions={trailingActions}
        columnVisibilityLabel={copy.columns}
      />
    </div>
  );
}

function BillingProgress({
  status,
  copy,
  compact = false,
}: {
  status: CmpBilling["status"];
  copy: Copy;
  compact?: boolean;
}) {
  const phase =
    status === "DRAFT" || status === "SUBMITTED" || status === "APPROVED"
      ? 1
      : status === "SENT" || status === "CLIENT_PAID"
        ? 2
        : 3;
  const statuses = [
    status === "DRAFT"
      ? copy.draft
      : status === "SUBMITTED"
        ? copy.submitted
        : status === "APPROVED"
          ? copy.approved
          : copy.approval,
    status === "SENT"
      ? copy.sent
      : status === "CLIENT_PAID"
        ? copy.clientPaid
        : copy.collection,
    status === "RECONCILED" ? copy.reconciled : copy.reconciliation,
  ];
  return (
    <div className={compact ? "w-24" : "min-w-56"} title={statuses[phase - 1]}>
      <div className={compact ? "flex items-center gap-2" : "flex gap-1"}>
        {[1, 2, 3].map((item) => (
          <span
            key={item}
            className={`${compact ? "size-2.5" : "h-1.5 flex-1"} rounded-full ${item <= phase ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      {compact ? null : (
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {statuses[phase - 1]}
        </div>
      )}
    </div>
  );
}

function BillingDetail({
  billing,
  locale,
  copy,
  pending,
  setPending,
  refresh,
  onBack,
  onDeleted,
}: {
  billing: CmpBilling;
  locale: CmpFeeNoteLocale;
  copy: Copy;
  pending: boolean;
  setPending: (value: boolean) => void;
  refresh: (billing?: CmpBilling) => Promise<void>;
  onBack: () => void;
  onDeleted?: () => void;
}) {
  const phone = useCompactViewport(767.98);
  const [toolsOpen, setToolsOpen] = useState(false);
  const queuedTool = useRef<(() => void) | null>(null);
  const { toast } = useCmpToast();
  const { dictionary } = useCmpI18n();
  const [draft, setDraft] = useState(() => asDraft(billing));
  const [documentLocale, setDocumentLocale] =
    useState<CmpFeeNoteLocale>(locale);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");
  const [exportLocales, setExportLocales] = useState<CmpFeeNoteLocale[]>([
    locale,
  ]);
  const [exporting, setExporting] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importAudit, setImportAudit] = useState<CmpBillingImportAudit | null>(
    null
  );
  const [clientProof, setClientProof] = useState<File | null>(null);
  const [bankProof, setBankProof] = useState<File | null>(null);
  const [claim, setClaim] = useState({
    amount: billing.totalAmount,
    currency: billing.currency,
    paidAt: new Date().toISOString().slice(0, 10),
    reference: "",
  });
  const [receipt, setReceipt] = useState({
    amount: billing.totalAmount,
    currency: billing.currency,
    receiptDate: new Date().toISOString().slice(0, 10),
    bankReference: "",
    internalNote: "",
  });
  const [returnReason, setReturnReason] = useState("");
  const [sentMethod, setSentMethod] = useState("EMAIL");
  const [overrideReason, setOverrideReason] = useState("");
  const isDraft = billing.status === "DRAFT" && billing.capabilities.canEdit;
  const feeCopy = dictionary.workspace;
  const canExport = billing.capabilities.canGenerateInvoice;
  const note = billingAsFeeNote(billing, draft, documentLocale);
  const exchangeRates = useQuery<CmpSettingsExchangeRatesResponse>({
    queryKey: ["cmp-settings-exchange-rates"],
    queryFn: async () =>
      (await api.cmpSettingsExchangeRates()) as CmpSettingsExchangeRatesResponse,
  });

  const [sourceBilling, setSourceBilling] = useState(billing);
  if (sourceBilling !== billing) {
    setSourceBilling(billing);
    setDraft(asDraft(billing));
    setImportAudit(null);
    setClaim((state) => ({
      ...state,
      amount: billing.totalAmount,
      currency: billing.currency,
    }));
    setReceipt((state) => ({
      ...state,
      amount: billing.totalAmount,
      currency: billing.currency,
    }));
  }

  async function perform(operation: () => Promise<CmpBilling>) {
    setPending(true);
    try {
      const updated = await operation();
      await refresh(updated);
      toast({ title: copy.saved, variant: "success" });
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : copy.failed,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }
  async function saveDraft() {
    return await api.updateCmpBilling(
      billing.id,
      billingDraftInput(billing.version, draft, importAudit ?? undefined)
    );
  }
  async function save() {
    await perform(saveDraft);
  }
  async function saveAndSubmit() {
    setPending(true);
    try {
      const saved = await saveDraft();
      const submitted = await api.submitCmpBilling(billing.id, {
        expectedVersion: saved.version,
      });
      await refresh(submitted);
      toast({ title: copy.submit, variant: "success" });
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : copy.failed,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  async function removeDraft() {
    setPending(true);
    try {
      await api.deleteCmpBilling(billing.id, {
        expectedVersion: billing.version,
      });
      await refresh();
      toast({ title: copy.deleted, variant: "success" });
      onDeleted?.();
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : copy.failed,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  const updateDocument = <K extends FeeNoteField>(
    field: K,
    value: CmpEngagementFeeNote[K]
  ) => {
    if (
      !isDraft ||
      field === "feeNoteNumber" ||
      field === "engagementReference"
    ) {
      return;
    }
    setDraft((current) =>
      updateBillingDocumentDraft(current, documentLocale, field, value)
    );
  };

  const toggleExportLocale = (value: CmpFeeNoteLocale) =>
    setExportLocales((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
    );

  async function printBilling() {
    if (pending) {
      return;
    }
    if (!isDraft) {
      window.print();
      return;
    }
    setPending(true);
    try {
      const saved = await saveDraft();
      await refresh(saved);
      window.print();
    } catch (error) {
      toast({
        title:
          error instanceof ApiError
            ? error.message
            : feeCopy.feeNoteExportSaveFailed,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  async function exportInvoice() {
    if (!exportLocales.length || exporting || !canExport) {
      return;
    }
    setExporting(true);
    try {
      let source = billing;
      if (isDraft) {
        source = await saveDraft();
        await refresh(source);
      }
      const failures: CmpFeeNoteLocale[] = [];
      for (const selectedLocale of (["zh-CN", "en-US"] as const).filter(
        (entry) => exportLocales.includes(entry)
      )) {
        try {
          await api.generateCmpBillingInvoice(source.id, {
            expectedVersion: source.version,
            locale: selectedLocale,
            format: exportFormat,
          });
        } catch {
          failures.push(selectedLocale);
        }
      }
      if (failures.length) {
        const labels = failures
          .map((entry) =>
            entry === "zh-CN"
              ? feeCopy.feeNoteLanguageChinese
              : feeCopy.feeNoteLanguageEnglish
          )
          .join(" / ");
        toast({
          title: `${feeCopy.feeNoteExportFailed} (${labels})`,
          variant: "destructive",
        });
      } else {
        toast({ title: feeCopy.feeNoteExportStarted, variant: "success" });
        setExportOpen(false);
      }
    } catch (error) {
      toast({
        title:
          error instanceof ApiError
            ? error.message
            : feeCopy.feeNoteExportSaveFailed,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="cmp-billing-detail-toolbar sticky top-2 z-30 mb-5 overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-sm backdrop-blur-md sm:top-4 print:hidden">
        {phone ? (
          <header className={mobileStyles.toolbar}>
            <SharedButton variant="quiet" onClick={onBack}>
              <ArrowLeft />
              {copy.back}
            </SharedButton>
            <strong>
              {documentLocale === "zh-CN"
                ? feeCopy.feeNoteLanguageChinese
                : feeCopy.feeNoteLanguageEnglish}
            </strong>
            {isDraft && (
              <Button disabled={pending || exporting} onClick={save}>
                {pending ? feeCopy.feeNoteSaving : feeCopy.feeNoteSave}
              </Button>
            )}
            <SharedButton
              variant="quiet"
              size="icon"
              aria-label={
                locale === "zh-CN" ? "收费单操作" : "Fee note actions"
              }
              onClick={() => setToolsOpen(true)}
            >
              <MoreHorizontal />
            </SharedButton>
          </header>
        ) : (
          <header className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <SharedButton type="button" variant="quiet" onClick={onBack}>
              <ArrowLeft className="size-4" />
              {feeCopy.feeNoteBack}
            </SharedButton>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ButtonGroup aria-label={feeCopy.feeNoteDocumentTitle}>
                <Button
                  aria-pressed={documentLocale === "zh-CN"}
                  onClick={() => setDocumentLocale("zh-CN")}
                  type="button"
                  variant={documentLocale === "zh-CN" ? "default" : "outline"}
                >
                  {feeCopy.feeNoteLanguageChinese}
                </Button>
                <Button
                  aria-pressed={documentLocale === "en-US"}
                  onClick={() => setDocumentLocale("en-US")}
                  type="button"
                  variant={documentLocale === "en-US" ? "default" : "outline"}
                >
                  {feeCopy.feeNoteLanguageEnglish}
                </Button>
              </ButtonGroup>
              <SharedButton
                type="button"
                variant="outline"
                disabled={!canExport || pending || exporting}
                title={canExport ? undefined : copy.readOnly}
                onClick={() => setExportOpen(true)}
              >
                <Download className="size-4" />
                {feeCopy.feeNoteExport}
              </SharedButton>
              <Button
                type="button"
                variant="outline"
                disabled={pending || exporting}
                onClick={() => {
                  printBilling();
                }}
              >
                <Printer className="size-4" />
                {feeCopy.feeNotePrint}
              </Button>
              <ButtonGroup>
                <Button
                  type="button"
                  disabled={pending || exporting}
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                >
                  {isDraft ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  {isDraft
                    ? locale === "zh-CN"
                      ? "代入资料"
                      : "Import data"
                    : locale === "zh-CN"
                      ? "查看资料来源"
                      : "View data sources"}
                </Button>
                <Button
                  type="button"
                  disabled={!isDraft || pending || exporting}
                  onClick={() => {
                    save();
                  }}
                >
                  <Save className="size-4" />
                  {pending ? feeCopy.feeNoteSaving : feeCopy.feeNoteSave}
                </Button>
              </ButtonGroup>
            </div>
          </header>
        )}
        <MobileActionSheet
          title={locale === "zh-CN" ? "收费单操作" : "Fee note actions"}
          closeLabel={copy.cancel}
          open={toolsOpen && phone}
          onOpenChange={setToolsOpen}
          onOpenChangeComplete={(open) => {
            if (!open) {
              const action = queuedTool.current;
              queuedTool.current = null;
              action?.();
            }
          }}
        >
          <div className={mobileStyles.menu}>
            {[
              {
                label: feeCopy.feeNoteLanguageChinese,
                onClick: () => setDocumentLocale("zh-CN"),
                disabled: false,
              },
              {
                label: feeCopy.feeNoteLanguageEnglish,
                onClick: () => setDocumentLocale("en-US"),
                disabled: false,
              },
              {
                label: feeCopy.feeNoteExport,
                onClick: () => setExportOpen(true),
                disabled: !canExport || pending || exporting,
              },
              {
                label: feeCopy.feeNotePrint,
                onClick: printBilling,
                disabled: pending || exporting,
              },
              {
                label: isDraft
                  ? locale === "zh-CN"
                    ? "代入资料"
                    : "Import data"
                  : locale === "zh-CN"
                    ? "查看资料来源"
                    : "View data sources",
                onClick: () => setImportOpen(true),
                disabled: pending || exporting,
              },
            ].map((action) => (
              <Button
                key={action.label}
                variant="quiet"
                disabled={action.disabled}
                onClick={() => {
                  queuedTool.current = action.onClick;
                  setToolsOpen(false);
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </MobileActionSheet>
        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <StatusPill status={billing.status} copy={copy} />
            <BillingProgress
              status={billing.status}
              copy={copy}
              compact={phone}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFilesOpen(true)}
            >
              <FileDown className="size-3.5" />
              {copy.evidence}
            </Button>
            {billing.capabilities.canDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  removeDraft();
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                {copy.deleteDraft}
              </Button>
            ) : null}
            {isDraft && billing.capabilities.canSubmit ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => {
                  saveAndSubmit();
                }}
              >
                <Send className="size-3.5" />
                {copy.submit}
              </Button>
            ) : workflowActionLabel(billing, copy) ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => setWorkflowOpen(true)}
              >
                {workflowActionLabel(billing, copy)}
              </Button>
            ) : null}
          </div>
        </section>
      </div>

      <FeeNoteDocument
        locale={documentLocale}
        note={note}
        update={updateDocument}
        readOnly={!isDraft}
        lockedFields={["feeNoteNumber", "engagementReference"]}
      />
      <FeeNoteExportDialog
        format={exportFormat}
        locales={exportLocales}
        onExport={() => {
          exportInvoice();
        }}
        onFormatChange={setExportFormat}
        onOpenChange={setExportOpen}
        onToggleLocale={toggleExportLocale}
        open={exportOpen}
        pending={exporting || pending}
      />
      <BillingFilesDialog
        billing={billing}
        copy={copy}
        onOpenChange={setFilesOpen}
        open={filesOpen}
      />
      <BillingWorkflowDialog
        billing={billing}
        copy={copy}
        locale={locale}
        open={workflowOpen}
        onOpenChange={setWorkflowOpen}
        pending={pending}
        returnReason={returnReason}
        setReturnReason={setReturnReason}
        sentMethod={sentMethod}
        setSentMethod={setSentMethod}
        clientProof={clientProof}
        setClientProof={setClientProof}
        bankProof={bankProof}
        setBankProof={setBankProof}
        claim={claim}
        setClaim={setClaim}
        receipt={receipt}
        setReceipt={setReceipt}
        exchangeRates={exchangeRates.data}
        overrideReason={overrideReason}
        setOverrideReason={setOverrideReason}
        perform={perform}
      />
      <BillingDataImportDialog
        billingId={billing.id}
        document={draft}
        locale={locale}
        readOnly={!isDraft}
        open={importOpen}
        onOpenChange={setImportOpen}
        onApply={(patch: BillingImportDraftPatch) => {
          setDraft((current) => ({
            ...current,
            clientSnapshot: patch.clientSnapshot,
            firmSnapshot: patch.firmSnapshot,
            localizedContent: patch.localizedContent,
          }));
          setImportAudit(patch.importAudit);
          toast({
            title:
              locale === "zh-CN" ? "资料已应用到草稿" : "Data applied to draft",
            variant: "success",
          });
        }}
      />
    </div>
  );
}

function workflowActionLabel(billing: CmpBilling, copy: Copy) {
  if (
    billing.status === "SUBMITTED" &&
    (billing.capabilities.canApprove || billing.capabilities.canReturn)
  ) {
    return billing.capabilities.canApprove ? copy.approve : copy.returnDraft;
  }
  if (billing.status === "APPROVED" && billing.capabilities.canMarkSent) {
    return copy.markSent;
  }
  if (billing.status === "SENT" && billing.capabilities.canClaimClientPayment) {
    return copy.claimPaid;
  }
  if (
    billing.status === "CLIENT_PAID" &&
    (billing.capabilities.canAddFinanceReceipt ||
      billing.capabilities.canReconcile)
  ) {
    return billing.capabilities.canReconcile
      ? copy.reconcile
      : copy.financeReceipt;
  }
  return null;
}

function BillingFilesDialog({
  billing,
  copy,
  open,
  onOpenChange,
}: {
  billing: CmpBilling;
  copy: Copy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.evidence}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{copy.evidenceHelp}</p>
        <BillingArtifactList artifacts={billing.artifacts} copy={copy} />
      </DialogContent>
    </Dialog>
  );
}

export function BillingArtifactList({
  artifacts,
  copy,
  className = "max-h-[60vh]",
}: {
  artifacts: CmpBilling["artifacts"];
  copy: Copy;
  className?: string;
}) {
  const { locale } = useCmpI18n();
  const { toast } = useCmpToast();

  if (!artifacts.length) {
    return <p className="text-sm text-muted-foreground">{copy.noEvidence}</p>;
  }

  function previewArtifact(artifact: CmpBilling["artifacts"][number]) {
    void openAuthorizedPreviewWindow({
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
      loadBlob: () => api.loadCmpBillingArtifact(artifact.id),
    }).then((opened) => {
      if (!opened) {
        toast({ title: copy.previewFailed, variant: "destructive" });
      }
    });
  }

  function downloadArtifact(artifact: CmpBilling["artifacts"][number]) {
    void api.downloadCmpBillingArtifact(artifact.id).catch(() => {
      toast({ title: copy.downloadFailed, variant: "destructive" });
    });
  }

  return (
    <div className={`${className} space-y-2 overflow-y-auto`}>
      {artifacts.map((artifact) => (
        <div
          key={artifact.id}
          className="group flex overflow-hidden rounded-lg border border-border bg-background transition-colors hover:bg-muted/60"
        >
          <SharedButton
            variant="quiet"
            fullWidth
            size="sm"
            type="button"
            aria-label={copy.previewFile.replace(
              "{fileName}",
              artifact.fileName
            )}
            onClick={() => previewArtifact(artifact)}
            className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left text-sm"
          >
            <Eye className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span
                data-testid={`cmp-billing-artifact-name-${artifact.id}`}
                className="block leading-5 font-medium break-all"
              >
                {artifact.fileName}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {billingArtifactTypeLabel(artifact.type, copy)} ·{" "}
                {billingArtifactLocaleLabel(artifact.locale, copy)}
                {artifact.version ? ` · v${artifact.version}` : ""}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {copy.uploadedBy}: {artifact.uploadedBy.name} ·{" "}
                {formatBillingArtifactDate(artifact.createdAt, locale)}
              </span>
            </span>
          </SharedButton>
          <SharedButton
            variant="quiet"
            size="icon-sm"
            type="button"
            aria-label={copy.downloadFile.replace(
              "{fileName}",
              artifact.fileName
            )}
            title={copy.download}
            onClick={(event) => {
              event.stopPropagation();
              downloadArtifact(artifact);
            }}
            className="flex w-11 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Download className="size-4" />
          </SharedButton>
        </div>
      ))}
    </div>
  );
}

function billingArtifactTypeLabel(
  type: CmpBilling["artifacts"][number]["type"],
  copy: Copy
) {
  if (type === "INVOICE") {
    return copy.invoiceFile;
  }
  if (type === "CLIENT_PAYMENT_EVIDENCE") {
    return copy.clientPaymentEvidence;
  }
  return copy.financeReceipt;
}

function billingArtifactLocaleLabel(
  locale: CmpBilling["artifacts"][number]["locale"],
  copy: Copy
) {
  if (locale === "zh-CN") {
    return copy.documentChinese;
  }
  if (locale === "en-US") {
    return copy.documentEnglish;
  }
  return copy.notApplicable;
}

function formatBillingArtifactDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function BillingWorkflowDialog(props: BillingWorkflowDialogProps) {
  const { billing, copy, open, onOpenChange, pending, sentMethod, perform } =
    props;
  const action = workflowActionLabel(billing, copy);
  const isFinanceReconciliation =
    billing.status === "CLIENT_PAID" &&
    (billing.capabilities.canAddFinanceReceipt ||
      billing.capabilities.canReconcile);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isFinanceReconciliation
            ? "grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl"
            : "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        }
      >
        {isFinanceReconciliation ? (
          <BillingFinanceReconciliationDialog {...props} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{action ?? copy.status}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              {billing.status === "SUBMITTED" &&
              billing.capabilities.canApprove ? (
                <Button
                  disabled={pending}
                  onClick={() => {
                    perform(() =>
                      api.approveCmpBilling(billing.id, {
                        expectedVersion: billing.version,
                      })
                    );
                  }}
                >
                  <BadgeCheck className="size-4" />
                  {copy.approve}
                </Button>
              ) : null}
              {billing.status === "APPROVED" &&
              billing.capabilities.canMarkSent ? (
                <section className="space-y-2">
                  <label className="text-xs font-medium">
                    {copy.sentMethod}
                    <Input
                      value={sentMethod}
                      onChange={(event) =>
                        props.setSentMethod(event.target.value)
                      }
                      className="mt-1 h-9 w-full rounded border border-input bg-background px-2 text-sm"
                    />
                  </label>
                  <Button
                    className="w-full"
                    disabled={pending}
                    onClick={() => {
                      perform(() =>
                        api.markCmpBillingSent(billing.id, {
                          expectedVersion: billing.version,
                          method: sentMethod.trim() || "EMAIL",
                        })
                      );
                    }}
                  >
                    <Send className="size-4" />
                    {copy.markSent}
                  </Button>
                </section>
              ) : null}
              <EvidenceAndActions {...props} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BillingFinanceReconciliationDialog(props: BillingWorkflowDialogProps) {
  const {
    billing,
    copy,
    pending,
    bankProof,
    setBankProof,
    receipt,
    setReceipt,
    exchangeRates,
    overrideReason,
    setOverrideReason,
    perform,
  } = props;
  const canAddReceipt = billing.capabilities.canAddFinanceReceipt;
  const { canReconcile } = billing.capabilities;

  return (
    <>
      <DialogHeader className="border-b border-border/80 px-5 py-4 sm:px-6">
        <DialogTitle>{copy.reconcile}</DialogTitle>
        <p className="text-sm text-muted-foreground">{copy.evidenceHelp}</p>
      </DialogHeader>

      <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:overflow-hidden">
        <section className="min-h-0 space-y-3 border-b border-border/80 bg-muted/20 p-5 sm:p-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div>
            <h2 className="text-sm font-semibold">{copy.evidence}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {copy.evidenceHelp}
            </p>
          </div>
          <BillingArtifactList
            artifacts={billing.artifacts}
            copy={copy}
            className="max-h-[min(30dvh,22rem)] lg:max-h-none"
          />
        </section>

        <section className="min-h-0 space-y-4 p-5 sm:p-6 lg:overflow-y-auto">
          <div>
            <h2 className="text-sm font-semibold">{copy.financeReceipt}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {copy.exchangeRateSystemApplied}
            </p>
          </div>
          <ReceiptFields
            values={receipt}
            setValues={setReceipt}
            copy={copy}
            billCurrency={billing.currency}
            exchangeRates={exchangeRates}
          />
          <label className="block rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm font-medium">
            {copy.bankReceiptEvidence}
            <FileInput
              aria-label={copy.bankReceiptEvidence}

              onChange={(event) =>
                setBankProof(event.target.files?.[0] ?? null)
              }
              className="mt-2 block w-full cursor-pointer text-xs"
            />
            <span className="mt-2 block text-xs font-normal break-all text-muted-foreground">
              {bankProof ? bankProof.name : copy.chooseFileHint}
            </span>
          </label>
          {canReconcile ? (
            <label className="block text-sm text-muted-foreground">
              {copy.overrideReason}
              <Input
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
            </label>
          ) : null}
        </section>
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t border-border/80 bg-card px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        {canAddReceipt ? (
          <SharedButton
            className="sm:min-w-32"
            variant="outline"
            disabled={pending || !bankProof || !receipt.bankReference.trim()}
            onClick={() => {
              if (!bankProof) {
                return;
              }
              perform(() =>
                api.addCmpBillingFinanceReceipt(
                  billing.id,
                  { expectedVersion: billing.version, ...receipt },
                  bankProof
                )
              );
            }}
          >
            <Landmark className="size-4" />
            {copy.addReceipt}
          </SharedButton>
        ) : null}
        {canReconcile ? (
          <Button
            className="sm:min-w-36"
            disabled={pending}
            onClick={() => {
              perform(() =>
                api.reconcileCmpBilling(billing.id, {
                  expectedVersion: billing.version,
                  ...(overrideReason.trim() ? { overrideReason } : {}),
                })
              );
            }}
          >
            <ShieldCheck className="size-4" />
            {copy.reconcile}
          </Button>
        ) : null}
      </footer>
    </>
  );
}

function EvidenceAndActions(props: BillingWorkflowDialogProps) {
  const {
    billing,
    copy,
    pending,
    returnReason,
    setReturnReason,
    sentMethod,
    setSentMethod,
    clientProof,
    setClientProof,
    claim,
    setClaim,
    perform,
  } = props;
  return (
    <>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{copy.evidence}</h2>
        <p className="text-xs text-muted-foreground">{copy.evidenceHelp}</p>
        <BillingArtifactList artifacts={billing.artifacts} copy={copy} />
      </section>
      {billing.status === "SUBMITTED" && billing.capabilities.canReturn ? (
        <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <label className="text-xs font-medium">
            {copy.returnReason}
            <Input
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              className="mt-1 h-9 w-full rounded border border-input bg-background px-2 text-sm"
            />
          </label>
          <Button
            className="w-full"
            variant="outline"
            disabled={pending || !returnReason.trim()}
            onClick={() => {
              perform(() =>
                api.returnCmpBilling(billing.id, {
                  expectedVersion: billing.version,
                  reason: returnReason,
                })
              );
            }}
          >
            {copy.returnDraft}
          </Button>
        </section>
      ) : null}
      {billing.status === "APPROVED" && billing.capabilities.canMarkSent ? (
        <section className="space-y-2">
          <label className="text-xs font-medium">
            {copy.sentMethod}
            <Input
              value={sentMethod}
              onChange={(event) => setSentMethod(event.target.value)}
              className="mt-1 h-9 w-full rounded border border-input bg-background px-2 text-sm"
            />
          </label>
        </section>
      ) : null}
      {billing.status === "SENT" &&
      billing.capabilities.canClaimClientPayment ? (
        <section className="space-y-2 rounded-lg border border-border p-3">
          <h2 className="text-sm font-semibold">{copy.clientClaim}</h2>
          <ClaimFields
            values={claim}
            setValues={setClaim}
            copy={copy}
            billCurrency={billing.currency}
          />
          <label className="block rounded-md border border-dashed border-border bg-muted/20 p-2 text-xs font-medium">
            {copy.clientPaymentEvidence}
            <FileInput
              aria-label={copy.clientPaymentEvidence}

              onChange={(event) =>
                setClientProof(event.target.files?.[0] ?? null)
              }
              className="mt-1 block w-full cursor-pointer text-xs"
            />
            <span className="mt-1 block font-normal text-muted-foreground">
              {clientProof ? clientProof.name : copy.chooseFileHint}
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            {copy.clientPaymentHint}
          </p>
          <Button
            className="w-full"
            disabled={pending || !clientProof || !claim.reference.trim()}
            onClick={() => {
              if (!clientProof) {
                return;
              }
              perform(() =>
                api.claimCmpBillingClientPayment(
                  billing.id,
                  { expectedVersion: billing.version, ...claim },
                  clientProof
                )
              );
            }}
          >
            <Upload className="size-4" />
            {copy.claimPaid}
          </Button>
        </section>
      ) : null}
    </>
  );
}

function ClaimFields({
  values,
  setValues,
  copy,
  billCurrency,
}: {
  values: BillingClaimState;
  setValues: Dispatch<SetStateAction<BillingClaimState>>;
  copy: Copy;
  billCurrency: CmpBilling["currency"];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        aria-label={copy.amount}
        value={values.amount}
        onChange={(event) =>
          setValues({ ...values, amount: event.target.value })
        }
        placeholder={copy.amount}
        className="h-9 rounded border border-input bg-background px-2 text-sm"
      />
      <SelectField
        label={copy.currency}
        labelVisibility="hidden"
        value={values.currency}
        disabled
        onValueChange={(currency) =>
          setValues({
            ...values,
            currency: currency as BillingClaimState["currency"],
          })
        }
        options={[{ value: billCurrency, label: billCurrency }]}
      />
      <Input
        aria-label={copy.date}
        type="date"
        value={values.paidAt}
        onChange={(event) =>
          setValues({ ...values, paidAt: event.target.value })
        }
        className="h-9 rounded border border-input bg-background px-2 text-sm"
      />
      <Input
        aria-label={copy.reference}
        value={values.reference}
        onChange={(event) =>
          setValues({ ...values, reference: event.target.value })
        }
        placeholder={copy.reference}
        className="h-9 rounded border border-input bg-background px-2 text-sm"
      />
    </div>
  );
}
function ReceiptFields({
  values,
  setValues,
  copy,
  billCurrency,
  exchangeRates,
}: {
  values: BillingReceiptState;
  setValues: Dispatch<SetStateAction<BillingReceiptState>>;
  copy: Copy;
  billCurrency: CmpBilling["currency"];
  exchangeRates?: BillingExchangeRates;
}) {
  const conversion = billingConversionPreview(
    values.currency,
    billCurrency,
    exchangeRates?.rates,
    copy
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        aria-label={copy.amount}
        value={values.amount}
        onChange={(event) =>
          setValues({ ...values, amount: event.target.value })
        }
        placeholder={copy.amount}
        className="h-9 rounded border border-input bg-background px-2 text-sm"
      />
      <SelectField
        label={copy.currency}
        labelVisibility="hidden"
        value={values.currency}
        onValueChange={(currency) =>
          setValues({
            ...values,
            currency: currency as BillingReceiptState["currency"],
          })
        }
        options={CURRENCIES.map((currency) => ({
          value: currency,
          label: currency,
        }))}
      />
      <Input
        aria-label={copy.date}
        type="date"
        value={values.receiptDate}
        onChange={(event) =>
          setValues({ ...values, receiptDate: event.target.value })
        }
        className="h-9 rounded border border-input bg-background px-2 text-sm"
      />
      <Input
        aria-label={copy.bankReference}
        value={values.bankReference}
        onChange={(event) =>
          setValues({ ...values, bankReference: event.target.value })
        }
        placeholder={copy.bankReference}
        className="h-9 rounded border border-input bg-background px-2 text-sm"
      />
      <div className="col-span-2 grid gap-0.5 rounded border border-input bg-muted/35 px-2.5 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">
          {copy.exchangeRateSystem}
        </span>
        <span>{conversion ?? copy.exchangeRateUnavailable}</span>
      </div>
      <Textarea
        aria-label={copy.internalNote}
        value={values.internalNote}
        onChange={(event) =>
          setValues({ ...values, internalNote: event.target.value })
        }
        placeholder={copy.internalNote}
        className="col-span-2 min-h-20 rounded border border-input bg-background px-2 py-2 text-sm"
      />
    </div>
  );
}

export function billingConversionPreview(
  receiptCurrency: string,
  billCurrency: string,
  rates: { currency: string; hkdPerUnit: string }[] | undefined,
  copy: Copy
) {
  if (!rates) {
    return null;
  }
  const receiptRate = rates.find((rate) => rate.currency === receiptCurrency);
  const billRate = rates.find((rate) => rate.currency === billCurrency);
  if (!receiptRate || !billRate) {
    return null;
  }
  const value =
    receiptCurrency === billCurrency
      ? 1
      : Number(receiptRate.hkdPerUnit) / Number(billRate.hkdPerUnit);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  }).format(value);
  return `1 ${receiptCurrency} = ${formatted} ${billCurrency} · ${copy.exchangeRateSystemApplied}`;
}

function StatusPill({
  status,
  copy,
}: {
  status: CmpBilling["status"];
  copy: Copy;
}) {
  return (
    <CmpDataGridStatusBadge tone={billingStatusTone(status)}>
      {billingStatusLabel(status, copy)}
    </CmpDataGridStatusBadge>
  );
}

export function CollectionOverview({
  overview,
  copy,
  locale,
  rows = EMPTY_BILLINGS,
  activeStatusGroup = null,
  onSelectStatusGroup,
}: {
  overview?: CmpBillingCollectionOverview;
  copy: Copy;
  locale: CmpFeeNoteLocale;
  rows?: CmpBilling[];
  activeStatusGroup?: BillingStatusGroup | null;
  onSelectStatusGroup?: (group: BillingStatusGroup) => void;
}) {
  const phone = useCompactViewport(767.98);
  const [open, setOpen] = useState(false);
  if (!overview) {
    return null;
  }
  const hasOverReceived = Number(overview.overReceived) > 0;
  const { engagement } = overview;
  const workspaceCopy = getCmpDictionary(locale).workspace;
  const engagementStatusLabels = {
    ACTIVE: workspaceCopy.clientStatusActive,
    INACTIVE: workspaceCopy.clientStatusInactive,
    COMPLETED: workspaceCopy.engagementStatusCompleted,
    ARCHIVED: workspaceCopy.engagementStatusArchived,
  };
  const content = (
    <section
      className={
        phone
          ? mobileStyles.collectionOverview
          : "mb-3 overflow-hidden border-y border-border bg-background"
      }
    >
      <div
        className={
          phone
            ? mobileStyles.collectionOverviewHeader
            : "flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5"
        }
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {!phone && (
              <h2 className="text-sm font-semibold">
                {copy.collectionOverview}
              </h2>
            )}
            {engagement ? (
              <span
                className={
                  phone
                    ? mobileStyles.collectionOverviewIdentity
                    : "inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs"
                }
              >
                <strong className="truncate font-mono">
                  {engagement.engagementCode}
                </strong>
                <span
                  className={
                    phone
                      ? mobileStyles.collectionOverviewClient
                      : "truncate text-muted-foreground"
                  }
                >
                  {engagement.clientName || copy.unnamedClient}
                </span>
                <span
                  className={
                    phone
                      ? mobileStyles.collectionOverviewStatus
                      : "text-primary"
                  }
                >
                  {engagementStatusLabels[engagement.status]}
                </span>
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {copy.collectionOverviewHint}
          </p>
        </div>
      </div>
      <div
        className={
          phone
            ? mobileStyles.collectionOverviewContent
            : "grid gap-3 p-3 sm:p-4 lg:grid-cols-[9.5rem_minmax(0,1fr)] lg:items-center"
        }
      >
        <CollectionDonut overview={overview} copy={copy} locale={locale} />
        <div className="min-w-0">
          <dl className="grid gap-2 sm:grid-cols-3">
            {[
              [copy.agreedFee, overview.agreedFee],
              [copy.actualReceived, overview.actualReceived],
              [copy.outstanding, overview.outstanding],
            ].map(([label, value]) => (
              <div
                key={label}
                className={
                  phone
                    ? mobileStyles.collectionMetric
                    : "rounded-lg bg-muted/45 px-3 py-2.5"
                }
              >
                <dt className="text-xs font-medium text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums">
                  {money(String(value), overview.currency, locale)}
                </dd>
              </div>
            ))}
          </dl>
          {hasOverReceived ? (
            <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-400">
              {copy.overReceived}:{" "}
              {money(overview.overReceived, overview.currency, locale)}
            </p>
          ) : null}
          {rows.length ? (
            <BillingQueueDistribution
              rows={rows}
              copy={copy}
              activeStatusGroup={activeStatusGroup}
              onSelectStatusGroup={onSelectStatusGroup}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
  if (phone) {
    const activeLabel = activeStatusGroup
      ? {
          DRAFT: copy.draft,
          APPROVAL: copy.inApproval,
          SENT: copy.sent,
          CLIENT_PAID: copy.clientPaid,
          RECONCILED: copy.reconciled,
        }[activeStatusGroup]
      : "";
    return (
      <>
        <Button
          className="cmp-mobile-billing-overview"
          variant={activeStatusGroup ? "secondary" : "outline"}
          aria-label={copy.collectionOverview}
          onClick={() => setOpen(true)}
        >
          {copy.collectionOverview} ·{" "}
          {overview.receivedRate === null
            ? "—"
            : `${Number(overview.receivedRate).toFixed(2)}%`}
          {activeLabel ? ` · ${activeLabel}` : ""}
        </Button>
        <MobileActionSheet
          title={copy.collectionOverview}
          closeLabel={copy.cancel}
          open={open}
          onOpenChange={setOpen}
        >
          {content}
        </MobileActionSheet>
      </>
    );
  }
  return content;
}

function BillingQueueDistribution({
  rows,
  copy,
  activeStatusGroup,
  onSelectStatusGroup,
}: {
  rows: CmpBilling[];
  copy: Copy;
  activeStatusGroup: BillingStatusGroup | null;
  onSelectStatusGroup?: (group: BillingStatusGroup) => void;
}) {
  const groups: {
    key: BillingStatusGroup;
    label: string;
    count: number;
    color: string;
  }[] = [
    {
      key: "DRAFT",
      label: copy.draft,
      count: rows.filter((billing) => billing.status === "DRAFT").length,
      color: "bg-slate-400",
    },
    {
      key: "APPROVAL",
      label: copy.inApproval,
      count: rows.filter(
        (billing) =>
          billing.status === "SUBMITTED" || billing.status === "APPROVED"
      ).length,
      color: "bg-violet-500",
    },
    {
      key: "SENT",
      label: copy.sent,
      count: rows.filter((billing) => billing.status === "SENT").length,
      color: "bg-amber-500",
    },
    {
      key: "CLIENT_PAID",
      label: copy.clientPaid,
      count: rows.filter((billing) => billing.status === "CLIENT_PAID").length,
      color: "bg-sky-500",
    },
    {
      key: "RECONCILED",
      label: copy.reconciled,
      count: rows.filter((billing) => billing.status === "RECONCILED").length,
      color: "bg-primary",
    },
  ];
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <div className="mt-3 border-t border-border/70 pt-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {copy.queueDistribution}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {groups
          .filter((group) => group.count > 0)
          .map((group) => (
            <span
              key={group.key}
              className={group.color}
              style={{ flexGrow: group.count }}
              title={`${group.label}: ${group.count}`}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {groups.map((group) => (
          <Button
            key={group.key}
            type="button"
            aria-pressed={activeStatusGroup === group.key}
            onClick={() => onSelectStatusGroup?.(group.key)}
            size="sm"
            variant="quiet"
            className={`h-6 gap-1.5 px-1.5 text-xs ${activeStatusGroup === group.key ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground"}`}
          >
            <span className={`size-2 rounded-full ${group.color}`} />
            {group.label}
            <span className="tabular-nums">{group.count}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function CollectionDonut({
  overview,
  copy,
  locale,
}: {
  overview: CmpBillingCollectionOverview;
  copy: Copy;
  locale: CmpFeeNoteLocale;
}) {
  const titleId = useId();
  const rawRate =
    overview.receivedRate === null ? null : Number(overview.receivedRate);
  const receivedPercent =
    rawRate !== null && Number.isFinite(rawRate) ? Math.max(0, rawRate) : 0;
  const visualPercent = Math.min(receivedPercent, 100);
  const receivedLabel = money(
    overview.actualReceived,
    overview.currency,
    locale
  );
  const agreedLabel = money(overview.agreedFee, overview.currency, locale);
  const percentageLabel =
    rawRate === null ? "—" : `${receivedPercent.toFixed(2)}%`;
  const centerPrimary = percentageLabel;
  const centerSecondary = copy.receivedRatio;

  return (
    <div className="mx-auto grid w-full max-w-[9.5rem] place-items-center text-center">
      <svg
        viewBox="0 0 160 160"
        // Inline SVG has no equivalent native HTML image tag without losing its dynamic contents.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="img"
        aria-labelledby={titleId}
        className="size-32 max-w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <title id={titleId}>
          {copy.collectionRatioDescription
            .replace("{received}", receivedLabel)
            .replace("{agreed}", agreedLabel)
            .replace("{rate}", percentageLabel)}
        </title>
        <circle
          cx="80"
          cy="80"
          r="56"
          fill="none"
          strokeWidth="16"
          className="stroke-muted"
        />
        {rawRate !== null && visualPercent > 0 ? (
          <circle
            key={`${overview.scope}-${overview.engagement?.id ?? "all"}-${visualPercent}`}
            cx="80"
            cy="80"
            r="56"
            fill="none"
            strokeWidth="16"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="100 100"
            transform="rotate(-90 80 80)"
            className="cmp-billing-collection-donut-arc stroke-primary"
            style={
              {
                "--cmp-billing-donut-offset": 100 - visualPercent,
              } as CSSProperties
            }
          />
        ) : null}
        <g
          key={`${overview.scope}-${overview.engagement?.id ?? "all"}-${percentageLabel}`}
          className="cmp-billing-collection-donut-label"
        >
          <text
            x="80"
            y="75"
            textAnchor="middle"
            className="fill-foreground text-[24px] font-semibold"
          >
            {centerPrimary}
          </text>
          <text
            x="80"
            y="97"
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {centerSecondary}
          </text>
        </g>
      </svg>
      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          {copy.actualReceived}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full bg-muted-foreground/35"
            aria-hidden="true"
          />
          {copy.outstanding}
        </span>
      </div>
    </div>
  );
}

type BillingEditorDraft = {
  issueDate: string;
  currency: CmpBilling["currency"];
  lineItems: {
    key: string;
    id?: string;
    descriptionZh: string;
    descriptionEn: string;
    amount: string;
  }[];
  clientSnapshot: Record<string, unknown>;
  firmSnapshot: Record<string, unknown>;
  localizedContent: CmpBilling["localizedContent"];
};

const BILLING_LOCALIZED_FIELDS = new Set<FeeNoteField>([
  "recipientName",
  "recipientAttention",
  "recipientSalutation",
  "recipientAddress",
  "serviceDescription",
  "signatoryName",
  "bankPayeeName",
  "bankName",
  "firmLegalName",
  "firmAddress",
]);

const SNAPSHOT_FIELDS: Partial<Record<FeeNoteField, string>> = {
  issuerReference: "issuerReference",
  hkdAccountNumber: "hkdAccountNumber",
  cnyAccountNumber: "cnyAccountNumber",
  usdAccountNumber: "usdAccountNumber",
  swiftCode: "swiftCode",
  hkdSwiftCode: "hkdSwiftCode",
  cnySwiftCode: "cnySwiftCode",
  usdSwiftCode: "usdSwiftCode",
  firmPhone: "phone",
  firmFax: "fax",
  firmEmail: "email",
  firmWebsite: "website",
};

function asDraft(billing: CmpBilling): BillingEditorDraft {
  return {
    issueDate: billing.issueDate,
    currency: billing.currency,
    lineItems: billing.lineItems.map((line) => ({
      key: line.id,
      id: line.id,
      descriptionZh: line.descriptionZh,
      descriptionEn: line.descriptionEn,
      amount: line.amount,
    })),
    clientSnapshot: { ...billing.clientSnapshot },
    firmSnapshot: { ...billing.firmSnapshot },
    localizedContent: {
      "zh-CN": {
        ...billing.localizedContent["zh-CN"],
        lineItemDescriptions: {
          ...billing.localizedContent["zh-CN"].lineItemDescriptions,
        },
      },
      "en-US": {
        ...billing.localizedContent["en-US"],
        lineItemDescriptions: {
          ...billing.localizedContent["en-US"].lineItemDescriptions,
        },
      },
    },
  };
}

function billingDraftInput(
  expectedVersion: number,
  draft: BillingEditorDraft,
  importAudit?: CmpBillingImportAudit
) {
  return {
    expectedVersion,
    issueDate: draft.issueDate,
    currency: draft.currency,
    lineItems: draft.lineItems.map((line, sortOrder) => ({
      ...(line.id ? { id: line.id } : {}),
      descriptionZh: line.descriptionZh,
      descriptionEn: line.descriptionEn,
      amount: line.amount || "0.00",
      sortOrder,
    })),
    clientSnapshot: draft.clientSnapshot,
    firmSnapshot: draft.firmSnapshot,
    localizedContent: draft.localizedContent,
    ...(importAudit ? { importAudit } : {}),
  };
}

export function updateBillingDocumentDraft<K extends FeeNoteField>(
  draft: BillingEditorDraft,
  locale: CmpFeeNoteLocale,
  field: K,
  value: CmpEngagementFeeNote[K]
): BillingEditorDraft {
  if (field === "issueDate") {
    return { ...draft, issueDate: String(value ?? "") };
  }
  if (field === "currency") {
    return { ...draft, currency: value as BillingEditorDraft["currency"] };
  }
  if (field === "lineItems") {
    const visible = Array.isArray(value) ? value : [];
    return {
      ...draft,
      lineItems: visible.map((item) => {
        const existing = draft.lineItems.find((line) => line.key === item.id);
        return {
          key: item.id,
          ...(existing?.id ? { id: existing.id } : {}),
          descriptionZh:
            locale === "zh-CN"
              ? item.description
              : (existing?.descriptionZh ?? ""),
          descriptionEn:
            locale === "en-US"
              ? item.description
              : (existing?.descriptionEn ?? ""),
          amount: item.amount,
        };
      }),
    } as BillingEditorDraft;
  }
  if (BILLING_LOCALIZED_FIELDS.has(field)) {
    const localizedField =
      field as keyof CmpBilling["localizedContent"][CmpFeeNoteLocale];
    return {
      ...draft,
      localizedContent: {
        ...draft.localizedContent,
        [locale]: {
          ...draft.localizedContent[locale],
          [localizedField]: String(value ?? ""),
        },
      },
    } as BillingEditorDraft;
  }
  const snapshotField = SNAPSHOT_FIELDS[field];
  if (snapshotField) {
    return {
      ...draft,
      firmSnapshot: {
        ...draft.firmSnapshot,
        [snapshotField]: String(value ?? ""),
      },
    };
  }
  return draft;
}

export function billingAsFeeNote(
  billing: CmpBilling,
  draft: BillingEditorDraft,
  locale: CmpFeeNoteLocale
): CmpEngagementFeeNote {
  const localizedContent = {
    "zh-CN": {
      ...draft.localizedContent["zh-CN"],
      lineItemDescriptions: Object.fromEntries(
        draft.lineItems.map((line) => [line.key, line.descriptionZh])
      ),
    },
    "en-US": {
      ...draft.localizedContent["en-US"],
      lineItemDescriptions: Object.fromEntries(
        draft.lineItems.map((line) => [line.key, line.descriptionEn])
      ),
    },
  };
  const content = localizedContent[locale];
  const total = draft.lineItems
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
    .toFixed(2);
  const receivedAmount = billing.receiptTotalInBillCurrency || "0.00";
  const outstandingAmount = billing.remainingAmount || total;
  const issued = ["SENT", "CLIENT_PAID", "RECONCILED"].includes(billing.status);
  const collectionStatus: CmpEngagementFeeNote["collectionStatus"] = issued
    ? Number(outstandingAmount) <= 0
      ? "RECEIVED"
      : Number(receivedAmount) > 0
        ? "PARTIALLY_RECEIVED"
        : "UNRECORDED"
    : "UNISSUED";
  return {
    id: billing.id,
    engagementId: billing.engagementId,
    periodNumber: 1,
    plannedIssueDate: draft.issueDate,
    plannedAmount: total,
    receivedAmount,
    receivedDate: billing.financeReceipts?.at(-1)?.receiptDate ?? "",
    collectionStatus,
    outstandingAmount,
    feeNoteNumber: billing.billNumber,
    engagementReference: billing.engagementCode,
    issueDate: draft.issueDate,
    recipientName: content.recipientName,
    recipientAttention: content.recipientAttention,
    recipientSalutation: content.recipientSalutation,
    recipientAddress: content.recipientAddress,
    currency: draft.currency,
    serviceDescription: content.serviceDescription,
    lineItems: draft.lineItems.map((line) => ({
      id: line.key,
      description: locale === "zh-CN" ? line.descriptionZh : line.descriptionEn,
      amount: line.amount,
    })),
    amount: total,
    disbursementAmount: "0.00",
    totalAmount: total,
    issuerReference: snapshotText(
      draft.firmSnapshot,
      "issuerReference",
      billing.engagementCode
    ),
    signatoryName: content.signatoryName,
    bankPayeeName: content.bankPayeeName,
    bankPayeeNameZh: localizedContent["zh-CN"].bankPayeeName,
    bankName: content.bankName,
    hkdAccountNumber: snapshotText(draft.firmSnapshot, "hkdAccountNumber"),
    cnyAccountNumber: snapshotText(draft.firmSnapshot, "cnyAccountNumber"),
    usdAccountNumber: snapshotText(draft.firmSnapshot, "usdAccountNumber"),
    swiftCode: snapshotText(draft.firmSnapshot, "swiftCode"),
    hkdSwiftCode: snapshotText(draft.firmSnapshot, "hkdSwiftCode"),
    cnySwiftCode: snapshotText(draft.firmSnapshot, "cnySwiftCode"),
    usdSwiftCode: snapshotText(draft.firmSnapshot, "usdSwiftCode"),
    firmLegalName: content.firmLegalName,
    firmAddress: content.firmAddress,
    firmPhone: snapshotText(draft.firmSnapshot, "phone"),
    firmFax: snapshotText(draft.firmSnapshot, "fax"),
    firmEmail: snapshotText(draft.firmSnapshot, "email"),
    firmWebsite: snapshotText(draft.firmSnapshot, "website"),
    localizedContent,
    createdAt: billing.createdAt,
    updatedAt: billing.updatedAt,
  };
}

function snapshotText(
  snapshot: Record<string, unknown>,
  field: string,
  fallback = ""
) {
  const value = snapshot[field];
  return typeof value === "string" ? value : fallback;
}
function billingQueueFromSearchParams(
  value: string | null,
  fallback: BillingQueue
): BillingQueue {
  return value === "ALL" ||
    value === "PENDING_RECONCILIATION" ||
    value === "RECONCILED"
    ? value
    : fallback;
}
function BillingLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/25">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
    </main>
  );
}

export { billingCopy } from "@/i18n/billing";
