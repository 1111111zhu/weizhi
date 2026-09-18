"use client";

import { StatefulMotionButton } from "@project-wing/ui";
import type { MotionButtonState } from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { useDeferredValue, useRef, useState } from "react";
import type { FormEvent } from "react";

import { api } from "../../api/client";
import type {
  ConfirmationInformationLibraryCreateInput,
  ConfirmationInformationLibraryEntry,
  ConfirmationInformationLibraryUpdateInput,
} from "../../api/client";
import { getConfirmationAuxiliaryCopy } from "../../i18n/confirmation-auxiliary";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Textarea } from "../ui/textarea";
import { ConfirmationInformationLibraryGrid } from "./confirmation-information-library-grid";

export type ConfirmationInformationLibraryCopy = {
  title: string;
  description: string;
  add: string;
  moreActions: string;
  actions: string;
  columnMenu: {
    clear: string;
    empty: string;
    filter: string;
    search: string;
  };
  actionError: string;
  rowsPerPage: string;
  rowsPerPageSuffix: string;
  searchPlaceholder: string;
  resultCount: string;
  showInactive: string;
  loading: string;
  loadError: string;
  empty: string;
  noResults: string;
  emptyValue: string;
  code: string;
  sourceLabel: string;
  sourceRow: string;
  bankNameEn: string;
  bankNameZh: string;
  bankType: string;
  effectiveMailingAddress: string;
  businessAddress?: string;
  mailingAddress?: string;
  contactName?: string;
  attention?: string;
  notes?: string;
  background?: string;
  historicalMailingAddress?: string;
  cautions?: string;
  access?: ConfirmationInformationLibraryAccessCopy;
  completeness: string;
  ready: string;
  incomplete: string;
  active: string;
  inactive: string;
  edit: string;
  deactivate: string;
  restore: string;
  form: {
    createTitle: string;
    editTitle: string;
    description: string;
    bankCode: string;
    bankCodePlaceholder: string;
    bankNameEn: string;
    bankNameZh: string;
    bankType: string;
    businessAddress: string;
    mailingAddress: string;
    mailingAddressSameAsBusiness: string;
    contactName: string;
    attention: string;
    notes: string;
    background: string;
    historicalMailingAddress?: string;
    cautions?: string;
    sourceLabel: string;
    sourceRow: string;
    cancel: string;
    save: string;
    saving: string;
    saveError: string;
  };
};

export type ConfirmationInformationLibraryAccessCopy = {
  complete: string;
  readOnlyTitle: string;
  readOnlyDescription: string;
};

type InformationLibraryDraft = {
  requiresBankTemplate: boolean;
  bankCode: string;
  bankNameEn: string;
  bankNameZh: string;
  bankType: string;
  businessAddress: string;
  mailingAddress: string;
  mailingAddressSameAsBusiness: boolean;
  contactName: string;
  attention: string;
  notes: string;
  background: string;
  historicalMailingAddress: string;
  cautions: string;
};

const EMPTY_DRAFT: InformationLibraryDraft = {
  requiresBankTemplate: false,
  bankCode: "",
  bankNameEn: "",
  bankNameZh: "",
  bankType: "",
  businessAddress: "",
  mailingAddress: "",
  mailingAddressSameAsBusiness: false,
  contactName: "",
  attention: "",
  notes: "",
  background: "",
  historicalMailingAddress: "",
  cautions: "",
};

