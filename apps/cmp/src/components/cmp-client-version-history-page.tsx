"use client";

import type {
  CmpAcceptanceChangeSummary,
  CmpClient,
  CmpClientVersion,
} from "@project-wing/shared";
import {
  Button,
  MobileActionSheet,
  useCompactViewport,
  ButtonGroup,
  Input,
  ProjectWingLoadingProgress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  projectWingToast,
} from "@project-wing/ui";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { api } from "@/api/client";
import { CmpAppShell } from "@/components/cmp-app-shell";
import { useCmpSignOut } from "@/components/cmp-auth-adapter";
import { useCmpI18n } from "@/i18n/client";

export function CmpClientVersionHistoryPage({
  clientId,
}: {
  clientId: string;
}) {
  const phone = useCompactViewport(767.98);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const router = useRouter();
  const { dictionary, localizedPath } = useCmpI18n();
  const signOut = useCmpSignOut();
  const copy = dictionary.clientVersions;
  const [changedById, setChangedById] = useState("");
  const [field, setField] = useState("");
  const [requestNo, setRequestNo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null
  );
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const versions = useQuery({
    queryKey: [
      "cmp-client-versions",
      clientId,
      changedById,
      field,
      requestNo,
      from,
      to,
      page,
    ],
    queryFn: () =>
      api.cmpClientVersions(clientId, {
        changedById: changedById || undefined,
        field: field || undefined,
        requestNo: requestNo || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
      }),
    enabled: Boolean(me.data),
  });

  if (me.isLoading || versions.isLoading) {
    return <ProjectWingLoadingProgress />;
  }
  if (!me.data) {
    return null;
  }
  if (versions.isError) {
    return (
      <CmpAppShell
        activeSection="clients"
        user={me.data}
        onSignOut={() => void signOut()}
      >
        <main className="grid h-full place-items-center px-6">
          <section className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => void versions.refetch()}
            >
              {copy.retry}
            </Button>
          </section>
        </main>
      </CmpAppShell>
    );
  }
  const client = versions.data?.client;
  const allVersions = versions.data?.versions ?? [];
  const current = versions.data?.currentVersion ?? undefined;
  const editorOptions = [
    ...new Map(
      allVersions.map((item) => [
        item.changedBy.id ?? item.changedBy.name,
        item.changedBy,
      ])
    ).values(),
  ];
  const fieldOptions = [
    ...new Set(allVersions.flatMap((item) => item.changedFields)),
  ];
  const totalPages = Math.max(1, Math.ceil((versions.data?.total ?? 0) / 25));
  const versionFilters = (
    <aside className="cmp-version-filters">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Search className="size-4" />
        {dictionary.workspace.filters}
      </div>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        {copy.filterRequest}
        <Input
          value={requestNo}
          onChange={(event) => {
            setRequestNo(event.target.value);
            setPage(1);
          }}
        />
      </label>
      <label className="mt-3 grid gap-1.5 text-xs font-medium text-muted-foreground">
        {copy.filterRequester}
        <Select
          value={changedById || "_ALL"}
          onValueChange={(value) => {
            setChangedById(value === "_ALL" ? "" : (value ?? ""));
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue>
              {changedById
                ? (editorOptions.find((editor) => editor.id === changedById)
                    ?.name ?? copy.all)
                : copy.all}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_ALL">{copy.all}</SelectItem>
            {editorOptions.map((editor) => (
              <SelectItem
                key={editor.id ?? editor.name}
                value={editor.id ?? editor.name}
              >
                {editor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="mt-3 grid gap-1.5 text-xs font-medium text-muted-foreground">
        {copy.filterField}
        <Select
          value={field || "_ALL"}
          onValueChange={(value) => {
            setField(value === "_ALL" ? "" : (value ?? ""));
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue>{field || copy.all}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_ALL">{copy.all}</SelectItem>
            {fieldOptions.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="mt-3 grid gap-1.5 text-xs font-medium text-muted-foreground">
        {copy.filterDate}
        <Input
          type="date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
        />
      </label>
      <Input
        type="date"
        aria-label={`${copy.filterDate} end`}
        className="mt-2"
        value={to}
        onChange={(event) => {
          setTo(event.target.value);
          setPage(1);
        }}
      />
    </aside>
  );

  return (
    <CmpAppShell
      activeSection="clients"
      user={me.data}
      onSignOut={() => void signOut()}
    >
      <main
        className="cmp-version-page"
        data-testid="cmp-client-version-history"
      >
        <header className="cmp-version-hero">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {client?.clientCode}
            </p>
            <h1>{copy.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {client ? clientName(client) : ""}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(localizedPath("/client"))}
          >
            {copy.back}
          </Button>
        </header>
        {client ? (
          <VersionSummary
            client={client}
            current={current}
            count={versions.data?.total ?? 0}
            copy={copy}
          />
        ) : null}
        <div className="cmp-version-workspace">
          <section className="cmp-version-list">
            {allVersions.length > 0 ? (
              <>
                <ol className="divide-y divide-border">
                  {allVersions.map((version) => (
                    <VersionRow
                      key={version.id}
                      version={version}
                      copy={copy}
                      onOpen={() => setSelectedVersionId(version.id)}
                    />
                  ))}
                </ol>
                <div className="cmp-version-pagination">
                  <span className="mr-auto text-xs text-muted-foreground">
                    {copy.page
                      .replace("{page}", String(page))
                      .replace("{total}", String(totalPages))}
                  </span>
                  <ButtonGroup>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      {copy.previousPage}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      {copy.nextPage}
                    </Button>
                  </ButtonGroup>
                </div>
              </>
            ) : (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {copy.noVersions}
              </div>
            )}
          </section>
          {phone ? (
            <>
              <Button
                className="cmp-version-filter-trigger"
                variant="outline"
                onClick={() => setFiltersOpen(true)}
              >
                {dictionary.workspace.filters}
              </Button>
              <MobileActionSheet
                title={dictionary.workspace.filters}
                closeLabel={dictionary.shell.close}
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
              >
                {versionFilters}
              </MobileActionSheet>
            </>
          ) : (
            versionFilters
          )}
        </div>
      </main>
      {selectedVersionId ? (
        <VersionDetailModal
          clientId={clientId}
          versionId={selectedVersionId}
          onClose={() => setSelectedVersionId(null)}
        />
      ) : null}
    </CmpAppShell>
  );
}

function VersionSummary({
  client: _client,
  current,
  count,
  copy,
}: {
  client: CmpClient;
  current?: CmpClientVersion;
  count: number;
  copy: Record<string, string>;
}) {
  return (
    <section className="cmp-version-summary">
      <div>
        <p className="text-xs text-muted-foreground">{copy.currentVersion}</p>
        <strong className="mt-1 block text-xl text-primary">
          {current ? `v${current.versionNumber}` : "—"}
        </strong>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{copy.totalVersions}</p>
        <strong className="mt-1 block text-xl">{count}</strong>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{copy.latestUpdate}</p>
        <strong className="mt-1 block text-sm">
          {current ? formatDate(current.approvedAt ?? current.createdAt) : "—"}
        </strong>
      </div>
    </section>
  );
}

function VersionRow({
  version,
  copy,
  onOpen,
}: {
  version: CmpClientVersion;
  copy: Record<string, string>;
  onOpen: () => void;
}) {
  const baseline = version.sourceType === "BASELINE";
  return (
    <li className="cmp-version-row">
      <div>
        <strong className="text-lg">v{version.versionNumber}</strong>
        <p className="mt-1 text-xs text-muted-foreground">
          {baseline ? copy.baselineVersion : copy.version}
        </p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <strong>
            {baseline
              ? copy.initialVersion
              : (version.acceptanceRequestNo ?? "—")}
          </strong>
          <span className="text-muted-foreground">
            {formatDate(version.approvedAt ?? version.createdAt)}
          </span>
        </div>
        <p className="mt-2 text-sm">
          {copy.changedBy}: <strong>{version.changedBy.name}</strong>
          {version.approvedBy ? (
            <>
              <span className="mx-2 text-muted-foreground">·</span>
              {copy.approvedBy}: <strong>{version.approvedBy.name}</strong>
            </>
          ) : null}
        </p>
        {version.changedFields.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {version.changedFields.slice(0, 6).map((field) => (
              <span key={field} className="cmp-version-field">
                {field}
              </span>
            ))}
            {version.changedFields.length > 6 ? (
              <span className="text-xs text-muted-foreground">
                +{version.changedFields.length - 6}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {copy.initialVersion}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onOpen}>
        {copy.viewVersion}
      </Button>
    </li>
  );
}

function VersionDetailModal({
  clientId,
  versionId,
  onClose,
}: {
  clientId: string;
  versionId: string;
  onClose: () => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.clientVersions;
  const [mode, setMode] = useState<"snapshot" | "compare">("snapshot");
  const detail = useQuery({
    queryKey: ["cmp-client-version", clientId, versionId],
    queryFn: () => api.cmpClientVersion(clientId, versionId),
  });
  const comparison = useQuery({
    queryKey: ["cmp-client-version-compare", clientId, versionId],
    queryFn: () =>
      api.cmpClientVersionComparison(clientId, versionId) as Promise<{
        isCurrent: boolean;
        changes: CmpAcceptanceChangeSummary;
      }>,
    enabled: mode === "compare",
  });
  const version = detail.data;
  return (
    <div className="cmp-modal-backdrop" role="presentation">
      <dialog
        open
        className="cmp-modal cmp-version-modal m-0 w-[min(72rem,calc(100vw-2rem))] max-w-none"
        aria-modal="true"
        aria-label={copy.title}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold">
              {version ? (
                `v${version.versionNumber} · ${copy.fullInformation}`
              ) : (
                <Skeleton className="inline-block h-6 w-48 rounded-sm" />
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.historicalSnapshot}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            accessibleName={copy.close}
            onClick={onClose}
          >
            <X />
          </Button>
        </header>
        {detail.isLoading ? (
          <div className="space-y-4 px-6 py-5" aria-busy="true">
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        ) : version ? (
          <div className="max-h-[70vh] overflow-auto px-6 py-5">
            <ButtonGroup className="mb-5">
              <Button
                size="sm"
                variant={mode === "snapshot" ? "default" : "outline"}
                onClick={() => setMode("snapshot")}
              >
                {copy.fullInformation}
              </Button>
              <Button
                size="sm"
                variant={mode === "compare" ? "default" : "outline"}
                onClick={() => setMode("compare")}
              >
                {copy.compareCurrent}
              </Button>
            </ButtonGroup>
            {mode === "snapshot" ? (
              <SnapshotView snapshot={version.snapshot} />
            ) : (
              <ComparisonView
                result={comparison.data}
                loading={comparison.isLoading}
                error={comparison.isError}
                copy={copy}
                onRetry={() => void comparison.refetch()}
              />
            )}
          </div>
        ) : (
          <div className="p-8 text-sm text-muted-foreground">
            <Button
              className="ml-3"
              size="sm"
              variant="outline"
              onClick={() => void detail.refetch()}
            >
              {copy.retry}
            </Button>
          </div>
        )}
        <footer className="flex justify-between border-t border-border px-6 py-4">
          <Button
            variant="outline"
            disabled={!version}
            onClick={() => {
              if (!version) {
                return;
              }
              window.open(
                api.cmpClientVersionPdfUrl(clientId, version.id),
                "_blank",
                "noopener,noreferrer"
              );
              projectWingToast.success(copy.exportStarted);
            }}
          >
            <Download />
            {copy.exportPdf}
          </Button>
          <Button onClick={onClose}>{copy.close}</Button>
        </footer>
      </dialog>
    </div>
  );
}

function SnapshotView({ snapshot }: { snapshot: CmpClient }) {
  const sections = useMemo(
    () => [
      [
        "Basic information",
        [
          ["Client Code", snapshot.clientCode],
          ["Company code", snapshot.companyCode],
          ["Company number", snapshot.companyNumber],
          ["English name", snapshot.nameEn],
          ["Chinese name", snapshot.nameZh],
          ["Status", snapshot.status],
          ["Year end month", snapshot.yearEndMonth],
          ["Reporting GAAP", snapshot.reportingGaap],
          ["Website", snapshot.website],
        ],
      ],
      [
        "Addresses and contact",
        [
          ["Registered address", snapshot.address],
          ["Address details", snapshot.addresses],
          ["Contact person", snapshot.contactPerson],
          ["Position", snapshot.contactPosition],
          ["Department", snapshot.contactDepartment],
          ["Office telephone", snapshot.telephone],
          ["Mobile", snapshot.contactMobile],
          ["Email", snapshot.email],
          ["Contact notes", snapshot.contactRemarks],
        ],
      ],
      [
        "Incorporation, industry and regulation",
        [
          ["Place of incorporation", snapshot.placeOfIncorporation],
          ["Incorporation year / month", snapshot.incorporationYearMonth],
          ["Industry", snapshot.hsicSectionCode],
          ["Other industry description", snapshot.industryOtherDescription],
          ["Listed / private", snapshot.listedOrPrivate],
          ["Listing place", snapshot.stockExchangeOrListingPlace],
          ["Stock code", snapshot.stockCode],
          ["Market segment", snapshot.marketSegment],
          ["Regulated entities", snapshot.regulatedEntities],
          ["Regulator", snapshot.regulatedBy],
        ],
      ],
      [
        "Group and entity relationships",
        [
          [
            "Group",
            snapshot.group
              ? `${snapshot.group.groupCode} - ${snapshot.group.nameEn ?? snapshot.group.nameZh}`
              : null,
          ],
          ["Group mode", snapshot.groupMode],
          ["Ultimate parent group", snapshot.isUltimateParentOfGroupId],
          ["Legacy subsidiary", snapshot.isSubsidiary],
          ["Legacy parent Client Code", snapshot.parentClientCode],
          ["Legacy parent holding company", snapshot.parentHoldingCompanyName],
          [
            "Related entities",
            snapshot.relationships ?? snapshot.subsidiariesOrAssociates,
          ],
        ],
      ],
      [
        "Client source and responsible persons",
        [
          ["Referred by", snapshot.referredBy],
          ["PIC", snapshot.clientPartnerPic],
          ["MIC", snapshot.clientManagerMic],
          ["Leading Partner", snapshot.clientLeadingPartner],
          ["Alternative MIC", snapshot.alternativePartnerSecondMic],
        ],
      ],
      [
        "Services, compliance and sign-off",
        [
          ["Expected engagement", snapshot.expectedJobOrEngagementType],
          ["Service type", snapshot.serviceType],
          ["Service lines", snapshot.serviceLines],
          ["Tax service details", snapshot.taxServiceDetails],
          ["Company secretarial details", snapshot.comSecServiceDetails],
          ["Other service description", snapshot.otherServiceDescription],
          ["Approval reference", snapshot.approvalReferenceNumber],
          ["Approval date", snapshot.approvalDate],
          ["Prepared by", snapshot.preparedBy],
          ["Approved by", snapshot.approvedBy],
          ["MIC approval", snapshot.micApproval],
          ["PIC approval", snapshot.picApproval],
          ["IT admin", snapshot.itAdmin],
          ["Sign-off date", snapshot.signOffDate],
          ["Remarks", snapshot.remarks],
        ],
      ],
    ],
    [snapshot]
  );
  return (
    <div className="space-y-7">
      {sections.map(([title, fields]) => (
        <section key={String(title)} className="border-b border-border pb-5">
          <h3 className="mb-4 text-sm font-semibold">{title}</h3>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {(fields as [string, unknown][]).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-sm whitespace-pre-wrap">
                  {formatValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function ComparisonView({
  result,
  loading,
  error,
  copy,
  onRetry,
}: {
  result?: { isCurrent: boolean; changes: CmpAcceptanceChangeSummary };
  loading: boolean;
  error: boolean;
  copy: Record<string, string>;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-6 w-1/3 rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
        <Button className="ml-3" size="sm" variant="outline" onClick={onRetry}>
          {copy.retry}
        </Button>
      </div>
    );
  }
  if (result?.isCurrent) {
    return (
      <div className="rounded-md border border-border bg-muted/25 p-5 text-sm">
        {copy.currentVersionNotice}
      </div>
    );
  }
  const changes =
    result?.changes.groups.flatMap((group) => group.changes) ?? [];
  return (
    <section>
      <p className="mb-4 text-sm font-medium">{copy.currentComparison}</p>
      {changes.length > 0 ? (
        <div className="divide-y rounded-md border border-border">
          {changes.map((change) => (
            <div
              key={change.field}
              className="grid gap-2 p-4 md:grid-cols-[11rem_1fr_auto_1fr]"
            >
              <strong className="text-sm">{change.field}</strong>
              <span className="rounded bg-destructive/10 px-2 py-1 text-sm">
                {formatValue(change.before)}
              </span>
              <span className="self-center text-center text-muted-foreground">
                →
              </span>
              <span className="rounded bg-primary/10 px-2 py-1 text-sm">
                {formatValue(change.after)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-border p-5 text-sm text-muted-foreground">
          {copy.noCurrentDifferences}
        </p>
      )}
    </section>
  );
}

function clientName(client: CmpClient) {
  return client.nameEn ? `${client.nameEn} · ${client.nameZh}` : client.nameZh;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
