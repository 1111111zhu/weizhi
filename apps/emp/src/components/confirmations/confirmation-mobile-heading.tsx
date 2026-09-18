"use client";

import { Button } from "@project-wing/ui";
import { FolderTree } from "lucide-react";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import styles from "./confirmation-mobile-heading.module.css";

const DirectoryContext = createContext<{
  locale: string;
  onOpen: () => void;
} | null>(null);

export function ConfirmationMobileDirectoryProvider({
  children,
  locale,
  onOpen,
}: {
  children: ReactNode;
  locale: string;
  onOpen: () => void;
}) {
  const value = useMemo(() => ({ locale, onOpen }), [locale, onOpen]);
  return (
    <DirectoryContext.Provider value={value}>
      {children}
    </DirectoryContext.Provider>
  );
}

export function ConfirmationMobileDirectoryButton() {
  const directory = useContext(DirectoryContext);
  if (!directory) {
    return null;
  }
  const handleOpen = directory.onOpen;
  return (
    <Button
      type="button"
      size="icon"
      variant="quiet"
      className={styles.directory}
      aria-label={
        directory.locale.startsWith("zh") ? "函证目录" : "Confirmation views"
      }
      aria-haspopup="dialog"
      onClick={handleOpen}
      data-testid="confirmation-mobile-directory"
    >
      <FolderTree aria-hidden />
    </Button>
  );
}

export function ConfirmationMobileHeading({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className={styles.heading} data-testid="confirmation-mobile-heading">
      <ConfirmationMobileDirectoryButton />
      <h2>{title}</h2>
      {count === undefined ? null : (
        <span className={styles.count}>{count}</span>
      )}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
