"use client";

import type {
  CmpEngagementFeeNote,
  CmpFeeNoteLocale,
} from "@project-wing/shared";
import { Button, ButtonGroup, Checkbox, Input } from "@project-wing/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/api/client";
import { useCmpToast } from "@/components/cmp-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getBillingScheduleCopy } from "@/i18n/billing-schedule";
import { getCmpDictionary, useCmpI18n } from "@/i18n/client";

export type FeeNoteField = Exclude<
  keyof CmpEngagementFeeNote,
  "id" | "engagementId" | "createdAt" | "updatedAt"
>;

const LOCALIZED_FIELDS = new Set<FeeNoteField>([
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

const FeeNoteCopyContext = createContext<{ autofillHint: string } | null>(null);

export function CmpEngagementFeeNotePage({
  engagementId,
}: {
  engagementId: string;
}) {
  const router = useRouter();
  const { dictionary, locale: systemLocale, localizedPath } = useCmpI18n();
  const { toast } = useCmpToast();
  const copy = dictionary.workspace;
  const scheduleCopy = getBillingScheduleCopy(systemLocale);
  const [note, setNote] = useState<CmpEngagementFeeNote | null>(null);
  const [selectedFeeNoteId, setSelectedFeeNoteId] = useState<string | null>(
    null
  );
  const [newPeriodDate, setNewPeriodDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newPeriodAmount, setNewPeriodAmount] = useState("");
  const [documentLocale, setDocumentLocale] =
    useState<CmpFeeNoteLocale>(systemLocale);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const feeNote = useQuery({
    queryKey: ["cmp-engagement-fee-note", engagementId, selectedFeeNoteId],
    queryFn: () =>
      selectedFeeNoteId
        ? api.cmpEngagementFeeNoteById(engagementId, selectedFeeNoteId)
        : api.cmpEngagementFeeNote(engagementId),
    enabled: Boolean(me.data),
    retry: false,
  });
  const feeNotes = useQuery({
    queryKey: ["cmp-engagement-fee-notes", engagementId],
    queryFn: () => api.cmpEngagementFeeNotes(engagementId),
    enabled: Boolean(me.data),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (value: CmpEngagementFeeNote) =>
      value.id
        ? api.updateCmpEngagementFeeNoteById(
            engagementId,
            value.id,
            feeNoteInput(value)
          )
        : api.updateCmpEngagementFeeNote(engagementId, feeNoteInput(value)),
    onSuccess: (result) => {
      setNote(result.note);
      setSelectedFeeNoteId(result.note.id);
      void feeNotes.refetch();
      toast({ title: copy.feeNoteSaved, variant: "success" });
    },
    onError: () =>
      toast({ title: copy.feeNoteLoadFailed, variant: "destructive" }),
  });
  const createPeriod = useMutation({
    mutationFn: () =>
      api.createCmpEngagementFeeNote(engagementId, {
        periodNumber:
          Math.max(
            0,
            ...(feeNotes.data?.notes.map((item) => item.periodNumber) ?? [])
          ) + 1,
        plannedIssueDate: newPeriodDate,
        plannedAmount: newPeriodAmount,
      }),
    onSuccess: (result) => {
      setNote(result.note);
      setSelectedFeeNoteId(result.note.id);
      setNewPeriodAmount("");
      void feeNotes.refetch();
    },
  });

  useEffect(() => {
    if (feeNote.data) {
      setNote(feeNote.data.note);
    }
  }, [feeNote.data]);
  useEffect(() => {
    if (!selectedFeeNoteId && feeNotes.data?.notes[0]?.id) {
      setSelectedFeeNoteId(feeNotes.data.notes[0].id);
    }
  }, [feeNotes.data, selectedFeeNoteId]);

  const [previousSystemLocale, setPreviousSystemLocale] =
    useState(systemLocale);
  if (previousSystemLocale !== systemLocale) {
    setPreviousSystemLocale(systemLocale);
    setDocumentLocale(systemLocale);
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

  const updateDocument = <K extends FeeNoteField>(
    field: K,
    value: CmpEngagementFeeNote[K]
  ) => {
    setNote((current) => {
      if (!current) {
        return current;
      }
      if (field === "lineItems") {
        const visibleItems = Array.isArray(value) ? value : [];
        const otherLocale: CmpFeeNoteLocale =
          documentLocale === "zh-CN" ? "en-US" : "zh-CN";
        const visibleIds = new Set(visibleItems.map((item) => item.id));
        const activeDescriptions = Object.fromEntries(
          visibleItems.map((item) => [item.id, item.description])
        );
        const chineseDescriptions =
          current.localizedContent["zh-CN"].lineItemDescriptions;
        return {
          ...current,
          lineItems: visibleItems.map((item) => ({
            id: item.id,
            amount: item.amount,
            description:
              documentLocale === "zh-CN"
                ? item.description
                : (chineseDescriptions[item.id] ?? item.description),
          })),
          localizedContent: {
            ...current.localizedContent,
            [documentLocale]: {
              ...current.localizedContent[documentLocale],
              lineItemDescriptions: activeDescriptions,
            },
            [otherLocale]: {
              ...current.localizedContent[otherLocale],
              lineItemDescriptions: Object.fromEntries(
                Object.entries(
                  current.localizedContent[otherLocale].lineItemDescriptions
                ).filter(([id]) => visibleIds.has(id))
              ),
            },
          },
        };
      }
      if (!LOCALIZED_FIELDS.has(field)) {
        return { ...current, [field]: value };
      }
      const contentField =
        field as keyof CmpEngagementFeeNote["localizedContent"][CmpFeeNoteLocale];
      return {
        ...current,
        [field]: documentLocale === "zh-CN" ? value : current[field],
        localizedContent: {
          ...current.localizedContent,
          [documentLocale]: {
            ...current.localizedContent[documentLocale],
            [contentField]: value,
          },
        },
      } as CmpEngagementFeeNote;
    });
  };

  if (me.isLoading || (me.data && feeNote.isLoading)) {
    return <FeeNoteLoading />;
  }
  if (me.isError || !me.data) {
    return null;
  }
  if (!note) {
    return (
      <main className="min-h-screen bg-muted/25 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-lg font-semibold">{copy.feeNoteLoadFailed}</h1>
          <Button
            className="mt-5"
            onClick={() => {
              feeNote.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {copy.feeNoteRetry}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/25 py-5 sm:py-8 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 print:max-w-none print:px-0">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button
            type="button"
            variant="quiet"
            onClick={() => router.push(localizedPath("/engagements"))}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {copy.feeNoteBack}
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ButtonGroup aria-label={copy.feeNoteDocumentTitle}>
              <Button
                aria-pressed={documentLocale === "zh-CN"}
                onClick={() => setDocumentLocale("zh-CN")}
                type="button"
                variant={documentLocale === "zh-CN" ? "default" : "outline"}
              >
                {copy.feeNoteLanguageChinese}
              </Button>
              <Button
                aria-pressed={documentLocale === "en-US"}
                onClick={() => setDocumentLocale("en-US")}
                type="button"
                variant={documentLocale === "en-US" ? "default" : "outline"}
              >
                {copy.feeNoteLanguageEnglish}
              </Button>
            </ButtonGroup>
            <Button
              onClick={() => window.print()}
              type="button"
              variant="outline"
            >
              <Printer aria-hidden="true" className="size-4" />
              {copy.feeNotePrint}
            </Button>
            <ButtonGroup>
              <Button
                type="button"
                disabled={save.isPending}
                variant="outline"
                onClick={() => setNote(feeNote.data?.defaults ?? note)}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                {copy.feeNoteUseCurrent}
              </Button>
              <Button
                type="button"
                disabled={save.isPending}
                onClick={() => {
                  save.mutateAsync(note);
                }}
              >
                <Save aria-hidden="true" className="size-4" />
                {save.isPending ? copy.feeNoteSaving : copy.feeNoteSave}
              </Button>
            </ButtonGroup>
          </div>
        </header>

        <section className="mb-5 rounded-xl border border-border bg-card p-4 print:hidden">
          <div className="flex flex-wrap items-end gap-2">
            <strong>{scheduleCopy.title}</strong>
            <Input
              type="date"
              aria-label={scheduleCopy.plannedDate}
              value={newPeriodDate}
              onChange={(event) => setNewPeriodDate(event.target.value)}
            />
            <Input
              inputMode="decimal"
              aria-label={scheduleCopy.plannedAmount}
              placeholder={scheduleCopy.plannedAmount}
              value={newPeriodAmount}
              onChange={(event) => setNewPeriodAmount(event.target.value)}
            />
            <Button
              type="button"
              disabled={
                !newPeriodDate || !newPeriodAmount || createPeriod.isPending
              }
              onClick={() => {
                createPeriod.mutate();
              }}
            >
              <Plus className="size-4" />
              {scheduleCopy.addPeriod}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {feeNotes.data?.notes.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={item.id === selectedFeeNoteId ? "default" : "outline"}
                onClick={() => setSelectedFeeNoteId(item.id)}
              >{`${scheduleCopy.periodLabel(item.periodNumber)} · ${item.plannedIssueDate || scheduleCopy.unscheduled} · ${item.plannedAmount || "—"}`}</Button>
            ))}
          </div>
        </section>
        <section className="mb-5 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4 print:hidden">
          <Input
            type="number"
            min={1}
            value={String(note.periodNumber)}
            onChange={(event) =>
              updateDocument("periodNumber", Number(event.target.value))
            }
          />
          <Input
            type="date"
            value={note.plannedIssueDate}
            onChange={(event) =>
              updateDocument("plannedIssueDate", event.target.value)
            }
          />
          <Input
            inputMode="decimal"
            value={note.plannedAmount}
            onChange={(event) =>
              updateDocument("plannedAmount", event.target.value)
            }
          />
          <Input
            inputMode="decimal"
            value={note.receivedAmount}
            onChange={(event) =>
              updateDocument("receivedAmount", event.target.value)
            }
          />
          <Input
            type="date"
            value={note.receivedDate}
            onChange={(event) =>
              updateDocument("receivedDate", event.target.value)
            }
          />
          <span>
            {note.collectionStatus} · {scheduleCopy.outstanding}{" "}
            {note.outstandingAmount}
          </span>
        </section>

        <FeeNoteDocument
          locale={documentLocale}
          note={note}
          update={updateDocument}
        />
      </div>
    </main>
  );
}

const EMPTY_LOCKED_FIELDS: FeeNoteField[] = [];

export function FeeNoteDocument({
  note: rawNote,
  update,
  locale,
  readOnly = false,
  lockedFields = EMPTY_LOCKED_FIELDS,
}: {
  note: CmpEngagementFeeNote;
  update: <K extends FeeNoteField>(
    field: K,
    value: CmpEngagementFeeNote[K]
  ) => void;
  locale?: CmpFeeNoteLocale;
  readOnly?: boolean;
  lockedFields?: FeeNoteField[];
}) {
  const { locale: systemLocale } = useCmpI18n();
  const documentLocale = locale ?? systemLocale;
  const note = noteForLocale(rawNote, documentLocale);
  const copy = getCmpDictionary(documentLocale).workspace;
  const source = {
    engagement: copy.feeNoteEngagementSource,
    firm: copy.feeNoteFirmSource,
  };
  const copyContextValue = useMemo(
    () => ({ autofillHint: copy.feeNoteAutofillHint }),
    [copy.feeNoteAutofillHint]
  );

  return (
    <FeeNoteCopyContext.Provider value={copyContextValue}>
      <article
        data-testid="cmp-fee-note-document"
        className="cmp-fee-note-document mx-auto flex min-h-[48rem] max-w-3xl flex-col overflow-hidden border border-border bg-white px-6 py-7 font-sans text-sm leading-normal text-foreground shadow-sm sm:px-10 sm:py-8 print:min-h-0 print:max-w-none print:border-0 print:px-[7mm] print:py-0 print:shadow-none"
      >
        <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
          <header>
            <div
              aria-label={copy.feeNoteBrandMark}
              className="flex h-14 items-center text-4xl font-black tracking-normal italic print:h-10 print:text-3xl"
            >
              {copy.feeNoteBrandMark}
            </div>
            <div className="cmp-fee-note-meta mt-6 grid grid-cols-3 items-start gap-3 print:mt-4 print:gap-2">
              <FeeNoteInlineField
                field="feeNoteNumber"
                label={copy.feeNoteNumber}
                source={source.firm}
                value={note.feeNoteNumber}
                onChange={update}
                disabled={lockedFields.includes("feeNoteNumber")}
              />
              <FeeNoteInlineField
                field="engagementReference"
                label={copy.feeNoteReference}
                source={source.engagement}
                value={note.engagementReference}
                onChange={update}
                disabled={lockedFields.includes("engagementReference")}
              />
              <FeeNoteInlineField
                field="issueDate"
                label={copy.feeNoteIssueDate}
                source={source.firm}
                value={note.issueDate}
                onChange={update}
              />
            </div>
          </header>

          <section className="mt-5 max-w-[30rem] space-y-1.5 print:mt-3 print:max-w-[27rem]">
            <FeeNoteInlineField
              field="recipientName"
              label={copy.feeNoteRecipient}
              source={source.engagement}
              value={note.recipientName}
              onChange={update}
            />
            <FeeNoteTextAreaCompact
              field="recipientAddress"
              label={copy.feeNoteRecipientAddress}
              source={source.engagement}
              value={note.recipientAddress}
              onChange={update}
              rows={2}
            />
            <FeeNoteInlineField
              field="recipientAttention"
              label={copy.feeNoteRecipientAttention}
              source={source.engagement}
              value={note.recipientAttention}
              onChange={update}
            />
          </section>

          <section className="mt-6 w-full print:mt-4">
            <div className="space-y-3 print:space-y-2">
              <div className="cmp-fee-note-currency grid grid-cols-[minmax(0,1fr)_7.5rem]">
                <span aria-hidden="true" />
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">
                    {copy.currency}
                  </span>
                  <Select
                    value={note.currency}
                    onValueChange={(currency) =>
                      update(
                        "currency",
                        currency as CmpEngagementFeeNote["currency"]
                      )
                    }
                  >
                    <SelectTrigger
                      aria-label={copy.currency}
                      className="h-7 rounded-none border-x-0 border-t-0 px-0 text-right shadow-none focus:ring-0 print:h-5 print:border-0 print:bg-transparent print:px-0 print:shadow-none print:disabled:bg-transparent print:disabled:opacity-100 print:[&_svg]:hidden"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HKD">
                        {copy.feeNoteCurrencyHkd}
                      </SelectItem>
                      <SelectItem value="CNY">
                        {copy.feeNoteCurrencyCny}
                      </SelectItem>
                      <SelectItem value="USD">
                        {copy.feeNoteCurrencyUsd}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <AutofillHint source={source.engagement} compact />
                </label>
              </div>
              <FeeNoteLineItems
                items={note.lineItems}
                currency={note.currency}
                locale={documentLocale}
                labels={{
                  item: copy.feeNoteLineItem,
                  amount: copy.feeNoteLineAmount,
                  add: copy.feeNoteAddLineItem,
                  remove: copy.feeNoteRemoveLineItem,
                  total: copy.feeNoteTotal,
                }}
                onChange={(lineItems) => update("lineItems", lineItems)}
              />
              <FeeNoteInlineField
                field="signatoryName"
                label={copy.feeNoteSignatory}
                source={source.engagement}
                value={note.signatoryName}
                onChange={update}
                rightAligned
              />
            </div>
          </section>

          <div
            className="mt-10 pt-8 print:mt-5 print:pt-0"
            data-testid="cmp-fee-note-remittance"
          >
            <div
              className="flex items-end justify-between border-t border-dashed border-foreground pt-2 print:pt-1"
              data-testid="cmp-fee-note-remittance-divider"
            >
              <FeeNoteInlineField
                field="issuerReference"
                label={copy.feeNoteIssuerReference}
                source={source.firm}
                value={note.issuerReference}
                onChange={update}
              />
              <div className="w-48">
                <FeeNoteInlineField
                  field="feeNoteNumber"
                  label={copy.feeNoteNumber}
                  source={source.firm}
                  value={note.feeNoteNumber}
                  onChange={update}
                  disabled={lockedFields.includes("feeNoteNumber")}
                />
              </div>
            </div>

            <section className="mt-3 border-b border-foreground pb-3 text-xs leading-4 print:border-0 print:pb-0 print:text-[10px]">
              <p className="mb-1.5 font-semibold">{copy.feeNoteRemittance}</p>
              <p>{copy.feeNotePaymentNotice}</p>
              <p className="mt-1">{copy.feeNotePaymentInstructions}</p>
              <div className="cmp-fee-note-bank-grid mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <FeeNoteInlineField
                  field="bankPayeeName"
                  label={copy.feeNotePayeeName}
                  source={source.firm}
                  value={note.bankPayeeName}
                  onChange={update}
                />
                <FeeNoteInlineField
                  field="bankName"
                  label={copy.feeNoteBankName}
                  source={source.firm}
                  value={note.bankName}
                  onChange={update}
                />
                <div className="col-span-2 space-y-1 pt-0.5">
                  <FeeNoteAccountLine
                    accountField="cnyAccountNumber"
                    accountLabel={copy.feeNoteCnyAccount}
                    swiftField="cnySwiftCode"
                    note={note}
                    onChange={update}
                    source={source.firm}
                    swiftLabel={copy.feeNoteSwift}
                  />
                  <FeeNoteAccountLine
                    accountField="hkdAccountNumber"
                    accountLabel={copy.feeNoteHkdAccount}
                    swiftField="hkdSwiftCode"
                    note={note}
                    onChange={update}
                    source={source.firm}
                    swiftLabel={copy.feeNoteSwift}
                  />
                  <FeeNoteAccountLine
                    accountField="usdAccountNumber"
                    accountLabel={copy.feeNoteUsdAccount}
                    swiftField="usdSwiftCode"
                    note={note}
                    onChange={update}
                    source={source.firm}
                    swiftLabel={copy.feeNoteSwift}
                  />
                </div>
              </div>
            </section>

            <footer className="cmp-fee-note-footer grid grid-cols-3 gap-3 pt-3 text-xs leading-4 print:divide-x print:divide-foreground print:pt-2 print:text-[10px]">
              <div className="min-w-0 print:pr-2">
                <FeeNoteInlineField
                  field="firmLegalName"
                  label={copy.feeNoteFirmName}
                  source={source.firm}
                  value={note.firmLegalName}
                  onChange={update}
                  multiline
                />
              </div>
              <div className="min-w-0 print:px-2">
                <FeeNoteTextAreaCompact
                  field="firmAddress"
                  label={copy.feeNoteFirmAddress}
                  source={source.firm}
                  value={note.firmAddress}
                  onChange={update}
                  rows={2}
                />
              </div>
              <div className="min-w-0 space-y-1 print:pl-2">
                <FeeNoteInlineField
                  field="firmPhone"
                  label={copy.feeNoteFirmPhone}
                  source={source.firm}
                  value={note.firmPhone}
                  onChange={update}
                />
                <FeeNoteInlineField
                  field="firmEmail"
                  label={copy.feeNoteFirmEmail}
                  source={source.firm}
                  value={note.firmEmail}
                  onChange={update}
                />
                <FeeNoteInlineField
                  field="firmWebsite"
                  label={copy.feeNoteFirmWebsite}
                  source={source.firm}
                  value={note.firmWebsite}
                  onChange={update}
                />
              </div>
            </footer>
          </div>
        </fieldset>
      </article>
    </FeeNoteCopyContext.Provider>
  );
}

function FeeNoteLineItems({
  items,
  currency,
  locale,
  labels,
  onChange,
}: {
  items: CmpEngagementFeeNote["lineItems"];
  currency: CmpEngagementFeeNote["currency"];
  locale: CmpFeeNoteLocale;
  labels: {
    item: string;
    amount: string;
    add: string;
    remove: string;
    total: string;
  };
  onChange: (items: CmpEngagementFeeNote["lineItems"]) => void;
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.reduce((sum, item) => {
    const amount = Number(item.amount || "0");
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const updateItem = (
    id: string,
    field: "description" | "amount",
    value: string
  ) =>
    onChange(
      safeItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );

  return (
    <section aria-label={labels.item} className="space-y-1.5 print:space-y-1">
      <div className="cmp-fee-note-line-header grid grid-cols-[minmax(0,1fr)_7.5rem_1.75rem] gap-x-2 text-xs text-muted-foreground print:grid-cols-[minmax(0,1fr)_7.5rem] print:text-[10px]">
        <span>{labels.item}</span>
        <span className="text-right">{labels.amount}</span>
      </div>
      <div className="space-y-0.5">
        {safeItems.map((item, index) => (
          <div
            key={item.id}
            className="cmp-fee-note-line grid grid-cols-[minmax(0,1fr)_7.5rem_1.75rem] items-end gap-x-2 print:grid-cols-[minmax(0,1fr)_7.5rem]"
          >
            <Input
              aria-label={`${labels.item} ${index + 1}`}
              className="h-7 rounded-none border-x-0 border-t-0 border-border bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-neutral-600 print:h-5 print:border-0 print:bg-transparent print:text-[11px] print:shadow-none print:disabled:bg-transparent print:disabled:opacity-100"
              value={item.description}
              onChange={(event) =>
                updateItem(item.id, "description", event.target.value)
              }
            />
            <Input
              aria-label={`${labels.amount} ${index + 1}`}
              className="h-7 rounded-none border-x-0 border-t-0 border-border bg-transparent px-0 text-right text-[13px] tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-neutral-600 print:h-5 print:border-0 print:bg-transparent print:text-[11px] print:shadow-none print:disabled:bg-transparent print:disabled:opacity-100"
              inputMode="decimal"
              value={item.amount}
              onChange={(event) =>
                updateItem(item.id, "amount", event.target.value)
              }
            />
            <Button
              aria-label={`${labels.remove} ${index + 1}`}
              className="size-7 text-muted-foreground hover:text-destructive print:!hidden"
              onClick={() =>
                onChange(safeItems.filter((entry) => entry.id !== item.id))
              }
              title={labels.remove}
              type="button"
              variant="quiet"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        className="h-7 px-0 text-xs print:!hidden"
        onClick={() =>
          onChange([
            ...safeItems,
            {
              id: `fee-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              description: "",
              amount: "",
            },
          ])
        }
        type="button"
        variant="quiet"
      >
        <Plus aria-hidden="true" className="size-3.5" />
        {labels.add}
      </Button>
      <div className="pt-0.5 print:pt-0">
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_1.75rem] gap-x-2 print:grid-cols-[minmax(0,1fr)_7.5rem]">
          <span className="text-xs text-muted-foreground print:text-[10px]">
            {labels.total}
          </span>
          <span className="inline-block min-w-[7.5rem] border-t border-foreground pt-0.5 text-right text-sm font-semibold tabular-nums print:text-[11px]">
            <span
              className="block border-b-4 border-double border-foreground pb-0.5"
              data-testid="cmp-fee-note-total"
            >
              {formatFeeNoteAmount(total, currency, locale)}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

function formatFeeNoteAmount(
  value: number,
  currency: CmpEngagementFeeNote["currency"],
  locale: CmpFeeNoteLocale
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function FeeNoteAccountLine<
  TAccount extends FeeNoteField,
  TSwift extends FeeNoteField,
>({
  accountField,
  accountLabel,
  swiftField,
  swiftLabel,
  note,
  onChange,
  source,
}: {
  accountField: TAccount;
  accountLabel: string;
  swiftField: TSwift;
  swiftLabel: string;
  note: CmpEngagementFeeNote;
  onChange: <T extends FeeNoteField>(
    field: T,
    value: CmpEngagementFeeNote[T]
  ) => void;
  source: string;
}) {
  return (
    <div className="cmp-fee-note-account-line grid grid-cols-2 gap-x-3">
      <FeeNoteInlineField
        field={accountField}
        label={accountLabel}
        source={source}
        value={note[accountField]}
        onChange={onChange}
      />
      <FeeNoteInlineField
        field={swiftField}
        label={swiftLabel}
        source={source}
        value={note[swiftField]}
        onChange={onChange}
      />
    </div>
  );
}

function FeeNoteInlineField<K extends FeeNoteField>({
  field,
  label,
  source,
  value,
  onChange,
  inputMode,
  inline = false,
  rightAligned = false,
  multiline = false,
  disabled = false,
}: {
  field: K;
  label: string;
  source: string;
  value: CmpEngagementFeeNote[K];
  onChange: <T extends FeeNoteField>(
    field: T,
    value: CmpEngagementFeeNote[T]
  ) => void;
  inputMode?: "decimal";
  inline?: boolean;
  rightAligned?: boolean;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={inline ? "inline-block align-bottom" : "block min-w-0"}>
      {inline ? null : (
        <span className="mb-0.5 block text-xs text-muted-foreground">
          {label}
        </span>
      )}
      <Input
        aria-label={label}
        className={`h-6 rounded-none border-x-0 border-t-0 border-border bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-neutral-600 print:h-5 print:border-0 print:bg-transparent print:text-[11px] print:shadow-none print:disabled:bg-transparent print:disabled:opacity-100 ${rightAligned ? "text-right" : ""} ${multiline ? "h-10" : ""}`}
        disabled={disabled}
        inputMode={inputMode}
        title={`${label} · ${source}`}
        value={String(value ?? "")}
        onChange={(event) =>
          onChange(field, event.target.value as CmpEngagementFeeNote[K])
        }
      />
      <AutofillHint source={source} compact />
    </label>
  );
}

function FeeNoteTextAreaCompact<K extends FeeNoteField>({
  field,
  label,
  source,
  value,
  onChange,
  rows,
}: {
  field: K;
  label: string;
  source: string;
  value: CmpEngagementFeeNote[K];
  onChange: <T extends FeeNoteField>(
    field: T,
    value: CmpEngagementFeeNote[T]
  ) => void;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs text-muted-foreground">
        {label}
      </span>
      <Textarea
        aria-label={label}
        className="min-h-0 resize-none rounded-none border-x-0 border-t-0 border-border bg-transparent px-0 py-0.5 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-neutral-600 print:border-0 print:bg-transparent print:px-0 print:py-0 print:text-[11px] print:leading-4 print:shadow-none print:disabled:bg-transparent print:disabled:opacity-100"
        rows={rows}
        title={`${label} · ${source}`}
        value={String(value ?? "")}
        onChange={(event) =>
          onChange(field, event.target.value as CmpEngagementFeeNote[K])
        }
      />
      <AutofillHint source={source} compact />
    </label>
  );
}

function AutofillHint({
  source,
  compact = false,
}: {
  source: string;
  compact?: boolean;
}) {
  const documentCopy = useContext(FeeNoteCopyContext);
  const { dictionary } = useCmpI18n();
  return (
    <span
      className={
        compact ? "sr-only" : "mt-1 block text-xs text-muted-foreground"
      }
    >
      {(
        documentCopy?.autofillHint ?? dictionary.workspace.feeNoteAutofillHint
      ).replace("{source}", source)}
    </span>
  );
}

function feeNoteInput(note: CmpEngagementFeeNote) {
  const {
    id: _id,
    engagementId: _engagementId,
    collectionStatus: _collectionStatus,
    outstandingAmount: _outstandingAmount,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = note;
  return input;
}

function noteForLocale(
  note: CmpEngagementFeeNote,
  locale: CmpFeeNoteLocale
): CmpEngagementFeeNote {
  const content = note.localizedContent[locale];
  return {
    ...note,
    recipientName: content.recipientName,
    recipientAttention: content.recipientAttention,
    recipientSalutation: content.recipientSalutation,
    recipientAddress: content.recipientAddress,
    serviceDescription: content.serviceDescription,
    lineItems: (Array.isArray(note.lineItems) ? note.lineItems : []).map(
      (item) => ({
        ...item,
        description: content.lineItemDescriptions[item.id] ?? item.description,
      })
    ),
    signatoryName: content.signatoryName,
    bankPayeeName: content.bankPayeeName,
    bankName: content.bankName,
    firmLegalName: content.firmLegalName,
    firmAddress: content.firmAddress,
  };
}

export function FeeNoteExportDialog({
  open,
  onOpenChange,
  format,
  onFormatChange,
  locales,
  onToggleLocale,
  onExport,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: "pdf" | "docx";
  onFormatChange: (format: "pdf" | "docx") => void;
  locales: CmpFeeNoteLocale[];
  onToggleLocale: (locale: CmpFeeNoteLocale) => void;
  onExport: () => void;
  pending: boolean;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.feeNoteExportTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">
              {copy.feeNoteExportFormat}
            </legend>
            <ButtonGroup aria-label={copy.feeNoteExportFormat}>
              <Button
                type="button"
                size="sm"
                variant={format === "pdf" ? "default" : "outline"}
                aria-pressed={format === "pdf"}
                onClick={() => onFormatChange("pdf")}
              >
                {copy.feeNoteExportPdf}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={format === "docx" ? "default" : "outline"}
                aria-pressed={format === "docx"}
                onClick={() => onFormatChange("docx")}
              >
                {copy.feeNoteExportWord}
              </Button>
            </ButtonGroup>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">
              {copy.feeNoteExportLanguages}
            </legend>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={locales.includes("zh-CN")}
                onCheckedChange={() => onToggleLocale("zh-CN")}
              />
              {copy.feeNoteLanguageChinese}
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={locales.includes("en-US")}
                onCheckedChange={() => onToggleLocale("en-US")}
              />
              {copy.feeNoteLanguageEnglish}
            </label>
          </fieldset>
          {locales.length ? null : (
            <p className="text-sm text-destructive">
              {copy.feeNoteExportSelectionRequired}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {copy.cancel}
            </Button>
            <Button
              disabled={pending || !locales.length}
              onClick={onExport}
              type="button"
            >
              <Download aria-hidden="true" className="size-4" />
              {pending ? copy.feeNoteSaving : copy.feeNoteExportStart}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeeNoteLoading() {
  return (
    <main className="min-h-screen bg-muted/25 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto h-screen max-w-3xl animate-pulse rounded-xl border border-border bg-card" />
    </main>
  );
}
