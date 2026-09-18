"use client";
import { Button, MobileActionSheet } from "@project-wing/ui";
import type { ExpandableActionBarItem } from "@project-wing/ui";
import { ArrowLeft, CircleUserRound, Menu } from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import type { TmsSettingsCopy } from "@/i18n/dictionaries";
import { getTmsMobileCopy } from "@/i18n/mobile";
import type { TmsLocale } from "@/i18n/settings";

import styles from "./tms-mobile.module.css";

export function TmsMobileHeader({
  title,
  actions,
  locale,
  copy,
  userName,
  userEmail,
  rank,
  settings,
  accounts,
  onSignOut,
  onReturn,
  returnLabel,
}: {
  title: string;
  actions: ExpandableActionBarItem[];
  locale: TmsLocale;
  copy: TmsSettingsCopy;
  userName: string;
  userEmail: string;
  rank: string;
  settings: ReactNode;
  accounts: ReactNode;
  onSignOut: () => void;
  onReturn?: () => void;
  returnLabel?: string;
}) {
  const mobileCopy = getTmsMobileCopy(locale);
  const [panel, setPanel] = useState<
    "navigation" | "account" | "settings" | null
  >(null);
  const pending = useRef<(() => void) | null>(null);
  const run = (action?: () => void) => {
    pending.current = action ?? null;
    setPanel(null);
  };
  return (
    <>
      <header className={styles.appHeader} data-testid="tms-mobile-header">
        {onReturn && (
          <Button
            variant="quiet"
            size="icon"
            aria-label={returnLabel ?? mobileCopy.back}
            onClick={onReturn}
          >
            <ArrowLeft aria-hidden />
          </Button>
        )}
        <Button
          variant="quiet"
          size="icon"
          aria-label={mobileCopy.navigation}
          onClick={() => setPanel("navigation")}
        >
          <Menu aria-hidden />
        </Button>
        <strong>{title}</strong>
        <Button
          variant="quiet"
          size="icon"
          aria-label={copy.account}
          onClick={() => setPanel("account")}
        >
          <CircleUserRound aria-hidden />
        </Button>
      </header>
      <MobileActionSheet
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPanel(null);
          }
        }}
        title={
          panel === "settings"
            ? copy.settings
            : panel === "account"
              ? copy.account
              : mobileCopy.navigation
        }
        closeLabel={mobileCopy.close}
        onOpenChangeComplete={(open) => {
          if (!open) {
            const action = pending.current;
            pending.current = null;
            action?.();
          }
        }}
      >
        {panel === "navigation" && (
          <div className={styles.menu}>
            {actions.map((item) => (
              <Button
                key={item.id}
                variant={item.active ? "secondary" : "quiet"}
                aria-pressed={Boolean(item.active)}
                disabled={item.disabled}
                onClick={() =>
                  item.id === "settings"
                    ? setPanel("settings")
                    : run(item.onClick)
                }
              >
                {item.icon}
                {item.label}
              </Button>
            ))}
          </div>
        )}
        {panel === "settings" && (
          <div className={styles.fields}>{settings}</div>
        )}
        {panel === "account" && (
          <div className={styles.fields}>
            <strong>{userName}</strong>
            <p className={styles.muted}>
              {rank} · {userEmail}
            </p>
            {accounts}
            <Button variant="danger" onClick={() => run(onSignOut)}>
              {copy.signOut}
            </Button>
          </div>
        )}
      </MobileActionSheet>
    </>
  );
}
