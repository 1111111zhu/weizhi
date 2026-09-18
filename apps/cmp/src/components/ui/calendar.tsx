"use client";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import type { DayButton, DropdownProps, Locale } from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      className={cn("bg-background p-2", className)}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4", defaults.months),
        month: cn("flex w-full flex-col gap-4", defaults.month),
        nav: cn(
          "pointer-events-none absolute inset-x-0 top-0 flex w-full items-center justify-between",
          defaults.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "pointer-events-auto size-8 p-0",
          defaults.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "pointer-events-auto size-8 p-0",
          defaults.button_next
        ),
        month_caption: cn(
          "flex h-8 items-center justify-center px-8",
          defaults.month_caption
        ),
        dropdowns: cn(
          "flex h-8 items-center justify-center gap-1 text-sm font-medium",
          defaults.dropdowns
        ),
        dropdown_root: cn("relative", defaults.dropdown_root),
        dropdown: cn("absolute inset-0 opacity-0", defaults.dropdown),
        month_grid: cn("w-full border-collapse", defaults.month_grid),
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn(
          "flex-1 text-center text-xs font-normal text-muted-foreground",
          defaults.weekday
        ),
        week: cn("mt-1 flex w-full", defaults.week),
        day: cn("relative aspect-square flex-1 p-0 text-center", defaults.day),
        today: cn("bg-muted text-foreground", defaults.today),
        outside: cn("text-muted-foreground", defaults.outside),
        disabled: cn("text-muted-foreground opacity-50", defaults.disabled),
        ...classNames,
      }}
      components={{
        Chevron: ({ className: iconClassName, orientation, ...iconProps }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeftIcon
              : orientation === "right"
                ? ChevronRightIcon
                : ChevronDownIcon;
          return (
            <Icon className={cn("size-4", iconClassName)} {...iconProps} />
          );
        },
        Dropdown: CalendarDropdown,
        DayButton: ({ ...dayButtonProps }) => (
          <CalendarDayButton locale={locale} {...dayButtonProps} />
        ),
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDropdown({
  "aria-label": ariaLabel,
  disabled,
  onChange,
  options,
  value,
}: DropdownProps) {
  const selectedValue = value === undefined ? undefined : String(value);
  const selectValue = (nextValue: string | null) => {
    if (nextValue === null) {
      return;
    }
    const option = options?.find((item) => String(item.value) === nextValue);
    if (!option || option.disabled) {
      return;
    }
    onChange?.({
      currentTarget: { value: nextValue },
      target: { value: nextValue },
    } as React.ChangeEvent<HTMLSelectElement>);
  };

  return (
    <Select
      value={selectedValue}
      onValueChange={selectValue}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className="h-8 border-0 px-1 shadow-none"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="center" alignItemWithTrigger={false}>
        <SelectGroup>
          {options?.map((option) => (
            <SelectItem
              key={option.value}
              value={String(option.value)}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaults = getDefaultClassNames();

  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected={modifiers.selected}
      className={cn(
        "size-8 rounded-md p-0 font-normal data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
        defaults.day,
        className
      )}
      {...props}
    />
  );
}

export { Calendar };
