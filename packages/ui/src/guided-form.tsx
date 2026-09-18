"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { joinFieldDescriptionIds } from "./field-metadata";

export interface GuidedFormStep {
  id: string;
  label: string;
  completed?: boolean;
  disabled?: boolean;
}

export interface GuidedFormProps {
  label: string;
  appearance?: "contained" | "plain" | "grouped";
  steps: GuidedFormStep[];
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  aside?: ReactNode;
  actions: ReactNode;
}

export interface GuidedFormIntroProps {
  title: string;
  description?: string;
  choices?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  alternative?: ReactNode;
}

/** A quiet starting surface; callers own identity, search and progression. */
export function GuidedFormIntro({
  title,
  description,
  choices,
  children,
  actions,
  alternative,
}: GuidedFormIntroProps) {
  const titleId = useId();
  return (
    <section className="pw-guided-form-intro" aria-labelledby={titleId}>
      <div className="pw-guided-form-intro-body">
        <header>
          <h1 id={titleId}>{title}</h1>
          {description ? <p>{description}</p> : null}
        </header>
        <div className="pw-guided-form-intro-search">{children}</div>
        {choices ? (
          <div className="pw-guided-form-intro-choices">{choices}</div>
        ) : null}
        {actions ? (
          <div className="pw-guided-form-intro-actions">{actions}</div>
        ) : null}
        {alternative ? (
          <div className="pw-guided-form-intro-alternative">{alternative}</div>
        ) : null}
      </div>
    </section>
  );
}

/** Presentation only: validation, progression and persistence remain with the caller. */
export function GuidedForm({
  label,
  appearance = "contained",
  steps,
  value,
  onValueChange,
  children,
  aside,
  actions,
}: GuidedFormProps) {
  return (
    <section
      aria-label={label}
      className="pw-guided-form"
      data-appearance={appearance}
      data-surface={appearance === "contained" ? "contained" : "page"}
    >
      <nav aria-label={label} className="pw-guided-form-steps">
        <ol>
          {steps.map((step, index) => (
            <li key={step.id} data-current={step.id === value || undefined}>
              <Button
                variant="quiet"
                disabled={step.disabled}
                aria-current={step.id === value ? "step" : undefined}
                onClick={() => onValueChange(step.id)}
              >
                <span className="pw-guided-form-step-index" aria-hidden="true">
                  {step.completed ? <Check /> : index + 1}
                </span>
                {step.label}
              </Button>
            </li>
          ))}
        </ol>
      </nav>
      <div
        className="pw-guided-form-body"
        data-aside={Boolean(aside) || undefined}
      >
        <div className="pw-guided-form-main">{children}</div>
        {aside ? <aside className="pw-guided-form-aside">{aside}</aside> : null}
      </div>
      <footer className="pw-guided-form-actions">{actions}</footer>
    </section>
  );
}

