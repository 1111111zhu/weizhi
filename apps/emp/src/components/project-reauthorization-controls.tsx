"use client";
import {
  canManageProjectLeadership,
  getAssignableProjectRolesForGlobalRole,
  isProjectPermissionSubjectConsistent,
} from "@project-wing/shared";
import type { ProjectRole } from "@project-wing/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/api/client";
import type { ProjectMember } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/client";
import { defaultProjectLeadershipCopy } from "@/i18n/dictionaries";
import { getInvitationRoleLabel } from "@/lib/member-role-labels";

export function ProjectReauthorizationControls({
  projectId,
  members,
  userId,
  isAdmin = false,
  disabled = false,
}: {
  projectId: string;
  members: ProjectMember[];
  userId?: string;
  isAdmin?: boolean;
  disabled?: boolean;
}) {
  const { dictionary } = useI18n();
  const copy = dictionary?.projects?.leadership ?? defaultProjectLeadershipCopy;
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState<ProjectRole | null>(null);
  const [reason, setReason] = useState("");
  const client = useQueryClient();
  const subject = (member: ProjectMember) => ({
    globalRole: member.user.globalRole,
    projectRole: member.projectRole,
    inChargeRole: member.inChargeRole,
    authorizationSuspended: Boolean(member.authorizationSuspendedAt),
  });
  const actor = members.find(
    (member) =>
      member.user.id === userId &&
      member.membershipStatus !== "INVITED" &&
      member.user.status !== "DISABLED"
  );
  const candidates = members.filter(
    (member) =>
      member.user.id !== userId &&
      member.membershipStatus !== "INVITED" &&
      member.user.status !== "DISABLED" &&
      !isProjectPermissionSubjectConsistent(subject(member)) &&
      getAssignableProjectRolesForGlobalRole(member.user.globalRole).length
  );
  const selected = candidates.find((member) => member.id === memberId);
  const roles = selected
    ? getAssignableProjectRolesForGlobalRole(selected.user.globalRole)
    : [];
  const roleOptions = selected
    ? roles.map((value) => ({
        value,
        label: getInvitationRoleLabel(selected.user.globalRole, value),
      }))
    : [];
  const mutation = useMutation({
    mutationFn: () =>
      api.reauthorizeProjectMember(projectId, memberId, {
        projectRole: role as ProjectRole,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["members", projectId] }),
        client.invalidateQueries({ queryKey: ["project", projectId] }),
        client.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      ]);
      setOpen(false);
      setReason("");
      setRole(null);
      setMemberId("");
    },
  });
  if (
    disabled ||
    (!isAdmin && (!actor || !canManageProjectLeadership(subject(actor)))) ||
    !candidates.length
  ) {
    return null;
  }
  return (
    <>
      <Button
        className="justify-self-end"
        variant="outline"
        size="sm"
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
      >
        {copy.reauthorize}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) {
            setOpen(value);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.reauthorize}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field>
              <FieldLabel>{copy.member}</FieldLabel>
              <Select
                value={selected?.id ?? null}
                disabled={mutation.isPending}
                items={candidates.map((member) => ({
                  value: member.id,
                  label: member.user.name,
                }))}
                onValueChange={(value) => {
                  setMemberId(value ?? "");
                  setRole(null);
                }}
              >
                <SelectTrigger aria-label={copy.member}>
                  <SelectValue placeholder={copy.member} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{copy.projectRole}</FieldLabel>
              <Select
                value={role}
                disabled={!selected || mutation.isPending}
                items={roleOptions}
                onValueChange={(value) => setRole(value as ProjectRole | null)}
              >
                <SelectTrigger aria-label={copy.projectRole}>
                  <SelectValue placeholder={copy.projectRole} />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="project-reauthorization-reason">
                {copy.reauthorizationReason}
              </FieldLabel>
              <Input
                id="project-reauthorization-reason"
                value={reason}
                disabled={mutation.isPending}
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            {mutation.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : copy.failed}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setOpen(false)}
              >
                {copy.cancel}
              </Button>
              <Button
                disabled={
                  !selected ||
                  !role ||
                  !roles.includes(role) ||
                  !reason.trim() ||
                  mutation.isPending
                }
                onClick={() => mutation.mutate()}
              >
                {copy.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
