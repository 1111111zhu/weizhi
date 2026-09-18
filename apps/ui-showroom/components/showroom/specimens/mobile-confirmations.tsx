"use client";

import {
  Button,
  CollectionState,
  Input,
  MobileActionSheet,
  MobileListItem,
  MobileTextArea,
  ViewSwitcher,
} from "@project-wing/ui";
import {
  Archive,
  Library,
  Landmark,
  FileText,
  FolderClosed,
  SlidersHorizontal,
  Search,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import {
  confirmationStatusLabels,
  mobileConfirmationSections,
  confirmationTypeLabels,
  emptyConfirmationForm,
  saveMobileConfirmationDraft,
} from "./mobile-services-model";
import type {
  MobileConfirmationErrors,
  MobileConfirmationForm,
} from "./mobile-services-model";
import {
  initialMobileRoute,
  mobileProjects,
  mobileRouteHref,
} from "./mobile-workspace-model";
import { updateMobileState } from "./mobile-workspace-state";
import type { MobileWorkspaceContext } from "./mobile-workspace-state";

export const confirmationRoute = (id = "", editing = false) => ({
  ...initialMobileRoute,
  screen: editing
    ? ("confirmation-edit" as const)
    : id
      ? ("confirmation" as const)
      : ("confirmations" as const),
  confirmation: id,
});
export const confirmationSectionRoute = (section: string) => ({
  ...confirmationRoute(),
  section,
});
const sectionIcons = {
  all: FileText,
  templates: Library,
  information: Landmark,
  replies: Archive,
};
const projectOptions = mobileProjects.map((project) => ({
  value: project.id,
  label: project.name,
}));

export function MobileConfirmations({
  workspace,
}: {
  workspace: MobileWorkspaceContext;
}) {
  const { route, state, navigate, follow } = workspace;
  const filters = state.confirmationFilters;
  if (route.screen === "confirmations" && !route.section) {
    return (
      <nav aria-label="函证中心栏目" className="grid">
        {mobileConfirmationSections.map(({ id, label }) => {
          const next = confirmationSectionRoute(id);
          const Icon = sectionIcons[id];
          return (
            <MobileListItem
              key={id}
              title={label}
              icon={<Icon />}
              href={mobileRouteHref(next)}
              onNavigate={follow(next)}
            />
          );
        })}
      </nav>
    );
  }
  if (route.screen === "confirmations" && route.section !== "all") {
    return (
      <CollectionState
        kind="error"
        locale="zh-CN"
        title="当前无法读取此栏目"
        description=""
        action={{
          label: "返回函证中心",
          onClick: () => navigate(confirmationRoute()),
        }}
      />
    );
  }
  if (route.screen === "confirmation-edit") {
    return (
      <ConfirmationForm
        key={route.confirmation || "new"}
        workspace={workspace}
      />
    );
  }
  if (route.screen === "confirmation") {
    const record = state.confirmations.find(
      (item) => item.id === route.confirmation
    );
    if (!record) {
      return (
        <CollectionState
          kind="empty"
          title="未找到这份函证"
          locale="zh-CN"
          action={{
            label: "返回函证中心",
            onClick: () => navigate(confirmationRoute()),
          }}
        />
      );
    }
    const project = mobileProjects.find((item) => item.id === record.projectId);
    return (
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{record.code}</span>
          <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
            {confirmationStatusLabels[record.status]}
          </span>
        </div>
        <dl className="divide-y divide-border">
          {[
            ["项目", project?.name ?? record.projectId],
            ["类型", confirmationTypeLabels[record.type]],
            ["被询证方", record.recipient],
            ["联系邮箱", record.email || "—"],
            ["函证基准日", record.date],
            ["备注", record.notes || "—"],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 py-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm leading-6 break-words whitespace-pre-wrap">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {record.status === "DRAFT" ? (
          <Button onClick={() => navigate(confirmationRoute(record.id, true))}>
            编辑草稿
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() =>
            navigate({
              ...initialMobileRoute,
              screen: "files",
              project: record.projectId,
            })
          }
        >
          <FolderClosed aria-hidden />
          打开关联项目
        </Button>
      </div>
    );
  }
  const rows = state.confirmations.filter(
    (record) =>
      (!filters.projectId || record.projectId === filters.projectId) &&
      (!filters.status || record.status === filters.status) &&
      `${record.name} ${record.code} ${record.recipient}`
        .toLowerCase()
        .includes(filters.query.toLowerCase())
  );
  const updateFilters = (patch: Partial<typeof filters>) =>
    updateMobileState((current) => ({
      ...current,
      confirmationFilters: { ...current.confirmationFilters, ...patch },
    }));
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="搜索函证"
            placeholder="名称、编号或被询证方"
            className="pl-9"
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value })}
          />
        </div>
        <ConfirmationFilters workspace={workspace} />
      </div>
      {rows.length ? (
        <div className="grid">
          {rows.map((record) => {
            const next = confirmationRoute(record.id);
            return (
              <MobileListItem
                key={record.id}
                title={record.name}
                description={
                  mobileProjects.find(
                    (project) => project.id === record.projectId
                  )?.name
                }
                meta={
                  <>
                    <span>{record.code}</span>
                    <span>{confirmationStatusLabels[record.status]}</span>
                  </>
                }
                icon={<FileText />}
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
            label: "清除筛选",
            onClick: () =>
              updateFilters({ projectId: "", status: "", query: "" }),
          }}
        />
      )}
    </div>
  );
}

