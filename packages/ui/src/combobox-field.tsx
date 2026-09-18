"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { Ref } from "react";

import { Input } from "./input";
import { Spinner } from "./spinner";

export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type ComboboxFieldProps = {
  /** Controlled semantic value; filtering never changes selection by itself. */
  value: string;
  options: readonly ComboboxOption[];
  onValueChange: (value: string) => void;
  label: string;
  searchLabel: string;
  emptyMessage: string;
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  loading?: boolean;
  descriptionId?: string;
  ref?: Ref<HTMLButtonElement>;
};

/** Searchable single selection. Search text is local; only a choice emits a value. */
export function ComboboxField({
  value,
  options,
  onValueChange,
  label,
  searchLabel,
  emptyMessage,
  placeholder,
  id,
  name,
  disabled,
  readOnly,
  required,
  invalid,
  loading,
  descriptionId,
  ref,
}: ComboboxFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [query, setQuery] = useState("");
  const items = useMemo(() => [...options], [options]);
  const selected = items.find((item) => item.value === value) ?? null;
  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={controlId} className="text-sm font-medium">
        {label}
      </label>
      <ComboboxPrimitive.Root
        items={items}
        value={selected}
        name={name}
        required={required}
        disabled={disabled || loading}
        readOnly={readOnly}
        isItemEqualToValue={(item, current) => item.value === current.value}
        onValueChange={(item) => {
          if (!disabled && !loading && !readOnly && !item?.disabled) {
            onValueChange(item?.value ?? "");
          }
        }}
        inputValue={query}
        onInputValueChange={setQuery}
        onOpenChange={() => setQuery("")}
      >
        <ComboboxPrimitive.Trigger
          ref={ref}
          id={controlId}
          data-slot="combobox-trigger"
          aria-label={label}
          aria-describedby={descriptionId}
          aria-invalid={invalid || undefined}
          aria-busy={loading || undefined}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 md:h-8"
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          {loading ? (
            <Spinner aria-hidden="true" className="size-4" />
          ) : (
            <ChevronDown
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
          )}
        </ComboboxPrimitive.Trigger>
        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Positioner
            side="bottom"
            align="start"
            sideOffset={4}
            className="z-50"
          >
            <ComboboxPrimitive.Popup className="border-border bg-popover text-popover-foreground w-(--anchor-width) max-w-(--available-width) overflow-hidden rounded-lg border shadow-lg">
              <div className="border-border border-b p-2">
                <ComboboxPrimitive.Input
                  aria-label={searchLabel}
                  placeholder={searchLabel}
                  render={<Input className="h-11 md:h-9" />}
                />
              </div>
              <ComboboxPrimitive.Empty>
                <p className="text-muted-foreground p-3 text-sm">
                  {emptyMessage}
                </p>
              </ComboboxPrimitive.Empty>
              <ComboboxPrimitive.List className="max-h-60 overflow-y-auto p-1">
                {(item: ComboboxOption) => (
                  <ComboboxPrimitive.Item
                    key={item.value}
                    value={item}
                    disabled={item.disabled}
                    className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex min-h-11 cursor-default items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm data-disabled:opacity-50 md:min-h-0"
                  >
                    {item.label}
                    <ComboboxPrimitive.ItemIndicator>
                      <Check aria-hidden="true" className="size-4" />
                    </ComboboxPrimitive.ItemIndicator>
                  </ComboboxPrimitive.Item>
                )}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>
    </div>
  );
}
