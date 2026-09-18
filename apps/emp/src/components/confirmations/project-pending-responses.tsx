"use client";

import {
  DataGridColumnHeader,
  ProjectWingMasterDataGrid,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FolderKanban, Undo2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "@/api/client";
import type { ConfirmationResponseLibraryFile } from "@/api/client";
import { BlobFilePreviewPane } from "@/components/file-preview-pane";
import { useToast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { confirmationResponseRoutingCopy } from "@/i18n/confirmation-response-routing-copy";

import {
  ConfirmationResponseRoutingSheet,
  typeLabel,
} from "./confirmation-response-routing-sheet";

export function ProjectPendingResponses({
  projectId,
  locale,
  onNoSourceRequest,
  onConfirmationRouted,
  title,
}: {
  projectId: string;
  locale: string;
  onNoSourceRequest?: (response: ConfirmationResponseLibraryFile) => void;
  onConfirmationRouted?: (
    response: ConfirmationResponseLibraryFile,
    action: "MATCH_CONFIRMATION" | "PENDING_MATCH" | "NO_SOURCE_REQUEST"
  ) => void | Promise<void>;
  title?: string;
}) {
  const zh = locale.startsWith("zh");
  const text = confirmationResponseRoutingCopy[zh ? "zh-CN" : "en-US"];
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] =
    useState<ConfirmationResponseLibraryFile | null>(null);
  const [routing, setRouting] =
    useState<ConfirmationResponseLibraryFile | null>(null);
  const files = useQuery({
    queryKey: ["project-pending-confirmation-responses", projectId],
    queryFn: () => api.projectPendingConfirmationResponses(projectId),
  });
  const visibleSelected =
    selected &&
    (!files.data || files.data.some((file) => file.id === selected.id))
      ? selected
      : null;
  const returnToCenter = useMutation({
    mutationFn: (responseId: string) =>
      api.routeConfirmationResponseLibraryFile(responseId, {
        action: "UNASSIGN_PROJECT",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project-pending-confirmation-responses", projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-confirmation-response-warehouse", projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["confirmation-response-library"],
        }),
      ]);
      toast({ title: text.updateSuccess });
    },
    onError: () => toast({ title: text.updateError, variant: "destructive" }),
  });

  const columns = useMemo<
    ProjectWingMasterDataGridProps<ConfirmationResponseLibraryFile>["columns"]
  >(
    () => [
      {
        id: "response",
        accessorFn: (file) => file.title,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={text.response} />
        ),
        cell: ({ row }) => (
          <div className="min-w-52 py-1">
            <div className="font-medium">{row.original.title}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.code} ·{" "}
              {row.original.referenceNumber || row.original.fileName}
            </div>
          </div>
        ),
        minSize: 240,
        size: 320,
      },
      {
        id: "respondingEntity",
        accessorFn: (file) => file.respondingEntity,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={text.respondingEntity} />
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
        ),
        minSize: 180,
        size: 240,
      },
      {
        id: "category",
        accessorFn: (file) =>
          file.provisionalType
            ? typeLabel(file.provisionalType, zh)
            : text.unclassified,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={text.category} />
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">{String(getValue() ?? "")}</span>
        ),
        size: 180,
      },
      {
        id: "status",
        accessorFn: (file) =>
          file.routingStatus === "NO_SOURCE_REQUEST"
            ? text.noSourceRequest
            : text.pending,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={text.status} />
        ),
        cell: ({ getValue }) => (
          <Badge variant="outline">{String(getValue() ?? "")}</Badge>
        ),
        size: 160,
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => {
          const file = row.original;
          return (
            <div
              role="presentation"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <ButtonGroup>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={text.preview}
                  onClick={() => setSelected(file)}
                >
                  <Eye />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/25 bg-primary/5 text-primary shadow-none hover:bg-primary/10 hover:text-primary"
                  aria-label={text.continueMatching}
                  onClick={() => setRouting(file)}
                >
                  <FolderKanban />
                  <span className="hidden xl:inline">
                    {text.continueMatching}
                  </span>
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={text.returnToConfirmationCenter}
                  disabled={returnToCenter.isPending}
                  title={text.returnToConfirmationCenter}
                  onClick={() => returnToCenter.mutate(file.id)}
                >
                  <Undo2 />
                </Button>
              </ButtonGroup>
            </div>
          );
        },
        enableSorting: false,
        minSize: 150,
        size: 190,
      },
    ],
    [returnToCenter, text, zh]
  );

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <header className="shrink-0 border-b border-border/60 px-4 py-3">
        <h2 className="font-medium">{title ?? text.projectQueueTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {text.projectQueueDescription}
        </p>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden">
          <ProjectWingMasterDataGrid
            columns={columns}
            data={files.data ?? []}
            emptyMessage={files.isLoading ? "" : text.noPendingResponses}
            getRowId={(file) => file.id}
            onRowClick={setSelected}
            rowClassName={(file) =>
              visibleSelected?.id === file.id
                ? "bg-primary/5"
                : "cursor-pointer"
            }
            showRowSelection={false}
            tableLabel={text.response}
            testId="pending-confirmation-responses-data-grid"
            title={text.response}
          />
        </div>
        {visibleSelected ? (
          <aside className="w-[42%] min-w-96 border-l border-border/60 bg-muted/20">
            <BlobFilePreviewPane
              ariaLabel={`${text.preview}: ${visibleSelected.title}`}
              fileName={visibleSelected.fileName}
              mimeType={visibleSelected.mimeType}
              queryKey={[
                "confirmation-response-library",
                "preview",
                visibleSelected.id,
                visibleSelected.updatedAt,
              ]}
              loadFile={() =>
                api.previewConfirmationResponseLibraryFile(visibleSelected.id)
              }
              copy={{
                loading: text.loadingPreview,
                failedTitle: text.previewFailed,
                retry: text.retry,
                unsupported: text.unsupported,
              }}
              toolbarActions={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={text.closePreview}
                  onClick={() => setSelected(null)}
                >
                  <X />
                </Button>
              }
            />
          </aside>
        ) : null}
      </div>
      <ConfirmationResponseRoutingSheet
        response={routing}
        open={Boolean(routing)}
        onOpenChange={(open) => {
          if (!open) {
            setRouting(null);
          }
        }}
        locale={locale}
        initialProjectId={projectId}
        allowNoSourceRequest
        onRouted={async (_response, action) => {
          if (
            (action === "MATCH_CONFIRMATION" ||
              action === "NO_SOURCE_REQUEST") &&
            _response.confirmationId
          ) {
            await onConfirmationRouted?.(_response, action);
            const url = new URL(window.location.href);
            url.searchParams.set("workspace", "confirmations");
            url.searchParams.set("confirmationId", _response.confirmationId);
            window.history.pushState(window.history.state, "", url);
            window.dispatchEvent(new PopStateEvent("popstate"));
            return;
          }
          if (action === "NO_SOURCE_REQUEST") onNoSourceRequest?.(_response);
        }}
      />
    </section>
  );
}
