"use client";

import {
  Button,
  CollectionState,
  MobileActionSheet,
  MobileListItem,
} from "@project-wing/ui";
import { ArrowLeft, FileText, Folder, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import type { WorkflowNode } from "@/api/client";
import { getEmpMobileNavigationCopy } from "@/i18n/mobile-navigation";

import managementStyles from "./workbench-directory-mobile.module.css";

export function resolveMobileDirectory(nodes: WorkflowNode[], trail: string[]) {
  let children = nodes;
  let current: WorkflowNode | undefined;
  for (const id of trail) {
    current = children.find((node) => node.id === id);
    if (!current) {
      return { children: nodes, current: undefined };
    }
    children = current.children ?? [];
  }
  return { children, current };
}

export function EmpMobileDirectory({
  nodes,
  onOpen,
  management,
  locale,
  loading,
  trail: controlledTrail,
  onTrailChange,
  managementOpen,
  onManagementOpenChange,
}: {
  nodes: WorkflowNode[];
  onOpen: (id: string) => void;
  management: ReactNode;
  locale: string;
  loading: boolean;
  trail?: string[];
  onTrailChange?: (trail: string[]) => void;
  managementOpen?: boolean;
  onManagementOpenChange?: (open: boolean) => void;
}) {
  const copy = getEmpMobileNavigationCopy(locale);
  const [localTrail, setLocalTrail] = useState<string[]>([]);
  const trail = controlledTrail ?? localTrail;
  const setTrail = onTrailChange ?? setLocalTrail;
  const [localManage, setLocalManage] = useState(false);
  const manage = managementOpen ?? localManage;
  const setManage = onManagementOpenChange ?? setLocalManage;
  const { children, current } = resolveMobileDirectory(nodes, trail);
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="emp-mobile-directory"
    >
      {onTrailChange ? null : (
        <div className="flex shrink-0 items-center gap-2 px-3 py-2">
          {trail.length ? (
            <Button
              variant="quiet"
              size="icon"
              aria-label={copy.back}
              onClick={() => setTrail(trail.slice(0, -1))}
            >
              <ArrowLeft />
            </Button>
          ) : null}
          <h2 className="min-w-0 flex-1 truncate font-semibold">
            {current ? current.title : copy.directory}
          </h2>
          <Button
            variant="quiet"
            size="icon"
            aria-label={copy.manageDirectory}
            onClick={() => setManage(true)}
          >
            <MoreHorizontal />
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {current ? (
          <MobileListItem
            title={copy.openFiles}
            icon={<FileText />}
            href="#files"
            onNavigate={(event) => {
              event.preventDefault();
              event.currentTarget.blur();
              onOpen(current.id);
            }}
          />
        ) : null}
        {loading ? (
          <CollectionState
            kind="loading"
            locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
          />
        ) : (
          children.map((node) => (
            <MobileListItem
              key={node.id}
              title={node.title}
              description={node.code === node.title ? undefined : node.code}
              icon={<Folder />}
              href={`#directory-${encodeURIComponent(node.id)}`}
              onNavigate={(event) => {
                event.preventDefault();
                event.currentTarget.blur();
                if (node.children?.length) {
                  setTrail([...trail, node.id]);
                } else {
                  onOpen(node.id);
                }
              }}
            />
          ))
        )}
        {!loading && !children.length && !current ? (
          <CollectionState
            kind="empty"
            locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
          />
        ) : null}
      </div>
      <MobileActionSheet
        open={manage}
        onOpenChange={setManage}
        title={copy.manageDirectory}
        closeLabel={copy.close}
      >
        <div className={managementStyles.sheetBody}>{management}</div>
      </MobileActionSheet>
    </div>
  );
}
