"use client";

import {
  Button,
  Tab,
  TabList,
  Text,
  Tooltip,
} from "@fluentui/react-components";
import {
  AppsList20Regular,
  ArrowDownload20Regular,
  ArrowLeft20Regular,
  Briefcase20Regular,
  ChevronDoubleLeft20Regular,
  ChevronDoubleRight20Regular,
  ChevronRight20Regular,
  Clock20Regular,
  ContactCard20Regular,
  Delete20Regular,
  Eye20Regular,
  Folder20Regular,
} from "@fluentui/react-icons";
import {
  Button as ActionButton,
  CollectionState,
  ViewSwitcher,
  useCompactViewport,
} from "@project-wing/ui";
import { useEffect, useMemo, useRef, useState } from "react";

import { IntranetTopBar } from "@/components/intranet-top-bar";
import { KnowledgeDataGrid } from "@/components/knowledge-data-grid";
import { KnowledgeManageDialog } from "@/components/knowledge-manage-dialog";
import { KnowledgeNoticePreview } from "@/components/knowledge-notice-preview";
import { KnowledgePublishDialog } from "@/components/knowledge-publish-dialog";
import { MobileIntranet } from "@/components/mobile-intranet";
import type { IntranetDictionary } from "@/i18n/dictionaries";
import type { IntranetLocale } from "@/i18n/settings";
import type { IntranetCurrentAccount } from "@/lib/current-user";
import { getArchivedKnowledgeDocuments } from "@/lib/knowledge-api";
import {
  knowledgeCategories,
  knowledgeDepartmentIds,
} from "@/lib/knowledge-catalog";
import type {
  KnowledgeCategory,
  KnowledgeDepartment,
  KnowledgeItem,
} from "@/lib/knowledge-catalog";
import { INTRANET_MOBILE_MAX_WIDTH } from "@/lib/mobile-navigation";
import type { SystemLink } from "@/lib/system-links";
import { cn } from "@/lib/utils";

