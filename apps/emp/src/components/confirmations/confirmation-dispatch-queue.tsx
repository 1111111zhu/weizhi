"use client";

import type { ConfirmationDispatchMethod } from "@project-wing/shared";
import {
  DataGridColumnHeader,
  ProjectWingLoadingProgress,
  ProjectWingMasterDataGrid,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Mail,
  Printer,
  Send,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AccessibleName } from "@/components/ui/accessible-name";

import type { ConfirmationDispatchQueueItem } from "../../api/client";
import type { Dictionary } from "../../i18n/dictionaries";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";

type Copy = Dictionary["confirmationCenter"]["dispatchQueue"];
export type ConfirmationDispatchQueueStage =
  | "AWAITING_CLAIM"
  | "PENDING_DISPATCH"
  | "SENT";

function queueColumn(
  column: ColumnDef<ConfirmationDispatchQueueItem>
): ColumnDef<ConfirmationDispatchQueueItem> {
  return column;
}

function formatQueueTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dispatchMethodLabel(
  copy: Copy,
  method: ConfirmationDispatchMethod | null | undefined
) {
  return method ? copy.methods[method] : "-";
}

function dispatchExecutionStatusLabel(copy: Copy, status: string) {
  return (
    copy.executionStatuses[status as keyof typeof copy.executionStatuses] ??
    copy.executionStatuses.QUEUED
  );
}

