"use client";

import {
  Button as MobileButton,
  Input as MobileInput,
  MobileTextArea,
  useCompactViewport,
} from "@project-wing/ui";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  ConfirmationGeneralLayout,
  ProjectConfirmationBaseInformation,
} from "../../api/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { getGeneralFieldColSpan } from "./confirmation-general-layout";

import styles from "./confirmation-base-information-mobile.module.css";

export type ConfirmationBaseInformationLayoutValues = {
  clientName: string;
  confirmationDate: string;
  reference: string;
  pic: string;
  mic: string;
  reportDate: string;
  baseInformation: ProjectConfirmationBaseInformation;
};

export type ConfirmationBaseInformationLayoutProps = {
  layout: ConfirmationGeneralLayout;
  values: ConfirmationBaseInformationLayoutValues;
  readOnly: boolean;
  isSaving: boolean;
  locale: string;
  onChange: Dispatch<SetStateAction<ConfirmationBaseInformationLayoutValues>>;
};

type LayoutField =
  ConfirmationGeneralLayout["sections"][number]["fields"][number];
type BankBinding = "bankName" | "accountNumber" | "recipientAddress";
type BankKey = "name" | "account" | "address";

const bankKeys: Record<BankBinding, BankKey> = {
  bankName: "name",
  accountNumber: "account",
  recipientAddress: "address",
};

const legacyKeys = {
  officeDate: "confirmationDate",
  picName: "pic",
  micName: "mic",
  micNameAndInitial: "mic",
  reportDate: "reportDate",
} as const satisfies Record<
  string,
  keyof Pick<
    ConfirmationBaseInformationLayoutValues,
    "confirmationDate" | "pic" | "mic" | "reportDate"
  >
>;

function isBankBinding(binding: string | undefined): binding is BankBinding {
  return binding !== undefined && Object.hasOwn(bankKeys, binding);
}

function isLegacyBinding(
  binding: string | undefined
): binding is keyof typeof legacyKeys {
  return binding !== undefined && Object.hasOwn(legacyKeys, binding);
}

