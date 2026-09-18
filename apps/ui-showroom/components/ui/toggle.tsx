/* eslint-disable react/no-react-children */

"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { useFeedback } from "@/hooks/use-feedback";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-pressed:bg-accent data-pressed:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 min-w-9 px-2",
        icon: "size-9",
        "icon-sm": "size-8",
        lg: "h-10 min-w-10 px-2.5",
        sm: "h-8 min-w-8 px-1.5",
      },
      variant: {
        default: "bg-transparent",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 data-pressed:bg-accent/80 data-pressed:text-accent-foreground",
        outline:
          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 data-pressed:bg-secondary/60",
      },
    },
  }
);

type ToggleProps = Omit<TogglePrimitive.Props, "onPressedChange"> &
  VariantProps<typeof toggleVariants> & {
    asChild?: boolean;
    onPressedChange?: (pressed: boolean) => void;
  };

function Toggle({
  className,
  variant,
  size,
  onPressedChange,
  asChild = false,
  children,
  render,
  nativeButton,
  ...props
}: ToggleProps) {
  const playOn = useFeedback({ sound: "toggleOn" });
  const playOff = useFeedback({ sound: "toggleOff" });

  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ className, size, variant }))}
      nativeButton={nativeButton ?? (asChild ? false : undefined)}
      onPressedChange={(pressed, _details) => {
        if (pressed) {
          playOn();
        } else {
          playOff();
        }
        onPressedChange?.(pressed);
      }}
      render={
        asChild ? (React.Children.only(children) as React.ReactElement) : render
      }
      {...props}
    >
      {asChild ? undefined : children}
    </TogglePrimitive>
  );
}

export { Toggle, toggleVariants };
