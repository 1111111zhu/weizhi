"use client";

import { canGlobalRoleCreateProject } from "@project-wing/shared";
import {
  Button,
  CollectionState,
  Input,
  MobileActionSheet,
  MobileComposer,
  MobileListItem,
  MobileNavigation,
  MobilePageHeader,
  MobileScaffold,
  MobileSelectionRow,
  ProjectWingMasterDataGrid,
  ProjectWingFileTypeIcon,
  ProjectWingTopBarAvatar,
  MobileMessage,
  MobileAttachmentLink,
  MobileImageAttachment,
  ReviewNoteRichText,
  ViewSwitcher,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Eye,
  FolderClosed,
  ListTodo,
  MessageSquare,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Search,
  UserRound,
  Settings2,
  Landmark,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { mobileAccountFixture } from "./mobile-account-model";
import { useMobilePreferences } from "./mobile-appearance";
import {
  MobileConfirmations,
  confirmationRoute,
  confirmationSectionRoute,
} from "./mobile-confirmations";
import { MobileDocumentPreview } from "./mobile-document-preview";
import { MobileFileSignoffs } from "./mobile-file-signoffs";
import { mobileConfirmationSections } from "./mobile-services-model";
import {
  MobileAccount,
  MobileSettings,
  settingsRoute,
} from "./mobile-settings";
import {
  mobileSettingsParent,
  mobileSettingsTitle,
} from "./mobile-settings-model";
import {
  effectiveFolder,
  mobileHasEvidenceImage,
  canEditMobileFile,
  importedSmartFormPdf,
  isImportedMobileSmartForm,
  initialMobileRoute,
  mobileFileKey,
  mobileFiles,
  mobileFolders,
  mobileDocumentProfile,
  mobileProcedureResultOptions,
  mobileDefaultFile,
  shouldRevealMobileReply,
  mobileProjects,
  mobileQuestionKey,
  mobileQuestions,
  mobileRouteHref,
  moveMobileFiles,
  sendMobileReply,
} from "./mobile-workspace-model";
import type {
  MobileDemoState,
  MobileFile,
  MobileRoute,
  PendingMobileReply,
} from "./mobile-workspace-model";
import {
  updateMobileState,
  useMobileWorkspaceState,
} from "./mobile-workspace-state";

type Workspace = ReturnType<typeof useMobileWorkspaceState>;
const groupClass = "grid";
function projectRoute(project: string, folder = ""): MobileRoute {
  return { ...initialMobileRoute, screen: "files", project, folder };
}
function documentRoute(
  project: string,
  file: string,
  mode: MobileRoute["mode"] = "read",
  question = ""
): MobileRoute {
  return {
    ...initialMobileRoute,
    screen: "document",
    project,
    file,
    mode,
    question,
  };
}
function openQuestions(
  state: MobileDemoState,
  project: string,
  file: MobileFile
) {
  return mobileDocumentProfile(file).questions.filter(
    (question) =>
      !state.resolved.includes(
        `${mobileFileKey(project, file.id)}:${question.id}`
      )
  ).length;
}

/** Synthetic productivity-workflow specimen. No production API or file writes. */
export function MobileWorkspaceSpecimen() {
  const workspace = useMobileWorkspaceState();
  const { state, route, routeKey, scrollRef, navigate, follow, back } =
    workspace;
  const [locationOpen, setLocationOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [projectInfoOpen, setProjectInfoOpen] = useState(false);
  const [fileSelection, setFileSelection] = useState({
    routeKey,
    active: false,
  });
  if (fileSelection.routeKey !== routeKey) {
    setFileSelection({ routeKey, active: false });
  }
  const selectingFiles =
    fileSelection.routeKey === routeKey && fileSelection.active;
  const setSelectingFiles = (active: boolean) =>
    setFileSelection({ routeKey, active });
  useMobilePreferences(state.preferences);
  const project =
    mobileProjects.find((item) => item.id === route.project) ??
    mobileProjects[0];
  const file =
    mobileFiles.find((item) => item.id === route.file) ?? mobileDefaultFile;
  const folderId =
    route.screen === "document"
      ? effectiveFolder(state, project.id, file)
      : route.folder;
  const folder = mobileFolders.find((item) => item.id === folderId);
  const inProject = route.screen === "files" || route.screen === "document";
  const isSettings = route.screen === "settings";
  const isEmpWorkItems = route.screen === "emp-work-items";
  const isAccountDetail = isSettings || isEmpWorkItems;
  const isConfirmationDetail =
    route.screen === "confirmation" || route.screen === "confirmation-edit";
  const isConfirmationSection =
    route.screen === "confirmations" && Boolean(route.section);
  const confirmation = state.confirmations.find(
    (record) => record.id === route.confirmation
  );
  const isQuestion =
    route.screen === "document" &&
    route.mode === "notes" &&
    Boolean(route.question);
  const parent = isAccountDetail
    ? isSettings && route.section
      ? settingsRoute(mobileSettingsParent(route.section))
      : { ...initialMobileRoute, screen: "account" as const }
    : isConfirmationSection
      ? confirmationRoute()
      : isConfirmationDetail
        ? route.screen === "confirmation-edit" && route.confirmation
          ? confirmationRoute(route.confirmation)
          : confirmationSectionRoute("all")
        : route.screen === "document"
          ? isQuestion
            ? documentRoute(project.id, file.id, "notes")
            : projectRoute(project.id, folderId)
          : route.folder
            ? projectRoute(project.id)
            : initialMobileRoute;
  const title = isEmpWorkItems
    ? "EMP待办"
    : isSettings
      ? mobileSettingsTitle(route.section)
      : route.screen === "confirmations"
        ? (mobileConfirmationSections.find((item) => item.id === route.section)
            ?.label ?? "函证中心")
        : route.screen === "confirmation-edit"
          ? route.confirmation
            ? "编辑函证"
            : "新增函证"
          : route.screen === "confirmation"
            ? (confirmation?.name ?? "函证详情")
            : route.screen === "document"
              ? file.name
              : route.screen === "files"
                ? (folder?.name ?? project.name)
                : route.screen === "tasks"
                  ? "待办"
                  : route.screen === "account"
                    ? "我的"
                    : "项目";
  const modeItems = [
    { id: "read", label: "阅读", icon: <Eye aria-hidden /> },
    {
      id: "notes",
      label: `批注 ${file.questions}`,
      icon: <MessageSquare aria-hidden />,
    },
    ...(canEditMobileFile(file)
      ? [{ id: "edit", label: "编辑", icon: <Pencil aria-hidden /> }]
      : []),
  ].map((item) => {
    const next = documentRoute(
      project.id,
      file.id,
      item.id as MobileRoute["mode"]
    );
    return { ...item, href: mobileRouteHref(next), onNavigate: follow(next) };
  });
  const navigation = (
    <MobileNavigation
      label="主导航"
      activeId={route.screen}
      items={[
        {
          id: "projects",
          label: "项目",
          href: "#projects",
          icon: <FolderClosed aria-hidden />,
          onNavigate: follow(initialMobileRoute),
        },
        {
          id: "tasks",
          label: "待办",
          href: "#tasks",
          icon: <ListTodo aria-hidden />,
          onNavigate: follow({ ...initialMobileRoute, screen: "tasks" }),
        },
        {
          id: "confirmations",
          label: "函证",
          href: "#confirmations",
          icon: <Landmark aria-hidden />,
          onNavigate: follow(confirmationRoute()),
        },
        {
          id: "account",
          label: "我的",
          href: "#account",
          icon: <UserRound aria-hidden />,
          onNavigate: follow({ ...initialMobileRoute, screen: "account" }),
        },
      ]}
    />
  );
  const questionKey = mobileQuestionKey(route);
  const pendingReply = useRef<PendingMobileReply | null>(null);
  useLayoutEffect(() => {
    if (pendingReply.current?.questionKey !== questionKey) {
      pendingReply.current = null;
      return;
    }
    if (
      shouldRevealMobileReply(
        pendingReply.current,
        questionKey,
        state.replies[questionKey]
      )
    ) {
      const content = scrollRef.current;
      if (content) {
        content.scrollTop = content.scrollHeight;
      }
      pendingReply.current = null;
    }
  }, [questionKey, state.replies, scrollRef]);
  const fileKey = mobileFileKey(project.id, file.id);
  const saveEdits = () =>
    updateMobileState((current) => ({
      ...current,
      savedEdits: {
        ...current.savedEdits,
        [fileKey]: {
          ...current.savedEdits[fileKey],
          ...current.editDrafts[fileKey],
        },
      },
      editDrafts: { ...current.editDrafts, [fileKey]: {} },
    }));
  const footer = isQuestion ? (
    <MobileComposer
      value={state.drafts[questionKey] ?? ""}
      onValueChange={(value) =>
        updateMobileState((current) => ({
          ...current,
          drafts: { ...current.drafts, [questionKey]: value },
        }))
      }
      onSubmit={() => {
        const id = crypto.randomUUID();
        pendingReply.current = { questionKey, id };
        updateMobileState((current) =>
          sendMobileReply(current, route, id, new Date().toISOString())
        );
      }}
      label="回复批注"
      submitLabel="发送回复"
    />
  ) : route.screen === "document" ? (
    <div className="flex items-center justify-between gap-2 p-3">
      <Button variant="quiet" onClick={() => setLocationOpen(true)}>
        <FolderClosed aria-hidden />
        目录
      </Button>
      {route.mode === "edit" ? (
        <Button
          disabled={!Object.keys(state.editDrafts[fileKey] ?? {}).length}
          onClick={saveEdits}
        >
          保存
        </Button>
      ) : null}
    </div>
  ) : inProject || isAccountDetail || isConfirmationDetail ? undefined : (
    navigation
  );
  return (
    <>
      <MobileScaffold
        density={state.preferences.density}
        label="移动工作台"
        contentRef={scrollRef}
        header={
          <div>
            {route.screen === "projects" ? (
              <ProjectSearchHeader workspace={workspace} />
            ) : (
              <MobilePageHeader
                title={title}
                back={
                  inProject ||
                  isAccountDetail ||
                  isConfirmationDetail ||
                  isConfirmationSection
                    ? {
                        label: "返回上一页",
                        href: mobileRouteHref(parent),
                        onBack: () => back(parent),
                      }
                    : undefined
                }
                action={
                  inProject ? (
                    <Button
                      variant="quiet"
                      className="pw-mobile-icon-action"
                      aria-label="更多操作"
                      onClick={() => setMoreOpen(true)}
                    >
                      <MoreHorizontal aria-hidden />
                    </Button>
                  ) : route.screen === "confirmations" &&
                    route.section === "all" ? (
                    <Button
                      variant="quiet"
                      className="pw-mobile-icon-action"
                      aria-label="新增函证"
                      onClick={() => navigate(confirmationRoute("", true))}
                    >
                      <Plus aria-hidden />
                    </Button>
                  ) : isAccountDetail ||
                    isConfirmationDetail ||
                    isConfirmationSection ? undefined : (
                    <a
                      className="pw-mobile-icon-action"
                      href="#settings"
                      onClick={follow(settingsRoute())}
                      aria-label="设置"
                    >
                      <Settings2 aria-hidden />
                    </a>
                  )
                }
              />
            )}
            {route.screen === "document" ? (
              <MobileNavigation
                variant="modes"
                label="文档模式"
                activeId={route.mode}
                items={modeItems}
              />
            ) : null}
          </div>
        }
        footer={footer}
      >
        {state.storageLimited ? (
          <p role="alert" className="mb-4 text-sm text-destructive">
            无法保存到此浏览器，刷新后可能丢失更改。
          </p>
        ) : null}
        {isSettings ? <MobileSettings workspace={workspace} /> : null}
        {isEmpWorkItems ? (
          // EMP work items (declarations/invitations) are not the review-note task fixture.
          // No backend work-item feed is available in this isolated showroom.
          <CollectionState
            kind="error"
            locale="zh-CN"
            title="暂时无法读取EMP待办"
            description=""
            action={{
              label: "返回我的",
              onClick: () =>
                navigate({ ...initialMobileRoute, screen: "account" }),
            }}
          />
        ) : null}
        {route.screen === "confirmations" || isConfirmationDetail ? (
          <MobileConfirmations workspace={workspace} />
        ) : null}
        {route.screen === "projects" ? (
          <Projects workspace={workspace} />
        ) : null}
        {route.screen === "files" ? (
          <Directory
            key={routeKey}
            workspace={workspace}
            selecting={selectingFiles}
            onSelectingChange={setSelectingFiles}
          />
        ) : null}
        {route.screen === "document" ? (
          <Document key={routeKey} workspace={workspace} file={file} />
        ) : null}
        {route.screen === "tasks" ? (
          <div className="grid gap-4">
            <div className={groupClass}>
              {mobileQuestions
                .filter(
                  (question) =>
                    !state.resolved.includes(
                      `orchid:cash-program:${question.id}`
                    )
                )
                .map((question) => {
                  const next = documentRoute(
                    "orchid",
                    "cash-program",
                    "notes",
                    question.id
                  );
                  return (
                    <MobileListItem
                      key={question.id}
                      title={question.title}
                      description="Orchid 2026 / A-01 银行存款审计程序"
                      icon={<MessageSquare />}
                      href={mobileRouteHref(next)}
                      onNavigate={follow(next)}
                    />
                  );
                })}
            </div>
            {mobileQuestions.every((question) =>
              state.resolved.includes(`orchid:cash-program:${question.id}`)
            ) ? (
              <CollectionState
                kind="empty"
                title="暂无待回复批注"
                locale="zh-CN"
              />
            ) : null}
          </div>
        ) : null}
        {route.screen === "account" ? (
          <MobileAccount workspace={workspace} />
        ) : null}
      </MobileScaffold>
      <MobileActionSheet
        open={locationOpen}
        onOpenChange={setLocationOpen}
        title="切换目录"
        description={`${project.name} · 当前：${folder?.name ?? "项目根目录"}`}
        closeLabel="关闭目录"
      >
        <Button
          variant="quiet"
          onClick={() => {
            setLocationOpen(false);
            navigate(projectRoute(project.id));
          }}
        >
          <FolderClosed aria-hidden />
          项目根目录
        </Button>
        {mobileFolders.map((item) => (
          <Button
            key={item.id}
            variant="quiet"
            onClick={() => {
              setLocationOpen(false);
              navigate(projectRoute(project.id, item.id));
            }}
          >
            {item.code} · {item.name}
            {item.id === folderId ? <Check aria-hidden /> : null}
          </Button>
        ))}
      </MobileActionSheet>
      <MobileActionSheet
        open={projectInfoOpen}
        onOpenChange={setProjectInfoOpen}
        title="项目信息"
        closeLabel="关闭项目信息"
      >
        <dl className="divide-y divide-border">
          {[
            ["项目名称", project.name],
            ["项目编号", project.code],
            ["客户", project.client],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 py-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </MobileActionSheet>
      <MobileActionSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="更多操作"
        description={title}
        closeLabel="关闭更多操作"
      >
        {inProject ? (
          <Button
            variant="quiet"
            onClick={() => {
              setMoreOpen(false);
              setProjectInfoOpen(true);
            }}
          >
            <FolderClosed aria-hidden />
            项目信息
          </Button>
        ) : null}
        {route.screen === "files" && route.folder ? (
          <Button
            variant="quiet"
            disabled={
              !selectingFiles &&
              !mobileFiles.some(
                (item) =>
                  effectiveFolder(state, route.project, item) === route.folder
              )
            }
            onClick={() => {
              setMoreOpen(false);
              setSelectingFiles(!selectingFiles);
            }}
          >
            <CheckCheck aria-hidden />
            {selectingFiles ? "取消选择" : "选择底稿"}
          </Button>
        ) : null}
        <Button
          variant="quiet"
          onClick={() => {
            setMoreOpen(false);
            setLocationOpen(true);
          }}
        >
          <FolderClosed aria-hidden />
          切换目录
        </Button>
        {route.screen === "document" && file.questions ? (
          <Button
            variant="quiet"
            onClick={() => {
              setMoreOpen(false);
              navigate(documentRoute(project.id, file.id, "notes"));
            }}
          >
            <MessageSquare aria-hidden />
            全部批注
          </Button>
        ) : null}
        {isQuestion ? (
          <Button
            variant="quiet"
            onClick={() => {
              updateMobileState((current) => ({
                ...current,
                resolved: current.resolved.includes(questionKey)
                  ? current.resolved.filter((key) => key !== questionKey)
                  : [...current.resolved, questionKey],
              }));
              setMoreOpen(false);
            }}
          >
            <CheckCheck aria-hidden />
            {state.resolved.includes(questionKey)
              ? "重新打开批注"
              : "标记为已处理"}
          </Button>
        ) : null}
      </MobileActionSheet>
    </>
  );
}

function ProjectSearchHeader({ workspace }: { workspace: Workspace }) {
  const { state } = workspace;
  return (
    <header
      className="border-b border-border bg-card px-3 py-1"
      aria-label="项目搜索与新建"
    >
      <div className="flex items-center gap-2">
        <h1 className="shrink-0 text-base font-semibold">项目</h1>
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            aria-label="搜索项目"
            placeholder="搜索项目、客户或编号"
            value={state.search}
            onChange={(event) =>
              updateMobileState((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />
        </div>
        {canGlobalRoleCreateProject(mobileAccountFixture.globalRole) ? (
          <Link
            href="/specimens/MobileProjectCreation"
            className="pw-mobile-icon-action"
            aria-label="新建项目"
            onClick={() => workspace.preserveScroll()}
          >
            <Plus aria-hidden />
          </Link>
        ) : null}
      </div>
    </header>
  );
}

function Projects({ workspace }: { workspace: Workspace }) {
  const { state, follow } = workspace;
  const matches = mobileProjects.filter((project) =>
    `${project.name} ${project.code} ${project.client}`
      .toLowerCase()
      .includes(state.search.trim().toLowerCase())
  );
  return (
    <div className="grid gap-4">
      {matches.length ? (
        <div className={groupClass}>
          {matches.map((project) => {
            const next = projectRoute(project.id);
            const count = mobileFiles.reduce(
              (sum, file) => sum + openQuestions(state, project.id, file),
              0
            );
            return (
              <MobileListItem
                key={project.id}
                title={project.name}
                description={project.client}
                meta={
                  <>
                    <span>{project.code}</span>
                    <span className="text-primary">
                      {count ? `${count} 条待处理` : "无待处理批注"}
                    </span>
                  </>
                }
                icon={<FolderClosed />}
                href={mobileRouteHref(next)}
                onNavigate={follow(next)}
              />
            );
          })}
        </div>
      ) : (
        <CollectionState
          kind="filtered"
          locale="zh-CN"
          action={{
            label: "清除搜索",
            onClick: () => {
              updateMobileState((current) => ({ ...current, search: "" }));
            },
          }}
        />
      )}
    </div>
  );
}

function Directory({
  workspace,
  selecting,
  onSelectingChange,
}: {
  workspace: Workspace;
  selecting: boolean;
  onSelectingChange: (selecting: boolean) => void;
}) {
  const { state, route, follow } = workspace;
  const [selected, setSelected] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [completedDestination, setCompletedDestination] = useState<
    string | null
  >(null);
  const files = mobileFiles.filter(
    (file) => effectiveFolder(state, route.project, file) === route.folder
  );
  const clearSelection = () => {
    setSelected([]);
    onSelectingChange(false);
  };
  const [previousSelecting, setPreviousSelecting] = useState(selecting);
  if (previousSelecting !== selecting) {
    setPreviousSelecting(selecting);
    if (selecting) {
      setSelected([]);
      setMessage("");
      setCompletedDestination(null);
      setTarget("");
    }
  }
  return (
    <div className="grid gap-4">
      {route.folder ? (
        <>
          {selecting ? (
            <div className="flex items-center justify-between">
              <output className="text-sm">已选 {selected.length} 份</output>
              <Button variant="quiet" onClick={clearSelection}>
                取消选择
              </Button>
              <Button
                variant="quiet"
                onClick={() =>
                  setSelected(
                    selected.length === files.length
                      ? []
                      : files.map((file) => file.id)
                  )
                }
              >
                {selected.length === files.length ? "取消全选" : "全选"}
              </Button>
            </div>
          ) : null}
          <div className={groupClass}>
            {files.map((file) => {
              const next = documentRoute(route.project, file.id);
              const notes = openQuestions(state, route.project, file);
              return selecting ? (
                <MobileSelectionRow
                  key={file.id}
                  title={file.name}
                  description={`${file.code} · ${file.kind}`}
                  checked={selected.includes(file.id)}
                  onCheckedChange={(checked) =>
                    setSelected((ids) =>
                      checked
                        ? [...ids, file.id]
                        : ids.filter((id) => id !== file.id)
                    )
                  }
                />
              ) : (
                <MobileListItem
                  key={file.id}
                  title={file.name}
                  description={`${file.code} · ${file.kind}${state.reviewed.includes(mobileFileKey(route.project, file.id)) ? " · 已查看" : ""}`}
                  showChevron={false}
                  secondaryAction={
                    <MobileFileSignoffs workspace={workspace} file={file} />
                  }
                  icon={
                    <ProjectWingFileTypeIcon
                      fileName={
                        file.kind === "SmartForm" &&
                        !file.name.toLowerCase().endsWith(".sf")
                          ? `${file.name}.sf`
                          : file.name
                      }
                      size="sm"
                      className="size-6"
                      iconClassName="size-6"
                    />
                  }
                  href={mobileRouteHref(next)}
                  onNavigate={follow(next)}
                  action={
                    file.questions ? (
                      <Button
                        variant="quiet"
                        className="pw-mobile-icon-action"
                        aria-label={`查看${file.name}的批注`}
                        onClick={() =>
                          workspace.navigate(
                            documentRoute(route.project, file.id, "notes")
                          )
                        }
                      >
                        <MessageSquare aria-hidden />
                        <span className="text-xs">{notes}</span>
                      </Button>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
          {files.length === 0 && (
            <CollectionState
              kind="empty"
              title="此目录暂无底稿"
              locale="zh-CN"
            />
          )}
          {selecting ? (
            <div className="sticky bottom-0 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
              <Button
                variant="outline"
                disabled={!selected.length}
                onClick={() => {
                  updateMobileState((current) => ({
                    ...current,
                    reviewed: [
                      ...new Set([
                        ...current.reviewed,
                        ...selected.map((id) =>
                          mobileFileKey(route.project, id)
                        ),
                      ]),
                    ],
                  }));
                  setMessage(`已将 ${selected.length} 份底稿标为已查看`);
                  setCompletedDestination(null);
                  clearSelection();
                }}
              >
                <CheckCheck aria-hidden />
                标为已查看
              </Button>
              <Button
                disabled={!selected.length}
                onClick={() => setMoveOpen(true)}
              >
                <MoveRight aria-hidden />
                移动
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className={groupClass}>
          {mobileFolders.map((folder) => {
            const next = projectRoute(route.project, folder.id);
            const count = mobileFiles.filter(
              (file) =>
                effectiveFolder(state, route.project, file) === folder.id
            ).length;
            return (
              <MobileListItem
                key={folder.id}
                title={`${folder.code} · ${folder.name}`}
                description={`${count} 份底稿`}
                icon={<FolderClosed />}
                href={mobileRouteHref(next)}
                onNavigate={follow(next)}
              />
            );
          })}
        </div>
      )}
      {message ? (
        <output className="text-sm text-primary">{message}</output>
      ) : null}
      {completedDestination ? (
        <Button
          variant="outline"
          onClick={() =>
            workspace.navigate(
              projectRoute(route.project, completedDestination)
            )
          }
        >
          前往
          {
            mobileFolders.find((folder) => folder.id === completedDestination)
              ?.name
          }
          <ArrowRight aria-hidden />
        </Button>
      ) : null}
      <MobileActionSheet
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={`移动 ${selected.length} 份底稿`}
        description="选择当前项目中的目标目录。"
        closeLabel="关闭移动面板"
      >
        {mobileFolders
          .filter((folder) => folder.id !== route.folder)
          .map((folder) => (
            <Button
              key={folder.id}
              variant="quiet"
              aria-pressed={target === folder.id}
              onClick={() => setTarget(folder.id)}
            >
              <FolderClosed aria-hidden />
              {folder.name}
              {target === folder.id ? <Check aria-hidden /> : null}
            </Button>
          ))}
        <Button
          disabled={!target || !selected.length}
          onClick={() => {
            updateMobileState((current) =>
              moveMobileFiles(
                current,
                route.project,
                route.folder,
                target,
                selected
              )
            );
            setMoveOpen(false);
            setMessage(`已移动 ${selected.length} 份底稿`);
            setCompletedDestination(target);
            clearSelection();
          }}
        >
          确认移动
        </Button>
      </MobileActionSheet>
    </div>
  );
}

type Procedure = { id: string; title: string; detail: string; result: string };
const procedureColumns: ProjectWingMasterDataGridProps<Procedure>["columns"] = [
  { accessorKey: "title", header: "审计程序", size: 150 },
  { accessorKey: "detail", header: "执行内容", size: 240 },
  { accessorKey: "result", header: "执行结果", size: 110 },
];
function Document({
  workspace,
  file,
}: {
  workspace: Workspace;
  file: MobileFile;
}) {
  const { route, state } = workspace;
  const key = mobileFileKey(route.project, file.id);
  const saved = state.savedEdits[key];
  const profile = useMemo(() => mobileDocumentProfile(file), [file]);
  const procedures = useMemo(
    () =>
      profile.procedures.map((row) => ({
        ...row,
        result: saved?.[row.id] ?? row.result,
      })),
    [saved, profile]
  );
  if (route.mode === "notes") {
    return <Notes workspace={workspace} file={file} />;
  }
  if (isImportedMobileSmartForm(file)) {
    return (
      <MobileDocumentPreview
        projectId={route.project}
        file={file}
        sourceUrl={importedSmartFormPdf}
      />
    );
  }
  if (route.mode === "edit") {
    return <Editor workspace={workspace} file={file} />;
  }
  if (file.kind === "PDF") {
    return <MobileDocumentPreview projectId={route.project} file={file} />;
  }
  return (
    <div className="grid gap-4">
      <article className="grid gap-5 rounded-xl border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">
          {
            mobileProjects.find((project) => project.id === route.project)
              ?.client
          }
        </p>
        <h2 className="text-lg font-semibold">{file.name}</h2>
        <p className="text-sm leading-7">截至 2026 年 12 月 31 日</p>
        <div className="border-t border-border pt-4">
          <h3 className="font-medium">{profile.heading}</h3>
          <p className="mt-2 text-sm leading-7">{profile.summary}</p>
        </div>
      </article>
      {file.kind === "SmartForm" || file.kind === "XLSX" ? (
        <section className="min-w-0">
          <h3 className="mb-3 text-sm font-semibold">执行记录</h3>
          <ProjectWingMasterDataGrid<Procedure>
            title="执行记录"
            tableLabel="执行记录，表格可横向滚动"
            testId="mobile-procedure-table"
            columns={procedureColumns}
            data={procedures}
            getRowId={(row) => row.id}
            emptyMessage="暂无记录"
            showRowSelection={false}
            showToolbar={false}
            compactHiddenColumnIds={[]}
          />
        </section>
      ) : null}
      {file.questions ? (
        <Button
          variant="outline"
          onClick={() =>
            workspace.navigate(documentRoute(route.project, file.id, "notes"))
          }
        >
          <MessageSquare aria-hidden />
          查看 {file.questions} 条批注
        </Button>
      ) : null}
    </div>
  );
}

function Notes({
  workspace,
  file,
}: {
  workspace: Workspace;
  file: MobileFile;
}) {
  const { route, state, follow } = workspace;
  const [imageOpen, setImageOpen] = useState(false);
  const profile = mobileDocumentProfile(file);
  const { questions } = profile;
  const question = questions.find((item) => item.id === route.question);
  if (!question) {
    return (
      <div className="grid gap-4">
        {questions.length ? (
          <div className={groupClass}>
            {questions.map((item) => {
              const next = documentRoute(
                route.project,
                file.id,
                "notes",
                item.id
              );
              const key = mobileQuestionKey(next);
              return (
                <MobileListItem
                  key={item.id}
                  title={`${item.id.toUpperCase()} · ${item.title}`}
                  description={
                    state.resolved.includes(key) ? "已处理" : "待回复"
                  }
                  meta={`${(mobileHasEvidenceImage(file, item.id) ? 3 : 2) + (state.replies[key]?.length ?? 0)} 条消息${state.drafts[key] ? " · 有草稿" : ""}`}
                  href={mobileRouteHref(next)}
                  onNavigate={follow(next)}
                  icon={<MessageSquare />}
                />
              );
            })}
          </div>
        ) : (
          <CollectionState kind="empty" title="此文件暂无批注" locale="zh-CN" />
        )}
      </div>
    );
  }
  const key = mobileQuestionKey(route);
  const referenceFile =
    mobileFiles.find((item) => item.id === profile.referenceId) ?? file;
  const reference = documentRoute(route.project, referenceFile.id);
  return (
    <div className="grid gap-3">
      <div>
        <MobileMessage
          variant="initial"
          author="Alex Chen"
          avatar={
            <ProjectWingTopBarAvatar
              name="Alex Chen"
              label="Alex Chen"
              size="sm"
            />
          }
          time="09/10 09:30"
        >
          <h2 className="text-base font-semibold">{question.title}</h2>
          <ReviewNoteRichText value={question.text} />
        </MobileMessage>
        <MobileMessage
          author="Jamie Lee"
          avatar={
            <ProjectWingTopBarAvatar
              name="Jamie Lee"
              label="Jamie Lee"
              size="sm"
            />
          }
          time="09/10 10:15"
          attachments={
            <MobileAttachmentLink
              fileName={referenceFile.name}
              icon={
                <ProjectWingFileTypeIcon
                  fileName={
                    referenceFile.kind === "SmartForm" &&
                    !referenceFile.name.endsWith(".sf")
                      ? `${referenceFile.name}.sf`
                      : referenceFile.name
                  }
                  size="sm"
                />
              }
              href={mobileRouteHref(reference)}
              onNavigate={follow(reference)}
            />
          }
        >
          <ReviewNoteRichText value="已补充**相关说明**，请查看对应的参考底稿。" />
        </MobileMessage>
        {mobileHasEvidenceImage(file, question.id) ? (
          <MobileMessage
            author="Eden Chan"
            avatar={
              <ProjectWingTopBarAvatar
                name="Eden Chan"
                label="Eden Chan"
                size="sm"
              />
            }
            time="09/10 11:08"
            attachments={
              <MobileImageAttachment
                src="/mobile-media/balance-check.svg"
                alt="银行余额核对图"
                label="查看银行余额核对图"
                onOpen={() => setImageOpen(true)}
              />
            }
          >
            <ReviewNoteRichText value="**余额已核对**，_差异说明_见附件。[参考链接](https://example.com)" />
          </MobileMessage>
        ) : null}
        {(state.replies[key] ?? []).map((reply) => (
          <MobileMessage
            key={reply.id}
            author={mobileAccountFixture.name}
            avatar={
              <ProjectWingTopBarAvatar
                name={mobileAccountFixture.name}
                label={mobileAccountFixture.name}
                size="sm"
              />
            }
            dateTime={reply.createdAt}
            time={
              reply.createdAt
                ? new Date(reply.createdAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                : undefined
            }
          >
            <ReviewNoteRichText value={reply.text} />
          </MobileMessage>
        ))}
      </div>
      <MobileActionSheet
        open={imageOpen}
        onOpenChange={setImageOpen}
        title="银行余额核对图"
        closeLabel="关闭图片"
      >
        <MobileImageAttachment
          expanded
          src="/mobile-media/balance-check.svg"
          alt="银行余额核对图"
          label="关闭银行余额核对图"
          onOpen={() => setImageOpen(false)}
        />
      </MobileActionSheet>
      <p aria-live="polite" className="sr-only">
        {state.replies[key]?.length
          ? `已添加 ${state.replies[key].length} 条回复`
          : ""}
      </p>
    </div>
  );
}

function Editor({
  workspace,
  file,
}: {
  workspace: Workspace;
  file: MobileFile;
}) {
  const { route, state } = workspace;
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const key = mobileFileKey(route.project, file.id);
  const draft = state.editDrafts[key] ?? {};
  const saved = state.savedEdits[key] ?? {};
  const { procedures } = mobileDocumentProfile(file);
  const row = procedures.find((item) => item.id === activeRow);
  const setValue = (field: string, value: string) =>
    updateMobileState((current) => ({
      ...current,
      editDrafts: {
        ...current.editDrafts,
        [key]: { ...current.editDrafts[key], [field]: value },
      },
    }));
  return (
    <div className="grid gap-4">
      {Object.keys(draft).length ? (
        <output className="text-xs text-muted-foreground">有未保存更改</output>
      ) : null}
      <div className={groupClass}>
        {procedures.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {draft[item.id] ?? saved[item.id] ?? item.result}
              </p>
            </div>
            <Button
              variant="quiet"
              aria-label={`填写${item.title}`}
              onClick={() => setActiveRow(item.id)}
            >
              <Pencil aria-hidden />
              填写
            </Button>
          </div>
        ))}
      </div>
      <MobileActionSheet
        open={Boolean(row)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveRow(null);
          }
        }}
        title={row?.title ?? "填写执行记录"}
        description={row?.detail}
        closeLabel="关闭填写"
      >
        {row ? (
          <>
            <ViewSwitcher
              label="执行结果"
              value={draft[row.id] ?? saved[row.id] ?? row.result}
              options={mobileProcedureResultOptions({
                id: row.id,
                result: draft[row.id] ?? saved[row.id] ?? row.result,
              }).map((value) => ({
                value,
                label: value,
              }))}
              onValueChange={(value) => setValue(row.id, value)}
            />
            <label
              htmlFor="mobile-procedure-remark"
              className="grid gap-2 text-sm"
            >
              备注
              <Input
                id="mobile-procedure-remark"
                aria-label="执行备注"
                value={
                  draft[`${row.id}:remark`] ?? saved[`${row.id}:remark`] ?? ""
                }
                onChange={(event) =>
                  setValue(`${row.id}:remark`, event.target.value)
                }
                maxLength={1000}
              />
            </label>
            <Button onClick={() => setActiveRow(null)}>完成填写</Button>
          </>
        ) : null}
      </MobileActionSheet>
    </div>
  );
}
