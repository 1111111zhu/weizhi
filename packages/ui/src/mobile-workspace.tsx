"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, ArrowUp, ChevronRight, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import type { ComponentProps, MouseEvent, ReactNode, Ref } from "react";

import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { useMobileKeyboardViewport } from "./mobile-keyboard-viewport";
import { cn } from "./utils";

/** Experimental touch-first layout, with focused-input viewport sizing. */
export function MobileScaffold({
  header,
  footer,
  children,
  label,
  contentRef,
  density = "default",
}: {
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  label: string;
  contentRef?: Ref<HTMLDivElement>;
  density?: "default" | "compact";
}) {
  const shellRef = useRef<HTMLElement>(null);
  useMobileKeyboardViewport(shellRef);
  return (
    <section
      ref={shellRef}
      className="pw-mobile-scaffold"
      aria-label={label}
      data-density={density}
    >
      {header}
      <div ref={contentRef} className="pw-mobile-content">
        {children}
      </div>
      {footer ? <footer className="pw-mobile-footer">{footer}</footer> : null}
    </section>
  );
}

export function MobilePageHeader({
  title,
  context,
  back,
  action,
}: {
  title: string;
  context?: string;
  back?: { label: string; href: string; onBack?: () => void };
  action?: ReactNode;
}) {
  return (
    <header className="pw-mobile-header">
      {back ? (
        <a
          className="pw-mobile-icon-action"
          href={back.href}
          aria-label={back.label}
          onClick={(event) => {
            if (
              back.onBack &&
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              event.preventDefault();
              back.onBack();
            }
          }}
        >
          <ArrowLeft aria-hidden />
        </a>
      ) : null}
      <div className="pw-mobile-heading">
        {context ? <p>{context}</p> : null}
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}

export type MobileNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
};
export function MobileNavigation({
  items,
  activeId,
  label,
  variant = "primary",
}: {
  items: MobileNavigationItem[];
  activeId: string;
  label: string;
  variant?: "primary" | "modes";
}) {
  return (
    <nav
      className="pw-mobile-navigation"
      aria-label={label}
      data-variant={variant}
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          onClick={(event) => item.onNavigate?.(event)}
          aria-current={item.id === activeId ? "page" : undefined}
        >
          <span className="pw-mobile-navigation-icon">
            {item.icon}
            {item.badge ? (
              <span className="pw-mobile-badge">{item.badge}</span>
            ) : null}
          </span>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

export function MobileListItem({
  title,
  description,
  meta,
  icon,
  href,
  action,
  secondaryAction,
  showChevron = true,
  onNavigate,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  icon?: ReactNode;
  href: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  showChevron?: boolean;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div
      className="pw-mobile-list-item"
      data-secondary-action={secondaryAction ? "true" : undefined}
    >
      <a href={href} className="pw-mobile-list-link" onClick={onNavigate}>
        {icon ? (
          <span className="pw-mobile-file-icon" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="pw-mobile-list-copy">
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
          {meta ? <span className="pw-mobile-list-meta">{meta}</span> : null}
        </span>
        {showChevron ? (
          <ChevronRight className="pw-mobile-chevron" aria-hidden />
        ) : null}
      </a>
      {secondaryAction ? (
        <>
          <div className="pw-mobile-list-primary-action">{action}</div>
          <div className="pw-mobile-list-secondary-action">
            {secondaryAction}
          </div>
        </>
      ) : (
        action
      )}
    </div>
  );
}

export function MobileSelectionRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="pw-mobile-selection-row">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span className="pw-mobile-list-copy">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </span>
    </label>
  );
}

export function MobileTextArea({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea className={cn("pw-mobile-textarea", className)} {...props} />
  );
}

export function MobileComposer({
  value,
  onValueChange,
  onSubmit,
  label,
  submitLabel,
  accessory,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  label: string;
  submitLabel: string;
  accessory?: ReactNode;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const resize = () => {
      input.style.height = "auto";
      if (!value) {
        return;
      }
      const maximum = Number(
        getComputedStyle(input).maxHeight.replace(/px$/, "")
      );
      input.style.height = `${Math.min(input.scrollHeight, Number.isFinite(maximum) ? maximum : input.scrollHeight)}px`;
    };
    resize();
    let lastWidth = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== lastWidth) {
        lastWidth = input.clientWidth;
        resize();
      }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [value]);
  return (
    <form
      className="pw-mobile-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim() && !composing.current) {
          onSubmit();
        }
      }}
    >
      {accessory}
      <div className="pw-mobile-composer-field">
        <MobileTextArea
          ref={inputRef}
          aria-label={label}
          placeholder={label}
          rows={1}
          enterKeyHint="enter"
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          maxLength={10_000}
        />
        <Button
          type="submit"
          className="pw-mobile-composer-send"
          variant="quiet"
          aria-label={submitLabel}
          disabled={!value.trim()}
          onPointerDown={(event) => {
            if (document.activeElement === inputRef.current) {
              event.preventDefault();
            }
          }}
        >
          <span className="pw-mobile-composer-send-icon">
            <ArrowUp aria-hidden />
          </span>
        </Button>
      </div>
    </form>
  );
}

export function MobileActionSheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel = "Close",
  onOpenChangeComplete,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel?: string;
  onOpenChangeComplete?: (open: boolean) => void;
  children: ReactNode;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  useMobileKeyboardViewport(popupRef, open);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="pw-mobile-sheet-backdrop" />
        <Dialog.Popup ref={popupRef} className="pw-mobile-sheet">
          <div className="pw-mobile-sheet-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close
              render={
                <Button
                  variant="quiet"
                  className="pw-mobile-icon-action"
                  aria-label={closeLabel}
                  onPointerDown={(event) => {
                    const focused = document.activeElement;
                    if (
                      focused instanceof HTMLElement &&
                      popupRef.current?.contains(focused) &&
                      focused.matches(
                        'input, textarea, [contenteditable="true"]'
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                />
              }
            >
              <X aria-hidden />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="pw-mobile-sheet-description">
              {description}
            </Dialog.Description>
          ) : null}
          <div className="pw-mobile-sheet-actions">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
