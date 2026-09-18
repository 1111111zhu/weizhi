"use client";

import {
  Button,
  CollectionState,
  MobileActionSheet,
  MobileListItem,
} from "@project-wing/ui";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { getEmpMobileNavigationCopy } from "@/i18n/mobile-navigation";

import styles from "./confirmation-library-mobile.module.css";

export function ConfirmationLibraryRecord({
  id,
  title,
  description,
  meta,
  onOpen,
  actions,
  selection,
  locale,
  onActionsClose,
}: {
  id: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  onOpen: () => void;
  actions?: ReactNode;
  selection?: ReactNode;
  locale: string;
  onActionsClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const copy = getEmpMobileNavigationCopy(locale);
  return (
    <>
      <MobileListItem
        title={title}
        description={description}
        meta={meta}
        href={`#record-${encodeURIComponent(id)}`}
        onNavigate={(event) => {
          event.preventDefault();
          onOpen();
        }}
        action={
          <div className={styles.rowActions}>
            {selection}
            {actions ? (
              <Button
                variant="quiet"
                size="icon"
                aria-label={`${copy.more}: ${title}`}
                onClick={() => setOpen(true)}
              >
                <MoreHorizontal />
              </Button>
            ) : null}
          </div>
        }
      />
      {actions ? (
        <MobileActionSheet
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              onActionsClose?.();
            }
          }}
          title={title}
          closeLabel={copy.close}
        >
          <div className={styles.actions}>{actions}</div>
        </MobileActionSheet>
      ) : null}
    </>
  );
}

/** Phone presentation for the confirmation libraries; data and permissions stay with each owner. */
export function ConfirmationLibraryMobile({
  locale,
  title,
  search,
  actions,
  filters,
  children,
  loading,
  error,
  onRetry,
  empty,
  count,
  footer,
  actionsOpen,
  onActionsOpenChange,
  onActionsOpenChangeComplete,
  actionsLabel,
}: {
  locale: string;
  title: string;
  search: ReactNode;
  actions: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty: string;
  count: number;
  footer?: ReactNode;
  actionsOpen?: boolean;
  onActionsOpenChange?: (open: boolean) => void;
  onActionsOpenChangeComplete?: (open: boolean) => void;
  actionsLabel?: string;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = actionsOpen ?? localOpen;
  const setOpen = onActionsOpenChange ?? setLocalOpen;
  const copy = getEmpMobileNavigationCopy(locale);
  return (
    <section
      className={styles.root}
      aria-label={title}
      data-testid="confirmation-library-mobile"
    >
      <div className={styles.toolbar}>
        {search}
        <Button
          variant="quiet"
          size="icon"
          aria-label={actionsLabel ?? copy.sortAndFilter}
          onClick={() => setOpen(true)}
        >
          <MoreHorizontal />
        </Button>
      </div>
      <div className={styles.list}>
        {loading || error ? (
          <CollectionState
            kind={error ? "error" : "loading"}
            locale={copy.locale}
            onRetry={onRetry}
          />
        ) : count ? (
          children
        ) : (
          <CollectionState kind="empty" title={empty} locale={copy.locale} />
        )}
      </div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
      <MobileActionSheet
        title={copy.controls}
        closeLabel={copy.close}
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={onActionsOpenChangeComplete}
      >
        <div className={styles.actions}>{actions}</div>
        {filters ? <div className={styles.filters}>{filters}</div> : null}
      </MobileActionSheet>
    </section>
  );
}
