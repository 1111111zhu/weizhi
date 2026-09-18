"use client";

import type {
  CmpBillingBankTemplate,
  CmpBillingFirmTemplate,
  CreateCmpBillingBankTemplateInput,
  CreateCmpBillingFirmTemplateInput,
} from "@project-wing/shared";
import {
  UI_UNIT_LABELS,
  Button,
  Checkbox,
  Input,
  projectWingToast as toast,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Landmark,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
} from "lucide-react";
import { useState } from "react";

import { api } from "@/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCmpI18n } from "@/i18n/client";
import type { CmpDictionary } from "@/i18n/client";

type BillingTemplateSettingsProps = {
  active?: boolean;
  embedded?: boolean;
  locale: "zh-CN" | "en-US";
  role: string;
};

const EMPTY_FIRM: CreateCmpBillingFirmTemplateInput = {
  name: "",
  firmLegalNameZh: "",
  firmLegalNameEn: "",
  firmAddressZh: "",
  firmAddressEn: "",
  phone: "",
  email: "",
  website: "",
  isDefault: false,
};
const EMPTY_BANK: CreateCmpBillingBankTemplateInput = {
  name: "",
  bankPayeeNameZh: "",
  bankPayeeNameEn: "",
  bankNameZh: "",
  bankNameEn: "",
  hkdAccountNumber: "",
  hkdSwiftCode: "",
  cnyAccountNumber: "",
  cnySwiftCode: "",
  usdAccountNumber: "",
  usdSwiftCode: "",
  isDefault: false,
};

