import { Badge } from "@project-wing/ui";
import type { ReactNode } from "react";

type CmpDataGridStatusTone =
  | "destructive"
  | "info"
  | "neutral"
  | "success"
  | "warning";

const STATUS_VARIANTS = {
  destructive: "destructive-light",
  info: "info-light",
  neutral: "secondary",
  success: "success-light",
  warning: "warning-light",
} as const;

export function CmpDataGridStatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: CmpDataGridStatusTone;
}) {
  return (
    <Badge radius="default" size="default" variant={STATUS_VARIANTS[tone]}>
      {children}
    </Badge>
  );
}
