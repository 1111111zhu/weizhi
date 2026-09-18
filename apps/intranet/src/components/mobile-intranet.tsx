"use client";

import {
  Button,
  buttonVariants,
  CollectionState,
  MobileActionSheet,
} from "@project-wing/ui";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  ContactRound,
  Download,
  FileText,
  Folder,
  LayoutGrid,
  Megaphone,
  MoreHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { IntranetDictionary } from "@/i18n/dictionaries";
import type { IntranetLocale } from "@/i18n/settings";
import type { IntranetCurrentAccount } from "@/lib/current-user";
import {
  knowledgeCategories,
  knowledgeDepartmentIds,
} from "@/lib/knowledge-catalog";
import type { KnowledgeCategory, KnowledgeItem } from "@/lib/knowledge-catalog";
import {
  filterMobileKnowledge,
  mobileLocationHash,
  mobileSystemHref,
  parentMobileLocation,
  parseMobileLocation,
} from "@/lib/mobile-navigation";
import type { IntranetMobileLocation } from "@/lib/mobile-navigation";
import type { SystemLink } from "@/lib/system-links";
import { cn } from "@/lib/utils";

import { IntranetTopBar } from "./intranet-top-bar";
import { KnowledgeManageDialog } from "./knowledge-manage-dialog";
import { KnowledgeNoticePreview } from "./knowledge-notice-preview";
import { KnowledgePublishDialog } from "./knowledge-publish-dialog";

import styles from "./mobile-intranet.module.css";

const icons = { EMP: BriefcaseBusiness, CMP: ContactRound, TMS: Clock3 };
const subscribeToHost = () => () => {};
const readBrowserHost = () => window.location.hostname;
const readServerHost = () => "";

