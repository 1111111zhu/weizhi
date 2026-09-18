import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import type {
  ConfirmationEmpImportClient,
  ConfirmationEmpImportJob,
  ConfirmationEmpImportMode,
  ConfirmationEmpImportPreview,
} from "../../api/client";
import { getDictionary } from "../../i18n/dictionaries";
import { requiredFixture } from "../../test/required-fixture";
import { MATRIX_REDUCED_REVEAL_DURATION_CLASS } from "./confirmation-overview-matrix";
import { ConfirmationResponseWarehouse } from "./confirmation-response-warehouse";

const directory = {
  id: "directory-1",
  code: "A1",
  title: "Planning",
  path: "Planning",
  level: 1,
  canAcceptWorkflow: true,
};

function createPreview(
  mode: ConfirmationEmpImportMode
): ConfirmationEmpImportPreview {
  return {
    projectId: "project-1",
    mode,
    targetDirectoryId: directory.id,
    targetDirectories: [directory],
    batchDirectory:
      mode === "GROUPED"
        ? { code: "A1-B001", name: "Confirmation responses" }
        : null,
    zipWorkingPaper:
      mode === "ZIP"
        ? { code: "A1-F001", name: "Confirmation responses.zip" }
        : null,
    counts: { eligible: 1, imported: 1, blocked: 1 },
    items: [
      {
        id: "response-eligible-1",
        confirmationId: "confirmation-1",
        confirmationCode: "CONF-001",
        counterparty: "Orchid Bank",
        role: "RESPONSE_ARTIFACT",
        sourceFileName: "reply-1.pdf",
        sourceFileSize: 1200,
        proposedCode: "A1-F001",
        proposedName: "Orchid Bank response 1",
        status: "ELIGIBLE",
        signoff: {
          preparerName: "Preparer",
          reviewerName: "Reviewer",
          manual: mode === "ZIP",
        },
        zipEntryName: mode === "ZIP" ? "001-Orchid-Bank-reply-1.pdf" : null,
        blockingIssues: [],
      },
      {
        id: "response-imported-1",
        confirmationId: "confirmation-1",
        confirmationCode: "CONF-001",
        counterparty: "Orchid Bank",
        role: "RESPONSE_ARTIFACT",
        sourceFileName: "reply-2.pdf",
        sourceFileSize: 800,
        proposedCode: "A1-F002",
        proposedName: "Orchid Bank response 2",
        status: "IMPORTED",
        existingLocation: "Planning / A1-F002",
        signoff: {
          preparerName: "Preparer",
          reviewerName: "Reviewer",
          manual: mode === "ZIP",
        },
        zipEntryName: null,
        blockingIssues: [],
      },
      {
        id: "response-blocked-1",
        confirmationId: "confirmation-1",
        confirmationCode: "CONF-001",
        counterparty: "Orchid Bank",
        role: "RESPONSE_ARTIFACT",
        sourceFileName: "missing.pdf",
        sourceFileSize: 0,
        proposedCode: "A1-F003",
        proposedName: "Missing response",
        status: "BLOCKED",
        signoff: { manual: mode === "ZIP" },
        zipEntryName: null,
        blockingIssues: ["Source object is missing"],
      },
    ],
    zipEntries: mode === "ZIP" ? ["001-Orchid-Bank-reply-1.pdf"] : [],
    blockers: ["Source object is missing"],
    fingerprint: `preview-${mode}`,
  };
}

function createThreeItemGroupedPreview(): ConfirmationEmpImportPreview {
  const preview = createPreview("GROUPED");
  const [source] = preview.items;
  const files = [
    ["response-hsbc", "HSBC Hong Kong.pdf"],
    ["response-standard-chartered", "Standard Chartered.pdf"],
    ["response-bank-scan", "Bank reply scan.pdf"],
  ] as const;
  return {
    ...preview,
    counts: { eligible: files.length, imported: 0, blocked: 0 },
    blockers: [],
    items: files.map(([id, sourceFileName], index) => ({
      ...source,
      id,
      sourceFileName,
      proposedCode: `A1-F00${index + 1}`,
      proposedName: sourceFileName,
      sourceProposal: {
        sourceConfirmationId: source.confirmationId,
        empCode: `A1-F00${index + 1}`,
        businessName: sourceFileName,
      },
      status: "ELIGIBLE",
      blockingIssues: [],
    })),
  };
}

