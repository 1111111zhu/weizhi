"use client";

import {
  MemberDirectoryAction,
  MemberDirectoryAvatar,
  MemberDirectoryCell,
  MemberDirectoryIdentity,
  MemberDirectoryRow,
  MemberDirectorySearch as SharedMemberDirectorySearch,
  MemberDirectoryTable as SharedMemberDirectoryTable,
} from "@project-wing/ui";
import { Send, UserPlus } from "lucide-react";

import type { DirectoryUser } from "../api/client";
import type {
  ClientFormMemberActionDialogCopy,
  ClientFormMemberActionKind,
} from "./client-form-member-action-dialog";

export function MemberDirectorySearch({
  copy,
  count,
  query,
  onQueryChange,
}: {
  copy: ClientFormMemberActionDialogCopy;
  count: number;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const countLabel = (
    count === 1 ? copy.memberCountOne : copy.memberCountOther
  ).replace("{count}", String(count));
  return (
    <SharedMemberDirectorySearch
      ariaLabel={copy.searchLabel}
      autoFocus
      className="absolute top-4 left-1/2 z-10 -translate-x-1/2"
      countLabel={countLabel}
      query={query}
      onQueryChange={onQueryChange}
    />
  );
}

export function MemberDirectoryTable({
  actionKind,
  copy,
  disabled,
  users,
  onAction,
}: {
  actionKind: ClientFormMemberActionKind;
  copy: ClientFormMemberActionDialogCopy;
  disabled?: boolean;
  users: DirectoryUser[];
  onAction: (user: DirectoryUser) => void;
}) {
  const headers = [
    copy.memberColumn,
    copy.rankColumn,
    copy.roleColumn,
    copy.actionsColumn,
  ];
  return (
    <SharedMemberDirectoryTable
      headers={headers}
      label={copy.title}
      layout="assignment"
    >
      {users.length > 0 ? (
        users.map((user) => (
          <AssignmentMemberRow
            key={user.id}
            actionKind={actionKind}
            copy={copy}
            disabled={disabled}
            user={user}
            onAction={onAction}
          />
        ))
      ) : (
        <div className="flex h-14 items-center justify-center border-b border-border text-sm text-muted-foreground">
          {copy.emptyLabel}
        </div>
      )}
    </SharedMemberDirectoryTable>
  );
}

function AssignmentMemberRow({
  actionKind,
  copy,
  disabled,
  user,
  onAction,
}: {
  actionKind: ClientFormMemberActionKind;
  copy: ClientFormMemberActionDialogCopy;
  disabled?: boolean;
  user: DirectoryUser;
  onAction: (user: DirectoryUser) => void;
}) {
  const ActionIcon = actionKind === "assign" ? UserPlus : Send;
  return (
    <MemberDirectoryRow>
      <MemberDirectoryIdentity
        avatar={<MemberDirectoryAvatar name={user.name} />}
        email={user.email}
        name={user.name}
      />
      <MemberDirectoryCell>
        {getMemberRoleLabel(user.globalRole)}
      </MemberDirectoryCell>
      <MemberDirectoryCell>
        {getMemberRoleLabel(user.globalRole)}
      </MemberDirectoryCell>
      <MemberDirectoryCell>
        <MemberDirectoryAction
          accessibleName={`${copy.actionLabel} ${user.name}`}
          disabled={disabled}
          icon={ActionIcon}
          onClick={() => onAction(user)}
        >
          {copy.actionLabel}
        </MemberDirectoryAction>
      </MemberDirectoryCell>
    </MemberDirectoryRow>
  );
}

export function getMemberRoleLabel(role: DirectoryUser["globalRole"]) {
  return role
    .toLocaleLowerCase()
    .split("_")
    .map((part) => `${part[0]?.toLocaleUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
