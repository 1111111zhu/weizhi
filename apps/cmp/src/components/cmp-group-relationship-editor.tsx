"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export type CmpGroupRelationshipEditorParticipant = {
  entityId: string;
  method: "OWNERSHIP" | "OTHER";
  ownershipPercentage: string;
  otherDescription: string;
};

export type CmpGroupRelationshipEditorOption = {
  id: string;
  label: string;
};

export type CmpGroupRelationshipEditorCopy = {
  relationshipType: string;
  associate: string;
  jointVenture: string;
  targetCompany: string;
  participants: string;
  participant: string;
  addParticipant: string;
  ownership: string;
  other: string;
  ownershipPlaceholder: string;
  otherPlaceholder: string;
  removeParticipant: string;
};

export function CmpGroupRelationshipEditor({
  type,
  targetEntityId,
  participants,
  options,
  copy,
  onTypeChange,
  onTargetChange,
  onParticipantsChange,
}: {
  type: "ASSOCIATE" | "JOINT_VENTURE";
  targetEntityId: string;
  participants: CmpGroupRelationshipEditorParticipant[];
  options: CmpGroupRelationshipEditorOption[];
  copy: CmpGroupRelationshipEditorCopy;
  onTypeChange: (type: "ASSOCIATE" | "JOINT_VENTURE") => void;
  onTargetChange: (entityId: string) => void;
  onParticipantsChange: (
    participants: CmpGroupRelationshipEditorParticipant[]
  ) => void;
}) {
  const updateParticipant = (
    index: number,
    patch: Partial<CmpGroupRelationshipEditorParticipant>
  ) =>
    onParticipantsChange(
      participants.map((participant, participantIndex) =>
        participantIndex === index ? { ...participant, ...patch } : participant
      )
    );

  return (
    <>
      <EditorField label={copy.relationshipType}>
        <Select
          value={type}
          onValueChange={(value) =>
            value && onTypeChange(value as "ASSOCIATE" | "JOINT_VENTURE")
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ASSOCIATE">{copy.associate}</SelectItem>
            <SelectItem value="JOINT_VENTURE">{copy.jointVenture}</SelectItem>
          </SelectContent>
        </Select>
      </EditorField>
      <EditorField label={copy.targetCompany}>
        <EditorPartySelect
          value={targetEntityId}
          options={options}
          onChange={onTargetChange}
        />
      </EditorField>
      <div className="space-y-3 sm:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{copy.participants}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onParticipantsChange([
                ...participants,
                {
                  entityId: "",
                  method: "OWNERSHIP",
                  ownershipPercentage: "",
                  otherDescription: "",
                },
              ])
            }
          >
            <Plus />
            {copy.addParticipant}
          </Button>
        </div>
        {participants.map((participant, index) => (
          <div
            key={`${participant.entityId || "new"}-${index}`}
            className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
          >
            <EditorPartySelect
              value={participant.entityId}
              options={options}
              ariaLabel={copy.participant}
              onChange={(entityId) => updateParticipant(index, { entityId })}
            />
            <Select
              value={participant.method}
              onValueChange={(method) =>
                updateParticipant(index, {
                  method: method as "OWNERSHIP" | "OTHER",
                  ownershipPercentage:
                    method === "OTHER" ? "" : participant.ownershipPercentage,
                  otherDescription:
                    method === "OTHER" ? participant.otherDescription : "",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNERSHIP">{copy.ownership}</SelectItem>
                <SelectItem value="OTHER">{copy.other}</SelectItem>
              </SelectContent>
            </Select>
            {participant.method === "OWNERSHIP" ? (
              <Input
                type="number"
                min="0"
                max="100"
                placeholder={copy.ownershipPlaceholder}
                value={participant.ownershipPercentage}
                onChange={(event) =>
                  updateParticipant(index, {
                    ownershipPercentage: event.target.value,
                  })
                }
              />
            ) : (
              <Input
                placeholder={copy.otherPlaceholder}
                value={participant.otherDescription}
                onChange={(event) =>
                  updateParticipant(index, {
                    otherDescription: event.target.value,
                  })
                }
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={participants.length === 1}
              aria-label={copy.removeParticipant}
              onClick={() =>
                onParticipantsChange(
                  participants.filter(
                    (_, participantIndex) => participantIndex !== index
                  )
                )
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}

function EditorPartySelect({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: CmpGroupRelationshipEditorOption[];
  ariaLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(next) => next && onChange(next)}
    >
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EditorField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
