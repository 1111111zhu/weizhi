"use client";

import {
  Check,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  Inbox,
  ListChecks,
  LockKeyhole,
  Send,
  UserRound,
} from "lucide-react";

import { AccessibleName } from "@/components/ui/accessible-name";

export type ConfirmationWorkflowMilestone = {
  actor?: string | null;
  at?: string | null;
  complete: boolean;
  active?: boolean;
  key:
    | "created"
    | "frozen"
    | "sent"
    | "followUp"
    | "manualReview"
    | "completed";
  title?: string;
  waitingLabel?: string;
};

const ICONS = {
  created: FilePlus2,
  frozen: LockKeyhole,
  sent: Send,
  followUp: Inbox,
  manualReview: ClipboardCheck,
  completed: ListChecks,
} as const;

export function ConfirmationWorkflowTracker({
  ariaLabel,
  actorLabel,
  locale,
  milestones,
  timeLabel,
  titles,
  waitingLabel,
}: {
  ariaLabel: string;
  actorLabel: string;
  locale: string;
  milestones: ConfirmationWorkflowMilestone[];
  timeLabel: string;
  titles: Record<ConfirmationWorkflowMilestone["key"], string>;
  waitingLabel: string;
}) {
  return (
    <AccessibleName label={ariaLabel}>
      <section className="confirmation-workflow-tracker mx-auto grid w-full max-w-6xl gap-8 px-4 py-10">
        <div className="grid gap-6 md:grid-cols-6 md:gap-0">
          {milestones.map((milestone, index) => {
            const Icon = ICONS[milestone.key];
            return (
              <div
                key={milestone.key}
                className="confirmation-workflow-milestone relative grid justify-items-center gap-3 text-center"
              >
                {index > 0 ? (
                  <div
                    className={`absolute top-7 right-1/2 hidden h-1 w-full -translate-y-1/2 md:block ${milestone.complete || milestone.active ? "bg-primary" : "bg-border"}`}
                  />
                ) : null}
                <div
                  className={`confirmation-workflow-marker relative z-10 flex size-14 items-center justify-center rounded-full border-2 transition-colors ${milestone.complete ? "border-primary bg-primary text-primary-foreground shadow-sm" : milestone.active ? "border-primary bg-background text-primary shadow-sm" : "border-border bg-muted text-muted-foreground"}`}
                >
                  {milestone.complete ? (
                    <Check className="absolute -right-1 -bottom-1 size-5 rounded-full border-2 border-background bg-primary p-0.5 text-primary-foreground" />
                  ) : null}
                  <Icon className="size-6" />
                </div>
                <div className="grid gap-1">
                  <h3
                    className={
                      milestone.complete || milestone.active
                        ? "font-semibold text-foreground"
                        : "font-semibold text-muted-foreground"
                    }
                  >
                    {milestone.title ?? titles[milestone.key]}
                  </h3>
                  {milestone.complete || (milestone.active && milestone.at) ? (
                    <>
                      {milestone.complete ? null : (
                        <p className="text-xs text-muted-foreground">
                          {milestone.waitingLabel ?? waitingLabel}
                        </p>
                      )}
                      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <UserRound className="size-3.5" />
                        {actorLabel}：{milestone.actor || "-"}
                      </p>
                      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="size-3.5" />
                        {timeLabel}：{formatDate(milestone.at, locale)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {milestone.waitingLabel ?? waitingLabel}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AccessibleName>
  );
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
