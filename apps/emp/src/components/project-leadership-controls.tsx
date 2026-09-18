"use client";
import {
  canManageProjectLeadership,
  isProjectPermissionSubjectConsistent,
} from "@project-wing/shared";
import type { InChargeRole } from "@project-wing/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function ProjectLeadershipControls({
  projectId,
  members,
  userId,
  isAdmin,
  readOnly = false,
  allowRecovery = true,
}: {
  projectId: string;
  members: ProjectMember[];
  userId?: string;
  isAdmin: boolean;
  readOnly?: boolean;
  allowRecovery?: boolean;
}) {
  const { dictionary } = useI18n();
  const copy = dictionary?.projects?.leadership ?? defaultProjectLeadershipCopy;
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState<InChargeRole | "none">("PARTNER_IN_CHARGE");
  const [reason, setReason] = useState("");
  const client = useQueryClient();
  const active = members.filter(
    (member) =>
      member.membershipStatus !== "INVITED" && member.user.status !== "DISABLED"
  );
  const subject = (member: ProjectMember) => ({
    authorizationSuspended: Boolean(member.authorizationSuspendedAt),
    globalRole: member.user.globalRole,
    projectRole: member.projectRole,
    inChargeRole: member.inChargeRole,
  });
  const pics = active.filter((member) =>
    canManageProjectLeadership(subject(member))
  );
  const canManage = isAdmin || pics.some((member) => member.user.id === userId);
  const recovering = isAdmin && allowRecovery && pics.length === 0;
  const nextRole = recovering
    ? "PARTNER_IN_CHARGE"
    : role === "none"
      ? null
      : role;
  const candidates = active.filter((member) =>
    nextRole
      ? member.user.id !== userId &&
        isProjectPermissionSubjectConsistent({
          ...subject(member),
          authorizationSuspended: false,
          projectRole:
            nextRole === "PARTNER_IN_CHARGE" ? "PARTNER" : "REVIEWER",
          inChargeRole: nextRole,
        })
      : Boolean(member.inChargeRole) &&
        !(pics.length === 1 && pics[0].id === member.id)
  );
  const inviting = recovering && candidates.length === 0;
  const directory = useQuery({
    queryKey: ["user-directory"],
    queryFn: api.userDirectory,
    enabled: open && inviting,
  });
  const invitees = (directory.data ?? []).filter(
    (user) =>
      user.status === "ACTIVE" &&
      ["PARTNER", "PRINCIPAL"].includes(user.globalRole) &&
      !members.some((member) => member.user.id === user.id)
  );
  const options = inviting
    ? invitees.map((user) => ({ value: user.id, label: user.name }))
    : candidates.map((member) => ({
        value: member.id,
        label: member.user.name,
      }));
  const selection = options.find((option) => option.value === memberId);
  const mutation = useMutation({
    mutationFn: async () => {
      await (inviting
        ? api.createPicRecoveryInvitation(projectId, {
            recipientUserId: memberId,
            reason: reason.trim(),
          })
        : recovering
          ? api.recoverProjectPic(projectId, memberId, {
              reason: reason.trim(),
            })
          : api.updateProjectMemberInChargeRole(projectId, memberId, {
              inChargeRole: nextRole,
            }));
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["members", projectId] }),
        client.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      ]);
      setOpen(false);
      setMemberId("");
      setReason("");
    },
  });
  if ((readOnly && !recovering) || (!canManage && !recovering)) {
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
        {recovering ? copy.recover : copy.title}
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
            <DialogTitle>
              {inviting
                ? copy.recoveryInvite
                : recovering
                  ? copy.recover
                  : copy.title}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {recovering ? null : (
              <Field>
                <FieldLabel>{copy.role}</FieldLabel>
                <Select
                  value={role}
                  items={[
                    { value: "PARTNER_IN_CHARGE", label: copy.pic },
                    { value: "MANAGER_IN_CHARGE", label: copy.mic },
                    { value: "none", label: copy.clear },
                  ]}
                  disabled={mutation.isPending}
                  onValueChange={(value) => {
                    setRole(value as InChargeRole | "none");
                    setMemberId("");
                  }}
                >
                  <SelectTrigger aria-label={copy.role}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PARTNER_IN_CHARGE">
                      {copy.pic}
                    </SelectItem>
                    <SelectItem value="MANAGER_IN_CHARGE">
                      {copy.mic}
                    </SelectItem>
                    <SelectItem value="none">{copy.clear}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel>{copy.member}</FieldLabel>
              <Select
                value={selection?.value ?? null}
                items={options}
                onValueChange={(value) => setMemberId(value ?? "")}
                disabled={mutation.isPending || options.length === 0}
              >
                <SelectTrigger aria-label={copy.member}>
                  <SelectValue placeholder={copy.member} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">{copy.empty}</p>
              ) : null}
              {inviting && directory.isError ? (
                <Button variant="outline" onClick={() => directory.refetch()}>
                  {copy.retry}
                </Button>
              ) : null}
            </Field>
            {recovering ? (
              <Field>
                <FieldLabel htmlFor="pic-recovery-reason">
                  {copy.reason}
                </FieldLabel>
                <Input
                  id="pic-recovery-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={1000}
                  disabled={mutation.isPending}
                />
              </Field>
            ) : null}
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
                  !selection ||
                  mutation.isPending ||
                  (recovering && !reason.trim())
                }
                onClick={() => mutation.mutate()}
              >
                {inviting ? copy.sendRecoveryInvite : copy.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
