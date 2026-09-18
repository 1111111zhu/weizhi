"use client";

import type {
  CmpBilling,
  CmpBillingBankTemplate,
  CmpBillingFirmTemplate,
  CmpBillingImportAudit,
  CmpBillingImportField,
} from "@project-wing/shared";
import { Button, Checkbox, Input, SelectField } from "@project-wing/ui";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  LoaderCircle,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBillingDataImportCopy } from "@/i18n/billing-data-import";

export type BillingImportDocumentDraft = Pick<
  CmpBilling,
  "clientSnapshot" | "firmSnapshot" | "localizedContent"
>;

export type BillingImportDraftPatch = Pick<
  BillingImportDocumentDraft,
  "clientSnapshot" | "firmSnapshot" | "localizedContent"
> & {
  importAudit: CmpBillingImportAudit;
};

type BillingDataImportDialogProps = {
  billingId: string;
  document: BillingImportDocumentDraft;
  locale: "zh-CN" | "en-US";
  readOnly: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (patch: BillingImportDraftPatch) => void;
};

type TextPair = { zh: string; en: string };
type EditableFirmField = keyof Pick<
  CmpBillingFirmTemplate,
  | "firmLegalNameZh"
  | "firmLegalNameEn"
  | "firmAddressZh"
  | "firmAddressEn"
  | "phone"
  | "email"
  | "website"
>;
type EditableBankField = keyof Pick<
  CmpBillingBankTemplate,
  | "bankPayeeNameZh"
  | "bankPayeeNameEn"
  | "bankNameZh"
  | "bankNameEn"
  | "hkdAccountNumber"
  | "hkdSwiftCode"
  | "cnyAccountNumber"
  | "cnySwiftCode"
  | "usdAccountNumber"
  | "usdSwiftCode"
>;

const FIRM_FIELDS: {
  key: EditableFirmField;
  labelZh: string;
  labelEn: string;
}[] = [
  {
    key: "firmLegalNameZh",
    labelZh: "事务所法定名称（中文）",
    labelEn: "Firm legal name (Chinese)",
  },
  {
    key: "firmLegalNameEn",
    labelZh: "事务所法定名称（英文）",
    labelEn: "Firm legal name (English)",
  },
  {
    key: "firmAddressZh",
    labelZh: "事务所地址（中文）",
    labelEn: "Firm address (Chinese)",
  },
  {
    key: "firmAddressEn",
    labelZh: "事务所地址（英文）",
    labelEn: "Firm address (English)",
  },
  { key: "phone", labelZh: "电话", labelEn: "Telephone" },
  { key: "email", labelZh: "邮箱", labelEn: "Email" },
  { key: "website", labelZh: "网站", labelEn: "Website" },
];

const BANK_FIELDS: {
  key: EditableBankField;
  labelZh: string;
  labelEn: string;
}[] = [
  {
    key: "bankPayeeNameZh",
    labelZh: "收款人（中文）",
    labelEn: "Payee (Chinese)",
  },
  {
    key: "bankPayeeNameEn",
    labelZh: "收款人（英文）",
    labelEn: "Payee (English)",
  },
  {
    key: "bankNameZh",
    labelZh: "银行名称（中文）",
    labelEn: "Bank name (Chinese)",
  },
  {
    key: "bankNameEn",
    labelZh: "银行名称（英文）",
    labelEn: "Bank name (English)",
  },
  { key: "hkdAccountNumber", labelZh: "港币账户", labelEn: "HKD account" },
  {
    key: "hkdSwiftCode",
    labelZh: "港币 SWIFT 代码",
    labelEn: "HKD SWIFT code",
  },
  { key: "cnyAccountNumber", labelZh: "人民币账户", labelEn: "CNY account" },
  {
    key: "cnySwiftCode",
    labelZh: "人民币 SWIFT 代码",
    labelEn: "CNY SWIFT code",
  },
  { key: "usdAccountNumber", labelZh: "美元账户", labelEn: "USD account" },
  {
    key: "usdSwiftCode",
    labelZh: "美元 SWIFT 代码",
    labelEn: "USD SWIFT code",
  },
];

