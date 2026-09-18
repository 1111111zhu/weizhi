"use client";

import type { CmpClient } from "@project-wing/shared";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { MobileActionSheet } from "@project-wing/ui";
import {
  BriefcaseBusiness,
  Ellipsis,
  FileSearch,
  History,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import type { RefObject } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import type { CmpClientGridActions } from "./cmp-clients-data-grid-columns";
import {
  CmpMasterDraftActions,
  isCmpClientDraftRow,
} from "./cmp-master-drafts-section";

type CmpClientColumn =
  ProjectWingMasterDataGridProps<CmpClient>["columns"][number];

// Size for the largest supported root type scale (18px). The compact button
// Itself needs less room, but the English heading measures 68px including
// Cell padding; keep a small rounding allowance so it never paints outside
// The table and creates a horizontal scrollbar after a font-size change.
const COMPACT_ACTIONS_COLUMN_SIZE = 70;
const EDITABLE_ACTIONS_COLUMN_SIZE = 186;
const READ_ONLY_ACTIONS_COLUMN_SIZE = 100;

export function createCmpClientActionsColumn(
  actionsRef: RefObject<CmpClientGridActions>
): CmpClientColumn & { enableColumnOrdering?: boolean } {
  const { copy } = actionsRef.current;
  return {
    id: "actions",
    header: copy.actions,
    cell: ({ row }) => {
      const client = row.original;
      if (isCmpClientDraftRow(client)) {
        return (
          <CmpMasterDraftActions
            draft={client.__cmpDraft}
            returnTo={actionsRef.current.draftReturnTo}
            handleDeleteDraft={actionsRef.current.onDeleteDraft}
          />
        );
      }
      const versionHistoryHref = actionsRef.current.localizedPath(
        `/client/${encodeURIComponent(client.id)}/versions`
      );
      if (actionsRef.current.mobile) {
        return (
          <CmpClientMobileActions
            client={client}
            actions={actionsRef.current}
          />
        );
      }
      if (actionsRef.current.compact) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  className="text-secondary-foreground/80"
                  size="icon-sm"
                  variant="ghost"
                  accessibleName={copy.moreClientActions.replace(
                    "{clientCode}",
                    client.clientCode
                  )}
                >
                  <Ellipsis />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href={versionHistoryHref} />}>
                  <History />
                  {copy.versionHistory}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => actionsRef.current.onSearchMaterials(client)}
                >
                  <FileSearch />
                  {copy.searchMaterials}
                </DropdownMenuItem>
                {actionsRef.current.canEdit ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => actionsRef.current.onEngagements(client)}
                    >
                      <BriefcaseBusiness />
                      {copy.viewClientEngagements.replace(
                        "{clientCode}",
                        client.clientCode
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={
                        actionsRef.current.loadingEditClientId === client.id
                      }
                      onClick={() => actionsRef.current.onEdit(client)}
                    >
                      {actionsRef.current.loadingEditClientId === client.id ? (
                        <Skeleton className="size-4 rounded-full" />
                      ) : (
                        <Pencil />
                      )}
                      {copy.edit}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      return (
        <ButtonGroup className="-ms-2 text-secondary-foreground/80">
          <Button
            size="icon-sm"
            variant="ghost"
            accessibleName={`Version history for ${client.clientCode}`}
            nativeButton={false}
            render={<Link href={versionHistoryHref} />}
          >
            <History />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            accessibleName={`${copy.searchMaterials} ${client.clientCode}`}
            onClick={() => actionsRef.current.onSearchMaterials(client)}
          >
            <FileSearch />
          </Button>
          {actionsRef.current.canEdit ? (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                accessibleName={actionsRef.current.copy.viewClientEngagements.replace(
                  "{clientCode}",
                  client.clientCode
                )}
                onClick={() => actionsRef.current.onEngagements(client)}
              >
                <BriefcaseBusiness />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                accessibleName={`${copy.edit} ${copy.client.toLowerCase()}`}
                disabled={actionsRef.current.loadingEditClientId === client.id}
                onClick={() => actionsRef.current.onEdit(client)}
              >
                {actionsRef.current.loadingEditClientId === client.id ? (
                  <Skeleton className="size-4 rounded-full" />
                ) : (
                  <Pencil />
                )}
              </Button>
            </>
          ) : null}
        </ButtonGroup>
      );
    },
    enableColumnOrdering: false,
    enableHiding: false,
    enablePinning: false,
    enableResizing: false,
    enableSorting: false,
    meta: {
      cellClassName: "text-secondary-foreground/80",
      headerClassName: "text-secondary-foreground/80",
      headerTitle: copy.actions,
    },
    // Each icon button is 28px wide, the button group uses two 8px gaps,
    // And the cell contributes 24px of horizontal padding. Keep the column
    // Wide enough for all three editable-row actions so their intrinsic width
    // Does not create a small, always-visible horizontal overflow.
    size: actionsRef.current.compact
      ? COMPACT_ACTIONS_COLUMN_SIZE
      : actionsRef.current.canEdit
        ? EDITABLE_ACTIONS_COLUMN_SIZE
        : READ_ONLY_ACTIONS_COLUMN_SIZE,
  };
}

function CmpClientMobileActions({
  client,
  actions,
}: {
  client: CmpClient;
  actions: CmpClientGridActions;
}) {
  const [open, setOpen] = useState(false);
  const { copy } = actions;
  const run = (action: () => void) => {
    setOpen(false);
    action();
  };
  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={copy.moreClientActions.replace(
          "{clientCode}",
          client.clientCode
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Ellipsis />
      </Button>
      <MobileActionSheet
        open={open}
        onOpenChange={setOpen}
        title={client.nameEn || client.nameZh || client.clientCode}
        closeLabel={copy.close}
      >
        <Button
          variant="ghost"
          nativeButton={false}
          render={
            <Link
              href={actions.localizedPath(
                `/client/${encodeURIComponent(client.id)}/versions`
              )}
            />
          }
        >
          <History />
          {copy.versionHistory}
        </Button>
        <Button
          variant="ghost"
          onClick={() => run(() => actions.onSearchMaterials(client))}
        >
          <FileSearch />
          {copy.searchMaterials}
        </Button>
        {actions.canEdit ? (
          <>
            <Button
              variant="ghost"
              onClick={() => run(() => actions.onEngagements(client))}
            >
              <BriefcaseBusiness />
              {copy.viewClientEngagements.replace(
                "{clientCode}",
                client.clientCode
              )}
            </Button>
            <Button
              variant="ghost"
              disabled={actions.loadingEditClientId === client.id}
              onClick={() => run(() => actions.onEdit(client))}
            >
              <Pencil />
              {copy.edit}
            </Button>
          </>
        ) : null}
      </MobileActionSheet>
    </>
  );
}