const systemIcons = {
  EMP: Briefcase20Regular,
  CMP: ContactCard20Regular,
  TMS: Clock20Regular,
} as const;
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export function IntranetHomeClient({
  account,
  copy,
  locale = "zh-CN",
  systems,
  knowledgeItems,
  canManageKnowledge,
}: {
  account?: IntranetCurrentAccount | null;
  copy: IntranetDictionary;
  locale?: IntranetLocale;
  systems: SystemLink[];
  knowledgeItems: KnowledgeItem[];
  canManageKnowledge: boolean;
}) {
  const [query, setQuery] = useState("");
  const mobile = useCompactViewport(INTRANET_MOBILE_MAX_WIDTH);
  const [department, setDepartment] = useState<KnowledgeDepartment>("recent");
  const [secondaryCategory, setSecondaryCategory] = useState<string>();
  const [tertiaryCategory, setTertiaryCategory] = useState<string>();
  const [systemsCollapsed, setSystemsCollapsed] = useState(false);
  const [items, setItems] = useState(knowledgeItems);
  const [archivedItems, setArchivedItems] = useState<KnowledgeItem[]>([]);
  const [recycleOpen, setRecycleOpen] = useState(false);
  const [archiveState, setArchiveState] = useState<
    "ready" | "loading" | "error"
  >("ready");
  const archiveRequestRef = useRef(0);
  const [tmsApprovalPending, setTmsApprovalPending] = useState(false);

  useEffect(() => setItems(knowledgeItems), [knowledgeItems]);
  useEffect(
    () => () => {
      archiveRequestRef.current += 1;
    },
    []
  );

  useEffect(() => {
    if (
      account?.globalRole !== "PARTNER" &&
      account?.globalRole !== "MANAGER"
    ) {
      setTmsApprovalPending(false);
      return;
    }
    let active = true;
    void fetch(
      `${API_BASE_URL.replace(/\/+$/, "")}/tms/timesheets/approvals/projects`,
      {
        credentials: "include",
      }
    )
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as {
              projects?: { pendingCount?: number }[];
            })
          : { projects: [] }
      )
      .then((response) => {
        if (active) {
          setTmsApprovalPending(
            response.projects?.some(
              (project) => (project.pendingCount ?? 0) > 0
            ) ?? false
          );
        }
      })
      .catch(() => active && setTmsApprovalPending(false));
    return () => {
      active = false;
    };
  }, [account?.globalRole]);

  const canReviewTmsApprovals =
    account?.globalRole === "PARTNER" || account?.globalRole === "MANAGER";

  const concreteDepartment =
    recycleOpen || department === "recent" || department === "all"
      ? undefined
      : department;
  const categories = concreteDepartment
    ? knowledgeCategories[concreteDepartment]
    : [];
  const selectedSecondary = categories.find(
    (category) => category.id === secondaryCategory
  );
  const tertiaryCategories = selectedSecondary?.children ?? [];
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const recentThreshold = new Date();
    recentThreshold.setMonth(recentThreshold.getMonth() - 3);
    const matching = items.filter((item) => {
      const matchesDepartment =
        !concreteDepartment || item.department === concreteDepartment;
      const matchesQuery =
        !normalizedQuery ||
        [
          item.referenceCode,
          item.title,
          item.department,
          item.type,
          item.owner,
        ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
      const matchesRecent =
        department !== "recent" || new Date(item.updatedAt) >= recentThreshold;
      const matchesSecondary =
        !secondaryCategory || item.secondaryCategory === secondaryCategory;
      const matchesTertiary =
        !tertiaryCategory || item.tertiaryCategory === tertiaryCategory;
      return (
        matchesDepartment &&
        matchesSecondary &&
        matchesTertiary &&
        matchesQuery &&
        matchesRecent
      );
    });
    return department === "recent" ? matching.slice(0, 30) : matching;
  }, [
    concreteDepartment,
    department,
    items,
    query,
    secondaryCategory,
    tertiaryCategory,
  ]);
  const visibleItems = recycleOpen
    ? archivedItems.filter((item) => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        return (
          !normalizedQuery ||
          [
            item.referenceCode,
            item.title,
            item.department,
            item.type,
            item.owner,
          ].some((value) =>
            value?.toLocaleLowerCase().includes(normalizedQuery)
          )
        );
      })
    : filteredItems;
  const selectedTertiary = tertiaryCategories.find(
    (item) => item.id === tertiaryCategory
  );
  const locationParts = [
    copy.departments[department],
    selectedSecondary ? categoryLabel(selectedSecondary, copy) : undefined,
    selectedTertiary ? categoryLabel(selectedTertiary, copy) : undefined,
  ].filter(Boolean) as string[];
  const locationLabel = locationParts.join(" / ");

  function addPublishedItem(uploadedItem: KnowledgeItem) {
    setItems((currentItems) => [
      uploadedItem,
      ...currentItems.filter((item) => item.id !== uploadedItem.id),
    ]);
  }

  function handleKnowledgeChanged(updatedItem: KnowledgeItem) {
    if (updatedItem.status === "ARCHIVED") {
      setItems((current) =>
        current.filter((item) => item.id !== updatedItem.id)
      );
      setArchivedItems((current) => [
        updatedItem,
        ...current.filter((item) => item.id !== updatedItem.id),
      ]);
      return;
    }
    setArchivedItems((current) =>
      current.filter((item) => item.id !== updatedItem.id)
    );
    addPublishedItem(updatedItem);
  }

  function handleKnowledgeDeleted(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setArchivedItems((current) => current.filter((item) => item.id !== itemId));
  }

  async function openRecycleBin() {
    archiveRequestRef.current += 1;
    const requestId = archiveRequestRef.current;
    setRecycleOpen(true);
    setArchiveState("loading");
    try {
      const archived = await getArchivedKnowledgeDocuments();
      if (requestId === archiveRequestRef.current) {
        setArchivedItems(archived);
        setArchiveState("ready");
      }
    } catch {
      if (requestId === archiveRequestRef.current) {
        setArchiveState("error");
      }
    }
  }

  function returnFromRecycleBin() {
    archiveRequestRef.current += 1;
    setArchiveState("ready");
    setRecycleOpen(false);
    setDepartment("recent");
    setSecondaryCategory(undefined);
    setTertiaryCategory(undefined);
  }

  if (mobile) {
    return (
      <MobileIntranet
        account={account ?? null}
        copy={copy}
        locale={locale}
        systems={systems}
        items={items}
        canManageKnowledge={canManageKnowledge}
        archivedItems={archivedItems}
        archiveState={archiveState}
        onOpenRecycle={openRecycleBin}
        onCloseRecycle={returnFromRecycleBin}
        onPublished={addPublishedItem}
        onChanged={handleKnowledgeChanged}
        onDeleted={handleKnowledgeDeleted}
        previewHref={getKnowledgePreviewUrl}
        downloadHref={getKnowledgeDownloadUrl}
        pendingApprovals={canReviewTmsApprovals && tmsApprovalPending}
      />
    );
  }

  return (
    <main className="intranet-home flex min-h-dvh flex-col bg-secondary/40">
      <IntranetTopBar
        account={account ?? null}
        copy={copy}
        locale={locale}
        onQueryChange={setQuery}
        query={query}
      />

      <nav
        aria-label={copy.systems.title}
        className="intranet-mobile-systems flex flex-wrap gap-2 px-3 pt-3 md:hidden"
      >
        {systems.map((system) => (
          <ActionButton
            key={system.name}
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={system.href} aria-label={system.label} />}
            tooltip={system.label}
          >
            {system.name}
          </ActionButton>
        ))}
        {canManageKnowledge ? (
          <ActionButton
            aria-label={`${copy.systems.title}: ${recycleOpen ? copy.knowledge.navigation.returnHome : copy.knowledge.navigation.recycleBin}`}
            variant="outline"
            size="sm"
            onClick={recycleOpen ? returnFromRecycleBin : openRecycleBin}
          >
            {recycleOpen
              ? copy.knowledge.navigation.returnHome
              : copy.knowledge.navigation.recycleBin}
          </ActionButton>
        ) : null}
      </nav>

      <div
        className={cn(
          "grid w-full flex-1 items-stretch gap-3 p-3 sm:p-4 lg:gap-4",
          systemsCollapsed
            ? "md:grid-cols-[3.5rem_minmax(0,1fr)]"
            : "md:grid-cols-[16rem_minmax(0,1fr)]"
        )}
      >
        <aside
          className={cn(
            "hidden h-full min-h-0 flex-col border bg-background transition-[padding,border-radius,box-shadow] md:flex",
            systemsCollapsed
              ? "rounded-lg p-1 shadow-none"
              : "rounded-xl p-2 shadow-sm"
          )}
        >
          <div
            className={cn(
              "flex min-h-11 items-center justify-between gap-2 px-3",
              systemsCollapsed && "justify-center px-0"
            )}
          >
            {systemsCollapsed ? null : (
              <div className="flex items-center gap-1">
                <span className="grid size-8 shrink-0 place-items-center text-brand-navy">
                  <AppsList20Regular aria-hidden="true" />
                </span>
                <Text size={300} weight="semibold">
                  {copy.systems.title}
                </Text>
              </div>
            )}
            <Tooltip
              content={
                systemsCollapsed
                  ? copy.knowledge.navigation.expandSystems
                  : copy.knowledge.navigation.collapseSystems
              }
              relationship="label"
            >
              <Button
                appearance="subtle"
                aria-label={
                  systemsCollapsed
                    ? copy.knowledge.navigation.expandSystems
                    : copy.knowledge.navigation.collapseSystems
                }
                icon={
                  systemsCollapsed ? (
                    <ChevronDoubleRight20Regular />
                  ) : (
                    <ChevronDoubleLeft20Regular />
                  )
                }
                onClick={() => setSystemsCollapsed((value) => !value)}
                size="small"
              />
            </Tooltip>
          </div>
          <div
            aria-hidden="true"
            className="mx-2 mb-2 h-px shrink-0 bg-border"
          />
          <nav
            className="grid min-h-0 flex-1 content-start gap-1 overflow-x-hidden overflow-y-auto"
            aria-label={copy.systems.navigationLabel}
          >
            {systems.map((system) => {
              const Icon =
                systemIcons[system.name as keyof typeof systemIcons] ??
                AppsList20Regular;
              const systemLink = (
                <Button
                  as="a"
                  appearance="subtle"
                  className={cn(
                    "group min-h-14 !w-full !min-w-0 max-w-full !justify-start !gap-1 overflow-hidden rounded-md px-3 text-left",
                    systemsCollapsed && "min-h-11 !justify-center !gap-0 !px-0"
                  )}
                  href={system.href}
                  aria-label={systemsCollapsed ? system.name : undefined}
                >
                  <span className="relative grid size-8 shrink-0 place-items-center text-brand-navy">
                    <Icon aria-hidden="true" />
                    {system.name === "TMS" &&
                    canReviewTmsApprovals &&
                    tmsApprovalPending ? (
                      <span
                        className="absolute top-0 right-0 size-2 rounded-full bg-destructive"
                        data-testid="tms-pending-indicator"
                      />
                    ) : null}
                  </span>
                  {systemsCollapsed ? null : (
                    <>
                      <span className="min-w-0 flex-1 overflow-hidden">
                        <span className="block text-sm leading-5 font-semibold">
                          {system.name}
                        </span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {system.label}
                        </span>
                      </span>
                      <ChevronRight20Regular className="shrink-0 text-muted-foreground" />
                    </>
                  )}
                </Button>
              );
              return systemsCollapsed ? (
                <Tooltip
                  content={`${system.name} · ${system.label}`}
                  key={system.name}
                  positioning="after"
                  relationship="label"
                >
                  {systemLink}
                </Tooltip>
              ) : (
                <span className="block min-w-0 px-1" key={system.name}>
                  {systemLink}
                </span>
              );
            })}
          </nav>
          {canManageKnowledge ? (
            <div className="mt-auto border-t px-1 pt-2">
              <Tooltip
                content={
                  recycleOpen
                    ? copy.knowledge.navigation.returnHome
                    : copy.knowledge.navigation.recycleBin
                }
                positioning="after"
                relationship="label"
              >
                <Button
                  appearance="subtle"
                  aria-label={
                    recycleOpen
                      ? copy.knowledge.navigation.returnHome
                      : copy.knowledge.navigation.recycleBin
                  }
                  className={cn(
                    "!w-full !justify-start",
                    systemsCollapsed && "!justify-center !px-0"
                  )}
                  icon={
                    recycleOpen ? <ArrowLeft20Regular /> : <Delete20Regular />
                  }
                  onClick={recycleOpen ? returnFromRecycleBin : openRecycleBin}
                >
                  {systemsCollapsed
                    ? null
                    : recycleOpen
                      ? copy.knowledge.navigation.returnHome
                      : copy.knowledge.navigation.recycleBin}
                </Button>
              </Tooltip>
            </div>
          ) : null}
        </aside>

        <section className="intranet-knowledge flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="intranet-knowledge-toolbar flex min-h-12 flex-wrap items-center gap-2 border-b px-5">
            {recycleOpen ? (
              <TabList selectedValue="recycle">
                <Tab value="recycle">
                  {copy.knowledge.navigation.recycleBin}
                </Tab>
              </TabList>
            ) : (
              <>
                <div className="intranet-department-picker hidden">
                  <ViewSwitcher
                    mobilePresentation="sheet"
                    label={copy.knowledge.manage.department}
                    value={department}
                    options={knowledgeDepartmentIds.map((value) => ({
                      value,
                      label: copy.departments[value],
                    }))}
                    onValueChange={(value) => {
                      setDepartment(value as KnowledgeDepartment);
                      setSecondaryCategory(undefined);
                      setTertiaryCategory(undefined);
                    }}
                  />
                </div>
                <TabList
                  className="intranet-department-tabs max-w-full overflow-x-auto"
                  selectedValue={department}
                  onTabSelect={(_, data) => {
                    setDepartment(data.value as KnowledgeDepartment);
                    setSecondaryCategory(undefined);
                    setTertiaryCategory(undefined);
                  }}
                >
                  {knowledgeDepartmentIds.map((item) => (
                    <Tab key={item} value={item}>
                      {copy.departments[item]}
                    </Tab>
                  ))}
                </TabList>
                {canManageKnowledge ? (
                  <div className="intranet-publish-actions ml-auto flex flex-wrap gap-2">
                    <KnowledgePublishDialog
                      copy={copy}
                      department={concreteDepartment}
                      kind="NOTICE"
                      onPublished={addPublishedItem}
                      secondaryCategory={secondaryCategory}
                      tertiaryCategory={tertiaryCategory}
                    />
                    <KnowledgePublishDialog
                      copy={copy}
                      department={concreteDepartment}
                      kind="FILE"
                      onPublished={addPublishedItem}
                      secondaryCategory={secondaryCategory}
                      tertiaryCategory={tertiaryCategory}
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>

          {concreteDepartment ? (
            <div className="intranet-directory-filters flex flex-wrap gap-2 border-b border-border p-3 2xl:hidden">
              <div className="min-w-0 flex-1">
                <ViewSwitcher
                  mobilePresentation="sheet"
                  label={copy.knowledge.navigation.secondaryDirectory}
                  value={secondaryCategory ?? ""}
                  options={[
                    { value: "", label: copy.knowledge.navigation.allContent },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: categoryLabel(category, copy),
                    })),
                  ]}
                  onValueChange={(value) => {
                    setSecondaryCategory(value || undefined);
                    setTertiaryCategory(undefined);
                  }}
                />
              </div>
              {tertiaryCategories.length > 0 ? (
                <div className="min-w-0 flex-1">
                  <ViewSwitcher
                    mobilePresentation="sheet"
                    label={copy.knowledge.navigation.tertiaryDirectory}
                    value={tertiaryCategory ?? ""}
                    options={[
                      {
                        value: "",
                        label: copy.knowledge.navigation.allContent,
                      },
                      ...tertiaryCategories.map((category) => ({
                        value: category.id,
                        label: categoryLabel(category, copy),
                      })),
                    ]}
                    onValueChange={(value) =>
                      setTertiaryCategory(value || undefined)
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            className={cn(
              "grid min-h-0 flex-1 grid-cols-1",
              concreteDepartment &&
                (tertiaryCategories.length > 0
                  ? "2xl:grid-cols-[15rem_14rem_minmax(0,1fr)]"
                  : "2xl:grid-cols-[15rem_minmax(0,1fr)]")
            )}
          >
            {concreteDepartment ? (
              <DirectoryPanel
                categories={categories}
                copy={copy}
                onSelect={(categoryId) => {
                  setSecondaryCategory(categoryId);
                  setTertiaryCategory(undefined);
                }}
                selected={secondaryCategory}
              />
            ) : null}
            {tertiaryCategories.length > 0 ? (
              <DirectoryPanel
                categories={tertiaryCategories}
                copy={copy}
                onSelect={setTertiaryCategory}
                selected={tertiaryCategory}
                tertiary
              />
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-col">
              {concreteDepartment ? (
                <div className="knowledge-pane-header flex h-10 items-center px-5 py-1">
                  <Text weight="semibold">{locationLabel}</Text>
                </div>
              ) : null}
              <KnowledgeDataGrid
                locale={locale}
                items={visibleItems}
                copy={copy}
                content={
                  recycleOpen && archiveState !== "ready" ? (
                    <CollectionState
                      kind={archiveState}
                      locale={locale}
                      onRetry={() => {
                        void openRecycleBin();
                      }}
                    />
                  ) : visibleItems.length === 0 ? (
                    <CollectionState
                      kind={
                        query || secondaryCategory || tertiaryCategory
                          ? "filtered"
                          : "empty"
                      }
                      locale={locale}
                      title={
                        query || secondaryCategory || tertiaryCategory
                          ? copy.knowledge.noResults
                          : undefined
                      }
                    />
                  ) : undefined
                }
                renderActions={(item) => (
                  <div className="flex items-center gap-1">
                    {item.kind === "NOTICE" ? (
                      <KnowledgeNoticePreview copy={copy} item={item} />
                    ) : getKnowledgePreviewUrl(item) ? (
                      <Tooltip
                        content={copy.knowledge.actions.preview}
                        relationship="label"
                      >
                        <Button
                          appearance="subtle"
                          as="a"
                          href={getKnowledgePreviewUrl(item)}
                          icon={<Eye20Regular />}
                          target="_blank"
                        />
                      </Tooltip>
                    ) : null}
                    {getKnowledgeDownloadUrl(item) ? (
                      <Tooltip
                        content={copy.knowledge.actions.download}
                        relationship="label"
                      >
                        <Button
                          appearance="subtle"
                          as="a"
                          download
                          href={getKnowledgeDownloadUrl(item)}
                          icon={<ArrowDownload20Regular />}
                        />
                      </Tooltip>
                    ) : null}
                    {canManageKnowledge && item.id ? (
                      <KnowledgeManageDialog
                        copy={copy}
                        item={item}
                        onChanged={(updated) => {
                          if (updated) {
                            handleKnowledgeChanged(updated);
                          } else {
                            handleKnowledgeDeleted(item.id ?? "");
                          }
                        }}
                      />
                    ) : null}
                  </div>
                )}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DirectoryPanel({
  categories,
  copy,
  onSelect,
  selected,
  tertiary = false,
}: {
  categories: KnowledgeCategory[];
  copy: IntranetDictionary;
  onSelect: (id?: string) => void;
  selected?: string;
  tertiary?: boolean;
}) {
  return (
    <aside className="hidden min-h-0 overflow-y-auto border-r bg-secondary/25 2xl:block">
      <div className="knowledge-pane-header flex h-10 items-center gap-2 px-5">
        {tertiary ? <ChevronRight20Regular /> : <Folder20Regular />}
        <Text size={200} weight="semibold">
          {tertiary
            ? copy.knowledge.navigation.tertiaryDirectory
            : copy.knowledge.navigation.secondaryDirectory}
        </Text>
      </div>
      <div className="grid gap-1 p-3">
        <Button
          appearance="subtle"
          className={`knowledge-directory-button justify-start text-left${
            selected ? "" : " is-selected"
          }`}
          onClick={() => onSelect()}
        >
          <span className="min-w-0 flex-1 text-left">
            {copy.knowledge.navigation.allContent}
          </span>
        </Button>
        {categories.map((category) => (
          <Button
            appearance="subtle"
            aria-label={categoryLabel(category, copy)}
            className={`knowledge-directory-button justify-between text-left${
              selected === category.id ? " is-selected" : ""
            }`}
            iconPosition="after"
            icon={
              category.children?.length ? <ChevronRight20Regular /> : undefined
            }
            key={category.id}
            onClick={() => onSelect(category.id)}
          >
            <span className="min-w-0 flex-1 text-left">
              {categoryLabel(category, copy)}
            </span>
          </Button>
        ))}
      </div>
    </aside>
  );
}

function categoryLabel(category: KnowledgeCategory, copy: IntranetDictionary) {
  return copy.knowledge.navigation.categoryLabels[category.id] ?? category.id;
}

function getKnowledgePreviewUrl(item: KnowledgeItem) {
  if (item.kind === "NOTICE") {
    return item.externalLink;
  }
  if (item.previewAllowed === false) {
    return;
  }
  if (item.id && item.fileName && item.mimeType) {
    if (
      item.fileName.toLowerCase().endsWith(".doc") ||
      item.mimeType.toLowerCase() === "application/msword"
    ) {
      return;
    }
    const search = new URLSearchParams({
      fileName: item.fileName,
      mimeType: item.mimeType,
      version: item.previewVersion ?? item.updatedAt,
      downloadAllowed: item.downloadAllowed === false ? "false" : "true",
    });
    return `/knowledge-preview/${encodeURIComponent(item.id)}?${search}`;
  }
  return item.previewUrl;
}

function getKnowledgeDownloadUrl(item: KnowledgeItem) {
  if (item.downloadAllowed === false || !item.fileName) {
    return;
  }
  if (item.id) {
    return `/knowledge-download/${encodeURIComponent(item.id)}`;
  }
  return item.downloadUrl;
}
