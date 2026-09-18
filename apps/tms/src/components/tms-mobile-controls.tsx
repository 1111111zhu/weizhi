"use client";
import { Button, MobileActionSheet } from "@project-wing/ui";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { getTmsMobileCopy } from "@/i18n/mobile";
import type { TmsLocale } from "@/i18n/settings";

import styles from "./tms-mobile.module.css";

export function TmsMobileControls({
  label,
  title,
  locale,
  children,
  disabled = false,
}: {
  label: string;
  title?: string;
  locale: TmsLocale;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const copy = getTmsMobileCopy(locale);
  return (
    <>
      <Button
        variant="quiet"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className={styles.controlLabel}>{title ?? label}</span>
        <ChevronDown aria-hidden />
      </Button>
      <MobileActionSheet
        title={label}
        closeLabel={copy.close}
        open={open}
        onOpenChange={setOpen}
      >
        <div className={styles.fields}>
          {children}
          <div className="pw-mobile-sheet-footer">
            <Button fullWidth variant="primary" onClick={() => setOpen(false)}>
              {copy.done}
            </Button>
          </div>
        </div>
      </MobileActionSheet>
    </>
  );
}

export type TmsMobileAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};
export function TmsMobileActions({
  items,
  locale,
}: {
  items: TmsMobileAction[];
  locale: TmsLocale;
}) {
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const copy = getTmsMobileCopy(locale);
  if (!items.length) {
    return null;
  }
  return (
    <>
      <Button
        variant="quiet"
        size="icon"
        aria-label={copy.more}
        onClick={() => setOpen(true)}
      >
        <MoreHorizontal aria-hidden />
      </Button>
      <MobileActionSheet
        title={copy.more}
        closeLabel={copy.close}
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(next) => {
          if (!next) {
            const action = pending.current;
            pending.current = null;
            action?.();
          }
        }}
      >
        <div className={styles.menu}>
          {items.map((item) => (
            <Button
              key={item.label}
              variant={item.danger ? "danger" : "quiet"}
              disabled={item.disabled}
              onClick={() => {
                pending.current = item.onClick;
                setOpen(false);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </MobileActionSheet>
    </>
  );
}
