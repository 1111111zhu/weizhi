"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type * as React from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root {...props} />;
}
function AlertDialogContent({
  className,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px]" />
      <AlertDialogPrimitive.Popup
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-5 shadow-lg sm:max-w-sm",
          className
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}
function AlertDialogHeader(props: React.ComponentProps<"div">) {
  return <div className="grid gap-1.5" {...props} />;
}
function AlertDialogFooter(props: React.ComponentProps<"div">) {
  return <div className="flex justify-end gap-2" {...props} />;
}
function AlertDialogTitle(props: AlertDialogPrimitive.Title.Props) {
  return <AlertDialogPrimitive.Title className="font-semibold" {...props} />;
}
function AlertDialogDescription(props: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      className="text-sm text-muted-foreground"
      {...props}
    />
  );
}
function AlertDialogCancel(props: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      render={<Button variant="outline" />}
      {...props}
    />
  );
}
function AlertDialogAction(props: React.ComponentProps<typeof Button>) {
  return <Button variant="destructive" {...props} />;
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
};