export function MobileIntranet({
  account,
  copy,
  locale,
  systems,
  items,
  canManageKnowledge,
  archivedItems,
  archiveState,
  onOpenRecycle,
  onCloseRecycle,
  onPublished,
  onChanged,
  onDeleted,
  previewHref,
  downloadHref,
  pendingApprovals,
}: {
  account: IntranetCurrentAccount | null;
  copy: IntranetDictionary;
  locale: IntranetLocale;
  systems: SystemLink[];
  items: KnowledgeItem[];
  canManageKnowledge: boolean;
  archivedItems: KnowledgeItem[];
  archiveState: "ready" | "loading" | "error";
  onOpenRecycle: () => Promise<void>;
  onCloseRecycle: () => void;
  onPublished: (item: KnowledgeItem) => void;
  onChanged: (item: KnowledgeItem) => void;
  onDeleted: (id: string) => void;
  previewHref: (item: KnowledgeItem) => string | undefined;
  downloadHref: (item: KnowledgeItem) => string | undefined;
  pendingApprovals: boolean;
}) {
  const [requestedLocation, setRequestedLocation] =
    useState<IntranetMobileLocation>({
      screen: "home",
    });
  const [query, setQuery] = useState("");
  const browserHost = useSyncExternalStore(
    subscribeToHost,
    readBrowserHost,
    readServerHost
  );
  const location: IntranetMobileLocation =
    requestedLocation.screen === "recycle" && !canManageKnowledge
      ? { screen: "knowledge" }
      : requestedLocation;
  const [menuOpen, setMenuOpen] = useState(false);
  const [publishKind, setPublishKind] = useState<"FILE" | "NOTICE" | null>(
    null
  );
  const [visibleCount, setVisibleCount] = useState(40);
  const contentRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLElement>(null);
  const views = useRef(
    new Map<string, { query: string; scroll: number; visibleCount: number }>()
  );
  const queuedAction = useRef<(() => void) | null>(null);
  const recycleWasOpen = useRef(false);

  function rememberView() {
    views.current.set(mobileLocationHash(location), {
      query,
      scroll: contentRef.current?.scrollTop ?? 0,
      visibleCount,
    });
  }
  function applyLocation(nextLocation: IntranetMobileLocation) {
    const safe =
      nextLocation.screen === "recycle" && !canManageKnowledge
        ? { screen: "knowledge" as const }
        : nextLocation;
    setRequestedLocation(safe);
    setQuery(views.current.get(mobileLocationHash(safe))?.query ?? "");
    setVisibleCount(
      views.current.get(mobileLocationHash(safe))?.visibleCount ?? 40
    );
    setMenuOpen(false);
  }
  const readHistory = useEffectEvent(() => {
    rememberView();
    applyLocation(parseMobileLocation(window.location.hash));
  });
  useEffect(() => {
    const read = () => readHistory();
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("hashchange", read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  const locationKey = mobileLocationHash(location);
  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop =
        views.current.get(locationKey)?.scroll ?? 0;
    }
    headingRef.current
      ?.querySelector<HTMLElement>("h1")
      ?.focus({ preventScroll: true });
  }, [locationKey]);
  useEffect(() => {
    const open = location.screen === "recycle" && canManageKnowledge;
    if (open === recycleWasOpen.current) {
      return;
    }
    recycleWasOpen.current = open;
    if (open) {
      void onOpenRecycle();
    } else {
      onCloseRecycle();
    }
  }, [location.screen, canManageKnowledge, onOpenRecycle, onCloseRecycle]);

  function navigate(nextLocation: IntranetMobileLocation, replace = false) {
    rememberView();
    const url = `${window.location.pathname}${window.location.search}${mobileLocationHash(nextLocation)}`;
    const oldDepth = Number(window.history.state?.intranetMobileDepth) || 0;
    const state = {
      ...window.history.state,
      intranetMobileDepth: replace ? oldDepth : oldDepth + 1,
    };
    if (replace) {
      window.history.replaceState(state, "", url);
    } else {
      window.history.pushState(state, "", url);
    }
    applyLocation(nextLocation);
  }
  function goBack() {
    if (query) {
      setQuery("");
      return;
    }
    if ((Number(window.history.state?.intranetMobileDepth) || 0) > 0) {
      window.history.back();
    } else {
      navigate(parentMobileLocation(location), true);
    }
  }
  function queueAction(action: () => void) {
    queuedAction.current = action;
    setMenuOpen(false);
  }

  const home = location.screen === "home";
  const concreteDepartment =
    location.department &&
    location.department !== "all" &&
    location.department !== "recent"
      ? location.department
      : undefined;
  const categories = concreteDepartment
    ? knowledgeCategories[concreteDepartment]
    : [];
  const knowledgeRoot = !concreteDepartment;
  const category = categories.find((item) => item.id === location.category);
  const folders = category?.children ?? categories;
  const label = (entry: KnowledgeCategory) =>
    copy.knowledge.navigation.categoryLabels[entry.id] ?? entry.id;
  const title =
    location.screen === "recycle"
      ? copy.knowledge.navigation.recycleBin
      : location.subcategory
        ? (copy.knowledge.navigation.categoryLabels[location.subcategory] ??
          location.subcategory)
        : category
          ? label(category)
          : location.department
            ? copy.departments[location.department]
            : copy.knowledge.title;
  const filtered = filterMobileKnowledge(
    location.screen === "recycle" ? archivedItems : items,
    location,
    query
  );
  const showItems =
    location.screen === "items" ||
    location.screen === "recycle" ||
    Boolean(query.trim());
  const recentNotices = filterMobileKnowledge(
    items,
    { screen: "items", department: "recent" },
    ""
  )
    .filter(
      (item) =>
        item.kind === "NOTICE" && (!item.status || item.status === "PUBLISHED")
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 3);

  function renderItem(item: KnowledgeItem) {
    const preview = previewHref(item);
    const download = downloadHref(item);
    return (
      <article
        className={styles.item}
        key={item.id ?? item.referenceCode ?? item.title}
      >
        <div className={styles.itemTitle}>
          {item.kind === "NOTICE" ? (
            <KnowledgeNoticePreview
              copy={copy}
              item={item}
              triggerLabel={item.title}
            />
          ) : preview ? (
            <a
              className={buttonVariants({ variant: "quiet" })}
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen aria-hidden />
              {item.title}
            </a>
          ) : (
            <strong>{item.title}</strong>
          )}
        </div>
        <p className={styles.itemMeta}>
          {[
            item.referenceCode,
            copy.types[item.type],
            item.owner,
            item.updatedAt.slice(0, 10),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className={styles.itemActions}>
          {download ? (
            <a
              className={buttonVariants({ variant: "quiet", size: "sm" })}
              href={download}
              download
              aria-label={`${copy.knowledge.actions.download}: ${item.title}`}
            >
              <Download aria-hidden />
              {copy.knowledge.actions.download}
            </a>
          ) : null}
          {canManageKnowledge && item.id ? (
            <KnowledgeManageDialog
              copy={copy}
              item={item}
              onChanged={(updated) =>
                updated ? onChanged(updated) : onDeleted(item.id ?? "")
              }
            />
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <main
      className={styles.root}
      data-testid="intranet-mobile-workspace"
      data-home={home || undefined}
      ref={headingRef}
    >
      <IntranetTopBar
        account={account}
        copy={copy}
        locale={locale}
        query={query}
        onQueryChange={(value) => {
          setQuery(value);
          setVisibleCount(40);
        }}
        showSearch={!home}
        searchLabel={
          location.department ? copy.mobile.searchHere : copy.search.label
        }
        mobileTitle={home ? undefined : title}
        onMobileBack={home ? undefined : goBack}
      />
      <div
        className={styles.content}
        ref={contentRef}
        data-testid="intranet-mobile-content"
      >
        {home ? (
          <>
            <h1 tabIndex={-1} className={styles.homeTitle}>
              {copy.mobile.home}
            </h1>
            <nav
              className={styles.appGrid}
              aria-label={copy.mobile.applications}
            >
              {systems.map((system) => {
                const Icon =
                  icons[system.name as keyof typeof icons] ?? LayoutGrid;
                return (
                  <a
                    key={system.name}
                    className={cn(
                      buttonVariants({ variant: "quiet" }),
                      styles.appTile
                    )}
                    href={mobileSystemHref(system.href, browserHost)}
                    aria-label={system.name}
                  >
                    <span className={styles.tileContent}>
                      <span
                        className={styles.appIcon}
                        data-system={system.name}
                      >
                        <Icon />
                        {system.name === "TMS" && pendingApprovals ? (
                          <span
                            className={styles.pending}
                            aria-label={copy.systems.pendingApproval}
                          />
                        ) : null}
                      </span>
                      <span className={styles.appHeading}>
                        <strong>{system.name}</strong>
                        <ChevronRight aria-hidden />
                      </span>
                      <span className={styles.appDescription}>
                        {copy.mobile.applicationDescriptions[system.name] ??
                          system.label}
                      </span>
                    </span>
                  </a>
                );
              })}
              <Button
                variant="quiet"
                className={styles.appTile}
                aria-label={copy.knowledge.title}
                onClick={() => navigate({ screen: "knowledge" })}
              >
                <span className={styles.tileContent}>
                  <span className={styles.appIcon} data-system="knowledge">
                    <BookOpen />
                  </span>
                  <span className={styles.appHeading}>
                    <strong>{copy.knowledge.title}</strong>
                    <ChevronRight aria-hidden />
                  </span>
                  <span className={styles.appDescription}>
                    {copy.mobile.knowledgeDescription}
                  </span>
                </span>
              </Button>
            </nav>
            {recentNotices.length ? (
              <section
                className={styles.notices}
                aria-label={copy.mobile.recentNotices}
              >
                <h2>{copy.mobile.recentNotices}</h2>
                {recentNotices.map((item) => (
                  <KnowledgeNoticePreview
                    key={item.id ?? item.title}
                    copy={copy}
                    item={item}
                    triggerLabel={item.title}
                    trigger={
                      <Button
                        variant="quiet"
                        className={styles.noticeLink}
                        aria-label={item.title}
                      >
                        <span className={styles.noticeIcon}>
                          <FileText aria-hidden />
                        </span>
                        <span className={styles.noticeCopy}>
                          <strong>{item.title}</strong>
                          {Number.isFinite(Date.parse(item.updatedAt)) ? (
                            <span>
                              {copy.mobile.updated}{" "}
                              <time dateTime={item.updatedAt}>
                                {new Intl.DateTimeFormat(locale, {
                                  month: "short",
                                  day: "numeric",
                                }).format(new Date(item.updatedAt))}
                              </time>
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight aria-hidden />
                      </Button>
                    }
                  />
                ))}
              </section>
            ) : null}
          </>
        ) : (
          <>
            <div className={styles.actions}>
              <span className={styles.context}>
                {showItems
                  ? copy.knowledge.resultCount.replace(
                      "{count}",
                      String(filtered.length)
                    )
                  : copy.knowledge.manage.directory}
              </span>
              <Button
                variant="quiet"
                size="icon"
                aria-label={copy.mobile.more}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <MoreHorizontal />
              </Button>
            </div>
            {showItems ? (
              location.screen === "recycle" && archiveState !== "ready" ? (
                <CollectionState
                  kind={archiveState}
                  locale={locale}
                  onRetry={() => {
                    void onOpenRecycle();
                  }}
                />
              ) : filtered.length ? (
                <section aria-label={title} className={styles.items}>
                  {filtered.slice(0, visibleCount).map(renderItem)}
                  {filtered.length > visibleCount ? (
                    <Button
                      variant="quiet"
                      fullWidth
                      onClick={() => setVisibleCount((count) => count + 40)}
                    >
                      {copy.mobile.loadMore}
                    </Button>
                  ) : null}
                </section>
              ) : (
                <CollectionState
                  kind={query ? "filtered" : "empty"}
                  locale={locale}
                  title={query ? copy.knowledge.noResults : undefined}
                />
              )
            ) : (
              <nav aria-label={title} className={styles.directories}>
                {knowledgeRoot ? (
                  <>
                    <div className={styles.quickLinks}>
                      <Button
                        variant="quiet"
                        className={styles.quickLink}
                        iconStart={<Clock3 />}
                        onClick={() =>
                          navigate({ screen: "items", department: "recent" })
                        }
                      >
                        {copy.departments.recent}
                      </Button>
                      <Button
                        variant="quiet"
                        className={styles.quickLink}
                        iconStart={<LayoutGrid />}
                        onClick={() =>
                          navigate({ screen: "items", department: "all" })
                        }
                      >
                        {copy.knowledge.navigation.allContent}
                      </Button>
                    </div>
                    {knowledgeDepartmentIds
                      .filter((id) => id !== "recent" && id !== "all")
                      .map((id) => (
                        <Button
                          variant="quiet"
                          className={styles.directory}
                          key={id}
                          onClick={() =>
                            navigate({ screen: "knowledge", department: id })
                          }
                        >
                          <Folder />
                          <span>{copy.departments[id]}</span>
                          <ChevronRight />
                        </Button>
                      ))}
                  </>
                ) : (
                  <>
                    <Button
                      variant="quiet"
                      className={styles.browseAll}
                      iconStart={<BookOpen />}
                      iconEnd={<ArrowRight />}
                      onClick={() => navigate({ ...location, screen: "items" })}
                    >
                      {copy.mobile.browseAll}
                    </Button>
                    {folders.map((folder) => (
                      <Button
                        variant="quiet"
                        className={styles.directory}
                        key={folder.id}
                        onClick={() =>
                          navigate(
                            category
                              ? {
                                  ...location,
                                  screen: "items",
                                  subcategory: folder.id,
                                }
                              : {
                                  ...location,
                                  screen: folder.children?.length
                                    ? "knowledge"
                                    : "items",
                                  category: folder.id,
                                }
                          )
                        }
                      >
                        <Folder />
                        <span>{label(folder)}</span>
                        <ChevronRight />
                      </Button>
                    ))}
                  </>
                )}
              </nav>
            )}
          </>
        )}
      </div>
      <MobileActionSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={copy.mobile.more}
        closeLabel={copy.knowledge.notice.close}
        onOpenChangeComplete={(open) => {
          if (!open) {
            const action = queuedAction.current;
            queuedAction.current = null;
            action?.();
          }
        }}
      >
        <div className={styles.menu}>
          {canManageKnowledge && location.screen !== "recycle" ? (
            <>
              <Button
                variant="quiet"
                iconStart={<Megaphone />}
                onClick={() => queueAction(() => setPublishKind("NOTICE"))}
              >
                {copy.knowledge.notice.action}
              </Button>
              <Button
                variant="quiet"
                iconStart={<Upload />}
                onClick={() => queueAction(() => setPublishKind("FILE"))}
              >
                {copy.knowledge.upload.action}
              </Button>
              <Button
                variant="quiet"
                iconStart={<Trash2 />}
                onClick={() =>
                  queueAction(() => navigate({ screen: "recycle" }))
                }
              >
                {copy.knowledge.navigation.recycleBin}
              </Button>
            </>
          ) : null}
          <Button
            variant="quiet"
            iconStart={<LayoutGrid />}
            onClick={() => queueAction(() => navigate({ screen: "home" }))}
          >
            {copy.mobile.home}
          </Button>
        </div>
      </MobileActionSheet>
      {canManageKnowledge && publishKind ? (
        <KnowledgePublishDialog
          copy={copy}
          kind={publishKind}
          open
          onOpenChange={(open) => {
            if (!open) {
              setPublishKind(null);
            }
          }}
          department={concreteDepartment}
          secondaryCategory={location.category}
          tertiaryCategory={location.subcategory}
          onPublished={onPublished}
        />
      ) : null}
    </main>
  );
}