export function GuidedFormSection({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const id = useId();
  return (
    <section className="pw-guided-form-section" aria-labelledby={id}>
      <header>
        <h2 id={id}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="pw-guided-form-fields" data-columns={columns}>
        {children}
      </div>
    </section>
  );
}

type FieldControlProps = {
  id?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

export function GuidedFormField({
  id,
  label,
  description,
  error,
  required,
  describedBy: additionalDescriptionIds,
  span = "auto",
  children,
}: {
  id: string;
  label: string;
  description?: ReactNode;
  error?: string;
  required?: boolean;
  describedBy?: string;
  span?: "auto" | "full";
  children: (control: FieldControlProps) => ReactNode;
}) {
  const describedBy = joinFieldDescriptionIds(
    additionalDescriptionIds,
    description ? `${id}-help` : null,
    error ? `${id}-error` : null
  );
  return (
    <div className="pw-guided-form-field" data-span={span}>
      <label htmlFor={id} id={`${id}-label`}>
        {label}
        {required ? (
          <span aria-hidden="true" className="pw-guided-form-required">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        "aria-labelledby": `${id}-label`,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
        "aria-required": required,
      })}
      {description ? (
        <p className="pw-guided-form-help" id={`${id}-help`}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="pw-guided-form-error" role="alert" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface GuidedFormChoice {
  value: string;
  label: string;
  description?: string;
  annotation?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

/** Action cards use button semantics: focus/navigation alone must not activate a route. */
export function GuidedFormEntryActions({
  label,
  options,
  onAction,
}: {
  label: string;
  options: GuidedFormChoice[];
  onAction: (value: string) => void;
}) {
  return (
    <fieldset aria-label={label} className="pw-guided-form-entry-actions">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="outline"
          className="pw-guided-form-entry"
          disabled={option.disabled}
          onClick={() => onAction(option.value)}
        >
          <span className="pw-guided-form-entry-body">
            {option.icon ? (
              <span className="pw-guided-form-entry-icon" aria-hidden="true">
                {option.icon}
              </span>
            ) : null}
            <strong>{option.label}</strong>
            {option.description ? (
              <span className="pw-guided-form-entry-description">
                {option.description}
              </span>
            ) : null}
          </span>
        </Button>
      ))}
    </fieldset>
  );
}

export function GuidedFormChoices({
  label,
  name,
  value,
  onValueChange,
  options,
  disabled,
  layout = "columns",
}: {
  label: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: GuidedFormChoice[];
  disabled?: boolean;
  layout?: "columns" | "stacked" | "tiles" | "inline";
}) {
  const generatedName = useId();
  return (
    <fieldset
      className="pw-guided-form-choices"
      disabled={disabled}
      data-layout={layout}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="pw-guided-form-choice"
          data-selected={value === option.value || undefined}
          data-disabled={disabled || option.disabled || undefined}
        >
          <input
            type="radio"
            name={name ?? generatedName}
            value={option.value}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            onChange={() => onValueChange(option.value)}
          />
          {option.icon ? (
            <span className="pw-guided-form-choice-icon" aria-hidden="true">
              {option.icon}
            </span>
          ) : null}
          <span className="pw-guided-form-choice-copy">
            <strong>
              {option.label}
              {option.annotation ? (
                <small className="pw-guided-form-choice-note">
                  {option.annotation}
                </small>
              ) : null}
            </strong>
            {option.description ? <span>{option.description}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export interface GuidedFormSelectOption {
  value: string;
  label: string;
  code?: string;
  description?: string;
  disabled?: boolean;
}

export interface GuidedFormSelectProps extends FieldControlProps {
  value: string;
  onValueChange: (value: string) => void;
  options: GuidedFormSelectOption[];
  selectedOption?: GuidedFormSelectOption;
  placeholder: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Local or external search; localized copy and business data belong to the caller. */
  search?: {
    placeholder: string;
    groupLabel: string;
    showGroupLabel?: boolean;
    emptyLabel: string;
    clearLabel: string;
    clearSelectionLabel: string;
    /** External search keeps query/data ownership with the feature. */
    onQueryChange?: (query: string) => void;
    filter?: "local" | "external";
    status?: ReactNode;
  };
}

function GuidedFormSearchSelect({
  value,
  onValueChange,
  options,
  selectedOption,
  placeholder,
  icon,
  search,
  disabled,
  ...control
}: GuidedFormSelectProps & {
  search: NonNullable<GuidedFormSelectProps["search"]>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const selected =
    options.find((option) => option.value === value) ??
    (selectedOption?.value === value ? selectedOption : null);
  const selectedLabel = selected
    ? [selected.label, selected.code].filter(Boolean).join(" · ")
    : placeholder;
  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    const anchor = anchorRef.current;
    if (
      nextOpen &&
      anchor &&
      window.innerHeight - anchor.getBoundingClientRect().bottom <
        Math.min(240, window.innerHeight / 2)
    ) {
      anchor.scrollIntoView({ block: "center", behavior: "instant" });
    }
  };
  return (
    <Combobox.Root<GuidedFormSelectOption>
      items={options}
      value={selected}
      disabled={disabled}
      open={open}
      inputValue={open ? query : (selected?.label ?? "")}
      onInputValueChange={(nextQuery, details) => {
        setQuery(nextQuery);
        if (details.reason === "input-change") {
          search.onQueryChange?.(nextQuery);
        }
      }}
      onOpenChange={changeOpen}
      onValueChange={(option) => {
        if (option && !option.disabled) {
          onValueChange(option.value);
        }
      }}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(option, text) => {
        if (search.filter === "external") {
          return true;
        }
        if (text === selected?.label) {
          return true;
        }
        const haystack = `${option.label} ${option.code ?? ""}`
          .normalize("NFKC")
          .toLocaleLowerCase();
        return text
          .normalize("NFKC")
          .trim()
          .toLocaleLowerCase()
          .split(/\s+/)
          .every((part) => haystack.includes(part));
      }}
    >
      <Combobox.InputGroup
        ref={anchorRef}
        className="pw-guided-form-search-input"
        data-invalid={control["aria-invalid"] || undefined}
      >
        <span aria-hidden="true" className="pw-guided-form-picker-icon">
          {!open && selected && icon ? icon : <Search />}
        </span>
        <Combobox.Input
          {...control}
          ref={inputRef}
          aria-label={
            control["aria-labelledby"] ? undefined : search.placeholder
          }
          aria-describedby={
            [
              control["aria-describedby"],
              !open && selected?.code && control.id
                ? `${control.id}-code`
                : undefined,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          placeholder={disabled === true ? placeholder : search.placeholder}
          title={open ? undefined : selectedLabel}
          onFocus={() => {
            if (!open) {
              setQuery(selected?.label ?? "");
              search.onQueryChange?.(selected?.label ?? "");
              changeOpen(true);
              inputRef.current?.select();
            }
          }}
          onClick={() => {
            if (!open) {
              setQuery(selected?.label ?? "");
              search.onQueryChange?.(selected?.label ?? "");
              changeOpen(true);
            }
          }}
        />
        {!open && selected?.code ? (
          <span
            className="pw-guided-form-picker-code"
            id={control.id ? `${control.id}-code` : undefined}
          >
            {selected.code}
          </span>
        ) : null}
        {(open ? query : selected) ? (
          <Button
            disabled={disabled}
            variant="quiet"
            size="icon-sm"
            aria-label={open ? search.clearLabel : search.clearSelectionLabel}
            onClick={() => {
              if (!open) {
                onValueChange("");
              }
              inputRef.current?.focus();
              setQuery("");
              search.onQueryChange?.("");
              changeOpen(true);
            }}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner
          align="start"
          anchor={anchorRef}
          side="bottom"
          collisionAvoidance={{
            side: "none",
            align: "shift",
            fallbackAxisSide: "none",
          }}
          sideOffset={4}
          className="pw-guided-form-picker-positioner"
        >
          <Combobox.Popup
            className="pw-guided-form-picker"
            data-group-label={
              search.showGroupLabel === false ? "hidden" : "visible"
            }
            aria-label={search.groupLabel}
            initialFocus={false}
          >
            {(search.showGroupLabel ?? true) ? (
              <div className="pw-guided-form-picker-group" aria-hidden="true">
                {search.groupLabel}
              </div>
            ) : null}
            {search.status ? (
              <div className="pw-guided-form-picker-status">
                {search.status}
              </div>
            ) : (
              <Combobox.Empty
                render={<output />}
                className="pw-guided-form-picker-empty"
              >
                {search.emptyLabel}
              </Combobox.Empty>
            )}
            <Combobox.List
              className="pw-guided-form-picker-list"
              aria-label={search.groupLabel}
            >
              {(option: GuidedFormSelectOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  aria-label={[option.label, option.code, option.description]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={option.disabled}
                  className="pw-guided-form-picker-item"
                  data-description={Boolean(option.description) || undefined}
                >
                  {icon ? (
                    <span
                      className="pw-guided-form-picker-icon"
                      aria-hidden="true"
                    >
                      {icon}
                    </span>
                  ) : null}
                  <span
                    className="pw-guided-form-picker-label"
                    title={option.label}
                  >
                    {option.label}
                  </span>
                  {option.code ? (
                    <span
                      className="pw-guided-form-picker-code"
                      title={option.code}
                    >
                      {option.code}
                    </span>
                  ) : null}
                  <span className="pw-guided-form-picker-check">
                    <Combobox.ItemIndicator>
                      <Check aria-hidden="true" />
                    </Combobox.ItemIndicator>
                  </span>
                  {option.description ? (
                    <span className="pw-guided-form-picker-description">
                      {option.description}
                    </span>
                  ) : null}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export function GuidedFormSelect({
  value,
  onValueChange,
  options,
  selectedOption,
  placeholder,
  icon,
  search,
  ...control
}: GuidedFormSelectProps) {
  if (search) {
    return (
      <GuidedFormSearchSelect
        {...control}
        value={value}
        onValueChange={onValueChange}
        options={options}
        selectedOption={selectedOption}
        placeholder={placeholder}
        icon={icon}
        search={search}
      />
    );
  }
  const selected = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            {...control}
            fullWidth
            variant="outline"
            className="pw-guided-form-select"
            aria-labelledby={
              control.id && control["aria-labelledby"]
                ? `${control["aria-labelledby"]} ${control.id}-value`
                : control["aria-labelledby"]
            }
          />
        }
      >
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span
          id={control.id ? `${control.id}-value` : undefined}
          className="pw-guided-form-select-value"
          data-placeholder={!selected || undefined}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              closeOnClick
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GuidedFormSummary({
  title,
  status,
  items,
}: {
  title: string;
  status?: ReactNode;
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <section className="pw-guided-form-summary" aria-label={title}>
      <h2>{title}</h2>
      {status ? <p className="pw-guided-form-help">{status}</p> : null}
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
