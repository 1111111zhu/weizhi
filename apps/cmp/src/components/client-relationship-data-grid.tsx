"use client";

import type { CmpEntityRelationshipDraft } from "@project-wing/shared";
import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import type { CmpDictionary } from "@/i18n/client";

import {
  relationshipRoleLabels,
  relationshipTypeLabel,
} from "./client-relationship-semantics";
import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

type WorkspaceCopy = CmpDictionary["workspace"];
type RelationshipColumn =
  ProjectWingMasterDataGridProps<CmpEntityRelationshipDraft>["columns"][number];

export function ClientRelationshipDataGrid({
  relationships,
  copy,
  entityName,
  relationshipRefKey,
  onAdd,
  onEdit,
  onRemove,
}: {
  relationships: CmpEntityRelationshipDraft[];
  copy: WorkspaceCopy;
  entityName: (key: string) => string;
  relationshipRefKey: (ref: CmpEntityRelationshipDraft["fromRef"]) => string;
  onAdd: () => void;
  onEdit: (relationship: CmpEntityRelationshipDraft) => void;
  onRemove: (draftKey: string) => void;
}) {
  const callbacksRef = useRef({ entityName, onEdit, onRemove });
  useEffect(() => {
    callbacksRef.current = { entityName, onEdit, onRemove };
  }, [entityName, onEdit, onRemove]);
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const columns = useMemo<RelationshipColumn[]>(() => {
    const header = (title: string) =>
      function RelationshipColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<
          CmpEntityRelationshipDraft,
          unknown
        >["column"];
      }) {
        return (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={title}
          />
        );
      };
    const partyCell = (
      relationship: CmpEntityRelationshipDraft,
      side: "from" | "to"
    ) => {
      const roles = relationshipRoleLabels(relationship.type, copy);
      const ref = side === "from" ? relationship.fromRef : relationship.toRef;
      return (
        <div className="min-w-0">
          <span className="block text-xs text-muted-foreground">
            {roles[side === "from" ? 0 : 1]}
          </span>
          <strong className="block truncate font-medium text-foreground">
            {callbacksRef.current.entityName(relationshipRefKey(ref))}
          </strong>
        </div>
      );
    };
    return [
      {
        id: "fromParty",
        accessorFn: (relationship) =>
          callbacksRef.current.entityName(
            relationshipRefKey(relationship.fromRef)
          ),
        header: header(copy.clientFormRelatedParty),
        cell: ({ row }) => partyCell(row.original, "from"),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.clientFormRelatedParty },
        size: 220,
      },
      {
        id: "type",
        accessorFn: (relationship) =>
          relationshipTypeLabel(relationship.type, copy),
        header: header(copy.clientFormRelationshipType),
        cell: ({ row }) => (
          <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {relationshipTypeLabel(row.original.type, copy)}
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.clientFormRelationshipType,
        },
        size: 160,
      },
      {
        id: "toParty",
        accessorFn: (relationship) =>
          callbacksRef.current.entityName(
            relationshipRefKey(relationship.toRef)
          ),
        header: header(copy.clientFormRelatedEntity),
        cell: ({ row }) => partyCell(row.original, "to"),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.clientFormRelatedEntity },
        size: 220,
      },
      {
        id: "ownershipPercentage",
        accessorFn: (relationship) => relationship.ownershipPercentage ?? null,
        header: header(copy.clientFormOwnershipPercentage),
        cell: ({ row }) => (
          <span className="text-foreground tabular-nums">
            {row.original.ownershipPercentage === null
              ? copy.clientFormNotProvided
              : `${row.original.ownershipPercentage}%`}
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.clientFormOwnershipPercentage,
        },
        size: 150,
      },
      {
        id: "actions",
        header: copy.action,
        cell: ({ row }) => (
          <ButtonGroup>
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              accessibleName={copy.clientFormEditRelationship}
              onClick={() => callbacksRef.current.onEdit(row.original)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              accessibleName={copy.clientFormRemoveRelationship}
              onClick={() =>
                callbacksRef.current.onRemove(row.original.draftKey)
              }
            >
              <Trash2 />
            </Button>
          </ButtonGroup>
        ),
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: { headerTitle: copy.action },
        size: 86,
      },
    ];
  }, [copy, menuCopy, relationshipRefKey]);
  const title = copy.clientFormPartyRelationships;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{title}</h4>
          <span className="text-xs text-muted-foreground">
            {relationships.length}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus />
          {copy.clientFormNewRelationship}
        </Button>
      </div>
      <CmpMasterDataGrid
        mobile={{
          titleColumn: "fromParty",
          summaryColumns: ["type", "toParty", "ownershipPercentage"],
        }}
        columns={columns}
        data={relationships}
        emptyMessage={copy.clientFormRelationshipsEmpty}
        getRowId={(relationship) => relationship.draftKey}
        initialSorting={[]}
        showRecordCount={false}
        showRowSelection={false}
        showToolbar={false}
        tableLabel={title}
        tableLayout={{ headerSticky: false, columnsVisibility: false }}
        testId="cmp-client-relationship-data-grid"
        title={title}
      />
    </section>
  );
}
