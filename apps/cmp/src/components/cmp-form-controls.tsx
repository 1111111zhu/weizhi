"use client";

import {
  Button,
  ButtonGroup,
  Input,
  ViewSwitcher,
  useCompactViewport,
} from "@project-wing/ui";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useCmpI18n } from "../i18n/client";
import { cn } from "../lib/utils";
import { CmpDocumentPreviewSections } from "./cmp-document-preview-sections";
import type { CmpDocumentPreviewSection } from "./cmp-document-preview-sections";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "./reui/stepper";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export type CmpFormSectionStatus =
  | "complete"
  | "incomplete"
  | "not-started"
  | "error";

export function CollapsibleFormSection({
  sectionId,
  title,
  description,
  status,
  missingCount = 0,
  isOpen,
  onToggle,
  onFocus,
  dataAttribute,
  children,
}: {
  sectionId: string;
  title: string;
  description?: string;
  status: CmpFormSectionStatus;
  missingCount?: number;
  isOpen: boolean;
  onToggle: () => void;
  onFocus?: () => void;
  dataAttribute: "client" | "engagement";
  children: ReactNode;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const contentId = `cmp-${dataAttribute}-section-${sectionId}`;
  const statusLabel =
    status === "error"
      ? copy.formHasErrors
      : status === "incomplete"
        ? copy.formMissingItems
            .replace("{count}", String(missingCount || 1))
            .replace(
              "{items}",
              missingCount === 1 ? copy.formItem : copy.formItems
            )
        : status === "not-started"
          ? copy.formNotStarted
          : copy.formComplete;
  const StatusIcon =
    status === "error"
      ? CircleAlert
      : status === "incomplete" || status === "not-started"
        ? CircleDashed
        : CheckCircle2;

  return (
    <section
      className={`cmp-form-section cmp-collapsible-section is-${status}`}
      {...(dataAttribute === "client"
        ? { "data-client-form-section": sectionId }
        : { "data-engagement-form-section": sectionId })}
      onFocusCapture={onFocus}
    >
      <Button
        type="button"
        variant="ghost"
        className="cmp-collapsible-section-trigger"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <span className="cmp-collapsible-section-copy">
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </span>
        <span className="cmp-collapsible-section-state">
          <span className={`cmp-section-status is-${status}`}>
            <StatusIcon aria-hidden="true" />
            {statusLabel}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={isOpen ? "is-open" : undefined}
          />
        </span>
      </Button>
      <div
        id={contentId}
        className="cmp-collapsible-section-content"
        hidden={!isOpen}
      >
        {children}
      </div>
    </section>
  );
}

export type SearchSelectOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
};

export function SearchSelect({
  label,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  error,
  hint,
  required,
  disabled,
  fieldId,
  popoverClassName,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  fieldId?: string;
  popoverClassName?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((option) =>
      [option.label, option.description, option.keywords]
        .filter(Boolean)
        .some((part) => part?.toLowerCase().includes(normalized))
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
        onBlur?.();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen, onBlur]);

  return (
    <div
      ref={rootRef}
      className={`cmp-search-select${error ? " cmp-field-invalid" : ""}`}
      data-validation-field={fieldId}
    >
      <span className="cmp-field-label">
        <span>
          {label}
          {required ? <span className="cmp-required-mark"> *</span> : null}
        </span>
      </span>
      <Button
        type="button"
        variant="outline"
        className="cmp-search-select-trigger"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        onClick={() => {
          setActiveOptionIndex(0);
          setIsOpen((current) => !current);
        }}
      >
        <span
          className={selected ? undefined : "cmp-search-select-placeholder"}
        >
          {selected?.label ?? placeholder ?? copy.formSelectOption}
        </span>
        <ChevronDown aria-hidden="true" />
      </Button>
      {isOpen ? (
        <div className={cn("cmp-search-select-popover", popoverClassName)}>
          <div className="cmp-search-select-input">
            <Search aria-hidden="true" />
            <Input
              aria-label={`Search ${label}`}
              autoFocus
              value={query}
              placeholder={searchPlaceholder ?? copy.formSearch}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveOptionIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (filteredOptions.length > 0) {
                    setActiveOptionIndex(
                      (current) => (current + 1) % filteredOptions.length
                    );
                  }
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (filteredOptions.length > 0) {
                    setActiveOptionIndex(
                      (current) =>
                        (current - 1 + filteredOptions.length) %
                        filteredOptions.length
                    );
                  }
                  return;
                }
                if (event.key === "Enter") {
                  const option = filteredOptions[activeOptionIndex];
                  if (option) {
                    event.preventDefault();
                    onChange(option.value);
                    setIsOpen(false);
                    setQuery("");
                  }
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsOpen(false);
                  setQuery("");
                  onBlur?.();
                }
              }}
            />
          </div>
          <div className="cmp-search-select-options" role="listbox">
            {value ? (
              <Button
                type="button"
                variant="ghost"
                role="option"
                aria-selected="false"
                className="cmp-search-select-option"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                <span>
                  <strong>{copy.formClearSelection}</strong>
                </span>
              </Button>
            ) : null}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  role="option"
                  aria-selected={option.value === value}
                  className={cn(
                    "cmp-search-select-option",
                    index === activeOptionIndex &&
                      "cmp-search-select-option-active"
                  )}
                  onMouseEnter={() => setActiveOptionIndex(index)}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setQuery("");
                  }}
                >
                  <span>
                    <strong>{option.label}</strong>
                    {option.description ? (
                      <small>{option.description}</small>
                    ) : null}
                  </span>
                  {option.value === value ? (
                    <CheckCircle2 aria-hidden="true" />
                  ) : null}
                </Button>
              ))
            ) : (
              <span className="cmp-search-select-empty">
                {emptyText ?? copy.formNoMatchingOptions}
              </span>
            )}
          </div>
        </div>
      ) : null}
      {hint ? <span className="cmp-field-hint">{hint}</span> : null}
      {error ? <span className="cmp-field-error">{error}</span> : null}
    </div>
  );
}

