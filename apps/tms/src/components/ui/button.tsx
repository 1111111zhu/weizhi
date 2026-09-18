import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,opacity] duration-[var(--motion-fast)] ease-[var(--motion-ease)] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        outline:
          "border-border bg-card hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5",
        sm: "h-7 gap-1 rounded-md px-2 text-xs",
        lg: "h-9 gap-1.5 px-3",
        icon: "size-8",
        "icon-sm": "size-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props &
    VariantProps<typeof buttonVariants> & {
      accessibleName?: React.ReactNode;
      showTooltip?: boolean;
      tooltip?: React.ReactNode;
    }
>(
  (
    {
      accessibleName,
      children,
      className,
      disabled,
      showTooltip = true,
      title,
      tooltip,
      variant = "default",
      size = "default",
      ...props
    },
    ref
  ) => {
    void title;
    const accessibleNameId = React.useId();
    const resolvedAccessibleName = accessibleName ?? tooltip;
    const button = (
      <ButtonPrimitive
        aria-labelledby={resolvedAccessibleName ? accessibleNameId : undefined}
        ref={ref}
        data-slot="button"
        disabled={disabled}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {resolvedAccessibleName ? (
          <span id={accessibleNameId} hidden>
            {resolvedAccessibleName}
          </span>
        ) : null}
        {children}
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

Button.displayName = "Button";

export { Button, buttonVariants };