function ConfirmationFilters({
  workspace,
}: {
  workspace: MobileWorkspaceContext;
}) {
  const filters = workspace.state.confirmationFilters;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    projectId: filters.projectId,
    status: filters.status,
  });
  const count =
    Number(Boolean(filters.projectId)) + Number(Boolean(filters.status));
  return (
    <>
      <Button
        variant="quiet"
        className="pw-mobile-icon-action"
        aria-label={count ? `筛选函证，已应用 ${count} 项` : "筛选函证"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setDraft({ projectId: filters.projectId, status: filters.status });
          setOpen(true);
        }}
      >
        <SlidersHorizontal aria-hidden />
        {count ? (
          <span className="text-xs" aria-hidden>
            {count}
          </span>
        ) : null}
      </Button>
      <MobileActionSheet
        open={open}
        onOpenChange={setOpen}
        title="筛选函证"
        closeLabel="关闭筛选"
      >
        <div className="grid gap-4">
          <ViewSwitcher
            label="项目"
            wrapOptions
            value={draft.projectId}
            options={[{ value: "", label: "全部项目" }, ...projectOptions]}
            onValueChange={(projectId) =>
              setDraft((current) => ({ ...current, projectId }))
            }
          />
          <ViewSwitcher
            label="状态"
            wrapOptions
            value={draft.status}
            options={[
              { value: "", label: "全部状态" },
              ...Object.entries(confirmationStatusLabels).map(
                ([value, label]) => ({ value, label })
              ),
            ]}
            onValueChange={(status) =>
              setDraft((current) => ({ ...current, status }))
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              fullWidth
              variant="outline"
              onClick={() => setDraft({ projectId: "", status: "" })}
            >
              重置
            </Button>
            <Button
              fullWidth
              onClick={() => {
                updateMobileState((current) => ({
                  ...current,
                  confirmationFilters: {
                    ...current.confirmationFilters,
                    ...draft,
                  },
                }));
                setOpen(false);
              }}
            >
              应用
            </Button>
          </div>
        </div>
      </MobileActionSheet>
    </>
  );
}

