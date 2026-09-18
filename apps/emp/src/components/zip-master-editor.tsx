"use client";

import { getFileTypeIconAsUrl } from "@fluentui/react-file-type-icons";
import {
  ProjectWingMasterDataGrid,
  ProjectWingMasterDataGridColumnHeader,
  projectWingSelectedValuesFilter,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import {
  Archive,
  Check,
  ChevronLeft,
  ClipboardPaste,
  Copy,
  Eye,
  File as FileIcon,
  FilePenLine,
  Folder,
  FolderPlus,
  MoveRight,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";

import { StatusBadge } from "@/components/status-badge";
import { AccessibleName } from "@/components/ui/accessible-name";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DynamicBox } from "@/components/ui/dynamic-layout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dictionary } from "@/i18n/dictionaries";
import { showErrorToast } from "@/lib/error-toast";
import { cn } from "@/lib/utils";

import type {
  ZipMasterEntry,
  ZipMasterSessionResponse,
  ZipMasterSessionState,
} from "../api/client";

export type ZipMasterEditorCopy = Dictionary["workbench"]["zipMaster"];

export const defaultZipMasterEditorCopy: ZipMasterEditorCopy = {
  archiveContents: "Archive contents",
  closeAndCheckIn: "Close and check in",
  createFolder: "Create folder",
  discard: "Discard",
  addFile: "Add file",
  replace: "Replace",
  replaceFile: "Replace file",
  moveEntry: "Move",
  copyEntry: "Copy",
  moveHere: "Move here",
  pasteHere: "Paste here",
  versionPrefix: "Version",
  entriesLabel: "entries",
  statusLabel: "Archive status",
  readOnly: "Read only",
  lockedBy: "Zip Master is currently held by {holder}.",
  lockedHolderFallback: "another member",
  pathAlreadyExists: "Path already exists.",
  invalidClipboardTarget: "Cannot paste a folder into itself.",
  unsaved: "Unsaved",
  noEntries: "No entries",
  newFolderPath: "New folder path",
  zipPath: "Zip path",
  existingFilePath: "Existing file path",
  addFileInputLabel: "Choose file to add",
  replaceFileInputLabel: "Choose replacement file",
  deleteEntry: "Delete",
  openReadOnly: "Open read-only",
  openMaster: "Open Master",
  desktopAgentRequired:
    "Desktop Agent is required to open files from this ZIP.",
  waitingForEntries: "Waiting for {count} open file(s) to finish: {entries}",
  closeRequested: "Waiting for open files",
  columns: {
    name: "Name",
    size: "Size",
    status: "Status",
    type: "File type",
    modified: "Modified",
  },
  columnMenu: {
    clear: "Clear",
    empty: "No matching values",
    filter: "Filter",
    search: "Search values",
  },
  entryMasterStatus: "MASTER",
  folderType: "Folder",
  fileTypeFallback: "File",
  modifiedFallback: "-",
  parentFolder: "Parent folder",
  rootFolder: "Archive root",
  placeholders: {
    folder: "evidence/",
    file: "docs/support.txt",
  },
};

type ZipMasterEditorProps = {
  session: ZipMasterSessionResponse;
  copy: ZipMasterEditorCopy;
  busy: boolean;
  onAddFile: (entryPath: string, file: File) => void | Promise<void>;
  onReplaceFile?: (entryPath: string, file: File) => void | Promise<void>;
  onCreateFolder: (entryPath: string) => void | Promise<void>;
  onDeleteEntry: (entryPath: string) => void | Promise<void>;
  onMoveEntry: (entryPath: string, targetPath: string) => void | Promise<void>;
  onCopyEntry?: (entryPath: string, targetPath: string) => void | Promise<void>;
  onOpenEntryReadOnly?: (entryPath: string) => void | Promise<void>;
  onOpenEntryMaster?: (entryPath: string) => void | Promise<void>;
  onClose: () => void | Promise<void>;
  onDiscard: () => void | Promise<void>;
};

type ZipContextMenuState = {
  x: number;
  y: number;
  target:
    | { type: "root"; folderPath: string }
    | { type: "folder"; folderPath: string; entryPath: string }
    | { type: "file"; folderPath: string; entryPath: string };
  mode: "actions" | "create-folder";
};

type ZipClipboardState = {
  mode: "move" | "copy";
  entryPath: string;
  entryName: string;
  isFolder: boolean;
};

export function ZipMasterEditor({
  session,
  copy,
  busy,
  onAddFile,
  onCreateFolder,
  onDeleteEntry,
  onMoveEntry,
  onCopyEntry,
  onOpenEntryReadOnly,
  onOpenEntryMaster,
  onClose,
  onDiscard,
}: ZipMasterEditorProps) {
  const [currentFolderPath, setCurrentFolderPath] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [contextMenu, setContextMenu] = useState<ZipContextMenuState | null>(
    null
  );
  const [pendingAddFolderPath, setPendingAddFolderPath] = useState("");
  const [draggedFilePath, setDraggedFilePath] = useState<string | null>(null);
  const [dropTargetFolderPath, setDropTargetFolderPath] = useState<
    string | null
  >(null);
  const [clipboardEntry, setClipboardEntry] =
    useState<ZipClipboardState | null>(null);
  const [menuPortalElement, setMenuPortalElement] =
    useState<HTMLElement | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMenuPortalElement(document.body);
  }, []);

  useEffect(() => {
    if (!currentFolderPath) {
      return;
    }
    if (findZipFolder(session.entries, currentFolderPath)) {
      return;
    }
    setCurrentFolderPath("");
  }, [currentFolderPath, session.entries]);

  const visibleEntries = useMemo(
    () => getVisibleZipEntries(session.entries, currentFolderPath),
    [currentFolderPath, session.entries]
  );
  const entryCount = countEntries(session.entries);
  const closeWaiting = session.state === "CLOSING_WAITING_ENTRIES";
  const interactionDisabled = busy || closeWaiting;
  const activeEntryMasters = session.activeEntryMasters ?? [];
  const currentPathLabel = formatCurrentPathLabel(
    currentFolderPath,
    copy.rootFolder
  );
  const handleAddFile = (file?: File | null) => {
    if (!file) {
      return;
    }
    const entryPath = joinZipPath(pendingAddFolderPath, file.name);
    if (zipPathExists(session.entries, entryPath)) {
      showErrorToast(new Error(copy.pathAlreadyExists), copy.pathAlreadyExists);
      if (addFileInputRef.current) {
        addFileInputRef.current.value = "";
      }
      return;
    }
    void onAddFile(entryPath, file);
    if (addFileInputRef.current) {
      addFileInputRef.current.value = "";
    }
  };
  const openContextMenu = (
    event: MouseEvent,
    target: ZipContextMenuState["target"]
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      target,
      mode: "actions",
    });
    setNewFolderName("");
  };
  const createFolderFromMenu = () => {
    if (!contextMenu || !newFolderName.trim()) {
      return;
    }
    const entryPath = makeFolderPath(
      contextMenu.target.folderPath,
      newFolderName
    );
    if (zipPathExists(session.entries, entryPath)) {
      showErrorToast(new Error(copy.pathAlreadyExists), copy.pathAlreadyExists);
      return;
    }
    setContextMenu(null);
    void onCreateFolder(entryPath);
  };
  const addFileFromMenu = () => {
    if (!contextMenu || contextMenu.target.type === "file") {
      return;
    }
    setPendingAddFolderPath(contextMenu.target.folderPath);
    setContextMenu(null);
    addFileInputRef.current?.click();
  };
  const addFileToCurrentFolder = () => {
    setPendingAddFolderPath(currentFolderPath);
    setContextMenu(null);
    addFileInputRef.current?.click();
  };
  const createFolderAtCurrentFolder = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setNewFolderName("");
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      target: {
        type: "root",
        folderPath: currentFolderPath,
      },
      mode: "create-folder",
    });
  };
  const deleteEntryFromMenu = () => {
    if (!contextMenu || contextMenu.target.type === "root") {
      return;
    }
    const { entryPath } = contextMenu.target;
    setContextMenu(null);
    void onDeleteEntry(entryPath);
  };
  const startClipboardOperation = (mode: ZipClipboardState["mode"]) => {
    if (!contextMenu || contextMenu.target.type === "root") {
      return;
    }
    const { entryPath } = contextMenu.target;
    setContextMenu(null);
    setClipboardEntry({
      mode,
      entryPath,
      entryName: basename(entryPath),
      isFolder: contextMenu.target.type === "folder",
    });
  };
  const pasteClipboardToMenuTarget = () => {
    if (!contextMenu || contextMenu.target.type === "file" || !clipboardEntry) {
      return;
    }
    const targetFolderPath = contextMenu.target.folderPath;
    if (
      clipboardEntry.isFolder &&
      isSameOrNestedZipFolder(targetFolderPath, clipboardEntry.entryPath)
    ) {
      showErrorToast(
        new Error(copy.invalidClipboardTarget),
        copy.invalidClipboardTarget
      );
      setContextMenu(null);
      return;
    }
    const targetPath = makeClipboardTargetPath(
      targetFolderPath,
      clipboardEntry
    );
    if (
      clipboardEntry.mode === "move" &&
      targetPath === clipboardEntry.entryPath
    ) {
      setContextMenu(null);
      setClipboardEntry(null);
      return;
    }
    if (zipPathExists(session.entries, targetPath)) {
      showErrorToast(new Error(copy.pathAlreadyExists), copy.pathAlreadyExists);
      setContextMenu(null);
      return;
    }
    setContextMenu(null);
    if (clipboardEntry.mode === "move") {
      setClipboardEntry(null);
      void onMoveEntry(clipboardEntry.entryPath, targetPath);
      return;
    }
    void onCopyEntry?.(clipboardEntry.entryPath, targetPath);
  };
  const openReadOnlyFromMenu = () => {
    if (!contextMenu || contextMenu.target.type !== "file") {
      return;
    }
    const { entryPath } = contextMenu.target;
    setContextMenu(null);
    void onOpenEntryReadOnly?.(entryPath);
  };
  const openMasterFromMenu = () => {
    if (!contextMenu || contextMenu.target.type !== "file") {
      return;
    }
    const { entryPath } = contextMenu.target;
    setContextMenu(null);
    void onOpenEntryMaster?.(entryPath);
  };
  const moveDraggedFile = (targetFolderPath: string) => {
    if (!draggedFilePath) {
      return;
    }
    const targetPath = joinZipPath(targetFolderPath, basename(draggedFilePath));
    setDropTargetFolderPath(null);
    setDraggedFilePath(null);
    if (targetPath === draggedFilePath) {
      return;
    }
    if (zipPathExists(session.entries, targetPath)) {
      showErrorToast(new Error(copy.pathAlreadyExists), copy.pathAlreadyExists);
      return;
    }
    void onMoveEntry(draggedFilePath, targetPath);
  };
  const openParentFolder = () => {
    setCurrentFolderPath(parentFolderPath(currentFolderPath));
  };
  const columns = useMemo<
    ProjectWingMasterDataGridProps<ZipMasterEntry>["columns"]
  >(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.name}
          />
        ),
        cell: ({ row }) => (
          <ZipEntryNameCell
            entry={row.original}
            busy={interactionDisabled}
            copy={copy}
            onOpenFolder={setCurrentFolderPath}
            onOpenReadOnly={onOpenEntryReadOnly}
            onOpenMaster={onOpenEntryMaster}
          />
        ),
        filterFn: projectWingSelectedValuesFilter,
        size: 420,
        minSize: 220,
        meta: {
          headerTitle: copy.columns.name,
          cellClassName: "max-w-0",
        },
      },
      {
        id: "size",
        accessorFn: (entry) => (entry.type === "file" ? entry.size : undefined),
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.size}
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right text-muted-foreground">
            {row.original.type === "file" ? formatBytes(row.original.size) : ""}
          </span>
        ),
        enableColumnFilter: false,
        size: 120,
        minSize: 96,
        meta: {
          headerTitle: copy.columns.size,
          headerClassName: "justify-end",
          cellClassName: "text-right",
        },
      },
      {
        id: "status",
        accessorFn: (entry) =>
          entry.type === "file" && entry.status === "MASTER"
            ? copy.entryMasterStatus
            : "",
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.status}
          />
        ),
        cell: ({ row }) =>
          row.original.type === "file" && row.original.status === "MASTER" ? (
            <StatusBadge
              tone="sky"
              className="h-5 rounded-[min(var(--radius-sm),8px)] px-1.5 text-[0.68rem]"
            >
              {copy.entryMasterStatus}
            </StatusBadge>
          ) : null,
        filterFn: projectWingSelectedValuesFilter,
        size: 130,
        minSize: 108,
        meta: { headerTitle: copy.columns.status },
      },
      {
        id: "type",
        accessorFn: (entry) => getZipEntryTypeLabel(entry, copy),
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.type}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {getZipEntryTypeLabel(row.original, copy)}
          </span>
        ),
        filterFn: projectWingSelectedValuesFilter,
        size: 160,
        minSize: 120,
        meta: { headerTitle: copy.columns.type },
      },
      {
        id: "modified",
        accessorFn: (entry) =>
          entry.modifiedAt
            ? formatModifiedAt(entry.modifiedAt, copy.modifiedFallback)
            : copy.modifiedFallback,
        header: ({ column }) => (
          <ProjectWingMasterDataGridColumnHeader
            column={column}
            copy={copy.columnMenu}
            title={copy.columns.modified}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatModifiedAt(row.original.modifiedAt, copy.modifiedFallback)}
          </span>
        ),
        filterFn: projectWingSelectedValuesFilter,
        sortingFn: (left, right) => {
          const leftValue = Date.parse(left.original.modifiedAt ?? "");
          const rightValue = Date.parse(right.original.modifiedAt ?? "");
          return (
            (Number.isNaN(leftValue) ? 0 : leftValue) -
            (Number.isNaN(rightValue) ? 0 : rightValue)
          );
        },
        size: 210,
        minSize: 168,
        meta: { headerTitle: copy.columns.modified },
      },
    ],
    [copy, interactionDisabled, onOpenEntryMaster, onOpenEntryReadOnly]
  );

  return (
    <section
      role="presentation"
      className="relative flex h-full min-h-[520px] min-w-0 flex-col overflow-hidden bg-background text-foreground"
      onClick={() => setContextMenu(null)}
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <ZipFileTypeIcon fileName={session.fileName} />
          <div className="min-w-0">
            <h2 className="truncate text-sm leading-5 font-semibold">
              {session.fileName}
            </h2>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                {copy.versionPrefix} {session.version}
              </span>
              <span>
                {entryCount} {copy.entriesLabel}
              </span>
              <AccessibleName label={copy.statusLabel}>
                <span role="group">
                  <StatusBadge tone={stateTone(session.state)}>
                    {session.state}
                  </StatusBadge>
                </span>
              </AccessibleName>
              {session.dirty ? (
                <StatusBadge tone="amber">{copy.unsaved}</StatusBadge>
              ) : null}
            </div>
          </div>
        </div>
        <ButtonGroup className="shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDiscard()}
            disabled={interactionDisabled}
          >
            <X className="size-4" aria-hidden="true" />
            {copy.discard}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onClose()}
            disabled={interactionDisabled}
          >
            {busy ? (
              <Skeleton className="size-4 rounded-full" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {closeWaiting ? copy.closeRequested : copy.closeAndCheckIn}
          </Button>
        </ButtonGroup>
      </header>

      {closeWaiting ? (
        <div className="border-b border-amber-300/50 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          {formatZipMasterCopy(copy.waitingForEntries, {
            count: activeEntryMasters.length,
            entries: activeEntryMasters
              .map((entry) => entry.entryPath)
              .join(", "),
          })}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--spreadsheet-body)]">
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-200 bg-[var(--spreadsheet-body)] px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Archive
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            {currentFolderPath ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                tooltip={copy.parentFolder}
                onClick={openParentFolder}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            <span className="min-w-0 truncate text-sm font-medium">
              {currentPathLabel}
            </span>
          </div>
          <ButtonGroup className="shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={interactionDisabled}
              onClick={addFileToCurrentFolder}
            >
              <Plus className="size-4" aria-hidden="true" />
              {copy.addFile}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={interactionDisabled}
              onClick={createFolderAtCurrentFolder}
            >
              <FolderPlus className="size-4" aria-hidden="true" />
              {copy.createFolder}
            </Button>
          </ButtonGroup>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden [&_[data-slot=frame]]:rounded-none [&_[data-slot=frame]]:[--frame-border-color:var(--color-slate-200)] [&_[data-slot=frame]]:[--frame-panel-border-color:var(--color-slate-200)] [&_[data-slot=frame-panel]]:rounded-none [&_td]:border-slate-200 [&_th]:border-slate-200",
            dropTargetFolderPath === currentFolderPath && "bg-primary/5"
          )}
          onContextMenu={(event) =>
            openContextMenu(event, {
              type: "root",
              folderPath: currentFolderPath,
            })
          }
          onDragOver={(event) => {
            if (!draggedFilePath) {
              return;
            }
            event.preventDefault();
          }}
          onDragEnter={() => setDropTargetFolderPath(currentFolderPath)}
          onDragLeave={() => setDropTargetFolderPath(null)}
          onDrop={(event) => {
            event.preventDefault();
            moveDraggedFile(currentFolderPath);
          }}
        >
          <ProjectWingMasterDataGrid
            columns={columns}
            data={visibleEntries}
            emptyMessage={copy.noEntries}
            getRowId={(entry) => entry.path}
            rowClassName={(entry) =>
              cn(
                "group select-none bg-[var(--spreadsheet-body)] hover:bg-[var(--spreadsheet-body-hover)]",
                entry.type === "folder" &&
                  dropTargetFolderPath === entry.path &&
                  "bg-primary/10 shadow-[inset_3px_0_0_color-mix(in_srgb,var(--primary)_62%,transparent)]"
              )
            }
            rowProps={(entry) => {
              const isFolder = entry.type === "folder";
              return {
                draggable: !isFolder && !interactionDisabled,
                onContextMenu: (event) =>
                  openContextMenu(
                    event,
                    isFolder
                      ? {
                          type: "folder",
                          folderPath: entry.path,
                          entryPath: entry.path,
                        }
                      : {
                          type: "file",
                          folderPath: parentFolderPath(entry.path),
                          entryPath: entry.path,
                        }
                  ),
                onDragStart: () => {
                  if (!isFolder) {
                    setDraggedFilePath(entry.path);
                  }
                },
                onDragOver: (event) => {
                  if (!isFolder) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                },
                onDragEnter: (event) => {
                  if (!isFolder) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  setDropTargetFolderPath(entry.path);
                },
                onDragLeave: (event) => {
                  if (!isFolder) {
                    return;
                  }
                  event.stopPropagation();
                  setDropTargetFolderPath(null);
                },
                onDrop: (event) => {
                  if (!isFolder) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  moveDraggedFile(entry.path);
                },
              };
            }}
            showRowSelection={false}
            showToolbar={false}
            tableLabel={copy.archiveContents}
            tableClassNames={{
              header: "bg-[var(--spreadsheet-header)]",
              headerRow:
                "bg-[var(--spreadsheet-header)] hover:bg-[var(--spreadsheet-header)]",
            }}
            tableLayout={{ dense: true }}
            testId="zip-master-data-grid"
            title={copy.archiveContents}
          />
        </div>
      </div>
      <Input
        ref={addFileInputRef}
        type="file"
        className="sr-only"
        label={copy.addFileInputLabel}
        onChange={(event) => handleAddFile(event.target.files?.[0])}
        disabled={interactionDisabled}
      />
      {contextMenu && menuPortalElement
        ? createPortal(
            <ZipContextMenu
              state={contextMenu}
              copy={copy}
              busy={interactionDisabled}
              newFolderName={newFolderName}
              onNewFolderNameChange={setNewFolderName}
              onShowCreateFolder={() =>
                setContextMenu({ ...contextMenu, mode: "create-folder" })
              }
              onCreateFolder={createFolderFromMenu}
              onAddFile={addFileFromMenu}
              onDeleteEntry={deleteEntryFromMenu}
              onStartMove={() => startClipboardOperation("move")}
              onStartCopy={() => startClipboardOperation("copy")}
              onPasteHere={pasteClipboardToMenuTarget}
              clipboardEntry={clipboardEntry}
              canCopy={Boolean(onCopyEntry)}
              onOpenReadOnly={openReadOnlyFromMenu}
              onOpenMaster={openMasterFromMenu}
            />,
            menuPortalElement
          )
        : null}
    </section>
  );
}

