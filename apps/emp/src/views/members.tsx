"use client";

import {
  canManageProjectLeadership,
  getAssignableProjectRolesForGlobalRole,
  isProjectPermissionSubjectConsistent,
} from "@project-wing/shared";
import type { GlobalRole, ProjectRole } from "@project-wing/shared";
import {
  Button as MobileButton,
  CollectionState,
  MemberDirectoryAction,
  MemberDirectoryCell,
  MemberDirectoryRow as MemberDirectoryRowComponent,
  MemberDirectorySearch,
  MemberDirectoryTable,
  MobileActionSheet,
  ProjectWingTopBar,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
  ProjectWingTopBarTitle,
  useCompactViewport,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
  AlertTriangle,
  MailPlus,
  MailX,
  MoreHorizontal,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../api/client";
import type { ProjectMember, User } from "../api/client";
import {
  getAvatarColorClassName,
  getAvatarInitials,
} from "../components/header-avatar";
import { ProjectLeadershipControls } from "../components/project-leadership-controls";
import { ProjectReauthorizationControls } from "../components/project-reauthorization-controls";
import {
  EmpPortalAction,
  EmpTopBarControls,
} from "../components/project-wing-top-bar-controls";
import { StatusBadge as Badge } from "../components/status-badge";
import { useToast } from "../components/toast";
import { useI18n } from "../i18n/client";
import { defaultProjectLeadershipCopy } from "../i18n/dictionaries";
import { getEmpMobileNavigationCopy } from "../i18n/mobile-navigation";
import { resolveMemberRoleDraft } from "../lib/member-role-draft";
import {
  getFirmRankLabel,
  getInvitationRoleLabel,
  getRoleInEngagementLabel,
} from "../lib/member-role-labels";
import { PAGE_CONTENT_CLASS, PAGE_SHELL_CLASS } from "../lib/project-layout";
import {
  canManageProjectMember,
  canManageProjectMembers as canManageProjectMembersPermission,
} from "../lib/project-permissions";
import { cn } from "../lib/utils";

import styles from "./members-mobile.module.css";

type MemberManagementCopy = {
  authorizationSuspended: string;
  memberManagementTitle: string;
  inviteMember: string;
  inviteProjectMembers: string;
  loadingAvailableUsers: string;
  noInviteableUsers: string;
  inviteAction: string;
  memberSearch: string;
  memberSearchPlaceholder: string;
  memberCount: string;
  memberCountOne: string;
  activeStatus: string;
  invitedStatus: string;
  notInvitedStatus: string;
  cancelInvitation: string;
  cancelInvitationDescription: string;
  memberColumn: string;
  rankColumn: string;
  roleInEngagementColumn: string;
  independenceColumn: string;
  statusColumn: string;
  actionsColumn: string;
  removeAction: string;
  close: string;
};

type MemberDirectoryRow =
  | {
      kind: "member";
      key: string;
      member: ProjectMember;
      user: ProjectMember["user"];
      projectRole: ProjectRole;
      allowedProjectRoles: ProjectRole[];
    }
  | {
      kind: "invitee";
      key: string;
      user: User;
      projectRole: ProjectRole | null;
      allowedProjectRoles: ProjectRole[];
    };
type InviteeDirectoryRow = Extract<MemberDirectoryRow, { kind: "invitee" }>;

const DEFAULT_INVITE_EXPIRY_DAYS = 7;

function getDefaultProjectRoleForInvitation(
  globalRole: GlobalRole
): ProjectRole | null {
  const roles = getAssignableProjectRolesForGlobalRole(globalRole);
  const preferredRole: Partial<Record<GlobalRole, ProjectRole>> = {
    PARTNER: "PARTNER",
    EQCR: "EQCR",
    TAX_EXPERT: "TAX_REVIEWER",
  };
  const preferred = preferredRole[globalRole] ?? "PREPARER";
  if (roles.includes(preferred)) {
    return preferred;
  }
  if (roles.length > 0) {
    return roles[0] ?? null;
  }
  return null;
}

function isGeneralProjectMemberRole(role: ProjectRole) {
  return role === "PREPARER" || role === "REVIEWER";
}

function isInvitedMember(member: ProjectMember) {
  return member.membershipStatus === "INVITED";
}

function MemberActionContent({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-1">
      {icon}
      {children}
    </span>
  );
}

export function MembersPage({
  projectId,
  presentation = "page",
}: {
  projectId: string;
  workspaceId?: string;
  presentation?: "page" | "sheet";
}) {
  const isSheet = presentation === "sheet";
  const mobile = useCompactViewport(767);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { dictionary, localizedPath, locale } = useI18n();
  const memberCopy: MemberManagementCopy = {
    authorizationSuspended:
      dictionary.projects.leadership?.suspended ??
      defaultProjectLeadershipCopy.suspended,
    memberManagementTitle: dictionary.projects.memberManagementTitle,
    inviteMember: dictionary.projects.inviteMember,
    inviteProjectMembers: dictionary.projects.inviteProjectMembers,
    loadingAvailableUsers: dictionary.projects.loadingAvailableUsers,
    noInviteableUsers: dictionary.projects.noInviteableUsers,
    inviteAction: dictionary.projects.inviteAction,
    memberSearch: dictionary.projects.memberSearch,
    memberSearchPlaceholder: dictionary.projects.memberSearchPlaceholder,
    memberCount: dictionary.projects.memberCount,
    memberCountOne: dictionary.projects.memberCountOne,
    activeStatus: dictionary.projects.activeStatus,
    invitedStatus: dictionary.projects.invitedStatus,
    notInvitedStatus: dictionary.projects.notInvitedStatus,
    cancelInvitation: dictionary.projects.cancelInvitation,
    cancelInvitationDescription:
      dictionary.projects.cancelInvitationDescription,
    memberColumn: dictionary.projects.memberColumn,
    rankColumn: dictionary.projects.rankColumn,
    roleInEngagementColumn: dictionary.projects.roleInEngagementColumn,
    independenceColumn: dictionary.projects.independenceColumn,
    statusColumn: dictionary.projects.statusColumn,
    actionsColumn: dictionary.projects.actionsColumn,
    removeAction: dictionary.projects.removeAction,
    close: getEmpMobileNavigationCopy(locale).close,
  };
  const { confirm } = useToast();
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Record<string, ProjectRole>>({});
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.project(projectId),
    enabled: Boolean(projectId),
  });
  const members = useQuery({
    queryKey: ["members", projectId, "directory"],
    queryFn: () => api.projectMemberDirectory(projectId),
    enabled: Boolean(projectId),
  });
  const hasMemberSearchQuery = Boolean(memberSearchQuery.trim());
  const users = useQuery({
    queryKey: ["user-directory"],
    queryFn: api.userDirectory,
    enabled: invitePanelOpen || hasMemberSearchQuery,
  });
  const memberUserIds = useMemo(
    () => new Set(members.data?.map((member) => member.user.id)),
    [members.data]
  );
  const memberDirectoryRows = useMemo<MemberDirectoryRow[]>(() => {
    const memberRows =
      members.data?.map((member) => {
        const allowedProjectRoles = member.allowedProjectRoles?.length
          ? member.allowedProjectRoles
          : getAssignableProjectRolesForGlobalRole(member.user.globalRole);

        return {
          kind: "member" as const,
          key: `member:${member.id}`,
          member: {
            ...member,
            roleConsistent:
              member.roleConsistent !== false &&
              isProjectPermissionSubjectConsistent({
                globalRole: member.user.globalRole,
                projectRole: member.projectRole,
                inChargeRole: member.inChargeRole,
                authorizationSuspended: Boolean(
                  member.authorizationSuspendedAt
                ),
              }),
          },
          user: member.user,
          projectRole: member.projectRole,
          allowedProjectRoles,
        };
      }) ?? [];

    return memberRows;
  }, [members.data]);
  const filteredMemberDirectoryRows = useMemo(() => {
    const query = memberSearchQuery.trim().toLocaleLowerCase();
    if (!query) {
      return memberDirectoryRows;
    }

    return memberDirectoryRows.filter(({ user }) =>
      [user.name, user.email].some((value) =>
        value.toLocaleLowerCase().includes(query)
      )
    );
  }, [memberDirectoryRows, memberSearchQuery]);
  const inviteeRows = useMemo<InviteeDirectoryRow[]>(
    () =>
      users.data
        ?.filter((user) => !memberUserIds.has(user.id))
        .map((user) => {
          const allowedProjectRoles = getAssignableProjectRolesForGlobalRole(
            user.globalRole
          );

          return {
            kind: "invitee" as const,
            key: `invitee:${user.id}`,
            user,
            projectRole: getDefaultProjectRoleForInvitation(user.globalRole),
            allowedProjectRoles,
          };
        }) ?? [],
    [memberUserIds, users.data]
  );
  const visibleMemberDirectoryRows = useMemo<MemberDirectoryRow[]>(() => {
    if (!hasMemberSearchQuery) {
      return memberDirectoryRows;
    }

    const query = memberSearchQuery.trim().toLocaleLowerCase();
    const matchedInvitees = inviteeRows.filter(({ user }) =>
      [user.name, user.email].some((value) =>
        value.toLocaleLowerCase().includes(query)
      )
    );

    return [...filteredMemberDirectoryRows, ...matchedInvitees];
  }, [
    filteredMemberDirectoryRows,
    hasMemberSearchQuery,
    inviteeRows,
    memberDirectoryRows,
    memberSearchQuery,
  ]);
  const currentMember = useMemo(
    (): ProjectMember | undefined =>
      me.data?.globalRole === "SUPER_ADMIN"
        ? {
            id: `super-admin:${projectId}:${me.data.id}`,
            projectRole: "PREPARER",
            allowedProjectRoles: [],
            roleConsistent: true,
            declarationAccepted: false,
            user: me.data,
          }
        : members.data?.find((member) => member.user.id === me.data?.id),
    [members.data, me.data, projectId]
  );
  const canManageProjectMembers =
    canManageProjectMembersPermission(currentMember);
  const canManageLeadership =
    currentMember &&
    canManageProjectLeadership({
      globalRole: currentMember.user.globalRole,
      projectRole: currentMember.projectRole,
      inChargeRole: currentMember.inChargeRole,
      authorizationSuspended: Boolean(currentMember.authorizationSuspendedAt),
    });
  const isMemberDirectoryLoading = members.isLoading;
  const isInviteDirectoryLoading = invitePanelOpen && users.isLoading;
  const create = useMutation({
    mutationFn: (values: {
      recipientUserId: string;
      invitedRole: ProjectRole;
      expiresInDays: number;
    }) => api.createInvitation(projectId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["members", projectId],
      });
    },
  });
  const updateRole = useMutation({
    mutationFn: ({
      memberId,
      projectRole,
    }: {
      memberId: string;
      projectRole: ProjectRole;
    }) => api.updateProjectMemberRole(projectId, memberId, { projectRole }),
    onSuccess: async () => {
      setEditingMemberId(null);
      await queryClient.invalidateQueries({
        queryKey: ["members", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["auditLogs", projectId],
      });
    },
  });
  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      api.removeProjectMember(projectId, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["members", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["auditLogs", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["project", projectId],
      });
    },
  });
  const cancelInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      api.cancelProjectInvitation(projectId, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["members", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["auditLogs", projectId],
      });
    },
  });
  const inviteUser = (
    row: Extract<MemberDirectoryRow, { kind: "invitee" }>
  ) => {
    if (!row.projectRole) {
      return;
    }
    create.mutate({
      recipientUserId: row.user.id,
      invitedRole: row.projectRole,
      expiresInDays: DEFAULT_INVITE_EXPIRY_DAYS,
    });
  };
  const managementControls = (
    <>
      <ProjectLeadershipControls
        projectId={projectId}
        members={members.data ?? []}
        userId={me.data?.id}
        isAdmin={me.data?.globalRole === "SUPER_ADMIN"}
        readOnly={project.data?.status !== "ACTIVE"}
        allowRecovery={Boolean(
          project.data && project.data.status !== "DELETED"
        )}
      />
      <ProjectReauthorizationControls
        projectId={projectId}
        members={members.data ?? []}
        userId={me.data?.id}
        isAdmin={me.data?.globalRole === "SUPER_ADMIN"}
        disabled={!project.data || project.data.status === "DELETED"}
      />
    </>
  );
  const countLabel = (
    visibleMemberDirectoryRows.length === 1
      ? (memberCopy.memberCountOne ?? memberCopy.memberCount)
      : memberCopy.memberCount
  ).replace("{count}", String(visibleMemberDirectoryRows.length));
  const memberManagementTable = (
    <section className={cn("grid min-h-0 gap-4", styles.page)}>
      {mobile ? (
        <div className={styles.summary}>
          <span>{countLabel}</span>
          {canManageLeadership || me.data?.globalRole === "SUPER_ADMIN" ? (
            <>
              <MobileButton
                variant="quiet"
                size="icon"
                aria-label={`${memberCopy.memberManagementTitle} · ${memberCopy.actionsColumn}`}
                onClick={() => setManagementOpen(true)}
              >
                <MoreHorizontal aria-hidden />
              </MobileButton>
              <MobileActionSheet
                open={managementOpen}
                onOpenChange={setManagementOpen}
                title={memberCopy.memberManagementTitle}
                closeLabel={memberCopy.close}
              >
                <div className={styles.managementActions}>
                  {managementControls}
                </div>
              </MobileActionSheet>
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2 empty:hidden">
          {managementControls}
        </div>
      )}
      {isSheet || mobile ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {memberCopy.memberManagementTitle}
          </h2>
          <InviteMemberPopover
            open={invitePanelOpen}
            onOpenChange={setInvitePanelOpen}
            copy={memberCopy}
            disabled={!canManageProjectMembers}
            rows={inviteeRows}
            canManageProjectMembers={canManageProjectMembers}
            createPending={create.isPending}
            loading={isInviteDirectoryLoading}
            hasError={Boolean(users.error)}
            onInvite={inviteUser}
          />
        </div>
      )}

      {isMemberDirectoryLoading ? (
        <div className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
          Loading members...
        </div>
      ) : null}
      {isMemberDirectoryLoading ? null : (
        <>
          <div
            className={cn(
              "relative mx-auto w-full max-w-sm",
              mobile && styles.search,
              hasMemberSearchQuery && "pr-10",
              isSheet &&
                "md:absolute md:top-4 md:left-1/2 md:z-10 md:-translate-x-[calc(50%+5.5rem)]"
            )}
          >
            <MemberDirectorySearch
              ariaLabel={memberCopy.memberSearch}
              countLabel={mobile ? "" : countLabel}
              placeholder={memberCopy.memberSearchPlaceholder}
              query={memberSearchQuery}
              onQueryChange={setMemberSearchQuery}
            />
            {hasMemberSearchQuery ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full border-0 bg-transparent shadow-none"
                tooltip={dictionary.common.back}
                onClick={() => setMemberSearchQuery("")}
              >
                <Undo2 />
              </Button>
            ) : null}
          </div>
          <MemberManagementDataTable
            rows={visibleMemberDirectoryRows}
            mobile={mobile}
            locale={locale}
            hasSearchQuery={hasMemberSearchQuery}
            copy={memberCopy}
            currentMember={currentMember}
            canManageProjectMembers={canManageProjectMembers}
            editingMemberId={editingMemberId}
            draftRoles={draftRoles}
            createPending={create.isPending}
            updateRolePending={updateRole.isPending}
            removeMemberPending={removeMember.isPending}
            cancelInvitationPending={cancelInvitation.isPending}
            onInvite={inviteUser}
            onStartEdit={(member) => {
              setEditingMemberId(member.id);
              setDraftRoles((current) => ({
                ...current,
                [member.id]: resolveMemberRoleDraft(
                  member.projectRole,
                  member.allowedProjectRoles
                ),
              }));
            }}
            onCancelEdit={() => setEditingMemberId(null)}
            onDraftRoleChange={(memberId, projectRole) =>
              setDraftRoles((current) => ({
                ...current,
                [memberId]: projectRole,
              }))
            }
            onSave={(member) =>
              updateRole.mutate({
                memberId: member.id,
                projectRole: draftRoles[member.id] ?? member.projectRole,
              })
            }
            onRemove={async (member) => {
              const confirmed = await confirm({
                title: "Confirm member removal",
                description: `Remove ${member.user.name} from this project? Historical audit records will be retained.`,
                confirmLabel: "Remove",
                cancelLabel: "Cancel",
              });
              if (confirmed) {
                removeMember.mutate(member.id);
              }
            }}
            onCancelInvitation={async (member) => {
              if (!member.invitationId) {
                return;
              }
              const confirmed = await confirm({
                title: memberCopy.cancelInvitation,
                description: memberCopy.cancelInvitationDescription.replace(
                  "{name}",
                  member.user.name
                ),
                confirmLabel: memberCopy.cancelInvitation,
                cancelLabel: dictionary.common.cancel,
              });
              if (confirmed) {
                cancelInvitation.mutate(member.invitationId);
              }
            }}
          />
        </>
      )}
    </section>
  );

  if (isSheet) {
    return memberManagementTable;
  }

  return (
    <div className={PAGE_SHELL_CLASS}>
      <ProjectWingTopBar
        centerOnMobile
        leading={
          <>
            <ProjectWingTopBarBrand />
            <ProjectWingTopBarReturnAction
              label={dictionary.projects.memberManagementBackToWorkbench}
              onClick={() =>
                router.replace(localizedPath(`/engagement/${projectId}`))
              }
            />
            <EmpPortalAction />
          </>
        }
        center={
          <ProjectWingTopBarTitle
            title={dictionary.projects.memberManagementTopBarTitle}
            description={dictionary.projects.memberManagementDescription}
          />
        }
        actions={
          <EmpTopBarControls
            settingsTitle={dictionary.projects.memberManagementSettingsTitle}
            settingsDescription={
              dictionary.projects.memberManagementSettingsDescription
            }
          />
        }
      />
      <div className={PAGE_CONTENT_CLASS}>{memberManagementTable}</div>
    </div>
  );
}

