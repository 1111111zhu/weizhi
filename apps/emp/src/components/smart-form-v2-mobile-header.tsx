import { MobileActionSheet } from "@project-wing/ui";
import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import styles from "./smart-form-v2-mobile-header.module.css";

export type SmartFormV2MobileHeaderConfig = {
  navigation: ReactNode;
  actions: ReactNode;
  actionsLabel: string;
  closeLabel?: string;
};

export function SmartFormV2MobileHeader({
  title,
  description,
  config,
  actions,
  status,
}: {
  title: ReactNode;
  description?: ReactNode;
  config?: SmartFormV2MobileHeaderConfig;
  actions?: ReactNode;
  status?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div className={styles.title}>{title}</div>
        {actions || config?.actions ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={config?.actionsLabel ?? "More actions"}
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <Ellipsis />
            </Button>
            <MobileActionSheet
              open={open}
              onOpenChange={setOpen}
              title={config?.actionsLabel ?? "More actions"}
              closeLabel={config?.closeLabel ?? "Close"}
            >
              {config?.actions}
              {actions}
            </MobileActionSheet>
          </>
        ) : null}
      </div>
      {description ? (
        <div className={styles.description}>{description}</div>
      ) : null}
      {config?.navigation || status ? (
        <div className={styles.controls}>
          {config?.navigation}
          <div className={styles.status}>{status}</div>
        </div>
      ) : null}
    </header>
  );
}