function ZipContextMenu({
  state,
  copy,
  busy,
  newFolderName,
  onNewFolderNameChange,
  onShowCreateFolder,
  onCreateFolder,
  onAddFile,
  onDeleteEntry,
  onStartMove,
  onStartCopy,
  onPasteHere,
  clipboardEntry,
  canCopy,
  onOpenReadOnly,
  onOpenMaster,
}: {
  state: ZipContextMenuState;
  copy: ZipMasterEditorCopy;
  busy: boolean;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  onShowCreateFolder: () => void;
  onCreateFolder: () => void;
  onAddFile: () => void;
  onDeleteEntry: () => void;
  onStartMove: () => void;
  onStartCopy: () => void;
  onPasteHere: () => void;
  clipboardEntry: ZipClipboardState | null;
  canCopy: boolean;
  onOpenReadOnly: () => void;
  onOpenMaster: () => void;
}) {
  return (
    <DynamicBox
      role="menu"
      className="fixed z-[80] min-w-48 rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
      position={{ x: state.x, y: state.y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {state.mode === "create-folder" ? (
        <form
          className="grid gap-2 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateFolder();
          }}
        >
          <label className="text-xs font-medium text-muted-foreground">
            {copy.newFolderPath}
            <Input
              value={newFolderName}
              onChange={(event) => onNewFolderNameChange(event.target.value)}
              placeholder={copy.placeholders.folder}
              className="mt-1"
              disabled={busy}
              autoFocus
            />
          </label>
          <Button
            type="submit"
            size="sm"
            disabled={!newFolderName.trim() || busy}
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy.createFolder}
          </Button>
        </form>
      ) : (
        <div className="grid gap-1">
          {state.target.type !== "file" && clipboardEntry ? (
            <Button
              type="button"
              role="menuitem"
              variant="ghost"
              className="justify-start"
              disabled={busy}
              onClick={onPasteHere}
            >
              {clipboardEntry.mode === "move" ? (
                <MoveRight className="size-4" aria-hidden="true" />
              ) : (
                <ClipboardPaste className="size-4" aria-hidden="true" />
              )}
              {clipboardEntry.mode === "move" ? copy.moveHere : copy.pasteHere}
            </Button>
          ) : null}
          {state.target.type !== "file" && clipboardEntry ? (
            <div className="my-1 h-px bg-border" aria-hidden="true" />
          ) : null}
          {state.target.type === "file" ? (
            <ButtonGroup orientation="vertical" className="w-full">
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                className="justify-start"
                disabled={busy}
                onClick={onOpenReadOnly}
              >
                <Eye className="size-4" aria-hidden="true" />
                {copy.openReadOnly}
              </Button>
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                className="justify-start"
                disabled={busy}
                onClick={onOpenMaster}
              >
                <FilePenLine className="size-4" aria-hidden="true" />
                {copy.openMaster}
              </Button>
            </ButtonGroup>
          ) : null}
          {state.target.type === "file" ? null : (
            <ButtonGroup orientation="vertical" className="w-full">
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                className="justify-start"
                disabled={busy}
                onClick={onAddFile}
              >
                <Upload className="size-4" aria-hidden="true" />
                {copy.addFile}
              </Button>
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                className="justify-start"
                disabled={busy}
                onClick={onShowCreateFolder}
              >
                <FolderPlus className="size-4" aria-hidden="true" />
                {copy.createFolder}
              </Button>
            </ButtonGroup>
          )}
          {state.target.type === "root" ? null : (
            <ButtonGroup orientation="vertical" className="w-full">
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                className="justify-start"
                disabled={busy}
                onClick={onStartMove}
              >
                <MoveRight className="size-4" aria-hidden="true" />
                {copy.moveEntry}
              </Button>
              {canCopy ? (
                <Button
                  type="button"
                  role="menuitem"
                  variant="ghost"
                  className="justify-start"
                  disabled={busy}
                  onClick={onStartCopy}
                >
                  <Copy className="size-4" aria-hidden="true" />
                  {copy.copyEntry}
                </Button>
              ) : null}
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                className="justify-start text-destructive hover:text-destructive"
                disabled={busy}
                onClick={onDeleteEntry}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {copy.deleteEntry}
              </Button>
            </ButtonGroup>
          )}
        </div>
      )}
    </DynamicBox>
  );
}

