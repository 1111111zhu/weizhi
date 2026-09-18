"use client";

import { GLOBAL_ROLE_METADATA } from "@project-wing/shared";
import type { GlobalRole } from "@project-wing/shared";
import {
  DataGridColumnHeader,
  ProjectWingMasterDataGrid,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AuditLog } from "../api/client";
import type { Dictionary } from "../i18n/dictionaries";
import { formatDisplayName } from "../lib/project-layout";

export type WorkbenchAuditLogsCopy = Dictionary["auditLogs"];

const defaultCopy: WorkbenchAuditLogsCopy = {
  actor: "Actor",
  allActors: "All actors",
  role: "Role",
  allRoles: "All roles",
  clearFilters: "Clear filters",
  recordSuffix: "records",
  time: "Time",
  action: "Action",
  description: "Description",
  noMatches: "No matching records",
  empty: "No audit logs",
  system: "System",
  roleLabels: {
    PRINCIPAL: "Principal",
    TAX_EXPERT: "N/A",
    SUPER_ADMIN: "System administrator",
    CONFIRMATION_OFFICER: "Confirmation officer",
    PARTNER: "Partner",
    MANAGER: "Manager",
    SENIOR: "Senior",
    STAFF: "Staff",
    ASSISTANT: "Assistant",
    EQCR: "N/A",
  },
  actionLabels: {
    ATTACHMENT_LOCKED: "Attachment locked",
    ATTACHMENT_DELETED: "Attachment deleted",
    ATTACHMENT_RESTORED: "Attachment restored",
    ATTACHMENT_UNLOCKED: "Attachment unlocked",
    ATTACHMENT_UPLOADED: "Attachment uploaded",
    ATTACHMENT_VERSION_UPLOADED: "Attachment version uploaded",
    ATTACHMENT_VERSION_DOWNLOADED: "Attachment version downloaded",
    ATTACHMENT_VERSION_RESTORED: "Attachment version restored",
    DECLARATION_ACCEPTED: "Independence declaration confirmed",
    INVITATION_CREATED: "Invitation created",
    LOGIN_SUCCESS: "Login succeeded",
    PASSWORD_RESET: "Password reset",
    PROJECT_ARCHIVED: "Project archived",
    PROJECT_SUBMITTED_FOR_ARCHIVE: "Submitted for archive",
    PROJECT_REOPENED: "Project reopened",
    PROJECT_FINAL_ARCHIVE_CONFIRMED: "Final archive confirmed",
    PROJECT_CREATED: "Project created",
    PROJECT_JOINED: "Project joined",
    PROJECT_MEMBER_IN_CHARGE_UPDATED: "Project member In Charge updated",
    PROJECT_MEMBER_REMOVED: "Project member removed",
    PROJECT_MEMBER_ROLE_UPDATED: "Project member role updated",
    PROJECT_PLACEMENT_MOVED: "Project placement moved",
    USER_CREATED: "User created",
    USER_UPDATED: "User updated",
    WORKFLOW_NODE_CREATED: "Directory node created",
    WORKFLOW_NODE_DELETED: "Directory node deleted",
    WORKFLOW_NODE_UPDATED: "Directory node updated",
    WORKING_PAPER_ASSIGNEES_UPDATED: "Workpaper assignees updated",
    WORKING_PAPER_CREATED: "Workpaper created",
    WORKING_PAPER_PREPARED: "Workpaper prepared",
    WORKING_PAPER_QUESTION_CLEARED: "Review question cleared",
    WORKING_PAPER_QUESTION_CREATED: "Review question created",
    WORKING_PAPER_QUESTION_FOLLOWED_UP: "Review question followed up",
    WORKING_PAPER_QUESTION_REOPENED: "Review question reopened",
    WORKING_PAPER_QUESTION_REPLIED: "Review question replied",
    WORKING_PAPER_RETURNED: "Workpaper returned",
    WORKING_PAPER_REVIEWED: "Workpaper reviewed",
    WORKSPACE_CREATED: "Workspace created",
    WORKSPACE_UPDATED: "Workspace updated",
  },
};

