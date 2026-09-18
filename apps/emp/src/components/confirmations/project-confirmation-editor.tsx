"use client";

import type {
  ConfirmationDraftPayload,
  ConfirmationDraftTemplateCode,
  ConfirmationType,
  ConfirmationTemplateTextStyle,
} from "@project-wing/shared";
import {
  CONFIRMATION_TEMPLATE_FONT_FAMILIES,
  CONFIRMATION_TEMPLATE_FONT_SIZES,
  DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
  isConfirmationCustomTemplateCode,
} from "@project-wing/shared";
import {
  UI_UNIT_LABELS,
  Button as SharedButton,
  ProjectWingPaginationFooter,
  StatefulMotionButton,
  MobileActionSheet,
  useCompactViewport,
} from "@project-wing/ui";
import type { MotionButtonState } from "@project-wing/ui";
import { useQuery } from "@tanstack/react-query";
import {
  Bold,
  ChevronDown,
  Download,
  ExternalLink,
  Italic,
  LockKeyhole,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Underline,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import type { Path, UseFormReturn } from "react-hook-form";

import { DocxViewerPreview } from "@/components/extend/docx-viewer";
import { PDFViewer } from "@/components/extend/pdf-viewer";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { api } from "../../api/client";
import type { ConfirmationInformationLibraryEntry } from "../../api/client";
import { getConfirmationInformationLibraryMatchCopy } from "../../i18n/dictionaries";
import type { Dictionary } from "../../i18n/dictionaries";
import { BankTemplateRequiredDialog } from "./bank-template-required-dialog";
import { ConfirmationDateField } from "./confirmation-date-field";
import {
  buildConfirmationInformationLibraryBindingChoices,
  getConfirmationInformationLibraryDisplayName,
} from "./confirmation-information-library-match";
import {
  CONFIRMATION_BASE_INFORMATION_BINDINGS,
  CONFIRMATION_INFORMATION_LIBRARY_BINDINGS,
} from "./confirmation-template-binding-options";
import {
  getConfirmationTemplateFieldTextStyleCss,
  getConfirmationTemplateFlexAlignmentCss,
} from "./confirmation-template-field-style";
import {
  getDocxFieldSourceCoverGeometry,
  resolveDocxFieldGeometry,
} from "./project-confirmation-docx-fields";
import type { DocxFieldAnchor } from "./project-confirmation-docx-fields";

import styles from "./project-confirmation-editor.module.css";

const EMPTY_DEFAULT_ARRAY: never[] = [];

type ConfirmationCopy = Dictionary["confirmations"];
export type ConfirmationDownloadFormat = "pdf";

export type ConfirmationDerivedValues = {
  balanceSheetDate: string;
  clientCode: string;
  clientName: string;
  confirmationCode: string;
  contactEmail: string;
  contactName: string;
  fiscalYear: string;
  picName: string;
  projectCode: string;
  projectName: string;
};

export type ConfirmationBaseInformationOptions = {
  customFields?: { id: string; name: string; value: string }[];

  clientNames?: string[];
  references?: string[];
  banks?: {
    name: string;
    account: string;
    address: string;
  }[];
};

export type ProjectConfirmationEditorProps = {
  copy: ConfirmationCopy;
  derivedValues: ConfirmationDerivedValues;
  baseInformationOptions?: ConfirmationBaseInformationOptions | null;
  draftPayload: ConfirmationDraftPayload | null;
  templateCode: ConfirmationDraftTemplateCode | null;
  confirmationType?: ConfirmationType | null;
  availableTemplateOptions?: {
    code: ConfirmationDraftTemplateCode;
    label: string;
  }[];
  templateLabelOptions?: {
    code: ConfirmationDraftTemplateCode;
    label: string;
  }[];
  locale?: string;
  isCreating?: boolean;
  isSaving?: boolean;
  isSubmitting?: boolean;
  readOnly?: boolean;
  validationErrors?: string[];
  toolbarStart?: ReactNode | ((stageActions: ReactNode) => ReactNode);
  onSave: (payload: ConfirmationDraftPayload) => void | Promise<void>;
  onSubmit: () => void;
  onTemplateSelect: (
    templateCode: ConfirmationDraftTemplateCode,
    bankEntryId?: string
  ) => void;
  onCustomTemplateSelect?: () => void;
  onUploadDocument?: () => void;
  onDeleteUploadedDocument?: () => void;
  onDeleteDocument?: () => void;
  onDownloadDocument?: (
    format: ConfirmationDownloadFormat,
    draftPayload?: ConfirmationDraftPayload
  ) => void | Promise<void>;
  onOpenDocument?: () => void;
  uploadedDocumentUrl?: string | null;
  uploadedDocumentDocxUrl?: string | null;
  uploadedDocumentError?: boolean;
  uploadedDocumentFileName?: string | null;
  uploadedDocumentMimeType?: string | null;
  uploadedDocumentUnsupported?: boolean;
  hasUploadedDocument?: boolean;
  preparedAction?: ReactNode;
};

type EditorValues = {
  accountNumber: string;
  auditorAddress: string;
  auditorName: string;
  authorizationAccount: string;
  bankBranch: string;
  bankName: string;
  confirmationInformationLibraryEntryId: string;
  companyHandlerName: string;
  companyHandlerPhone: string;
  companyHandlerTitle: string;
  companySignatureDate: string;
  clientName: string;
  counterpartyAddress: string;
  counterpartyAttention: string;
  counterpartyContact: string;
  counterpartyEmail: string;
  counterpartyPhone: string;
  draftNotes: string;
  micEmail: string;
  micName: string;
  micNameAndInitial: string;
  officeDate: string;
  picName: string;
  recipientAddress: string;
  recipientName: string;
  referenceCode: string;
  reportDate: string;
  receivingSupplement: string;
  replyAddress: string;
  replyContact: string;
  replyEmail: string;
  replyFax: string;
  replyPhone: string;
  replyPostalCode: string;
  salutation: string;
  yearEndDate: string;
};

type ConfirmationTemplateDesignField = {
  binding?: ConfirmationTemplateDesignFieldBinding;
  baseInformationBinding?: ConfirmationTemplateDesignFieldBinding;
  defaultChecked?: boolean;
  defaultValueSource?:
    | {
        binding: ConfirmationTemplateDesignFieldBinding;
        source: "BASE_INFORMATION" | "INFORMATION_LIBRARY";
      }
    | { source: "CUSTOM"; value: string }
    | { source: "SYSTEM"; value: "CURRENT_DATE" };
  id: string;
  informationLibraryBinding?: ConfirmationTemplateDesignFieldBinding;
  kind:
    | "TEXT"
    | "MULTILINE"
    | "NUMBER"
    | "DATE"
    | "CHECKBOX"
    | "SELECT"
    | "RADIO"
    | "STATIC_TEXT"
    | "MASK";
  name?: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  textStyle?: ConfirmationTemplateTextStyle;
  textAlign?: "left" | "center" | "right";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceRanges?: ConfirmationTemplateDesignFieldSourceRange[];
};

type ConfirmationTemplateDesignFieldSourceRange = {
  end: number;
  paragraphId?: string;
  paragraphOrdinal: number;
  paragraphXmlSha256: string;
  part: "word/document.xml";
  sourceText: string;
  start: number;
};

type ConfirmationTemplateDesignFieldBinding =
  | `custom:${string}`
  | "accountNumber"
  | "auditorAddress"
  | "auditorName"
  | "authorizationAccount"
  | "bankName"
  | "clientName"
  | "micEmail"
  | "micNameAndInitial"
  | "officeDate"
  | "recipientAddress"
  | "recipientName"
  | "referenceCode"
  | "picName"
  | "micName"
  | "reportDate"
  | "salutation"
  | "yearEndDate";

type ConfirmationTemplateDesign = {
  version: 1;
  fields: ConfirmationTemplateDesignField[];
};

type TemplateFieldValues = Record<string, string>;
type TemplateFieldBindingValues = Record<
  ConfirmationTemplateDesignFieldBinding,
  string
>;
type InformationLibraryBindingChoices = Partial<
  Record<ConfirmationTemplateDesignFieldBinding, string[]>
>;

const TEMPLATE_FIELD_BINDINGS = new Set<ConfirmationTemplateDesignFieldBinding>(
  CONFIRMATION_BASE_INFORMATION_BINDINGS
);
const INFORMATION_LIBRARY_FIELD_BINDINGS =
  new Set<ConfirmationTemplateDesignFieldBinding>(
    CONFIRMATION_INFORMATION_LIBRARY_BINDINGS
  );

const TEMPLATE_CODES: ConfirmationDraftTemplateCode[] = [
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
];
const BANK_TEMPLATE_CODES = new Set<ConfirmationDraftTemplateCode>([
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
]);
const TEMPLATE_CATALOG_VERSION = "managed-confirmation-templates-v2";
const STANDARD_TEMPLATE_LAYOUT_VERSION = "standard-financial-institution-v3";
const SECURITIES_TEMPLATE_LAYOUT_VERSION = "securities-confirmation-v1";
const AUTO_SAVE_DELAY_MS = 250;
const MANAGED_OVERLAY_TEXT_CLASS = styles.managedOverlayText;
const MANAGED_OVERLAY_LONG_TEXT_CLASS = styles.managedOverlayLongText;

type AutoSaveStatus = "saved" | "pending" | "saving" | "error";

function getTemplateFieldTextStyleClassName(
  textStyle: ConfirmationTemplateTextStyle | undefined
) {
  const resolvedStyle = {
    ...DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
    ...textStyle,
  };
  return cn(
    resolvedStyle.bold ? "font-bold" : "font-normal",
    resolvedStyle.italic && "italic",
    resolvedStyle.underline && "underline",
    resolvedStyle.fontFamily === "Times New Roman" ? "font-serif" : "font-sans",
    resolvedStyle.fontSize === 10
      ? "text-xs"
      : resolvedStyle.fontSize === 14
        ? "text-base"
        : "text-sm"
  );
}

function getTemplateFieldTextStyle(
  value: unknown,
  kind: ConfirmationTemplateDesignField["kind"]
): ConfirmationTemplateTextStyle | undefined {
  if (kind === "MASK" || !isRecord(value)) {
    return undefined;
  }
  if (
    !["bold", "fontFamily", "fontSize", "italic", "underline"].every((key) =>
      Object.hasOwn(value, key)
    ) ||
    !Object.keys(value).every((key) =>
      [
        "backgroundColor",
        "bold",
        "fontFamily",
        "fontSize",
        "italic",
        "textColor",
        "underline",
      ].includes(key)
    ) ||
    typeof value.bold !== "boolean" ||
    typeof value.italic !== "boolean" ||
    typeof value.underline !== "boolean" ||
    !CONFIRMATION_TEMPLATE_FONT_FAMILIES.includes(
      value.fontFamily as (typeof CONFIRMATION_TEMPLATE_FONT_FAMILIES)[number]
    ) ||
    !CONFIRMATION_TEMPLATE_FONT_SIZES.includes(
      value.fontSize as (typeof CONFIRMATION_TEMPLATE_FONT_SIZES)[number]
    ) ||
    (value.textColor !== undefined &&
      (typeof value.textColor !== "string" ||
        !/^#[0-9A-Fa-f]{6}$/u.test(value.textColor))) ||
    (value.backgroundColor !== undefined &&
      (typeof value.backgroundColor !== "string" ||
        (value.backgroundColor !== "transparent" &&
          !/^#[0-9A-Fa-f]{6}$/u.test(value.backgroundColor))))
  ) {
    return undefined;
  }
  return {
    ...(value.backgroundColor
      ? { backgroundColor: value.backgroundColor }
      : {}),
    bold: value.bold,
    fontFamily: value.fontFamily as ConfirmationTemplateTextStyle["fontFamily"],
    fontSize: value.fontSize as ConfirmationTemplateTextStyle["fontSize"],
    italic: value.italic,
    ...(value.textColor ? { textColor: value.textColor } : {}),
    underline: value.underline,
  };
}

function baseInformationChoices(
  fieldName: string,
  options: ConfirmationBaseInformationOptions | null | undefined
) {
  if (!options) {
    return [];
  }
  if (fieldName.startsWith("custom:")) {
    return (
      options.customFields
        ?.filter((field) => `custom:${field.id}` === fieldName)
        .map((field) => field.value)
        .filter(Boolean) ?? []
    );
  }
  const banks = options.banks ?? [];
  const values =
    fieldName === "clientName"
      ? (options.clientNames ?? [])
      : fieldName === "referenceCode"
        ? (options.references ?? [])
        : fieldName === "bankName"
          ? banks.map((bank) => bank.name)
          : fieldName === "recipientName"
            ? banks.map((bank) => bank.name)
            : fieldName === "accountNumber"
              ? banks.map((bank) => bank.account)
              : fieldName === "recipientAddress"
                ? banks.map((bank) => bank.address)
                : [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function baseInformationListId(scope: string, fieldName: string) {
  return `confirmation-base-information-${scope}-${fieldName}`;
}

function isOverlayEditableTemplate(code: ConfirmationDraftTemplateCode) {
  return (
    code === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH" ||
    code === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1" ||
    code === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2"
  );
}

function isActiveTemplateCode(code: ConfirmationDraftTemplateCode) {
  return (
    TEMPLATE_CODES.includes(code) || isConfirmationCustomTemplateCode(code)
  );
}

function useStableDraftPayload(draftPayload: ConfirmationDraftPayload | null) {
  const serialized = JSON.stringify(draftPayload);
  return useMemo(
    () => JSON.parse(serialized) as ConfirmationDraftPayload | null,
    [serialized]
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTemplateFieldBinding(
  value: unknown,
  bindings: ReadonlySet<ConfirmationTemplateDesignFieldBinding> = TEMPLATE_FIELD_BINDINGS
): ConfirmationTemplateDesignFieldBinding | undefined {
  return typeof value === "string" &&
    (bindings.has(value as ConfirmationTemplateDesignFieldBinding) ||
      (bindings !== INFORMATION_LIBRARY_FIELD_BINDINGS &&
        /^custom:[a-zA-Z0-9-]{1,80}$/.test(value)))
    ? (value as ConfirmationTemplateDesignFieldBinding)
    : undefined;
}

function getTemplateFieldDefaultValueSource(
  value: unknown,
  kind: unknown
): ConfirmationTemplateDesignField["defaultValueSource"] | undefined {
  if (
    kind !== "STATIC_TEXT" &&
    kind !== "MASK" &&
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.source === "CUSTOM" &&
    typeof value.value === "string" &&
    value.value.length <= 10_000
  ) {
    return { source: "CUSTOM", value: value.value };
  }
  if (
    kind === "DATE" &&
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.source === "SYSTEM" &&
    value.value === "CURRENT_DATE"
  ) {
    return { source: "SYSTEM", value: "CURRENT_DATE" };
  }
  if (
    (kind !== "TEXT" && kind !== "MULTILINE") ||
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    (value.source !== "BASE_INFORMATION" &&
      value.source !== "INFORMATION_LIBRARY")
  ) {
    return undefined;
  }
  const binding = getTemplateFieldBinding(
    value.binding,
    value.source === "INFORMATION_LIBRARY"
      ? INFORMATION_LIBRARY_FIELD_BINDINGS
      : TEMPLATE_FIELD_BINDINGS
  );
  return binding ? { binding, source: value.source } : undefined;
}

function getActiveTemplateFieldBinding(field: ConfirmationTemplateDesignField) {
  return (
    field.baseInformationBinding ??
    field.informationLibraryBinding ??
    field.binding
  );
}

function getTemplateFieldRelationDefaultValueSource(
  field: ConfirmationTemplateDesignField
) {
  const source = field.defaultValueSource;
  return source?.source === "BASE_INFORMATION" ||
    source?.source === "INFORMATION_LIBRARY"
    ? source
    : undefined;
}

function hasTemplateFieldBinding(field: ConfirmationTemplateDesignField) {
  return Boolean(getActiveTemplateFieldBinding(field));
}

function getTemplateFieldSourceRanges(
  value: unknown
): ConfirmationTemplateDesignFieldSourceRange[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const ranges = value.flatMap(
    (range): ConfirmationTemplateDesignFieldSourceRange[] => {
      if (!isRecord(range)) {
        return [];
      }
      const {
        end,
        paragraphId,
        paragraphOrdinal,
        paragraphXmlSha256,
        part,
        sourceText,
        start,
      } = range;
      if (
        part !== "word/document.xml" ||
        typeof paragraphOrdinal !== "number" ||
        !Number.isSafeInteger(paragraphOrdinal) ||
        paragraphOrdinal < 0 ||
        (paragraphId !== undefined &&
          (typeof paragraphId !== "string" || !paragraphId.trim())) ||
        typeof paragraphXmlSha256 !== "string" ||
        !/^[a-f0-9]{64}$/i.test(paragraphXmlSha256) ||
        typeof sourceText !== "string" ||
        !sourceText ||
        typeof start !== "number" ||
        typeof end !== "number" ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        end <= start ||
        end - start !== sourceText.length
      ) {
        return [];
      }
      return [
        {
          end,
          ...(typeof paragraphId === "string" ? { paragraphId } : {}),
          paragraphOrdinal,
          paragraphXmlSha256,
          part,
          sourceText,
          start,
        },
      ];
    }
  );

  return ranges.length === value.length && ranges.length > 0
    ? ranges
    : undefined;
}

function getTemplateDesignSchema(
  draftPayload: ConfirmationDraftPayload | null
): ConfirmationTemplateDesign | null {
  if (!isRecord(draftPayload)) {
    return null;
  }
  const value = draftPayload.templateDesignSchema;
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.fields)) {
    return null;
  }
  const fields: ConfirmationTemplateDesignField[] = value.fields.flatMap(
    (field): ConfirmationTemplateDesignField[] => {
      if (!isRecord(field)) {
        return [];
      }
      const {
        binding,
        baseInformationBinding,
        defaultChecked,
        defaultValueSource,
        id,
        informationLibraryBinding,
        kind,
        name,
        placeholder,
        options,
        required,
        page,
        x,
        y,
        width,
        height,
        sourceRanges,
        textAlign,
        textStyle,
      } = field;
      const normalizedBinding = getTemplateFieldBinding(binding);
      const normalizedBaseInformationBinding = getTemplateFieldBinding(
        baseInformationBinding
      );
      const normalizedInformationLibraryBinding = getTemplateFieldBinding(
        informationLibraryBinding,
        INFORMATION_LIBRARY_FIELD_BINDINGS
      );
      const normalizedDefaultValueSource = getTemplateFieldDefaultValueSource(
        defaultValueSource,
        kind
      );
      const legacyRelationDefaultValueSource =
        normalizedDefaultValueSource?.source === "BASE_INFORMATION" ||
        normalizedDefaultValueSource?.source === "INFORMATION_LIBRARY"
          ? normalizedDefaultValueSource
          : undefined;
      const migratedBaseInformationBinding =
        legacyRelationDefaultValueSource?.source === "BASE_INFORMATION"
          ? legacyRelationDefaultValueSource.binding
          : undefined;
      const migratedInformationLibraryBinding =
        legacyRelationDefaultValueSource?.source === "INFORMATION_LIBRARY"
          ? legacyRelationDefaultValueSource.binding
          : undefined;
      const normalizedMigratedBaseInformationBinding =
        normalizedBaseInformationBinding ?? migratedBaseInformationBinding;
      const normalizedMigratedInformationLibraryBinding =
        normalizedInformationLibraryBinding ??
        migratedInformationLibraryBinding;
      const normalizedMigratedDefaultValueSource =
        legacyRelationDefaultValueSource
          ? undefined
          : normalizedDefaultValueSource;
      const normalizedSourceRanges = getTemplateFieldSourceRanges(sourceRanges);
      const normalizedKind = kind as ConfirmationTemplateDesignField["kind"];
      const normalizedTextStyle = getTemplateFieldTextStyle(
        textStyle,
        normalizedKind
      );
      if (
        typeof id !== "string" ||
        !id.trim() ||
        (kind !== "TEXT" &&
          kind !== "MULTILINE" &&
          kind !== "NUMBER" &&
          kind !== "DATE" &&
          kind !== "CHECKBOX" &&
          kind !== "SELECT" &&
          kind !== "RADIO" &&
          kind !== "STATIC_TEXT" &&
          kind !== "MASK") ||
        typeof page !== "number" ||
        !Number.isInteger(page) ||
        page < 1 ||
        typeof x !== "number" ||
        typeof y !== "number" ||
        typeof width !== "number" ||
        typeof height !== "number" ||
        ![x, y, width, height].every(Number.isFinite) ||
        x < 0 ||
        y < 0 ||
        width <= 0 ||
        height <= 0 ||
        x + width > 1 ||
        y + height > 1 ||
        (name !== undefined && typeof name !== "string") ||
        (placeholder !== undefined && typeof placeholder !== "string") ||
        (options !== undefined &&
          (!Array.isArray(options) ||
            !options.every((option) => typeof option === "string"))) ||
        (binding !== undefined &&
          ((kind !== "TEXT" && kind !== "MULTILINE") ||
            normalizedBinding === undefined)) ||
        (baseInformationBinding !== undefined &&
          ((kind !== "TEXT" && kind !== "MULTILINE") ||
            normalizedBaseInformationBinding === undefined)) ||
        (informationLibraryBinding !== undefined &&
          ((kind !== "TEXT" && kind !== "MULTILINE") ||
            normalizedInformationLibraryBinding === undefined)) ||
        (defaultValueSource !== undefined &&
          normalizedDefaultValueSource === undefined) ||
        (legacyRelationDefaultValueSource &&
          (binding !== undefined ||
            baseInformationBinding !== undefined ||
            informationLibraryBinding !== undefined)) ||
        (textAlign !== undefined &&
          textAlign !== "left" &&
          textAlign !== "center" &&
          textAlign !== "right") ||
        (defaultChecked !== undefined &&
          (kind !== "CHECKBOX" || typeof defaultChecked !== "boolean")) ||
        (required !== undefined &&
          (kind !== "CHECKBOX" || typeof required !== "boolean"))
      ) {
        return [];
      }
      const normalizedOptions = Array.isArray(options)
        ? options.map((option) => option.trim())
        : [];
      if (
        normalizedDefaultValueSource?.source === "CUSTOM" &&
        !isValidEditorCustomDefaultFillValue(
          normalizedKind,
          normalizedDefaultValueSource.value,
          normalizedOptions
        )
      ) {
        return [];
      }
      return [
        {
          ...(normalizedKind === "CHECKBOX" &&
          typeof defaultChecked === "boolean"
            ? { defaultChecked }
            : {}),
          ...(normalizedMigratedDefaultValueSource
            ? { defaultValueSource: normalizedMigratedDefaultValueSource }
            : {}),
          id: id.trim(),
          kind: normalizedKind,
          ...(typeof name === "string" ? { name } : {}),
          ...(typeof placeholder === "string" ? { placeholder } : {}),
          ...(Array.isArray(options) ? { options: normalizedOptions } : {}),
          ...(normalizedKind === "CHECKBOX" && typeof required === "boolean"
            ? { required }
            : {}),
          ...(normalizedTextStyle ? { textStyle: normalizedTextStyle } : {}),
          ...(textAlign ? { textAlign } : {}),
          ...(normalizedBinding ? { binding: normalizedBinding } : {}),
          ...(normalizedMigratedBaseInformationBinding
            ? {
                baseInformationBinding:
                  normalizedMigratedBaseInformationBinding,
              }
            : {}),
          ...(normalizedMigratedInformationLibraryBinding
            ? {
                informationLibraryBinding:
                  normalizedMigratedInformationLibraryBinding,
              }
            : {}),
          ...(normalizedSourceRanges
            ? { sourceRanges: normalizedSourceRanges }
            : {}),
          page,
          x,
          y,
          width,
          height,
        },
      ];
    }
  );
  return { version: 1, fields };
}

function getTemplateFieldValues(
  draftPayload: ConfirmationDraftPayload | null
): TemplateFieldValues {
  if (!isRecord(draftPayload) || !isRecord(draftPayload.templateFieldValues)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(draftPayload.templateFieldValues).filter(
      ([, value]) => typeof value === "string"
    )
  ) as TemplateFieldValues;
}

function isRequiredCheckboxSatisfied(
  field: ConfirmationTemplateDesignField,
  value: string | undefined
) {
  return (
    (value ?? (field.defaultChecked === true ? "true" : "false")) === "true"
  );
}

function getCurrentDateInputValue(value = new Date()) {
  const localTime = new Date(
    value.getTime() - value.getTimezoneOffset() * 60_000
  );
  return localTime.toISOString().slice(0, 10);
}

function getTemplateDefaultFillValue(field: ConfirmationTemplateDesignField) {
  const source = field.defaultValueSource;
  if (!source) {
    return;
  }
  return source.source === "SYSTEM"
    ? getCurrentDateInputValue()
    : source.source === "CUSTOM"
      ? source.value
      : undefined;
}

function isValidEditorCustomDefaultFillValue(
  kind: ConfirmationTemplateDesignField["kind"],
  value: string,
  options: string[]
) {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }
  if (kind === "NUMBER") {
    return /^-?(?:\d+|\d*\.\d+)$/u.test(normalized);
  }
  if (kind === "DATE") {
    return (
      /^\d{4}-\d{2}-\d{2}$/u.test(normalized) &&
      !Number.isNaN(Date.parse(normalized))
    );
  }
  if (kind === "RADIO" || kind === "SELECT") {
    return options.includes(normalized);
  }
  if (kind === "CHECKBOX") {
    return normalized === "true" || normalized === "false";
  }
  return kind === "TEXT" || kind === "MULTILINE";
}

function getTemplateAvailableCodesSnapshot(
  draftPayload: ConfirmationDraftPayload | null
): ConfirmationDraftTemplateCode[] | undefined {
  if (
    !isRecord(draftPayload) ||
    !Array.isArray(draftPayload.templateAvailableCodes)
  ) {
    return undefined;
  }
  return draftPayload.templateAvailableCodes.filter(
    (code): code is ConfirmationDraftTemplateCode =>
      typeof code === "string" &&
      (TEMPLATE_CODES.includes(code as ConfirmationDraftTemplateCode) ||
        isConfirmationCustomTemplateCode(code))
  );
}

function getAvailableTemplateCodes(
  draftPayload: ConfirmationDraftPayload | null,
  optionCodes: ConfirmationDraftTemplateCode[],
  confirmationType?: ConfirmationType | null
) {
  const matchesConfirmationType = (code: ConfirmationDraftTemplateCode) => {
    if (!confirmationType) {
      return true;
    }
    if (
      code === "STANDARD_FINANCIAL_INSTITUTION" ||
      code === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
    ) {
      return confirmationType === "BANK";
    }
    if (
      code === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1" ||
      code === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2"
    ) {
      return confirmationType === "INTERMEDIARY";
    }
    if (isConfirmationCustomTemplateCode(code)) {
      const customType = code.match(
        /^CTPL-(BANK|BALANCE|RELATED_PARTY|LAWYER|INVENTORY|INTERMEDIARY|OTHER|UNCLASSIFIED)-/
      )?.[1];
      return !customType || customType === confirmationType;
    }
    return true;
  };
  const snapshot = getTemplateAvailableCodesSnapshot(draftPayload);
  const allowedCodes = new Set(optionCodes.filter(matchesConfirmationType));
  const available = snapshot
    ? snapshot.filter(
        (code) => matchesConfirmationType(code) && allowedCodes.has(code)
      )
    : [...allowedCodes];
  for (const code of optionCodes) {
    if (
      matchesConfirmationType(code) &&
      isActiveTemplateCode(code) &&
      !available.includes(code)
    ) {
      available.push(code);
    }
  }
  return available;
}

export function ProjectConfirmationEditor({
  copy,
  derivedValues,
  baseInformationOptions,
  draftPayload,
  templateCode,
  confirmationType,
  locale = "en-US",
  isCreating = false,
  isSaving = false,
  isSubmitting = false,
  readOnly = false,
  validationErrors = EMPTY_DEFAULT_ARRAY,
  toolbarStart,
  onSave,
  onSubmit,
  onTemplateSelect,
  availableTemplateOptions = EMPTY_DEFAULT_ARRAY,
  templateLabelOptions = EMPTY_DEFAULT_ARRAY,
  onCustomTemplateSelect,
  onUploadDocument,
  onDeleteUploadedDocument,
  onDeleteDocument,
  onDownloadDocument,
  onOpenDocument,
  uploadedDocumentUrl,
  uploadedDocumentDocxUrl,
  uploadedDocumentError = false,
  uploadedDocumentFileName,
  uploadedDocumentMimeType,
  uploadedDocumentUnsupported = false,
  hasUploadedDocument = false,
  preparedAction,
}: ProjectConfirmationEditorProps) {
  const [informationLibraryOpen, setInformationLibraryOpen] = useState(false);
  const phone = useCompactViewport(767.98);
  const [mobileDocumentActionsOpen, setMobileDocumentActionsOpen] =
    useState(false);
  const [selectedInformationLibraryEntry, setSelectedInformationLibraryEntry] =
    useState<ConfirmationInformationLibraryEntry | null>(null);
  const stableDraftPayload = useStableDraftPayload(draftPayload);
  const activeTemplateCode =
    templateCode && isActiveTemplateCode(templateCode) ? templateCode : null;
  const [templateDesignSchema, setTemplateDesignSchema] =
    useState<ConfirmationTemplateDesign | null>(() =>
      getTemplateDesignSchema(stableDraftPayload)
    );
  const availableTemplateCodes = getAvailableTemplateCodes(
    stableDraftPayload,
    availableTemplateOptions.map((option) => option.code),
    confirmationType
  );
  const templateLabels = new Map<ConfirmationDraftTemplateCode, string>(
    templateLabelOptions.map((option) => [option.code, option.label])
  );
  for (const option of availableTemplateOptions) {
    templateLabels.set(option.code, option.label);
  }
  const form = useForm<EditorValues>({
    defaultValues: getEditorValues(stableDraftPayload, derivedValues),
  });
  const [templateFieldValues, setTemplateFieldValues] =
    useState<TemplateFieldValues>(() =>
      getTemplateFieldValues(stableDraftPayload)
    );
  const [templateFieldsDirty, setTemplateFieldsDirty] = useState(false);
  const [checkboxValidationAttempted, setCheckboxValidationAttempted] =
    useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("saved");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveInFlightRef = useRef<Promise<void> | null>(null);
  const autoSavePendingRef = useRef(false);
  const autoSaveRevisionRef = useRef(0);
  const localChangesRef = useRef(false);
  const suppressAutoSaveRef = useRef(false);
  const lastPersistedPayloadKeyRef = useRef("");
  const latestPayloadRef = useRef<ConfirmationDraftPayload>({});
  const latestPayloadKeyRef = useRef("");
  const scheduleAutoSaveRef = useRef<(delay?: number) => void>(() => {});
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const stableDraftPayloadRef = useRef(stableDraftPayload);
  stableDraftPayloadRef.current = stableDraftPayload;
  const templateDesignSchemaRef = useRef(templateDesignSchema);
  templateDesignSchemaRef.current = templateDesignSchema;
  const templateFieldValuesRef = useRef(templateFieldValues);
  templateFieldValuesRef.current = templateFieldValues;
  const appliedInformationLibraryEntryId = form.watch(
    "confirmationInformationLibraryEntryId"
  );
  const appliedBankName = form.watch("bankName");
  const [appliedBankDisplayName, setAppliedBankDisplayName] = useState(
    () => appliedBankName
  );
  const previousAppliedInformationLibraryEntryIdRef = useRef(
    appliedInformationLibraryEntryId
  );
  useEffect(() => {
    if (
      previousAppliedInformationLibraryEntryIdRef.current ===
      appliedInformationLibraryEntryId
    ) {
      return;
    }
    previousAppliedInformationLibraryEntryIdRef.current =
      appliedInformationLibraryEntryId;
    setAppliedBankDisplayName(appliedBankName);
  }, [appliedBankName, appliedInformationLibraryEntryId]);
  const storedInformationLibraryEntry = useQuery({
    queryKey: [
      "confirmation-information-library",
      "applied",
      appliedInformationLibraryEntryId,
    ],
    enabled: Boolean(
      appliedInformationLibraryEntryId &&
      selectedInformationLibraryEntry?.id !== appliedInformationLibraryEntryId
    ),
    queryFn: () =>
      api.confirmationInformationLibrary({
        entryId: appliedInformationLibraryEntryId,
        includeInactive: true,
      }),
  });
  const appliedInformationLibraryEntry =
    selectedInformationLibraryEntry?.id === appliedInformationLibraryEntryId
      ? selectedInformationLibraryEntry
      : (storedInformationLibraryEntry.data?.find(
          (entry) => entry.id === appliedInformationLibraryEntryId
        ) ?? null);
  useEffect(() => {
    if (!appliedInformationLibraryEntry) {
      return;
    }
    setAppliedBankDisplayName(
      getConfirmationInformationLibraryDisplayName(
        appliedInformationLibraryEntry,
        locale
      )
    );
  }, [appliedInformationLibraryEntry, locale]);
  const informationLibraryBindingChoices: InformationLibraryBindingChoices =
    appliedInformationLibraryEntry
      ? buildConfirmationInformationLibraryBindingChoices(
          appliedInformationLibraryEntry,
          locale
        )
      : {};
  const templateFieldBindingValues: TemplateFieldBindingValues = {
    ...Object.fromEntries(
      (baseInformationOptions?.customFields ?? []).map((field) => [
        `custom:${field.id}`,
        field.value,
      ])
    ),
    accountNumber: form.watch("accountNumber"),
    auditorAddress: form.watch("auditorAddress"),
    auditorName: form.watch("auditorName"),
    authorizationAccount: form.watch("authorizationAccount"),
    bankName: appliedBankName,
    clientName: form.watch("clientName"),
    micEmail: form.watch("micEmail"),
    micNameAndInitial: form.watch("micNameAndInitial"),
    officeDate: form.watch("officeDate"),
    recipientAddress: form.watch("recipientAddress"),
    recipientName: form.watch("recipientName"),
    referenceCode: form.watch("referenceCode"),
    picName: form.watch("picName"),
    micName: form.watch("micName"),
    reportDate: form.watch("reportDate"),
    salutation: form.watch("salutation"),
    yearEndDate: form.watch("yearEndDate"),
  };
  const templateDefaultFillValuesKey = JSON.stringify(
    templateFieldBindingValues
  );

  const currentDraftPayload = toDraftPayload(
    form.getValues(),
    stableDraftPayload,
    templateDesignSchema,
    templateFieldValues
  );
  latestPayloadRef.current = currentDraftPayload;
  latestPayloadKeyRef.current = JSON.stringify(currentDraftPayload);

  useEffect(() => {
    const nextValues = getEditorValues(stableDraftPayload, derivedValues);
    const nextTemplateFieldValues = getTemplateFieldValues(stableDraftPayload);
    const nextTemplateDesignSchema =
      getTemplateDesignSchema(stableDraftPayload);
    const nextPayload = toDraftPayload(
      nextValues,
      stableDraftPayload,
      nextTemplateDesignSchema,
      nextTemplateFieldValues
    );
    const nextPayloadKey = JSON.stringify(nextPayload);
    const hasNewerLocalChanges =
      localChangesRef.current &&
      latestPayloadKeyRef.current !== "" &&
      latestPayloadKeyRef.current !== nextPayloadKey;

    lastPersistedPayloadKeyRef.current = nextPayloadKey;
    if (hasNewerLocalChanges) {
      return;
    }

    suppressAutoSaveRef.current = true;
    form.reset(nextValues);
    suppressAutoSaveRef.current = false;
    setTemplateFieldValues(nextTemplateFieldValues);
    setTemplateDesignSchema(nextTemplateDesignSchema);
    setCheckboxValidationAttempted(false);
    setTemplateFieldsDirty(false);
    localChangesRef.current = false;
    setAutoSaveStatus("saved");
  }, [derivedValues, stableDraftPayload, form, templateCode]);

  const payload = () =>
    toDraftPayload(
      form.getValues(),
      stableDraftPayload,
      templateDesignSchema,
      templateFieldValues
    );

  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current === null) {
      return;
    }
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
  }, []);

  const runAutoSave = (
    pendingDraftPayload: ConfirmationDraftPayload,
    revision: number
  ) => {
    if (autoSaveInFlightRef.current) {
      autoSavePendingRef.current = true;
      return autoSaveInFlightRef.current;
    }

    setAutoSaveStatus("saving");
    const draftPayloadKey = JSON.stringify(pendingDraftPayload);
    const savePromise = (async () => {
      try {
        await onSaveRef.current(pendingDraftPayload);
        if (revision !== autoSaveRevisionRef.current) {
          return;
        }

        lastPersistedPayloadKeyRef.current = draftPayloadKey;
        localChangesRef.current = false;
        suppressAutoSaveRef.current = true;
        form.reset(form.getValues());
        suppressAutoSaveRef.current = false;
        setTemplateFieldsDirty(false);
        setAutoSaveStatus("saved");
      } catch {
        if (revision === autoSaveRevisionRef.current) {
          setAutoSaveStatus("error");
        }
      } finally {
        autoSaveInFlightRef.current = null;
        if (autoSavePendingRef.current) {
          autoSavePendingRef.current = false;
          scheduleAutoSaveRef.current();
        }
      }
    })();
    autoSaveInFlightRef.current = savePromise;
    return savePromise;
  };

  const scheduleAutoSave = (delay = AUTO_SAVE_DELAY_MS) => {
    if (!activeTemplateCode || isCreating || readOnly) {
      return;
    }

    localChangesRef.current = true;
    autoSaveRevisionRef.current += 1;
    setAutoSaveStatus("pending");
    clearAutoSaveTimer();
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      if (autoSaveInFlightRef.current) {
        autoSavePendingRef.current = true;
        return;
      }
      if (latestPayloadKeyRef.current === lastPersistedPayloadKeyRef.current) {
        localChangesRef.current = false;
        suppressAutoSaveRef.current = true;
        form.reset(form.getValues());
        suppressAutoSaveRef.current = false;
        setTemplateFieldsDirty(false);
        setAutoSaveStatus("saved");
        return;
      }
      void runAutoSave(latestPayloadRef.current, autoSaveRevisionRef.current);
    }, delay);
  };
  scheduleAutoSaveRef.current = scheduleAutoSave;

  const markAutoSavePending = useCallback(() => {
    if (!activeTemplateCode || isCreating || readOnly) {
      return;
    }
    localChangesRef.current = true;
    autoSaveRevisionRef.current += 1;
    clearAutoSaveTimer();
    setAutoSaveStatus("pending");
  }, [activeTemplateCode, isCreating, readOnly, clearAutoSaveTimer]);

  useEffect(() => {
    if (!templateDesignSchema || readOnly) {
      return;
    }
    const { current } = templateFieldValuesRef;
    const defaultBindingValues: TemplateFieldBindingValues = JSON.parse(
      templateDefaultFillValuesKey
    );
    const next = { ...current };
    let changed = false;
    for (const field of templateDesignSchema.fields) {
      if (Object.hasOwn(current, field.id)) {
        continue;
      }
      const binding = field.baseInformationBinding ?? field.binding;
      const defaultValue = binding?.startsWith("custom:")
        ? defaultBindingValues[binding]
        : getTemplateDefaultFillValue(field);
      if (defaultValue === undefined || defaultValue === "") {
        continue;
      }
      next[field.id] = defaultValue;
      changed = true;
    }
    if (!changed) {
      return;
    }
    templateFieldValuesRef.current = next;
    setTemplateFieldValues(next);
    setTemplateFieldsDirty(true);
    scheduleAutoSaveRef.current();
  }, [readOnly, templateDefaultFillValuesKey, templateDesignSchema]);

  useEffect(() => {
    if (!activeTemplateCode) {
      return;
    }
    const subscription = form.watch((_values, info) => {
      if (!info.name || suppressAutoSaveRef.current) {
        return;
      }
      const nextPayload = toDraftPayload(
        form.getValues(),
        stableDraftPayloadRef.current,
        templateDesignSchemaRef.current,
        templateFieldValuesRef.current
      );
      latestPayloadRef.current = nextPayload;
      latestPayloadKeyRef.current = JSON.stringify(nextPayload);
      markAutoSavePending();
    });
    return () => {
      subscription.unsubscribe();
      clearAutoSaveTimer();
    };
  }, [activeTemplateCode, form, markAutoSavePending, clearAutoSaveTimer]);

  const flushAutoSave = async (nextDraftPayload: ConfirmationDraftPayload) => {
    if (!activeTemplateCode || isCreating || readOnly) {
      return;
    }
    clearAutoSaveTimer();

    const draftPayloadKey = JSON.stringify(nextDraftPayload);
    if (
      draftPayloadKey === lastPersistedPayloadKeyRef.current &&
      !localChangesRef.current
    ) {
      return;
    }

    autoSaveRevisionRef.current += 1;
    localChangesRef.current = true;
    if (autoSaveInFlightRef.current) {
      autoSavePendingRef.current = true;
      await autoSaveInFlightRef.current;
      clearAutoSaveTimer();
    }

    if (
      draftPayloadKey === lastPersistedPayloadKeyRef.current &&
      !localChangesRef.current
    ) {
      return;
    }
    await runAutoSave(nextDraftPayload, autoSaveRevisionRef.current);
  };

  const requestDocumentDownload = async (
    format: ConfirmationDownloadFormat
  ) => {
    const draftToApply = activeTemplateCode ? payload() : undefined;
    if (draftToApply) {
      await flushAutoSave(draftToApply);
    }
    await onDownloadDocument?.(format, draftToApply);
  };

  const pending = isCreating || isSaving || isSubmitting;
  const draftDirty = form.formState.isDirty || templateFieldsDirty;
  const missingRequiredCheckboxes =
    templateDesignSchema?.fields.filter(
      (field) =>
        field.kind === "CHECKBOX" &&
        field.required === true &&
        !isRequiredCheckboxSatisfied(field, templateFieldValues[field.id])
    ) ?? [];
  const checkboxValidationErrors = checkboxValidationAttempted
    ? missingRequiredCheckboxes.map((field) =>
        copy.requiredCheckbox.replace(
          "{name}",
          field.placeholder || field.name || field.id
        )
      )
    : [];
  const displayedValidationErrors = [
    ...validationErrors,
    ...checkboxValidationErrors,
  ];
  const handleSubmit = () => {
    if (missingRequiredCheckboxes.length > 0) {
      setCheckboxValidationAttempted(true);
      return;
    }
    setCheckboxValidationAttempted(false);
    onSubmit();
  };
  const autoSaveButtonState: MotionButtonState =
    autoSaveStatus === "error"
      ? "error"
      : isSaving || autoSaveStatus === "saving" || autoSaveStatus === "pending"
        ? "loading"
        : "success";

  const handleTemplateFieldChange = (
    field: ConfirmationTemplateDesignField,
    value: string,
    commit = false
  ) => {
    const { current } = templateFieldValuesRef;
    if (current[field.id] === value) {
      if (commit && localChangesRef.current) {
        scheduleAutoSaveRef.current(0);
      }
      return;
    }
    const next = { ...current, [field.id]: value };
    templateFieldValuesRef.current = next;
    setTemplateFieldValues(next);
    const nextPayload = toDraftPayload(
      form.getValues(),
      stableDraftPayloadRef.current,
      templateDesignSchemaRef.current,
      next
    );
    latestPayloadRef.current = nextPayload;
    latestPayloadKeyRef.current = JSON.stringify(nextPayload);
    setTemplateFieldsDirty(true);
    if (commit) {
      scheduleAutoSaveRef.current(0);
    } else {
      markAutoSavePending();
    }
  };

  const handleTemplateFieldTextStyleChange = (
    fieldId: string,
    patch: Partial<ConfirmationTemplateTextStyle>
  ) => {
    setTemplateDesignSchema((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.id === fieldId
                ? {
                    ...field,
                    textStyle: {
                      ...DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
                      ...field.textStyle,
                      ...patch,
                    },
                  }
                : field
            ),
          }
        : current
    );
    setTemplateFieldsDirty(true);
    scheduleAutoSaveRef.current();
  };

  const updateInformationLibraryDraft = (patch: Partial<EditorValues>) => {
    for (const [name, value] of Object.entries(patch)) {
      form.setValue(name as Path<EditorValues>, value ?? "", {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  };
  const informationLibraryAction =
    confirmationType === "BANK" ||
    ((confirmationType === null || confirmationType === undefined) &&
      activeTemplateCode &&
      BANK_TEMPLATE_CODES.has(activeTemplateCode)) ? (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={styles.bankLookup}
          aria-label={copy.informationLibraryMatch.bankLookup}
          aria-expanded={informationLibraryOpen}
          aria-haspopup="dialog"
          disabled={pending || readOnly}
          onClick={() => setInformationLibraryOpen(true)}
        >
          <Search className="size-4" />
          {copy.informationLibraryMatch.bankLookup}
        </Button>
        {appliedInformationLibraryEntryId && appliedBankDisplayName.trim() ? (
          <div
            className={cn(
              "flex max-w-72 items-center gap-1 rounded-md bg-muted py-0.5 ps-2 pe-1 text-xs text-muted-foreground",
              styles.appliedBank
            )}
          >
            <span className="truncate" title={appliedBankDisplayName}>
              {copy.informationLibraryMatch.appliedBank.replace(
                "{bank}",
                appliedBankDisplayName
              )}
            </span>
            <SharedButton
              variant="quiet"
              size="icon-sm"
              type="button"
              className="flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={copy.informationLibraryMatch.clear}
              title={copy.informationLibraryMatch.clear}
              disabled={pending || readOnly}
              onClick={() => {
                updateInformationLibraryDraft({
                  confirmationInformationLibraryEntryId: "",
                });
                setSelectedInformationLibraryEntry(null);
                setAppliedBankDisplayName("");
                scheduleAutoSaveRef.current();
              }}
            >
              <X className="size-3" />
            </SharedButton>
          </div>
        ) : null}
      </>
    ) : null;
  const templateControl = (
    <div
      className={cn("flex min-w-0 items-center gap-2", styles.templateControl)}
    >
      <Label className="shrink-0" htmlFor="confirmation-template">
        {copy.draftTemplate}
      </Label>
      <TemplateSelect
        locale={locale}
        copy={copy}
        disabled={pending || readOnly}
        availableCodes={availableTemplateCodes}
        labels={templateLabels}
        customUploadSelected={Boolean(
          hasUploadedDocument && !activeTemplateCode
        )}
        value={activeTemplateCode}
        onCustomTemplateSelect={onCustomTemplateSelect}
        onValueChange={(code) =>
          activeTemplateCode
            ? onTemplateSelect(code)
            : onTemplateSelect(
                code,
                form.getValues("confirmationInformationLibraryEntryId")
              )
        }
      />
    </div>
  );
  const documentActions = activeTemplateCode ? (
    preparedAction ? (
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ConfirmationDownloadButton
          copy={copy}
          disabled={pending}
          onDownload={requestDocumentDownload}
        />
        {preparedAction}
      </div>
    ) : (
      <ButtonGroup className="ml-auto shrink-0">
        <StatefulMotionButton
          aria-label={
            autoSaveButtonState === "loading"
              ? copy.autoSaveSaving
              : autoSaveButtonState === "error"
                ? copy.autoSaveError
                : copy.autoSaveSaved
          }
          aria-disabled="true"
          className="pointer-events-none h-7 shrink-0 cursor-default px-2 text-xs! [&_.lucide-x]:text-destructive [&_svg]:size-3.5"
          data-testid="confirmation-auto-save-status"
          size="sm"
          state={autoSaveButtonState}
          tabIndex={-1}
          variant="ghost"
          loadingText={copy.autoSaveSaving}
          successText={copy.autoSaveSaved}
          errorText={copy.autoSaveError}
        >
          {copy.autoSaveSaved}
        </StatefulMotionButton>
        <Button
          type="button"
          variant="outline"
          disabled={pending || readOnly}
          onClick={onDeleteDocument}
        >
          <Trash2 className="size-4" />
          {copy.deleteUploadedDocument}
        </Button>
        <ConfirmationDownloadButton
          copy={copy}
          disabled={pending}
          onDownload={requestDocumentDownload}
        />
        <Button
          type="button"
          disabled={pending || readOnly || draftDirty}
          onClick={handleSubmit}
        >
          <LockKeyhole className="size-4" />
          {copy.submitConfirmation}
        </Button>
      </ButtonGroup>
    )
  ) : (
    <>
      {hasUploadedDocument && !readOnly ? (
        <ButtonGroup className="ml-auto shrink-0">
          {onUploadDocument ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onUploadDocument}
              className="cursor-pointer hover:border-primary hover:bg-primary/10 hover:text-primary"
            >
              <Upload />
              {copy.tracking.responseAddFiles}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={pending || readOnly}
            onClick={onDeleteDocument ?? onDeleteUploadedDocument}
          >
            <Trash2 className="size-4" />
            {copy.deleteUploadedDocument}
          </Button>
          {uploadedDocumentUnsupported ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              aria-label={copy.downloadConfirmation}
              onClick={() => {
                requestDocumentDownload("pdf");
              }}
            >
              <Download className="size-4" />
              {copy.downloadConfirmation}
            </Button>
          ) : (
            <ConfirmationDownloadButton
              copy={copy}
              disabled={pending}
              onDownload={requestDocumentDownload}
            />
          )}
          <Button
            type="button"
            disabled={pending || readOnly}
            onClick={handleSubmit}
          >
            <LockKeyhole className="size-4" />
            {copy.submitConfirmation}
          </Button>
        </ButtonGroup>
      ) : onUploadDocument ? (
        <Button
          type="button"
          variant="outline"
          className="ml-auto shrink-0"
          disabled={pending || readOnly}
          onClick={onUploadDocument}
        >
          <Upload />
          {copy.newConfirmationDialog.uploadDocument}
        </Button>
      ) : null}
      {preparedAction ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ConfirmationDownloadButton
            copy={copy}
            disabled={pending}
            onDownload={requestDocumentDownload}
          />
          {preparedAction}
        </div>
      ) : null}
    </>
  );

  const stageActions = (
    <>
      {templateControl}
      {informationLibraryAction}
      {phone ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              locale === "zh-CN" ? "函证操作" : "Confirmation actions"
            }
            onClick={() => setMobileDocumentActionsOpen(true)}
          >
            <MoreHorizontal />
          </Button>
          <MobileActionSheet
            open={mobileDocumentActionsOpen}
            onOpenChange={setMobileDocumentActionsOpen}
            title={locale === "zh-CN" ? "函证操作" : "Confirmation actions"}
            closeLabel={locale === "zh-CN" ? "关闭" : "Close"}
          >
            <div className={styles.documentActionSheet}>{documentActions}</div>
          </MobileActionSheet>
        </>
      ) : (
        documentActions
      )}
    </>
  );

  const toolbar =
    typeof toolbarStart === "function" ? (
      toolbarStart(
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 overflow-x-auto",
            styles.stageActions
          )}
        >
          {stageActions}
        </div>
      )
    ) : (
      <div className="flex min-w-0 flex-col border-b border-border">
        {toolbarStart}
        <div
          data-testid="confirmation-detail-toolbar-actions"
          className={cn(
            "flex min-w-0 items-center gap-2 overflow-x-auto px-3 py-2",
            styles.stageActions
          )}
        >
          {stageActions}
        </div>
      </div>
    );

  const informationLibraryPanel = informationLibraryOpen ? (
    <BankInformationLibraryPanel
      copy={copy}
      locale={locale}
      onClose={() => setInformationLibraryOpen(false)}
      onSelect={(entry) => {
        setSelectedInformationLibraryEntry(entry);
        setAppliedBankDisplayName(
          getConfirmationInformationLibraryDisplayName(entry, locale)
        );
        updateInformationLibraryDraft({
          confirmationInformationLibraryEntryId: entry.id,
        });
        scheduleAutoSaveRef.current();
        setInformationLibraryOpen(false);
      }}
    />
  ) : null;

  if (!activeTemplateCode) {
    return (
      <div
        className={cn(
          "relative grid h-full min-h-0 gap-0",
          styles.editorPreviewLayout
        )}
      >
        {toolbar}
        {informationLibraryPanel}
        {uploadedDocumentUnsupported ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <p>{copy.uploadedDocumentUnsupported}</p>
            {uploadedDocumentFileName ? (
              <p className="font-mono text-xs">{uploadedDocumentFileName}</p>
            ) : null}
            {uploadedDocumentMimeType ? (
              <p className="text-xs">{uploadedDocumentMimeType}</p>
            ) : null}
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                disabled={!onDownloadDocument || pending}
                onClick={() => {
                  requestDocumentDownload("pdf");
                }}
              >
                <Download className="size-4" />
                {copy.downloadOriginalFile}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!onOpenDocument || pending}
                onClick={onOpenDocument}
              >
                <ExternalLink className="size-4" />
                {copy.openOriginalFile}
              </Button>
            </ButtonGroup>
          </div>
        ) : uploadedDocumentUrl ? (
          <PDFViewer
            autoFitWidth
            className="h-full min-h-0"
            fileName={uploadedDocumentFileName ?? "confirmation.pdf"}
            showDownload={false}
            showRotateControls={false}
            showToolbar
            showUpload={false}
            src={uploadedDocumentUrl}
            viewportGap={0}
            pageClassName={() => "bg-white"}
          />
        ) : uploadedDocumentDocxUrl ? (
          <DocxViewerPreview
            autoFitWidth
            className="h-full min-h-0"
            fileName={uploadedDocumentFileName ?? "confirmation.docx"}
            isDark={false}
            onIsDarkChange={() => {}}
            showDownload={false}
            showToolbar={false}
            showUpload={false}
            src={uploadedDocumentDocxUrl}
          />
        ) : hasUploadedDocument ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {copy.uploadedDocumentPreview}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn("grid h-full min-h-0 gap-0", styles.editorDraftLayout)}
      onBlurCapture={(event) => {
        const { target } = event;
        if (
          !(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLTextAreaElement)
        ) {
          return;
        }
        if (target.closest("[data-confirmation-template-field]")) {
          return;
        }
        if (localChangesRef.current) {
          scheduleAutoSaveRef.current(0);
        }
      }}
    >
      <div className="min-w-0">{toolbar}</div>
      <div
        data-testid="confirmation-draft-document-shell"
        className={
          uploadedDocumentUrl ||
          activeTemplateCode === "STANDARD_FINANCIAL_INSTITUTION" ||
          isOverlayEditableTemplate(activeTemplateCode)
            ? "relative min-h-0 overflow-hidden rounded-sm bg-muted/20"
            : "relative min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto rounded-sm bg-muted/20 p-3 sm:p-6 lg:p-8"
        }
      >
        {isConfirmationCustomTemplateCode(activeTemplateCode) ? (
          <CustomTemplateDraftDocument
            locale={locale}
            copy={copy}
            baseInformationOptions={baseInformationOptions}
            designSchema={templateDesignSchema}
            fileName={uploadedDocumentFileName}
            previewUrl={uploadedDocumentUrl}
            previewDocxUrl={uploadedDocumentDocxUrl}
            previewError={uploadedDocumentError}
            readOnly={readOnly}
            informationLibraryBindingChoices={informationLibraryBindingChoices}
            templateFieldBindingValues={templateFieldBindingValues}
            templateFieldValues={templateFieldValues}
            onTemplateFieldChange={handleTemplateFieldChange}
            onTemplateFieldTextStyleChange={handleTemplateFieldTextStyleChange}
          />
        ) : (
          <StandardFinancialInstitutionDraftDocument
            locale={locale}
            copy={copy}
            form={form}
            baseInformationOptions={baseInformationOptions}
            templateCode={activeTemplateCode}
            previewUrl={uploadedDocumentUrl}
            previewDocxUrl={uploadedDocumentDocxUrl}
            previewError={uploadedDocumentError}
            readOnly={readOnly}
            informationLibraryBindingChoices={informationLibraryBindingChoices}
            templateFieldBindingValues={templateFieldBindingValues}
            templateDesignSchema={templateDesignSchema}
            templateFieldValues={templateFieldValues}
            onTemplateFieldChange={handleTemplateFieldChange}
            onTemplateFieldTextStyleChange={handleTemplateFieldTextStyleChange}
            onCommitDraft={() => scheduleAutoSaveRef.current(0)}
          />
        )}
        {informationLibraryPanel}
      </div>

      {displayedValidationErrors.length > 0 ? (
        <div className="grid gap-1 text-sm text-destructive" role="alert">
          {displayedValidationErrors.map((error, index) => (
            <p key={`${error}-${index}`}>{error}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BankInformationLibraryPanel({
  copy,
  locale,
  onClose,
  onSelect,
}: {
  copy: ConfirmationCopy;
  locale: string;
  onClose: () => void;
  onSelect: (entry: ConfirmationInformationLibraryEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [bankTemplateRequiredOpen, setBankTemplateRequiredOpen] =
    useState(false);
  const applyEntry = (entry: ConfirmationInformationLibraryEntry) => {
    if (entry.requiresBankTemplate) {
      setBankTemplateRequiredOpen(true);
      return;
    }
    onSelect(entry);
  };
  const [selectedEntry, setSelectedEntry] =
    useState<ConfirmationInformationLibraryEntry | null>(null);
  const informationLibrary = useQuery({
    queryKey: ["confirmation-information-library", query.trim(), false],
    queryFn: () =>
      api.confirmationInformationLibrary({
        includeInactive: false,
        query: query.trim(),
      }),
  });
  const localeMatchCopy = getConfirmationInformationLibraryMatchCopy(locale);
  const gridCopy = getBankInformationLibraryGridCopy(copy, localeMatchCopy);
  const entries = informationLibrary.data ?? [];
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(entries.length / pageSize) - 1)
  );
  const pageEntries = entries.slice(
    safePage * pageSize,
    (safePage + 1) * pageSize
  );

  return (
    <section
      aria-label={copy.informationLibraryMatch.bankLookup}
      className={styles.informationLibraryPanel}
      data-entry-motion="pull-down"
      data-scroll-mode="contained"
      data-testid="confirmation-bank-query-panel"
      role="dialog"
    >
      <div className={styles.informationLibraryPanelBody}>
        <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-3 p-4">
          <div className="flex items-center gap-2">
            <Input
              aria-label={localeMatchCopy.searchPlaceholder}
              className="h-9 min-w-0"
              placeholder={localeMatchCopy.searchPlaceholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
                setSelectedEntry(null);
              }}
            />
            <ButtonGroup className="shrink-0">
              {selectedEntry ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedEntry(null)}
                  >
                    {localeMatchCopy.back}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => applyEntry(selectedEntry)}
                  >
                    {localeMatchCopy.apply}
                  </Button>
                </>
              ) : null}
              <Button
                aria-label={localeMatchCopy.close}
                className="size-8"
                size="icon"
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                <X />
              </Button>
            </ButtonGroup>
          </div>
          {selectedEntry ? (
            <div className="grid min-h-0 gap-4 overflow-y-auto">
              <div className="grid gap-4 text-sm">
                <div className="border-b border-border pb-3">
                  <p className="text-base font-semibold">
                    {selectedEntry.bankNameZh}
                  </p>
                  <p className="text-muted-foreground">
                    {selectedEntry.bankNameEn}
                  </p>
                </div>
                {selectedEntry.notes?.trim() ? (
                  <div
                    data-testid="bank-note-warning"
                    className="grid gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3"
                  >
                    <dt className="font-semibold text-destructive">
                      {gridCopy.cautions}
                    </dt>
                    <dd className="font-medium break-words whitespace-pre-wrap text-destructive">
                      {selectedEntry.notes}
                    </dd>
                  </div>
                ) : null}
                {[
                  [gridCopy.code, selectedEntry.bankCode],
                  [gridCopy.bankType, selectedEntry.bankType],
                  [gridCopy.background, selectedEntry.background],
                  [gridCopy.businessAddress, selectedEntry.businessAddress],
                  [gridCopy.mailingAddress, selectedEntry.mailingAddress],
                  [
                    gridCopy.effectiveMailingAddress,
                    selectedEntry.effectiveMailingAddress,
                  ],
                  [
                    gridCopy.contactName,
                    selectedEntry.contactName ?? selectedEntry.bankNameZh,
                  ],
                  [gridCopy.attention, selectedEntry.attention],
                  [
                    gridCopy.historicalMailingAddress,
                    selectedEntry.historicalMailingAddress,
                  ],
                  [gridCopy.cautions, selectedEntry.cautions],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid gap-1 border-b border-border/60 pb-3 last:border-0"
                  >
                    <dt className="font-medium text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="break-words whitespace-pre-wrap">
                      {value || gridCopy.emptyValue}
                    </dd>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedEntry(null)}
              >
                {localeMatchCopy.clear}
              </Button>
            </div>
          ) : (
            <div className="min-h-0 overflow-x-hidden overflow-y-auto rounded-md border border-border">
              <table
                className="w-full table-fixed text-sm"
                aria-label={gridCopy.title}
              >
                <thead className="sticky top-0 z-10 bg-muted/80 text-left text-muted-foreground backdrop-blur-sm">
                  <tr>
                    <th className="w-20 px-2 py-2 font-medium">
                      {gridCopy.code}
                    </th>
                    <th className="min-w-0 px-2 py-2 font-medium">
                      {localeMatchCopy.bankName}
                    </th>
                    <th className="w-16 px-2 py-2 text-right font-medium">
                      {gridCopy.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {informationLibrary.isFetching ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-muted-foreground"
                        colSpan={3}
                      >
                        {localeMatchCopy.loading}
                      </td>
                    </tr>
                  ) : informationLibrary.isError ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-destructive"
                        colSpan={3}
                      >
                        {localeMatchCopy.loadError}
                      </td>
                    </tr>
                  ) : (informationLibrary.data?.length ?? 0) === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-muted-foreground"
                        colSpan={3}
                      >
                        {localeMatchCopy.empty}
                      </td>
                    </tr>
                  ) : (
                    pageEntries.map((entry) => {
                      const displayName =
                        getConfirmationInformationLibraryDisplayName(
                          entry,
                          locale
                        );
                      return (
                        <tr
                          key={entry.id}
                          className="border-t border-border first:border-t-0"
                        >
                          <td className="px-2 py-2 font-mono font-semibold">
                            <SharedButton
                              variant="quiet"
                              size="sm"
                              type="button"
                              className="hover:text-primary hover:underline"
                              onClick={() => setSelectedEntry(entry)}
                            >
                              {entry.bankCode}
                            </SharedButton>
                          </td>
                          <td className="min-w-0 px-2 py-2">
                            <SharedButton
                              variant="quiet"
                              fullWidth
                              size="sm"
                              type="button"
                              className="block w-full truncate text-left font-medium hover:text-primary hover:underline"
                              onClick={() => setSelectedEntry(entry)}
                              title={displayName}
                            >
                              {displayName}
                            </SharedButton>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              className="px-2"
                              onClick={() => applyEntry(entry)}
                            >
                              {localeMatchCopy.apply}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!selectedEntry &&
          !informationLibrary.isPending &&
          !informationLibrary.isError ? (
            <ProjectWingPaginationFooter
              locale={locale.startsWith("zh") ? "zh-CN" : "en-US"}
              label={locale.startsWith("zh") ? "每页条数" : "Rows per page"}
              pageSizeOptionSuffix={
                locale.startsWith("zh") ? " / 页" : " / page"
              }
              pageSizeOptions={[30, 40, 50]}
              page={safePage}
              pageSize={pageSize}
              recordCount={entries.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
            />
          ) : null}
        </div>
      </div>
      <BankTemplateRequiredDialog
        open={bankTemplateRequiredOpen}
        onOpenChange={setBankTemplateRequiredOpen}
        locale={locale}
      />
    </section>
  );
}

function getBankInformationLibraryGridCopy(
  copy: ConfirmationCopy,
  localeMatchCopy: ConfirmationCopy["informationLibraryMatch"]
) {
  return {
    ...localeMatchCopy.grid,
    loading: copy.informationLibraryMatch.loading,
    loadError: copy.informationLibraryMatch.loadError,
    noResults: copy.informationLibraryMatch.empty,
    searchPlaceholder: copy.informationLibraryMatch.searchPlaceholder,
  };
}

function ConfirmationDownloadButton({
  copy,
  disabled,
  onDownload,
}: {
  copy: ConfirmationCopy;
  disabled: boolean;
  onDownload: (format: ConfirmationDownloadFormat) => void | Promise<void>;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      aria-label={copy.downloadConfirmation}
      onClick={() => {
        onDownload("pdf");
      }}
    >
      <Download className="size-4" />
      {copy.downloadConfirmation}
    </Button>
  );
}

function TemplateSelect({
  locale = "en-US",
  availableCodes,
  copy,
  customUploadSelected,
  disabled,
  labels,
  onCustomTemplateSelect,
  onValueChange,
  value,
}: {
  availableCodes: ConfirmationDraftTemplateCode[];
  copy: ConfirmationCopy;
  customUploadSelected: boolean;
  disabled: boolean;
  labels: ReadonlyMap<ConfirmationDraftTemplateCode, string>;
  onCustomTemplateSelect?: () => void;
  onValueChange: (value: ConfirmationDraftTemplateCode) => void;
  value: ConfirmationDraftTemplateCode | null;
  locale?: string;
}) {
  const phone = useCompactViewport(767.98);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = availableCodes.map((code) => ({
    label: getTemplateLabel(copy, code, labels),
    value: code,
  }));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter(
        (item) =>
          item.label.toLocaleLowerCase().includes(normalizedQuery) ||
          item.value.toLocaleLowerCase().includes(normalizedQuery)
      )
    : items;
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const optionsContent = (
    <>
      <Input
        type="search"
        aria-label={copy.templateSearchPlaceholder}
        placeholder={copy.templateSearchPlaceholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        role="listbox"
        aria-label={copy.selectTemplateToCreate}
        className="mt-2 max-h-64 space-y-1 overflow-y-auto"
      >
        <Button
          type="button"
          role="option"
          variant="ghost"
          size="sm"
          className="h-auto min-h-8 w-full justify-start text-left whitespace-normal"
          aria-selected={false}
          onClick={() => {
            onCustomTemplateSelect?.();
            close();
          }}
        >
          {copy.localUpload}
        </Button>
        {filteredItems.map((item) => (
          <Button
            key={item.value}
            type="button"
            role="option"
            variant={item.value === value ? "secondary" : "ghost"}
            size="sm"
            className="h-auto min-h-8 w-full justify-start text-left whitespace-normal"
            aria-selected={item.value === value}
            data-template-code={item.value}
            onClick={() => {
              onValueChange(item.value);
              close();
            }}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{item.label}</span>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {item.value}
              </span>
            </span>
          </Button>
        ))}
        {filteredItems.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {copy.noTemplateMatches}
          </p>
        ) : null}
      </div>
    </>
  );
  if (phone) {
    return (
      <>
        <Button
          id="confirmation-template"
          type="button"
          variant="outline"
          className="min-w-0 flex-1 justify-between font-normal"
          aria-label={copy.draftTemplate}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          data-template-catalog-version={TEMPLATE_CATALOG_VERSION}
          onClick={() => setOpen(true)}
        >
          <span className="min-w-0 truncate">
            {value
              ? getTemplateLabel(copy, value, labels)
              : customUploadSelected
                ? copy.localUpload
                : copy.selectTemplateToCreate}
          </span>
          <ChevronDown />
        </Button>
        <MobileActionSheet
          open={open}
          onOpenChange={(next) => (next ? setOpen(true) : close())}
          title={copy.draftTemplate}
          closeLabel={locale === "zh-CN" ? "关闭" : "Close"}
        >
          {optionsContent}
        </MobileActionSheet>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true);
        } else {
          close();
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id="confirmation-template"
            type="button"
            variant="outline"
            className="min-w-0 flex-1 justify-between font-normal"
            data-template-catalog-version={TEMPLATE_CATALOG_VERSION}
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={disabled}
          />
        }
      >
        <span className="min-w-0 truncate">
          {value
            ? getTemplateLabel(copy, value, labels)
            : customUploadSelected
              ? copy.localUpload
              : copy.selectTemplateToCreate}
        </span>
        <ChevronDown className="size-4 opacity-60" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("p-2", styles.templatePopover)}
      >
        {optionsContent}
      </PopoverContent>
    </Popover>
  );
}

function getTemplateLabel(
  copy: ConfirmationCopy,
  code: ConfirmationDraftTemplateCode,
  labels?: ReadonlyMap<ConfirmationDraftTemplateCode, string>
) {
  return (
    labels?.get(code) ??
    copy.draftTemplateLabels[
      code as keyof ConfirmationCopy["draftTemplateLabels"]
    ] ??
    copy.customTemplate
  );
}

function getSalutationOptions(copy: ConfirmationCopy) {
  const options = copy.draftDocument.managedFields.salutationOptions;
  return [
    { label: options.sirMadam, value: "Sir/Madam" },
    { label: options.sir, value: "Sir" },
    { label: options.madam, value: "Madam" },
  ] as const;
}

function normalizeSalutation(value: string | null | undefined) {
  const salutation = value?.trim() ?? "";
  if (!salutation) {
    return "";
  }
  if (/^sirs?\s*\/\s*madam$/i.test(salutation)) {
    return "Sir/Madam";
  }
  if (/^sir$/i.test(salutation)) {
    return "Sir";
  }
  if (/^madam$/i.test(salutation)) {
    return "Madam";
  }
  return "";
}

function CustomTemplateDraftDocument({
  locale,
  copy,
  baseInformationOptions,
  informationLibraryBindingChoices,
  designSchema,
  fileName,
  previewUrl,
  previewDocxUrl,
  previewError,
  readOnly,
  templateFieldBindingValues,
  templateFieldValues,
  onTemplateFieldChange,
  onTemplateFieldTextStyleChange,
}: {
  locale: string;
  copy: ConfirmationCopy;
  baseInformationOptions?: ConfirmationBaseInformationOptions | null;
  informationLibraryBindingChoices: InformationLibraryBindingChoices;
  designSchema: ConfirmationTemplateDesign | null;
  fileName?: string | null;
  previewUrl?: string | null;
  previewDocxUrl?: string | null;
  previewError: boolean;
  readOnly: boolean;
  templateFieldBindingValues: TemplateFieldBindingValues;
  templateFieldValues: TemplateFieldValues;
  onTemplateFieldChange: (
    field: ConfirmationTemplateDesignField,
    value: string,
    commit?: boolean
  ) => void;
  onTemplateFieldTextStyleChange: (
    fieldId: string,
    patch: Partial<ConfirmationTemplateTextStyle>
  ) => void;
}) {
  return (
    <div
      data-testid="confirmation-draft-document"
      data-editor={previewUrl ? "custom-pdf-overlay" : "custom-docx-overlay"}
      className="h-full min-h-0"
    >
      {previewUrl ? (
        <PDFViewer
          autoFitWidth
          className="h-full min-h-0"
          fileName={(fileName ?? "confirmation-template.pdf").replace(
            /\.docx$/iu,
            ".pdf"
          )}
          showDownload={false}
          showRotateControls={false}
          showUpload={false}
          src={previewUrl}
          viewportGap={0}
          renderPageOverlay={({ pageHeight, pageNumber, pageWidth, scale }) => (
            <ConfirmationTemplateDesignOverlay
              locale={locale}
              dateFieldCopy={copy.dateField}
              baseInformationOptions={baseInformationOptions}
              coverSourceText
              formattingCopy={copy.templateLibrary.workbench.fieldSettings}
              informationLibraryBindingChoices={
                informationLibraryBindingChoices
              }
              designSchema={designSchema}
              bindingValues={templateFieldBindingValues}
              onChange={onTemplateFieldChange}
              onTextStyleChange={onTemplateFieldTextStyleChange}
              pageHeight={pageHeight}
              pageScale={scale}
              pageNumber={pageNumber}
              pageWidth={pageWidth}
              readOnly={readOnly}
              values={templateFieldValues}
            />
          )}
        />
      ) : previewDocxUrl ? (
        <DocxViewerPreview
          autoFitWidth={false}
          className="h-full min-h-0"
          defaultZoom={100}
          fileName={fileName ?? "confirmation-template.docx"}
          isDark={false}
          onIsDarkChange={() => {}}
          showDownload={false}
          showToolbar
          showUpload={false}
          src={previewDocxUrl}
          renderPageOverlay={({ pageHeight, pageNumber, pageWidth }) => (
            <ConfirmationTemplateDesignOverlay
              locale={locale}
              dateFieldCopy={copy.dateField}
              baseInformationOptions={baseInformationOptions}
              coverSourceText
              formattingCopy={copy.templateLibrary.workbench.fieldSettings}
              informationLibraryBindingChoices={
                informationLibraryBindingChoices
              }
              designSchema={designSchema}
              bindingValues={templateFieldBindingValues}
              onChange={onTemplateFieldChange}
              onTextStyleChange={onTemplateFieldTextStyleChange}
              pageHeight={pageHeight}
              pageNumber={pageNumber}
              pageWidth={pageWidth}
              readOnly={readOnly}
              values={templateFieldValues}
            />
          )}
        />
      ) : (
        <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
          {previewError
            ? copy.uploadedDocumentPreviewError
            : copy.previewLoading}
        </div>
      )}
    </div>
  );
}

function StandardFinancialInstitutionDraftDocument({
  locale,
  copy,
  form,
  baseInformationOptions,
  informationLibraryBindingChoices,
  previewError: _unused_previewError,
  previewDocxUrl,
  previewUrl,
  readOnly,
  templateFieldBindingValues,
  templateDesignSchema,
  templateFieldValues,
  onTemplateFieldChange,
  onTemplateFieldTextStyleChange,
  onCommitDraft,
  templateCode,
}: DocumentProps & {
  locale: string;
  baseInformationOptions?: ConfirmationBaseInformationOptions | null;
  informationLibraryBindingChoices: InformationLibraryBindingChoices;
  previewError: boolean;
  previewDocxUrl?: string | null;
  previewUrl?: string | null;
  readOnly: boolean;
  templateFieldBindingValues: TemplateFieldBindingValues;
  templateDesignSchema: ConfirmationTemplateDesign | null;
  templateFieldValues: TemplateFieldValues;
  onTemplateFieldChange: (
    field: ConfirmationTemplateDesignField,
    value: string,
    commit?: boolean
  ) => void;
  onTemplateFieldTextStyleChange: (
    fieldId: string,
    patch: Partial<ConfirmationTemplateTextStyle>
  ) => void;
  onCommitDraft: () => void;
  templateCode: ConfirmationDraftTemplateCode;
}) {
  const usesCanonicalPdfPreview = Boolean(previewUrl);
  return (
    <div
      data-testid="confirmation-draft-document"
      data-template={templateCode}
      data-editor={
        usesCanonicalPdfPreview ? "pdf-digital-twin" : "docx-overlay"
      }
      className="h-full min-h-0"
    >
      {previewDocxUrl &&
      !usesCanonicalPdfPreview &&
      templateCode !== "STANDARD_FINANCIAL_INSTITUTION" ? (
        <DocxViewerPreview
          autoFitWidth={false}
          className="h-full min-h-0"
          defaultZoom={100}
          fileName={getManagedTemplateFileName(templateCode)}
          isDark={false}
          onIsDarkChange={() => {}}
          showDownload={false}
          showToolbar
          showUpload={false}
          src={previewDocxUrl}
          renderPageOverlay={({
            pageElement,
            pageHeight,
            pageNumber,
            pageWidth,
            scale,
          }) => (
            <>
              {pageNumber === 1 ? (
                <ManagedTemplatePageOneFields
                  copy={copy}
                  baseInformationOptions={baseInformationOptions}
                  designSchema={templateDesignSchema}
                  form={form}
                  pageElement={pageElement}
                  pageScale={scale}
                  readOnly={readOnly}
                  templateCode={templateCode}
                  onCommitDraft={onCommitDraft}
                />
              ) : null}
              <ConfirmationTemplateDesignOverlay
                locale={locale}
                dateFieldCopy={copy.dateField}
                baseInformationOptions={baseInformationOptions}
                formattingCopy={copy.templateLibrary.workbench.fieldSettings}
                informationLibraryBindingChoices={
                  informationLibraryBindingChoices
                }
                designSchema={templateDesignSchema}
                bindingValues={templateFieldBindingValues}
                onChange={onTemplateFieldChange}
                onTextStyleChange={onTemplateFieldTextStyleChange}
                pageHeight={pageHeight}
                pageNumber={pageNumber}
                pageWidth={pageWidth}
                readOnly={readOnly}
                values={templateFieldValues}
              />
            </>
          )}
        />
      ) : usesCanonicalPdfPreview ? (
        <PDFViewer
          autoFitWidth
          className="h-full min-h-0"
          fileName={getManagedTemplateFileName(templateCode).replace(
            /\.docx$/iu,
            ".pdf"
          )}
          showDownload={false}
          showRotateControls={false}
          showUpload={false}
          src={previewUrl ?? ""}
          viewportGap={0}
          pageClassName={() => "bg-white"}
          renderPageOverlay={({ pageHeight, pageNumber, pageWidth, scale }) => (
            <>
              {templateCode === "STANDARD_FINANCIAL_INSTITUTION" &&
              pageNumber === 1 ? (
                <StandardFinancialInstitutionPdfPageOneFields
                  copy={copy}
                  baseInformationOptions={baseInformationOptions}
                  form={form}
                  readOnly={readOnly}
                  templateDesignSchema={templateDesignSchema}
                  onCommitDraft={onCommitDraft}
                />
              ) : null}
              <ConfirmationTemplateDesignOverlay
                locale={locale}
                dateFieldCopy={copy.dateField}
                baseInformationOptions={baseInformationOptions}
                formattingCopy={copy.templateLibrary.workbench.fieldSettings}
                informationLibraryBindingChoices={
                  informationLibraryBindingChoices
                }
                designSchema={templateDesignSchema}
                bindingValues={templateFieldBindingValues}
                onChange={onTemplateFieldChange}
                onTextStyleChange={onTemplateFieldTextStyleChange}
                pageHeight={pageHeight}
                pageScale={scale}
                pageNumber={pageNumber}
                pageWidth={pageWidth}
                readOnly={readOnly}
                values={templateFieldValues}
              />
            </>
          )}
        />
      ) : (
        <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
          {copy.previewLoading}
        </div>
      )}
    </div>
  );
}

function StandardFinancialInstitutionPdfPageOneFields({
  copy,
  form,
  baseInformationOptions,
  readOnly,
  templateDesignSchema,
  onCommitDraft,
}: Pick<DocumentProps, "copy" | "form"> & {
  baseInformationOptions?: ConfirmationBaseInformationOptions | null;
  readOnly: boolean;
  templateDesignSchema: ConfirmationTemplateDesign | null;
  onCommitDraft: () => void;
}) {
  const { managedFields } = copy.draftDocument;
  const fields: {
    className: string;
    id: string;
    label: string;
    name:
      | "auditorAddress"
      | "auditorName"
      | "authorizationAccount"
      | "bankName"
      | "officeDate"
      | "recipientName"
      | "referenceCode"
      | "reportDate"
      | "salutation";
    options?: readonly { label: string; value: string }[];
    placeholder?: string;
  }[] = [
    {
      className: styles.recipientNameField,
      id: "confirmation-to-the-manager",
      label: managedFields.labels.toTheManager,
      name: "recipientName" as const,
      placeholder: managedFields.placeholders.toTheManager,
    },
    {
      className: styles.salutationField,
      id: "confirmation-standard-salutation",
      label: managedFields.labels.salutation,
      name: "salutation" as const,
      options: getSalutationOptions(copy),
      placeholder: managedFields.placeholders.salutation,
    },
    {
      className: styles.bankNameField,
      id: "confirmation-bank-office",
      label: copy.thirdParty,
      name: "bankName" as const,
    },
    {
      className: styles.officeDateField,
      id: "confirmation-office-date",
      label: copy.officeDate,
      name: "officeDate" as const,
    },
    {
      className: styles.referenceCodeField,
      id: "confirmation-reference-code",
      label: copy.draftDocument.hkReference,
      name: "referenceCode" as const,
    },
    {
      className: styles.reportDateField,
      id: "confirmation-report-date",
      label: copy.reportDate,
      name: "reportDate" as const,
    },
    {
      className: styles.auditorNameField,
      id: "confirmation-auditor-name-hk",
      label: copy.auditorName,
      name: "auditorName" as const,
    },
    {
      className: styles.auditorAddressField,
      id: "confirmation-auditor-address-hk",
      label: copy.auditorAddress,
      name: "auditorAddress" as const,
    },
    {
      className: styles.authorizationAccountField,
      id: "confirmation-authorization-account",
      label: copy.authorizationAccount,
      name: "authorizationAccount" as const,
    },
  ];
  const replacedFieldNames: ReadonlySet<string> = new Set(
    templateDesignSchema?.fields
      .filter((field) => field.page === 1)
      .map(getStandardFieldReplacedByDynamicField)
      .filter((name): name is string => Boolean(name))
  );
  const visibleFields = designOwnsManagedLegacyFields(templateDesignSchema)
    ? []
    : fields.filter((field) => !replacedFieldNames.has(field.name));

  return (
    <div
      data-testid="confirmation-editable-overlay"
      data-layout-version={STANDARD_TEMPLATE_LAYOUT_VERSION}
      className="pointer-events-none absolute inset-0 z-20"
    >
      {visibleFields.map((field) => (
        <div
          key={field.name}
          data-confirmation-field={field.name}
          className={cn("pointer-events-auto absolute", field.className)}
        >
          {(() => {
            const choices = baseInformationChoices(
              field.name,
              baseInformationOptions
            );
            return (
              <>
                <Label htmlFor={field.id} className="sr-only">
                  {field.label}
                </Label>
                {field.options ? (
                  <Select
                    value={form.watch(field.name)}
                    onValueChange={(nextValue) => {
                      form.setValue(field.name, nextValue ?? "", {
                        shouldDirty: true,
                      });
                      onCommitDraft();
                    }}
                  >
                    <SelectTrigger
                      id={field.id}
                      aria-readonly={readOnly}
                      className={cn(
                        "relative z-10 h-full min-w-0 w-full justify-start rounded-sm border border-slate-300 bg-white px-1 py-0 text-left font-normal leading-none text-slate-900 shadow-none focus-visible:border-primary focus-visible:ring-0",
                        MANAGED_OVERLAY_TEXT_CLASS,
                        styles.overlaySelectValue
                      )}
                      disabled={readOnly}
                    >
                      <SelectValue
                        className="line-clamp-none min-w-0 overflow-hidden text-left text-clip whitespace-nowrap"
                        placeholder={field.placeholder}
                      >
                        {form.watch(field.name)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      {field.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : choices.length ? (
                  <LinkedTemplateFieldInput
                    choices={choices}
                    emptyOptionsLabel={
                      copy.templateLibrary.workbench.fieldSettings.emptyOptions
                    }
                    field={field}
                    id={field.id}
                    onChange={(nextValue) =>
                      form.setValue(field.name, nextValue, {
                        shouldDirty: true,
                      })
                    }
                    readOnly={readOnly}
                    className={styles.overlayInput}
                    value={form.watch(field.name)}
                  />
                ) : (
                  <>
                    {field.name === "bankName" ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute inset-x-0 bottom-0 bg-white",
                          styles.bankNameSourceCover
                        )}
                        data-confirmation-source-cover="true"
                        data-testid="confirmation-bank-name-source-cover"
                      />
                    ) : null}
                    <Input
                      id={field.id}
                      readOnly={readOnly}
                      aria-readonly={readOnly}
                      placeholder={field.placeholder}
                      className={cn(
                        "relative z-10 h-full w-full rounded-sm border border-slate-300 bg-white px-1 py-0 leading-none text-slate-900 shadow-none placeholder:text-slate-400 transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-0",
                        styles.overlayInput
                      )}
                      {...form.register(field.name)}
                    />
                  </>
                )}
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

function getStandardFieldReplacedByDynamicField(
  field: ConfirmationTemplateDesignField
): string | null {
  if (field.binding === "recipientName") {
    return "recipientName";
  }
  if (field.binding === "bankName") {
    return "bankName";
  }
  if (field.binding === "officeDate") {
    return "officeDate";
  }
  if (field.binding === "referenceCode") {
    return "referenceCode";
  }
  if (field.binding === "clientName") {
    return "clientName";
  }

  const placeholder = (field.placeholder ?? "")
    .replaceAll(/[()]/g, "")
    .replaceAll(/[‘’]/g, "'")
    .trim()
    .toLocaleLowerCase();
  if (placeholder === "to the manager") {
    return "recipientName";
  }
  if (placeholder === "bank office" || placeholder === "name of bank") {
    return "bankName";
  }
  if (placeholder === "date") {
    return "officeDate";
  }
  if (placeholder === "ref" || placeholder === "reference") {
    return "referenceCode";
  }
  return null;
}

const TEMPLATE_OPTION_SURFACE_CLASS =
  "max-h-40 min-w-0 rounded-sm border border-primary bg-white p-1 text-slate-900 shadow-lg outline-none";
const TEMPLATE_OPTION_ITEM_CLASS =
  "flex w-full rounded-sm px-2 py-0.5 text-left text-xs! leading-4! hover:bg-accent hover:text-accent-foreground";
const TEMPLATE_OPTION_EMPTY_CLASS =
  "px-2 py-0.5 text-xs leading-4 text-muted-foreground";

function LinkedTemplateFieldInput({
  choices,
  emptyOptionsLabel,
  field,
  id,
  onChange,
  readOnly,
  style,
  value,
  className,
}: {
  choices: string[];
  emptyOptionsLabel: string;
  field: Pick<
    ConfirmationTemplateDesignField,
    "id" | "name" | "placeholder" | "textStyle"
  > & { kind?: ConfirmationTemplateDesignField["kind"] };
  id: string;
  onChange: (value: string, commit?: boolean) => void;
  readOnly: boolean;
  style?: CSSProperties;
  value: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const optionListId = `${id}-options`;
  const visibleChoices = choices;
  const isMultiline = field.kind === "MULTILINE";

  const updatePopupPosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    setPopupPosition({
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
    });
  }, []);

  const openOptions = () => {
    updatePopupPosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleViewportChange = () => updatePopupPosition();
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updatePopupPosition]);

  return (
    <div ref={rootRef} className="relative h-full w-full">
      {isMultiline ? (
        <Textarea
          id={id}
          aria-controls={optionListId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-readonly={readOnly}
          className={cn(
            "relative z-10 block h-full min-h-0 w-full resize-none rounded-sm border border-primary bg-transparent px-1 py-0.5 pr-6 leading-tight text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-0",
            getTemplateFieldTextStyleClassName(field.textStyle),
            className
          )}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onChange(value, true)}
          onClick={() => {
            if (!readOnly) {
              openOptions();
            }
          }}
          onFocus={() => {
            if (!readOnly) {
              openOptions();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={field.placeholder}
          readOnly={readOnly}
          role="combobox"
          style={style}
          value={value}
        />
      ) : (
        <Input
          id={id}
          aria-controls={optionListId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-readonly={readOnly}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          className={cn(
            "relative z-10 block h-full min-w-0 w-full rounded-sm border border-primary bg-transparent px-1 py-0 pr-6 leading-none text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-0",
            getTemplateFieldTextStyleClassName(field.textStyle),
            className
          )}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onChange(value, true)}
          onClick={() => {
            if (!readOnly) {
              openOptions();
            }
          }}
          onFocus={() => {
            if (!readOnly) {
              openOptions();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={field.placeholder}
          readOnly={readOnly}
          role="combobox"
          style={style}
          value={value}
        />
      )}
      <SharedButton
        variant="quiet"
        size="icon-sm"
        type="button"
        aria-label={`Open ${field.name ?? field.id} options`}
        aria-expanded={open}
        className="absolute inset-y-0 right-0 z-20 flex w-6 items-center justify-center text-slate-500 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50"
        disabled={readOnly}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openOptions();
          }
        }}
      >
        <ChevronDown className="size-4" aria-hidden="true" />
      </SharedButton>
      {open && popupPosition
        ? createPortal(
            <div
              ref={popupRef}
              id={optionListId}
              role="listbox"
              aria-label={`${field.name ?? field.id} options`}
              className={cn(
                "fixed z-[100] overflow-auto",
                TEMPLATE_OPTION_SURFACE_CLASS
              )}
              style={popupPosition}
            >
              {visibleChoices.length ? (
                visibleChoices.map((option) => (
                  <SharedButton
                    variant="quiet"
                    fullWidth
                    size="sm"
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={option === value}
                    className={TEMPLATE_OPTION_ITEM_CLASS}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(option, true);
                      setOpen(false);
                    }}
                  >
                    {option}
                  </SharedButton>
                ))
              ) : (
                <div className={TEMPLATE_OPTION_EMPTY_CLASS}>
                  {emptyOptionsLabel}
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function designOwnsManagedLegacyFields(
  designSchema: ConfirmationTemplateDesign | null
) {
  return Boolean(
    designSchema &&
    (designSchema.fields.length === 0 ||
      designSchema.fields.some(hasTemplateFieldBinding))
  );
}

function TemplateFieldFormattingToolbar({
  field,
  formattingCopy,
  onChange,
}: {
  field: ConfirmationTemplateDesignField;
  formattingCopy: ConfirmationCopy["templateLibrary"]["workbench"]["fieldSettings"];
  onChange: (patch: Partial<ConfirmationTemplateTextStyle>) => void;
}) {
  const textStyle = {
    ...DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
    ...field.textStyle,
  };
  const fontSizeIndex = CONFIRMATION_TEMPLATE_FONT_SIZES.indexOf(
    textStyle.fontSize
  );
  const update = (patch: Partial<ConfirmationTemplateTextStyle>) =>
    onChange(patch);

  return (
    <div
      aria-label={formattingCopy.formattingToolbar ?? formattingCopy.title}
      className="pointer-events-auto absolute top-2 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-1 rounded-md border bg-background/95 p-1 shadow-lg backdrop-blur"
      role="toolbar"
    >
      <Button
        aria-label={formattingCopy.fontSizeDecrease ?? formattingCopy.fontSize}
        disabled={fontSizeIndex <= 0}
        onClick={() =>
          update({
            fontSize:
              CONFIRMATION_TEMPLATE_FONT_SIZES[
                Math.max(0, fontSizeIndex - 1)
              ] ?? textStyle.fontSize,
          })
        }
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Minus />
      </Button>
      <span className="min-w-10 text-center text-xs tabular-nums">
        {textStyle.fontSize} {UI_UNIT_LABELS.points}
      </span>
      <Button
        aria-label={formattingCopy.fontSizeIncrease ?? formattingCopy.fontSize}
        disabled={fontSizeIndex >= CONFIRMATION_TEMPLATE_FONT_SIZES.length - 1}
        onClick={() =>
          update({
            fontSize:
              CONFIRMATION_TEMPLATE_FONT_SIZES[
                Math.min(
                  CONFIRMATION_TEMPLATE_FONT_SIZES.length - 1,
                  fontSizeIndex + 1
                )
              ] ?? textStyle.fontSize,
          })
        }
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Plus />
      </Button>
      {[
        ["bold", formattingCopy.bold, Bold],
        ["italic", formattingCopy.italic, Italic],
        ["underline", formattingCopy.underline, Underline],
      ].map(([key, label, Icon]) => {
        const styleKey = key as "bold" | "italic" | "underline";
        return (
          <Button
            aria-label={label as string}
            aria-pressed={textStyle[styleKey]}
            key={key as string}
            onClick={() => update({ [styleKey]: !textStyle[styleKey] })}
            size="icon-sm"
            type="button"
            variant={textStyle[styleKey] ? "secondary" : "ghost"}
          >
            <Icon />
          </Button>
        );
      })}
    </div>
  );
}

function ConfirmationTemplateDesignOverlay({
  locale,
  dateFieldCopy,
  baseInformationOptions,
  coverSourceText = false,
  designSchema,
  formattingCopy,
  informationLibraryBindingChoices,
  onChange,
  onTextStyleChange,
  pageHeight,
  pageScale,
  pageNumber,
  pageWidth,
  readOnly,
  values,
}: {
  locale: string;
  dateFieldCopy: ConfirmationCopy["dateField"];
  baseInformationOptions?: ConfirmationBaseInformationOptions | null;
  bindingValues: TemplateFieldBindingValues;
  coverSourceText?: boolean;
  designSchema: ConfirmationTemplateDesign | null;
  formattingCopy: ConfirmationCopy["templateLibrary"]["workbench"]["fieldSettings"];
  informationLibraryBindingChoices: InformationLibraryBindingChoices;
  onChange: (
    field: ConfirmationTemplateDesignField,
    value: string,
    commit?: boolean
  ) => void;
  onTextStyleChange: (
    fieldId: string,
    patch: Partial<ConfirmationTemplateTextStyle>
  ) => void;
  pageHeight: number;
  pageScale?: number;
  pageNumber: number;
  pageWidth: number;
  readOnly: boolean;
  values: TemplateFieldValues;
}) {
  const fields =
    designSchema?.fields.filter((field) => field.page === pageNumber) ?? [];
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const activeField = fields.find((field) => field.id === activeFieldId);
  if (fields.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="confirmation-template-design-overlay"
      className="pointer-events-none absolute inset-0 z-40"
    >
      {activeField && activeField.kind !== "MASK" && !readOnly ? (
        <TemplateFieldFormattingToolbar
          field={activeField}
          formattingCopy={formattingCopy}
          onChange={(textStyle) => onTextStyleChange(activeField.id, textStyle)}
        />
      ) : null}
      {fields.map((field) => {
        const label = field.name?.trim() || field.id;
        const geometry = {
          height: `${field.height * 100}%`,
          left: `${field.x * 100}%`,
          top: `${field.y * 100}%`,
          width: `${field.width * 100}%`,
        };
        if (field.kind === "MASK") {
          return (
            <div
              key={field.id}
              aria-hidden="true"
              data-confirmation-template-mask={field.id}
              data-testid={`confirmation-template-mask-${field.id}`}
              className="pointer-events-none absolute z-50 bg-white"
              style={geometry}
            />
          );
        }

        const baseBinding = field.baseInformationBinding ?? field.binding;
        const { informationLibraryBinding } = field;
        const legacyDefaultValueSource =
          getTemplateFieldRelationDefaultValueSource(field);
        const hasLinkedField = Boolean(
          baseBinding || informationLibraryBinding || legacyDefaultValueSource
        );
        const defaultValue = getTemplateDefaultFillValue(field);
        const value =
          values[field.id] ??
          defaultValue ??
          (field.kind === "CHECKBOX"
            ? field.defaultChecked === true
              ? "true"
              : "false"
            : "");
        const linkedBaseChoices = baseBinding
          ? baseInformationChoices(baseBinding, baseInformationOptions)
          : [];
        const linkedInformationLibraryChoices = informationLibraryBinding
          ? (informationLibraryBindingChoices[informationLibraryBinding] ?? [])
          : [];
        const legacyBaseChoices =
          legacyDefaultValueSource?.source === "BASE_INFORMATION"
            ? baseInformationChoices(
                legacyDefaultValueSource.binding,
                baseInformationOptions
              )
            : [];
        const legacyInformationLibraryChoices =
          legacyDefaultValueSource?.source === "INFORMATION_LIBRARY"
            ? (informationLibraryBindingChoices[
                legacyDefaultValueSource.binding
              ] ?? [])
            : [];
        const choices = hasLinkedField
          ? [
              ...new Set(
                [
                  ...linkedBaseChoices,
                  ...linkedInformationLibraryChoices,
                  ...legacyBaseChoices,
                  ...legacyInformationLibraryChoices,
                ]
                  .map((candidateValue) => candidateValue.trim())
                  .filter(Boolean)
              ),
            ]
          : [];
        const textStyle = {
          ...getConfirmationTemplateFieldTextStyleCss(
            field.textStyle,
            pageHeight,
            pageScale,
            pageWidth,
            field.height,
            field.width,
            value || field.placeholder || "",
            field.kind === "MULTILINE"
          ),
          textAlign: field.textAlign ?? "left",
        } satisfies CSSProperties;
        const flexAlignmentStyle = getConfirmationTemplateFlexAlignmentCss(
          field.textAlign
        );
        const selectOptions = field.options ?? [];
        const options =
          field.kind === "SELECT" || field.kind === "RADIO"
            ? selectOptions
            : choices;
        const selectedValue = options.includes(value) ? value : "";
        const listId =
          choices.length > 0
            ? baseInformationListId("dynamic", field.id)
            : undefined;
        return (
          <div
            key={field.id}
            data-confirmation-template-field={field.id}
            className={cn(
              "absolute isolate",
              field.kind === "STATIC_TEXT"
                ? "pointer-events-none"
                : "pointer-events-auto"
            )}
            onFocusCapture={() => setActiveFieldId(field.id)}
            style={geometry}
          >
            {coverSourceText || field.sourceRanges?.length ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 bg-white"
                data-confirmation-source-cover={field.id}
              />
            ) : null}
            <Label
              htmlFor={`confirmation-template-field-${field.id}`}
              className="sr-only"
            >
              {label}
            </Label>
            {field.kind === "STATIC_TEXT" ? null : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 bg-white"
                data-confirmation-template-field-backdrop=""
              />
            )}
            {field.kind === "STATIC_TEXT" ? (
              <div
                aria-label={label}
                className={cn(
                  "relative z-10 flex h-full w-full items-center overflow-hidden bg-transparent px-1 leading-tight whitespace-pre-wrap text-slate-900",
                  getTemplateFieldTextStyleClassName(field.textStyle)
                )}
                data-confirmation-static-text={field.id}
                style={{ ...textStyle, ...flexAlignmentStyle }}
              >
                {field.placeholder || field.name}
              </div>
            ) : field.kind === "CHECKBOX" ? (
              <div
                className={cn(
                  "relative z-10 flex h-full w-full items-center gap-2 overflow-hidden rounded-sm border border-primary bg-transparent px-1 text-slate-900",
                  getTemplateFieldTextStyleClassName(field.textStyle)
                )}
                style={{ ...textStyle, ...flexAlignmentStyle }}
              >
                <Checkbox
                  checked={value === "true"}
                  disabled={readOnly}
                  id={`confirmation-template-field-${field.id}`}
                  label={label}
                  onCheckedChange={(checked) =>
                    onChange(field, checked === true ? "true" : "false", true)
                  }
                  required={field.required === true}
                />
                <span className="truncate">
                  {field.placeholder || field.name}
                </span>
              </div>
            ) : field.kind === "RADIO" ? (
              <div className="relative h-full w-full overflow-visible">
                <div
                  aria-label={label}
                  className={cn(
                    "flex h-full w-full items-center overflow-hidden rounded-sm border border-primary bg-transparent py-0 pr-5 pl-1 leading-none text-slate-900 shadow-none",
                    getTemplateFieldTextStyleClassName(field.textStyle)
                  )}
                  data-testid={`confirmation-radio-display-${field.id}`}
                  style={{ ...textStyle, ...flexAlignmentStyle }}
                >
                  <span className="truncate">
                    {selectedValue || field.placeholder}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label={`${label} options`}
                        className="absolute top-0 right-0 z-20 h-full min-h-0 w-5 rounded-none border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
                        disabled={readOnly}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <ChevronDown />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuRadioGroup
                      onValueChange={(nextValue) =>
                        onChange(field, nextValue, true)
                      }
                      value={selectedValue}
                    >
                      {options.map((option) => (
                        <DropdownMenuRadioItem key={option} value={option}>
                          {option}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : field.kind === "SELECT" ? (
              <Select
                value={selectedValue}
                onValueChange={(nextValue) =>
                  onChange(field, nextValue ?? "", true)
                }
              >
                <SelectTrigger
                  id={`confirmation-template-field-${field.id}`}
                  aria-readonly={readOnly}
                  className={cn(
                    "relative z-10 h-full min-w-0 w-full justify-start rounded-sm border border-primary bg-transparent px-1 py-0 text-left font-normal leading-none text-slate-900 shadow-none focus-visible:border-primary focus-visible:ring-0",
                    getTemplateFieldTextStyleClassName(field.textStyle),
                    "data-[size=default]:h-full"
                  )}
                  style={{ ...textStyle, ...flexAlignmentStyle }}
                  disabled={readOnly}
                >
                  <SelectValue
                    className={cn(
                      "line-clamp-none min-w-0 overflow-hidden text-clip whitespace-nowrap",
                      field.textAlign === "center"
                        ? "justify-center text-center"
                        : field.textAlign === "right"
                          ? "justify-end text-right"
                          : "justify-start text-left"
                    )}
                    placeholder={field.placeholder}
                  >
                    {value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  align="start"
                  alignItemWithTrigger={false}
                  className={TEMPLATE_OPTION_SURFACE_CLASS}
                >
                  {options.length ? (
                    options.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className={TEMPLATE_OPTION_ITEM_CLASS}
                      >
                        {option}
                      </SelectItem>
                    ))
                  ) : (
                    <div className={TEMPLATE_OPTION_EMPTY_CLASS}>
                      {formattingCopy.emptyOptions}
                    </div>
                  )}
                </SelectContent>
              </Select>
            ) : field.kind === "DATE" ? (
              <ConfirmationDateField
                id={`confirmation-template-field-${field.id}`}
                label={label}
                locale={locale}
                placeholder={field.placeholder ?? ""}
                readOnly={readOnly}
                style={textStyle}
                chooseLabel={dateFieldCopy.choose}
                clearLabel={dateFieldCopy.clear}
                todayLabel={dateFieldCopy.today}
                value={value}
                onCommit={(nextValue) => onChange(field, nextValue, true)}
              />
            ) : hasLinkedField ? (
              <LinkedTemplateFieldInput
                choices={choices}
                emptyOptionsLabel={formattingCopy.emptyOptions}
                field={field}
                id={`confirmation-template-field-${field.id}`}
                onChange={(nextValue, commit) =>
                  onChange(field, nextValue, commit)
                }
                readOnly={readOnly}
                style={textStyle}
                value={value}
              />
            ) : field.kind === "MULTILINE" ? (
              <Textarea
                aria-readonly={readOnly}
                className={cn(
                  "relative z-10 h-full min-h-0 w-full resize-none rounded-sm border border-primary bg-transparent px-1 py-0.5 leading-tight text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-0",
                  getTemplateFieldTextStyleClassName(field.textStyle)
                )}
                id={`confirmation-template-field-${field.id}`}
                onChange={(event) => onChange(field, event.target.value)}
                onBlur={() => onChange(field, value, true)}
                placeholder={field.placeholder}
                readOnly={readOnly}
                style={textStyle}
                value={value}
              />
            ) : (
              <Input
                id={`confirmation-template-field-${field.id}`}
                list={listId}
                aria-readonly={readOnly}
                className={cn(
                  "relative z-10 block h-full min-w-0 w-full rounded-sm border border-primary bg-transparent px-1 py-0 leading-none text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-0",
                  getTemplateFieldTextStyleClassName(field.textStyle)
                )}
                onChange={(event) => onChange(field, event.target.value)}
                onBlur={() => onChange(field, value, true)}
                placeholder={field.placeholder}
                readOnly={readOnly}
                style={textStyle}
                type={field.kind === "NUMBER" ? "number" : "text"}
                value={value}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function getManagedTemplateFileName(
  templateCode: ConfirmationDraftTemplateCode
) {
  if (templateCode === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1") {
    return "securities-confirmation-english-type-1.docx";
  }
  if (templateCode === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2") {
    return "securities-confirmation-english-type-2.docx";
  }
  return "bank-confirmation-hk-standard-english.docx";
}

function ManagedTemplatePageOneFields({
  templateCode,
  designSchema,
  onCommitDraft,
  ...props
}: Pick<DocumentProps, "copy" | "form"> & {
  baseInformationOptions?: ConfirmationBaseInformationOptions | null;
  designSchema: ConfirmationTemplateDesign | null;
  onCommitDraft: () => void;
  pageElement?: HTMLElement;
  pageScale?: number;
  readOnly: boolean;
  templateCode: ConfirmationDraftTemplateCode;
}) {
  if (templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH") {
    return (
      <StandardFinancialInstitutionPageOneFields
        {...props}
        designSchema={designSchema}
        onCommitDraft={onCommitDraft}
      />
    );
  }
  if (
    templateCode !== "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1" &&
    templateCode !== "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2"
  ) {
    return null;
  }
  return (
    <SecuritiesConfirmationPageOneFields
      {...props}
      designSchema={designSchema}
      onCommitDraft={onCommitDraft}
      templateCode={templateCode}
    />
  );
}

function StandardFinancialInstitutionPageOneFields({
  copy,
  designSchema,
  form,
  baseInformationOptions,
  pageElement,
  pageScale = 1,
  readOnly,
  onCommitDraft,
}: Pick<DocumentProps, "copy" | "form"> & {
  baseInformationOptions?: ConfirmationBaseInformationOptions | null;
  designSchema: ConfirmationTemplateDesign | null;
  pageElement?: HTMLElement;
  pageScale?: number;
  readOnly: boolean;
  onCommitDraft: () => void;
}) {
  const fields: {
    anchor: DocxFieldAnchor;
    className: string;
    coverAnchor?: DocxFieldAnchor;
    coverPaddingBottom?: number;
    geometryBottomRatio?: number;
    geometryTopOffsetRatio?: number;
    geometryWidthRatio?: number;
    id: string;
    label: string;
    name:
      | "auditorAddress"
      | "auditorName"
      | "authorizationAccount"
      | "bankName"
      | "clientName"
      | "officeDate"
      | "recipientName"
      | "referenceCode"
      | "reportDate"
      | "salutation";
    options?: readonly { label: string; value: string }[];
    placeholder: string;
  }[] = [
    {
      anchor: { kind: "text", marker: /To\s+The\s+Manager/i },
      className: styles.recipientNameField,
      geometryWidthRatio: 2,
      id: "confirmation-to-the-manager",
      label: copy.draftDocument.managedFields.labels.toTheManager,
      name: "recipientName" as const,
      placeholder: copy.draftDocument.managedFields.placeholders.toTheManager,
    },
    {
      anchor: { kind: "text", marker: /Sirs?(?:\s*\/\s*Madam|,)/i },
      className: styles.docxSalutationField,
      geometryWidthRatio: 4,
      id: "confirmation-hk-salutation",
      label: copy.draftDocument.managedFields.labels.salutation,
      name: "salutation" as const,
      options: getSalutationOptions(copy),
      placeholder: copy.draftDocument.managedFields.placeholders.salutation,
      geometryTopOffsetRatio: 0.6,
    },
    {
      anchor: {
        cellIndex: 0,
        kind: "table-cell",
        rowIndex: 3,
        tableIndex: 6,
      },
      className: styles.bankNameField,
      coverAnchor: {
        cellIndex: 0,
        kind: "table-cell",
        rowIndex: 1,
        tableIndex: 6,
      },
      coverPaddingBottom: 2,
      id: "confirmation-bank-office",
      label: copy.thirdParty,
      name: "bankName" as const,
      placeholder: copy.draftDocument.managedFields.placeholders.bankName,
    },
    {
      anchor: {
        cellIndex: 2,
        kind: "table-cell",
        rowIndex: 3,
        tableIndex: 6,
      },
      className: styles.officeDateField,
      id: "confirmation-office-date",
      label: copy.officeDate,
      name: "officeDate" as const,
      placeholder: copy.draftDocument.managedFields.placeholders.officeDate,
    },
    {
      anchor: {
        cellIndex: 2,
        kind: "table-cell",
        rowIndex: 0,
        tableIndex: 8,
      },
      className: styles.referenceCodeField,
      id: "confirmation-reference-code",
      label: copy.draftDocument.hkReference,
      name: "referenceCode" as const,
      placeholder: copy.draftDocument.managedFields.placeholders.referenceCode,
    },
    {
      anchor: {
        cellIndex: 1,
        kind: "table-cell",
        rowIndex: 5,
        tableIndex: 13,
      },
      className: styles.clientNameField,
      coverAnchor: {
        cellIndex: 1,
        kind: "table-cell",
        rowIndex: 5,
        tableIndex: 13,
      },
      geometryBottomRatio: 0.36,
      id: "confirmation-client-name",
      label: copy.draftDocument.managedFields.labels.clientName,
      name: "clientName" as const,
      placeholder: copy.draftDocument.managedFields.placeholders.clientName,
    },
    {
      anchor: {
        after: "our affairs with your bank as at the close of business on",
        before: " For each item",
        cellIndex: 0,
        kind: "table-text",
        paragraphIndex: 0,
        rowIndex: 0,
        tableIndex: 15,
      },
      className: styles.reportDateField,
      id: "confirmation-report-date",
      label: copy.reportDate,
      name: "reportDate" as const,
      placeholder: copy.draftDocument.managedFields.placeholders.reportDate,
    },
    {
      anchor: {
        before: ",",
        cellIndex: 0,
        kind: "table-text",
        paragraphIndex: 1,
        rowIndex: 4,
        tableIndex: 15,
      },
      className: styles.auditorNameField,
      id: "confirmation-auditor-name-hk",
      label: copy.auditorName,
      name: "auditorName" as const,
      placeholder: copy.draftDocument.managedFields.placeholders.auditorName,
    },
    {
      anchor: {
        before: ".",
        cellIndex: 0,
        kind: "table-text",
        paragraphIndex: 2,
        rowIndex: 4,
        tableIndex: 15,
      },
      className: styles.auditorAddressField,
      id: "confirmation-auditor-address-hk",
      label: copy.auditorAddress,
      name: "auditorAddress" as const,
      placeholder: copy.draftDocument.managedFields.placeholders.auditorAddress,
    },
    {
      anchor: {
        cellIndex: 0,
        kind: "table-text",
        paragraphIndex: 1,
        rowIndex: 6,
        tableIndex: 15,
        text: /\s{8,}/,
      },
      className: styles.authorizationAccountField,
      id: "confirmation-authorization-account",
      label: copy.authorizationAccount,
      name: "authorizationAccount" as const,
      placeholder:
        copy.draftDocument.managedFields.placeholders.authorizationAccount,
    },
  ];
  const visibleFields = designOwnsManagedLegacyFields(designSchema)
    ? []
    : fields.filter(
        (field) =>
          !designSchema?.fields.some(
            (designField) =>
              getActiveTemplateFieldBinding(designField) === field.name
          )
      );

  return (
    <div
      data-testid="confirmation-editable-overlay"
      data-layout-version={STANDARD_TEMPLATE_LAYOUT_VERSION}
      className="pointer-events-none absolute inset-0 z-20"
    >
      {visibleFields.flatMap((field) => {
        const anchorGeometry = pageElement
          ? resolveDocxFieldGeometry(pageElement, field.anchor, pageScale)
          : null;
        const widthAdjustedGeometry =
          anchorGeometry && field.geometryWidthRatio
            ? {
                ...anchorGeometry,
                width: anchorGeometry.width * field.geometryWidthRatio,
              }
            : anchorGeometry;
        const geometryWithBottomAdjustment =
          widthAdjustedGeometry && field.geometryBottomRatio
            ? {
                ...widthAdjustedGeometry,
                height:
                  widthAdjustedGeometry.height * field.geometryBottomRatio,
                top:
                  widthAdjustedGeometry.top +
                  widthAdjustedGeometry.height *
                    (1 - field.geometryBottomRatio),
              }
            : widthAdjustedGeometry;
        const geometry =
          geometryWithBottomAdjustment &&
          field.geometryTopOffsetRatio !== undefined
            ? {
                ...geometryWithBottomAdjustment,
                top:
                  geometryWithBottomAdjustment.top -
                  geometryWithBottomAdjustment.height *
                    field.geometryTopOffsetRatio,
              }
            : geometryWithBottomAdjustment;
        const resolvedCoverGeometry =
          pageElement && field.coverAnchor
            ? resolveDocxFieldGeometry(
                pageElement,
                field.coverAnchor,
                pageScale
              )
            : null;
        const coverGeometry = resolvedCoverGeometry
          ? {
              ...resolvedCoverGeometry,
              height:
                resolvedCoverGeometry.height + (field.coverPaddingBottom ?? 0),
            }
          : geometry
            ? getDocxFieldSourceCoverGeometry(geometry)
            : null;

        if (pageElement && !geometry) {
          return [];
        }

        const choices = baseInformationChoices(
          field.name,
          baseInformationOptions
        );

        return [
          coverGeometry ? (
            <div
              key={`${field.name}-source-placeholder-cover`}
              aria-hidden="true"
              data-confirmation-source-cover="true"
              className="pointer-events-none absolute bg-white"
              style={coverGeometry}
            />
          ) : null,
          <div
            key={field.name}
            data-confirmation-field={field.name}
            className={`pointer-events-auto absolute ${geometry ? "" : field.className}`}
            style={geometry ?? undefined}
          >
            <Label htmlFor={field.id} className="sr-only">
              {field.label}
            </Label>
            {field.options ? (
              <Select
                value={form.watch(field.name)}
                onValueChange={(nextValue) => {
                  form.setValue(field.name, nextValue ?? "", {
                    shouldDirty: true,
                  });
                  onCommitDraft();
                }}
              >
                <SelectTrigger
                  id={field.id}
                  aria-readonly={readOnly}
                  className={cn(
                    "absolute inset-0 z-10 h-full min-w-0 w-full justify-start rounded-sm border border-slate-300 bg-white px-1 py-0 text-left font-normal leading-none text-slate-900 shadow-none focus-visible:border-primary focus-visible:ring-0",
                    MANAGED_OVERLAY_TEXT_CLASS,
                    styles.overlaySelectValue
                  )}
                  disabled={readOnly}
                >
                  <SelectValue
                    className="line-clamp-none min-w-0 overflow-hidden text-left text-clip whitespace-nowrap"
                    placeholder={field.placeholder}
                  >
                    {form.watch(field.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : choices.length ? (
              <LinkedTemplateFieldInput
                choices={choices}
                emptyOptionsLabel={
                  copy.templateLibrary.workbench.fieldSettings.emptyOptions
                }
                field={field}
                id={field.id}
                onChange={(nextValue, commit) => {
                  form.setValue(field.name, nextValue, {
                    shouldDirty: true,
                  });
                  if (commit) {
                    onCommitDraft();
                  }
                }}
                readOnly={readOnly}
                className={
                  field.name === "bankName"
                    ? MANAGED_OVERLAY_LONG_TEXT_CLASS
                    : MANAGED_OVERLAY_TEXT_CLASS
                }
                value={form.watch(field.name)}
              />
            ) : (
              <Input
                id={field.id}
                placeholder={field.placeholder}
                readOnly={readOnly}
                aria-readonly={readOnly}
                className={`absolute inset-0 z-10 h-full w-full rounded-sm border border-slate-300 bg-white px-1 py-0 ${field.name === "bankName" ? MANAGED_OVERLAY_LONG_TEXT_CLASS : MANAGED_OVERLAY_TEXT_CLASS} leading-none text-slate-900 shadow-none transition-colors placeholder:text-slate-400 focus-visible:border-primary focus-visible:bg-white focus-visible:ring-0`}
                {...form.register(field.name)}
              />
            )}
          </div>,
        ].filter(Boolean);
      })}
    </div>
  );
}

type SecuritiesTemplateCode = Extract<
  ConfirmationDraftTemplateCode,
  | "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
  | "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2"
>;

type SecuritiesEditorFieldName =
  | "accountNumber"
  | "auditorAddress"
  | "auditorName"
  | "clientName"
  | "micEmail"
  | "micName"
  | "micNameAndInitial"
  | "officeDate"
  | "salutation"
  | "recipientAddress"
  | "recipientName"
  | "referenceCode"
  | "yearEndDate";

type SecuritiesOverlayField = {
  anchor: DocxFieldAnchor;
  fallbackClassName: string;
  geometryInset?: { leftRatio: number; widthRatio: number };
  geometryWidthRatio?: number;
  id: string;
  label: string;
  name: SecuritiesEditorFieldName;
  options?: readonly { label: string; value: string }[];
  placeholder: string;
  sourceLineAbsorbed?: boolean;
  sourceLineCoverLeadingRatio?: number;
};

function SecuritiesConfirmationPageOneFields({
  copy,
  designSchema,
  form,
  pageElement,
  pageScale = 1,
  readOnly,
  templateCode,
  onCommitDraft,
}: Pick<DocumentProps, "copy" | "form"> & {
  designSchema: ConfirmationTemplateDesign | null;
  pageElement?: HTMLElement;
  pageScale?: number;
  readOnly: boolean;
  onCommitDraft: () => void;
  templateCode: Exclude<
    ConfirmationDraftTemplateCode,
    "STANDARD_FINANCIAL_INSTITUTION"
  >;
}) {
  const fields = getSecuritiesOverlayFields(
    copy,
    templateCode as SecuritiesTemplateCode
  );
  const visibleFields = designOwnsManagedLegacyFields(designSchema)
    ? []
    : fields.filter(
        (field) =>
          !designSchema?.fields.some(
            (designField) =>
              getActiveTemplateFieldBinding(designField) === field.name
          )
      );

  return (
    <div
      data-testid="confirmation-editable-overlay"
      data-layout-version={SECURITIES_TEMPLATE_LAYOUT_VERSION}
      className="pointer-events-none absolute inset-0 z-20"
    >
      {visibleFields.flatMap((field, fieldIndex) => {
        const resolvedGeometry = pageElement
          ? resolveDocxFieldGeometry(pageElement, field.anchor, pageScale)
          : null;
        const markerGeometry =
          resolvedGeometry && field.anchor.kind === "text"
            ? {
                height: resolvedGeometry.height + 2,
                left: resolvedGeometry.left - 2,
                top: resolvedGeometry.top - 1,
                width: resolvedGeometry.width + 4,
              }
            : resolvedGeometry;
        const widthAdjustedGeometry =
          markerGeometry && field.geometryWidthRatio
            ? {
                ...markerGeometry,
                width: markerGeometry.width * field.geometryWidthRatio,
              }
            : markerGeometry;
        const geometry =
          widthAdjustedGeometry && field.geometryInset
            ? {
                ...widthAdjustedGeometry,
                left:
                  widthAdjustedGeometry.left +
                  widthAdjustedGeometry.width * field.geometryInset.leftRatio,
                width:
                  widthAdjustedGeometry.width * field.geometryInset.widthRatio,
              }
            : widthAdjustedGeometry;

        if (pageElement && !geometry) {
          return [];
        }
        const inputId = `${field.id}-${fieldIndex}`;
        const value = form.watch(field.name);
        const sourceLineCoverLeading =
          field.sourceLineAbsorbed && geometry
            ? geometry.height * (field.sourceLineCoverLeadingRatio ?? 0)
            : 0;
        const sourceLineCoverGeometry =
          field.sourceLineAbsorbed && geometry
            ? {
                ...geometry,
                height: geometry.height + 2,
                left: geometry.left - sourceLineCoverLeading,
                top: geometry.top - 1,
                width: geometry.width + sourceLineCoverLeading,
              }
            : null;
        const coverGeometry =
          sourceLineCoverGeometry ??
          (geometry ? getDocxFieldSourceCoverGeometry(geometry) : null);

        return [
          coverGeometry ? (
            <div
              key={`${inputId}-source-line-cover`}
              aria-hidden="true"
              data-confirmation-source-cover="true"
              data-confirmation-source-line-cover={
                field.sourceLineAbsorbed ? "true" : undefined
              }
              className="pointer-events-none absolute bg-white"
              style={coverGeometry}
            />
          ) : null,
          <div
            key={inputId}
            data-confirmation-field={field.name}
            data-source-line-absorbed={
              field.sourceLineAbsorbed ? "true" : undefined
            }
            className={`pointer-events-auto absolute ${geometry ? "" : field.fallbackClassName}`}
            style={geometry ?? undefined}
          >
            <Label htmlFor={inputId} className="sr-only">
              {field.label}
            </Label>
            {field.options ? (
              <Select
                value={value}
                onValueChange={(nextValue) => {
                  form.setValue(field.name, nextValue ?? "", {
                    shouldDirty: true,
                  });
                  onCommitDraft();
                }}
              >
                <SelectTrigger
                  id={inputId}
                  aria-readonly={readOnly}
                  className={cn(
                    "absolute inset-0 z-10 h-full min-w-0 w-full justify-start rounded-sm border border-slate-300 bg-white px-0.5 py-0 text-left font-normal leading-none text-slate-900 shadow-none focus-visible:border-primary focus-visible:ring-0",
                    MANAGED_OVERLAY_TEXT_CLASS,
                    styles.overlaySelectValue
                  )}
                  disabled={readOnly}
                >
                  <SelectValue
                    className="line-clamp-none min-w-0 overflow-hidden text-left text-clip whitespace-nowrap"
                    placeholder={field.placeholder}
                  >
                    {value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={inputId}
                aria-readonly={readOnly}
                readOnly={readOnly}
                value={value}
                placeholder={field.placeholder}
                onChange={(event) =>
                  form.setValue(field.name, event.currentTarget.value, {
                    shouldDirty: true,
                  })
                }
                className={`absolute inset-0 z-10 h-full w-full rounded-sm border border-slate-300 bg-white px-0.5 py-0 ${MANAGED_OVERLAY_TEXT_CLASS} leading-none text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-0`}
              />
            )}
          </div>,
        ];
      })}
    </div>
  );
}

function getSecuritiesOverlayFields(
  copy: ConfirmationCopy,
  templateCode: SecuritiesTemplateCode
): SecuritiesOverlayField[] {
  const { managedFields } = copy.draftDocument;
  const sharedHeader: SecuritiesOverlayField[] = [
    {
      anchor: { kind: "paragraph", nodeIndex: 0 },
      fallbackClassName: styles.securitiesReferenceFallback,
      geometryInset: { leftRatio: 0.06, widthRatio: 0.58 },
      id: "confirmation-securities-reference",
      label: copy.draftDocument.hkReference,
      name: "referenceCode",
      placeholder: "",
      sourceLineAbsorbed: true,
      sourceLineCoverLeadingRatio: 0.3,
    },
    {
      anchor: { kind: "paragraph", nodeIndex: 1 },
      fallbackClassName: styles.securitiesDateFallback,
      geometryInset: { leftRatio: 0.08, widthRatio: 0.56 },
      id: "confirmation-securities-date",
      label: copy.draftDocument.hkDate,
      name: "officeDate",
      placeholder: "",
      sourceLineAbsorbed: true,
      sourceLineCoverLeadingRatio: 0.4,
    },
    {
      anchor: { kind: "text", marker: "[Recipient Name]" },
      fallbackClassName: styles.securitiesRecipientNameFallback,
      id: "confirmation-securities-recipient-name",
      label: managedFields.labels.recipientName,
      name: "recipientName",
      placeholder: managedFields.placeholders.recipientName,
    },
    {
      anchor: { kind: "text", marker: "[Recipient Address]" },
      fallbackClassName: styles.securitiesRecipientAddressFallback,
      id: "confirmation-securities-recipient-address",
      label: managedFields.labels.recipientAddress,
      name: "recipientAddress",
      placeholder: managedFields.placeholders.recipientAddress,
    },
    {
      anchor: { kind: "text", marker: /Sirs?\s*\/\s*Madam/i },
      fallbackClassName: styles.securitiesSalutationFallback,
      geometryWidthRatio: 1.25,
      id: "confirmation-securities-salutation",
      label: managedFields.labels.salutation,
      name: "salutation",
      options: getSalutationOptions(copy),
      placeholder: managedFields.placeholders.salutation,
    },
  ];

  if (templateCode === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1") {
    return [
      ...sharedHeader,
      textOverlayField(
        "auditorName",
        managedFields.labels.auditorName,
        "[Auditor Name]",
        0,
        managedFields.placeholders.auditorName
      ),
      textOverlayField(
        "yearEndDate",
        managedFields.labels.yearEndDate,
        "[Year end date]",
        0,
        managedFields.placeholders.yearEndDate
      ),
      {
        anchor: { kind: "paragraph", nodeIndex: 12 },
        fallbackClassName: styles.securitiesAccountNumberFallback,
        geometryInset: { leftRatio: 0.24, widthRatio: 0.46 },
        id: "confirmation-securities-account-number",
        label: managedFields.labels.accountNumber,
        name: "accountNumber",
        placeholder: managedFields.placeholders.accountNumber,
      },
      textOverlayField(
        "auditorName",
        managedFields.labels.auditorName,
        "[Auditor Name]",
        1,
        managedFields.placeholders.auditorName
      ),
      textOverlayField(
        "auditorAddress",
        managedFields.labels.auditorAddress,
        "[Auditor Address]",
        0,
        managedFields.placeholders.auditorAddress
      ),
      textOverlayField(
        "micName",
        managedFields.labels.micName,
        "[MIC Name]",
        0,
        managedFields.placeholders.micName
      ),
      textOverlayField(
        "clientName",
        managedFields.labels.clientName,
        "[Client Name]",
        0,
        managedFields.placeholders.clientName
      ),
    ];
  }

  return [
    ...sharedHeader,
    {
      ...textOverlayField(
        "clientName",
        managedFields.labels.clientName,
        "[Client’s Name]",
        0,
        managedFields.placeholders.clientName
      ),
      geometryWidthRatio: 2.5,
    },
    textOverlayField(
      "auditorName",
      managedFields.labels.auditorName,
      "[Auditor Name]",
      0,
      managedFields.placeholders.auditorName
    ),
    textOverlayField(
      "auditorAddress",
      managedFields.labels.auditorAddress,
      "[Auditor Address]",
      0,
      managedFields.placeholders.auditorAddress
    ),
    textOverlayField(
      "micEmail",
      managedFields.labels.micEmail,
      "[MIC Email]",
      0,
      managedFields.placeholders.micEmail
    ),
    textOverlayField(
      "micNameAndInitial",
      managedFields.labels.micNameAndInitial,
      "[MIC Name and Initial]",
      0,
      managedFields.placeholders.micNameAndInitial
    ),
    textOverlayField(
      "yearEndDate",
      managedFields.labels.yearEndDate,
      "[Year end date]",
      0,
      managedFields.placeholders.yearEndDate
    ),
    textOverlayField(
      "clientName",
      managedFields.labels.clientName,
      "[Client’s Name]",
      1,
      managedFields.placeholders.clientName
    ),
  ];
}

function textOverlayField(
  name: SecuritiesEditorFieldName,
  label: string,
  marker: string,
  occurrence = 0,
  placeholder = label
): SecuritiesOverlayField {
  return {
    anchor: { kind: "text", marker, occurrence },
    fallbackClassName: styles.securitiesGenericFallback,
    id: `confirmation-securities-${name}`,
    label,
    name,
    placeholder,
  };
}

type DocumentProps = {
  copy: ConfirmationCopy;
  form: UseFormReturn<EditorValues>;
};

function getEditorValues(
  draft: ConfirmationDraftPayload | null,
  derivedValues?: ConfirmationDerivedValues
): EditorValues {
  return {
    accountNumber: draft?.accountNumber ?? "",
    auditorAddress: draft?.auditorAddress ?? "",
    auditorName: draft?.auditorName ?? "",
    authorizationAccount: draft?.authorizationAccount ?? "",
    bankBranch: draft?.bankBranch ?? "",
    bankName: draft?.bankName ?? "",
    confirmationInformationLibraryEntryId:
      draft?.confirmationInformationLibraryEntryId ?? "",
    companyHandlerName: draft?.companyHandlerName ?? "",
    companyHandlerPhone: draft?.companyHandlerPhone ?? "",
    companyHandlerTitle: draft?.companyHandlerTitle ?? "",
    companySignatureDate: draft?.companySignatureDate ?? "",
    clientName: draft?.clientName ?? derivedValues?.clientName ?? "",
    counterpartyAddress: draft?.counterpartyAddress ?? "",
    counterpartyAttention: draft?.counterpartyAttention ?? "",
    counterpartyContact: draft?.counterpartyContact ?? "",
    counterpartyEmail: draft?.counterpartyEmail ?? "",
    counterpartyPhone: draft?.counterpartyPhone ?? "",
    draftNotes: draft?.draftNotes ?? "",
    micEmail: draft?.micEmail ?? "",
    micName: draft?.micName ?? "",
    micNameAndInitial: draft?.micNameAndInitial ?? draft?.micName ?? "",
    officeDate: draft?.officeDate ?? "",
    picName: draft?.picName ?? derivedValues?.picName ?? "",
    recipientAddress: draft?.recipientAddress ?? "",
    recipientName: draft?.recipientName ?? "",
    referenceCode: draft?.referenceCode ?? "",
    reportDate: draft?.reportDate ?? derivedValues?.balanceSheetDate ?? "",
    receivingSupplement: draft?.receivingSupplement ?? "",
    replyAddress: draft?.replyAddress ?? "",
    replyContact: draft?.replyContact ?? "",
    replyEmail: draft?.replyEmail ?? "",
    replyFax: draft?.replyFax ?? "",
    replyPhone: draft?.replyPhone ?? "",
    replyPostalCode: draft?.replyPostalCode ?? "",
    salutation: normalizeSalutation(draft?.salutation),
    yearEndDate:
      draft?.yearEndDate ||
      draft?.reportDate ||
      derivedValues?.balanceSheetDate ||
      "",
  };
}

function toDraftPayload(
  values: EditorValues,
  current: ConfirmationDraftPayload | null,
  templateDesignSchema = getTemplateDesignSchema(current),
  templateFieldValues = getTemplateFieldValues(current)
): ConfirmationDraftPayload {
  const templateAvailableCodes = getTemplateAvailableCodesSnapshot(current);
  const excludedFieldIds = new Set(
    templateDesignSchema?.fields
      .filter((field) => field.kind === "STATIC_TEXT" || field.kind === "MASK")
      .map((field) => field.id)
  );
  const normalizedTemplateFieldValues = Object.fromEntries(
    Object.entries(templateFieldValues).filter(
      ([fieldId]) => !excludedFieldIds.has(fieldId)
    )
  );
  return {
    ...values,
    salutation: normalizeSalutation(values.salutation),
    ...(current?.sections ? { sections: current.sections } : {}),
    ...(templateDesignSchema ? { templateDesignSchema } : {}),
    ...(templateAvailableCodes ? { templateAvailableCodes } : {}),
    templateFieldValues: normalizedTemplateFieldValues,
  };
}

export function getEditableConfirmationDraftPayload(
  draft: ConfirmationDraftPayload | null
) {
  return toDraftPayload(
    getEditorValues(draft),
    draft,
    getTemplateDesignSchema(draft),
    getTemplateFieldValues(draft)
  );
}
