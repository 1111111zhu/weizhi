import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DynamicComponentProps = {
  component: React.ElementType;
  dynamicStyle?: React.CSSProperties;
  [key: string]: unknown;
};

const DynamicComponent = React.forwardRef<Element, DynamicComponentProps>(
  ({ component, dynamicStyle, label, ...props }, ref) => {
    const Component = component as React.ElementType;
    const labelId = React.useId();
    const children = props.children as React.ReactNode;

    const elementProps = {
      ...(props as Record<string, unknown>),
      "aria-labelledby": label ? labelId : undefined,
      ref,
      style: dynamicStyle,
    };
    const elementChildren = label
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "span",
            { hidden: true, id: labelId },
            label as React.ReactNode
          ),
          children
        )
      : children;

    return React.createElement(Component, elementProps, elementChildren);
  }
);
DynamicComponent.displayName = "DynamicComponent";

type DynamicBoxProps = Omit<React.ComponentProps<"div">, "style"> & {
  height?: number;
  minHeight?: number;
  paddingLeft?: string;
  position?: { x: number; y: number };
  right?: number;
  touchAction?: React.CSSProperties["touchAction"];
  width?: number;
  label?: React.ReactNode;
};

const DynamicBox = React.forwardRef<HTMLDivElement, DynamicBoxProps>(
  (
    {
      className,
      children,
      height,
      label,
      minHeight,
      paddingLeft,
      position,
      right,
      touchAction,
      width,
      ...props
    },
    ref
  ) => {
    const labelId = React.useId();

    return (
      <div
        ref={ref}
        aria-labelledby={label ? labelId : undefined}
        className={cn(className)}
        style={{
          height,
          left: position?.x,
          minHeight,
          paddingLeft,
          right,
          top: position?.y,
          touchAction,
          width,
        }}
        {...props}
      >
        {label ? (
          <span id={labelId} className="sr-only">
            {label}
          </span>
        ) : null}
        {children}
      </div>
    );
  }
);
DynamicBox.displayName = "DynamicBox";

type PositionedButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "style"
> & {
  label?: React.ReactNode;
  position: { x: number; y: number };
  touchAction?: React.CSSProperties["touchAction"];
};

type DynamicButtonProps = Omit<React.ComponentProps<typeof Button>, "style"> & {
  paddingLeft?: string;
};

const DynamicButton = React.forwardRef<HTMLButtonElement, DynamicButtonProps>(
  ({ className, paddingLeft, ...props }, ref) => (
    <Button
      ref={ref}
      className={className}
      style={{
        paddingLeft,
      }}
      {...props}
    />
  )
);
DynamicButton.displayName = "DynamicButton";
const PositionedButton = React.forwardRef<
  HTMLButtonElement,
  PositionedButtonProps
>(({ className, label, position, touchAction, ...props }, ref) => (
  <Button
    ref={ref}
    className={className}
    tooltip={label}
    style={{
      left: position.x,
      top: position.y,
      touchAction,
    }}
    {...props}
  />
));
PositionedButton.displayName = "PositionedButton";

export { DynamicBox, DynamicButton, DynamicComponent, PositionedButton };