function InviteMemberPopover({
  open,
  onOpenChange,
  copy,
  disabled,
  rows,
  canManageProjectMembers,
  createPending,
  loading,
  hasError,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: MemberManagementCopy;
  disabled: boolean;
  rows: InviteeDirectoryRow[];
  canManageProjectMembers: boolean;
  createPending: boolean;
  loading: boolean;
  hasError: boolean;
  onInvite: (row: InviteeDirectoryRow) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" disabled={disabled}>
            <MemberActionContent icon={<MailPlus />}>
              {copy.inviteMember}
            </MemberActionContent>
          </Button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionAvoidance={{ side: "flip" }}
        className="w-[min(34rem,calc(100vw-2rem))] border-border/70 bg-popover/90 p-3 shadow-xl shadow-foreground/10 backdrop-blur-md"
      >
        <PopoverHeader className="gap-0">
          <PopoverTitle className="text-sm font-semibold text-foreground">
            {copy.inviteProjectMembers}
          </PopoverTitle>
        </PopoverHeader>
        {loading ? (
          <div
            className="space-y-3 p-2"
            aria-busy="true"
            aria-label={copy.loadingAvailableUsers}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28 rounded-sm" />
                <Skeleton className="h-3 w-40 rounded-sm" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24 rounded-sm" />
                <Skeleton className="h-3 w-36 rounded-sm" />
              </div>
            </div>
          </div>
        ) : null}
        {!loading && !hasError ? (
          <InviteeDirectoryList
            rows={rows}
            copy={copy}
            canManageProjectMembers={canManageProjectMembers}
            createPending={createPending}
            onInvite={onInvite}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function InviteeDirectoryList({
  rows,
  copy,
  canManageProjectMembers,
  createPending,
  onInvite,
}: {
  rows: InviteeDirectoryRow[];
  copy: MemberManagementCopy;
  canManageProjectMembers: boolean;
  createPending: boolean;
  onInvite: (row: InviteeDirectoryRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        {copy.noInviteableUsers}
      </div>
    );
  }

  return (
    <div className="grid max-h-[min(24rem,calc(100vh-12rem))] gap-1.5 overflow-auto pr-1">
      <div className="hidden grid-cols-[minmax(0,1fr)_7.5rem_10rem_6.5rem] gap-3 px-3 text-xs font-medium text-muted-foreground md:grid">
        <span />
        <span>Rank</span>
        <span>Role in Engagement</span>
        <span />
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid gap-3 rounded-md border border-border/65 bg-background/55 px-3 py-2 md:grid-cols-[minmax(0,1fr)_7.5rem_10rem_6.5rem] md:items-center"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {row.user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.user.email}
            </p>
          </div>
          <span className="text-sm text-foreground">
            {getFirmRankLabel(row.user.globalRole)}
          </span>
          <span className="text-sm text-foreground">
            {row.projectRole
              ? getRoleInEngagementLabel({
                  globalRole: row.user.globalRole,
                  projectRole: row.projectRole,
                })
              : "-"}
          </span>
          <Button
            type="button"
            size="icon-sm"
            disabled={
              createPending ||
              !canManageProjectMembers ||
              !row.projectRole ||
              row.allowedProjectRoles.length === 0
            }
            onClick={() => onInvite(row)}
            tooltip={`Invite ${row.user.name}`}
          >
            <MailPlus data-icon="inline-start" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function MemberRoleSelect({
  className,
  onValueChange,
  options,
  value,
}: {
  className?: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: ProjectRole }[];
  value: ProjectRole;
}) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? value;

  return (
    <Select
      items={options}
      value={value}
      onValueChange={(nextValue) => onValueChange(String(nextValue ?? ""))}
    >
      <SelectTrigger className={className}>
        <SelectValue>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              onClick={() => onValueChange(option.value)}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function MemberManagementDataTable({
  rows,
  mobile,
  locale,
  hasSearchQuery,
  copy,
  currentMember,
  canManageProjectMembers,
  editingMemberId,
  draftRoles,
  createPending,
  updateRolePending,
  removeMemberPending,
  cancelInvitationPending,
  onInvite,
  onStartEdit,
  onCancelEdit,
  onDraftRoleChange,
  onSave,
  onRemove,
  onCancelInvitation,
}: {
  rows: MemberDirectoryRow[];
  mobile: boolean;
  locale: "zh-CN" | "en-US";
  hasSearchQuery: boolean;
  copy: MemberManagementCopy;
  currentMember?: ProjectMember;
  canManageProjectMembers: boolean;
  editingMemberId: string | null;
  draftRoles: Record<string, ProjectRole>;
  createPending: boolean;
  updateRolePending: boolean;
  removeMemberPending: boolean;
  cancelInvitationPending: boolean;
  onInvite: (row: Extract<MemberDirectoryRow, { kind: "invitee" }>) => void;
  onStartEdit: (member: ProjectMember) => void;
  onCancelEdit: () => void;
  onDraftRoleChange: (memberId: string, role: ProjectRole) => void;
  onSave: (member: ProjectMember) => void;
  onRemove: (member: ProjectMember) => void;
  onCancelInvitation: (member: ProjectMember) => void;
}) {
  const [initialRowCount, setInitialRowCount] = useState(rows.length);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  void setInitialRowCount;
  const reservedRowCount = Math.max(1, initialRowCount);
  const placeholderRowCount = Math.max(
    0,
    reservedRowCount - Math.max(rows.length, 1)
  );
  const columns = useMemo<ColumnDef<MemberDirectoryRow>[]>(
    () => [
      {
        id: "member",
        header: copy.memberColumn,
        cell: ({ row }) => {
          const memberRow = row.original;
          return (
            <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3">
              <Avatar
                className={cn(
                  "size-10 shadow-sm",
                  getAvatarColorClassName(memberRow.user.name)
                )}
                size="lg"
                label={memberRow.user.name}
              >
                <AvatarFallback className="bg-transparent text-[0.82rem] leading-none font-bold text-inherit">
                  {getAvatarInitials(memberRow.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 gap-0.5">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="min-w-0 truncate leading-tight font-medium text-foreground">
                    {memberRow.user.name}
                  </span>
                  {memberRow.kind === "member" &&
                  !isInvitedMember(memberRow.member) &&
                  !memberRow.member.roleConsistent ? (
                    <Badge tone="amber">
                      <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                      {copy.authorizationSuspended}
                    </Badge>
                  ) : null}
                </div>
                <span className="truncate text-xs leading-tight text-muted-foreground">
                  {memberRow.user.email}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "rank",
        header: copy.rankColumn,
        cell: ({ row }) => (
          <span className="text-foreground">
            {getFirmRankLabel(row.original.user.globalRole)}
          </span>
        ),
      },
      {
        id: "role",
        header: copy.roleInEngagementColumn,
        cell: ({ row }) => {
          const memberRow = row.original;
          const inChargeRole =
            memberRow.kind === "member" &&
            !memberRow.member.authorizationSuspendedAt
              ? memberRow.member.inChargeRole
              : null;
          if (!memberRow.projectRole) {
            return <Badge tone="slate">Cannot invite</Badge>;
          }

          return (
            <span className="text-foreground">
              {getRoleInEngagementLabel({
                globalRole: memberRow.user.globalRole,
                projectRole: memberRow.projectRole,
                inChargeRole,
              })}
            </span>
          );
        },
      },
      {
        id: "independence",
        header: copy.independenceColumn,
        cell: ({ row }) => {
          const memberRow = row.original;
          if (
            memberRow.kind === "invitee" ||
            isInvitedMember(memberRow.member)
          ) {
            return <span className="text-muted-foreground">-</span>;
          }

          return (
            <IndependenceStatusHoverCard
              member={memberRow.member}
              memberName={memberRow.user.name}
            />
          );
        },
      },
      {
        id: "status",
        header: copy.statusColumn,
        cell: ({ row }) => {
          const memberRow = row.original;
          const isInvited =
            memberRow.kind === "member" && isInvitedMember(memberRow.member);
          return (
            <Badge
              tone={
                memberRow.kind === "member" && !isInvited ? "green" : "slate"
              }
            >
              {isInvited
                ? copy.invitedStatus
                : memberRow.kind === "member"
                  ? copy.activeStatus
                  : copy.notInvitedStatus}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: copy.actionsColumn,
        cell: ({ row }) => {
          const memberRow = row.original;

          if (memberRow.kind === "invitee") {
            return (
              <MemberDirectoryAction
                accessibleName={`${copy.inviteAction} ${memberRow.user.name}`}
                disabled={
                  createPending ||
                  !canManageProjectMembers ||
                  !memberRow.projectRole ||
                  memberRow.allowedProjectRoles.length === 0
                }
                icon={MailPlus}
                onClick={() => onInvite(memberRow)}
                variant="default"
              >
                {copy.inviteAction}
              </MemberDirectoryAction>
            );
          }

          const { member } = memberRow;
          const isInvited = isInvitedMember(member);
          if (isInvited) {
            return canManageProjectMembers ? (
              <MemberDirectoryAction
                accessibleName={`${copy.cancelInvitation} ${memberRow.user.name}`}
                disabled={cancelInvitationPending || !member.invitationId}
                icon={MailX}
                onClick={() => onCancelInvitation(member)}
              >
                {copy.cancelInvitation}
              </MemberDirectoryAction>
            ) : null;
          }
          const hasOnlyGeneralMemberRoles =
            memberRow.allowedProjectRoles.length > 0 &&
            memberRow.allowedProjectRoles.every(isGeneralProjectMemberRole);
          const canUpdateRole = canManageProjectMember(
            currentMember,
            member,
            "update-role"
          );
          const canRemove = canManageProjectMember(
            currentMember,
            member,
            "remove"
          );
          const canEditRole =
            canUpdateRole &&
            memberRow.allowedProjectRoles.length > 0 &&
            !hasOnlyGeneralMemberRoles;
          const isEditing = editingMemberId === member.id;
          const draftRole = draftRoles[member.id] ?? member.projectRole;

          return (
            <div className="flex flex-nowrap items-center justify-start gap-2 whitespace-nowrap">
              {isEditing ? (
                <>
                  <MemberRoleSelect
                    className="w-40"
                    value={draftRole}
                    onValueChange={(value) =>
                      onDraftRoleChange(member.id, value as ProjectRole)
                    }
                    options={memberRow.allowedProjectRoles.map((role) => ({
                      label: getInvitationRoleLabel(
                        member.user.globalRole,
                        role
                      ),
                      value: role,
                    }))}
                  />
                  <ButtonGroup>
                    <MemberDirectoryAction
                      accessibleName={`Save ${memberRow.user.name}`}
                      disabled={
                        updateRolePending || draftRole === member.projectRole
                      }
                      icon={Save}
                      onClick={() => onSave(member)}
                      variant="default"
                    >
                      Save
                    </MemberDirectoryAction>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={onCancelEdit}
                    >
                      Cancel
                    </Button>
                  </ButtonGroup>
                </>
              ) : (
                <>
                  {canEditRole && !isInvitedMember(member) ? (
                    <MemberDirectoryAction
                      accessibleName={`Change role ${memberRow.user.name}`}
                      onClick={() => onStartEdit(member)}
                    >
                      Change role
                    </MemberDirectoryAction>
                  ) : null}
                  {canRemove && !isInvitedMember(member) ? (
                    <MemberDirectoryAction
                      accessibleName={`${copy.removeAction} ${memberRow.user.name}`}
                      disabled={removeMemberPending}
                      icon={Trash2}
                      onClick={() => onRemove(member)}
                      variant="destructive"
                    >
                      {copy.removeAction}
                    </MemberDirectoryAction>
                  ) : null}
                </>
              )}
            </div>
          );
        },
      },
    ],
    [
      canManageProjectMembers,
      copy,
      createPending,
      currentMember,
      draftRoles,
      editingMemberId,
      onCancelEdit,
      onDraftRoleChange,
      onInvite,
      onRemove,
      onSave,
      onStartEdit,
      onCancelInvitation,
      cancelInvitationPending,
      removeMemberPending,
      updateRolePending,
    ]
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.key,
  });

  if (mobile) {
    const activeRow = table
      .getRowModel()
      .rows.find((row) => row.id === activeMemberId);
    const renderCell = (row: Row<MemberDirectoryRow>, id: string) => {
      const cell = row.getAllCells().find((item) => item.column.id === id);
      if (!cell) {
        return null;
      }
      const renderer = cell.column.columnDef.cell;
      return typeof renderer === "function"
        ? renderer(cell.getContext())
        : renderer;
    };
    return (
      <>
        <ul
          className={styles.list}
          aria-label={copy.memberManagementTitle}
          data-testid="emp-mobile-member-list"
        >
          {table.getRowModel().rows.map((row) => (
            <li className={styles.member} key={row.id}>
              <div className={styles.identity}>
                {renderCell(row, "member")}
                {row.original.kind === "invitee" ||
                isInvitedMember(row.original.member) ? (
                  <div className={styles.invitationStatus}>
                    {renderCell(row, "status")}
                  </div>
                ) : null}
              </div>
              <MobileButton
                className={styles.memberMore}
                variant="quiet"
                size="icon"
                aria-label={`${row.original.user.name} · ${copy.actionsColumn}`}
                onClick={() => setActiveMemberId(row.id)}
              >
                <MoreHorizontal aria-hidden />
              </MobileButton>
              <dl className={styles.metadata}>
                <div>
                  <dt>{copy.rankColumn}</dt>
                  <dd>{renderCell(row, "rank")}</dd>
                </div>
                <div>
                  <dt>{copy.roleInEngagementColumn}</dt>
                  <dd>{renderCell(row, "role")}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        {rows.length === 0 ? (
          <CollectionState
            kind={hasSearchQuery ? "filtered" : "empty"}
            locale={locale}
          />
        ) : null}
        <MobileActionSheet
          open={Boolean(activeRow)}
          onOpenChange={(open) => {
            if (!open) {
              setActiveMemberId(null);
            }
          }}
          title={activeRow?.original.user.name ?? copy.memberManagementTitle}
          closeLabel={copy.close}
        >
          {activeRow ? (
            <div className={styles.memberDetails}>
              <dl className={styles.metadata}>
                <div>
                  <dt>{copy.statusColumn}</dt>
                  <dd>{renderCell(activeRow, "status")}</dd>
                </div>
                <div>
                  <dt>{copy.independenceColumn}</dt>
                  <dd>{renderCell(activeRow, "independence")}</dd>
                </div>
              </dl>
              <div className={styles.rowActions}>
                {renderCell(activeRow, "actions")}
              </div>
            </div>
          ) : null}
        </MobileActionSheet>
      </>
    );
  }

  return (
    <MemberDirectoryTable
      headers={[
        copy.memberColumn,
        copy.rankColumn,
        copy.roleInEngagementColumn,
        copy.independenceColumn,
        copy.statusColumn,
        copy.actionsColumn,
      ]}
      label={copy.memberManagementTitle}
      layout="management"
    >
      {table.getRowModel().rows.length > 0 ? (
        table.getRowModel().rows.map((row) => (
          <MemberDirectoryRowComponent key={row.id}>
            {row.getVisibleCells().map((cell, index) => (
              <MemberDirectoryCell
                key={cell.id}
                className={cn(
                  index === 0 && "min-w-0",
                  index === 5 && "whitespace-nowrap px-1"
                )}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </MemberDirectoryCell>
            ))}
          </MemberDirectoryRowComponent>
        ))
      ) : (
        <MemberDirectoryRowComponent>
          <MemberDirectoryCell className="col-span-6 flex h-14 items-center justify-center text-center text-sm text-muted-foreground">
            No project members or inviteable users.
          </MemberDirectoryCell>
        </MemberDirectoryRowComponent>
      )}
      {Array.from({ length: placeholderRowCount }, (_, index) => (
        <MemberDirectoryRowComponent
          key={`reserved-member-row-${index}`}
          aria-hidden="true"
          className="invisible h-[56.75px]"
        >
          <MemberDirectoryCell className="col-span-6" />
        </MemberDirectoryRowComponent>
      ))}
    </MemberDirectoryTable>
  );
}

function IndependenceStatusHoverCard({
  member,
  memberName,
}: {
  member: ProjectMember;
  memberName: string;
}) {
  const { dictionary, locale } = useI18n();
  const copy = dictionary.projects;
  const signed = member.declarationAccepted;
  const status = signed ? copy.independenceSigned : copy.independenceNotSigned;
  const method = signed
    ? copy.independenceElectronicSignOff
    : copy.independencePendingSignOff;
  const signedAt = member.declarationAcceptedAt
    ? formatDeclarationDate(member.declarationAcceptedAt, locale)
    : "-";

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            accessibleName={`${copy.independenceColumn}${copy.statusColumn}：${memberName}`}
            className="h-auto cursor-pointer rounded-full p-0 hover:bg-transparent"
          >
            <Badge tone={signed ? "green" : "slate"}>{status}</Badge>
          </Button>
        }
      />
      <HoverCardContent align="start" className="w-72">
        <div className="grid gap-3">
          <dl className="grid gap-2 text-sm">
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">
                {copy.independenceSigner}
              </dt>
              <dd className="font-medium text-foreground">{memberName}</dd>
            </div>
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">{copy.statusColumn}</dt>
              <dd className="font-medium text-foreground">{status}</dd>
            </div>
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">
                {copy.independenceSigningMethod}
              </dt>
              <dd className="text-foreground">{method}</dd>
            </div>
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">
                {copy.independenceSignedAt}
              </dt>
              <dd className="text-foreground">{signedAt}</dd>
            </div>
          </dl>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function formatDeclarationDate(value: string, locale: "zh-CN" | "en-US") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}