export function BillingDataImportDialog({
  billingId,
  document,
  locale,
  readOnly,
  open,
  onOpenChange,
  onApply,
}: BillingDataImportDialogProps) {
  const zh = locale === "zh-CN";
  const text = getBillingDataImportCopy(locale, readOnly);
  const options = useQuery({
    queryKey: ["cmp-billing-import-options", billingId],
    queryFn: () => api.cmpBillingImportOptions(billingId),
    enabled: open,
  });
  const [cmpEnabled, setCmpEnabled] = useState(true);
  const [generalEnabled, setGeneralEnabled] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    () => new Set()
  );
  const [incoming, setIncoming] = useState<Record<string, TextPair>>({});
  const [firmTemplateId, setFirmTemplateId] = useState("");
  const [bankTemplateId, setBankTemplateId] = useState("");
  const [firmEnabled, setFirmEnabled] = useState(false);
  const [bankEnabled, setBankEnabled] = useState(false);
  const [firmDraft, setFirmDraft] = useState<CmpBillingFirmTemplate | null>(
    null
  );
  const [bankDraft, setBankDraft] = useState<CmpBillingBankTemplate | null>(
    null
  );

  const selectedFirm = useMemo(
    () =>
      options.data?.firmTemplates.find(
        (template) => template.id === firmTemplateId
      ) ?? null,
    [firmTemplateId, options.data?.firmTemplates]
  );
  const selectedBank = useMemo(
    () =>
      options.data?.bankTemplates.find(
        (template) => template.id === bankTemplateId
      ) ?? null,
    [bankTemplateId, options.data?.bankTemplates]
  );

  useEffect(() => {
    if (!open || !options.data) {
      return;
    }
    const defaultFirm = options.data.firmTemplates.find(
      (template) => template.isDefault
    );
    const defaultBank = options.data.bankTemplates.find(
      (template) => template.isDefault
    );
    // eslint-disable-next-line react/set-state-in-effect -- The dialog must reset once its asynchronous import options arrive.
    setCmpEnabled(true);
    setGeneralEnabled(false);
    setFirmTemplateId(
      defaultFirm?.id ?? options.data.firmTemplates[0]?.id ?? ""
    );
    setBankTemplateId(
      defaultBank?.id ?? options.data.bankTemplates[0]?.id ?? ""
    );
    setFirmEnabled(false);
    setBankEnabled(false);
    setSelectedFields(
      new Set(options.data.cmpFields.map((field) => field.key))
    );
    setIncoming(
      Object.fromEntries(
        options.data.cmpFields.map((field) => [field.key, { ...field.value }])
      )
    );
  }, [open, options.data]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- A selected shared template becomes the editable draft for this open dialog.
    setFirmDraft(selectedFirm ? { ...selectedFirm } : null);
  }, [selectedFirm]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- A selected shared template becomes the editable draft for this open dialog.
    setBankDraft(selectedBank ? { ...selectedBank } : null);
  }, [selectedBank]);

  const toggleFields = (keys: string[], checked: boolean) => {
    setSelectedFields((current) => {
      const next = new Set(current);
      keys.forEach((key) => (checked ? next.add(key) : next.delete(key)));
      return next;
    });
  };
  const checked = (key: string) => selectedFields.has(key);
  const cmpFields = options.data?.cmpFields ?? [];
  const firmKeys = FIRM_FIELDS.map((field) => `firm.${field.key}`);
  const bankKeys = BANK_FIELDS.map((field) => `bank.${field.key}`);
  const selectedCount = selectedFields.size;

  const enableGeneral = (next: boolean) => {
    setGeneralEnabled(next);
    if (!next) {
      setFirmEnabled(false);
      setBankEnabled(false);
      toggleFields([...firmKeys, ...bankKeys], false);
      return;
    }
    if (selectedFirm) {
      setFirmEnabled(true);
      toggleFields(firmKeys, true);
    }
    if (selectedBank) {
      setBankEnabled(true);
      toggleFields(bankKeys, true);
    }
  };

  const enableFirm = (next: boolean) => {
    setFirmEnabled(next);
    toggleFields(firmKeys, next);
  };
  const enableBank = (next: boolean) => {
    setBankEnabled(next);
    toggleFields(bankKeys, next);
  };

  const apply = () => {
    if (!options.data || !selectedCount) {
      return;
    }
    const nextClientSnapshot = { ...document.clientSnapshot };
    const nextFirmSnapshot = { ...document.firmSnapshot };
    const nextLocalized = {
      "zh-CN": {
        ...document.localizedContent["zh-CN"],
        lineItemDescriptions: {
          ...document.localizedContent["zh-CN"].lineItemDescriptions,
        },
      },
      "en-US": {
        ...document.localizedContent["en-US"],
        lineItemDescriptions: {
          ...document.localizedContent["en-US"].lineItemDescriptions,
        },
      },
    };
    const importField = (field: CmpBillingImportField) => {
      if (!checked(field.key)) {
        return;
      }
      const value = incoming[field.key] ?? field.value;
      if (field.key === "clientSnapshot") {
        Object.assign(nextClientSnapshot, options.data.defaults.clientSnapshot);
        return;
      }
      if (field.key === "engagementSnapshot") {
        Object.assign(nextClientSnapshot, options.data.defaults.clientSnapshot);
        return;
      }
      if (field.key in nextLocalized["zh-CN"]) {
        nextLocalized["zh-CN"][
          field.key as keyof (typeof nextLocalized)["zh-CN"]
        ] = value.zh as never;
        nextLocalized["en-US"][
          field.key as keyof (typeof nextLocalized)["en-US"]
        ] = value.en as never;
      }
    };
    if (cmpEnabled) {
      cmpFields.forEach(importField);
    }
    if (generalEnabled && firmEnabled && firmDraft) {
      if (checked("firm.firmLegalNameZh")) {
        nextLocalized["zh-CN"].firmLegalName = firmDraft.firmLegalNameZh;
      }
      if (checked("firm.firmLegalNameEn")) {
        nextLocalized["en-US"].firmLegalName = firmDraft.firmLegalNameEn;
      }
      if (checked("firm.firmAddressZh")) {
        nextLocalized["zh-CN"].firmAddress = firmDraft.firmAddressZh;
      }
      if (checked("firm.firmAddressEn")) {
        nextLocalized["en-US"].firmAddress = firmDraft.firmAddressEn;
      }
      if (checked("firm.phone")) {
        nextFirmSnapshot.phone = firmDraft.phone;
      }
      if (checked("firm.email")) {
        nextFirmSnapshot.email = firmDraft.email;
      }
      if (checked("firm.website")) {
        nextFirmSnapshot.website = firmDraft.website;
      }
    }
    if (generalEnabled && bankEnabled && bankDraft) {
      if (checked("bank.bankPayeeNameZh")) {
        nextLocalized["zh-CN"].bankPayeeName = bankDraft.bankPayeeNameZh;
      }
      if (checked("bank.bankPayeeNameEn")) {
        nextLocalized["en-US"].bankPayeeName = bankDraft.bankPayeeNameEn;
      }
      if (checked("bank.bankNameZh")) {
        nextLocalized["zh-CN"].bankName = bankDraft.bankNameZh;
      }
      if (checked("bank.bankNameEn")) {
        nextLocalized["en-US"].bankName = bankDraft.bankNameEn;
      }
      BANK_FIELDS.filter(
        (field) =>
          field.key.endsWith("AccountNumber") || field.key.endsWith("SwiftCode")
      ).forEach((field) => {
        const key = `bank.${field.key}`;
        if (checked(key)) {
          nextFirmSnapshot[field.key] = bankDraft[field.key];
        }
      });
    }
    const sources: CmpBillingImportAudit["sources"] = [];
    if (cmpEnabled && cmpFields.some((field) => checked(field.key))) {
      sources.push("CMP");
    }
    if (generalEnabled && firmEnabled && firmDraft && firmKeys.some(checked)) {
      sources.push("FIRM_TEMPLATE");
    }
    if (generalEnabled && bankEnabled && bankDraft && bankKeys.some(checked)) {
      sources.push("BANK_TEMPLATE");
    }
    if (!sources.length) {
      return;
    }
    onApply({
      clientSnapshot: nextClientSnapshot,
      firmSnapshot: nextFirmSnapshot,
      localizedContent: nextLocalized,
      importAudit: {
        sources,
        fieldKeys: [...selectedFields],
        ...(sources.includes("FIRM_TEMPLATE")
          ? { firmTemplateId: firmDraft?.id }
          : {}),
        ...(sources.includes("BANK_TEMPLATE")
          ? { bankTemplateId: bankDraft?.id }
          : {}),
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(56rem,calc(100dvh-1rem))] w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-lg p-0 2xl:w-[min(118rem,calc(100vw-2rem))]">
        <DialogHeader className="border-b border-border/80 bg-card px-5 py-2.5 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal
              className="size-5 text-primary"
              aria-hidden="true"
            />
            {text.title}
          </DialogTitle>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            {text.description}
          </p>
        </DialogHeader>
        {options.isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {text.loading}
          </div>
        ) : options.isError || !options.data ? (
          <div className="grid min-h-64 place-items-center gap-3 p-6 text-center">
            <p className="text-sm text-destructive">{text.failed}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                options.refetch();
              }}
            >
              <RefreshCw className="size-4" />
              {text.retry}
            </Button>
          </div>
        ) : (
          <div
            aria-readonly={readOnly}
            className="flex h-full min-h-0 flex-col"
          >
            <section className="shrink-0 border-b border-border/80 bg-muted/20 px-4 py-2.5 sm:px-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="mr-1 flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{text.sources}</h3>
                  <p className="hidden text-xs text-muted-foreground 2xl:block">
                    {text.sourceHint}
                  </p>
                </div>
                <SourceToggle
                  compact
                  checked={cmpEnabled}
                  disabled={readOnly}
                  label={text.cmp}
                  description={text.sourceCmp}
                  onCheckedChange={(next) => {
                    setCmpEnabled(next);
                    toggleFields(
                      cmpFields.map((field) => field.key),
                      next
                    );
                  }}
                />
                <SourceToggle
                  compact
                  checked={generalEnabled}
                  disabled={readOnly}
                  label={text.general}
                  description={text.sourceGeneral}
                  onCheckedChange={enableGeneral}
                />
                <div className="ml-auto rounded-md border border-border/70 bg-background/70 px-2.5 py-1.5 text-xs text-muted-foreground tabular-nums">
                  {selectedCount} {zh ? "项已选择" : "field(s) selected"}
                </div>
              </div>
            </section>
            <section className="min-h-0 flex-1 overflow-y-auto bg-background p-3 sm:p-4 xl:p-5">
              {cmpEnabled ? (
                <div className="grid gap-4 2xl:grid-cols-2">
                  <CmpImportSection
                    title={text.client}
                    fields={cmpFields.filter(
                      (field) => field.section === "CLIENT"
                    )}
                    selectedFields={selectedFields}
                    incoming={incoming}
                    current={document}
                    labels={text}
                    readOnly={readOnly}
                    onToggle={toggleFields}
                    onChange={(key, value) =>
                      setIncoming((current) => ({ ...current, [key]: value }))
                    }
                  />
                  <CmpImportSection
                    title={text.recipient}
                    fields={cmpFields.filter(
                      (field) => field.section === "RECIPIENT"
                    )}
                    selectedFields={selectedFields}
                    incoming={incoming}
                    current={document}
                    labels={text}
                    readOnly={readOnly}
                    onToggle={toggleFields}
                    onChange={(key, value) =>
                      setIncoming((current) => ({ ...current, [key]: value }))
                    }
                  />
                  <CmpImportSection
                    className="2xl:col-span-2"
                    title={text.engagement}
                    fields={cmpFields.filter(
                      (field) => field.section === "ENGAGEMENT"
                    )}
                    selectedFields={selectedFields}
                    incoming={incoming}
                    current={document}
                    labels={text}
                    readOnly={readOnly}
                    onToggle={toggleFields}
                    onChange={(key, value) =>
                      setIncoming((current) => ({ ...current, [key]: value }))
                    }
                  />
                </div>
              ) : null}

              {generalEnabled ? (
                <section className="mt-5 overflow-hidden rounded-xl border border-border/80">
                  <header className="border-b border-border/70 bg-muted/35 px-4 py-3">
                    <h3 className="text-sm font-medium">{text.general}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {text.templateHint}
                    </p>
                  </header>
                  <div className="space-y-4 p-4">
                    <TemplateImportSection
                      title={text.firm}
                      selectLabel={text.selectFirm}
                      templateId={firmTemplateId}
                      templates={options.data.firmTemplates}
                      selected={firmEnabled}
                      selectedFields={selectedFields}
                      fields={FIRM_FIELDS}
                      draft={firmDraft}
                      current={document}
                      locale={locale}
                      emptyLabel={text.empty}
                      readOnly={readOnly}
                      onTemplateChange={setFirmTemplateId}
                      onToggle={enableFirm}
                      onToggleFields={toggleFields}
                      onDraftChange={setFirmDraft}
                      prefix="firm"
                    />
                    <TemplateImportSection
                      title={text.bank}
                      selectLabel={text.selectBank}
                      templateId={bankTemplateId}
                      templates={options.data.bankTemplates}
                      selected={bankEnabled}
                      selectedFields={selectedFields}
                      fields={BANK_FIELDS}
                      draft={bankDraft}
                      current={document}
                      locale={locale}
                      emptyLabel={text.empty}
                      readOnly={readOnly}
                      onTemplateChange={setBankTemplateId}
                      onToggle={enableBank}
                      onToggleFields={toggleFields}
                      onDraftChange={setBankDraft}
                      prefix="bank"
                    />
                  </div>
                  {options.data.canManageTemplates ? (
                    <p className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
                      {text.manage}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </section>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-card px-5 py-3 sm:px-7">
          <span className="text-sm text-muted-foreground">
            {readOnly
              ? zh
                ? "仅查看资料来源；不会修改账单"
                : "Source view only; this bill will not be changed"
              : `${selectedCount} ${zh ? "项将被代入" : "field(s) will be imported"}`}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {readOnly ? text.close : text.cancel}
            </Button>
            {readOnly ? null : (
              <Button
                type="button"
                disabled={!options.data || !selectedCount}
                onClick={apply}
              >
                <Check className="size-4" />
                {text.apply}
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function SourceToggle({
  checked,
  compact = false,
  disabled = false,
  label,
  description,
  onCheckedChange,
}: {
  checked: boolean;
  compact?: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={
        compact
          ? `flex h-9 items-center gap-2 rounded-md border border-border/80 bg-background px-3 text-sm transition-colors ${disabled ? "cursor-default opacity-75" : "hover:bg-muted/40"}`
          : "flex items-start gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 transition-colors hover:bg-muted/40"
      }
      title={compact ? description : undefined}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className={compact ? undefined : "mt-0.5"}
      />
      <span className={compact ? "min-w-0" : "grid gap-1"}>
        <strong className="text-sm">{label}</strong>
        {compact ? null : (
          <span className="text-sm text-muted-foreground">{description}</span>
        )}
      </span>
    </label>
  );
}

function CmpImportSection({
  className,
  title,
  fields,
  selectedFields,
  incoming,
  current,
  labels,
  readOnly = false,
  onToggle,
  onChange,
}: {
  className?: string;
  title: string;
  fields: CmpBillingImportField[];
  selectedFields: Set<string>;
  incoming: Record<string, TextPair>;
  current: BillingImportDocumentDraft;
  labels: { source: string; current: string; incoming: string };
  readOnly?: boolean;
  onToggle: (keys: string[], checked: boolean) => void;
  onChange: (key: string, value: TextPair) => void;
}) {
  const keys = fields.map((field) => field.key);
  const allChecked =
    keys.length > 0 && keys.every((key) => selectedFields.has(key));
  return (
    <section
      className={`overflow-hidden rounded-xl border border-border/80${className ? ` ${className}` : ""}`}
    >
      <header className="flex items-center justify-between gap-3 bg-muted/35 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={allChecked}
            disabled={readOnly}
            indeterminate={
              !allChecked && keys.some((key) => selectedFields.has(key))
            }
            onCheckedChange={(next) => onToggle(keys, next)}
          />
          {title}
        </label>
        <span className="text-xs text-muted-foreground">
          {fields.filter((field) => selectedFields.has(field.key)).length}/
          {keys.length}
        </span>
      </header>
      <div className="divide-y divide-border/70">
        {fields.map((field) => (
          <CmpImportFieldRow
            key={field.key}
            field={field}
            checked={selectedFields.has(field.key)}
            current={currentPair(current, field.key)}
            incoming={incoming[field.key] ?? field.value}
            labels={labels}
            readOnly={readOnly}
            onCheckedChange={(next) => onToggle([field.key], next)}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
    </section>
  );
}

function CmpImportFieldRow({
  field,
  checked,
  current,
  incoming,
  labels,
  readOnly = false,
  onCheckedChange,
  onChange,
}: {
  field: CmpBillingImportField;
  checked: boolean;
  current: TextPair;
  incoming: TextPair;
  labels: { source: string; current: string; incoming: string };
  readOnly?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onChange: (value: TextPair) => void;
}) {
  return (
    <div className="grid gap-3 p-4 lg:grid-cols-[minmax(10rem,0.72fr)_minmax(10rem,0.9fr)_minmax(12rem,1fr)_minmax(15rem,1.25fr)] lg:items-start">
      <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
        <Checkbox
          checked={checked}
          disabled={readOnly}
          onCheckedChange={onCheckedChange}
        />
        <span>{fieldLabel(field.key)}</span>
      </label>
      <ValueCell label={labels.source} value={field.source} />
      <ValueCell label={labels.current} value={pairText(current)} />
      {field.editable ? (
        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">
            {labels.incoming}
          </span>
          <Input
            value={incoming.zh}
            disabled={readOnly || !checked}
            onChange={(event) =>
              onChange({ ...incoming, zh: event.target.value })
            }
            aria-label={`${fieldLabel(field.key)} Chinese`}
          />
          <Input
            value={incoming.en}
            disabled={readOnly || !checked}
            onChange={(event) =>
              onChange({ ...incoming, en: event.target.value })
            }
            aria-label={`${fieldLabel(field.key)} English`}
          />
        </div>
      ) : (
        <ValueCell label={labels.incoming} value={pairText(incoming)} />
      )}
    </div>
  );
}

function TemplateImportSection<
  T extends CmpBillingFirmTemplate | CmpBillingBankTemplate,
>({
  title,
  selectLabel,
  templateId,
  templates,
  selected,
  selectedFields,
  fields,
  draft,
  current,
  locale,
  emptyLabel,
  readOnly = false,
  onTemplateChange,
  onToggle,
  onToggleFields,
  onDraftChange,
  prefix,
}: {
  title: string;
  selectLabel: string;
  templateId: string;
  templates: T[];
  selected: boolean;
  selectedFields: Set<string>;
  fields: { key: keyof T & string; labelZh: string; labelEn: string }[];
  draft: T | null;
  current: BillingImportDocumentDraft;
  locale: "zh-CN" | "en-US";
  emptyLabel: string;
  readOnly?: boolean;
  onTemplateChange: (id: string) => void;
  onToggle: (checked: boolean) => void;
  onToggleFields: (keys: string[], checked: boolean) => void;
  onDraftChange: (draft: T | null) => void;
  prefix: "firm" | "bank";
}) {
  const keys = fields.map((field) => `${prefix}.${field.key}`);
  const allChecked =
    keys.length > 0 && keys.every((key) => selectedFields.has(key));
  return (
    <section className="overflow-hidden rounded-xl border border-border/80">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-muted/35 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={selected}
            disabled={readOnly || !templates.length}
            onCheckedChange={onToggle}
          />
          {title}
        </label>
        <SelectField
          value={templateId}
          disabled={readOnly || !templates.length || !selected}
          label={selectLabel}
          labelVisibility="hidden"
          onValueChange={(value) => {
            onTemplateChange(value);
            onToggleFields(keys, true);
          }}
          placeholder={emptyLabel}
          options={templates.map((template) => ({
            value: template.id,
            label: `${template.name}${template.isDefault ? (locale === "zh-CN" ? " · 默认" : " · Default") : ""}`,
          }))}
        />
      </header>
      {selected && draft ? (
        <div className="divide-y divide-border/70">
          {fields.map((field) => {
            const id = `${prefix}.${field.key}`;
            const value = String(draft[field.key] ?? "");
            return (
              <div
                key={id}
                className="grid gap-3 p-3 xl:grid-cols-[minmax(10rem,0.7fr)_minmax(12rem,0.95fr)_minmax(14rem,1.15fr)] xl:items-start"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={selectedFields.has(id)}
                    disabled={readOnly}
                    onCheckedChange={(next) => onToggleFields([id], next)}
                  />
                  {locale === "zh-CN" ? field.labelZh : field.labelEn}
                </label>
                <ValueCell
                  label={
                    locale === "zh-CN" ? "当前账单值" : "Current bill value"
                  }
                  value={currentTemplateValue(current, prefix, field.key)}
                />
                <label className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {locale === "zh-CN" ? "将带入的值" : "Incoming value"}
                  </span>
                  <Input
                    value={value}
                    disabled={readOnly || !selectedFields.has(id)}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        [field.key]: event.target.value,
                      })
                    }
                    aria-label={
                      locale === "zh-CN"
                        ? `${field.labelZh} 将带入的值`
                        : `${field.labelEn} incoming value`
                    }
                  />
                </label>
              </div>
            );
          })}
        </div>
      ) : null}
      {selected ? (
        <div className="sr-only" aria-live="polite">
          {allChecked
            ? "All template fields selected"
            : "Template fields can be selected individually"}
        </div>
      ) : null}
    </section>
  );
}

function ValueCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-h-5 text-sm break-words">{value || "—"}</span>
    </div>
  );
}

function fieldLabel(key: string) {
  const labels: Record<string, string> = {
    clientSnapshot: "Client snapshot / 客户快照",
    recipientName: "Recipient name / 收件人名称",
    recipientAddress: "Recipient address / 收件地址",
    recipientAttention: "Attention / 收件人称呼",
    recipientSalutation: "Salutation / 称呼",
    engagementSnapshot: "Engagement snapshot / 业务快照",
    signatoryName: "PIC signatory / PIC 签署人",
  };
  return labels[key] ?? key;
}

function currentPair(
  document: BillingImportDocumentDraft,
  key: string
): TextPair {
  const zh = document.localizedContent["zh-CN"];
  const en = document.localizedContent["en-US"];
  if (key === "clientSnapshot" || key === "engagementSnapshot") {
    const clientCode = String(document.clientSnapshot.clientCode ?? "");
    const engagementCode = String(document.clientSnapshot.engagementCode ?? "");
    const value = key === "clientSnapshot" ? clientCode : engagementCode;
    return { zh: value, en: value };
  }
  const value = key as keyof typeof zh;
  return {
    zh: typeof zh[value] === "string" ? zh[value] : "",
    en: typeof en[value] === "string" ? en[value] : "",
  };
}

function currentTemplateValue(
  document: BillingImportDocumentDraft,
  prefix: "firm" | "bank",
  key: string
) {
  const zh = document.localizedContent["zh-CN"];
  const en = document.localizedContent["en-US"];
  if (prefix === "firm") {
    if (key === "firmLegalNameZh") {
      return zh.firmLegalName;
    }
    if (key === "firmLegalNameEn") {
      return en.firmLegalName;
    }
    if (key === "firmAddressZh") {
      return zh.firmAddress;
    }
    if (key === "firmAddressEn") {
      return en.firmAddress;
    }
  }
  if (prefix === "bank") {
    if (key === "bankPayeeNameZh") {
      return zh.bankPayeeName;
    }
    if (key === "bankPayeeNameEn") {
      return en.bankPayeeName;
    }
    if (key === "bankNameZh") {
      return zh.bankName;
    }
    if (key === "bankNameEn") {
      return en.bankName;
    }
  }
  return String(document.firmSnapshot[key] ?? "");
}

function pairText(value: TextPair) {
  if (value.zh && value.en && value.zh !== value.en) {
    return `${value.zh} / ${value.en}`;
  }
  return value.zh || value.en || "";
}
