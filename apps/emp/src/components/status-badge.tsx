import { Badge } from "@project-wing/ui";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatusTone = "slate" | "green" | "sky" | "amber";

const TONE_VARIANTS = {
  slate: "secondary",
  green: "success-light",
  sky: "info-light",
  amber: "warning-light",
} as const;

export function StatusBadge({
  children,
  tone = "slate",
  className,
}: {
  children?: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <Badge
      variant={TONE_VARIANTS[tone]}
      radius="full"
      className={cn("px-2 font-semibold shadow-none", className)}
    >
      {children}
    </Badge>
  );
}