function toDraft(
  entry: ConfirmationInformationLibraryEntry
): InformationLibraryDraft {
  return {
    bankCode: entry.bankCode,
    requiresBankTemplate: entry.requiresBankTemplate ?? false,
    bankNameEn: entry.bankNameEn,
    bankNameZh: entry.bankNameZh,
    bankType: entry.bankType,
    businessAddress: entry.businessAddress,
    mailingAddress: entry.mailingAddress ?? "",
    mailingAddressSameAsBusiness: entry.mailingAddressSameAsBusiness,
    contactName: entry.contactName ?? "",
    attention: entry.attention ?? "",
    notes: entry.notes ?? "",
    background: entry.background ?? "",
    historicalMailingAddress: entry.historicalMailingAddress ?? "",
    cautions: entry.cautions ?? "",
  };
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function toInput(
  draft: InformationLibraryDraft
): ConfirmationInformationLibraryCreateInput {
  return {
    bankCode: draft.bankCode.trim(),
    requiresBankTemplate: draft.requiresBankTemplate,
    bankNameEn: draft.bankNameEn.trim(),
    bankNameZh: draft.bankNameZh.trim(),
    bankType: draft.bankType.trim(),
    businessAddress: draft.businessAddress.trim(),
    mailingAddress: nullableText(draft.mailingAddress),
    mailingAddressSameAsBusiness: draft.mailingAddressSameAsBusiness,
    contactName: nullableText(draft.contactName),
    attention: nullableText(draft.attention),
    notes: nullableText(draft.notes),
    background: nullableText(draft.background),
    historicalMailingAddress: nullableText(draft.historicalMailingAddress),
    cautions: nullableText(draft.cautions),
  };
}

export function ConfirmationInformationLibrary({
  copy,
  canManage,
  accessCopy,
  locale,
}: {
  copy: ConfirmationInformationLibraryCopy;
  canManage: boolean;
  accessCopy: ConfirmationInformationLibraryAccessCopy;
  locale: string;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailEntry, setDetailEntry] =
    useState<ConfirmationInformationLibraryEntry | null>(null);
  const [autoSaveState, setAutoSaveState] =
    useState<MotionButtonState>("success");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveMutationRef = useRef(false);
  const [editingEntry, setEditingEntry] =
    useState<ConfirmationInformationLibraryEntry | null>(null);
  const [draft, setDraft] = useState<InformationLibraryDraft>(EMPTY_DRAFT);
  const [historicalAddressItems, setHistoricalAddressItems] = useState<
    string[]
  >([]);
  const mailingAddressBeforeSameRef = useRef("");
  const deferredQuery = useDeferredValue(query);
  const informationLibrary = useQuery({
    queryKey: [
      "confirmation-information-library",
      deferredQuery.trim(),
      includeInactive,
    ],
    queryFn: () =>
      api.confirmationInformationLibrary({
        query: deferredQuery.trim(),
        includeInactive,
      }),
  });
  const invalidateLibrary = () =>
    queryClient.invalidateQueries({
      queryKey: ["confirmation-information-library"],
    });
  const save = useMutation({
    mutationFn: ({
      entryId,
      input,
    }: {
      entryId: string | null;
      input:
        | ConfirmationInformationLibraryCreateInput
        | ConfirmationInformationLibraryUpdateInput;
    }) =>
      entryId
        ? api.updateConfirmationInformationLibrary(entryId, input)
        : api.createConfirmationInformationLibrary(
            input as ConfirmationInformationLibraryCreateInput
          ),
    onSuccess: () => {
      if (autoSaveMutationRef.current) {
        autoSaveMutationRef.current = false;
        setAutoSaveState("success");
        void invalidateLibrary();
        return;
      }
      setSheetOpen(false);
      setEditingEntry(null);
      void invalidateLibrary();
    },
    onError: () => {
      if (autoSaveMutationRef.current) {
        autoSaveMutationRef.current = false;
        setAutoSaveState("error");
      }
    },
  });
  const deactivate = useMutation({
    mutationFn: (entryId: string) =>
      api.deleteConfirmationInformationLibrary(entryId),
    onSuccess: () => {
      setSheetOpen(false);
      setEditingEntry(null);
      void invalidateLibrary();
    },
  });
  const restore = useMutation({
    mutationFn: (entryId: string) =>
      api.restoreConfirmationInformationLibrary(entryId),
    onSuccess: () => {
      setSheetOpen(false);
      setEditingEntry(null);
      void invalidateLibrary();
    },
  });
  const rows = informationLibrary.data ?? [];
  const mutationError =
    !editingEntry && save.isError
      ? copy.form.saveError
      : deactivate.isError || restore.isError
        ? copy.actionError
        : null;
  const canSave = Boolean(
    draft.bankCode.trim() &&
    draft.bankNameEn.trim() &&
    draft.bankNameZh.trim() &&
    draft.bankType.trim() &&
    draft.businessAddress.trim()
  );

  function openCreate() {
    if (!canManage) {
      return;
    }
    save.reset();
    setEditingEntry(null);
    setDraft(EMPTY_DRAFT);
    setHistoricalAddressItems([]);
    mailingAddressBeforeSameRef.current = "";
    setSheetOpen(true);
  }

  function openEdit(entry: ConfirmationInformationLibraryEntry) {
    if (!canManage) {
      return;
    }
    save.reset();
    setEditingEntry(entry);
    setDraft(toDraft(entry));
    setHistoricalAddressItems(
      entry.historicalMailingAddress?.split("\n").filter(Boolean) ?? []
    );
    mailingAddressBeforeSameRef.current = entry.mailingAddress ?? "";
    setSheetOpen(true);
  }

  function closeSheet(open: boolean) {
    setSheetOpen(open);
    if (!open) {
      setEditingEntry(null);
      save.reset();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || save.isPending) {
      return;
    }
    save.mutate({
      entryId: editingEntry?.id ?? null,
      input: toInput(draft),
    });
  }

  function updateDraft<Key extends keyof InformationLibraryDraft>(
    key: Key,
    value: InformationLibraryDraft[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (editingEntry) {
      save.reset();
      setAutoSaveState("loading");
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
      autoSaveTimer.current = setTimeout(() => {
        const requiredFields = [
          "bankCode",
          "bankNameEn",
          "bankNameZh",
          "bankType",
          "businessAddress",
        ];
        if (
          typeof value === "string" &&
          requiredFields.includes(key) &&
          !value.trim()
        ) {
          setAutoSaveState("error");
          return;
        }
        autoSaveMutationRef.current = true;
        save.mutate({
          entryId: editingEntry.id,
          input: {
            [key]:
              typeof value === "string" && !requiredFields.includes(key)
                ? nullableText(value)
                : value,
          } as ConfirmationInformationLibraryUpdateInput,
        });
      }, 600);
    }
  }

  function updateMailingAddressSameAsBusiness(value: boolean) {
    setDraft((current) => {
      if (value && !current.mailingAddressSameAsBusiness) {
        mailingAddressBeforeSameRef.current = current.mailingAddress;
      }
      return {
        ...current,
        mailingAddressSameAsBusiness: value,
        mailingAddress: value ? "" : mailingAddressBeforeSameRef.current,
      };
    });
    if (editingEntry) {
      save.reset();
      setAutoSaveState("loading");
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
      autoSaveTimer.current = setTimeout(() => {
        autoSaveMutationRef.current = true;
        save.mutate({
          entryId: editingEntry.id,
          input: {
            mailingAddressSameAsBusiness: value,
            mailingAddress: value
              ? null
              : nullableText(mailingAddressBeforeSameRef.current),
          },
        });
      }, 600);
    }
  }

  function updateHistoricalAddress(index: number, value: string) {
    setHistoricalAddressItems((current) => {
      const next = [...current];
      next[index] = value;
      updateDraft("historicalMailingAddress", next.filter(Boolean).join("\n"));
      return next;
    });
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card">
      <div className="min-h-0 flex-1">
        <ConfirmationInformationLibraryGrid
          accessCopy={accessCopy}
          canManage={canManage}
          copy={copy}
          locale={locale}
          deactivatePending={deactivate.isPending}
          includeInactive={includeInactive}
          isError={informationLibrary.isError}
          isLoading={informationLibrary.isLoading}
          onRetry={() => {
            void informationLibrary.refetch();
          }}
          onCreate={openCreate}
          onDeactivate={(entry) => deactivate.mutate(entry.id)}
          onEdit={openEdit}
          onIncludeInactiveChange={setIncludeInactive}
          onQueryChange={setQuery}
          onRestore={(entry) => restore.mutate(entry.id)}
          query={query}
          restorePending={restore.isPending}
          rows={rows}
          onRowClick={(entry) => {
            if (canManage) {
              openEdit(entry);
            } else {
              setDetailEntry(entry);
            }
          }}
        />
      </div>

      {mutationError ? (
        <p role="alert" className="border-t px-4 py-3 text-sm text-destructive">
          {mutationError}
        </p>
      ) : null}

      {canManage ? (
        <Sheet open={sheetOpen} onOpenChange={closeSheet}>
          <SheetContent
            className="w-full overflow-y-auto sm:max-w-xl"
            showCloseButton={false}
          >
            <SheetHeader className="border-b pr-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle>
                    {editingEntry ? copy.form.editTitle : copy.form.createTitle}
                  </SheetTitle>
                  <SheetDescription>{copy.form.description}</SheetDescription>
                </div>
                <div className="flex items-center gap-1">
                  {editingEntry ? (
                    <StatefulMotionButton
                      aria-label={copy.form.saving}
                      aria-disabled="true"
                      className="pointer-events-none h-8 px-2 text-xs"
                      data-testid="confirmation-information-library-auto-save"
                      state={autoSaveState}
                      tabIndex={-1}
                      variant="ghost"
                      loadingText={copy.form.saving}
                      successText={copy.form.save}
                      errorText={copy.form.saveError}
                    >
                      {copy.form.save}
                    </StatefulMotionButton>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={copy.form.cancel}
                    onClick={() => closeSheet(false)}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            </SheetHeader>
            {mutationError ? (
              <p role="alert" className="px-4 py-3 text-sm text-destructive">
                {mutationError}
              </p>
            ) : null}
            <form
              className="min-h-0 flex-1 overflow-y-auto px-4"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-4 pb-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="information-library-bank-code">
                      {copy.form.bankCode}
                    </Label>
                    <Input
                      id="information-library-bank-code"
                      value={draft.bankCode}
                      placeholder={copy.form.bankCodePlaceholder}
                      onChange={(event) =>
                        updateDraft("bankCode", event.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="information-library-bank-type">
                      {copy.form.bankType}
                    </Label>
                    <Input
                      id="information-library-bank-type"
                      value={draft.bankType}
                      onChange={(event) =>
                        updateDraft("bankType", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="information-library-bank-name-zh">
                    {copy.form.bankNameZh}
                  </Label>
                  <Input
                    id="information-library-bank-name-zh"
                    value={draft.bankNameZh}
                    onChange={(event) =>
                      updateDraft("bankNameZh", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="information-library-bank-name-en">
                    {copy.form.bankNameEn}
                  </Label>
                  <Input
                    id="information-library-bank-name-en"
                    value={draft.bankNameEn}
                    onChange={(event) =>
                      updateDraft("bankNameEn", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="information-library-contact-name">
                    {copy.form.contactName}
                  </Label>
                  <Input
                    id="information-library-contact-name"
                    value={draft.contactName}
                    onChange={(event) =>
                      updateDraft("contactName", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="information-library-attention">
                    {copy.form.attention}
                  </Label>
                  <Input
                    id="information-library-attention"
                    value={draft.attention}
                    onChange={(event) =>
                      updateDraft("attention", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="information-library-background">
                    {copy.form.background}
                  </Label>
                  <Textarea
                    id="information-library-background"
                    rows={3}
                    label={copy.form.background}
                    value={draft.background}
                    onChange={(event) =>
                      updateDraft("background", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="information-library-notes">
                    {copy.form.notes}
                  </Label>
                  <Textarea
                    id="information-library-notes"
                    rows={3}
                    label={copy.form.notes}
                    value={draft.notes}
                    onChange={(event) =>
                      updateDraft("notes", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="information-library-business-address">
                    {copy.form.businessAddress}
                  </Label>
                  <Textarea
                    id="information-library-business-address"
                    rows={3}
                    label={copy.form.businessAddress}
                    value={draft.businessAddress}
                    onChange={(event) =>
                      updateDraft("businessAddress", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      {copy.form.historicalMailingAddress ??
                        "Historical mailing address"}
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setHistoricalAddressItems((current) => [...current, ""])
                      }
                    >
                      <Plus />{" "}
                      {
                        getConfirmationAuxiliaryCopy(locale)
                          .addHistoricalAddress
                      }
                    </Button>
                  </div>
                  {historicalAddressItems.length ? (
                    historicalAddressItems.map((address, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Textarea
                          rows={2}
                          value={address}
                          onChange={(event) =>
                            updateHistoricalAddress(index, event.target.value)
                          }
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={
                            getConfirmationAuxiliaryCopy(locale)
                              .removeHistoricalAddress
                          }
                          onClick={() =>
                            setHistoricalAddressItems((current) => {
                              const next = current.filter(
                                (_, itemIndex) => itemIndex !== index
                              );
                              updateDraft(
                                "historicalMailingAddress",
                                next.filter(Boolean).join("\n")
                              );
                              return next;
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="information-library-cautions">
                    {copy.form.cautions ?? "Cautions"}
                  </Label>
                  <Textarea
                    id="information-library-cautions"
                    rows={3}
                    label={copy.form.cautions ?? "Cautions"}
                    value={draft.cautions}
                    onChange={(event) =>
                      updateDraft("cautions", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="information-library-mailing-address">
                    {copy.form.mailingAddress}
                  </Label>
                  <Textarea
                    id="information-library-mailing-address"
                    rows={3}
                    label={copy.form.mailingAddress}
                    value={draft.mailingAddress}
                    disabled={draft.mailingAddressSameAsBusiness}
                    onChange={(event) =>
                      updateDraft("mailingAddress", event.target.value)
                    }
                  />
                </div>
                <label className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm">
                  <Checkbox
                    id="information-library-same-address"
                    checked={draft.mailingAddressSameAsBusiness}
                    label={copy.form.mailingAddressSameAsBusiness}
                    onCheckedChange={(checked) =>
                      updateMailingAddressSameAsBusiness(checked === true)
                    }
                  />
                  <span>{copy.form.mailingAddressSameAsBusiness}</span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm">
                  <Checkbox
                    id="information-library-bank-format"
                    checked={draft.requiresBankTemplate}
                    label={
                      locale.startsWith("zh")
                        ? "要求银行自有格式"
                        : "Requires bank-provided format"
                    }
                    onCheckedChange={(checked) =>
                      updateDraft("requiresBankTemplate", checked === true)
                    }
                  />
                  <span>
                    {locale.startsWith("zh")
                      ? "要求银行自有格式"
                      : "Requires bank-provided format"}
                  </span>
                </label>
              </div>
              {editingEntry ? (
                <div className="border-t px-4 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deactivate.isPending || restore.isPending}
                    onClick={() =>
                      editingEntry.isActive
                        ? deactivate.mutate(editingEntry.id)
                        : restore.mutate(editingEntry.id)
                    }
                  >
                    {editingEntry.isActive ? copy.deactivate : copy.restore}
                  </Button>
                </div>
              ) : (
                <div className="border-t px-4 py-3">
                  <Button type="submit" disabled={!canSave || save.isPending}>
                    {save.isPending ? copy.form.saving : copy.form.save}
                  </Button>
                </div>
              )}
            </form>
          </SheetContent>
        </Sheet>
      ) : null}

      <Sheet
        open={Boolean(detailEntry)}
        onOpenChange={(open) => !open && setDetailEntry(null)}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader className="border-b">
            <SheetTitle>{detailEntry?.bankNameZh ?? copy.title}</SheetTitle>
            <SheetDescription>
              {detailEntry
                ? `${detailEntry.bankNameEn} · ${detailEntry.bankCode}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          {detailEntry ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <dl className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4 text-sm">
                {detailEntry.notes?.trim() ? (
                  <div className="grid gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
                    <dt className="font-semibold text-destructive">
                      {copy.cautions}
                    </dt>
                    <dd className="font-medium break-words whitespace-pre-wrap text-destructive">
                      {detailEntry.notes}
                    </dd>
                  </div>
                ) : null}
                {[
                  [
                    copy.contactName,
                    detailEntry.contactName ?? detailEntry.bankNameZh,
                  ],
                  [copy.attention, detailEntry.attention],
                  [copy.code, detailEntry.bankCode],
                  [copy.bankNameZh, detailEntry.bankNameZh],
                  [copy.bankNameEn, detailEntry.bankNameEn],
                  [copy.bankType, detailEntry.bankType],
                  [copy.background, detailEntry.background],
                  [copy.businessAddress, detailEntry.businessAddress],
                  [copy.mailingAddress, detailEntry.mailingAddress],
                  [
                    copy.effectiveMailingAddress,
                    detailEntry.effectiveMailingAddress,
                  ],
                  [
                    copy.historicalMailingAddress,
                    detailEntry.historicalMailingAddress,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid gap-1 border-b border-border/60 pb-3"
                  >
                    <dt className="font-medium text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="break-words whitespace-pre-wrap">
                      {value || copy.emptyValue}
                    </dd>
                  </div>
                ))}
              </dl>
              {canManage ? (
                <div className="border-t px-4 py-3">
                  <StatefulMotionButton
                    aria-label={copy.form.saving}
                    aria-disabled="true"
                    className="pointer-events-none"
                    data-testid="confirmation-information-library-auto-save"
                    state={autoSaveState}
                    tabIndex={-1}
                    variant="ghost"
                    loadingText={copy.form.saving}
                    successText={copy.form.save}
                    errorText={copy.form.saveError}
                  >
                    {copy.form.save}
                  </StatefulMotionButton>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
