/* eslint-disable react/no-react-children */

"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import * as React from "react";

import { collapse, expand } from "@/audio/core";
import { useOpenStateFeedback } from "@/hooks/use-open-state-feedback";

function Collapsible({
  onOpenChange,
  sounds = false,
  render,
  ...props
}: CollapsiblePrimitive.Root.Props & {
  sounds?: boolean;
}) {
  const handleOpenChange = useOpenStateFeedback({
    closeSound: collapse,
    defaultOpen: props.defaultOpen,
    open: props.open,
    openSound: expand,
    sounds,
  });

  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      onOpenChange={(open, details) => {
        if (sounds) {
          handleOpenChange(open);
        }
        onOpenChange?.(open, details);
      }}
      render={
        render ??
        ((renderProps, state) => (
          <div {...renderProps} data-state={state.open ? "open" : "closed"} />
        ))
      }
      {...props}
    />
  );
}

function CollapsibleTrigger({
  asChild = false,
  children,
  render,
  nativeButton,
  ...props
}: CollapsiblePrimitive.Trigger.Props & { asChild?: boolean }) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      nativeButton={nativeButton ?? (asChild ? false : undefined)}
      render={
        asChild ? (React.Children.only(children) as React.ReactElement) : render
      }
      {...props}
    >
      {asChild ? undefined : children}
    </CollapsiblePrimitive.Trigger>
  );
}

function CollapsibleContent({
  forceMount = false,
  render,
  ...props
}: CollapsiblePrimitive.Panel.Props & {
  forceMount?: boolean;
}) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      keepMounted={forceMount || undefined}
      render={
        render ??
        ((renderProps, state) => (
          <div {...renderProps} data-state={state.open ? "open" : "closed"} />
        ))
      }
      {...props}
    />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
