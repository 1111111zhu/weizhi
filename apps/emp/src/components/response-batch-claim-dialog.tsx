"use client";

import type {
  ConfirmationType,
  RouteConfirmationResponseLibraryFileInput,
} from "@project-wing/shared";
import { Button as SharedButton, ComboboxField } from "@project-wing/ui";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useRef, useState } from "react";

import { api } from "@/api/client";
import type { ConfirmationResponseLibraryFile } from "@/api/client";
import { confirmationResponseRoutingCopy } from "@/i18n/confirmation-response-routing-copy";

import type { ConfirmationResponseWarehouseCopy } from "./confirmation-response-warehouse";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export type ClaimDestination = { href: string; label: string };

type Action = "MATCH_CONFIRMATION" | "PENDING_MATCH" | "NO_SOURCE_REQUEST";
type Draft = {
  projectId: string;
  action: Action;
  confirmationId: string;
  provisionalType: ConfirmationType;
};
type Entry = Draft & {
  response: ConfirmationResponseLibraryFile;
  status: "pending" | "saving" | "success" | "error";
  error?: string;
};
type Shared = {
  projectId: string;
  action: Action | "";
  provisionalType: ConfirmationType | "";
};
const TYPES: ConfirmationType[] = [
  "BANK",
  "INTERMEDIARY",
  "BALANCE",
  "RELATED_PARTY",
  "LAWYER",
  "INVENTORY",
  "OTHER",
];
const ready = (entry: Entry) =>
  Boolean(
    entry.projectId &&
    (entry.action !== "MATCH_CONFIRMATION" || entry.confirmationId)
  );