export type ReviewSection = {
  id: string;
  label: string;
  status: CmpFormSectionStatus;
  items: { label: string; value?: ReactNode; wide?: boolean }[];
};

export type FormWizardStep = {
  id: string;
  label: string;
  status: CmpFormSectionStatus;
  missingCount?: number;
};

export function FormWizardStepper({
  steps,
  activeStepId,
  ariaLabel,
  onStepChange,
}: {
  steps: FormWizardStep[];
  activeStepId: string;
  ariaLabel: string;
  onStepChange: (stepId: string) => void;
}) {
  const phone = useCompactViewport(767.98);
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const activeStep = Math.max(
    1,
    steps.findIndex((step) => step.id === activeStepId) + 1
  );

  if (phone) {
    return (
      <div className="cmp-mobile-stepper">
        <ViewSwitcher
          label={ariaLabel}
          value={activeStepId}
          options={steps.map((step, index) => ({
            value: step.id,
            label: `${index + 1} / ${steps.length} · ${step.label}${step.status === "error" ? ` · ${copy.formHasErrors}` : step.status === "incomplete" ? ` · ${copy.formMissingItems.replace("{count}", String(step.missingCount || 1)).replace("{items}", step.missingCount === 1 ? copy.formItem : copy.formItems)}` : ""}`,
          }))}
          onValueChange={onStepChange}
          mobilePresentation="sheet"
        />
      </div>
    );
  }
  return (
    <Stepper
      idPrefix="client-form-major-step"
      value={activeStep}
      indicators={{ completed: <Check className="size-3.5" /> }}
      className="flex w-full justify-start overflow-x-auto px-4 py-3"
      onValueChange={(value) => {
        const step = steps[value - 1];
        if (step) {
          onStepChange(step.id);
        }
      }}
    >
      <StepperNav
        aria-label={ariaLabel}
        className="flex min-w-max items-center px-2"
      >
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isPastStep = stepNumber < activeStep;
          const isCurrentStep = stepNumber === activeStep;
          const isPastWarning =
            isPastStep &&
            (step.status === "incomplete" || step.status === "error");
          const stateLabel =
            step.status === "error"
              ? copy.formHasErrors
              : step.status === "incomplete"
                ? copy.formMissingItems
                    .replace("{count}", String(step.missingCount || 1))
                    .replace(
                      "{items}",
                      step.missingCount === 1 ? copy.formItem : copy.formItems
                    )
                : step.status === "complete"
                  ? copy.formComplete
                  : copy.formNotStarted;
          const title = titleCaseStepLabel(step.label);
          return (
            <StepperItem
              key={step.id}
              step={stepNumber}
              completed={isPastStep && step.status === "complete"}
              className="relative contents"
            >
              <StepperTrigger
                className="flex shrink-0 justify-start gap-1.5 whitespace-nowrap"
                aria-label={`${stepNumber}. ${title}: ${stateLabel}`}
                title={`${stepNumber}. ${title}: ${stateLabel}`}
              >
                <StepperIndicator
                  className={cn(
                    isCurrentStep &&
                      "bg-primary/10 text-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
                    isPastWarning &&
                      step.status === "incomplete" &&
                      "bg-warning/10 text-warning-text",
                    isPastWarning &&
                      step.status === "error" &&
                      "bg-destructive/10 text-destructive"
                  )}
                >
                  {isPastWarning ? (
                    <CircleAlert className="size-3.5" />
                  ) : (
                    stepNumber
                  )}
                </StepperIndicator>
                <StepperTitle className="text-xs whitespace-nowrap">
                  {title}
                </StepperTitle>
              </StepperTrigger>
              {steps.length > index + 1 ? (
                <StepperSeparator className="mx-1 w-auto min-w-2 group-data-[state=completed]/step:bg-primary" />
              ) : null}
            </StepperItem>
          );
        })}
      </StepperNav>
    </Stepper>
  );
}

