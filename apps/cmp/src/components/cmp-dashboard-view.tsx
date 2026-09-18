"use client";

import type { CmpDashboardSummary } from "@project-wing/shared";

import { useCmpI18n } from "../i18n/client";

export function CmpDashboardView({
  summary,
}: {
  summary: CmpDashboardSummary;
}) {
  const { dictionary, localizedPath } = useCmpI18n();
  const copy = dictionary.dashboard;
  const stats = [
    {
      key: "draftsAssignedToMe" as const,
      label: copy.drafts,
      hint: copy.draftsHint,
      href: localizedPath(
        "/acceptance?tab=requests&status=DRAFT,STAFF_EDITING"
      ),
    },
    {
      key: "approvalsAssignedToMe" as const,
      label: copy.approvals,
      hint: copy.approvalsHint,
      href: localizedPath("/acceptance?tab=approvals"),
    },
    {
      key: "returnedRequests" as const,
      label: copy.returned,
      hint: copy.returnedHint,
      href: localizedPath("/acceptance?tab=requests&status=RETURNED"),
    },
    {
      key: "myClients" as const,
      label: copy.clients,
      hint: copy.clientsHint,
      href: localizedPath("/client"),
    },
    {
      key: "myEngagements" as const,
      label: copy.engagements,
      hint: copy.engagementsHint,
      href: localizedPath("/engagement"),
    },
  ];

  return (
    <section className="cmp-dashboard">
      <div className="cmp-hero">
        <div>
          <p className="cmp-eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="cmp-stat-grid">
        {stats.map((stat) => (
          <a className="cmp-stat-card" key={stat.key} href={stat.href}>
            <span>{stat.label}</span>
            <strong>{summary[stat.key]}</strong>
            <p>{stat.hint}</p>
          </a>
        ))}
      </div>

      <div className="cmp-panel-grid">
        <ActivityPanel
          title={copy.recentClientChanges}
          empty={copy.noClientChanges}
          items={summary.recentChanges}
          fallbackHref={localizedPath("/client")}
        />
        <ActivityPanel
          title={copy.recentApprovals}
          empty={copy.noApprovalRecords}
          items={summary.recentApprovals}
          fallbackHref={localizedPath("/acceptance?tab=approvals")}
          itemHref={(item) =>
            localizedPath(`/acceptance?tab=approvals&requestId=${item.id}`)
          }
        />
      </div>
    </section>
  );
}

function ActivityPanel({
  title,
  empty,
  items,
  fallbackHref,
  itemHref,
}: {
  title: string;
  empty: string;
  items: { id: string; title: string; subtitle?: string }[];
  fallbackHref: string;
  itemHref?: (item: { id: string }) => string;
}) {
  return (
    <section className="cmp-panel">
      <header>
        <h3>{title}</h3>
      </header>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a href={itemHref?.(item) ?? fallbackHref}>
                <strong>{item.title}</strong>
                {item.subtitle ? <p>{item.subtitle}</p> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <a className="cmp-empty" href={fallbackHref}>
          {empty}
        </a>
      )}
    </section>
  );
}
