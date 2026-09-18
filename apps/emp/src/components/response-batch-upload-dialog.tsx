"use client";

import { Button as SharedButton } from "@project-wing/ui";
import { format } from "date-fns";
import { Check, Eye, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { api } from "@/api/client";

import type { ConfirmationResponseWarehouseCopy } from "./confirmation-response-warehouse";
import { BlobFilePreviewPane } from "./file-preview-pane";
import { ResponseReceivedCalendarField } from "./response-upload-calendar";
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
import { FileInput } from "./ui/file-input";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const ACCEPT =
  ".csv,.doc,.docx,.jpeg,.jpg,.pdf,.png,.ppt,.pptx,.tsv,.xls,.xlsm,.xlsx";
type Metadata = {
  title: string;
  receivedAt: string;
  clientName: string;
  respondingEntity: string;
  courierTrackingNumber: string;
  referenceNumber: string;
  notes: string;
};
type Entry = Metadata & {
  id: string;
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};
type BatchKey =
  | "receivedAt"
  | "clientName"
  | "respondingEntity"
  | "courierTrackingNumber";
const BATCH_KEYS: BatchKey[] = [
  "receivedAt",
  "clientName",
  "respondingEntity",
  "courierTrackingNumber",
];
const ready = (entry: Entry) =>
  Boolean(
    entry.title.trim() &&
    entry.receivedAt &&
    entry.clientName.trim() &&
    entry.respondingEntity.trim()
  );

export function ResponseBatchUploadDialog({
  open,
  onOpenChange,
  projectId,
  copy,
  locale,
  cancelLabel,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  copy: ConfirmationResponseWarehouseCopy;
  locale: string;
  cancelLabel: string;
  onUploaded: () => Promise<void>;
}) {
  const zh = locale.startsWith("zh");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [patch, setPatch] = useState<Partial<Record<BatchKey, string>>>({});
  const [batchEditing, setBatchEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const filledPatch = Object.fromEntries(
    Object.entries(patch)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => [key, value.trim()])
  );
  const running = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const batch = entries.length > 1;
  const active = entries.find((entry) => entry.id === activeId) ?? entries[0];
  const editable = entries.filter((entry) => entry.status !== "success");
  const complete = entries.filter((entry) => entry.status === "success").length;
  const missing = editable.filter((entry) => !ready(entry)).length;
  const labels: Record<keyof Metadata, string> = {
    title: copy.titleLabel,
    receivedAt: copy.receivedAtLabel,
    clientName: copy.clientNameLabel,
    respondingEntity: copy.respondingEntityLabel,
    courierTrackingNumber: copy.courierTrackingNumberLabel,
    referenceNumber: copy.referenceNumberLabel,
    notes: copy.notesLabel,
  };
  const update = (id: string, values: Partial<Entry>) =>
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, ...values } : entry
      )
    );
  const close = () => {
    if (running.current) {
      return;
    }
    onOpenChange(false);
    if (entries.length && complete === entries.length) {
      setEntries([]);
      setSelected(new Set());
      setActiveId("");
      setNotice("");
      setPatch({});
      setBatchEditing(false);
      setPreview(false);
    }
  };
  function addFiles(files: File[]) {
    const accepted: Entry[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (
        !ACCEPT.split(",").includes(extension) ||
        file.size > 50 * 1024 * 1024 ||
        !file.size
      ) {
        rejected.push(file.name);
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        title: file.name.replace(/\.[^.]+$/, ""),
        receivedAt: format(new Date(), "yyyy-MM-dd"),
        clientName: "",
        respondingEntity: "",
        courierTrackingNumber: "",
        referenceNumber: "",
        notes: "",
        status: "pending",
      });
    }
    setEntries((current) => [...current, ...accepted]);
    if (!active) {
      setActiveId(accepted[0]?.id ?? "");
    }
    setNotice(
      rejected.length
        ? `${zh ? "未添加（格式不支持、空文件或超过 50 MB）：" : "Not added (unsupported, empty or over 50 MB): "}${rejected.join("、")}`
        : ""
    );
  }
  async function uploadAll() {
    if (running.current) {
      return;
    }
    const invalid = editable.find((entry) => !ready(entry));
    if (invalid) {
      setActiveId(invalid.id);
      setBatchEditing(false);
      setNotice(
        zh
          ? "请完善标题、收件日期、客户和回函方后再上传。"
          : "Complete title, received date, client and responding entity before uploading."
      );
      return;
    }
    running.current = true;
    setBusy(true);
    setNotice("");
    setBatchEditing(false);
    let failed = 0;
    let succeeded = 0;
    try {
      for (const entry of editable) {
        update(entry.id, { status: "uploading", error: undefined });
        try {
          await api.uploadConfirmationResponseLibraryFile({
            file: entry.file,
            title: entry.title.trim(),
            receivedAt: entry.receivedAt,
            clientName: entry.clientName.trim(),
            respondingEntity: entry.respondingEntity.trim(),
            ...(entry.courierTrackingNumber.trim()
              ? { courierTrackingNumber: entry.courierTrackingNumber.trim() }
              : {}),
            ...(entry.referenceNumber.trim()
              ? { referenceNumber: entry.referenceNumber.trim() }
              : {}),
            ...(entry.notes.trim() ? { notes: entry.notes.trim() } : {}),
            ...(projectId ? { projectId } : {}),
          });
          update(entry.id, { status: "success" });
          succeeded += 1;
          setSelected((current) => {
            const next = new Set(current);
            next.delete(entry.id);
            return next;
          });
        } catch (error) {
          update(entry.id, {
            status: "error",
            error: error instanceof Error ? error.message : copy.uploadError,
          });
          failed += 1;
        }
      }
      setNotice(
        zh
          ? `本次上传成功 ${succeeded} 份${failed ? `，失败 ${failed} 份，可重试` : ""}`
          : `Uploaded ${succeeded}${failed ? `; ${failed} failed. Retry available.` : ""}`
      );
      if (succeeded) {
        try {
          await onUploaded();
        } catch {
          setNotice(
            zh
              ? "文件已上传，请刷新仓库查看。"
              : "Files uploaded. Refresh the warehouse to view them."
          );
        }
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const statusLabel = (entry: Entry) =>
    entry.status === "success"
      ? zh
        ? "已上传"
        : "Uploaded"
      : entry.status === "uploading"
        ? zh
          ? "上传中…"
          : "Uploading…"
        : entry.status === "error"
          ? zh
            ? "上传失败"
            : "Failed"
          : ready(entry)
            ? zh
              ? "已就绪"
              : "Ready"
            : zh
              ? "待完善"
              : "Needs details";
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          close();
        }
      }}
    >
      <DialogContent
        data-upload-mode={batch ? "batch" : "single"}
        className={`flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 ${batch ? "h-[85dvh] max-w-[1200px] sm:max-w-[1200px]" : "max-w-[680px] sm:max-w-[680px]"}`}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {batch
              ? zh
                ? "批量上传回函"
                : "Upload responses"
              : zh
                ? "上传回函"
                : "Upload response"}
          </DialogTitle>
          <DialogDescription>
            {batch
              ? zh
                ? "每个文件作为一份回函。逐份完善信息，或勾选文件批量填写相同信息。单个文件不超过 50 MB。"
                : "Each file is a separate response. Edit individually or select files to fill shared information. Up to 50 MB per file."
              : zh
                ? "选择一份或多份回函文件，单个文件不超过 50 MB。"
                : "Choose one or more response files. Up to 50 MB per file."}
          </DialogDescription>
        </DialogHeader>
        <div
          className={`flex min-h-0 flex-1 flex-col ${batch ? "sm:flex-row" : "overflow-y-auto"}`}
        >
          <aside
            className={`flex shrink-0 flex-col border-b ${batch ? "max-h-48 sm:max-h-none sm:w-80 sm:border-r sm:border-b-0" : "px-2"}`}
          >
            <div className="flex items-center gap-2 border-b p-3">
              {batch && (
                <Checkbox
                  aria-label={
                    zh ? "全选待上传文件" : "Select all pending files"
                  }
                  disabled={busy || !editable.length}
                  checked={Boolean(
                    editable.length &&
                    editable.every((entry) => selected.has(entry.id))
                  )}
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked
                        ? new Set(editable.map((entry) => entry.id))
                        : new Set()
                    )
                  }
                />
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <Plus />
                {entries.length
                  ? zh
                    ? "追加文件"
                    : "Add files"
                  : copy.chooseFile}
              </Button>
              {batch && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || !selected.size}
                  onClick={() => {
                    setBatchEditing(true);
                    setPreview(false);
                  }}
                >
                  {zh ? "批量填写" : "Fill selected"}
                </Button>
              )}
              {!batch && active && active.status !== "success" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setEntries([]);
                    setSelected(new Set());
                    setBatchEditing(false);
                  }}
                >
                  <X />
                  {zh ? "移除文件" : "Remove file"}
                </Button>
              )}
              <FileInput
                ref={inputRef}
                multiple
                accept={ACCEPT}
                onChange={(event) => {
                  addFiles([...(event.target.files ?? [])]);
                  event.target.value = "";
                }}
              />
            </div>
            {batch && (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {!entries.length && (
                  <p className="px-3 py-8 text-sm text-muted-foreground">
                    {zh
                      ? "一次选择多个回函文件开始上传"
                      : "Choose multiple response files to begin"}
                  </p>
                )}
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-2 ${active?.id === entry.id && !batchEditing ? "bg-primary/10" : "hover:bg-muted/50"}`}
                  >
                    <Checkbox
                      aria-label={`${zh ? "选择" : "Select"}: ${entry.file.name}`}
                      disabled={busy || entry.status === "success"}
                      checked={selected.has(entry.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (checked) {
                            next.add(entry.id);
                          } else {
                            next.delete(entry.id);
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
                      className="h-auto min-w-0 flex-1 justify-start py-1 text-left [&>.pw-button-label]:w-full [&>.pw-button-label]:min-w-0"
                      onClick={() => {
                        setActiveId(entry.id);
                        setBatchEditing(false);
                      }}
                      aria-label={`${zh ? "编辑" : "Edit"}: ${entry.file.name}`}
                    >
                      <span className="grid w-full min-w-0 gap-0.5 text-left leading-5">
                        <span className="block truncate text-sm font-medium">
                          {entry.title || entry.file.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {entry.file.name}
                        </span>
                        <span
                          className={`text-xs ${entry.status === "error" ? "text-destructive" : entry.status === "success" ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {statusLabel(entry)}
                        </span>
                      </span>
                    </SharedButton>
                    {entry.status === "success" ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label={`${zh ? "移除" : "Remove"}: ${entry.file.name}`}
                        onClick={() => {
                          setEntries((current) =>
                            current.filter((item) => item.id !== entry.id)
                          );
                          setSelected((current) => {
                            const next = new Set(current);
                            next.delete(entry.id);
                            return next;
                          });
                        }}
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
            {batch && batchEditing ? (
              <div className="grid gap-4">
                <h3 className="font-medium">
                  {zh
                    ? `批量填写 · 已选 ${selected.size} 份`
                    : `Fill ${selected.size} selected files`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {zh
                    ? "填写的字段将覆盖所选回函的信息，留空的字段保持不变。"
                    : "Filled fields replace the selected responses’ information. Blank fields are left unchanged."}
                </p>
                {BATCH_KEYS.map((key) => (
                  <div key={key} className="grid gap-2">
                    <Label htmlFor={`batch-response-${key}`}>
                      {labels[key]}
                    </Label>
                    {key === "receivedAt" ? (
                      <ResponseReceivedCalendarField
                        id={`batch-response-${key}`}
                        ariaLabel={`${zh ? "批量" : "Batch"} ${labels[key]}`}
                        locale={locale}
                        placeholder={copy.receivedAtPlaceholder}
                        todayLabel={copy.today}
                        clearLabel={zh ? "清除" : "Clear"}
                        value={patch.receivedAt ?? ""}
                        onChange={(value) =>
                          setPatch((current) => ({
                            ...current,
                            receivedAt: value,
                          }))
                        }
                      />
                    ) : (
                      <Input
                        id={`batch-response-${key}`}
                        type="text"
                        aria-label={`${zh ? "批量" : "Batch"} ${labels[key]}`}
                        value={patch[key] ?? ""}
                        onChange={(event) =>
                          setPatch((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
                <Button
                  disabled={!selected.size || !Object.keys(filledPatch).length}
                  onClick={() => {
                    setEntries((current) =>
                      current.map((entry) =>
                        selected.has(entry.id) && entry.status !== "success"
                          ? {
                              ...entry,
                              ...filledPatch,
                              status: "pending",
                              error: undefined,
                            }
                          : entry
                      )
                    );
                    setBatchEditing(false);
                    setPatch({});
                    setNotice("");
                  }}
                >
                  {zh ? "应用到所选文件" : "Apply to selected files"}
                </Button>
              </div>
            ) : active ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
                  <h3 className="truncate font-medium">{active.file.name}</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreview((value) => !value)}
                  >
                    <Eye />
                    {preview
                      ? zh
                        ? "收起预览"
                        : "Hide preview"
                      : copy.preview}
                  </Button>
                </div>
                {preview && (
                  <div className="h-80 overflow-hidden rounded-lg border">
                    <BlobFilePreviewPane
                      key={active.id}
                      ariaLabel={`${copy.preview}: ${active.file.name}`}
                      fileName={active.file.name}
                      mimeType={active.file.type}
                      queryKey={["local-response-upload", active.id]}
                      loadFile={() => Promise.resolve(active.file)}
                      copy={{
                        loading: copy.loadingPreview,
                        failedTitle: copy.previewFailedTitle,
                        retry: copy.retryPreview,
                        unsupported: copy.unsupportedPreview,
                      }}
                    />
                  </div>
                )}
                {active.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {active.error}
                  </p>
                )}
                <fieldset
                  disabled={busy || active.status === "success"}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  {(Object.keys(labels) as (keyof Metadata)[]).map((key) => (
                    <div
                      key={key}
                      className={`grid gap-2 ${key === "notes" ? "sm:col-span-2" : ""}`}
                    >
                      <Label htmlFor={`response-upload-${key}`}>
                        {labels[key]}
                        {[
                          "title",
                          "receivedAt",
                          "clientName",
                          "respondingEntity",
                        ].includes(key)
                          ? " *"
                          : ""}
                      </Label>
                      {key === "receivedAt" ? (
                        <ResponseReceivedCalendarField
                          locale={locale}
                          placeholder={copy.receivedAtPlaceholder}
                          todayLabel={copy.today}
                          value={active.receivedAt}
                          onChange={(value) =>
                            update(active.id, {
                              receivedAt: value,
                              status: "pending",
                              error: undefined,
                            })
                          }
                        />
                      ) : key === "notes" ? (
                        <Textarea
                          aria-label={labels[key]}
                          id={`response-upload-${key}`}
                          value={active[key]}
                          onChange={(event) =>
                            update(active.id, {
                              [key]: event.target.value,
                              status: "pending",
                              error: undefined,
                            })
                          }
                        />
                      ) : (
                        <Input
                          aria-label={labels[key]}
                          id={`response-upload-${key}`}
                          value={active[key]}
                          onChange={(event) =>
                            update(active.id, {
                              [key]: event.target.value,
                              status: "pending",
                              error: undefined,
                            })
                          }
                        />
                      )}
                    </div>
                  ))}
                </fieldset>
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 flex-col items-stretch gap-4 border-t px-6 py-5 sm:flex-col">
          {notice && <output className="block text-sm">{notice}</output>}
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {zh
                ? `共 ${entries.length} 份 · 已就绪 ${editable.length - missing} 份 · 待完善 ${missing} 份 · 已上传 ${complete} 份`
                : `${entries.length} files · ${editable.length - missing} ready · ${missing} need details · ${complete} uploaded`}
            </p>
            <div className="ml-auto flex shrink-0 gap-3">
              <Button variant="outline" disabled={busy} onClick={close}>
                {complete === entries.length && entries.length
                  ? zh
                    ? "完成"
                    : "Done"
                  : cancelLabel}
              </Button>
              <Button
                disabled={busy || !editable.length}
                onClick={() => uploadAll()}
              >
                <Upload />
                {busy
                  ? zh
                    ? "正在上传…"
                    : "Uploading…"
                  : entries.some((entry) => entry.status === "error")
                    ? zh
                      ? "重试未完成"
                      : "Retry unfinished"
                    : entries.length === 1
                      ? copy.uploadConfirm
                      : zh
                        ? "上传全部"
                        : "Upload all"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
