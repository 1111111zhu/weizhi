import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import type { ZipMasterSessionResponse } from "../api/client";
import { ZipMasterEditor } from "./zip-master-editor";
import type { ZipMasterEditorCopy } from "./zip-master-editor";

const errorToast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/error-toast", () => ({
  showErrorToast: errorToast,
}));

const copy = {
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
} satisfies ZipMasterEditorCopy;
const baseSession: ZipMasterSessionResponse = {
  ok: true,
  mode: "MASTER",
  sessionId: "zip-session-1",
  attachmentId: "attachment-1",
  projectId: "project-1",
  lockSessionId: "lock-session-1",
  fileName: "audit.zip",
  version: 3,
  state: "OPEN",
  dirty: false,
  entries: [
    {
      type: "folder",
      name: "docs",
      path: "docs/",
      children: [
        {
          type: "file",
          name: "support.txt",
          path: "docs/support.txt",
          modifiedAt: "2026-06-21T11:30:00.000Z",
          size: 7,
        },
      ],
    },
    {
      type: "folder",
      name: "archive",
      path: "archive/",
      children: [],
    },
  ],
};
const moveSession: ZipMasterSessionResponse = {
  ...baseSession,
  entries: [
    {
      type: "folder",
      name: "archive",
      path: "archive/",
      children: [],
    },
    {
      type: "folder",
      name: "duplicates",
      path: "duplicates/",
      children: [
        {
          type: "file",
          name: "support.txt",
          path: "duplicates/support.txt",
          size: 9,
        },
      ],
    },
    {
      type: "file",
      name: "support.txt",
      path: "support.txt",
      size: 7,
    },
  ],
};