function ConfirmationForm({
  workspace,
}: {
  workspace: MobileWorkspaceContext;
}) {
  const { route, state, navigate } = workspace;
  const existing = state.confirmations.find(
    (record) => record.id === route.confirmation
  );
  const draftKey = route.confirmation || "new";
  const form =
    state.confirmationDrafts[draftKey] ??
    existing ??
    emptyConfirmationForm(state.confirmationFilters.projectId);
  const [errors, setErrors] = useState<MobileConfirmationErrors>({});
  const [saving, setSaving] = useState(false);
  const submitted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const focusError = useRef(false);
  useLayoutEffect(() => {
    if (!focusError.current || !Object.values(errors).some(Boolean)) {
      return;
    }
    focusError.current = false;
    const invalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]'
    );
    invalid?.focus();
    invalid?.scrollIntoView({ block: "center" });
  }, [errors]);
  const setField = <K extends keyof MobileConfirmationForm>(
    field: K,
    value: MobileConfirmationForm[K]
  ) => {
    updateMobileState((current) => ({
      ...current,
      confirmationDrafts: {
        ...current.confirmationDrafts,
        [draftKey]: {
          ...(current.confirmationDrafts[draftKey] ?? form),
          [field]: value,
        },
      },
    }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }));
  };
  if (route.confirmation && (!existing || existing.status !== "DRAFT")) {
    return (
      <CollectionState
        kind="error"
        title={existing ? "此函证已不是草稿" : "未找到这份函证"}
        description=""
        locale="zh-CN"
        action={{
          label: "返回详情",
          onClick: () => navigate(confirmationRoute(route.confirmation)),
        }}
      />
    );
  }
  const submit = () => {
    if (submitted.current) {
      return;
    }
    const result = saveMobileConfirmationDraft(
      state.confirmations,
      form,
      route.confirmation,
      crypto.randomUUID(),
      new Date().toISOString(),
      mobileProjects.map((project) => project.id)
    );
    if (!result.ok) {
      focusError.current = true;
      setErrors(result.errors);
      return;
    }
    submitted.current = true;
    setSaving(true);
    updateMobileState((current) => {
      const { [draftKey]: _discarded, ...drafts } = current.confirmationDrafts;
      return {
        ...current,
        confirmations: result.records,
        confirmationDrafts: drafts,
      };
    });
    navigate(confirmationRoute(result.id), true);
  };
  const field = (
    name: "name" | "recipient" | "email" | "date",
    label: string,
    type = "text"
  ) => (
    <div className="grid gap-2">
      <label htmlFor={`confirmation-${name}`} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={`confirmation-${name}`}
        name={name}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={
          errors[name] ? `confirmation-${name}-error` : undefined
        }
        type={type}
        value={form[name]}
        onChange={(event) => setField(name, event.target.value)}
        maxLength={name === "email" ? 255 : name === "date" ? 10 : 160}
      />
      {errors[name] ? (
        <p
          id={`confirmation-${name}-error`}
          role="alert"
          className="text-sm text-destructive"
        >
          {errors[name]}
        </p>
      ) : null}
    </div>
  );
  return (
    <form
      ref={formRef}
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-2">
        <span className="text-sm font-medium">项目</span>
        {existing ? (
          <p className="text-sm">
            {
              mobileProjects.find(
                (project) => project.id === existing.projectId
              )?.name
            }
          </p>
        ) : (
          <ViewSwitcher
            label="项目"
            wrapOptions
            value={form.projectId}
            options={projectOptions}
            invalid={Boolean(errors.projectId)}
            descriptionId={
              errors.projectId ? "confirmation-project-error" : undefined
            }
            onValueChange={(value) => setField("projectId", value)}
          />
        )}
        {errors.projectId ? (
          <p
            id="confirmation-project-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {errors.projectId}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">函证类型</span>
        <ViewSwitcher
          label="函证类型"
          wrapOptions
          value={form.type}
          options={Object.entries(confirmationTypeLabels).map(
            ([value, label]) => ({ value, label })
          )}
          onValueChange={(value) =>
            setField("type", value as MobileConfirmationForm["type"])
          }
        />
      </div>
      {field("name", "函证名称")}
      {field("recipient", "被询证方")}
      {field("email", "联系邮箱", "email")}
      {field("date", "函证基准日", "date")}
      <div className="grid gap-2">
        <label htmlFor="confirmation-notes" className="text-sm font-medium">
          备注
        </label>
        <MobileTextArea
          id="confirmation-notes"
          rows={3}
          value={form.notes}
          maxLength={2000}
          onChange={(event) => setField("notes", event.target.value)}
        />
      </div>
      {errors.form ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}
      <div className="sticky bottom-0 border-t border-border bg-background py-3">
        <Button fullWidth type="submit" disabled={saving}>
          保存草稿
        </Button>
      </div>
    </form>
  );
}
