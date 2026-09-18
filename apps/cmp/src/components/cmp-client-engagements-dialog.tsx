"use client";

import type { CmpClient, CmpEngagement } from "@project-wing/shared";
import {
  Button,
  ButtonGroup,
  ProjectWingLoadingProgress,
  projectWingToast as toast,
} from "@project-wing/ui";
import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import { openCmpRecordPreviewWindow } from "../lib/open-cmp-record-preview-window";
import { CmpEngagementImportDialog } from "./cmp-engagement-import-dialog";
import { CmpEngagementSummaryTable } from "./cmp-engagement-summary-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

type LoadState =
  | { status: "idle" | "loading"; engagements: CmpEngagement[] }
  | { status: "success"; engagements: CmpEngagement[] }
  | { status: "error"; engagements: CmpEngagement[] };

export function CmpClientEngagementsDialog({
  client,
  onOpenChange,
}: {
  client: CmpClient | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { dictionary, localizedPath } = useCmpI18n();
  const copy = dictionary.workspace;
  const router = useRouter();
  const requestIdRef = useRef(0);
  const [retryKey, setRetryKey] = useState(0);
  const [loadedClientId, setLoadedClientId] = useState<string | null>(null);
  const clientId = client?.id;
  const [loadState, setLoadState] = useState<LoadState>({
    status: "idle",
    engagements: [],
  });
  const [selectedSourceEngagementId, setSelectedSourceEngagementId] = useState<
    string | null
  >(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  useEffect(() => {
    if (!clientId) {
      return;
    }
    const requestId = requestIdRef.current + 1 + retryKey;
    requestIdRef.current = requestId;
    void api
      .cmpEngagements({ clientId })
      .then((result) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setLoadState({ status: "success", engagements: result.engagements });
        setLoadedClientId(clientId);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        toast.error(copy.couldNotLoadClientEngagements, { duration: 5000 });
        setLoadState({
          status: "error",
          engagements: [],
        });
        setLoadedClientId(clientId);
      });
  }, [clientId, copy.couldNotLoadClientEngagements, retryKey]);

  const activeLoadState =
    loadedClientId === client?.id
      ? loadState
      : { status: "loading" as const, engagements: [] };

  const count = activeLoadState.engagements.length;
  const selectedSourceEngagement = activeLoadState.engagements.find(
    (engagement) => engagement.id === selectedSourceEngagementId
  );
  const createEngagementHref = localizedPath(
    `/engagement/new?clientId=${encodeURIComponent(client?.id ?? "")}${
      selectedSourceEngagement
        ? `&sourceEngagementId=${encodeURIComponent(selectedSourceEngagement.id)}`
        : ""
    }`
  );
  const openCreateEngagement = () => {
    if (selectedSourceEngagement) {
      setIsImportDialogOpen(true);
      return;
    }
    onOpenChange(false);
    router.push(createEngagementHref);
  };
  const confirmImport = (importSections: string) => {
    if (!client || !selectedSourceEngagement) {
      return;
    }
    setIsImportDialogOpen(false);
    onOpenChange(false);
    router.push(
      localizedPath(
        `/engagement/new?clientId=${encodeURIComponent(client.id)}&sourceEngagementId=${encodeURIComponent(selectedSourceEngagement.id)}&importSections=${encodeURIComponent(importSections)}`
      )
    );
  };
  const countLabel =
    count === 1
      ? copy.engagementCountOne
      : copy.engagementCountMany.replace("{count}", String(count));

  return (
    <Dialog open={Boolean(client)} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(980px,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none"
        closeLabel={copy.close}
      >
        {client ? (
          <>
            <DialogHeader className="border-b border-border px-5 py-4 pr-14">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                  <BriefcaseBusiness aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg leading-6">
                    {copy.clientEngagementsTitle.replace(
                      "{clientCode}",
                      client.clientCode
                    )}
                  </DialogTitle>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm text-muted-foreground">
                      {client.nameEn || client.nameZh}
                    </span>
                    {activeLoadState.status === "success" ? (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {countLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4">
              <div className="overflow-hidden rounded-lg border border-border">
                {activeLoadState.status === "loading" ||
                activeLoadState.status === "idle" ? (
                  <ProjectWingLoadingProgress />
                ) : activeLoadState.status === "error" ? (
                  <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-4 text-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRetryKey((value) => value + 1)}
                    >
                      {copy.retry}
                    </Button>
                  </div>
                ) : (
                  <CmpEngagementSummaryTable
                    engagements={activeLoadState.engagements}
                    emptyMessage={copy.noClientEngagements}
                    selectedSourceEngagementId={selectedSourceEngagementId}
                    onSelectSourceEngagement={(engagement) =>
                      setSelectedSourceEngagementId(engagement?.id ?? null)
                    }
                    onPreviewEngagement={(engagement) =>
                      openCmpRecordPreviewWindow(
                        localizedPath(
                          `/engagement/${encodeURIComponent(engagement.id)}`
                        )
                      )
                    }
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
              <span
                aria-live="polite"
                className="min-w-0 truncate text-sm text-muted-foreground"
              >
                {selectedSourceEngagement
                  ? copy.engagementSourceSelected.replace(
                      "{engagementCode}",
                      selectedSourceEngagement.engagementCode
                    )
                  : copy.engagementSourceOptional}
              </span>
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  {copy.close}
                </Button>
                <Button type="button" onClick={openCreateEngagement}>
                  {copy.createEngagement}
                </Button>
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={localizedPath(
                        `/engagements?view=client&clientId=${encodeURIComponent(client.id)}`
                      )}
                    />
                  }
                >
                  {copy.viewAllEngagements}
                </Button>
              </ButtonGroup>
            </div>
          </>
        ) : null}
      </DialogContent>
      <CmpEngagementImportDialog
        open={isImportDialogOpen}
        sourceEngagementCode={selectedSourceEngagement?.engagementCode ?? null}
        onConfirm={confirmImport}
        onOpenChange={setIsImportDialogOpen}
      />
    </Dialog>
  );
}
