"use client";

import type { Ref } from "react";

import { Field } from "./field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export type SelectFieldOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
export type SelectFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectFieldOption[];
  label: string;
  labelVisibility?: "visible" | "hidden";
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: string;
  description?: string;
  ref?: Ref<HTMLButtonElement>;
};
export function SelectField({
  value,
  onValueChange,
  options,
  label,
  labelVisibility,
  placeholder,
  id,
  name,
  disabled,
  readOnly,
  required,
  error,
  description,
  ref,
}: SelectFieldProps) {
  const selected = options.find((option) => option.value === value);
  return (
    <Select
      value={value}
      name={name}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      onValueChange={(next) => {
        if (
          !readOnly &&
          typeof next === "string" &&
          options.some((option) => option.value === next && !option.disabled)
        ) {
          onValueChange(next);
        }
      }}
    >
      <Field
        label={label}
        labelVisibility={labelVisibility}
        id={id}
        required={required}
        disabled={disabled}
        error={error}
        description={description}
      >
        {(control) => (
          <SelectTrigger
            ref={ref}
            id={control.id}
            aria-labelledby={control["aria-labelledby"]}
            aria-describedby={control["aria-describedby"]}
            aria-invalid={control["aria-invalid"]}
            className="w-full"
          >
            <SelectValue>{selected?.label ?? placeholder}</SelectValue>
          </SelectTrigger>
        )}
      </Field>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
