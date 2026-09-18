"use client";

import type {
  CmpGroupRelationship,
  CmpGroupRelationshipsResponse,
  CmpRelatedEntitiesResponse,
  CmpRelatedEntity,
  CreateCmpGroupRelationshipInput,
} from "@project-wing/shared/cmp-entity-graph";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "@/api/client";
import { CmpGroupRelationshipEditor } from "@/components/cmp-group-relationship-editor";
import type { CmpGroupRelationshipEditorParticipant } from "@/components/cmp-group-relationship-editor";
import { useCmpToast } from "@/components/cmp-toast";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function GroupRelationshipsManager({
  clientId,
  entities,
  relationships,
  zh,
  onChanged,
}: {
  clientId: string;
  entities?: CmpRelatedEntitiesResponse;
  relationships?: CmpGroupRelationshipsResponse;
  zh: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<CmpGroupRelationship>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState("");
  const { toast } = useCmpToast();
  const names = useMemo(
    () =>
      new Map(
        entities?.entities.map((entity) => [entity.id, entity.displayName])
      ),
    [entities]
  );

  async function remove(relationshipId: string) {
    if (pendingDelete !== relationshipId) {
      setPendingDelete(relationshipId);
      return;
    }
    try {
      await api.removeCmpGroupRelationship(clientId, relationshipId);
      setPendingDelete("");
      await onChanged();
    } catch {
      toast({
        title: zh ? "删除失败" : "Unable to delete relationship",
        variant: "destructive",
      });
    }
  }

  const summary = (relationship: CmpGroupRelationship) =>
    relationship.participants
      .map((participant) => {
        const name = names.get(participant.entityId) ?? participant.entityId;
        if (participant.method === "OTHER") {
          return `${name}: ${participant.otherDescription ?? (zh ? "其他" : "Other")}`;
        }
        return participant.ownershipPercentage === null
          ? `${name}: ${zh ? "持有" : "Ownership"}`
          : `${name}: ${participant.ownershipPercentage}%`;
      })
      .join(" · ");

  return (
    <section className="cmp-relationship-section space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            {zh ? "联营及合营关系" : "Associate & joint venture relationships"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {zh
              ? "每条关系包含一个目标企业及一个或多个公司参与方。"
              : "Each relationship has one target company and one or more company participants."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={
            (entities?.entities.filter((entity) => entity.kind === "COMPANY")
              .length ?? 0) < 2
          }
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus />
          {zh ? "新增联营／合营关系" : "Add associate / joint venture"}
        </Button>
      </div>
      <div className="cmp-group-relationship-table overflow-x-auto rounded-xl border">
        <div className="grid min-w-[720px] grid-cols-[0.85fr_1fr_2fr_5rem] gap-4 bg-muted/60 px-4 py-2 text-sm font-medium text-muted-foreground">
          <span>{zh ? "类型" : "Type"}</span>
          <span>{zh ? "目标企业" : "Target company"}</span>
          <span>{zh ? "参与方及方式" : "Participants and methods"}</span>
          <span>{zh ? "操作" : "Actions"}</span>
        </div>
        {relationships?.relationships.length ? (
          relationships.relationships.map((relationship) => (
            <div
              key={relationship.id}
              className="grid min-w-[720px] grid-cols-[0.85fr_1fr_2fr_5rem] items-center gap-4 border-t px-4 py-3 text-sm"
            >
              <span className="font-medium text-primary">
                {groupTypeLabel(relationship.type, zh)}
              </span>
              <span className="font-medium">
                {names.get(relationship.targetEntityId) ??
                  relationship.targetEntityId}
              </span>
              <span
                className="truncate text-muted-foreground"
                title={summary(relationship)}
              >
                {summary(relationship)}
              </span>
              <ButtonGroup>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={zh ? "编辑关系" : "Edit relationship"}
                  onClick={() => {
                    setEditing(relationship);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant={
                    pendingDelete === relationship.id ? "destructive" : "ghost"
                  }
                  size="icon-sm"
                  aria-label={zh ? "删除关系" : "Delete relationship"}
                  onClick={() => {
                    remove(relationship.id);
                  }}
                >
                  <Trash2 />
                </Button>
              </ButtonGroup>
            </div>
          ))
        ) : (
          <p className="min-w-[720px] px-4 py-8 text-center text-sm text-muted-foreground">
            {zh
              ? "尚未添加联营或合营关系。"
              : "No associate or joint venture relationships yet."}
          </p>
        )}
      </div>
      {pendingDelete ? (
        <p className="text-xs text-destructive">
          {zh ? "再次点击删除按钮以确认。" : "Click delete again to confirm."}
        </p>
      ) : null}
      {dialogOpen ? (
        <GroupRelationshipDialog
          key={editing?.id ?? "new"}
          clientId={clientId}
          entities={entities?.entities ?? []}
          relationship={editing}
          zh={zh}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialogOpen(false);
              setEditing(undefined);
            }
          }}
          onChanged={onChanged}
        />
      ) : null}
    </section>
  );
}