function createJob(status: ConfirmationEmpImportJob["status"] = "QUEUED") {
  return {
    id: "job-1",
    projectId: "project-1",
    mode: "FLAT",
    status,
    total: 1,
    completed: status === "COMPLETED" ? 1 : 0,
    failed: 0,
    retryable: false,
    previewFingerprint: "preview-FLAT",
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    withdrawnAt: null,
    items: [],
  } satisfies ConfirmationEmpImportJob;
}

function createClient(): ConfirmationEmpImportClient {
  return {
    confirmationEmpProjects: vi.fn().mockResolvedValue([]),
    workflow: vi.fn().mockResolvedValue([
      {
        id: directory.id,
        parentId: null,
        code: directory.code,
        title: directory.title,
        level: directory.level,
        nodeType: "PHASE",
        workingPapers: [],
        children: [],
      },
    ]),
    confirmationEmpPreview: vi
      .fn()
      .mockImplementation((_projectId, input) =>
        Promise.resolve(createPreview(input.mode))
      ),
    createConfirmationEmpImport: vi.fn().mockResolvedValue(createJob()),
    confirmationEmpImportJob: vi.fn().mockResolvedValue(createJob("COMPLETED")),
    confirmationEmpImportHistory: vi.fn().mockResolvedValue([]),
    retryConfirmationEmpImport: vi.fn().mockResolvedValue(createJob()),
    withdrawConfirmationEmpImport: vi.fn().mockResolvedValue(createJob()),
    restoreConfirmationEmpImport: vi.fn().mockResolvedValue(createJob()),
  };
}

async function renderArchive(
  client: ConfirmationEmpImportClient,
  onCompleted = vi.fn(),
  onBusyChange = vi.fn(),
  confirmationIds?: string[],
  onViewProject?: () => void
) {
  const dictionary = await getDictionary("en-US");
  render(
    <ConfirmationResponseWarehouse
      copy={dictionary.confirmationCenter.intranet.responseWarehousePanel}
      client={client}
      projectId="project-1"
      projectCode="AUD-001"
      projectName="Orchid Audit"
      clientName="Orchid Technology Limited"
      confirmationId={confirmationIds ? undefined : "confirmation-1"}
      confirmationIds={confirmationIds}
      onCompleted={onCompleted}
      onBusyChange={onBusyChange}
      onViewProject={onViewProject}
    />
  );
  await screen.findByText("reply-1.pdf");
  return onCompleted;
}