function ZipEntryNameCell({
  entry,
  busy,
  copy,
  onOpenFolder,
  onOpenReadOnly,
  onOpenMaster,
}: {
  entry: ZipMasterEntry;
  busy: boolean;
  copy: ZipMasterEditorCopy;
  onOpenFolder: (folderPath: string) => void;
  onOpenReadOnly?: (entryPath: string) => void | Promise<void>;
  onOpenMaster?: (entryPath: string) => void | Promise<void>;
}) {
  const isFolder = entry.type === "folder";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ZipFileTypeIcon fileName={entry.name} isFolder={isFolder} />
      {isFolder ? (
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="h-7 min-w-0 truncate px-1 text-left font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none"
          onClick={() => onOpenFolder(entry.path)}
        >
          {entry.name}
        </Button>
      ) : (
        <span className="min-w-0 truncate text-left">{entry.name}</span>
      )}
      {isFolder ? null : (
        <span className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {onOpenReadOnly ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7"
              disabled={busy}
              accessibleName={`${copy.openReadOnly}: ${entry.name}`}
              tooltip={copy.openReadOnly}
              onClick={(event) => {
                event.stopPropagation();
                void onOpenReadOnly(entry.path);
              }}
            >
              <Eye className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          {onOpenMaster ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7"
              disabled={busy}
              accessibleName={`${copy.openMaster}: ${entry.name}`}
              tooltip={copy.openMaster}
              onClick={(event) => {
                event.stopPropagation();
                void onOpenMaster(entry.path);
              }}
            >
              <FilePenLine className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </span>
      )}
    </div>
  );
}

function ZipFileTypeIcon({
  fileName,
  isFolder = false,
}: {
  fileName: string;
  isFolder?: boolean;
}) {
  const extension = getFileExtension(fileName);
  const iconUrl = isFolder
    ? null
    : (getFileTypeIconAsUrl({
        extension: extension ?? undefined,
        size: 16,
        imageFileType: "svg",
      }) ?? null);

  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden">
      {isFolder ? (
        <Folder className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      ) : iconUrl ? (
        <Image
          src={iconUrl}
          alt=""
          aria-hidden="true"
          width={16}
          height={16}
          unoptimized
          className="h-4 w-4 object-contain"
          draggable={false}
        />
      ) : (
        <FileIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

function stateTone(state: ZipMasterSessionState) {
  if (state === "OPEN") {
    return "sky";
  }
  if (state === "DIRTY") {
    return "amber";
  }
  if (state === "CLOSING_WAITING_ENTRIES") {
    return "amber";
  }
  if (state === "CLOSED") {
    return "green";
  }
  if (state.endsWith("FAILED") || state.includes("CONFLICT")) {
    return "amber";
  }
  return "slate";
}

function formatZipMasterCopy(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatModifiedAt(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getZipEntryTypeLabel(
  entry: ZipMasterEntry,
  copy: ZipMasterEditorCopy
) {
  if (entry.type === "folder") {
    return copy.folderType;
  }
  const extension = getFileExtension(entry.name);
  if (!extension) {
    return copy.fileTypeFallback;
  }
  return `${extension.toUpperCase()} ${copy.fileTypeFallback.toLowerCase()}`;
}

function countEntries(entries: ZipMasterEntry[]): number {
  return entries.reduce(
    (total, entry) =>
      total + 1 + (entry.type === "folder" ? countEntries(entry.children) : 0),
    0
  );
}

function getVisibleZipEntries(
  entries: ZipMasterEntry[],
  folderPath: string
): ZipMasterEntry[] {
  if (!folderPath) {
    return entries;
  }
  return findZipFolder(entries, folderPath)?.children ?? [];
}

function findZipFolder(
  entries: ZipMasterEntry[],
  folderPath: string
): Extract<ZipMasterEntry, { type: "folder" }> | null {
  for (const entry of entries) {
    if (entry.type !== "folder") {
      continue;
    }
    if (entry.path === folderPath) {
      return entry;
    }
    const nested = findZipFolder(entry.children, folderPath);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function formatCurrentPathLabel(folderPath: string, rootLabel: string) {
  if (!folderPath) {
    return rootLabel;
  }
  const segments = folderPath
    .replaceAll(/\/+$/g, "")
    .split("/")
    .filter(Boolean);
  return [rootLabel, ...segments].join(" / ");
}

function joinZipPath(folderPath: string, fileName: string): string {
  const normalizedFolder = normalizeZipFolderPath(folderPath);
  const normalizedName = normalizeZipEntryName(fileName);
  return normalizedFolder
    ? `${normalizedFolder}${normalizedName}`
    : normalizedName;
}

function makeFolderPath(folderPath: string, folderName: string): string {
  const folder = joinZipPath(folderPath, folderName);
  return folder.endsWith("/") ? folder : `${folder}/`;
}

function makeClipboardTargetPath(
  folderPath: string,
  clipboardEntry: ZipClipboardState
): string {
  const targetPath = joinZipPath(folderPath, clipboardEntry.entryName);
  return clipboardEntry.isFolder ? `${targetPath}/` : targetPath;
}

function basename(path: string): string {
  const normalizedPath = path.replaceAll(/\/+$/g, "");
  const segments = normalizedPath.split("/");
  return segments.at(-1) ?? normalizedPath;
}

function parentFolderPath(path: string): string {
  const segments = path.replaceAll(/\/+$/g, "").split("/");
  segments.pop();
  return segments.length > 0 ? `${segments.join("/")}/` : "";
}

function zipPathExists(entries: ZipMasterEntry[], path: string): boolean {
  return entries.some((entry) => {
    if (entry.path === path) {
      return true;
    }
    return entry.type === "folder" && zipPathExists(entry.children, path);
  });
}

function isSameOrNestedZipFolder(folderPath: string, entryPath: string) {
  const targetFolderPath = normalizeZipFolderPath(folderPath);
  const sourceFolderPath = normalizeZipFolderPath(entryPath);
  return (
    targetFolderPath === sourceFolderPath ||
    targetFolderPath.startsWith(sourceFolderPath)
  );
}

function normalizeZipFolderPath(path: string): string {
  const normalized = path
    .split("/")
    .map(normalizeZipEntryName)
    .filter(Boolean)
    .join("/");
  return normalized ? `${normalized}/` : "";
}

function normalizeZipEntryName(name: string): string {
  return name.trim().replaceAll("\\", "/").split("/").filter(Boolean).join("/");
}

function getFileExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return null;
  }
  return fileName.slice(lastDot + 1).toLowerCase();
}