export function ConfirmationDispatchQueue({
  copy,
  items,
  currentUserId,
  isLoading,
  isProcessing,
  stage,
  onClaim,
  onStageChange,
  onDispatch,
  onCompleteMockDelivery,
  onPrint,
  onSelect,
  selectedConfirmationId,
  onReturn,
  closeLabel,
}: {
  copy: Copy;
  items: ConfirmationDispatchQueueItem[];
  currentUserId?: string;
  isLoading: boolean;
  isProcessing: boolean;
  stage: ConfirmationDispatchQueueStage;
  onClaim: (item: ConfirmationDispatchQueueItem) => void;
  onStageChange: (stage: ConfirmationDispatchQueueStage) => void;
  onDispatch: (
    item: ConfirmationDispatchQueueItem,
    mode: "EMAIL" | "ORDER" | "PICKUP"
  ) => void;
  onCompleteMockDelivery: (item: ConfirmationDispatchQueueItem) => void;
  onPrint: (item: ConfirmationDispatchQueueItem) => void;
  onSelect: (item: ConfirmationDispatchQueueItem) => void;
  selectedConfirmationId?: string | null;
  onReturn: (item: ConfirmationDispatchQueueItem, reason: string) => void;
  closeLabel: string;
}) {
  const [returnTarget, setReturnTarget] =
    useState<ConfirmationDispatchQueueItem | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const columns = useMemo<
    ProjectWingMasterDataGridProps<ConfirmationDispatchQueueItem>["columns"]
  >(() => {
    const confirmationColumn = queueColumn({
      id: "confirmation",
      accessorFn: (item) => item.counterpartyName,
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={copy.columns.confirmation}
        />
      ),
      cell: ({ row }) => (
        <div className="min-w-44 py-1">
          <p className="font-medium">{row.original.counterpartyName}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.confirmationCode ?? "-"}
          </p>
        </div>
      ),
      meta: { headerTitle: copy.columns.confirmation },
      minSize: 190,
      size: 260,
    });
    const projectColumn = queueColumn({
      id: "project",
      accessorFn: (item) => item.project.name,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={copy.columns.project} />
      ),
      cell: ({ row }) => (
        <div className="py-1">
          <p className="font-medium">{row.original.project.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.project.projectCode}
          </p>
        </div>
      ),
      meta: { headerTitle: copy.columns.project },
      minSize: 190,
      size: 250,
    });
    const methodColumn = queueColumn({
      id: "method",
      accessorFn: (item) =>
        dispatchMethodLabel(
          copy,
          item.latestDispatch?.method ?? item.preparedDispatchMethod
        ),
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={copy.columns.method} />
      ),
      cell: ({ row }) => (
        <div className="py-1">
          <Badge variant="outline">
            {dispatchMethodLabel(
              copy,
              row.original.latestDispatch?.method ??
                row.original.preparedDispatchMethod
            )}
          </Badge>
          {row.original.latestDispatch?.trackingNumber ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {copy.trackingNumber}:{" "}
              {row.original.latestDispatch.trackingNumber}
            </p>
          ) : null}
        </div>
      ),
      meta: { headerTitle: copy.columns.method },
      minSize: 160,
      size: 210,
    });
    const updatedColumn = queueColumn({
      id: "updatedAt",
      accessorFn: (item) =>
        item.latestDispatch?.deliveredAt ??
        item.latestDispatch?.sentAt ??
        item.updatedAt,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={copy.columns.updatedAt} />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatQueueTime(String(getValue() ?? ""))}
        </span>
      ),
      meta: { headerTitle: copy.columns.updatedAt },
      minSize: 170,
      size: 210,
    });
    const actionColumn = queueColumn({
      id: "actions",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={stage === "SENT" ? copy.columns.status : copy.columns.action}
        />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const ownClaim = item.claim?.userId === currentUserId;
        return (
          <div
            role="presentation"
            className="flex min-h-8 justify-end"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {stage === "AWAITING_CLAIM" ? (
              <Button
                disabled={isProcessing}
                onClick={() => onClaim(item)}
                size="sm"
                variant="outline"
              >
                <ClipboardCheck />
                {copy.claim}
              </Button>
            ) : null}
            {stage === "PENDING_DISPATCH" && ownClaim ? (
              <ButtonGroup>
                <Button
                  disabled={isProcessing}
                  onClick={() => onPrint(item)}
                  size="sm"
                  variant="outline"
                >
                  <Printer />
                  {copy.actions.print}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button disabled={isProcessing} size="sm">
                        <Send />
                        {copy.actions.send}
                        <ChevronDown />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onDispatch(item, "EMAIL")}>
                      <Mail />
                      {copy.actions.email}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDispatch(item, "ORDER")}>
                      <Truck />
                      {copy.actions.courier}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDispatch(item, "PICKUP")}
                    >
                      <CalendarClock />
                      {copy.actions.pickup}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  disabled={isProcessing}
                  onClick={() => setReturnTarget(item)}
                  size="sm"
                  variant="outline"
                >
                  {copy.return}
                </Button>
              </ButtonGroup>
            ) : null}
            {stage === "SENT" && item.latestDispatch ? (
              <div className="flex items-center justify-end gap-2">
                <Badge variant="outline">
                  {item.latestDispatch.providerName === "MOCK_COURIER"
                    ? item.latestDispatch.executionStatus === "DELIVERED"
                      ? copy.mockDelivered
                      : copy.mockInTransit
                    : dispatchExecutionStatusLabel(
                        copy,
                        item.latestDispatch.executionStatus
                      )}
                </Badge>
                {item.latestDispatch.providerName === "MOCK_COURIER" &&
                item.latestDispatch.executionStatus === "SENT" ? (
                  <Button
                    disabled={isProcessing}
                    onClick={() => onCompleteMockDelivery(item)}
                    size="sm"
                    variant="outline"
                  >
                    <Truck />
                    {copy.actions.mockDeliver}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      },
      enableSorting: false,
      meta: {
        headerTitle:
          stage === "SENT" ? copy.columns.status : copy.columns.action,
        headerClassName: "justify-end text-right",
        cellClassName: "text-right",
      },
      minSize: 210,
      size: stage === "PENDING_DISPATCH" ? 430 : 260,
    });

    return [
      confirmationColumn,
      projectColumn,
      ...(stage === "SENT" ? [methodColumn] : []),
      updatedColumn,
      actionColumn,
    ];
  }, [
    copy,
    currentUserId,
    isProcessing,
    onClaim,
    onCompleteMockDelivery,
    onDispatch,
    onPrint,
    stage,
  ]);
  const stageTabs = (
    <Tabs
      value={stage}
      onValueChange={(value) =>
        onStageChange(value as ConfirmationDispatchQueueStage)
      }
    >
      <TabsList variant="line" className="h-8 flex-nowrap justify-start">
        <TabsTrigger value="AWAITING_CLAIM">
          {copy.tabs.awaitingClaim}
        </TabsTrigger>
        <TabsTrigger value="PENDING_DISPATCH">
          {copy.tabs.pendingDispatch}
        </TabsTrigger>
        <TabsTrigger value="SENT">{copy.tabs.sent}</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <AccessibleName label={copy.title}>
      <section className="min-h-80">
        <ProjectWingMasterDataGrid
          actions={stageTabs}
          columns={columns}
          content={
            isLoading ? (
              <div
                className="grid min-h-64 place-items-center"
                aria-busy="true"
              >
                <ProjectWingLoadingProgress />
              </div>
            ) : undefined
          }
          data={items}
          emptyMessage={copy.emptyByStage[stage]}
          getRowId={(item) => item.confirmationId}
          onRowClick={onSelect}
          rowClassName={(item) =>
            selectedConfirmationId === item.confirmationId
              ? "bg-primary/5"
              : "cursor-pointer"
          }
          showRowSelection={false}
          tableLabel={copy.title}
          testId="confirmation-dispatch-data-grid"
          toolbarTestId="confirmation-dispatch-toolbar"
          title={copy.title}
        />

        <Dialog
          open={Boolean(returnTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setReturnTarget(null);
              setReturnReason("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{copy.returnTitle}</DialogTitle>
              <DialogDescription>{copy.returnDescription}</DialogDescription>
            </DialogHeader>
            <Textarea
              label={copy.returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder={copy.returnReasonPlaceholder}
              value={returnReason}
            />
            <DialogFooter>
              <Button
                onClick={() => {
                  setReturnTarget(null);
                  setReturnReason("");
                }}
                variant="outline"
              >
                {closeLabel}
              </Button>
              <Button
                disabled={!returnTarget || !returnReason.trim() || isProcessing}
                onClick={() => {
                  if (!returnTarget) {
                    return;
                  }
                  onReturn(returnTarget, returnReason.trim());
                  setReturnTarget(null);
                  setReturnReason("");
                }}
              >
                {copy.return}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </AccessibleName>
  );
}