export function BillingTemplateSettings({
  active = true,
  embedded = false,
  locale: _locale,
  role,
}: BillingTemplateSettingsProps) {
  const { dictionary } = useCmpI18n();
  const labels = dictionary.shell.billingTemplates;
  const canManage = ["PARTNER", "MANAGER", "SUPER_ADMIN"].includes(role);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"firm" | "bank">("firm");
  const [firmEditor, setFirmEditor] = useState<{
    id?: string;
    version?: number;
    value: CreateCmpBillingFirmTemplateInput;
  } | null>(null);
  const [bankEditor, setBankEditor] = useState<{
    id?: string;
    version?: number;
    value: CreateCmpBillingBankTemplateInput;
  } | null>(null);
  const client = useQueryClient();
  const templates = useQuery({
    queryKey: ["cmp-billing-templates", "settings"],
    queryFn: () => api.cmpBillingTemplates(true),
    enabled: (embedded || open) && active && canManage,
  });
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["cmp-billing-templates"] });
    await client.invalidateQueries({
      queryKey: ["cmp-billing-import-options"],
    });
  };
  const firmSave = useMutation({
    mutationFn: (editor: NonNullable<typeof firmEditor>) => {
      if (!editor.id) {
        return api.createCmpBillingFirmTemplate(editor.value);
      }
      if (editor.version === undefined) {
        throw new Error("Existing templates require a version");
      }
      return api.updateCmpBillingFirmTemplate(editor.id, {
        ...editor.value,
        expectedVersion: editor.version,
      });
    },
    onSuccess: async () => {
      await invalidate();
      setFirmEditor(null);
      toast.success(labels.firmSaved);
    },
    onError: () => toast.error(labels.firmSaveFailed),
  });
  const bankSave = useMutation({
    mutationFn: (editor: NonNullable<typeof bankEditor>) => {
      if (!editor.id) {
        return api.createCmpBillingBankTemplate(editor.value);
      }
      if (editor.version === undefined) {
        throw new Error("Existing templates require a version");
      }
      return api.updateCmpBillingBankTemplate(editor.id, {
        ...editor.value,
        expectedVersion: editor.version,
      });
    },
    onSuccess: async () => {
      await invalidate();
      setBankEditor(null);
      toast.success(labels.bankSaved);
    },
    onError: () => toast.error(labels.bankSaveFailed),
  });
  const deactivateFirm = useMutation({
    mutationFn: (template: CmpBillingFirmTemplate) =>
      api.deactivateCmpBillingFirmTemplate(template.id, {
        expectedVersion: template.version,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(labels.firmDeactivated);
    },
    onError: () => toast.error(labels.deactivateFailed),
  });
  const deactivateBank = useMutation({
    mutationFn: (template: CmpBillingBankTemplate) =>
      api.deactivateCmpBillingBankTemplate(template.id, {
        expectedVersion: template.version,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(labels.bankDeactivated);
    },
    onError: () => toast.error(labels.deactivateFailed),
  });
  const setDefaultFirm = useMutation({
    mutationFn: (template: CmpBillingFirmTemplate) =>
      api.updateCmpBillingFirmTemplate(template.id, {
        expectedVersion: template.version,
        isDefault: true,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(labels.defaultFirmUpdated);
    },
    onError: () => toast.error(labels.defaultUpdateFailed),
  });
  const setDefaultBank = useMutation({
    mutationFn: (template: CmpBillingBankTemplate) =>
      api.updateCmpBillingBankTemplate(template.id, {
        expectedVersion: template.version,
        isDefault: true,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(labels.defaultBankUpdated);
    },
    onError: () => toast.error(labels.defaultUpdateFailed),
  });

  if (!canManage) {
    return null;
  }
  const settingsContent = (
    <>
      {embedded ? (
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {labels.title}
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {labels.description}
          </p>
        </div>
      ) : (
        <DialogHeader className="border-b border-border/80 px-5 py-4 sm:px-7">
          <DialogTitle>{labels.title}</DialogTitle>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {labels.description}
          </p>
        </DialogHeader>
      )}
      <div
        className={
          embedded
            ? "flex flex-wrap items-center justify-between gap-3"
            : "flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3 sm:px-7"
        }
      >
        <div className="inline-flex rounded-lg border border-border/80 p-1">
          <Button
            type="button"
            size="sm"
            variant={tab === "firm" ? "default" : "quiet"}
            onClick={() => setTab("firm")}
          >
            <Building2 className="size-3.5" />
            {labels.firm}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "bank" ? "default" : "quiet"}
            onClick={() => setTab("bank")}
          >
            <Landmark className="size-3.5" />
            {labels.bank}
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            tab === "firm"
              ? setFirmEditor({ value: { ...EMPTY_FIRM } })
              : setBankEditor({ value: { ...EMPTY_BANK } })
          }
        >
          <Plus className="size-3.5" />
          {tab === "firm" ? labels.newFirm : labels.newBank}
        </Button>
      </div>
      <div className={embedded ? "grid gap-3" : "grid gap-3 p-5 sm:p-7"}>
        {templates.isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {labels.loading}
          </div>
        ) : null}
        {templates.isError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {labels.loadFailed}
          </p>
        ) : null}
        {templates.data && tab === "firm" ? (
          <TemplateList
            templates={templates.data.firmTemplates}
            empty={labels.empty}
            defaultLabel={labels.default}
            inactiveLabel={labels.inactive}
            setDefaultLabel={labels.setDefault}
            editLabel={labels.edit}
            deactivateLabel={labels.deactivate}
            onEdit={(template) =>
              setFirmEditor({
                id: template.id,
                version: template.version,
                value: firmInput(template),
              })
            }
            onSetDefault={(template) => setDefaultFirm.mutate(template)}
            onDeactivate={(template) => deactivateFirm.mutate(template)}
          />
        ) : null}
        {templates.data && tab === "bank" ? (
          <TemplateList
            templates={templates.data.bankTemplates}
            empty={labels.empty}
            defaultLabel={labels.default}
            inactiveLabel={labels.inactive}
            setDefaultLabel={labels.setDefault}
            editLabel={labels.edit}
            deactivateLabel={labels.deactivate}
            onEdit={(template) =>
              setBankEditor({
                id: template.id,
                version: template.version,
                value: bankInput(template),
              })
            }
            onSetDefault={(template) => setDefaultBank.mutate(template)}
            onDeactivate={(template) => deactivateBank.mutate(template)}
          />
        ) : null}
      </div>
    </>
  );
  return (
    <>
      {embedded ? null : (
        <Button
          type="button"
          variant="outline"
          className="h-8 w-full justify-between gap-3 text-xs"
          onClick={() => setOpen(true)}
        >
          <span className="flex items-center gap-2">
            <Landmark className="size-3.5" aria-hidden="true" />
            {labels.button}
          </span>
          <Plus className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      )}
      {embedded ? (
        <section className="grid gap-4">{settingsContent}</section>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] w-[min(70rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto p-0">
            {settingsContent}
          </DialogContent>
        </Dialog>
      )}
      <TemplateEditor
        open={Boolean(firmEditor)}
        title={firmEditor?.id ? labels.edit : labels.newFirm}
        labels={labels}
        value={firmEditor?.value ?? EMPTY_FIRM}
        fields={firmFormFields(labels)}
        saving={firmSave.isPending}
        onOpenChange={(next) => !next && setFirmEditor(null)}
        onChange={(key, value) =>
          setFirmEditor((editor) =>
            editor
              ? { ...editor, value: { ...editor.value, [key]: value } }
              : editor
          )
        }
        onSave={() => firmEditor && firmSave.mutate(firmEditor)}
      />
      <TemplateEditor
        open={Boolean(bankEditor)}
        title={bankEditor?.id ? labels.edit : labels.newBank}
        labels={labels}
        value={bankEditor?.value ?? EMPTY_BANK}
        fields={bankFormFields(labels)}
        saving={bankSave.isPending}
        onOpenChange={(next) => !next && setBankEditor(null)}
        onChange={(key, value) =>
          setBankEditor((editor) =>
            editor
              ? { ...editor, value: { ...editor.value, [key]: value } }
              : editor
          )
        }
        onSave={() => bankEditor && bankSave.mutate(bankEditor)}
      />
    </>
  );
}