function BaseInformationInput({
  className,
  disabled,
  id,
  label,
  phone = false,
  hideLabel = false,
  multiline = false,
  onChange,
  value,
}: {
  className?: string;
  disabled: boolean;
  id: string;
  label: string;
  phone?: boolean;
  hideLabel?: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div
      className={`min-w-0 flex-1 space-y-1.5 ${styles.field} ${className ?? ""}`}
    >
      <Label className={hideLabel ? "sr-only" : undefined} htmlFor={id}>
        {label}
      </Label>
      {phone ? (
        multiline ? (
          <MobileTextArea
            id={id}
            disabled={disabled}
            value={value}
            rows={2}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        ) : (
          <MobileInput
            id={id}
            disabled={disabled}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        )
      ) : (
        <Input
          id={id}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}
    </div>
  );
}

function BaseInformationRowsCard({
  addLabel,
  field,
  hideTitle,
  phone = false,
  hideSingleLabel = false,
  onChange,
  readOnly,
  removeLabel,
  values,
}: {
  addLabel: string;
  field: LayoutField;
  hideTitle?: boolean;
  phone?: boolean;
  hideSingleLabel?: boolean;
  onChange: (values: string[]) => void;
  readOnly: boolean;
  removeLabel: string;
  values: string[];
}) {
  const ActionButton = phone ? MobileButton : Button;
  const rowsRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(values.length);
  useEffect(() => {
    if (phone && values.length > previousCount.current) {
      rowsRef.current?.lastElementChild?.querySelector("input")?.focus();
    }
    previousCount.current = values.length;
  }, [phone, values.length]);
  return (
    <section
      className={`${styles.rowsSection} ${
        hideTitle
          ? "min-w-0"
          : "rounded-xl border border-border/70 bg-card p-5 shadow-sm"
      }`}
    >
      {!hideTitle && (
        <div
          className={`flex items-center justify-between gap-3 ${styles.sectionHeader}`}
        >
          <h2 className="font-medium">{field.name}</h2>
          <ActionButton
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => onChange([...values, ""])}
          >
            <Plus />
            {addLabel}
          </ActionButton>
        </div>
      )}
      <div
        ref={rowsRef}
        className={`${hideTitle ? "grid gap-3" : "mt-4 grid gap-3"} ${styles.rows}`}
      >
        {values.map((value, index) => (
          <div
            className={`flex items-end gap-2 ${styles.repeatRow}`}
            key={`${field.id}-${index}`}
          >
            <BaseInformationInput
              id={`base-layout-${field.id}-${index}`}
              label={`${field.name} ${index + 1}`}
              phone={phone}
              hideLabel={phone && hideSingleLabel && values.length === 1}
              value={value}
              disabled={readOnly}
              onChange={(nextValue) => {
                const next = [...values];
                next[index] = nextValue;
                onChange(next);
              }}
            />
            {(!phone || values.length > 1) && (
              <ActionButton
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`${removeLabel} ${index + 1}`}
                disabled={readOnly || values.length <= 1}
                className={`text-muted-foreground hover:text-destructive ${styles.remove}`}
                onClick={() =>
                  onChange(values.filter((_, rowIndex) => rowIndex !== index))
                }
              >
                <X />
              </ActionButton>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function getBankGridClass(fieldCount: number) {
  switch (fieldCount) {
    case 1: {
      return "md:grid-cols-[minmax(0,1fr)_auto]";
    }
    case 2: {
      return "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]";
    }
    default: {
      return "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]";
    }
  }
}

function BankInformationRows({
  fields,
  phone = false,
  bankLabel,
  isSaving,
  onBanksChange,
  readOnly,
  removeLabel,
  values,
}: {
  fields: LayoutField[];
  phone?: boolean;
  bankLabel: string;
  isSaving: boolean;
  onBanksChange: (banks: ProjectConfirmationBaseInformation["banks"]) => void;
  readOnly: boolean;
  removeLabel: string;
  values: ConfirmationBaseInformationLayoutValues;
}) {
  const { banks } = values.baseInformation;
  const disabled = readOnly || isSaving;
  const banksRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(banks.length);
  useEffect(() => {
    if (phone && banks.length > previousCount.current) {
      banksRef.current?.lastElementChild
        ?.querySelector("input, textarea")
        ?.scrollIntoView?.({ block: "nearest" });
      banksRef.current?.lastElementChild
        ?.querySelector<HTMLInputElement>("input, textarea")
        ?.focus();
    }
    previousCount.current = banks.length;
  }, [banks.length, phone]);

  return (
    <div ref={banksRef} className={`grid gap-3 ${styles.banks}`}>
      {banks.map((bank, index) => (
        <div
          className={`grid gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 ${getBankGridClass(fields.length)} ${styles.bank}`}
          key={`base-layout-bank-${index}`}
          role={phone ? "group" : undefined}
          aria-label={phone ? `${bankLabel} ${index + 1}` : undefined}
        >
          {phone && banks.length > 1 && (
            <div className={styles.bankHeader}>
              <h3>
                {bankLabel} {index + 1}
              </h3>
              <MobileButton
                type="button"
                size="icon"
                variant="quiet"
                className={styles.remove}
                aria-label={`${removeLabel} ${bankLabel} ${index + 1}`}
                disabled={disabled}
                onClick={() =>
                  onBanksChange(
                    banks.filter((_, rowIndex) => rowIndex !== index)
                  )
                }
              >
                <Trash2 aria-hidden />
              </MobileButton>
            </div>
          )}
          {fields.map((field) => {
            const binding = field.binding as BankBinding;
            const key = bankKeys[binding];
            return (
              <BaseInformationInput
                key={field.id}
                label={field.name}
                phone={phone}
                multiline={binding === "recipientAddress"}
                value={bank[key]}
                disabled={disabled}
                id={`base-layout-bank-${field.id}-${index}`}
                onChange={(nextValue) => {
                  const nextBanks = [...banks];
                  nextBanks[index] = { ...nextBanks[index], [key]: nextValue };
                  onBanksChange(nextBanks);
                }}
              />
            );
          })}
          {!phone && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`${removeLabel} ${index + 1}`}
              disabled={disabled || banks.length <= 1}
              className="self-end text-muted-foreground hover:text-destructive"
              onClick={() =>
                onBanksChange(banks.filter((_, rowIndex) => rowIndex !== index))
              }
            >
              <X />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function getActiveCustomFields(
  layout: ConfirmationGeneralLayout,
  baseInformation: ProjectConfirmationBaseInformation
) {
  const existing = baseInformation.customFields ?? [];
  return layout.sections.flatMap((section) =>
    section.fields
      .filter((field) => field.binding === undefined)
      .map((field) => ({
        id: field.id,
        name: field.name,
        value: existing.find((item) => item.id === field.id)?.value ?? "",
      }))
  );
}

function getBaseInformationForLayout(
  layout: ConfirmationGeneralLayout,
  baseInformation: ProjectConfirmationBaseInformation
) {
  const hasCustomFields =
    baseInformation.customFields !== undefined ||
    layout.sections.some((section) =>
      section.fields.some((field) => field.binding === undefined)
    );
  return hasCustomFields
    ? {
        ...baseInformation,
        customFields: getActiveCustomFields(layout, baseInformation),
      }
    : baseInformation;
}

export function ConfirmationBaseInformationLayout({
  isSaving,
  layout,
  locale,
  onChange,
  readOnly,
  values,
}: ConfirmationBaseInformationLayoutProps) {
  const isZh = locale.startsWith("zh");
  const phone = useCompactViewport(767.98);
  const ActionButton = phone ? MobileButton : Button;
  const bankLabel = isZh ? "银行" : "Bank";
  const addLabel = isZh ? "新增一行" : "Add row";
  const removeLabel = isZh ? "移除" : "Remove";
  const addBankLabel = isZh ? "新增银行" : "Add bank";
  const emptyHint = isZh
    ? "至少保留一行，填写框可在函证内下拉选择或手工输入。"
    : "Keep at least one row; fields can be selected from these options or entered manually.";
  const inputDisabled = readOnly || isSaving;

  const updateBase = (patch: Partial<ProjectConfirmationBaseInformation>) => {
    onChange((current) => {
      const nextBaseInformation = {
        ...current.baseInformation,
        ...patch,
      };
      return {
        ...current,
        baseInformation: getBaseInformationForLayout(
          layout,
          nextBaseInformation
        ),
      };
    });
  };

  const activeCustomFields = getActiveCustomFields(
    layout,
    values.baseInformation
  );

  const updateCustomField = (field: LayoutField, value: string) => {
    onChange((current) => ({
      ...current,
      baseInformation: {
        ...current.baseInformation,
        customFields: getActiveCustomFields(
          layout,
          current.baseInformation
        ).map((item) => (item.id === field.id ? { ...item, value } : item)),
      },
    }));
  };

  return (
    <div className={`grid gap-5 ${styles.layout}`} lang={isZh ? "zh-CN" : "en"}>
      {layout.sections.map((section) => {
        const rowsFields = section.fields.filter(
          (field) =>
            field.binding === "clientName" || field.binding === "referenceCode"
        );
        const bankFields = section.fields.filter((field) =>
          isBankBinding(field.binding)
        );
        const headerRow =
          rowsFields.length === 1 && bankFields.length === 0
            ? rowsFields[0]
            : undefined;

        return (
          <section
            className={`rounded-xl border border-border/70 bg-card p-5 shadow-sm ${styles.section}`}
            key={section.id}
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-3 ${styles.sectionHeader}`}
            >
              <h2 className="font-medium">{section.name}</h2>
              {headerRow && (
                <ActionButton
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={inputDisabled}
                  onClick={() =>
                    updateBase(
                      headerRow.binding === "clientName"
                        ? {
                            clientNames: [
                              ...values.baseInformation.clientNames,
                              "",
                            ],
                          }
                        : {
                            references: [
                              ...values.baseInformation.references,
                              "",
                            ],
                          }
                    )
                  }
                >
                  <Plus />
                  {addLabel}
                </ActionButton>
              )}
              {bankFields.length > 0 && (
                <ActionButton
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={inputDisabled}
                  onClick={() =>
                    updateBase({
                      banks: [
                        ...values.baseInformation.banks,
                        { name: "", account: "", address: "" },
                      ],
                    })
                  }
                >
                  <Plus />
                  {addBankLabel}
                </ActionButton>
              )}
            </div>
            {bankFields.length > 0 && !phone && (
              <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
            )}
            <div className={`mt-4 grid gap-4 md:grid-cols-2 ${styles.fields}`}>
              {section.fields.map((field) => {
                const className =
                  getGeneralFieldColSpan(field) === 2
                    ? "min-w-0 md:col-span-2"
                    : "min-w-0";
                if (isBankBinding(field.binding)) {
                  // Mobile presents one bank tuple together, with one removal action.
                  // Desktop keeps the configured field-by-field column layout.
                  if (phone && field !== bankFields[0]) {
                    return null;
                  }
                  return (
                    <div className={className} key={field.id}>
                      <BankInformationRows
                        fields={phone ? bankFields : [field]}
                        phone={phone}
                        bankLabel={bankLabel}
                        isSaving={isSaving}
                        onBanksChange={(banks) => updateBase({ banks })}
                        readOnly={readOnly}
                        removeLabel={removeLabel}
                        values={values}
                      />
                    </div>
                  );
                }
                if (
                  field.binding === "clientName" ||
                  field.binding === "referenceCode"
                ) {
                  const rowValues =
                    field.binding === "clientName"
                      ? values.baseInformation.clientNames
                      : values.baseInformation.references;
                  return (
                    <div className={className} key={field.id}>
                      <BaseInformationRowsCard
                        addLabel={addLabel}
                        field={field}
                        hideTitle={field === headerRow}
                        phone={phone}
                        hideSingleLabel={
                          field === headerRow && field.name === section.name
                        }
                        values={rowValues}
                        readOnly={inputDisabled}
                        removeLabel={removeLabel}
                        onChange={(nextValues) =>
                          updateBase(
                            field.binding === "clientName"
                              ? { clientNames: nextValues }
                              : { references: nextValues }
                          )
                        }
                      />
                    </div>
                  );
                }
                const { binding } = field;
                if (isLegacyBinding(binding)) {
                  return (
                    <BaseInformationInput
                      className={className}
                      key={field.id}
                      id={`base-layout-${field.id}`}
                      label={field.name}
                      phone={phone}
                      value={values[legacyKeys[binding]]}
                      disabled={inputDisabled}
                      onChange={(nextValue) =>
                        onChange((current) => ({
                          ...current,
                          [legacyKeys[binding]]: nextValue,
                          baseInformation: getBaseInformationForLayout(
                            layout,
                            current.baseInformation
                          ),
                        }))
                      }
                    />
                  );
                }
                if (binding !== undefined) {
                  return null;
                }
                const customField = activeCustomFields.find(
                  (item) => item.id === field.id
                );
                return (
                  <BaseInformationInput
                    className={className}
                    key={field.id}
                    id={`custom-value-${field.id}`}
                    label={field.name}
                    phone={phone}
                    value={customField?.value ?? ""}
                    disabled={inputDisabled}
                    onChange={(nextValue) =>
                      updateCustomField(field, nextValue)
                    }
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
