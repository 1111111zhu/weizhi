"use client";
import { Button, Input, MobileActionSheet } from "@project-wing/ui";
import type { ExpandableActionBarItem } from "@project-wing/ui";
import { ArrowLeft, CircleUserRound, Menu } from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { useCmpI18n } from "@/i18n/client";
import { getCmpMobileCopy } from "@/i18n/mobile";

import styles from "./cmp-mobile.module.css";

export function CmpMobileHeader({
  title,
  actions,
  account,
  onReturn,
  search,
  onSearch,
  searchPlaceholder,
}: {
  title: string;
  actions: ExpandableActionBarItem[];
  account: ReactNode;
  onReturn: () => void;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder: string;
}) {
  const { locale, dictionary } = useCmpI18n();
  const copy = getCmpMobileCopy(locale);
  const [panel, setPanel] = useState<"navigation" | "account">("navigation");
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  return (
    <>
      <header className={styles.header} data-testid="cmp-mobile-header">
        <Button
          variant="quiet"
          size="icon"
          aria-label={copy.back}
          onClick={onReturn}
        >
          <ArrowLeft />
        </Button>
        <Button
          variant="quiet"
          size="icon"
          aria-label={copy.navigation}
          onClick={() => {
            setPanel("navigation");
            setOpen(true);
          }}
        >
          <Menu />
        </Button>
        <strong>{title}</strong>
        <Button
          variant="quiet"
          size="icon"
          aria-label={dictionary.shell.account}
          onClick={() => {
            setPanel("account");
            setOpen(true);
          }}
        >
          <CircleUserRound />
        </Button>
      </header>
      {onSearch && (
        <div className={styles.search}>
          <Input
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={search ?? ""}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
      )}
      <MobileActionSheet
        title={panel === "account" ? dictionary.shell.account : copy.navigation}
        closeLabel={copy.close}
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(nextOpen) => {
          if (!nextOpen) {
            const action = pending.current;
            pending.current = null;
            action?.();
          }
        }}
      >
        {panel === "navigation" ? (
          <div className={styles.menu}>
            {actions.map((action) => (
              <Button
                key={action.id}
                variant={action.active ? "secondary" : "quiet"}
                disabled={action.disabled}
                aria-pressed={Boolean(action.active)}
                onClick={() => {
                  pending.current = action.onClick ?? null;
                  setOpen(false);
                }}
              >
                {action.icon}
                {action.label}
                {action.badge ? ` (${action.badge})` : ""}
              </Button>
            ))}
          </div>
        ) : (
          <div className={styles.fields}>{account}</div>
        )}
      </MobileActionSheet>
    </>
  );
}
