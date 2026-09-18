"use client";

import { NumberField as NumberPrimitive } from "@base-ui/react/number-field";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import type { Ref } from "react";

import { Button } from "./button";
import { Field } from "./field";
import { Input } from "./input";

type ChoiceStateProps = {
  label: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  descriptionId?: string;
};
export type SwitchProps = ChoiceStateProps & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
};
export function Switch({
  label,
  id,
  name,
  checked,
  onCheckedChange,
  disabled,
  readOnly,
  required,
  invalid,
  descriptionId,
  ref,
}: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div className="flex min-h-11 items-center gap-3 text-sm">
      <SwitchPrimitive.Root
        id={controlId}
        ref={ref}
        name={name}
        nativeButton
        render={<button type="button" aria-label={label} />}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={descriptionId}
        className="bg-input focus-visible:ring-ring data-checked:bg-primary relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors outline-none after:absolute after:-inset-x-1 after:-inset-y-2.5 focus-visible:ring-2 focus-visible:ring-offset-2 data-disabled:cursor-not-allowed data-disabled:opacity-50"
      >
        <SwitchPrimitive.Thumb className="bg-background size-5 rounded-full shadow-sm transition-transform data-checked:translate-x-5 motion-reduce:transition-none" />
      </SwitchPrimitive.Root>
      <label htmlFor={controlId} className="flex min-h-11 items-center">
        <span>{label}</span>
      </label>
    </div>
  );
}

export type RadioGroupProps = ChoiceStateProps & {
  value: string;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  onValueChange: (value: string) => void;
};
export function RadioGroup({
  label,
  id,
  name,
  value,
  options,
  onValueChange,
  disabled,
  readOnly,
  required,
  invalid,
  descriptionId,
}: RadioGroupProps) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <RadioGroupPrimitive
        id={id}
        name={name}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={descriptionId}
        value={value}
        onValueChange={(next) => onValueChange(next)}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        className="grid gap-1"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 items-center gap-3 text-sm"
          >
            <RadioPrimitive.Root
              value={option.value}
              disabled={option.disabled}
              className="border-input focus-visible:ring-ring data-checked:border-primary flex size-4 shrink-0 items-center justify-center rounded-full border outline-none focus-visible:ring-2 data-disabled:opacity-50"
            >
              <RadioPrimitive.Indicator className="bg-primary size-2 rounded-full" />
            </RadioPrimitive.Root>
            <span>{option.label}</span>
          </label>
        ))}
      </RadioGroupPrimitive>
    </fieldset>
  );
}

export type NumberInputProps = ChoiceStateProps & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  decrementLabel: string;
  incrementLabel: string;
  error?: string;
  description?: string;
  ref?: Ref<HTMLInputElement>;
};
export function NumberInput({
  label,
  id,
  name,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  decrementLabel,
  incrementLabel,
  error,
  description,
  disabled,
  readOnly,
  required,
  invalid,
  descriptionId,
  ref,
}: NumberInputProps) {
  return (
    <Field
      label={label}
      id={id}
      error={error}
      description={description}
      descriptionId={descriptionId}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      invalid={invalid}
    >
      {(control) => (
        <NumberPrimitive.Root
          id={control.id}
          name={name}
          value={value}
          onValueChange={(next) => onValueChange(next)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
        >
          <NumberPrimitive.Group className="flex min-w-0 items-center gap-1">
            <NumberPrimitive.Decrement
              aria-label={decrementLabel}
              render={<Button variant="outline" size="icon" />}
            >
              <Minus />
            </NumberPrimitive.Decrement>
            <NumberPrimitive.Input
              {...control}
              ref={ref}
              render={<Input className="text-center" />}
            />
            <NumberPrimitive.Increment
              aria-label={incrementLabel}
              render={<Button variant="outline" size="icon" />}
            >
              <Plus />
            </NumberPrimitive.Increment>
          </NumberPrimitive.Group>
        </NumberPrimitive.Root>
      )}
    </Field>
  );
}

export type SliderProps = ChoiceStateProps & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};
export function Slider({
  label,
  id,
  name,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  readOnly,
  invalid,
  descriptionId,
}: SliderProps) {
  return (
    <Field
      label={label}
      id={id}
      invalid={invalid}
      descriptionId={descriptionId}
    >
      {(control) => (
        <SliderPrimitive.Root
          name={name}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={(next) => {
            if (!readOnly) {
              onValueChange(next);
            }
          }}
        >
          <SliderPrimitive.Control className="flex min-h-11 w-full touch-none items-center px-2 data-disabled:opacity-50">
            <SliderPrimitive.Track className="bg-input relative h-2 w-full rounded-full">
              <SliderPrimitive.Indicator className="bg-primary rounded-full" />
              <SliderPrimitive.Thumb
                id={control.id}
                aria-labelledby={control["aria-labelledby"]}
                aria-describedby={control["aria-describedby"]}
                aria-invalid={control["aria-invalid"]}
                aria-readonly={readOnly || undefined}
                className="border-primary bg-background focus-visible:ring-ring size-4 rounded-full border shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              />
            </SliderPrimitive.Track>
          </SliderPrimitive.Control>
        </SliderPrimitive.Root>
      )}
    </Field>
  );
}

export type ToggleButtonProps = {
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
};
export function ToggleButton({
  label,
  pressed,
  onPressedChange,
  disabled,
  ref,
}: ToggleButtonProps) {
  return (
    <Button
      ref={ref}
      type="button"
      variant={pressed ? "secondary" : "outline"}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
    >
      {label}
    </Button>
  );
}
