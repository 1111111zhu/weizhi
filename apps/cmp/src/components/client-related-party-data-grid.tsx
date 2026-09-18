"use client";

import type { CmpRelatedEntityDraft } from "@project-wing/shared";
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
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

type WorkspaceCopy = CmpDictionary["workspace"];
type RelatedPartyColumn =
  ProjectWingMasterDataGridProps<CmpRelatedEntityDraft>["columns"][number];

export function ClientRelatedPartyDataGrid({
  kind,
  entities,
  copy,
  companyTypeLabel,
  onAdd,
  onEdit,
  onRemove,
}: {
  kind: "COMPANY" | "PERSON";
  entities: CmpRelatedEntityDraft[];
  copy: WorkspaceCopy;
  companyTypeLabel: (value: string | null | undefined) => string;
  onAdd: () => void;
  onEdit: (entity: CmpRelatedEntityDraft) => void;
  onRemove: (draftKey: string) => void;
}) {
  const callbacksRef = useRef({ onEdit, onRemove });
  useEffect(() => {
    callbacksRef.current = { onEdit, onRemove };
  }, [onEdit, onRemove]);
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const columns = useMemo<RelatedPartyColumn[]>(() => {
    const header = (title: string) =>
      function RelatedPartyColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<
          CmpRelatedEntityDraft,
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
    const textColumn = (
      id: string,
      title: string,
      value: (entity: CmpRelatedEntityDraft) => string,
      size: number,
      emphasized = false
    ): RelatedPartyColumn => ({
      id,
      accessorFn: value,
      header: header(title),
      cell: ({ row }) => (
        <span
          className={`block truncate ${
            emphasized ? "font-medium text-foreground" : "text-muted-foreground"
          }`}
        >
          {value(row.original) || copy.clientFormNotProvided}
        </span>
      ),
      enableHiding: true,
      enableResizing: true,
      enableSorting: true,
      filterFn: cmpSelectedValuesFilter,
      meta: { autoSize: true, headerTitle: title },
      size,
    });
    const partyColumns =
      kind === "COMPANY"
        ? [
            textColumn(
              "registrationNumber",
              copy.clientFormRegistrationNumber,
              (entity) =>
                entity.companyProfile?.identifierValue ||
                entity.registrationNumber ||
                "",
              180
            ),
            textColumn(
              "companyName",
              copy.clientFormRelatedCompanyName,
              (entity) => entity.nameZh || entity.nameEn || entity.displayName,
              250,
              true
            ),
            textColumn(
              "jurisdiction",
              copy.clientFormJurisdiction,
              (entity) => entity.jurisdiction || "",
              170
            ),
            textColumn(
              "incorporated",
              copy.clientFormIncorporated,
              (entity) => entity.companyProfile?.incorporationDate || "",
              150
            ),
            textColumn(
              "companyType",
              copy.clientFormRelatedCompanyType,
              (entity) => companyTypeLabel(entity.companyProfile?.companyType),
              160
            ),
          ]
        : [
            textColumn(
              "individualName",
              copy.clientFormIndividualName,
              (entity) => entity.nameZh || entity.displayName,
              220,
              true
            ),
            textColumn(
              "englishName",
              copy.clientFormEnglishName,
              (entity) => entity.nameEn || "",
              220
            ),
            textColumn(
              "nationality",
              copy.clientFormNationality,
              (entity) => entity.personProfile?.nationality || "",
              150
            ),
            textColumn(
              "dateOfBirth",
              copy.clientFormDateOfBirth,
              (entity) => entity.personProfile?.dateOfBirth || "",
              150
            ),
            textColumn(
              "identifier",
              copy.clientFormIdentifier,
              (entity) => entity.personProfile?.identifierValue || "",
              190
            ),
          ];
    return [
      ...partyColumns,
      {
        id: "actions",
        header: copy.action,
        cell: ({ row }) => (
          <ButtonGroup>
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              accessibleName={copy.clientFormEditParty}
              onClick={() => callbacksRef.current.onEdit(row.original)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              accessibleName={copy.clientFormRemoveParty}
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
  }, [companyTypeLabel, copy, kind, menuCopy]);
  const title =
    kind === "COMPANY"
      ? copy.clientFormRelatedCompanies
      : copy.clientFormRelatedIndividuals;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{title}</h4>
          <span className="text-xs text-muted-foreground">
            {entities.length}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus />
          {kind === "COMPANY"
            ? copy.clientFormNewRelatedCompany
            : copy.clientFormNewRelatedIndividual}
        </Button>
      </div>
      <CmpMasterDataGrid
        mobile={{
          titleColumn: kind === "COMPANY" ? "companyName" : "individualName",
          summaryColumns:
            kind === "COMPANY"
              ? ["registrationNumber", "jurisdiction"]
              : ["englishName", "nationality"],
        }}
        columns={columns}
        data={entities}
        emptyMessage={
          kind === "COMPANY"
            ? copy.clientFormRelatedCompaniesEmpty
            : copy.clientFormRelatedIndividualsEmpty
        }
        getRowId={(entity) => entity.draftKey}
        initialSorting={[]}
        showRecordCount={false}
        showRowSelection={false}
        showToolbar={false}
        tableLabel={title}
        tableLayout={{ headerSticky: false, columnsVisibility: false }}
        testId={`cmp-client-related-${kind.toLowerCase()}-data-grid`}
        title={title}
      />
    </section>
  );
}
