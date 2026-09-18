import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center w-fit border border-transparent font-medium whitespace-nowrap outline-none transition-shadow",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border-border bg-transparent dark:bg-input/32",
        secondary: "bg-secondary text-secondary-foreground",
        info: "bg-info-accent text-info-accent-foreground",
        success: "bg-success-accent text-success-accent-foreground",
        warning: "bg-warning-accent text-warning-accent-foreground",
        destructive: "bg-destructive-accent text-destructive-accent-foreground",
        focus: "bg-focus text-focus-foreground",
        invert: "bg-invert text-invert-foreground",
        "primary-light":
          "border-primary/10 bg-primary/10 text-primary dark:border-primary/25 dark:bg-primary/15 dark:text-primary",
        "warning-light":
          "bg-warning-subtle text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-warning-accent gap-1.5 [&:has(svg)]:before:hidden [&_svg]:text-warning-accent",
        "success-light":
          "bg-success-subtle text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-success-accent gap-1.5 [&:has(svg)]:before:hidden [&_svg]:text-success-accent",
        "info-light":
          "bg-info-subtle text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-info-accent gap-1.5 [&:has(svg)]:before:hidden [&_svg]:text-info-accent",
        "destructive-light":
          "bg-destructive-subtle text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-destructive-accent gap-1.5 [&:has(svg)]:before:hidden [&_svg]:text-destructive-accent",
        "invert-light":
          "border-invert/15 bg-invert/10 text-foreground dark:border-invert/45 dark:bg-invert/35 dark:text-invert-foreground",
        "focus-light":
          "border-focus/15 bg-focus/10 text-focus-foreground dark:border-focus/25 dark:bg-focus/15 dark:text-focus",
        "primary-outline":
          "bg-background border-border text-primary dark:bg-input/30",
        "warning-outline":
          "bg-card border-warning-accent/50 text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-warning-accent gap-1.5 [&:has(svg)]:before:hidden [&_svg]:text-warning-accent",
        "success-outline":
          "bg-card border-success-accent/50 text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-success-accent gap-1.5 [&:has(svg)]:before:hidden [&_svg]:text-success-accent",
        "info-outline":
          "bg-card border-info-accent/50 text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-info-accent gap-1.5 [&:has(svg)]:before:hidden [&_svg]:text-info-accent",
        "destructive-outline":
          "bg-card border-destructive-accent/50 text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-destructive-accent gap-1.5 [&:has(svg)]:before:hidden [&_svg]:text-destructive-accent",
        "invert-outline":
          "bg-background border-border text-invert-foreground dark:bg-input/30",
        "focus-outline":
          "bg-background border-border text-focus-foreground dark:bg-input/30",
      },
      size: {
        xs: "px-1 py-0.25 text-[0.6rem] leading-none h-4 min-w-4 gap-1",
        sm: "px-1 py-0.25 text-[0.625rem] leading-none h-4.5 min-w-4.5 gap-1",
        default: "px-1.25 py-0.5 text-xs h-5 min-w-5 gap-1",
        lg: "px-1.5 py-0.5 text-xs h-5.5 min-w-5.5 gap-1",
        xl: "px-2 py-0.75 text-sm h-6 min-w-6 gap-1.5",
      },
      /** `default`: active style radius. `full`: pill radius. */
      radius: {
        default: "rounded-sm",
        full: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      radius: "default",
    },
  }
);

interface BadgeProps extends useRender.ComponentProps<"span"> {
  variant?: VariantProps<typeof badgeVariants>["variant"];
  size?: VariantProps<typeof badgeVariants>["size"];
  radius?: VariantProps<typeof badgeVariants>["radius"];
}

function Badge({
  className,
  variant,
  size,
  radius,
  render,
  ...props
}: BadgeProps) {
  const defaultProps = {
    "data-slot": "badge",
    className: cn(badgeVariants({ variant, size, radius, className })),
  };

  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(defaultProps, props),
  });
}

export { Badge, badgeVariants, type BadgeProps };
