"use client";

import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconButton } from "@project-wing/ui";
import * as React from "react";

import { DocumentTextSearchPopover } from "@/components/extend/document-text-search-popover";
import { PreviewLoadingState } from "@/components/extend/preview-loading-state";
import { ProjectFileTypeIcon } from "@/components/project-file-type-icon";
import { openArchivePreview } from "@/lib/archive-preview";
import type { ArchivePreviewEntry } from "@/lib/archive-preview";
import { showErrorToast } from "@/lib/error-toast";
import { cn } from "@/lib/utils";

import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type ArchiveViewerProps = {
  className?: string;
  fileName: string;
  source: Blob;
  toolbarActions?: React.ReactNode;
};

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatModifiedAt(value: number) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value / 1_000_000));
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

export function filterArchiveEntries(
  entries: ArchivePreviewEntry[],
  query: string
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return entries;
  }
  return entries.filter((entry) =>
    entry.path.toLocaleLowerCase().includes(normalizedQuery)
  );
}

function ArchiveEntryRow({
  entry,
  onDownload,
}: {
  entry: ArchivePreviewEntry;
  onDownload: (entry: ArchivePreviewEntry) => void;
}) {
  const folder = entry.path.slice(0, -entry.name.length).replace(/\/$/, "");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem_10rem_2.5rem] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-2">
        <ProjectFileTypeIcon fileName={entry.name} />
        <div className="min-w-0">
          <div className="truncate font-medium" title={entry.name}>
            {entry.name}
          </div>
          {folder ? (
            <div
              className="truncate text-xs text-muted-foreground"
              title={folder}
            >
              {folder}/
            </div>
          ) : null}
        </div>
      </div>
      <span className="text-muted-foreground">{formatBytes(entry.size)}</span>
      <span className="text-muted-foreground">
        {formatModifiedAt(entry.lastModified)}
      </span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <IconButton
              type="button"
              variant="quiet"
              size="xs"
              icon={<HugeiconsIcon icon={Download01Icon} />}
              label={`Download ${entry.name}`}
              onClick={() => onDownload(entry)}
            />
          </TooltipTrigger>
          <TooltipContent>Download entry</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function ArchiveViewer({
  className,
  fileName,
  source,
  toolbarActions,
}: ArchiveViewerProps) {
  const [entries, setEntries] = React.useState<ArchivePreviewEntry[]>([]);
  const [encrypted, setEncrypted] = React.useState<boolean | null>(null);
  const [search, setSearch] = React.useState("");
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const archiveRef = React.useRef<Awaited<
    ReturnType<typeof openArchivePreview>
  > | null>(null);

  React.useEffect(() => {
    let active = true;
    React.startTransition(() => {
      setLoading(true);
      setPreviewError(null);
    });
    void openArchivePreview(source, fileName)
      .then((archive) => {
        if (!active) {
          void archive.close();
          return;
        }
        archiveRef.current = archive;
        setEntries(archive.entries);
        setEncrypted(archive.encrypted);
      })
      .catch((error) => {
        if (active) {
          showErrorToast(error, "Unable to read archive");
          setPreviewError("Archive preview could not be loaded.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
      const archive = archiveRef.current;
      archiveRef.current = null;
      if (archive) {
        void archive.close();
      }
    };
  }, [fileName, source]);

  const filteredEntries = React.useMemo(
    () => filterArchiveEntries(entries, search),
    [entries, search]
  );

  async function handleDownload(entry: ArchivePreviewEntry) {
    const file = await archiveRef.current?.extract(entry.path);
    if (file) {
      downloadFile(file);
    }
  }

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col bg-background", className)}
    >
      <div className="flex min-h-12 flex-nowrap items-center gap-2 border-b bg-background px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ProjectFileTypeIcon fileName={fileName} />
          <span className="truncate text-sm font-medium" title={fileName}>
            {fileName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatBytes(source.size)}
          </span>
        </div>
        <div className="ml-auto flex min-w-0 flex-nowrap items-center justify-end gap-1">
          <DocumentTextSearchPopover<ArchivePreviewEntry>
            controlsDisabled={loading}
            label="Search archive"
            onClear={() => setSearch("")}
            onNavigate={() => {}}
            onSearch={(query) => {
              setSearch(query);
              return filterArchiveEntries(entries, query);
            }}
          />
          {toolbarActions ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              {toolbarActions}
            </>
          ) : null}
        </div>
      </div>
      {encrypted ? (
        <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          This archive contains encrypted entries. Password-protected entries
          can only be downloaded.
        </div>
      ) : null}
      {loading ? (
        <PreviewLoadingState className="min-h-0 flex-1" />
      ) : previewError ? null : (
        <ScrollArea className="min-h-0 flex-1">
          <div>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem_10rem_2.5rem] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Name</span>
              <span>Size</span>
              <span>Modified</span>
              <span />
            </div>
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry) => (
                <ArchiveEntryRow
                  key={entry.path}
                  entry={entry}
                  onDownload={handleDownload}
                />
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No archive entries match your search.
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