describe("lint test setup", () => {
  afterEach(() => cleanup());

  describe(ZipMasterEditor, () => {
    beforeEach(() => {
      errorToast.mockClear();
    });

    it("renders zip state and a single-level root file list", () => {
      render(
        <ZipMasterEditor
          session={baseSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={vi.fn()}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      expect(screen.getByRole("heading", { name: "audit.zip" })).toBeVisible();
      expect(screen.getByTestId("zip-master-data-grid")).toBeVisible();
      expect(screen.getByText("Version 3")).toBeVisible();
      expect(screen.getByText("3 entries")).toBeVisible();
      const statusGroup = screen.getByRole("group", { name: "Archive status" });
      expect(within(statusGroup).getByText("OPEN")).toBeVisible();
      expect(screen.getByRole("columnheader", { name: "Name" })).toBeVisible();
      expect(screen.getByRole("columnheader", { name: "Size" })).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "File type" })
      ).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Modified" })
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "docs" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Discard" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Add file" })).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Create folder" })
      ).toBeVisible();
      expect(
        screen.queryByTestId("expandable-action-bar")
      ).not.toBeInTheDocument();
    });

    it("opens folders into the next level and shows parent navigation", () => {
      render(
        <ZipMasterEditor
          session={baseSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={vi.fn()}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "docs" }));

      expect(screen.getByText("Archive root / docs")).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Parent folder" })
      ).toBeVisible();
      expect(screen.getByText("support.txt")).toBeVisible();
      expect(screen.getByText("TXT file")).toBeVisible();
      expect(screen.getByText("Jun 21, 2026, 11:30")).toBeVisible();
      expect(screen.queryByRole("button", { name: "archive" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Parent folder" }));

      expect(screen.getByRole("button", { name: "docs" })).toBeVisible();
      expect(screen.queryByText("support.txt")).toBeNull();
    });

    it("submits folder, delete, and close actions", () => {
      const onCreateFolder = vi.fn();
      const onDeleteEntry = vi.fn();
      const onClose = vi.fn();
      render(
        <ZipMasterEditor
          session={baseSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={onCreateFolder}
          onDeleteEntry={onDeleteEntry}
          onMoveEntry={vi.fn()}
          onReplaceFile={vi.fn()}
          onClose={onClose}
          onDiscard={vi.fn()}
        />
      );

      const folderRow = screen.getByRole("row", { name: /docs Folder/ });
      fireEvent.contextMenu(folderRow);
      const folderMenu = screen.getByRole("menu");
      fireEvent.click(
        within(folderMenu).getByRole("menuitem", { name: "Create folder" })
      );
      fireEvent.change(within(folderMenu).getByLabelText("New folder path"), {
        target: { value: "evidence" },
      });
      fireEvent.click(
        within(folderMenu).getByRole("button", { name: "Create folder" })
      );
      expect(onCreateFolder).toHaveBeenCalledWith("docs/evidence/");

      fireEvent.click(screen.getByRole("button", { name: "docs" }));
      const fileRow = screen.getByRole("row", { name: /support\.txt/ });
      fireEvent.contextMenu(fileRow);
      const fileMenu = screen.getByRole("menu");
      fireEvent.click(
        within(fileMenu).getByRole("menuitem", {
          name: "Delete",
        })
      );
      expect(onDeleteEntry).toHaveBeenCalledWith("docs/support.txt");

      fireEvent.click(
        screen.getByRole("button", { name: "Close and check in" })
      );
      expect(onClose).toHaveBeenCalledWith();
    });

    it("renders the context menu outside the clipped editor panel", () => {
      render(
        <ZipMasterEditor
          session={baseSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={vi.fn()}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      fireEvent.contextMenu(screen.getByRole("row", { name: /docs Folder/ }));

      expect(screen.getByRole("menu").parentElement).toBe(document.body);
    });

    it("submits add and discard actions from context menus without replace", () => {
      const onAddFile = vi.fn();
      const onReplaceFile = vi.fn();
      const onDiscard = vi.fn();
      render(
        <ZipMasterEditor
          session={baseSession}
          copy={copy}
          busy={false}
          onAddFile={onAddFile}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={vi.fn()}
          onReplaceFile={onReplaceFile}
          onClose={vi.fn()}
          onDiscard={onDiscard}
        />
      );

      fireEvent.contextMenu(screen.getByRole("row", { name: /docs Folder/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Add file" }));
      const addedFile = new File(["new"], "new.txt", { type: "text/plain" });
      fireEvent.change(screen.getByLabelText("Choose file to add"), {
        target: { files: [addedFile] },
      });
      expect(onAddFile).toHaveBeenCalledWith("docs/new.txt", addedFile);

      fireEvent.click(screen.getByRole("button", { name: "docs" }));
      const fileRow = screen.getByRole("row", { name: /support\.txt/ });
      fireEvent.contextMenu(fileRow);
      expect(
        screen.queryByRole("menuitem", { name: "Replace file" })
      ).not.toBeInTheDocument();
      expect(onReplaceFile).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Discard" }));
      expect(onDiscard).toHaveBeenCalledWith();
    });

    it("opens nested files read-only or as Master", () => {
      const onOpenEntryReadOnly = vi.fn();
      const onOpenEntryMaster = vi.fn();
      render(
        <ZipMasterEditor
          session={baseSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={vi.fn()}
          onReplaceFile={vi.fn()}
          onOpenEntryReadOnly={onOpenEntryReadOnly}
          onOpenEntryMaster={onOpenEntryMaster}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "docs" }));
      fireEvent.click(
        screen.getByRole("button", {
          name: "Open read-only: support.txt",
        })
      );
      expect(onOpenEntryReadOnly).toHaveBeenCalledWith("docs/support.txt");

      fireEvent.click(
        screen.getByRole("button", {
          name: "Open Master: support.txt",
        })
      );
      expect(onOpenEntryMaster).toHaveBeenCalledWith("docs/support.txt");

      const fileRow = screen.getByRole("row", { name: /support\.txt/ });
      fireEvent.contextMenu(fileRow);
      fireEvent.click(screen.getByRole("menuitem", { name: "Open read-only" }));
      fireEvent.contextMenu(fileRow);
      fireEvent.click(screen.getByRole("menuitem", { name: "Open Master" }));

      expect(onOpenEntryReadOnly).toHaveBeenCalledTimes(2);
      expect(onOpenEntryMaster).toHaveBeenCalledTimes(2);
    });

    it("renders a Master status column for opened zip entries", () => {
      const session = {
        ...baseSession,
        entries: [
          {
            type: "file",
            name: "support.xlsx",
            path: "support.xlsx",
            size: 4096,
            status: "MASTER",
            masterState: "OPEN",
          },
          {
            type: "file",
            name: "report.pdf",
            path: "report.pdf",
            size: 2048,
          },
        ],
      } as ZipMasterSessionResponse;

      render(
        <ZipMasterEditor
          session={session}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={vi.fn()}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      expect(
        screen.getByRole("columnheader", { name: "Status" })
      ).toBeVisible();
      const masterRow = screen.getByRole("row", { name: /support\.xlsx/ });
      expect(within(masterRow).getByText("MASTER")).toBeVisible();
      const _normalRow = screen.getByRole("row", { name: /report\.pdf/ });
    });

    it("copies nested files through the archive context clipboard", () => {
      const onCopyEntry = vi.fn();
      render(
        <ZipMasterEditor
          session={baseSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={vi.fn()}
          onCopyEntry={onCopyEntry}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "docs" }));
      fireEvent.contextMenu(screen.getByRole("row", { name: /support\.txt/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
      fireEvent.click(screen.getByRole("button", { name: "Parent folder" }));
      fireEvent.contextMenu(screen.getByRole("table"));
      fireEvent.click(screen.getByRole("menuitem", { name: "Paste here" }));

      expect(onCopyEntry).toHaveBeenCalledWith(
        "docs/support.txt",
        "support.txt"
      );
    });

    it("moves entries through the archive context clipboard", () => {
      const onMoveEntry = vi.fn();
      render(
        <ZipMasterEditor
          session={moveSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={onMoveEntry}
          onCopyEntry={vi.fn()}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      fireEvent.contextMenu(screen.getByRole("row", { name: /support\.txt/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Move" }));
      fireEvent.contextMenu(
        screen.getByRole("row", { name: /archive Folder/ })
      );
      fireEvent.click(screen.getByRole("menuitem", { name: "Move here" }));

      expect(onMoveEntry).toHaveBeenCalledWith(
        "support.txt",
        "archive/support.txt"
      );
    });

    it("does not paste folders into themselves", () => {
      const onMoveEntry = vi.fn();
      render(
        <ZipMasterEditor
          session={baseSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={onMoveEntry}
          onCopyEntry={vi.fn()}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      const docsRow = screen.getByRole("row", { name: /docs Folder/ });
      fireEvent.contextMenu(docsRow);
      fireEvent.click(screen.getByRole("menuitem", { name: "Move" }));
      fireEvent.contextMenu(docsRow);
      fireEvent.click(screen.getByRole("menuitem", { name: "Move here" }));

      expect(onMoveEntry).not.toHaveBeenCalled();
      expect(errorToast).toHaveBeenCalledWith(
        expect.any(Error),
        "Cannot paste a folder into itself."
      );
    });

    it("moves files by dragging them into folders", () => {
      const onMoveEntry = vi.fn();
      render(
        <ZipMasterEditor
          session={moveSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={onMoveEntry}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      const fileRow = screen.getByRole("row", { name: /support\.txt/ });
      const targetFolder = screen.getByRole("row", { name: /archive Folder/ });
      fireEvent.dragStart(fileRow);
      fireEvent.dragEnter(targetFolder);
      fireEvent.drop(targetFolder);

      expect(onMoveEntry).toHaveBeenCalledWith(
        "support.txt",
        "archive/support.txt"
      );
    });

    it("does not move files onto an existing target path", () => {
      const onMoveEntry = vi.fn();
      render(
        <ZipMasterEditor
          session={moveSession}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={onMoveEntry}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      const fileRow = screen.getByRole("row", {
        name: /support\.txt/,
      });
      const targetFolder = screen.getByRole("row", {
        name: /duplicates Folder/,
      });
      fireEvent.dragStart(fileRow);
      fireEvent.drop(targetFolder);

      expect(onMoveEntry).not.toHaveBeenCalled();
      expect(errorToast).toHaveBeenCalledWith(
        expect.any(Error),
        "Path already exists."
      );
    });

    it("shows and locks the close barrier while entry Masters remain active", () => {
      render(
        <ZipMasterEditor
          session={{
            ...baseSession,
            state: "CLOSING_WAITING_ENTRIES",
            activeEntryMasters: [
              { entryPath: "docs/support.xlsx", state: "OPEN" },
            ],
          }}
          copy={copy}
          busy={false}
          onAddFile={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteEntry={vi.fn()}
          onMoveEntry={vi.fn()}
          onReplaceFile={vi.fn()}
          onClose={vi.fn()}
          onDiscard={vi.fn()}
        />
      );

      expect(
        screen.getByText(
          "Waiting for 1 open file(s) to finish: docs/support.xlsx"
        )
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Waiting for open files" })
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
    });
  });
});