export function WorkbenchAuditLogs({
  copy = defaultCopy,
  locale = "en-US",
  logs,
}: {
  copy?: WorkbenchAuditLogsCopy;
  locale?: string;
  logs: AuditLog[];
}) {
  const [filterActor, setFilterActor] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const log of logs) {
      const name = log.actor?.name ?? copy.system;
      if (!seen.has(name)) {
        seen.set(name, log.actor?.id ?? "system");
      }
    }
    return [...seen.entries()].map(([name, id]) => ({ name, id }));
  }, [copy.system, logs]);
  const roleOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const log of logs) {
      const role = log.actor?.globalRole;
      if (role) {
        seen.add(role);
      }
    }
    return [...seen];
  }, [logs]);
  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        if (filterActor) {
          const actorId = log.actor?.id ?? "system";
          if (actorId !== filterActor) {
            return false;
          }
        }
        if (filterRole) {
          const role = log.actor?.globalRole;
          if (role !== filterRole) {
            return false;
          }
        }
        return true;
      }),
    [logs, filterActor, filterRole]
  );
  const columns = useMemo<ProjectWingMasterDataGridProps<AuditLog>["columns"]>(
    () => [
      {
        id: "time",
        accessorFn: (log) => log.createdAt,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.time} />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatLogDate(row.original.createdAt, locale)}
          </span>
        ),
        size: 176,
      },
      {
        id: "action",
        accessorFn: (log) => formatAuditAction(log.action, copy.actionLabels),
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.action} />
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
        size: 176,
      },
      {
        id: "description",
        accessorFn: (log) => formatDisplayName(log.description),
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.description} />
        ),
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
        minSize: 280,
        size: 440,
      },
      {
        id: "role",
        accessorFn: (log) => formatActorRole(log, copy),
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.role} />
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
        size: 160,
      },
      {
        id: "actor",
        accessorFn: (log) => formatActorName(log, copy),
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.actor} />
        ),
        cell: ({ getValue }) => (
          <span className="block text-right whitespace-nowrap text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
        size: 184,
      },
    ],
    [copy, locale]
  );
  const hasActiveFilter = Boolean(filterActor || filterRole);
  const filterActions = (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label={copy.actor}
        value={filterActor}
        onValueChange={setFilterActor}
        options={actorOptions}
        placeholder={copy.allActors}
      />
      <FilterSelect
        label={copy.role}
        value={filterRole}
        onValueChange={setFilterRole}
        options={roleOptions.map((role) => ({
          name: formatRoleLabel(role, copy.roleLabels),
          id: role,
        }))}
        placeholder={copy.allRoles}
      />
      {hasActiveFilter ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            setFilterActor("");
            setFilterRole("");
          }}
        >
          {copy.clearFilters}
        </Button>
      ) : null}
    </div>
  );

  return (
    <ProjectWingMasterDataGrid
      actions={filterActions}
      columns={columns}
      data={filteredLogs}
      emptyMessage={hasActiveFilter ? copy.noMatches : copy.empty}
      getRowId={(log) => log.id}
      tableLabel={`${copy.action} ${copy.recordSuffix}`}
      testId="workbench-audit-logs-data-grid"
      title={`${filteredLogs.length} ${copy.recordSuffix}`}
    />
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { name: string; id: string }[];
  placeholder: string;
}) {
  const items = [
    { label: placeholder, value: "" },
    ...options.map((option) => ({
      label: option.name,
      value: option.id,
    })),
  ];

  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <Select
        items={items}
        value={value}
        onValueChange={(nextValue) => onValueChange(String(nextValue ?? ""))}
      >
        <SelectTrigger size="sm" className="min-w-36">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectGroup>
            <SelectItem value="" onClick={() => onValueChange("")}>
              {placeholder}
            </SelectItem>
            {options.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
                onClick={() => onValueChange(option.id)}
              >
                {option.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

function formatLogDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function formatActorRole(log: AuditLog, dictionary: WorkbenchAuditLogsCopy) {
  const globalRole = log.actor?.globalRole;
  if (!globalRole) {
    return dictionary.system;
  }

  return (
    dictionary.roleLabels[globalRole as keyof typeof dictionary.roleLabels] ??
    GLOBAL_ROLE_METADATA?.[globalRole as GlobalRole]?.label ??
    globalRole
  );
}

function formatRoleLabel(
  role: string,
  roleLabels: WorkbenchAuditLogsCopy["roleLabels"]
) {
  return (
    roleLabels[role as keyof typeof roleLabels] ??
    GLOBAL_ROLE_METADATA?.[role as GlobalRole]?.label ??
    role
  );
}

function formatActorName(log: AuditLog, dictionary: WorkbenchAuditLogsCopy) {
  return log.actor?.name
    ? formatDisplayName(log.actor.name)
    : dictionary.system;
}

function formatAuditAction(
  action: string,
  actionLabels: WorkbenchAuditLogsCopy["actionLabels"]
) {
  return actionLabels[action as keyof typeof actionLabels] ?? action;
}
