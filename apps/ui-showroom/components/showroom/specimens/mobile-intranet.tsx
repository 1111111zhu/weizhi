"use client";

import {
  Button,
  CollectionState,
  Input,
  MobileActionSheet,
  MobileListItem,
  MobilePageHeader,
  MobileScaffold,
  ProjectWingFileTypeIcon,
} from "@project-wing/ui";
import {
  BookOpen,
  BriefcaseBusiness,
  CircleUserRound,
  Clock3,
  Folder,
  History,
  Layers,
  Megaphone,
  MoreHorizontal,
  Moon,
  Search,
  Sun,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MouseEvent } from "react";

import {
  getIntranetDocuments,
  intranetDocuments,
  intranetHref,
  parseIntranetRoute,
  resolveIntranetPath,
} from "./mobile-intranet-model";

const systems = [
  {
    name: "EMP",
    description: "项目与审计",
    icon: BriefcaseBusiness,
    href: "http://127.0.0.1:3048/zh-CN/engagement",
    tone: "bg-primary/10 text-primary",
  },
  {
    name: "CMP",
    description: "客户与业务",
    icon: UsersRound,
    href: "http://127.0.0.1:3052/zh-CN/client",
    tone: "bg-muted text-[var(--pw-sys-color-info)]",
  },
  {
    name: "TMS",
    description: "工时与审批",
    icon: Clock3,
    href: "http://127.0.0.1:3054/zh-CN/timesheet",
    tone: "bg-muted text-[var(--pw-sys-color-warning)]",
  },
  {
    name: "知识中心",
    description: "制度、指引与资料",
    icon: BookOpen,
    href: "#/knowledge",
    tone: "bg-primary/10 text-primary",
  },
] as const;
const collectionTitles = {
  recent: "最近更新",
  all: "全部内容",
  recycle: "回收站",
};
function subscribeRoute(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}
const routeSnapshot = () => window.location.hash || "#/home";
const serverRoute = () => "#/home";