function TemplateList<
  T extends CmpBillingFirmTemplate | CmpBillingBankTemplate,
>({
  templates,
  empty,
  defaultLabel,
  inactiveLabel,
  setDefaultLabel,
  editLabel,
  deactivateLabel,
  onEdit,
  onSetDefault,
  onDeactivate,
}: {
  templates: T[];
  empty: string;
  defaultLabel: string;
  inactiveLabel: string;
  setDefaultLabel: string;
  editLabel: string;
  deactivateLabel: string;
  onEdit: (template: T) => void;
  onSetDefault: (template: T) => void;
  onDeactivate: (template: T) => void;
}) {
  if (!templates.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      {templates.map((template) => (
        <article
          key={template.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 p-4"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm">{template.name}</strong>
              {template.isDefault ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {defaultLabel}
                </span>
              ) : null}
              {template.status === "INACTIVE" ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {inactiveLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {UI_UNIT_LABELS.version}
              {template.version} · {template.updatedAt.slice(0, 10)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {template.isDefault ? null : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={template.status !== "ACTIVE"}
                onClick={() => onSetDefault(template)}
              >
                {setDefaultLabel}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={template.status !== "ACTIVE"}
              onClick={() => onEdit(template)}
            >
              <Pencil className="size-3.5" />
              {editLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={template.status !== "ACTIVE"}
              className="text-destructive hover:text-destructive"
              onClick={() => onDeactivate(template)}
            >
              <Power className="size-3.5" />
              {deactivateLabel}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function TemplateEditor({
  open,
  title,
  labels,
  value,
  fields,
  saving,
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean;
  title: string;
  labels: { name: string; default: string; save: string; cancel: string };
  value: Record<string, string | boolean | undefined>;
  fields: { key: string; label: string }[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (key: string, value: string | boolean) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {fields.map((field) => (
            <label key={field.key} className="grid gap-1.5 text-sm font-medium">
              <span>{field.label}</span>
              <Input
                value={String(value[field.key] ?? "")}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(value.isDefault)}
              onCheckedChange={(next) => onChange("isDefault", next)}
            />
            {labels.default}
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {labels.cancel}
          </Button>
          <Button
            type="button"
            disabled={saving || !String(value.name ?? "").trim()}
            onClick={onSave}
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {labels.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function firmInput(
  template: CmpBillingFirmTemplate
): CreateCmpBillingFirmTemplateInput {
  const {
    id: _id,
    version: _version,
    status: _status,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = template;
  return input;
}
function bankInput(
  template: CmpBillingBankTemplate
): CreateCmpBillingBankTemplateInput {
  const {
    id: _id,
    version: _version,
    status: _status,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = template;
  return input;
}
type BillingTemplateLabels = CmpDictionary["shell"]["billingTemplates"];

function firmFormFields(labels: BillingTemplateLabels) {
  return [
    { key: "name", label: labels.name },
    {
      key: "firmLegalNameZh",
      label: labels.firmLegalNameZh,
    },
    {
      key: "firmLegalNameEn",
      label: labels.firmLegalNameEn,
    },
    {
      key: "firmAddressZh",
      label: labels.firmAddressZh,
    },
    {
      key: "firmAddressEn",
      label: labels.firmAddressEn,
    },
    { key: "phone", label: labels.phone },
    { key: "email", label: labels.email },
    { key: "website", label: labels.website },
  ];
}
function bankFormFields(labels: BillingTemplateLabels) {
  return [
    { key: "name", label: labels.name },
    {
      key: "bankPayeeNameZh",
      label: labels.bankPayeeNameZh,
    },
    {
      key: "bankPayeeNameEn",
      label: labels.bankPayeeNameEn,
    },
    {
      key: "bankNameZh",
      label: labels.bankNameZh,
    },
    {
      key: "bankNameEn",
      label: labels.bankNameEn,
    },
    { key: "hkdAccountNumber", label: labels.hkdAccountNumber },
    { key: "hkdSwiftCode", label: labels.hkdSwiftCode },
    { key: "cnyAccountNumber", label: labels.cnyAccountNumber },
    { key: "cnySwiftCode", label: labels.cnySwiftCode },
    { key: "usdAccountNumber", label: labels.usdAccountNumber },
    { key: "usdSwiftCode", label: labels.usdSwiftCode },
  ];
}
