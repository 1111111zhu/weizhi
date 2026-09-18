"use client";

import { projectWingToast as sonnerToast } from "@project-wing/ui";
import { usePathname } from "next/navigation";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";

import { sanitizeErrorDescription } from "../lib/error-toast";

type ToastVariant = "info" | "success" | "destructive";

type ToastAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
};

type ToastMessage = {
  title: string;
  description?: string;
  duration?: number | null;
  actions?: ToastAction[];
  variant?: ToastVariant;
  closeButton?: boolean;
  dismissOnNavigation?: boolean;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ToastVariant;
};

type ConfirmRequest = Required<
  Pick<ConfirmOptions, "title" | "confirmLabel" | "cancelLabel" | "variant">
> &
  Pick<ConfirmOptions, "description"> & {
    resolve: (value: boolean) => void;
  };

type ToastContextValue = {
  toast: (toast: ToastMessage) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dismiss: (id: string | number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastNavigationLifecycle({
  navigationToasts,
}: {
  navigationToasts: { current: Set<string | number> };
}) {
  const pathname = usePathname();

  useEffect(() => {
    const clear = () => {
      navigationToasts.current.forEach((id) => sonnerToast.dismiss(id));
      navigationToasts.current.clear();
    };
    clear();
    window.addEventListener("popstate", clear);
    return () => window.removeEventListener("popstate", clear);
  }, [navigationToasts, pathname]);

  return null;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const navigationToasts = useRef(new Set<string | number>());
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null
  );
  const dismiss = useCallback((id: string | number) => {
    sonnerToast.dismiss(id);
  }, []);
  const toast = useCallback((message: ToastMessage) => {
    const {
      title,
      description,
      duration = 4000,
      variant = "info",
      actions,
      closeButton,
      dismissOnNavigation,
    } = message;
    const options = {
      description: sanitizeErrorDescription(description),
      duration: duration ?? Infinity,
      closeButton,
      onDismiss: (notification: { id: string | number }) => navigationToasts.current.delete(notification.id),
      onAutoClose: (notification: { id: string | number }) => navigationToasts.current.delete(notification.id),
      action: actions?.[0]
        ? { label: actions[0].label, onClick: actions[0].onClick }
        : undefined,
    };

    const notify = variant === "success" ? sonnerToast.success
      : variant === "destructive" ? sonnerToast.error : sonnerToast.info;
    const id = notify(title, options);
    if (dismissOnNavigation) navigationToasts.current.add(id);
  }, []);
  const confirm = useCallback(
    ({
      title,
      description,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      variant = "destructive",
    }: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmRequest({
          title,
          description,
          confirmLabel,
          cancelLabel,
          variant,
          resolve,
        });
      }),
    []
  );
  const settleConfirm = useCallback(
    (value: boolean) => {
      if (!confirmRequest) {
        return;
      }
      confirmRequest.resolve(value);
      setConfirmRequest(null);
    },
    [confirmRequest]
  );
  const value = useMemo(
    () => ({ toast, confirm, dismiss }),
    [toast, confirm, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      <Suspense fallback={null}>
        <ToastNavigationLifecycle navigationToasts={navigationToasts} />
      </Suspense>
      {children}
      <Toaster />
      <ConfirmDialog
        request={confirmRequest}
        onCancel={() => settleConfirm(false)}
        onConfirm={() => settleConfirm(true)}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function useOptionalToast() {
  return useContext(ToastContext);
}

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The named scroll region must receive keyboard focus so long impact lists remain readable. */
function ConfirmDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => !open && onCancel()}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {request?.title}
          </DialogTitle>
          {request?.description ? (
            <section
              aria-label={request.title}
              tabIndex={0}
              className="max-h-64 overflow-y-auto"
            >
              <DialogDescription className="text-sm leading-6 break-words whitespace-pre-line text-muted-foreground">
                {request.description}
              </DialogDescription>
            </section>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <ButtonGroup>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onCancel}
            >
              {request?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              type="button"
              variant={
                request?.variant === "destructive" ? "destructive" : "default"
              }
              size="lg"
              onClick={onConfirm}
            >
              {request?.confirmLabel ?? "Confirm"}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */
