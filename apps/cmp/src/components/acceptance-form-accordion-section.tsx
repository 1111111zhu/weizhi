import { Badge } from "@project-wing/ui";
import type { BadgeProps } from "@project-wing/ui";
import {
  CheckCircleIcon,
  CircleAlertIcon,
  CircleDashedIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { CmpFormSectionStatus } from "./cmp-form-controls";
import {
  AccordionContent,
  AccordionItem,
  AccordionNavigationTrigger,
  AccordionTrigger,
} from "./ui/accordion";

export type AcceptanceFormAccordionStatusCopy = {
  complete: string;
  error: string;
  incomplete: string;
  notStarted: string;
};

const STATUS_BADGE_VARIANT: Record<
  CmpFormSectionStatus,
  BadgeProps["variant"]
> = {
  complete: "success-light",
  error: "destructive-light",
  incomplete: "warning-light",
  "not-started": "secondary",
};

export function AcceptanceFormAccordionSection({
  sectionId,
  title,
  status,
  statusCopy,
  onFocus,
  children,
}: {
  sectionId: string;
  title: string;
  status: CmpFormSectionStatus;
  statusCopy: AcceptanceFormAccordionStatusCopy;
  onFocus: () => void;
  children: ReactNode;
}) {
  const statusLabel =
    status === "complete"
      ? statusCopy.complete
      : status === "error"
        ? statusCopy.error
        : status === "incomplete"
          ? statusCopy.incomplete
          : statusCopy.notStarted;

  return (
    <AccordionItem
      value={sectionId}
      className="bg-transparent px-4"
      data-acceptance-form-section={sectionId}
      onFocusCapture={onFocus}
    >
      <AccordionTrigger
        className="items-center py-4 font-semibold hover:no-underline"
        data-acceptance-form-section-anchor={sectionId}
      >
        <div className="flex w-full min-w-0 items-center justify-between gap-3 pr-4">
          <div className="flex min-w-0 items-center gap-3">
            <AcceptanceFormStatusIcon status={status} />
            <span className="truncate text-sm font-medium">{title}</span>
          </div>
          <Badge
            className="shrink-0"
            radius="full"
            variant={STATUS_BADGE_VARIANT[status]}
          >
            {statusLabel}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-0 pt-2 pb-6 pl-8">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

export function AcceptanceFormPreviewNavigationItem({
  title,
  status,
  onSelect,
}: {
  title: string;
  status: CmpFormSectionStatus;
  onSelect: () => void;
}) {
  return (
    <div
      className="flex bg-transparent px-4"
      data-acceptance-form-section-navigation="review"
    >
      <AccordionNavigationTrigger
        type="button"
        className="cursor-pointer items-center py-4 font-semibold text-foreground hover:no-underline"
        onClick={onSelect}
      >
        <div className="flex w-full min-w-0 items-center justify-between gap-3 pr-4">
          <div className="flex min-w-0 items-center gap-3">
            <AcceptanceFormStatusIcon status={status} />
            <span className="truncate text-sm font-medium">{title}</span>
          </div>
        </div>
      </AccordionNavigationTrigger>
    </div>
  );
}

export function AcceptanceFormSectionContent({
  children,
  description,
}: {
  children: ReactNode;
  description?: ReactNode;
}) {
  return (
    <>
      {description ? (
        <p className="cmp-form-section-description">{description}</p>
      ) : null}
      <div className="cmp-client-form-grid">{children}</div>
    </>
  );
}

function AcceptanceFormStatusIcon({
  status,
}: {
  status: CmpFormSectionStatus;
}) {
  if (status === "complete") {
    return (
      <CheckCircleIcon
        aria-hidden="true"
        className="size-5 shrink-0 fill-success text-background"
      />
    );
  }
  if (status === "error") {
    return (
      <CircleAlertIcon
        aria-hidden="true"
        className="size-5 shrink-0 text-destructive"
      />
    );
  }
  return (
    <CircleDashedIcon
      aria-hidden="true"
      className={
        status === "incomplete"
          ? "size-5 shrink-0 text-warning"
          : "size-5 shrink-0 text-muted-foreground"
      }
    />
  );
}
