"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useCallback, useEffect, useRef } from "react";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";
import {
  useStepItem as useStepItemContext,
  useStepper as useStepperContext,
} from "./stepper-context";

export {
  Stepper,
  StepperItem,
  useStepItem,
  useStepper,
} from "./stepper-context";
export type { StepperItemProps, StepperProps } from "./stepper-context";

export type StepperTriggerProps = useRender.ComponentProps<"button">;

function StepperTrigger({
  className,
  children,
  tabIndex,
  render,
  ...props
}: StepperTriggerProps) {
  const { state, isLoading, step, isDisabled } = useStepItemContext();
  const {
    idPrefix,
    setActiveStep,
    activeStep,
    registerTrigger,
    triggerNodes,
    focusNext,
    focusPrev,
    focusFirst,
    focusLast,
  } = useStepperContext();
  const isSelected = activeStep === step;
  const id = `${idPrefix}-tab-${step}`;
  const panelId = `${idPrefix}-panel-${step}`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const setButtonRef = useCallback((node: HTMLButtonElement | null) => {
    buttonRef.current = node;
  }, []);

  useEffect(() => {
    if (buttonRef.current) {
      registerTrigger(buttonRef.current);
    }
  }, [registerTrigger]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const triggerIndex = triggerNodes.findIndex((node: HTMLButtonElement) =>
      Object.is(node, buttonRef.current)
    );
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown": {
        event.preventDefault();
        if (triggerIndex !== -1) {
          focusNext(triggerIndex);
        }
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        event.preventDefault();
        if (triggerIndex !== -1) {
          focusPrev(triggerIndex);
        }
        break;
      }
      case "Home": {
        event.preventDefault();
        focusFirst();
        break;
      }
      case "End": {
        event.preventDefault();
        focusLast();
        break;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        setActiveStep(step);
        break;
      }
      default: {
        break;
      }
    }
  };
  const defaultProps = {
    role: "tab",
    id,
    "aria-selected": isSelected,
    "aria-controls": panelId,
    tabIndex: typeof tabIndex === "number" ? tabIndex : isSelected ? 0 : -1,
    "data-slot": "stepper-trigger",
    "data-state": state,
    "data-loading": isLoading,
    className: cn(
      "focus-visible:border-ring focus-visible:ring-ring/50 inline-flex cursor-pointer items-center outline-none focus-visible:z-10 focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-60",
      "gap-2.5 rounded-full",
      className
    ),
    onClick: () => setActiveStep(step),
    onKeyDown: handleKeyDown,
    disabled: isDisabled,
    children,
  };

  return useRender({
    defaultTagName: "button",
    render,
    ref: setButtonRef,
    props: mergeProps<"button">(defaultProps, props),
  });
}

function StepperIndicator({ children, className }: ComponentProps<"div">) {
  const { state, isLoading } = useStepItemContext();
  const { indicators } = useStepperContext();
  const indicator =
    (isLoading && indicators.loading) ||
    (state === "completed" && indicators.completed) ||
    (state === "active" && indicators.active) ||
    (state === "inactive" && indicators.inactive);

  return (
    <div
      data-slot="stepper-indicator"
      data-state={state}
      className={cn(
        "border-background bg-accent text-accent-foreground data-[state=completed]:bg-primary data-[state=completed]:text-primary-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative flex size-6 shrink-0 items-center justify-center overflow-hidden",
        "rounded-full text-xs",
        className
      )}
    >
      <div className="absolute">{indicator || children}</div>
    </div>
  );
}

function StepperSeparator({ className }: ComponentProps<"div">) {
  const { state } = useStepItemContext();
  return (
    <div
      data-slot="stepper-separator"
      data-state={state}
      className={cn(
        "bg-muted rounded-sm m-0.5 group-data-[orientation=horizontal]/stepper-nav:h-0.5 group-data-[orientation=horizontal]/stepper-nav:flex-1 group-data-[orientation=vertical]/stepper-nav:h-12 group-data-[orientation=vertical]/stepper-nav:w-0.5",
        className
      )}
    />
  );
}

function StepperTitle({ children, className }: ComponentProps<"h3">) {
  const { state } = useStepItemContext();
  return (
    <h3
      data-slot="stepper-title"
      data-state={state}
      className={cn("text-sm leading-none font-medium", className)}
    >
      {children}
    </h3>
  );
}

function StepperDescription({ children, className }: ComponentProps<"div">) {
  const { state } = useStepItemContext();
  return (
    <div
      data-slot="stepper-description"
      data-state={state}
      className={cn("text-muted-foreground text-sm", className)}
    >
      {children}
    </div>
  );
}

function StepperNav({ children, className, ...props }: ComponentProps<"nav">) {
  const { activeStep, orientation } = useStepperContext();
  return (
    <nav
      data-slot="stepper-nav"
      data-state={activeStep}
      data-orientation={orientation}
      className={cn(
        "group/stepper-nav inline-flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

function StepperPanel({ children, className }: ComponentProps<"div">) {
  const { activeStep } = useStepperContext();
  return (
    <div
      data-slot="stepper-panel"
      data-state={activeStep}
      className={cn("w-full", className)}
    >
      {children}
    </div>
  );
}

export interface StepperContentProps extends ComponentProps<"div"> {
  value: number;
  forceMount?: boolean;
}

function StepperContent({
  value,
  forceMount,
  children,
  className,
}: StepperContentProps) {
  const { activeStep } = useStepperContext();
  const isActive = value === activeStep;
  if (!forceMount && !isActive) {
    return null;
  }

  return (
    <div
      data-slot="stepper-content"
      data-state={activeStep}
      className={cn("w-full", className, !isActive && forceMount && "hidden")}
      hidden={!isActive && forceMount}
    >
      {children}
    </div>
  );
}

export {
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
};
