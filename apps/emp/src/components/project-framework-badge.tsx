"use client";

import { BookOpenCheck, Building2, Globe2, Landmark } from "lucide-react";
import { useId } from "react";

import { AccessibleName } from "@/components/ui/accessible-name";
import { Badge } from "@/components/ui/badge";

import type { FrameworkTemplate } from "../api/client";
import { cn } from "../lib/utils";

type FrameworkIcon = typeof BookOpenCheck;

const FRAMEWORK_ICONS: Record<string, FrameworkIcon> = {
  CAS: Building2,
  HKFRS: Landmark,
  IFRS: Globe2,
};

export function ProjectFrameworkBadge({
  className,
  frameworkTemplate,
  frameworkTemplateId,
  applicableAccountingStandard,
}: {
  className?: string;
  frameworkTemplate?: FrameworkTemplate | null;
  frameworkTemplateId?: string | null;
  applicableAccountingStandard?: string | null;
}) {
  const code =
    applicableAccountingStandard ??
    frameworkTemplate?.code ??
    frameworkTemplateId ??
    "Framework";
  const label = applicableAccountingStandard ?? frameworkTemplate?.name ?? code;
  const Icon = FRAMEWORK_ICONS[code.toUpperCase()] ?? BookOpenCheck;
  const labelId = useId();

  return (
    <AccessibleName label={label}>
      <span
        aria-labelledby={labelId}
        className={cn("inline-flex items-center", className)}
      >
        <span id={labelId} className="sr-only">
          {label}
        </span>
        <Badge
          variant="outline"
          className="relative z-10 h-6 w-6 justify-center rounded-full border-background bg-primary p-0 text-primary-foreground shadow-sm"
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        </Badge>
        <Badge
          variant="outline"
          className="-ml-2 h-6 rounded-l-none rounded-r-full border-border bg-card pr-2.5 pl-4 text-[11px] font-medium text-muted-foreground"
        >
          {code}
        </Badge>
      </span>
    </AccessibleName>
  );
}
