"use client";

import type { CmpClient, CmpEngagement } from "@project-wing/shared";
import { Button } from "@project-wing/ui";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCmpI18n } from "../i18n/client";
import { cn } from "../lib/utils";
import { CmpEngagementSummaryTable } from "./cmp-engagement-summary-table";
import { Card } from "./ui/card";

export type CmpEngagementClientGroup = {
  client: CmpClient;
  engagements: CmpEngagement[];
};

export function CmpEngagementClientGroups({
  groups,
  targetClientId,
  onPreviewClient,
  onPreviewEngagement,
}: {
  groups: CmpEngagementClientGroup[];
  targetClientId?: string;
  onPreviewClient: (client: CmpClient) => void;
  onPreviewEngagement: (engagement: CmpEngagement) => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const targetRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(
    () =>
      new Set(
        targetClientId
          ? [targetClientId]
          : groups.map(({ client }) => client.id)
      )
  );

  useEffect(() => {
    if (!targetClientId || didScrollRef.current || !targetRef.current) {
      return;
    }
    didScrollRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      targetRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [targetClientId]);

  if (groups.length === 0) {
    return <div className="cmp-empty">{copy.noMatchingEngagements}</div>;
  }

  return (
    <div className="space-y-3" data-testid="cmp-engagement-client-groups">
      {groups.map(({ client, engagements }) => {
        const expanded = expandedClientIds.has(client.id);
        const isTarget = client.id === targetClientId;
        const primaryName = client.nameEn || client.nameZh;
        const secondaryName =
          client.nameZh === primaryName ? null : client.nameZh;
        const countLabel =
          engagements.length === 1
            ? copy.engagementCountOne
            : copy.engagementCountMany.replace(
                "{count}",
                String(engagements.length)
              );
        const accessibleName = (
          expanded
            ? copy.collapseClientEngagements
            : copy.expandClientEngagements
        ).replace("{clientCode}", client.clientCode);

        return (
          <Card
            key={client.id}
            ref={isTarget ? targetRef : undefined}
            className={cn("scroll-m-6", isTarget && "ring-2 ring-primary/50")}
            data-client-id={client.id}
          >
            <div className="flex items-stretch">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="my-auto ml-2 shrink-0"
                accessibleName={accessibleName}
                aria-expanded={expanded}
                onClick={() =>
                  setExpandedClientIds((current) => {
                    const next = new Set(current);
                    if (next.has(client.id)) {
                      next.delete(client.id);
                    } else {
                      next.add(client.id);
                    }
                    return next;
                  })
                }
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "transition-transform duration-[var(--motion-fast)]",
                    expanded && "rotate-180"
                  )}
                />
              </Button>
              <div className="min-w-0 flex-1 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-none px-2 text-left hover:bg-transparent hover:text-primary"
                  accessibleName={copy.previewClient.replace(
                    "{clientCode}",
                    client.clientCode
                  )}
                  onClick={() => onPreviewClient(client)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 font-semibold text-foreground">
                      {client.clientCode}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {primaryName}
                      </span>
                      {secondaryName ? (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {secondaryName}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {countLabel}
                    </span>
                  </span>
                </Button>
              </div>
            </div>
            {expanded ? (
              <div className="border-t border-border">
                <CmpEngagementSummaryTable
                  engagements={engagements}
                  emptyMessage={copy.noClientEngagements}
                  onPreviewEngagement={onPreviewEngagement}
                />
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
