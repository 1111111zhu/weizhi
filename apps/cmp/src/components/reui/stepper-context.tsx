"use client";

import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";

import { cn } from "../../lib/utils";

export type StepperOrientation = "horizontal" | "vertical";
export type StepState = "active" | "completed" | "inactive" | "loading";
export type StepIndicators = {
  active?: ReactNode;
  completed?: ReactNode;
  inactive?: ReactNode;
  loading?: ReactNode;
};

interface StepperContextValue {
  idPrefix: string;
  activeStep: number;
  setActiveStep: (step: number) => void;
  stepsCount: number;
  orientation: StepperOrientation;
  registerTrigger: (node: HTMLButtonElement | null) => void;
  triggerNodes: HTMLButtonElement[];
  focusNext: (currentIdx: number) => void;
  focusPrev: (currentIdx: number) => void;
  focusFirst: () => void;
  focusLast: () => void;
  indicators: StepIndicators;
}

interface StepItemContextValue {
  step: number;
  state: StepState;
  isDisabled: boolean;
  isLoading: boolean;
}

const StepperContext = createContext<StepperContextValue | undefined>(
  undefined
);
const StepItemContext = createContext<StepItemContextValue | undefined>(
  undefined
);

export function useStepper() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error("useStepper must be used within a Stepper");
  }
  return context;
}

export function useStepItem() {
  const context = useContext(StepItemContext);
  if (!context) {
    throw new Error("useStepItem must be used within a StepperItem");
  }
  return context;
}

export interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  idPrefix?: string;
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  orientation?: StepperOrientation;
  indicators?: StepIndicators;
}

const EMPTY_STEP_INDICATORS: StepIndicators = {};

export function Stepper({
  idPrefix,
  defaultValue = 1,
  value,
  onValueChange,
  orientation = "horizontal",
  className,
  children,
  indicators = EMPTY_STEP_INDICATORS,
  ...props
}: StepperProps) {
  const generatedId = useId();
  const resolvedIdPrefix = idPrefix ?? `stepper-${generatedId}`;
  const [activeStep, setActiveStep] = useState(defaultValue);
  const [triggerNodes, setTriggerNodes] = useState<HTMLButtonElement[]>([]);
  const registerTrigger = useCallback((node: HTMLButtonElement | null) => {
    setTriggerNodes((current) => {
      if (node && !current.includes(node)) {
        return [...current, node];
      }
      return current;
    });
  }, []);
  const handleSetActiveStep = useCallback(
    (step: number) => {
      if (value === undefined) {
        setActiveStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange]
  );
  const currentStep = value ?? activeStep;
  const focusTrigger = useCallback(
    (index: number) => triggerNodes[index]?.focus(),
    [triggerNodes]
  );
  const focusNext = useCallback(
    (index: number) => focusTrigger((index + 1) % triggerNodes.length),
    [focusTrigger, triggerNodes.length]
  );
  const focusPrev = useCallback(
    (index: number) =>
      focusTrigger((index - 1 + triggerNodes.length) % triggerNodes.length),
    [focusTrigger, triggerNodes.length]
  );
  const focusFirst = useCallback(() => focusTrigger(0), [focusTrigger]);
  const focusLast = useCallback(
    () => focusTrigger(triggerNodes.length - 1),
    [focusTrigger, triggerNodes.length]
  );
  const stepChildren = useMemo(
    () => (Array.isArray(children) ? children : [children]),
    [children]
  );
  const contextValue = useMemo<StepperContextValue>(
    () => ({
      idPrefix: resolvedIdPrefix,
      activeStep: currentStep,
      setActiveStep: handleSetActiveStep,
      stepsCount: stepChildren.filter(
        (child): child is ReactElement =>
          isValidElement(child) &&
          (child.type as { displayName?: string }).displayName === "StepperItem"
      ).length,
      orientation,
      indicators,
      registerTrigger,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      triggerNodes,
    }),
    [
      currentStep,
      resolvedIdPrefix,
      handleSetActiveStep,
      stepChildren,
      orientation,
      registerTrigger,
      triggerNodes,
      focusFirst,
      focusLast,
      focusNext,
      focusPrev,
      indicators,
    ]
  );

  return (
    <StepperContext.Provider value={contextValue}>
      <div
        role="tablist"
        aria-orientation={orientation}
        data-slot="stepper"
        className={cn("w-full", className)}
        data-orientation={orientation}
        {...props}
      >
        {children}
      </div>
    </StepperContext.Provider>
  );
}

export interface StepperItemProps extends HTMLAttributes<HTMLDivElement> {
  step: number;
  completed?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export function StepperItem({
  step,
  completed,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const { activeStep } = useStepper();
  const isCompleted = completed ?? step < activeStep;
  const state: StepState = isCompleted
    ? "completed"
    : activeStep === step
      ? "active"
      : "inactive";
  const isLoading = loading && step === activeStep;
  const itemContextValue = useMemo(
    () => ({ step, state, isDisabled: disabled, isLoading }),
    [disabled, isLoading, state, step]
  );

  return (
    <StepItemContext.Provider value={itemContextValue}>
      <div
        data-slot="stepper-item"
        className={cn(
          "group/step flex items-center justify-center not-last:flex-1 group-data-[orientation=horizontal]/stepper-nav:flex-row group-data-[orientation=vertical]/stepper-nav:flex-col",
          className
        )}
        data-state={state}
        {...(isLoading ? { "data-loading": true } : {})}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  );
}

StepperItem.displayName = "StepperItem";