function titleCaseStepLabel(label: string) {
  return label.replaceAll(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function FormReviewPage({
  sections,
  onEdit,
  stepNumber,
  title,
  documentSummary,
  showHeader = true,
  showSectionStatus = true,
  showEditActions = true,
}: {
  sections: ReviewSection[];
  onEdit: (sectionId: string) => void;
  stepNumber?: number;
  title?: string;
  showHeader?: boolean;
  showSectionStatus?: boolean;
  showEditActions?: boolean;
  documentSummary?: {
    code: ReactNode;
    name: ReactNode;
    status: ReactNode;
    completion: ReactNode;
  };
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  return (
    <section
      className="cmp-form-wizard-page cmp-form-review-page"
      aria-label={title ?? copy.formReviewAndSubmit}
    >
      {showHeader ? (
        documentSummary ? (
          <header className="cmp-form-wizard-page-heading cmp-form-review-heading">
            <span className="cmp-form-wizard-page-kicker">
              {stepNumber ?? copy.formReviewAndSubmit}
            </span>
            <div className="cmp-form-review-heading-copy">
              <h4>{title ?? copy.formSubmitConfirmTitle}</h4>
              <p>
                {documentSummary.code} · {documentSummary.name}
              </p>
            </div>
            <div className="cmp-form-review-heading-meta">
              <span className="cmp-form-status-badge">
                {documentSummary.status}
              </span>
              <span className="cmp-form-required-progress">
                {documentSummary.completion}
              </span>
            </div>
          </header>
        ) : (
          <header className="cmp-form-wizard-page-heading">
            <span className="cmp-form-wizard-page-kicker">
              {stepNumber ?? copy.formReviewAndSubmit}
            </span>
            <h4>{title ?? copy.formSubmitConfirmTitle}</h4>
            <p>{copy.formSubmitConfirmDescription}</p>
          </header>
        )
      ) : null}
      <CmpDocumentPreviewSections
        sections={toDocumentSections()}
        layout="form"
      />
    </section>
  );

  function toDocumentSections(): CmpDocumentPreviewSection[] {
    return sections.map((section) => ({
      id: section.id,
      title: section.label,
      status: showSectionStatus ? (
        <span className={`cmp-section-status is-${section.status}`}>
          {section.status === "complete" ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <CircleDashed aria-hidden="true" />
          )}
          {section.status === "complete"
            ? copy.formComplete
            : copy.formMissingItems
                .replace("{count}", "")
                .replace("{items}", "")}
        </span>
      ) : undefined,
      action: showEditActions ? (
        <Button
          type="button"
          variant="ghost"
          className="cmp-text-button"
          onClick={() => onEdit(section.id)}
        >
          {copy.edit}
        </Button>
      ) : undefined,
      fields: section.items
        .filter((item) => item.value !== undefined)
        .map((item, index) => ({
          id: `${section.id}-${index}`,
          label: item.label,
          wide: item.wide,
          value:
            item.value === "" || item.value === null
              ? copy.formNotProvided
              : item.value,
        })),
    }));
  }
}

export function FormReviewDialog({
  open,
  title,
  sections,
  isBusy,
  submitLabel,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  sections: ReviewSection[];
  isBusy?: boolean;
  submitLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const hasIssues = sections.some(
    (section) => section.status === "incomplete" || section.status === "error"
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isBusy && !nextOpen) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="cmp-review-dialog"
        closeLabel={copy.formCloseReview}
        overlayClassName="cmp-review-dialog-overlay"
        disableClose={isBusy}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p>{copy.formSubmitConfirmDescription}</p>
        </DialogHeader>
        <div className="cmp-review-confirmation">
          <CircleAlert aria-hidden="true" />
          <p>{copy.formSubmitConfirmQuestion}</p>
        </div>
        {hasIssues ? (
          <p className="cmp-review-blocker">{copy.formReviewBlocker}</p>
        ) : null}
        <ButtonGroup className="cmp-review-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            disabled={hasIssues || isBusy}
            onClick={onSubmit}
          >
            {isBusy ? copy.formSubmitting : submitLabel}
          </Button>
        </ButtonGroup>
      </DialogContent>
    </Dialog>
  );
}
