"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "./utils";

export const buttonVariantNames = [
  "primary",
  "secondary",
  "outline",
  "quiet",
  "danger",
  "success",
  "warning",
  "success-light",
  "warning-light",
] as const;

export type CanonicalButtonVariant = (typeof buttonVariantNames)[number];
export type LegacyButtonVariant = "default" | "ghost" | "destructive" | "link";
export type ButtonVariant = CanonicalButtonVariant | LegacyButtonVariant;

export const buttonSizeNames = ["xs", "sm", "md", "lg"] as const;

export type CanonicalButtonSize = (typeof buttonSizeNames)[number];
export type LegacyButtonSize =
  | "default"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";
export type ButtonSize = CanonicalButtonSize | LegacyButtonSize;

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 active:not-disabled:translate-y-px aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/80",
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        success: "bg-success-accent text-success-accent-foreground",
        warning: "bg-warning-accent text-warning-accent-foreground",
        outline:
          "border-border bg-card hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground aria-pressed:border-primary/30 aria-pressed:bg-primary/5 aria-pressed:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        "success-light":
          "border-success-accent/50 bg-success-subtle text-foreground hover:bg-success/15",
        "warning-light":
          "border-warning-accent/50 bg-warning-subtle text-foreground hover:bg-warning/15",
        quiet: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        danger:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-2 px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-9 gap-2 px-3",
        lg: "h-10 gap-2 px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);
const canonicalVariantAliases: Record<
  Exclude<LegacyButtonVariant, "link">,
  CanonicalButtonVariant
> = {
  default: "primary",
  ghost: "quiet",
  destructive: "danger",
};

function getCanonicalVariant(variant: ButtonVariant): ButtonVariant {
  if (variant === "link") {
    return variant;
  }
  return variant in canonicalVariantAliases
    ? canonicalVariantAliases[variant as Exclude<LegacyButtonVariant, "link">]
    : variant;
}

function getPublicSize(size: ButtonSize): ButtonSize {
  return size === "default" ? "md" : size;
}

export type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    accessibleName?: React.ReactNode;
    fullWidth?: boolean;
    iconEnd?: React.ReactNode;
    iconStart?: React.ReactNode;
    loading?: boolean;
    loadingLabel?: React.ReactNode;
    showTooltip?: boolean;
    tooltip?: React.ReactNode;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      accessibleName,
      children,
      className,
      disabled,
      fullWidth = false,
      iconEnd,
      iconStart,
      loading = false,
      loadingLabel,
      showTooltip = true,
      size = "default",
      title,
      tooltip,
      variant = "default",
      ...props
    },
    ref
  ) => {
    void title;
    const accessibleNameId = React.useId();
    const resolvedAccessibleName = accessibleName ?? tooltip;
    const resolvedSize = (size ?? "default") as ButtonSize;
    const resolvedVariant = (variant ?? "default") as ButtonVariant;
    const publicSize = getPublicSize(resolvedSize);
    const publicVariant = getCanonicalVariant(resolvedVariant);
    const content = loading && loadingLabel ? loadingLabel : children;
    const button = (
      <ButtonPrimitive
        ref={ref}
        aria-busy={loading || undefined}
        aria-labelledby={resolvedAccessibleName ? accessibleNameId : undefined}
        className={cn(
          buttonVariants({ size: resolvedSize, variant: resolvedVariant }),
          "pw-button",
          className
        )}
        data-full-width={fullWidth || undefined}
        data-legacy-size={
          resolvedSize === publicSize ? undefined : resolvedSize
        }
        data-legacy-variant={
          resolvedVariant === publicVariant ? undefined : resolvedVariant
        }
        data-loading={loading || undefined}
        data-size={publicSize}
        data-slot="button"
        data-variant={publicVariant}
        disabled={disabled || loading}
        {...props}
      >
        {resolvedAccessibleName ? (
          <span id={accessibleNameId} hidden>
            {resolvedAccessibleName}
          </span>
        ) : null}
        {loading ? (
          <span aria-hidden="true" className="pw-button-spinner" />
        ) : iconStart ? (
          <span aria-hidden="true" className="pw-button-icon">
            {iconStart}
          </span>
        ) : null}
        {content ? <span className="pw-button-label">{content}</span> : null}
        {!loading && iconEnd ? (
          <span aria-hidden="true" className="pw-button-icon">
            {iconEnd}
          </span>
        ) : null}
      </ButtonPrimitive>
    );

    if (!tooltip || !showTooltip) {
      return button;
    }

    return (
      <Tooltip>
        {disabled ? (
          <TooltipTrigger render={<span className="inline-flex" />}>
            {button}
          </TooltipTrigger>
        ) : (
          <TooltipTrigger render={button} />
        )}
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
);

export type IconButtonProps = Omit<
  React.ComponentPropsWithoutRef<typeof Button>,
  | "accessibleName"
  | "children"
  | "fullWidth"
  | "iconEnd"
  | "iconStart"
  | "loadingLabel"
  | "tooltip"
> & {
  icon: React.ReactNode;
  label: string;
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, label, ...props }, ref) => (
    <Button
      {...props}
      ref={ref}
      aria-label={label}
      className={cn("pw-icon-button", className)}
      iconStart={icon}
    />
  )
);

Button.displayName = "Button";
IconButton.displayName = "IconButton";

export { Button, IconButton, buttonVariants };