export function ResponseBatchClaimDialog({
  responses,
  locale,
  copy,
  allowNoSourceRequest = false,
  onClose,
  onClaimed,
  onCompleted,
}: {
  responses: ConfirmationResponseLibraryFile[];
  locale: string;
  copy: ConfirmationResponseWarehouseCopy;
  allowNoSourceRequest?: boolean;
  onClose: () => void;
  onCompleted?: (destinations: ClaimDestination[], count: number) => void;
  onClaimed: (rows: ConfirmationResponseLibraryFile[]) => Promise<void>;
}) {
  const zh = locale.startsWith("zh");
  const text = confirmationResponseRoutingCopy[zh ? "zh-CN" : "en-US"];
  const [entries, setEntries] = useState<Entry[]>(() =>
    responses.map((response) => ({
      response,
      projectId: response.projectId ?? "",
      action: "PENDING_MATCH",
      confirmationId: "",
      provisionalType:
        response.provisionalType && TYPES.includes(response.provisionalType)
          ? response.provisionalType
          : "OTHER",
      status: "pending",
    }))
  );
  const [activeId, setActiveId] = useState(responses[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shared, setShared] = useState<Shared>({
    projectId: "",
    action: "",
    provisionalType: "",
  });
  const [bulk, setBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const running = useRef(false);
  const completed = useRef(new Map<string, ClaimDestination>());
  const active = entries.find((e) => e.response.id === activeId) ?? entries[0];
  const unfinished = entries.filter((e) => e.status !== "success");
  const projects = useQuery({
    queryKey: ["projects", "response-routing"],
    queryFn: api.projects,
  });
  const confirmations = useQuery({
    queryKey: ["project-confirmations", active?.projectId],
    queryFn: () =>
      active?.projectId
        ? api.projectConfirmations(active.projectId)
        : Promise.resolve([]),
    enabled: Boolean(
      active?.projectId && active.action === "MATCH_CONFIRMATION" && !bulk
    ),
  });
  const actions: { value: Action; label: string }[] = [
    { value: "PENDING_MATCH", label: text.matchLater },
    { value: "MATCH_CONFIRMATION", label: text.matchConfirmation },
    ...(allowNoSourceRequest
      ? [{ value: "NO_SOURCE_REQUEST" as const, label: text.noOutgoingRequest }]
      : []),
  ];
  const projectOptions = (projects.data ?? [])
    .filter((p) => p.status === "ACTIVE")
    .map((p) => ({ value: p.id, label: `${p.name} · ${p.projectCode}` }));
  const typeOptions = TYPES.map((type) => ({
    value: type,
    label: text.typeLabels[type as keyof typeof text.typeLabels],
  }));
  const update = (id: string, values: Partial<Draft>) =>
    setEntries((current) =>
      current.map((entry) => {
        if (entry.response.id !== id || entry.status === "success") {
          return entry;
        }
        const reset =
          (values.projectId !== undefined &&
            values.projectId !== entry.projectId) ||
          (values.action !== undefined && values.action !== entry.action);
        return {
          ...entry,
          ...values,
          ...(reset ? { confirmationId: "" } : {}),
          status: "pending",
          error: undefined,
        };
      })
    );
  const candidates = (confirmations.data ?? []).filter((item) => {
    const q = search.trim().toLocaleLowerCase(locale);
    return (
      item.status !== "RESPONSE_RECEIVED" &&
      (q || category !== "ALL" || item.status === "AWAITING_RESPONSE") &&
      !(item.responses ?? []).some(
        (r) => r.responseStatus === "RECEIVED" && r.routingStatus === "ROUTED"
      ) &&
      (category === "ALL" || item.type === category) &&
      (!q ||
        [
          item.confirmationCode,
          item.counterpartyName,
          item.respondingEntityName,
          item.displayName,
          ...(item.dispatches ?? []).map((d) => d.trackingNumber),
        ].some((v) => v?.toLocaleLowerCase(locale).includes(q)))
    );
  });
  const selectEntry = (entry: Entry) => {
    setActiveId(entry.response.id);
    setBulk(false);
    setSearch("");
    setCategory("ALL");
  };
  async function submit() {
    if (running.current) {
      return;
    }
    const invalid = unfinished.find((e) => !ready(e));
    if (invalid) {
      selectEntry(invalid);
      setNotice(
        zh
          ? "请为每份回函选择项目，并完成具体函证匹配。"
          : "Choose a project and complete the matching details for every response."
      );
      return;
    }
    const targets = unfinished
      .filter((e) => e.action === "MATCH_CONFIRMATION")
      .map((e) => e.confirmationId);
    if (new Set(targets).size !== targets.length) {
      setNotice(
        zh
          ? "多份回函选择了同一函证，请逐份检查后再确认。"
          : "Multiple responses target the same confirmation. Review the selections before confirming."
      );
      return;
    }
    running.current = true;
    setBusy(true);
    setNotice("");
    setBulk(false);
    const updated: ConfirmationResponseLibraryFile[] = [];
    let failures = 0;
    try {
      for (const entry of unfinished) {
        setEntries((current) =>
          current.map((e) =>
            e.response.id === entry.response.id
              ? { ...e, status: "saving", error: undefined }
              : e
          )
        );
        try {
          const input: RouteConfirmationResponseLibraryFileInput =
            entry.action === "MATCH_CONFIRMATION"
              ? {
                  action: entry.action,
                  projectId: entry.projectId,
                  confirmationId: entry.confirmationId,
                }
              : {
                  action: entry.action,
                  projectId: entry.projectId,
                  provisionalType: entry.provisionalType,
                };
          const result = await api.routeConfirmationResponseLibraryFile(
            entry.response.id,
            input
          );
          updated.push(result);
          const projectId = result.projectId ?? entry.projectId;
          const confirmationId = result.confirmationId ?? entry.confirmationId;
          const concrete = entry.action !== "PENDING_MATCH" && confirmationId;
          const projectName =
            projects.data?.find((p) => p.id === projectId)?.name ?? projectId;
          completed.current.set(entry.response.id, {
            href: `/${locale}/engagement/${encodeURIComponent(projectId)}?workspace=confirmations&${concrete ? `confirmationId=${encodeURIComponent(confirmationId)}&confirmationStage=draft` : "confirmationView=unmatched"}`,
            label: `${projectName} · ${concrete ? entry.response.title : zh ? "未匹配回函" : "Unmatched responses"}`,
          });
          setEntries((current) =>
            current.map((e) =>
              e.response.id === entry.response.id
                ? { ...e, status: "success" }
                : e
            )
          );
          setSelected((current) => {
            const next = new Set(current);
            next.delete(entry.response.id);
            return next;
          });
        } catch (error) {
          failures += 1;
          setEntries((current) =>
            current.map((e) =>
              e.response.id === entry.response.id
                ? {
                    ...e,
                    status: "error",
                    error:
                      error instanceof Error
                        ? error.message
                        : copy.batchClaimError,
                  }
                : e
            )
          );
        }
      }
      setNotice(
        zh
          ? `成功认领 ${updated.length} 份${failures ? `，失败 ${failures} 份，可重试` : ""}`
          : `Claimed ${updated.length}${failures ? `; ${failures} failed. Retry available.` : ""}`
      );
      if (updated.length) {
        try {
          await onClaimed(updated);
        } catch {
          setNotice(
            zh
              ? "认领已保存，请刷新仓库查看。"
              : "Claims saved. Refresh the warehouse to view them."
          );
        }
      }
      if (!failures && completed.current.size === entries.length) {
        const destinations = [
          ...new Map(
            [...completed.current.values()].map((target) => [
              target.href,
              target,
            ])
          ).values(),
        ];
        onClose();
        onCompleted?.(destinations, completed.current.size);
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  if (!active) {
    return null;
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !running.current) {
          onClose();
        }
      }}
    >
      <DialogContent
        className={`flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 ${entries.length > 1 ? "h-[85dvh] max-w-[1200px] sm:max-w-[1200px]" : "max-w-[760px] sm:max-w-[760px]"}`}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{copy.batchClaimTitle}</DialogTitle>
          <DialogDescription>
            {zh
              ? "逐份设置项目和匹配方式，或选择多份统一设置。确认后逐份认领。"
              : "Set each response’s project and matching method, or apply shared settings to selected responses."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
          {entries.length > 1 && (
            <aside className="flex max-h-48 shrink-0 flex-col border-b sm:max-h-none sm:w-72 sm:border-r sm:border-b-0">
              <div className="flex items-center gap-3 border-b p-4">
                <Checkbox
                  aria-label={
                    zh ? "全选待认领回函" : "Select all pending responses"
                  }
                  disabled={busy || !unfinished.length}
                  checked={Boolean(
                    unfinished.length &&
                    unfinished.every((e) => selected.has(e.response.id))
                  )}
                  onCheckedChange={(value) =>
                    setSelected(
                      value
                        ? new Set(unfinished.map((e) => e.response.id))
                        : new Set()
                    )
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !selected.size}
                  onClick={() => setBulk(true)}
                >
                  {zh ? "批量设置" : "Shared settings"}
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {entries.map((entry) => (
                  <div
                    key={entry.response.id}
                    className={`mb-1 flex items-start gap-2 rounded-lg p-3 ${activeId === entry.response.id && !bulk ? "bg-primary/10" : ""}`}
                  >
                    <Checkbox
                      aria-label={`${zh ? "选择" : "Select"}: ${entry.response.title}`}
                      checked={selected.has(entry.response.id)}
                      disabled={busy || entry.status === "success"}
                      onCheckedChange={(value) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (value) {
                            next.add(entry.response.id);
                          } else {
                            next.delete(entry.response.id);
                          }
                          return next;
                        })
                      }
                    />
                    <SharedButton
                      variant="quiet"
                      fullWidth
                      size="sm"
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      aria-label={`${zh ? "设置" : "Configure"}: ${entry.response.title}`}
                      onClick={() => selectEntry(entry)}
                    >
                      <span className="grid w-full min-w-0 text-left">
                        <span className="block truncate text-sm font-medium">
                          {entry.response.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {projectOptions.find(
                            (p) => p.value === entry.projectId
                          )?.label ?? text.selectProject}
                        </span>
                        <span
                          className={`text-xs ${entry.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {entry.status === "success"
                            ? zh
                              ? "已认领"
                              : "Claimed"
                            : entry.status === "saving"
                              ? text.saving
                              : entry.status === "error"
                                ? zh
                                  ? "认领失败"
                                  : "Failed"
                                : ready(entry)
                                  ? zh
                                    ? "已就绪"
                                    : "Ready"
                                  : zh
                                    ? "待设置"
                                    : "Needs details"}
                        </span>
                      </span>
                    </SharedButton>
                  </div>
                ))}
              </div>
            </aside>
          )}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
            {bulk ? (
              <div className="grid gap-5">
                <h3 className="font-medium">
                  {zh
                    ? `批量设置 · 已选 ${selected.size} 份`
                    : `Shared settings · ${selected.size} selected`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {zh
                    ? "仅覆盖已选择的设置，留空则保持原值。更换项目或匹配方式后，需要重新选择具体函证。"
                    : "Only filled settings replace existing values. Changing a project or method clears its confirmation selection."}
                </p>
                <Choice
                  label={text.selectProject}
                  value={shared.projectId}
                  options={projectOptions}
                  search={{
                    placeholder: text.searchProject,
                    emptyMessage: text.noProjects,
                  }}
                  empty={zh ? "不修改" : "Keep unchanged"}
                  onChange={(value) =>
                    setShared((current) => ({ ...current, projectId: value }))
                  }
                />
                <Choice
                  label={zh ? "匹配方式" : "Matching method"}
                  value={shared.action}
                  options={actions}
                  empty={zh ? "不修改" : "Keep unchanged"}
                  onChange={(value) =>
                    setShared((current) => ({
                      ...current,
                      action: value as Shared["action"],
                    }))
                  }
                />
                <Choice
                  label={text.provisionalCategory}
                  value={shared.provisionalType}
                  options={typeOptions}
                  empty={zh ? "不修改" : "Keep unchanged"}
                  onChange={(value) =>
                    setShared((current) => ({
                      ...current,
                      provisionalType: value as Shared["provisionalType"],
                    }))
                  }
                />
                <Button
                  disabled={
                    !selected.size || !Object.values(shared).some(Boolean)
                  }
                  onClick={() => {
                    for (const id of selected) {
                      update(id, {
                        ...(shared.projectId
                          ? { projectId: shared.projectId }
                          : {}),
                        ...(shared.action ? { action: shared.action } : {}),
                        ...(shared.provisionalType
                          ? { provisionalType: shared.provisionalType }
                          : {}),
                      });
                    }
                    setBulk(false);
                    setShared({
                      projectId: "",
                      action: "",
                      provisionalType: "",
                    });
                    setNotice("");
                  }}
                >
                  {zh ? "应用到所选回函" : "Apply to selected responses"}
                </Button>
              </div>
            ) : (
              <fieldset
                disabled={busy || active.status === "success"}
                className="grid gap-5"
              >
                <div>
                  <h3 className="font-medium">{active.response.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {active.response.clientName} ·{" "}
                    {active.response.respondingEntity}
                  </p>
                </div>
                {active.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {active.error}
                  </p>
                )}
                <Choice
                  label={text.selectProject}
                  value={active.projectId}
                  options={projectOptions}
                  search={{
                    placeholder: text.searchProject,
                    emptyMessage: text.noProjects,
                  }}
                  empty={text.selectProject}
                  onChange={(value) => {
                    update(active.response.id, { projectId: value });
                    setSearch("");
                    setCategory("ALL");
                  }}
                />
                {projects.isError && (
                  <p role="alert">
                    {zh ? "项目加载失败" : "Could not load projects"}
                    <Button variant="link" onClick={() => projects.refetch()}>
                      {text.retry}
                    </Button>
                  </p>
                )}
                <Choice
                  label={zh ? "匹配方式" : "Matching method"}
                  value={active.action}
                  options={actions}
                  onChange={(value) =>
                    update(active.response.id, { action: value as Action })
                  }
                />
                {active.action === "MATCH_CONFIRMATION" ? (
                  <div className="grid gap-3">
                    <p className="text-xs text-muted-foreground">
                      {text.candidateHint}
                    </p>
                    <Input
                      aria-label={text.searchConfirmation}
                      placeholder={text.searchConfirmation}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Choice
                      label={text.confirmationCategory}
                      value={category}
                      options={[
                        { value: "ALL", label: text.allCategories },
                        ...typeOptions,
                      ]}
                      onChange={setCategory}
                    />
                    {active.confirmationId && (
                      <p className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                        {zh ? "已选择：" : "Selected: "}
                        {(confirmations.data ?? []).find(
                          (c) => c.id === active.confirmationId
                        )?.confirmationCode ?? active.confirmationId}
                        <SharedButton
                          variant="quiet"
                          size="icon-sm"
                          type="button"
                          aria-label={
                            zh ? "取消选择函证" : "Clear selected confirmation"
                          }
                          title={
                            zh ? "取消选择函证" : "Clear selected confirmation"
                          }
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded hover:bg-emerald-500/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          onClick={() =>
                            update(active.response.id, { confirmationId: "" })
                          }
                        >
                          <X className="size-3.5" />
                        </SharedButton>
                      </p>
                    )}
                    <div
                      className="grid max-h-72 gap-2 overflow-y-auto"
                      aria-label={text.selectOutgoing}
                    >
                      {candidates.map((c) => (
                        <Button
                          key={c.id}
                          variant={
                            active.confirmationId === c.id
                              ? "secondary"
                              : "outline"
                          }
                          className="h-auto justify-start p-3 text-left whitespace-normal"
                          onClick={() =>
                            update(active.response.id, { confirmationId: c.id })
                          }
                        >
                          <span>
                            {c.displayName || c.counterpartyName}
                            <span className="block text-xs text-muted-foreground">
                              {c.confirmationCode} ·{" "}
                              {text.typeLabels[
                                c.type as keyof typeof text.typeLabels
                              ] ?? c.type}
                            </span>
                          </span>
                        </Button>
                      ))}
                    </div>
                    {confirmations.isLoading ? (
                      <p>{text.saving}</p>
                    ) : confirmations.isError ? (
                      <p role="alert">
                        {zh ? "函证加载失败" : "Could not load confirmations"}
                        <Button
                          variant="link"
                          onClick={() => confirmations.refetch()}
                        >
                          {text.retry}
                        </Button>
                      </p>
                    ) : candidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {text.noCandidates}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Choice
                    label={text.provisionalCategory}
                    value={active.provisionalType}
                    options={typeOptions}
                    onChange={(value) =>
                      update(active.response.id, {
                        provisionalType: value as ConfirmationType,
                      })
                    }
                  />
                )}
              </fieldset>
            )}
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 flex-col gap-4 px-6 py-5 sm:flex-col">
          {notice && <output className="block text-sm">{notice}</output>}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {zh
                ? `共 ${entries.length} 份 · 待设置 ${unfinished.filter((e) => !ready(e)).length} 份 · 已认领 ${entries.length - unfinished.length} 份`
                : `${entries.length} responses · ${unfinished.filter((e) => !ready(e)).length} need details · ${entries.length - unfinished.length} claimed`}
            </p>
            <div className="ml-auto flex gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (!running.current) {
                    onClose();
                  }
                }}
              >
                {unfinished.length
                  ? zh
                    ? "取消"
                    : "Cancel"
                  : zh
                    ? "完成"
                    : "Done"}
              </Button>
              <Button
                disabled={busy || !unfinished.length}
                onClick={() => submit()}
              >
                {busy
                  ? text.saving
                  : entries.some((e) => e.status === "error")
                    ? zh
                      ? "重试未完成"
                      : "Retry unfinished"
                    : copy.batchClaimConfirm}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Choice({
  label,
  value,
  options,
  empty,
  onChange,
  search,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  empty?: string;
  search?: { placeholder: string; emptyMessage: string };
  onChange: (value: string) => void;
}) {
  if (search) {
    const items = [{ value: "", label: empty ?? label }, ...options];
    return (
      <ComboboxField
        label={label}
        value={value}
        options={items}
        placeholder={empty}
        searchLabel={search.placeholder}
        emptyMessage={search.emptyMessage}
        onValueChange={onChange}
      />
    );
  }
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select
        value={value || "__empty"}
        onValueChange={(v) => onChange(v === "__empty" ? "" : (v ?? ""))}
      >
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue>
            {options.find((o) => o.value === value)?.label ?? empty}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          side="bottom"
          sideOffset={4}
          className="border border-border shadow-lg"
        >
          {empty && <SelectItem value="__empty">{empty}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