function GroupRelationshipDialog({
  clientId,
  entities,
  relationship,
  zh,
  open,
  onOpenChange,
  onChanged,
}: {
  clientId: string;
  entities: CmpRelatedEntity[];
  relationship?: CmpGroupRelationship;
  zh: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const companies = entities.filter((entity) => entity.kind === "COMPANY");
  const rootEntityId = entities.find((entity) => entity.role === "ROOT")?.id;
  const defaultTargetEntityId =
    companies.find((entity) => entity.id !== rootEntityId)?.id ??
    companies[0]?.id ??
    "";
  const defaultParticipantEntityId =
    rootEntityId ??
    companies.find((entity) => entity.id !== defaultTargetEntityId)?.id ??
    "";
  const [targetEntityId, setTargetEntityId] = useState(
    relationship?.targetEntityId ?? defaultTargetEntityId
  );
  const [type, setType] = useState<"ASSOCIATE" | "JOINT_VENTURE">(
    relationship?.type ?? "ASSOCIATE"
  );
  const [participants, setParticipants] = useState<
    CmpGroupRelationshipEditorParticipant[]
  >(
    relationship?.participants.map((participant) => ({
      entityId: participant.entityId,
      method: participant.method,
      ownershipPercentage:
        participant.ownershipPercentage === null
          ? ""
          : String(participant.ownershipPercentage),
      otherDescription: participant.otherDescription ?? "",
    })) ?? [
      {
        entityId: defaultParticipantEntityId,
        method: "OWNERSHIP",
        ownershipPercentage: "",
        otherDescription: "",
      },
    ]
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    relationship?.effectiveFrom?.slice(0, 10) ?? ""
  );
  const [remarks, setRemarks] = useState(relationship?.remarks ?? "");
  const [busy, setBusy] = useState(false);
  const { toast } = useCmpToast();
  const percentageValid = (value: string) =>
    value === "" ||
    (Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Number(value) <= 100);
  const participantIds = participants.map(
    (participant) => participant.entityId
  );
  const valid = Boolean(
    targetEntityId &&
    participants.length > 0 &&
    participantIds.every(Boolean) &&
    !participantIds.includes(targetEntityId) &&
    new Set(participantIds).size === participantIds.length &&
    participants.every(
      (participant) =>
        (participant.method === "OWNERSHIP" &&
          percentageValid(participant.ownershipPercentage)) ||
        (participant.method === "OTHER" && participant.otherDescription.trim())
    )
  );
  async function submit() {
    if (!valid) {
      return;
    }
    const input: CreateCmpGroupRelationshipInput = {
      targetEntityId,
      type,
      participants: participants.map((participant) => ({
        entityId: participant.entityId,
        method: participant.method,
        ownershipPercentage:
          participant.method === "OWNERSHIP" &&
          participant.ownershipPercentage !== ""
            ? Number(participant.ownershipPercentage)
            : null,
        otherDescription:
          participant.method === "OTHER"
            ? participant.otherDescription.trim()
            : null,
      })),
      effectiveFrom: effectiveFrom || null,
      remarks: remarks.trim() || null,
    };
    setBusy(true);
    try {
      await (relationship
        ? api.updateCmpGroupRelationship(clientId, relationship.id, input)
        : api.createCmpGroupRelationship(clientId, input));
      await onChanged();
      onOpenChange(false);
    } catch {
      toast({
        title: zh ? "保存失败" : "Unable to save relationship",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {relationship
              ? zh
                ? "编辑联营／合营关系"
                : "Edit associate / joint venture"
              : zh
                ? "新增联营／合营关系"
                : "Add associate / joint venture"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <CmpGroupRelationshipEditor
            type={type}
            targetEntityId={targetEntityId}
            participants={participants}
            options={companies.map((entity) => ({
              id: entity.id,
              label: entity.displayName,
            }))}
            copy={{
              relationshipType: zh ? "关系类型" : "Relationship type",
              associate: groupTypeLabel("ASSOCIATE", zh),
              jointVenture: groupTypeLabel("JOINT_VENTURE", zh),
              targetCompany: zh ? "目标企业" : "Target company",
              participants: zh ? "参与方" : "Participants",
              participant: zh ? "参与方" : "Participant",
              addParticipant: zh ? "添加参与方" : "Add participant",
              ownership: zh ? "持有" : "Ownership",
              other: zh ? "其他" : "Other",
              ownershipPlaceholder: zh
                ? "持股比例 %（可留空）"
                : "Ownership % (optional)",
              otherPlaceholder: zh
                ? "其他方式说明（必填）"
                : "Other method description (required)",
              removeParticipant: zh ? "删除参与方" : "Remove participant",
            }}
            onTypeChange={setType}
            onTargetChange={setTargetEntityId}
            onParticipantsChange={setParticipants}
          />
          <label className="grid gap-1.5 text-sm font-medium">
            <span>{zh ? "生效日期" : "Effective date"}</span>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            <span>{zh ? "备注" : "Notes"}</span>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </label>
          {valid ? null : (
            <p className="text-sm text-destructive sm:col-span-2">
              {zh
                ? "目标企业不可同时为参与方；参与方不可重复；“其他”必须填写说明。"
                : "The target cannot be a participant, participants must be unique, and every other method needs a description."}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {zh ? "取消" : "Cancel"}
          </Button>
          <Button
            type="button"
            disabled={busy || !valid}
            onClick={() => {
              submit();
            }}
          >
            {zh ? "保存" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function groupTypeLabel(type: CmpGroupRelationship["type"], zh: boolean) {
  if (type === "ASSOCIATE") {
    return zh ? "联营" : "Associate";
  }
  return zh ? "合营" : "Joint venture";
}