export function MobileIntranet() {
  const hash = useSyncExternalStore(subscribeRoute, routeSnapshot, serverRoute);
  const route = parseIntranetRoute(hash);
  const [queries, setQueries] = useState<Record<string, string>>({});
  const query = queries[hash] ?? "";
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const [explanation, setExplanation] = useState<string>();
  const [dark, setDark] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const positions = useRef<Record<string, number>>({});
  const origins = useRef<Record<string, string>>({});
  const [documentOrigin, setDocumentOrigin] = useState("#/knowledge");
  const branch =
    route.kind === "knowledge" ? resolveIntranetPath(route.path) : undefined;
  const document =
    route.kind === "document"
      ? intranetDocuments.find((item) => item.id === route.id)
      : undefined;
  const title =
    route.kind === "home"
      ? "Intranet"
      : route.kind === "collection"
        ? collectionTitles[route.collection]
        : document
          ? document.title
          : (branch?.trail.at(-1)?.label ?? "知识中心");
  const parent =
    route.kind === "knowledge"
      ? route.path.length
        ? intranetHref(route.path.slice(0, -1))
        : "#/home"
      : route.kind === "document"
        ? documentOrigin
        : "#/knowledge";
  const files = getIntranetDocuments(route, query);
  const listing =
    route.kind === "collection" ||
    (route.kind === "knowledge" &&
      (!branch?.children.length || Boolean(query.trim())));

  useEffect(() => {
    const root = window.document.documentElement;
    const previous = root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    return () => {
      root.classList.toggle("dark", previous);
    };
  }, [dark]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    content.scrollTop = positions.current[hash] ?? 0;
    setDocumentOrigin(origins.current[hash] ?? "#/knowledge");
    const heading = hostRef.current?.querySelector<HTMLElement>("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
    const save = () => {
      positions.current[hash] = content.scrollTop;
    };
    content.addEventListener("scroll", save, { passive: true });
    return () => content.removeEventListener("scroll", save);
  }, [hash]);

  function go(href: string) {
    positions.current[hash] = contentRef.current?.scrollTop ?? 0;
    origins.current[href] = hash;
    setMenu(false);
    window.location.assign(href);
  }
  function follow(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    go(href);
  }
  function setQuery(value: string) {
    setQueries((current) => ({ ...current, [hash]: value }));
  }

  return (
    <div ref={hostRef} lang="zh-CN" className="[&_h1]:outline-none">
      <MobileScaffold
        label="Intranet 手机导航原型"
        contentRef={contentRef}
        header={
          <MobilePageHeader
            title={title}
            back={
              route.kind === "home"
                ? undefined
                : {
                    label: "返回上一级",
                    href: parent,
                    onBack: () => go(parent),
                  }
            }
            action={
              route.kind === "home" ? (
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label="账号与原型设置"
                  onClick={() => setAccount(true)}
                >
                  <CircleUserRound />
                </Button>
              ) : (
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label="更多操作"
                  onClick={() => setMenu(true)}
                >
                  <MoreHorizontal />
                </Button>
              )
            }
          />
        }
        footer={
          <p className="py-2 text-center text-xs text-muted-foreground">
            导航原型 · 演示资料
          </p>
        }
      >
        {route.kind === "home" ? (
          <nav aria-label="应用入口" className="grid grid-cols-2 gap-4 py-6">
            {systems.map(({ name, description, icon: Icon, href, tone }) => (
              <Button
                key={name}
                variant="quiet"
                fullWidth
                nativeButton={false}
                render={
                  <a
                    aria-label={name}
                    href={href}
                    target={name === "知识中心" ? undefined : "_blank"}
                    rel={
                      name === "知识中心" ? undefined : "noopener noreferrer"
                    }
                    onClick={
                      name === "知识中心"
                        ? (event) => follow(event, href)
                        : undefined
                    }
                  />
                }
                className="h-auto min-w-0 py-6"
              >
                <span className="grid min-w-0 justify-items-center gap-3 whitespace-normal">
                  <span
                    className={`grid size-16 place-items-center rounded-2xl ${tone}`}
                  >
                    <Icon className="size-7" />
                  </span>
                  <span className="text-lg font-semibold">{name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {description}
                  </span>
                </span>
              </Button>
            ))}
          </nav>
        ) : document ? (
          <article className="space-y-6 py-3">
            <div className="flex items-center gap-3">
              {document.kind === "notice" ? (
                <Megaphone className="size-8 text-primary" />
              ) : (
                <ProjectWingFileTypeIcon fileName={document.title} />
              )}
              <div className="min-w-0">
                <p className="mt-1 text-sm text-muted-foreground">
                  {document.updated} ·{" "}
                  {document.kind === "notice" ? "演示通知" : "演示文件"}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {resolveIntranetPath(document.path)
                ?.trail.map((item) => item.label)
                .join(" / ")}
            </p>
            <p className="leading-7">{document.summary}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              此处仅展示导航终点。正式接入后使用现有预览、下载和权限流程。
            </p>
          </article>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Search
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="搜索当前范围"
                placeholder="搜索当前范围内的资料"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label="清除搜索"
                  onClick={() => setQuery("")}
                >
                  <X />
                </Button>
              ) : null}
            </div>
            {!listing && route.kind === "knowledge" ? (
              <nav aria-label="分类目录">
                {branch?.children.map((item) => {
                  const href = intranetHref([...route.path, item.id]);
                  return (
                    <MobileListItem
                      key={item.id}
                      title={item.label}
                      description={item.description}
                      icon={<Folder className="text-primary" />}
                      href={href}
                      onNavigate={(event) => follow(event, href)}
                    />
                  );
                })}
              </nav>
            ) : (
              <div aria-label="资料列表">
                {files.length ? (
                  files.map((item) => {
                    const href = `#/document/${item.id}`;
                    return (
                      <MobileListItem
                        key={item.id}
                        title={item.title}
                        description={`${item.updated} · ${item.kind === "notice" ? "通知" : "文件"}`}
                        meta={
                          query || route.kind === "collection"
                            ? resolveIntranetPath(item.path)
                                ?.trail.map((part) => part.label)
                                .join(" / ")
                            : undefined
                        }
                        icon={
                          item.kind === "notice" ? (
                            <Megaphone className="text-primary" />
                          ) : (
                            <ProjectWingFileTypeIcon fileName={item.title} />
                          )
                        }
                        href={href}
                        onNavigate={(event) => follow(event, href)}
                      />
                    );
                  })
                ) : (
                  <CollectionState
                    kind={query ? "filtered" : "empty"}
                    locale="zh-CN"
                    action={
                      query
                        ? { label: "清除搜索", onClick: () => setQuery("") }
                        : undefined
                    }
                  />
                )}
              </div>
            )}
          </>
        )}
      </MobileScaffold>
      <MobileActionSheet
        open={menu}
        onOpenChange={setMenu}
        title="更多操作"
        closeLabel="关闭操作"
      >
        <div className="grid gap-2">
          <Button
            variant="quiet"
            className="justify-start"
            onClick={() => go("#/recent")}
          >
            <History />
            最近更新
          </Button>
          <Button
            variant="quiet"
            className="justify-start"
            onClick={() => go("#/all")}
          >
            <Layers />
            全部内容
          </Button>
          <Button
            variant="quiet"
            className="justify-start"
            onClick={() => go("#/recycle")}
          >
            <Trash2 />
            回收站
          </Button>
          {listing &&
          !(route.kind === "collection" && route.collection === "recycle") ? (
            <>
              <Button
                variant="quiet"
                className="justify-start"
                onClick={() => {
                  setMenu(false);
                  setExplanation("上传资料");
                }}
              >
                <Upload />
                上传资料
              </Button>
              <Button
                variant="quiet"
                className="justify-start"
                onClick={() => {
                  setMenu(false);
                  setExplanation("发布通知");
                }}
              >
                <Megaphone />
                发布通知
              </Button>
            </>
          ) : null}
        </div>
      </MobileActionSheet>
      <MobileActionSheet
        open={account}
        onOpenChange={setAccount}
        title="原型设置"
        closeLabel="关闭设置"
      >
        <p className="text-sm text-muted-foreground">
          演示账号；不读取真实账号或业务数据。
        </p>
        <Button variant="outline" onClick={() => setDark(!dark)}>
          {dark ? <Sun /> : <Moon />}
          {dark ? "切换为浅色" : "切换为深色"}
        </Button>
        <Button
          variant="quiet"
          nativeButton={false}
          render={
            <Link
              href="/specimens/MobileMaterialSystem"
              aria-label="查看组件目录"
            />
          }
        >
          查看组件目录
        </Button>
      </MobileActionSheet>
      <MobileActionSheet
        open={Boolean(explanation)}
        onOpenChange={(open) => {
          if (!open) {
            setExplanation(undefined);
          }
        }}
        title={explanation ?? "原型说明"}
        closeLabel="关闭说明"
      >
        <p className="leading-7">
          这是操作入口的演示。正式接入时会继承当前分类和真实账号权限；本原型不上传文件或发布通知。
        </p>
        <Button onClick={() => setExplanation(undefined)}>知道了</Button>
      </MobileActionSheet>
    </div>
  );
}
