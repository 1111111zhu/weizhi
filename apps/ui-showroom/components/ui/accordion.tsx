/* eslint-disable react/no-react-children */

"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import type { FeedbackType } from "@/hooks/use-feedback";
import { useFeedback } from "@/hooks/use-feedback";
import { cn } from "@/lib/utils";

type AccordionPublicValue = string | string[] | undefined;

type AccordionProps = Omit<
  AccordionPrimitive.Root.Props<string>,
  "defaultValue" | "multiple" | "onValueChange" | "value"
> & {
  collapsible?: boolean;
  defaultValue?: AccordionPublicValue;
  onValueChange?: (value: string | string[]) => void;
  type?: "single" | "multiple";
  value?: AccordionPublicValue;
};

function toAccordionValues(value: AccordionPublicValue): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value : [value];
}

function Accordion({
  type = "single",
  collapsible,
  defaultValue,
  onValueChange,
  value,
  ...props
}: AccordionProps) {
  const multiple = type === "multiple";
  void collapsible;

  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      defaultValue={toAccordionValues(defaultValue)}
      multiple={multiple}
      onValueChange={(nextValue) => {
        onValueChange?.(multiple ? nextValue : (nextValue[0] ?? ""));
      }}
      value={toAccordionValues(value)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  );
}

type AccordionTriggerProps = AccordionPrimitive.Trigger.Props & {
  asChild?: boolean;
  haptic?: boolean;
  sound?: FeedbackType;
};

function AccordionTrigger({
  className,
  children,
  onClick,
  sound,
  haptic,
  asChild = false,
  render,
  nativeButton,
  ...props
}: AccordionTriggerProps) {
  const play = useFeedback({ haptic, sound });

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-open]>svg]:rotate-180",
          className
        )}
        nativeButton={nativeButton ?? (asChild ? false : undefined)}
        onClick={(event) => {
          play();
          onClick?.(event);
        }}
        render={
          asChild
            ? (React.Children.only(children) as React.ReactElement)
            : render
        }
        {...props}
      >
        {asChild ? undefined : children}
        {asChild ? null : (
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" />
        )}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-closed:animate-accordion-up data-open:animate-accordion-down"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
