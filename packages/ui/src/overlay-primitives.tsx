"use client";

import { AlertDialog as AlertPrimitive } from "@base-ui/react/alert-dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { Button } from "./button";
import { useCompactViewport } from "./hooks/use-compact-viewport";
import { useMobileKeyboardViewport } from "./mobile-keyboard-viewport";
import { ResponsiveDialogSurface } from "./responsive-dialog-surface";

export type ModalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
  actions?: ReactNode;
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  size?: "sm" | "md" | "lg";
};
export function ModalDialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  actions,
  dismissible = true,
  initialFocusRef,
  size = "md",
}: ModalDialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next || dismissible) {
          onOpenChange(next);
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="pw-core-backdrop" />
        <DialogPrimitive.Popup
          render={<ResponsiveDialogSurface />}
          initialFocus={initialFocusRef}
          className="pw-core-dialog"
          data-size={size}
        >
          <header className="border-border flex shrink-0 items-start justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-muted-foreground mt-1 text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              disabled={!dismissible}
              render={
                <Button
                  type="button"
                  variant="quiet"
                  size="icon"
                  aria-label={closeLabel}
                />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 overflow-y-auto p-4">{children}</div>
          {actions ? (
            <footer className="border-border flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">
              {actions}
            </footer>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  error?: string;
  intent?: "default" | "danger";
};
/** The caller closes after a successful operation; confirmation does not imply success. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading,
  error,
  intent = "default",
}: ConfirmDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <AlertPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next || !loading) {
          onOpenChange(next);
        }
      }}
    >
      <AlertPrimitive.Portal>
        <AlertPrimitive.Backdrop className="pw-core-backdrop" />
        <AlertPrimitive.Popup
          render={<ResponsiveDialogSurface />}
          className="pw-core-dialog"
          data-size="sm"
          initialFocus={cancel}
        >
          <div className="grid gap-3 p-4">
            <AlertPrimitive.Title className="text-lg font-semibold">
              {title}
            </AlertPrimitive.Title>
            <AlertPrimitive.Description className="text-muted-foreground text-sm">
              {description}
            </AlertPrimitive.Description>
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <footer className="border-border flex justify-end gap-2 border-t p-4">
            <AlertPrimitive.Close
              ref={cancel}
              disabled={loading}
              render={<Button type="button" variant="outline" />}
            >
              {cancelLabel}
            </AlertPrimitive.Close>
            <Button
              type="button"
              variant={intent === "danger" ? "danger" : "primary"}
              disabled={loading}
              loading={loading}
              loadingLabel={confirmLabel}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </footer>
        </AlertPrimitive.Popup>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}

export type DrawerProps = Omit<ModalDialogProps, "size"> & {
  side?: "start" | "end";
};
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  actions,
  dismissible = true,
  initialFocusRef,
  side = "end",
}: DrawerProps) {
  const popup = useRef<HTMLDivElement>(null);
  useMobileKeyboardViewport(popup, useCompactViewport(767.98));
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next || dismissible) {
          onOpenChange(next);
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="pw-core-backdrop" />
        <DialogPrimitive.Popup
          ref={popup}
          initialFocus={initialFocusRef}
          className="pw-core-drawer"
          data-side={side}
        >
          <header className="border-border flex shrink-0 items-start justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-muted-foreground mt-1 text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              disabled={!dismissible}
              render={
                <Button
                  type="button"
                  variant="quiet"
                  size="icon"
                  aria-label={closeLabel}
                />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          {actions ? (
            <footer className="border-border flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">
              {actions}
            </footer>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
