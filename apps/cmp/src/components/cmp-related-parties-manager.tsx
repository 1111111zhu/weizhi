"use client";

import {
  CMP_HSIC_SECTION_OPTIONS,
  inferCmpOwnership,
} from "@project-wing/shared";
import type {
  CmpCompanyIdentityMatch,
  CmpCompanyIdentityResolution,
  CmpEntityRelationship,
  CmpEntityRelationshipType,
  CmpGroupRelationshipsResponse,
  CmpRelatedEntitiesResponse,
  CmpRelatedEntity,
  CreateCmpRelatedEntityInput,
} from "@project-wing/shared/cmp-entity-graph";
import { useCompactViewport } from "@project-wing/ui";
import { Building2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { api } from "@/api/client";
import { GroupRelationshipsManager } from "@/components/cmp-group-relationships-manager";
import { useCmpToast } from "@/components/cmp-toast";
import { CompanyIdentityConflictDialog } from "@/components/company-identity-conflict-dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import mobileStyles from "./cmp-mobile.module.css";

type EditablePartyKind = "COMPANY" | "PERSON";
type RelationshipCategory = "ownership" | "management" | "other";

const relationshipTypesByCategory = {
  ownership: ["OWNS"],
  management: [
    "DIRECTOR_OF",
    "BENEFICIAL_OWNER_OF",
    "MANAGES",
    "COMPANY_SECRETARY_OF",
  ],
  other: ["OTHER"],
} as const satisfies Record<RelationshipCategory, CmpEntityRelationshipType[]>;

export function RelatedPartiesManager({
  clientId,
  entities,
  zh,
  onChanged,
}: {
  clientId: string;
  entities?: CmpRelatedEntitiesResponse;
  zh: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<{
    kind: EditablePartyKind;
    entity?: CmpRelatedEntity;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useCmpToast();

  async function remove(entityId: string) {
    if (pendingDelete !== entityId) {
      setPendingDelete(entityId);
      return;
    }
    setBusy(true);
    try {
      await api.removeCmpRelatedEntity(clientId, entityId);
      setPendingDelete("");
      await onChanged();
    } catch {
      toast({
        title: zh ? "解除失败" : "Unable to unlink party",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cmp-related-parties h-full overflow-auto p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {zh ? "相关主体" : "Related Parties"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {zh
                ? "维护当前客户引用的事务所主体主数据。"
                : "Maintain firm-level party master data referenced by this client."}
            </p>
          </div>
          <ButtonGroup>
            <Button
              type="button"
              onClick={() => setEditing({ kind: "COMPANY" })}
            >
              <Building2 /> {zh ? "新建相关公司" : "New related company"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing({ kind: "PERSON" })}
            >
              <UserRound /> {zh ? "新建相关个人" : "New related person"}
            </Button>
          </ButtonGroup>
        </div>
        <CompanyTable
          entities={
            entities?.entities.filter((entity) => entity.kind === "COMPANY") ??
            []
          }
          zh={zh}
          busy={busy}
          pendingDelete={pendingDelete}
          onEdit={(entity) => setEditing({ kind: "COMPANY", entity })}
          onRemove={remove}
        />
        <PersonTable
          entities={
            entities?.entities.filter((entity) => entity.kind === "PERSON") ??
            []
          }
          zh={zh}
          busy={busy}
          pendingDelete={pendingDelete}
          onEdit={(entity) => setEditing({ kind: "PERSON", entity })}
          onRemove={remove}
        />
        {(entities?.entities ?? []).some(
          (entity) => !["COMPANY", "PERSON"].includes(entity.kind)
        ) ? (
          <LegacyPartyTable
            entities={(entities?.entities ?? []).filter(
              (entity) => !["COMPANY", "PERSON"].includes(entity.kind)
            )}
            zh={zh}
          />
        ) : null}
      </div>
      <EntityDialog
        key={`${editing?.kind ?? "closed"}-${editing?.entity?.id ?? "new"}`}
        clientId={clientId}
        kind={editing?.kind ?? "COMPANY"}
        entity={editing?.entity}
        open={Boolean(editing)}
        zh={zh}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        onChanged={onChanged}
      />
    </div>
  );
}

function CompanyTable({
  entities,
  zh,
  busy,
  pendingDelete,
  onEdit,
  onRemove,
}: PartyTableProps) {
  return (
    <PartyTableShell
      title={zh ? "相关公司" : "Related companies"}
      empty={zh ? "暂无相关公司。" : "No related companies yet."}
      headers={
        zh
          ? [
              "注册编号",
              "公司名称",
              "注册成立地",
              "成立日期",
              "公司类型",
              "行业分类",
              "操作",
            ]
          : [
              "Registration",
              "Company name",
              "Jurisdiction",
              "Incorporated",
              "Company type",
              "Industry",
              "Actions",
            ]
      }
    >
      {entities.map((entity) => (
        <div
          key={entity.id}
          className="grid grid-cols-7 items-center gap-3 border-t px-5 py-4 text-sm"
        >
          <span>
            {entity.companyProfile?.identifierValue ??
              entity.registrationNumber ??
              "—"}
          </span>
          <span className="font-medium">
            {entity.nameEn ?? entity.displayName}
          </span>
          <span>{entity.jurisdiction || "—"}</span>
          <span>{entity.companyProfile?.incorporationDate ?? "—"}</span>
          <span>
            {entity.companyProfile
              ? companyTypeLabel(entity.companyProfile.companyType, zh)
              : "—"}
          </span>
          <span>{entity.companyProfile?.industryClassification || "—"}</span>
          <PartyActions
            entity={entity}
            zh={zh}
            busy={busy}
            pendingDelete={pendingDelete}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        </div>
      ))}
    </PartyTableShell>
  );
}

function PersonTable(props: PartyTableProps) {
  const { entities, zh, busy, pendingDelete, onEdit, onRemove } = props;
  return (
    <PartyTableShell
      title={zh ? "相关个人" : "Related individuals"}
      empty={zh ? "暂无相关个人。" : "No related individuals yet."}
      headers={
        zh
          ? ["姓名", "英文姓名", "国籍", "出生日期", "证件信息", "状态", "操作"]
          : [
              "Name",
              "English name",
              "Nationality",
              "Date of birth",
              "Identifier",
              "Status",
              "Actions",
            ]
      }
    >
      {entities.map((entity) => (
        <div
          key={entity.id}
          className="grid grid-cols-7 items-center gap-3 border-t px-5 py-4 text-sm"
        >
          <span className="font-medium">
            {entity.nameZh || entity.displayName}
          </span>
          <span>{entity.nameEn || "—"}</span>
          <span>{entity.personProfile?.nationality || "—"}</span>
          <span>{entity.personProfile?.dateOfBirth || "—"}</span>
          <span>
            {[
              entity.personProfile?.identifierType,
              entity.personProfile?.identifierValue,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </span>
          <span>{entityStatusLabel(entity.status, zh)}</span>
          <PartyActions
            entity={entity}
            zh={zh}
            busy={busy}
            pendingDelete={pendingDelete}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        </div>
      ))}
    </PartyTableShell>
  );
}

type PartyTableProps = {
  entities: CmpRelatedEntity[];
  zh: boolean;
  busy: boolean;
  pendingDelete: string;
  onEdit: (entity: CmpRelatedEntity) => void;
  onRemove: (entityId: string) => Promise<void>;
};

function PartyTableShell({
  title,
  headers,
  empty,
  children,
}: {
  title: string;
  headers: string[];
  empty: string;
  children: ReactElement<{ children: ReactNode[] }>[];
}) {
  const phone = useCompactViewport(767.98);
  const rows = children.length;
  if (phone) {
    return (
      <section>
        <h3>{title}</h3>
        {rows ? (
          children.map((row) => (
            <dl
              className={`${mobileStyles.metrics} ${mobileStyles.record}`}
              key={row.key}
            >
              {row.props.children.map((cell, column) => (
                <div key={column}>
                  <dt>{headers[column]}</dt>
                  <dd>{cell}</dd>
                </div>
              ))}
            </dl>
          ))
        ) : (
          <p className={mobileStyles.muted}>{empty}</p>
        )}
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="cmp-party-table overflow-x-auto rounded-2xl border bg-card">
        <div className="grid min-w-[64rem] grid-cols-7 gap-3 bg-muted/60 px-5 py-3 text-sm font-medium text-muted-foreground">
          {headers.map((header) => (
            <span key={header}>{header}</span>
          ))}
        </div>
        <div className="min-w-[64rem]">
          {rows ? (
            children
          ) : (
            <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
              {empty}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PartyActions({
  entity,
  zh,
  busy,
  pendingDelete,
  onEdit,
  onRemove,
}: Omit<PartyTableProps, "entities"> & { entity: CmpRelatedEntity }) {
  if (entity.role === "ROOT") {
    return (
      <span className="text-xs font-medium text-primary">
        {zh ? "客户主体" : "Client"}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={zh ? "编辑主体" : "Edit party"}
        onClick={() => onEdit(entity)}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        variant={pendingDelete === entity.id ? "destructive" : "ghost"}
        size="icon-sm"
        disabled={busy}
        aria-label={
          pendingDelete === entity.id
            ? zh
              ? "确认解除"
              : "Confirm unlink"
            : zh
              ? "解除主体"
              : "Unlink party"
        }
        onClick={() => {
          onRemove(entity.id);
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function LegacyPartyTable({
  entities,
  zh,
}: {
  entities: CmpRelatedEntity[];
  zh: boolean;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-dashed p-4">
      <h3 className="text-sm font-semibold">
        {zh ? "其他历史主体" : "Other legacy parties"}
      </h3>
      {entities.map((entity) => (
        <div key={entity.id} className="flex justify-between text-sm">
          <span>{entity.displayName}</span>
          <span className="text-muted-foreground">
            {entityKindLabel(entity.kind, zh)}
          </span>
        </div>
      ))}
    </section>
  );
}

export function PartyRelationshipsManager({
  clientId,
  entities,
  relationships,
  groupRelationships,
  zh,
  onChanged,
}: {
  clientId: string;
  entities?: CmpRelatedEntitiesResponse;
  relationships?: { relationships: CmpEntityRelationship[] };
  groupRelationships?: CmpGroupRelationshipsResponse;
  zh: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<{
    category: RelationshipCategory;
    relationship?: CmpEntityRelationship;
  } | null>(null);
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
      await api.removeCmpEntityRelationship(clientId, relationshipId);
      setPendingDelete("");
      await onChanged();
    } catch {
      toast({
        title: zh ? "删除失败" : "Unable to delete relationship",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="cmp-related-parties h-full overflow-auto p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {zh ? "主体关系" : "Party Relationships"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {zh
                ? "仅记录两个主体之间的直接关系。"
                : "Record direct relationships between two parties only."}
            </p>
          </div>
        </div>
        {(["ownership", "management"] as const).map((category) => (
          <RelationshipSection
            key={category}
            category={category}
            relationships={(relationships?.relationships ?? []).filter(
              (relationship) =>
                relationshipTypesByCategory[category].some(
                  (type) => type === relationship.type
                )
            )}
            names={names}
            zh={zh}
            canAdd={(entities?.entities.length ?? 0) >= 2}
            pendingDelete={pendingDelete}
            onAdd={() => setEditing({ category })}
            onEdit={(relationship) => setEditing({ category, relationship })}
            onRemove={remove}
          />
        ))}
        <BeneficialOwnersSection
          entities={entities}
          relationships={relationships?.relationships ?? []}
          zh={zh}
        />
        <GroupRelationshipsManager
          clientId={clientId}
          entities={entities}
          relationships={groupRelationships}
          zh={zh}
          onChanged={onChanged}
        />
        <RelationshipSection
          category="other"
          relationships={(relationships?.relationships ?? []).filter(
            (relationship) =>
              relationshipTypesByCategory.other.some(
                (type) => type === relationship.type
              )
          )}
          names={names}
          zh={zh}
          canAdd={(entities?.entities.length ?? 0) >= 2}
          pendingDelete={pendingDelete}
          onAdd={() => setEditing({ category: "other" })}
          onEdit={(relationship) =>
            setEditing({ category: "other", relationship })
          }
          onRemove={remove}
        />
      </div>
      <RelationshipDialog
        key={`${editing?.category ?? "closed"}-${editing?.relationship?.id ?? "new"}`}
        clientId={clientId}
        entityOptions={entities?.entities ?? []}
        category={editing?.category ?? "ownership"}
        relationship={editing?.relationship}
        open={Boolean(editing)}
        zh={zh}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        onChanged={onChanged}
      />
    </div>
  );
}

function RelationshipSection({
  category,
  relationships,
  names,
  zh,
  canAdd,
  pendingDelete,
  onAdd,
  onEdit,
  onRemove,
}: {
  category: RelationshipCategory;
  relationships: CmpEntityRelationship[];
  names: Map<string, string>;
  zh: boolean;
  canAdd: boolean;
  pendingDelete: string;
  onAdd: () => void;
  onEdit: (relationship: CmpEntityRelationship) => void;
  onRemove: (relationshipId: string) => Promise<void>;
}) {
  const title =
    category === "ownership"
      ? zh
        ? "股权结构"
        : "Ownership structure"
      : category === "management"
        ? zh
          ? "董事及管理层"
          : "Directors and management"
        : zh
          ? "其他关联关系"
          : "Other related-party relationships";
  return (
    <section className="cmp-relationship-section space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button type="button" size="sm" disabled={!canAdd} onClick={onAdd}>
          <Plus />
          {category === "management"
            ? zh
              ? "新增人员关系"
              : "Add person role"
            : zh
              ? "新增关系"
              : "Add relationship"}
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-[1fr_0.8fr_1fr_0.65fr_5rem] gap-4 bg-muted/60 px-4 py-2 text-sm font-medium text-muted-foreground">
          <span>{zh ? "主体" : "From"}</span>
          <span>{zh ? "关系" : "Relationship"}</span>
          <span>
            {zh ? (category === "management" ? "公司" : "主体") : "To"}
          </span>
          <span>
            {category === "management"
              ? zh
                ? "任职日期"
                : "Effective date"
              : zh
                ? "比例"
                : "Percentage"}
          </span>
          <span>{zh ? "操作" : "Actions"}</span>
        </div>
        {relationships.length > 0 ? (
          relationships.map((relationship) => (
            <div
              key={relationship.id}
              className="cmp-relationship-record grid grid-cols-[1fr_0.8fr_1fr_0.65fr_5rem] items-center gap-4 border-t px-4 py-3 text-sm"
            >
              <span className="font-medium">
                {names.get(relationship.fromEntityId) ||
                  relationship.fromEntityId}
              </span>
              <span className="text-primary">
                {relationshipTypeLabel(relationship.type, zh)}
              </span>
              <span className="font-medium">
                {names.get(relationship.toEntityId) || relationship.toEntityId}
              </span>
              <span>
                {category === "management"
                  ? relationship.effectiveFrom?.slice(0, 10) || "—"
                  : relationship.ownershipPercentage === null
                    ? "—"
                    : `${relationship.ownershipPercentage}%`}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={zh ? "编辑关系" : "Edit relationship"}
                  onClick={() => onEdit(relationship)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant={
                    pendingDelete === relationship.id ? "destructive" : "ghost"
                  }
                  size="icon-sm"
                  aria-label={
                    pendingDelete === relationship.id
                      ? zh
                        ? "确认删除"
                        : "Confirm delete"
                      : zh
                        ? "删除关系"
                        : "Delete relationship"
                  }
                  onClick={() => {
                    onRemove(relationship.id);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            {zh ? "暂无记录。" : "No records yet."}
          </div>
        )}
      </div>
    </section>
  );
}

function BeneficialOwnersSection({
  entities,
  relationships,
  zh,
}: {
  entities?: CmpRelatedEntitiesResponse;
  relationships: CmpEntityRelationship[];
  zh: boolean;
}) {
  const rootId = entities?.rootEntityId;
  const ownership = relationships.filter(
    (relationship) => relationship.type === "OWNS"
  );
  const names = new Map(
    (entities?.entities ?? []).map((entity) => [entity.id, entity.displayName])
  );
  const inference = rootId
    ? inferCmpOwnership({
        targetEntityId: rootId,
        entities: (entities?.entities ?? []).map((entity) => ({
          id: entity.id,
          kind: entity.kind,
        })),
        observations: ownership.map((relationship) => ({
          id: relationship.id,
          ownerId: relationship.fromEntityId,
          investeeId: relationship.toEntityId,
          percentage: relationship.ownershipPercentage,
          effectiveFrom: relationship.effectiveFrom,
          effectiveTo: relationship.effectiveTo,
        })),
      })
    : null;
  const recordedLegacy = relationships.filter(
    (relationship) => relationship.type === "BENEFICIAL_OWNER_OF"
  );
  return (
    <section className="cmp-relationship-section space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">
          {zh ? "最终受益人" : "Ultimate beneficial owners"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {zh
            ? "根据精确持股比例计算，仅显示可归属于已识别自然人的确认权益。"
            : "Calculated from exact ownership percentages; only confirmed ownership attributable to identified people is shown."}
        </p>
      </div>
      {inference?.candidates.length
        ? inference.candidates.map((candidate) => (
            <div key={candidate.personId} className="rounded-xl border p-4">
              <div className="font-medium">
                {names.get(candidate.personId) || candidate.personId}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {zh ? "穿透持股" : "Effective ownership"}:{" "}
                {candidate.ownershipPercentage}% ·{" "}
                {ownershipCandidateStatus(candidate.status, zh)}
              </p>
            </div>
          ))
        : null}
      {recordedLegacy.map((relationship) => (
        <div key={relationship.id} className="rounded-xl border p-4">
          <div className="font-medium">
            {names.get(relationship.fromEntityId) || relationship.fromEntityId}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {zh ? "历史记录" : "Legacy record"} ·{" "}
            {relationshipTypeLabel(relationship.type, zh)} →{" "}
            {names.get(relationship.toEntityId) || relationship.toEntityId}
          </p>
        </div>
      ))}
      {!inference?.candidates.length && recordedLegacy.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {zh
            ? "尚无法从现有关系推导最终受益人。"
            : "No beneficial owner can be derived from the current relationships."}
        </div>
      ) : null}
    </section>
  );
}

function ownershipCandidateStatus(
  status: "CONFIRMED" | "EXCLUDED",
  zh: boolean
) {
  return {
    CONFIRMED: zh ? "持股关系已确认" : "Confirmed by ownership",
    EXCLUDED: zh ? "低于阈值" : "Below threshold",
  }[status];
}

function EntityDialog({
  clientId,
  kind,
  entity,
  open,
  zh,
  onOpenChange,
  onChanged,
}: {
  clientId: string;
  kind: EditablePartyKind;
  entity?: CmpRelatedEntity;
  open: boolean;
  zh: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [nameEn, setNameEn] = useState(
    entity?.nameEn ?? (kind === "COMPANY" ? (entity?.displayName ?? "") : "")
  );
  const [nameZh, setNameZh] = useState(
    entity?.nameZh ?? (kind === "PERSON" ? (entity?.displayName ?? "") : "")
  );
  const [companyCode, setCompanyCode] = useState(entity?.companyCode ?? "");
  const [jurisdiction, setJurisdiction] = useState(entity?.jurisdiction ?? "");
  const [identifierType, setIdentifierType] = useState(
    entity?.companyProfile?.identifierType ??
      entity?.personProfile?.identifierType ??
      (kind === "COMPANY" ? "COMPANY_REGISTRATION_NUMBER" : "PASSPORT")
  );
  const [identifierValue, setIdentifierValue] = useState(
    entity?.companyProfile?.identifierValue ??
      entity?.personProfile?.identifierValue ??
      entity?.registrationNumber ??
      ""
  );
  const [incorporationDate, setIncorporationDate] = useState(
    entity?.companyProfile?.incorporationDate ?? ""
  );
  const [companyType, setCompanyType] = useState<
    "PRIVATE" | "LISTED" | "OTHER"
  >(entity?.companyProfile?.companyType ?? "PRIVATE");
  const [industry, setIndustry] = useState(
    entity?.companyProfile?.industryClassification ?? ""
  );
  const [registeredAddress, setRegisteredAddress] = useState(
    entity?.companyProfile?.registeredAddress ?? ""
  );
  const [principalAddress, setPrincipalAddress] = useState(
    entity?.companyProfile?.principalBusinessAddress ?? ""
  );
  const [dateOfBirth, setDateOfBirth] = useState(
    entity?.personProfile?.dateOfBirth ?? ""
  );
  const [nationality, setNationality] = useState(
    entity?.personProfile?.nationality ?? ""
  );
  const [residenceJurisdiction, setResidenceJurisdiction] = useState(
    entity?.personProfile?.residenceJurisdiction ?? ""
  );
  const [correspondenceAddress, setCorrespondenceAddress] = useState(
    entity?.personProfile?.correspondenceAddress ?? ""
  );
  const [status, setStatus] = useState<CmpRelatedEntity["status"]>(
    entity?.status ?? "ACTIVE"
  );
  const [busy, setBusy] = useState(false);
  const { toast } = useCmpToast();
  const [identityConflict, setIdentityConflict] = useState<{
    match: CmpCompanyIdentityMatch;
    input: CreateCmpRelatedEntityInput;
  } | null>(null);

  async function persist(
    input: CreateCmpRelatedEntityInput,
    resolution?: CmpCompanyIdentityResolution
  ) {
    await (entity
      ? api.updateCmpRelatedEntity(clientId, entity.id, input)
      : api.createCmpRelatedEntity(clientId, {
          ...input,
          companyIdentityResolution: resolution,
        }));
    await onChanged();
    onOpenChange(false);
  }

  async function submit() {
    const companyValid =
      kind !== "COMPANY" ||
      (nameEn.trim() &&
        jurisdiction.trim() &&
        identifierValue.trim() &&
        incorporationDate &&
        registeredAddress.trim());
    const personValid = kind !== "PERSON" || nameEn.trim();
    if (!companyValid || !personValid) {
      return;
    }
    setBusy(true);
    try {
      const input: CreateCmpRelatedEntityInput = {
        displayName:
          kind === "PERSON" ? nameZh.trim() || nameEn.trim() : nameEn.trim(),
        kind,
        nameEn: nameEn.trim() || null,
        nameZh: nameZh.trim() || null,
        companyCode: kind === "COMPANY" ? companyCode.trim() || null : null,
        jurisdiction: kind === "COMPANY" ? jurisdiction.trim() : null,
        registrationNumber: kind === "COMPANY" ? identifierValue.trim() : null,
        status,
        companyProfile:
          kind === "COMPANY"
            ? {
                identifierType,
                identifierValue: identifierValue.trim(),
                incorporationDate,
                companyType,
                industryClassification: industry.trim() || null,
                registeredAddress: registeredAddress.trim(),
                principalBusinessAddress: principalAddress.trim() || null,
              }
            : null,
        personProfile:
          kind === "PERSON"
            ? {
                dateOfBirth: dateOfBirth || null,
                identifierType: identifierValue.trim() ? identifierType : null,
                identifierValue: identifierValue.trim() || null,
                nationality: nationality.trim() || null,
                residenceJurisdiction: residenceJurisdiction.trim() || null,
                correspondenceAddress: correspondenceAddress.trim() || null,
              }
            : null,
      };
      if (!entity && kind === "COMPANY") {
        const { match } = await api.cmpCompanyIdentityMatch(
          identifierType,
          identifierValue.trim()
        );
        if (match) {
          setIdentityConflict({ match, input });
          return;
        }
      }
      await persist(input);
    } catch {
      toast({
        title: zh ? "保存失败" : "Unable to save party",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="cmp-entity-dialog max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {entity
                ? zh
                  ? kind === "COMPANY"
                    ? "编辑相关公司"
                    : "编辑相关个人"
                  : kind === "COMPANY"
                    ? "Edit related company"
                    : "Edit related person"
                : zh
                  ? kind === "COMPANY"
                    ? "新建相关公司"
                    : "新建相关个人"
                  : kind === "COMPANY"
                    ? "New related company"
                    : "New related person"}
            </DialogTitle>
          </DialogHeader>
          <div className="cmp-entity-dialog-body">
            <DialogFormSection
              title={
                zh
                  ? kind === "COMPANY"
                    ? "基本信息"
                    : "身份信息"
                  : kind === "COMPANY"
                    ? "Basic information"
                    : "Identity information"
              }
            >
              {kind === "PERSON" ? (
                <Field label={zh ? "中文姓名" : "Chinese name"}>
                  <Input
                    value={nameZh}
                    onChange={(event) => setNameZh(event.target.value)}
                  />
                </Field>
              ) : null}
              <Field label={`${zh ? "英文名称" : "English name"} *`}>
                <Input
                  value={nameEn}
                  onChange={(event) => setNameEn(event.target.value)}
                />
              </Field>
              {kind === "COMPANY" ? (
                <>
                  <Field label={zh ? "公司代码" : "Company code"}>
                    <Input
                      value={companyCode}
                      onChange={(event) => setCompanyCode(event.target.value)}
                    />
                  </Field>
                  <Field label={`${zh ? "注册成立地" : "Jurisdiction"} *`}>
                    <Input
                      value={jurisdiction}
                      onChange={(event) => setJurisdiction(event.target.value)}
                    />
                  </Field>
                  <Field label={`${zh ? "成立日期" : "Incorporation date"} *`}>
                    <Input
                      type="date"
                      value={incorporationDate}
                      onChange={(event) =>
                        setIncorporationDate(event.target.value)
                      }
                    />
                  </Field>
                  <Field label={`${zh ? "公司类型" : "Company type"} *`}>
                    <Select
                      value={companyType}
                      onValueChange={(value) => value && setCompanyType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {companyTypeLabel(companyType, zh)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRIVATE">
                          {companyTypeLabel("PRIVATE", zh)}
                        </SelectItem>
                        <SelectItem value="LISTED">
                          {companyTypeLabel("LISTED", zh)}
                        </SelectItem>
                        <SelectItem value="OTHER">
                          {companyTypeLabel("OTHER", zh)}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              ) : (
                <Field label={zh ? "出生日期" : "Date of birth"}>
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                  />
                </Field>
              )}
            </DialogFormSection>

            <DialogFormSection
              title={
                zh
                  ? kind === "COMPANY"
                    ? "注册编号"
                    : "身份证明"
                  : kind === "COMPANY"
                    ? "Registration identifier"
                    : "Identification"
              }
            >
              <Field label={zh ? "证件类型" : "Identifier type"}>
                <Select
                  value={identifierType}
                  onValueChange={(value) => value && setIdentifierType(value)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {identifierTypeLabel(identifierType, kind, zh)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {identifierTypes(kind).map((value) => (
                      <SelectItem key={value} value={value}>
                        {identifierTypeLabel(value, kind, zh)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={`${zh ? (kind === "COMPANY" ? "注册编号" : "证件号码") : "Identifier value"}${kind === "COMPANY" ? " *" : ""}`}
              >
                <Input
                  value={identifierValue}
                  onChange={(event) => setIdentifierValue(event.target.value)}
                />
              </Field>
            </DialogFormSection>

            {kind === "COMPANY" ? (
              <>
                <DialogFormSection
                  title={zh ? "地址信息" : "Address information"}
                >
                  <Field
                    label={`${zh ? "公司注册地址" : "Registered address"} *`}
                    className="sm:col-span-2"
                  >
                    <Textarea
                      value={registeredAddress}
                      onChange={(event) =>
                        setRegisteredAddress(event.target.value)
                      }
                    />
                  </Field>
                  <Field
                    label={zh ? "主要经营地址" : "Principal business address"}
                    className="sm:col-span-2"
                  >
                    <Textarea
                      value={principalAddress}
                      onChange={(event) =>
                        setPrincipalAddress(event.target.value)
                      }
                    />
                  </Field>
                </DialogFormSection>
                <DialogFormSection
                  title={zh ? "业务信息" : "Business information"}
                >
                  <Field label={zh ? "行业分类" : "Industry classification"}>
                    <Select
                      value={industry || "_NONE"}
                      onValueChange={(value) =>
                        value && setIndustry(value === "_NONE" ? "" : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {industry
                            ? `${industry} · ${CMP_HSIC_SECTION_OPTIONS.find((option) => option.code === industry)?.[zh ? "zh" : "en"] ?? industry}`
                            : zh
                              ? "未指定"
                              : "Not specified"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_NONE">
                          {zh ? "未指定" : "Not specified"}
                        </SelectItem>
                        {CMP_HSIC_SECTION_OPTIONS.map((option) => (
                          <SelectItem key={option.code} value={option.code}>
                            {option.code} · {option[zh ? "zh" : "en"]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <StatusField
                    kind={kind}
                    status={status}
                    zh={zh}
                    onChange={setStatus}
                  />
                </DialogFormSection>
              </>
            ) : (
              <DialogFormSection title={zh ? "基础属性" : "Basic attributes"}>
                <Field label={zh ? "国籍" : "Nationality"}>
                  <Input
                    value={nationality}
                    onChange={(event) => setNationality(event.target.value)}
                  />
                </Field>
                <Field
                  label={zh ? "居住国家/地区" : "Country/region of residence"}
                >
                  <Input
                    value={residenceJurisdiction}
                    onChange={(event) =>
                      setResidenceJurisdiction(event.target.value)
                    }
                  />
                </Field>
                <Field
                  label={zh ? "通讯地址" : "Correspondence address"}
                  className="sm:col-span-2"
                >
                  <Textarea
                    value={correspondenceAddress}
                    onChange={(event) =>
                      setCorrespondenceAddress(event.target.value)
                    }
                  />
                </Field>
                <StatusField
                  kind={kind}
                  status={status}
                  zh={zh}
                  onChange={setStatus}
                />
              </DialogFormSection>
            )}
          </div>
          <ButtonGroup className="cmp-dialog-sticky-actions ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {zh ? "取消" : "Cancel"}
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                (kind === "COMPANY"
                  ? !(
                      nameEn.trim() &&
                      jurisdiction.trim() &&
                      identifierValue.trim() &&
                      incorporationDate &&
                      registeredAddress.trim()
                    )
                  : !nameEn.trim())
              }
              onClick={() => {
                submit();
              }}
            >
              {zh ? "保存" : "Save"}
            </Button>
          </ButtonGroup>
        </DialogContent>
      </Dialog>
      {identityConflict ? (
        <CompanyIdentityConflictDialog
          open
          zh={zh}
          busy={busy}
          match={identityConflict.match}
          current={{
            displayName: identityConflict.input.displayName,
            nameEn: identityConflict.input.nameEn,
            nameZh: identityConflict.input.nameZh,
            identifierType,
            identifierValue,
            jurisdiction: identityConflict.input.jurisdiction,
            incorporationDate:
              identityConflict.input.companyProfile?.incorporationDate,
            companyType: identityConflict.input.companyProfile?.companyType,
            registeredAddress:
              identityConflict.input.companyProfile?.registeredAddress,
            principalBusinessAddress:
              identityConflict.input.companyProfile?.principalBusinessAddress,
          }}
          onCancel={() => setIdentityConflict(null)}
          onResolve={(resolution) => {
            const { input } = identityConflict;
            setIdentityConflict(null);
            setBusy(true);
            void persist(input, resolution)
              .catch(() =>
                toast({
                  title: zh ? "保存失败" : "Unable to save party",
                  variant: "destructive",
                })
              )
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </>
  );
}

function DialogFormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cmp-dialog-form-section">
      <h3>{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function StatusField({
  kind,
  status,
  zh,
  onChange,
}: {
  kind: EditablePartyKind;
  status: CmpRelatedEntity["status"];
  zh: boolean;
  onChange: (status: CmpRelatedEntity["status"]) => void;
}) {
  const options: CmpRelatedEntity["status"][] =
    kind === "COMPANY"
      ? ["ACTIVE", "INACTIVE", "DISSOLVED"]
      : ["ACTIVE", "INACTIVE", "DECEASED", "UNKNOWN"];
  return (
    <Field label={zh ? "状态" : "Status"}>
      <Select
        value={status}
        onValueChange={(value) => value && onChange(value)}
      >
        <SelectTrigger>
          <SelectValue>{entityStatusLabel(status, zh)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((value) => (
            <SelectItem key={value} value={value}>
              {entityStatusLabel(value, zh)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function identifierTypes(kind: EditablePartyKind) {
  return kind === "COMPANY"
    ? ["BUSINESS_REGISTRATION_NUMBER", "COMPANY_REGISTRATION_NUMBER", "OTHER"]
    : ["PASSPORT", "NATIONAL_ID", "OTHER"];
}

function identifierTypeLabel(
  value: string,
  kind: EditablePartyKind,
  zh: boolean
) {
  const labels: Record<string, string> =
    kind === "COMPANY"
      ? {
          BUSINESS_REGISTRATION_NUMBER: zh
            ? "商业登记号码"
            : "Business registration number",
          COMPANY_REGISTRATION_NUMBER: zh
            ? "公司注册编号"
            : "Company registration number",
          OTHER: zh ? "其他" : "Other",
        }
      : {
          PASSPORT: zh ? "护照" : "Passport",
          NATIONAL_ID: zh ? "身份证" : "National ID",
          OTHER: zh ? "其他" : "Other",
        };
  return labels[value] ?? value;
}

function RelationshipDialog({
  clientId,
  entityOptions,
  category,
  relationship,
  open,
  zh,
  onOpenChange,
  onChanged,
}: {
  clientId: string;
  entityOptions: CmpRelatedEntity[];
  category: RelationshipCategory;
  relationship?: CmpEntityRelationship;
  open: boolean;
  zh: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const fromOptions =
    category === "ownership"
      ? entityOptions.filter(
          (entity) => entity.kind === "COMPANY" || entity.kind === "PERSON"
        )
      : entityOptions.filter((entity) => entity.kind === "PERSON");
  const companyOptions = entityOptions.filter(
    (entity) => entity.kind === "COMPANY"
  );
  const [fromEntityId, setFromEntityId] = useState(
    relationship?.fromEntityId ??
      (category === "ownership"
        ? fromOptions.find((entity) => entity.kind === "PERSON")?.id
        : undefined) ??
      fromOptions[0]?.id ??
      ""
  );
  const [toEntityId, setToEntityId] = useState(
    relationship?.toEntityId ??
      companyOptions.find((entity) => entity.id !== fromEntityId)?.id ??
      ""
  );
  const [type, setType] = useState<CmpEntityRelationshipType>(
    relationship?.type ?? relationshipTypesByCategory[category][0]
  );
  const [percentage, setPercentage] = useState(
    relationship?.ownershipPercentage?.toString() ?? ""
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    relationship?.effectiveFrom?.slice(0, 10) ?? ""
  );
  const [busy, setBusy] = useState(false);
  const { toast } = useCmpToast();

  async function submit() {
    if (!fromEntityId || !toEntityId || fromEntityId === toEntityId) {
      return;
    }
    setBusy(true);
    try {
      const shared = {
        type,
        ownershipPercentage:
          category === "ownership" && percentage !== ""
            ? Number(percentage)
            : null,
        effectiveFrom: category === "management" ? effectiveFrom || null : null,
        sourceDocument: relationship?.sourceDocument ?? null,
      };
      await (relationship
        ? api.updateCmpEntityRelationship(clientId, relationship.id, shared)
        : api.createCmpEntityRelationship(clientId, {
            ...shared,
            fromEntityId,
            toEntityId,
          }));
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {relationship
              ? zh
                ? "编辑关系"
                : "Edit relationship"
              : zh
                ? "新增关系"
                : "Add relationship"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field
            label={
              category === "management"
                ? zh
                  ? "人员"
                  : "Person"
                : zh
                  ? "主体"
                  : "From party"
            }
          >
            <PartySelect
              value={fromEntityId}
              options={fromOptions}
              disabled={Boolean(relationship)}
              onChange={setFromEntityId}
            />
          </Field>
          <Field
            label={
              category === "management"
                ? zh
                  ? "公司"
                  : "Company"
                : zh
                  ? "主体"
                  : "To party"
            }
          >
            <PartySelect
              value={toEntityId}
              options={companyOptions}
              disabled={Boolean(relationship)}
              onChange={setToEntityId}
            />
          </Field>
          <Field label={zh ? "关系类型" : "Relationship type"}>
            <Select
              value={type}
              onValueChange={(value) => value && setType(value)}
            >
              <SelectTrigger>
                <SelectValue>{relationshipTypeLabel(type, zh)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {relationshipTypesByCategory[category].map((value) => (
                  <SelectItem key={value} value={value}>
                    {relationshipTypeLabel(value, zh)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {category === "ownership" ? (
            <Field label={zh ? "持股比例（%）" : "Ownership percentage (%)"}>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
              />
            </Field>
          ) : null}
          {category === "management" ? (
            <Field label={zh ? "任职日期" : "Effective date"}>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </Field>
          ) : null}
        </div>
        {fromEntityId === toEntityId ? (
          <p className="text-sm text-destructive">
            {zh
              ? "两个端点不能是同一主体。"
              : "The two endpoints must be different parties."}
          </p>
        ) : null}
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
            disabled={
              busy ||
              !fromEntityId ||
              !toEntityId ||
              fromEntityId === toEntityId
            }
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

function PartySelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: CmpRelatedEntity[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || null}
      disabled={disabled}
      onValueChange={(next) => next && onChange(next)}
    >
      <SelectTrigger>
        <SelectValue>
          {options.find((entity) => entity.id === value)?.displayName ?? ""}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((entity) => (
          <SelectItem key={entity.id} value={entity.id}>
            {entity.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`grid gap-1.5 text-sm font-medium ${className ?? ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function entityKindLabel(kind: CmpRelatedEntity["kind"], zh: boolean) {
  const labels = {
    COMPANY: zh ? "公司" : "Company",
    PERSON: zh ? "个人" : "Individual",
    TRUST: zh ? "信托" : "Trust",
    PARTNERSHIP: zh ? "合伙" : "Partnership",
    OTHER_ORGANISATION: zh ? "其他组织" : "Other organisation",
  };
  return labels[kind];
}

function entityStatusLabel(status: CmpRelatedEntity["status"], zh: boolean) {
  const labels = {
    ACTIVE: zh ? "有效" : "Active",
    INACTIVE: zh ? "停用" : "Inactive",
    DISSOLVED: zh ? "已解散" : "Dissolved",
    DECEASED: zh ? "已故" : "Deceased",
    UNKNOWN: zh ? "未知" : "Unknown",
  };
  return labels[status];
}

function companyTypeLabel(type: "PRIVATE" | "LISTED" | "OTHER", zh: boolean) {
  const labels = {
    PRIVATE: zh ? "私人公司" : "Private company",
    LISTED: zh ? "上市公司" : "Listed company",
    OTHER: zh ? "其他" : "Other",
  };
  return labels[type];
}

function relationshipTypeLabel(type: CmpEntityRelationshipType, zh: boolean) {
  const labels = {
    OWNS: zh ? "持有" : "Owns",
    DIRECTOR_OF: zh ? "担任董事" : "Director of",
    BENEFICIAL_OWNER_OF: zh ? "最终实益拥有人" : "Beneficial owner of",
    COMPANY_SECRETARY_OF: zh ? "担任公司秘书" : "Company secretary of",
    MANAGES: zh ? "管理" : "Manages",
    OTHER: zh ? "其他" : "Other",
  };
  return labels[type];
}
