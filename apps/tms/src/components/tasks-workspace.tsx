"use client";

import type { WorkItem } from "@project-wing/shared";
import {
  Button as SharedButton,
  ProjectWingPersonalWorkItemSidebar,
  CollectionState,
  MobileListItem,
} from "@project-wing/ui";
import { ClipboardList, X } from "lucide-react";
import { useEffect, useState } from "react";

import { loadTmsWorkItems } from "@/lib/api";
import { getEmpApplicationUrl } from "@/lib/portal";

import mobileStyles from "./tms-mobile.module.css";

export function TasksWorkspace({
  locale,
  onClose,
  mobile = false,
}: {
  locale: "zh-CN" | "en-US";
  onClose: () => void;
  mobile?: boolean;
}) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    loadTmsWorkItems(locale)
      .then((response) => {
        if (active) {
          setItems(response.items);
          setError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [locale]);
  const zh = locale === "zh-CN";
  if (mobile) {
    return (
      <div className={mobileStyles.fields} data-testid="tms-tasks-mobile">
        {loading || error ? (
          <CollectionState
            kind={error ? "error" : "loading"}
            locale={locale}
            onRetry={() => {
              setLoading(true);
              setError(false);
              void loadTmsWorkItems(locale)
                .then((response) => setItems(response.items))
                .catch(() => setError(true))
                .finally(() => setLoading(false));
            }}
          />
        ) : items.length ? (
          items.map((item) => (
            <MobileListItem
              key={item.id}
              title={item.title}
              description={item.description ?? undefined}
              meta={item.objectLabel}
              href="#work-item"
              onNavigate={(event) => {
                event.preventDefault();
                openTmsWorkItem(item, locale);
              }}
            />
          ))
        ) : (
          <CollectionState kind="empty" locale={locale} />
        )}
      </div>
    );
  }
  if (loading || error) {
    return (
      <aside className="flex h-full min-h-0 flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <ClipboardList className="size-4 text-primary" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {zh ? "TMS 待办" : "TMS work items"}
          </p>
          <SharedButton
            variant="quiet"
            size="icon-sm"
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label={zh ? "关闭 TMS 待办" : "Close TMS work items"}
          >
            <X className="size-4" />
          </SharedButton>
        </header>
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
          <div>
            <p>
              {loading
                ? zh
                  ? "正在加载待办…"
                  : "Loading work items…"
                : zh
                  ? "TMS 待办加载失败。"
                  : "Unable to load TMS work items."}
            </p>
            {error ? (
              <SharedButton
                variant="quiet"
                size="sm"
                type="button"
                className="mt-3 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
                onClick={() => {
                  setLoading(true);
                  setError(false);
                  loadTmsWorkItems(locale)
                    .then((response) => {
                      setItems(response.items);
                      setLoading(false);
                    })
                    .catch(() => {
                      setError(true);
                      setLoading(false);
                    });
                }}
              >
                {zh ? "重试" : "Retry"}
              </SharedButton>
            ) : null}
          </div>
        </div>
      </aside>
    );
  }
  return (
    <ProjectWingPersonalWorkItemSidebar
      title={zh ? "TMS 待办" : "TMS work items"}
      sections={[
        {
          id: "TMS",
          label: zh ? "TMS 待办" : "TMS work items",
          items,
        },
      ]}
      locale={locale}
      onClose={onClose}
      onOpen={(item) => openTmsWorkItem(item, locale)}
    />
  );
}

function openTmsWorkItem(item: WorkItem, locale: "zh-CN" | "en-US") {
  const target = item.actionTarget;
  if (target.resourceType === "CMP_ENGAGEMENT") {
    const empOrigin = getEmpApplicationUrl();
    window.location.assign(
      new URL(
        `/${locale}/engagement/new?cmpEngagementId=${encodeURIComponent(target.resourceId ?? "")}`,
        empOrigin
      ).toString()
    );
    return;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(target.params)) {
    if (value !== null) {
      params.set(key, String(value));
    }
  }
  const section =
    target.resourceType === "TMS_APPROVAL" ? "approvals" : "timesheet";
  params.set("workspace", section);
  window.location.assign(`/${locale}/timesheet?${params.toString()}`);
}