describe(ConfirmationResponseWarehouse, () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState({}, "");
  });

  it("requests the complete selected confirmation set for archive preview", async () => {
    const client = createClient();
    await renderArchive(client, vi.fn(), vi.fn(), [
      "confirmation-1",
      "confirmation-2",
    ]);
    expect(client.confirmationEmpPreview).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        confirmationIds: ["confirmation-1", "confirmation-2"],
      })
    );
  });

  it("revalidates imported targets on focus and reflects deletion and restoration", async () => {
    const client = createClient();
    await renderArchive(client);
    const deleted = createPreview("FLAT");
    requiredFixture(deleted.items[1]).targetState = "RECYCLED";
    vi.mocked(client.confirmationEmpPreview).mockResolvedValue(deleted);
    fireEvent.focus(window);
    await expect(
      screen.findByText("Deleted (recycle bin)")
    ).resolves.toBeTruthy();
    const restored = createPreview("FLAT");
    requiredFixture(restored.items[1]).targetState = "AVAILABLE";
    vi.mocked(client.confirmationEmpPreview).mockResolvedValue(restored);
    fireEvent.focus(window);
    await waitFor(() =>
      expect(screen.queryByText("Deleted (recycle bin)")).toBeNull()
    );
  });

  it("imports only the chosen pending file and locks a reimport to the original directory", async () => {
    const client = createClient();
    const preview = createPreview("FLAT");
    preview.items = [
      requiredFixture(preview.items[0]),
      {
        ...requiredFixture(preview.items[0]),
        id: "single-reimport",
        sourceFileName: "deleted.pdf",
        reimportTargetDirectoryId: directory.id,
      },
    ];
    preview.blockers = [];
    vi.mocked(client.confirmationEmpPreview).mockResolvedValue(preview);
    await renderArchive(client);
    expect(screen.getByText("Deleted (recycle bin) · 1")).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "Import selection: deleted.pdf" })
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reimport" }));
    expect(
      screen.getByRole("combobox", { name: "Workflow directory" })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() =>
      expect(client.createConfirmationEmpImport).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          targetDirectoryId: directory.id,
          items: [expect.objectContaining({ id: "single-reimport" })],
        })
      )
    );
  });

  it("restores the archive scroll and reimport step after returning from project files", async () => {
    const client = createClient();
    const preview = createPreview("FLAT");
    requiredFixture(preview.items[0]).reimportTargetDirectoryId = directory.id;
    vi.mocked(client.confirmationEmpPreview).mockResolvedValue(preview);
    await renderArchive(client, vi.fn(), vi.fn(), undefined, vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "Reimport" }));
    const scroller = screen.getByTestId(
      "confirmation-emp-import-scroll-region"
    );
    scroller.scrollTop = 180;
    // The project button is shown once all pending items have been archived.
    window.history.replaceState(
      {
        confirmationArchiveView: {
          projectId: "project-1",
          confirmationIds: ["confirmation-1"],
          mode: "FLAT",
          targetDirectoryId: directory.id,
          requestedReimport: "response-eligible-1",
          importSelection: "response-eligible-1",
          scrollTop: 180,
        },
      },
      ""
    );
    cleanup();
    await renderArchive(client);
    expect(screen.queryByRole("button", { name: "Reimport" })).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Import selection" })
    ).toHaveTextContent("Import selection: reply-1.pdf");
    expect(
      screen.getByTestId("confirmation-emp-import-scroll-region").scrollTop
    ).toBe(180);
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() =>
      expect(client.createConfirmationEmpImport).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          targetDirectoryId: directory.id,
          items: [expect.objectContaining({ id: "response-eligible-1" })],
        })
      )
    );
    window.history.replaceState({}, "");
  });

  it("loads the completed confirmation automatically and keeps generated fields editable", async () => {
    const client = createClient();
    await renderArchive(client);

    expect(client.confirmationEmpPreview).toHaveBeenCalledWith("project-1", {
      mode: "FLAT",
      targetDirectoryId: "directory-1",
      confirmationId: "confirmation-1",
    });
    expect(screen.queryByRole("button", { name: "Preview import" })).toBeNull();
    expect(screen.queryByText("Import history")).toBeNull();
    expect(screen.getByText("Orchid Technology Limited")).toBeVisible();
    expect(screen.queryByText("Conflict handling")).toBeNull();
    expect(
      screen.queryByText("Keep existing files and rename automatically")
    ).toBeNull();
    expect(screen.getByText("Files to import")).toBeVisible();
    expect(screen.getByText("To import: 1 · Imported: 1")).toBeVisible();
    expect(
      screen.getByTestId("confirmation-emp-import-scroll-region")
    ).toHaveClass("h-full", "min-h-0", "overflow-y-auto");
    expect(
      screen.queryByText(
        "Create one independent working paper for each response file."
      )
    ).toBeNull();
    expect(
      screen.queryByText(
        "Choose an import mode and destination, then review the response files to be archived."
      )
    ).toBeNull();

    fireEvent.change(screen.getByDisplayValue("A1-F001"), {
      target: { value: "A1-F009" },
    });
    fireEvent.change(screen.getByDisplayValue("Orchid Bank response 1"), {
      target: { value: "Bank confirmation response" },
    });

    expect(screen.getByDisplayValue("A1-F009")).toBeVisible();
    expect(
      screen.getByDisplayValue("Bank confirmation response")
    ).toBeVisible();
  });

  it("does not load or display import history in the archive panel", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpImportHistory").mockResolvedValue([
      createJob("COMPLETED"),
    ]);
    const dictionary = await getDictionary("en-US");
    render(
      <ConfirmationResponseWarehouse
        copy={dictionary.confirmationCenter.intranet.responseWarehousePanel}
        client={client}
        projectId="project-1"
        confirmationId="confirmation-1"
      />
    );
    await waitFor(() =>
      expect(client.confirmationEmpPreview).toHaveBeenCalledWith("project-1", {
        mode: "FLAT",
        targetDirectoryId: "directory-1",
        confirmationId: "confirmation-1",
      })
    );
    expect(screen.queryByText("Import history")).not.toBeInTheDocument();
    expect(client.confirmationEmpImportHistory).not.toHaveBeenCalled();
  });

  it("shows imported files as a completed state and prevents duplicate archiving", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpPreview").mockImplementation(
      (_projectId, input) => {
        const preview = createPreview(input.mode);
        const imported = preview.items.find(
          (item) => item.status === "IMPORTED"
        );
        if (!imported) {
          throw new Error("Imported preview item is missing");
        }
        return Promise.resolve({
          ...preview,
          counts: { eligible: 0, imported: 1, blocked: 0 },
          items: [imported],
          blockers: [],
        });
      }
    );
    const dictionary = await getDictionary("en-US");
    const onClose = vi.fn();

    render(
      <ConfirmationResponseWarehouse
        copy={dictionary.confirmationCenter.intranet.responseWarehousePanel}
        client={client}
        projectId="project-1"
        projectCode="AUD-001"
        confirmationId="confirmation-1"
        onClose={onClose}
      />
    );

    await expect(screen.findByText("reply-2.pdf")).resolves.toBeVisible();
    expect(screen.getByText("Planning / A1-F002")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Confirm archive" })
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("withdraws only the selected imported file and refreshes its preview", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpPreview").mockImplementation(
      (_projectId, input) =>
        Promise.resolve({
          ...createPreview(input.mode),
          items: createPreview(input.mode).items.map((item) =>
            item.status === "IMPORTED"
              ? {
                  ...item,
                  existingJobId: "old-job",
                  existingItemId: "import-item-2",
                  existingMode: "FLAT" as const,
                }
              : item
          ),
        })
    );
    await renderArchive(client);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw import" }));
    expect(client.withdrawConfirmationEmpImport).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select file: reply-2.pdf" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm withdrawal (1)" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Withdraw import",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Withdraw import" })
    );
    await waitFor(() =>
      expect(client.withdrawConfirmationEmpImport).toHaveBeenCalledWith(
        "project-1",
        "old-job",
        { mode: "FLAT", scope: "ITEM", itemId: "import-item-2" }
      )
    );
    await waitFor(() =>
      expect(client.confirmationEmpPreview).toHaveBeenCalledTimes(2)
    );
  });

  it("hides selection until requested and clears it on cancel", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpPreview").mockImplementation(
      (_id, input) =>
        Promise.resolve({
          ...createPreview(input.mode),
          items: createPreview(input.mode).items.map((item) => ({
            ...item,
            existingJobId: "old-job",
            existingItemId: item.id,
            existingMode: "FLAT" as const,
          })),
        })
    );
    await renderArchive(client);
    expect(
      screen.queryByRole("checkbox", { name: "Select all imported files" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw import" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all imported files" })
    );
    expect(
      screen.getByRole("button", { name: "Confirm withdrawal (1)" })
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("checkbox", { name: "Select all imported files" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw import" }));
    expect(
      screen.getByRole("button", { name: "Confirm withdrawal (0)" })
    ).toBeDisabled();
  });

  it("withdraws a multi-selection sequentially and refreshes after a partial failure", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpPreview").mockImplementation(
      (_id, input) => {
        const preview = createPreview(input.mode);
        const imported = preview.items.find(
          (item) => item.status === "IMPORTED"
        );
        if (!imported) {
          throw new Error("Missing imported fixture");
        }
        return Promise.resolve({
          ...preview,
          items: [
            preview.items[0],
            ...["one", "two"].map((id) => ({
              ...imported,
              id,
              sourceFileName: `${id}.pdf`,
              existingItemId: id,
              existingJobId: "zip-job",
              existingMode: "ZIP" as const,
            })),
          ],
        });
      }
    );
    vi.spyOn(client, "withdrawConfirmationEmpImport")
      .mockResolvedValueOnce(createJob("COMPLETED"))
      .mockRejectedValueOnce(new Error("conflict"));
    await renderArchive(client);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw import" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all imported files" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm withdrawal (2)" })
    );
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Withdraw import" })).getByRole(
        "button",
        { name: "Withdraw import" }
      )
    );
    await waitFor(() =>
      expect(client.withdrawConfirmationEmpImport).toHaveBeenCalledTimes(2)
    );
    expect(client.withdrawConfirmationEmpImport).toHaveBeenNthCalledWith(
      1,
      "project-1",
      "zip-job",
      { mode: "ZIP", scope: "ITEM", itemId: "one" }
    );
    expect(client.withdrawConfirmationEmpImport).toHaveBeenNthCalledWith(
      2,
      "project-1",
      "zip-job",
      { mode: "ZIP", scope: "ITEM", itemId: "two" }
    );
    await waitFor(() =>
      expect(client.confirmationEmpPreview).toHaveBeenCalledTimes(2)
    );
  });

  it("archives eligible responses even when another response artifact is blocked", async () => {
    const client = createClient();
    await renderArchive(client);

    const submit = screen.getByRole("button", { name: "Confirm archive" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(client.createConfirmationEmpImport).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          mode: "FLAT",
          items: [
            expect.objectContaining({
              id: "response-eligible-1",
              empCode: "A1-F001",
            }),
          ],
        })
      )
    );
    expect(submit).toBeDisabled();
    const groupedTab = screen.getByRole("tab", { name: "Create folder" });
    expect(groupedTab).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(groupedTab);
    expect(screen.getByRole("tab", { name: "Flat files" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.click(submit);
    expect(client.createConfirmationEmpImport).toHaveBeenCalledOnce();
    expect(screen.getByDisplayValue("A1-F001")).toBeDisabled();
    expect(screen.getByDisplayValue("Orchid Bank response 1")).toBeDisabled();
  });

  it("reports busy while the create request is still pending", async () => {
    const client = createClient();
    let resolveCreate!: (job: ConfirmationEmpImportJob) => void;
    vi.spyOn(client, "createConfirmationEmpImport").mockImplementation(
      () =>
        new Promise<ConfirmationEmpImportJob>((resolve) => {
          resolveCreate = resolve;
        })
    );
    const onBusyChange = vi.fn();
    await renderArchive(client, vi.fn(), onBusyChange);

    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));

    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    resolveCreate(createJob("QUEUED"));
    await waitFor(() =>
      expect(client.confirmationEmpImportJob).toHaveBeenCalledWith(
        "project-1",
        "job-1"
      )
    );
  });

  it("passes multiple selected confirmations to the preview query", async () => {
    const client = createClient();
    await renderArchive(client, vi.fn(), vi.fn(), [
      "confirmation-1",
      "confirmation-2",
    ]);

    expect(client.confirmationEmpPreview).toHaveBeenCalledWith("project-1", {
      mode: "FLAT",
      targetDirectoryId: "directory-1",
      confirmationIds: ["confirmation-1", "confirmation-2"],
    });
  });

  it("omits source summaries from bulk-import responses", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpPreview").mockImplementation(
      (_projectId, input) => {
        const preview = createPreview(input.mode);
        return Promise.resolve({
          ...preview,
          items: preview.items.map((item, index) => ({
            ...item,
            sourceProposal: {
              sourceConfirmationId: item.confirmationId,
              empCode: `OUT-${index + 1}`,
              businessName: `Outgoing confirmation ${index + 1}`,
            },
          })),
        });
      }
    );

    await renderArchive(client, vi.fn(), vi.fn(), [
      "confirmation-1",
      "confirmation-2",
    ]);

    expect(
      screen.queryByText(
        "CONF-001 · EMP code: OUT-1 · Business name: Outgoing confirmation 1"
      )
    ).not.toBeInTheDocument();
  });

  it("uses shared DataGrid resizing for grouped import columns", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpPreview").mockImplementation(
      (_projectId, input) =>
        Promise.resolve(
          input.mode === "GROUPED"
            ? createThreeItemGroupedPreview()
            : createPreview(input.mode)
        )
    );

    await renderArchive(client);
    fireEvent.click(screen.getByRole("tab", { name: "Create folder" }));

    const header = await screen.findByRole("columnheader", {
      name: "Child code",
    });
    expect(header).toBeVisible();
    // Grouped files have one shared-grid summary, not an extra flat-file heading.
    expect(
      screen.queryByRole("heading", { name: "Files to import" })
    ).toBeNull();
    expect(screen.getAllByText("Folder contents")).toHaveLength(1);
    const resizeHandle = screen.getByRole("separator", {
      name: "Resize Child code column",
    });
    expect(resizeHandle).toHaveAttribute("aria-valuenow", "210");

    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });
    await waitFor(() =>
      expect(resizeHandle).toHaveAttribute("aria-valuenow", "226")
    );
    expect(screen.getByText("HSBC Hong Kong.pdf")).toBeVisible();
  });

  it("preserves the scroll viewport while switching import modes", async () => {
    const client = createClient();
    await renderArchive(client);
    const region = screen.getByTestId("confirmation-emp-import-scroll-region");
    Object.defineProperty(region, "clientHeight", { value: 500 });
    for (const label of ["Create folder", "Combine as ZIP", "Flat files"]) {
      region.scrollTop = 160;
      fireEvent.click(screen.getByRole("tab", { name: label }));
      await waitFor(() => expect(region).toHaveProperty("scrollTop", 160));
      expect(region.firstElementChild).toHaveStyle({ minHeight: "660px" });
    }
  });

  it("uses a sliding mode indicator with a reduced-motion fallback", async () => {
    const client = createClient();
    await renderArchive(client);

    const indicator = screen.getByTestId(
      "confirmation-emp-import-mode-active-indicator"
    );
    expect(indicator).toHaveClass(
      "translate-x-0",
      MATRIX_REDUCED_REVEAL_DURATION_CLASS
    );
    fireEvent.click(screen.getByRole("tab", { name: "Create folder" }));
    expect(indicator).toHaveClass("translate-x-full");
    fireEvent.click(screen.getByRole("tab", { name: "Combine as ZIP" }));
    expect(indicator).toHaveClass("translate-x-[200%]");
  });

  it("supports editable folder and ZIP names without a second preview step", async () => {
    const client = createClient();
    await renderArchive(client);

    fireEvent.click(screen.getByRole("tab", { name: "Create folder" }));
    await expect(screen.findByDisplayValue("A1-B001")).resolves.toBeVisible();
    expect(screen.getByDisplayValue("Confirmation responses")).toBeVisible();
    expect(screen.getByText("Folder code")).toBeVisible();
    expect(screen.getByText("Folder name")).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Combine as ZIP" }));
    await expect(screen.findByDisplayValue("A1-F001")).resolves.toBeVisible();
    expect(
      screen.getByDisplayValue("Confirmation responses.zip")
    ).toBeVisible();
    expect(screen.getByText("ZIP working paper code")).toBeVisible();
    expect(screen.getByText("ZIP file name")).toBeVisible();
    expect(screen.getByDisplayValue("A1-F001.01")).toBeVisible();

    fireEvent.change(screen.getByLabelText("ZIP working paper code"), {
      target: { value: "A1-ZIP009" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() =>
      expect(client.createConfirmationEmpImport).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          mode: "ZIP",
          zipWorkingPaper: {
            code: "A1-ZIP009",
            name: "Confirmation responses.zip",
          },
          items: [expect.objectContaining({ empCode: "A1-ZIP009.01" })],
        })
      )
    );
  });

  it("generates editable ZIP child codes and preserves custom codes when the ZIP code changes", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpPreview").mockImplementation(
      (_projectId, input) =>
        Promise.resolve(
          input.mode === "ZIP"
            ? {
                ...createThreeItemGroupedPreview(),
                mode: "ZIP",
                batchDirectory: null,
                zipWorkingPaper: { code: "1000.1", name: "Responses.zip" },
              }
            : createPreview(input.mode)
        )
    );
    await renderArchive(client);
    fireEvent.click(screen.getByRole("tab", { name: "Combine as ZIP" }));
    await screen.findByDisplayValue("1000.1.01");
    expect(screen.getByDisplayValue("1000.1.02")).toBeVisible();
    expect(screen.getByDisplayValue("1000.1.03")).toBeVisible();
    fireEvent.change(screen.getByDisplayValue("1000.1.02"), {
      target: { value: "CUSTOM.02" },
    });
    fireEvent.change(screen.getByLabelText("ZIP working paper code"), {
      target: { value: "1200.08" },
    });
    expect(screen.getByDisplayValue("1200.08.01")).toBeVisible();
    expect(screen.getByDisplayValue("CUSTOM.02")).toBeVisible();
    expect(screen.getByDisplayValue("1200.08.03")).toBeVisible();
    const thirdCodeInput = screen.getByDisplayValue("1200.08.03");
    fireEvent.change(thirdCodeInput, { target: { value: "" } });
    expect(
      screen.getByRole("button", { name: "Confirm archive" })
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Child code: Bank reply scan.pdf"), {
      target: { value: "1200.08.03" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() =>
      expect(client.createConfirmationEmpImport).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          mode: "ZIP",
          zipWorkingPaper: { code: "1200.08", name: "Responses.zip" },
          items: [
            expect.objectContaining({ empCode: "1200.08.01" }),
            expect.objectContaining({ empCode: "CUSTOM.02" }),
            expect.objectContaining({ empCode: "1200.08.03" }),
          ],
        })
      )
    );
  });

  it("generates editable grouped child codes from the folder code", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpPreview").mockImplementation(
      (_projectId, input) =>
        Promise.resolve(
          input.mode === "GROUPED"
            ? createThreeItemGroupedPreview()
            : createPreview(input.mode)
        )
    );
    await renderArchive(client);

    fireEvent.click(screen.getByRole("tab", { name: "Create folder" }));

    await expect(screen.findByText("Folder contents")).resolves.toBeVisible();
    expect(screen.getByLabelText("Folder contents: 3")).toBeVisible();
    expect(screen.queryByText("1 folder · 3 child working papers")).toBeNull();
    expect(
      screen.queryByText(
        "Child codes are generated from the folder code and can be edited before archiving."
      )
    ).toBeNull();
    expect(
      screen.getByRole("columnheader", { name: "Child code" })
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "File name" })
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Validation" })
    ).toBeVisible();
    expect(screen.getByText("HSBC Hong Kong.pdf")).toBeVisible();
    expect(screen.getByText("Standard Chartered.pdf")).toBeVisible();
    expect(screen.getByText("Bank reply scan.pdf")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Folder code"), {
      target: { value: "1200.08" },
    });
    expect(screen.getByDisplayValue("1200.08.01")).toBeVisible();
    expect(screen.getByDisplayValue("1200.08.02")).toBeVisible();
    expect(screen.getByDisplayValue("1200.08.03")).toBeVisible();

    fireEvent.change(screen.getByDisplayValue("1200.08.02"), {
      target: { value: "CUSTOM.02" },
    });
    fireEvent.change(screen.getByLabelText("Folder code"), {
      target: { value: "1300.08" },
    });
    expect(screen.getByDisplayValue("1300.08.01")).toBeVisible();
    expect(screen.getByDisplayValue("CUSTOM.02")).toBeVisible();
    expect(screen.getByDisplayValue("1300.08.03")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() =>
      expect(client.createConfirmationEmpImport).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          mode: "GROUPED",
          batchDirectory: {
            code: "1300.08",
            name: "Confirmation responses",
          },
          items: [
            expect.objectContaining({ empCode: "1300.08.01" }),
            expect.objectContaining({ empCode: "CUSTOM.02" }),
            expect.objectContaining({ empCode: "1300.08.03" }),
          ],
        })
      )
    );
  });

  it("blocks empty child fields and identifies duplicate codes for automatic rename", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpPreview").mockImplementation(
      (_projectId, input) =>
        Promise.resolve(
          input.mode === "GROUPED"
            ? createThreeItemGroupedPreview()
            : createPreview(input.mode)
        )
    );
    await renderArchive(client);

    fireEvent.click(screen.getByRole("tab", { name: "Create folder" }));
    await screen.findByText("Folder contents");
    const submit = screen.getByRole("button", { name: "Confirm archive" });
    expect(submit).toBeEnabled();

    fireEvent.change(await screen.findByDisplayValue("A1-B001.01"), {
      target: { value: "" },
    });
    expect(screen.getByText("Code and name are required")).toBeVisible();
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getAllByRole("textbox")[2], {
      target: { value: "A1-B001.02" },
    });
    expect(screen.getAllByText("Will be renamed automatically")).toHaveLength(
      2
    );
    expect(submit).toBeEnabled();
  });

  it("allows deeply nested project directories", async () => {
    const client = createClient();
    vi.spyOn(client, "workflow").mockResolvedValue([
      {
        id: "root",
        parentId: null,
        code: "A",
        title: "Planning",
        level: 1,
        nodeType: "PHASE",
        workingPapers: [],
        children: [
          {
            id: "deep",
            parentId: "root",
            code: "A1-1000",
            title: "Cash",
            level: 4,
            nodeType: "PHASE",
            workingPapers: [],
            children: [],
          },
        ],
      },
    ]);
    await renderArchive(client);

    fireEvent.click(
      screen.getByRole("combobox", { name: "Workflow directory" })
    );
    await expect(
      screen.findByRole("option", { name: /Planning \/ Cash/ })
    ).resolves.toBeVisible();
  });

  it("reports completion after the background archive job finishes", async () => {
    const client = createClient();
    const onBusyChange = vi.fn();
    const onCompleted = await renderArchive(client, vi.fn(), onBusyChange);
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));

    await waitFor(() =>
      expect(client.confirmationEmpImportJob).toHaveBeenCalledWith(
        "project-1",
        "job-1"
      )
    );
    await waitFor(
      () =>
        expect(onCompleted).toHaveBeenCalledWith(
          expect.objectContaining({ status: "COMPLETED" })
        ),
      { timeout: 5000 }
    );
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(
      screen.getByRole("dialog", { name: "Archive completed" })
    ).toBeVisible();
    expect(screen.getByText("Successfully archived 1 file(s).")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Archive completed" })
      ).not.toBeInTheDocument()
    );
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("opens the project from the completion dialog", async () => {
    const client = createClient();
    const onViewProject = vi.fn();
    await renderArchive(client, vi.fn(), vi.fn(), undefined, onViewProject);
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    await screen.findByRole("dialog", { name: "Archive completed" });
    fireEvent.click(screen.getByRole("button", { name: "View in project" }));
    expect(onViewProject).toHaveBeenCalledOnce();
    expect(window.history.state.confirmationArchiveView).toMatchObject({
      projectId: "project-1",
      confirmationIds: ["confirmation-1"],
      targetDirectoryId: directory.id,
    });
  });

  it("reports partial completion so successful files appear immediately", async () => {
    const client = createClient();
    vi.spyOn(client, "confirmationEmpImportJob").mockResolvedValue(
      createJob("PARTIAL_FAILURE")
    );
    const onCompleted = await renderArchive(client);
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));

    await waitFor(
      () =>
        expect(onCompleted).toHaveBeenCalledWith(
          expect.objectContaining({ status: "PARTIAL_FAILURE" })
        ),
      { timeout: 5000 }
    );
  });
});
