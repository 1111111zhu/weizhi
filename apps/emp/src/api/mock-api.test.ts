import { DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE } from "@project-wing/shared";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkflowNode } from "./client";
import { mockApi } from "./mock-api";
import { defaultWorkflow, initialState } from "./mock-data";
import type { MockState } from "./mock-types";

const MOCK_API_SLOW_TEST_TIMEOUT_MS = 60_000;

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected mock API fixture value to be present");
  }
  return value;
}

function findTestWorkflowNode(
  nodes: WorkflowNode[],
  nodeId: string
): WorkflowNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    const childNode = findTestWorkflowNode(node.children ?? [], nodeId);
    if (childNode) {
      return childNode;
    }
  }
  return null;
}

class TestLocalStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

function installPreviewStorage() {
  const localStorageMock = new TestLocalStorage();
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", {
    localStorage: localStorageMock,
    location: { origin: "http://localhost:3001" },
  });
}

async function createPublishedProjectTemplate() {
  await mockApi.login("admin@projectwing.local", "anything");
  const template = await mockApi.createProjectTemplate({
    code: `TM-${Date.now()}`,
    name: "Cash audit template",
    language: "zh-CN",
    frameworkTemplateId: "framework-cas",
    status: "DRAFT",
  });
  const phase = await mockApi.createProjectTemplateNode(template.id, {
    code: "Planning",
    title: "Planning",
  });
  const account = await mockApi.createProjectTemplateNode(template.id, {
    parentId: phase.id,
    code: "A1",
    title: "Cash",
  });
  const folder = await mockApi.createProjectTemplateNode(template.id, {
    parentId: account.id,
    code: "A1-1000",
    title: "Cash",
  });
  const file = await mockApi.uploadProjectTemplateFile(
    template.id,
    folder.id,
    {},
    new File(["cash"], "cash-lead-schedule.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
  await mockApi.updateProjectTemplate(template.id, { status: "PUBLISHED" });
  return { template, file };
}

async function createPublishedRequiredSmartFormVersion() {
  await mockApi.login("admin@projectwing.local", "anything");
  const template = await mockApi.createSmartFormTemplate({
    code: `SF-${Date.now()}`,
    name: "Required Smart Form",
    frameworkTemplateId: "framework-hkfrs",
    definition: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
  });
  const published = await mockApi.publishSmartFormTemplate(template.id);
  expect(published.currentPublishedVersion).toBeTruthy();
  return published.currentPublishedVersion;
}

async function createConfirmationDraft() {
  await mockApi.login("partner@projectwing.local", "anything");
  const projectId = "project-orchid-2026";
  const confirmation = await mockApi.createProjectConfirmation(projectId, {
    draftTemplateCode: "PRC_BANK_TEMPLATE_1",
    draftPayload: { bankName: "Replay Bank" },
  });
  return { projectId, confirmation };
}

describe("mock API behavior", () => {
  beforeEach(() => {
    installPreviewStorage();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("describes the current user's review question as opened by them", async () => {
    await mockApi.login("partner@projectwing.local", "anything");

    const result = await mockApi.workItems({
      view: "PERSONAL",
      scope: "PROJECT",
      projectId: "project-orchid-2026",
      locale: "zh-CN",
    });
    const question = result.items.find((item) => item.ruleId === "PRJ-005");

    expect(question?.title).toContain("你在文件 A1-1000-F001");
    expect(question?.title).toContain("发起的复核问题");
    expect(question?.title).not.toContain("发起人为");
    expect(question?.description).toBe("这是你发起且尚未关闭的复核问题");
  });

  it("logs in preview users and returns the current user", async () => {
    const login = await mockApi.login("admin@projectwing.local", "anything");
    const me = await mockApi.me();

    expect(login.globalRole).toBe("SUPER_ADMIN");
    expect(login.declarationAccepted).toBeTruthy();
    expect(me.email).toBe("admin@projectwing.local");
  });

  it("returns eligible project invitees with search, rank, exclusions, and pagination", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const firstPage = await mockApi.projectInvitees({
      browseAll: true,
      page: 1,
      pageSize: 2,
    });

    expect(firstPage.total).toBeGreaterThan(2);
    expect(firstPage.users).toHaveLength(2);
    expect(firstPage.totalPages).toBeGreaterThan(1);

    const staff = await mockApi.projectInvitees({
      browseAll: true,
      globalRole: "STAFF",
      page: 1,
      pageSize: 10,
    });
    expect(staff.users).not.toHaveLength(0);
    expect(
      staff.users.every((user) => user.globalRole === "STAFF")
    ).toBeTruthy();

    const searched = await mockApi.projectInvitees({
      q: staff.users[0].name,
      excludeUserIds: [staff.users[0].id],
    });
    expect(searched.users).toStrictEqual([]);
  });

  it("requires a two-character search unless a Partner opens the full list", async () => {
    await mockApi.login("staff@projectwing.local", "anything");

    await expect(mockApi.projectInvitees({ q: "a" })).rejects.toThrow(
      "Enter at least two letters"
    );
    await expect(mockApi.projectInvitees({ browseAll: true })).rejects.toThrow(
      "Only Partners"
    );
  });

  it("previews the original content of an uploaded attachment", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const [project] = await mockApi.projects();
    const workflow = await mockApi.workflow(project.id);
    const node = requireValue(workflow[0]?.children?.[0]?.children?.[0]);

    const paper = await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: node.id,
      code: "A1-1000-F001",
      title: "Uploaded preview test",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });
    const source = "%PDF-1.7\n% uploaded preview content\n";
    const attachment = await mockApi.uploadWorkingPaperAttachment(
      project.id,
      paper.id,
      new File([source], "uploaded-preview.pdf", { type: "application/pdf" })
    );
    const preview = await mockApi.previewAttachmentContent(
      project.id,
      attachment.id
    );

    await expect(preview.text()).resolves.toBe(source);
  });

  it("copies an unfilled placeholder without promoting it to version one", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const [project] = await mockApi.projects();
    const workflow = await mockApi.workflow(project.id);
    const node = requireValue(workflow[0]?.children?.[0]?.children?.[0]);
    const paper = await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: node.id,
      code: `PH-${Date.now()}`,
      title: "Placeholder source",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });
    const placeholder = await mockApi.createAttachmentPlaceholder(
      project.id,
      paper.id,
      { name: "Audit report", placeholderType: "WORD" }
    );
    const copied = await mockApi.copyAttachment(project.id, placeholder.id, {
      workflowNodeId: node.id,
      bucket: "CURRENT",
    });

    expect(copied).toStrictEqual(
      expect.objectContaining({
        placeholderType: "WORD",
        version: 0,
        headVersionId: null,
        fileUrl: "",
      })
    );
  });

  it("updates a placeholder refcode together with its linked working paper", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const [project] = await mockApi.projects();
    const [root] = await mockApi.workflow(project.id);
    const node = requireValue(root?.children?.[0]?.children?.[0]);
    const paper = await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: node.id,
      code: "A01-0001",
      title: "Placeholder source",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });
    const placeholder = await mockApi.createAttachmentPlaceholder(
      project.id,
      paper.id,
      {
        name: "Audit report",
        placeholderType: "WORD",
      }
    );

    await expect(
      mockApi.updateAttachmentIdentity(project.id, placeholder.id, {
        code: "A01-0002",
      })
    ).resolves.toStrictEqual(expect.objectContaining({ code: "A01-0002" }));

    const updatedPaper = requireValue(
      findTestWorkflowNode(
        await mockApi.workflow(project.id),
        node.id
      )?.workingPapers.find((item) => item.id === paper.id)
    );
    expect(updatedPaper).toStrictEqual(
      expect.objectContaining({
        code: "A01-0002",
        attachments: expect.arrayContaining([
          expect.objectContaining({ id: placeholder.id, code: "A01-0002" }),
        ]),
      })
    );
  });

  it("returns a valid XLSX blob for the preview workbook", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const attachments = await mockApi.projectAttachments("project-orchid-2026");
    const attachment = requireValue(
      attachments.find((item) => item.fileName.endsWith(".xlsx"))
    );
    const blob = await mockApi.downloadAttachment(
      "project-orchid-2026",
      attachment.id
    );

    expect(new Uint8Array(await blob.arrayBuffer()).slice(0, 4)).toStrictEqual(
      new Uint8Array([80, 75, 3, 4])
    );
  });

  it("returns a valid PDF blob for the preview document", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const attachments = await mockApi.projectAttachments("project-orchid-2026");
    const attachment = requireValue(
      attachments.find((item) => item.fileName.endsWith(".pdf"))
    );
    const blob = await mockApi.downloadAttachment(
      "project-orchid-2026",
      attachment.id
    );

    expect(blob.type).toBe("application/pdf");
    await expect(blob.text()).resolves.toMatch(/^%PDF-/);
  });

  it("returns a browser Blob when exporting through the mock API", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const attachments = await mockApi.projectAttachments("project-orchid-2026");
    const attachment = requireValue(
      attachments.find((item) => item.fileName.endsWith(".xlsx"))
    );
    const blob = await mockApi.exportAttachment(
      "project-orchid-2026",
      attachment.id,
      "zip"
    );

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/zip");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const files = Object.values(zip.files).filter((entry) => !entry.dir);

    expect(files).toHaveLength(1);
    const exportedFile = requireValue(files[0]);
    expect(exportedFile.name).toBe(
      `Mock Project/Unassigned/${attachment.fileName}`
    );
    await expect(exportedFile.async("text")).resolves.toContain(attachment.id);
  });

  it("preserves recursive folders in a mock folder export", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const [root] = await mockApi.workflow("project-orchid-2026");
    const projectRoot = "AUD-2026-0001 - Orchid Holdings 2026 audit";
    const job = await mockApi.createProjectFileExportJob(
      "project-orchid-2026",
      {
        scope: "WORKFLOW_NODE",
        workflowNodeId: root.id,
        bucket: "CURRENT",
      }
    );
    expect(job.status).toBe("COMPLETED");
    await expect(
      mockApi.activeProjectFileExportJob("project-orchid-2026")
    ).resolves.toBeNull();
    const blob = await mockApi.downloadProjectFileExportJob(
      "project-orchid-2026",
      job.id
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    expect(zip.files[`${projectRoot}/${root.code}/`]).toBeDefined();
    for (const child of root.children ?? []) {
      expect(
        zip.files[`${projectRoot}/${root.code}/${child.code}/`]
      ).toBeDefined();
    }
  });

  it("includes every selected attachment in a mock multi-file ZIP", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const attachments = await mockApi.projectAttachments("project-orchid-2026");
    const firstBucket = attachments[0]?.bucket ?? "CURRENT";
    const selected = attachments
      .filter((attachment) => (attachment.bucket ?? "CURRENT") === firstBucket)
      .slice(0, 2);
    expect(selected).toHaveLength(2);

    const job = await mockApi.createProjectFileExportJob(
      "project-orchid-2026",
      {
        scope: "ATTACHMENTS",
        attachmentIds: [selected[0].id, selected[0].id, selected[1].id],
      }
    );
    const blob = await mockApi.downloadProjectFileExportJob(
      "project-orchid-2026",
      job.id
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const files = Object.values(zip.files).filter((entry) => !entry.dir);

    expect(job.totalFiles).toBe(2);
    expect(files).toHaveLength(2);
    const contents = await Promise.all(files.map((file) => file.async("text")));
    for (const attachment of selected) {
      expect(
        contents.some((content) => content.includes(attachment.id))
      ).toBeTruthy();
    }
  });

  it("rejects a mock multi-file export when any selected attachment is unavailable", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const [attachment] = await mockApi.projectAttachments(
      "project-orchid-2026"
    );

    await expect(
      mockApi.createProjectFileExportJob("project-orchid-2026", {
        scope: "ATTACHMENTS",
        attachmentIds: [attachment.id, "missing-attachment"],
      })
    ).rejects.toMatchObject({ code: "EXPORT_ATTACHMENT_NOT_FOUND" });
  });

  it("includes mock attachments mounted directly on a workflow folder", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    await mockApi.workflow("project-orchid-2026");
    const state = JSON.parse(
      requireValue(localStorage.getItem("project-wing-preview-state"))
    ) as MockState;
    const root = requireValue(state.workflows["project-orchid-2026"][0]);
    const rootChildren = requireValue(root.children);
    const folder = requireValue(rootChildren[0]?.children?.[0]);
    const paper = requireValue(
      folder.workingPapers.find((item) => item.attachments?.length)
    );
    const attachment = requireValue(paper.attachments?.shift());
    const directAttachment = {
      ...attachment,
      id: "mock-direct-node-export",
      workflowNodeId: folder.id,
    };
    folder.attachments = [directAttachment];
    localStorage.setItem("project-wing-preview-state", JSON.stringify(state));

    const job = await mockApi.createProjectFileExportJob(
      "project-orchid-2026",
      {
        scope: "WORKFLOW_NODE",
        workflowNodeId: folder.id,
        bucket: directAttachment.bucket ?? "CURRENT",
      }
    );
    const blob = await mockApi.downloadProjectFileExportJob(
      "project-orchid-2026",
      job.id
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const exportedFiles = Object.values(zip.files).filter(
      (entry) => !entry.dir
    );
    const refCode = requireValue(directAttachment.code ?? paper.code);
    const exportedEntries = await Promise.all(
      exportedFiles.map(async (entry) => ({
        name: entry.name,
        content: await entry.async("text"),
      }))
    );
    const directEntry = exportedEntries.find((entry) =>
      entry.content.includes(directAttachment.id)
    );
    expect(directEntry?.name).toContain(
      `AUD-2026-0001 - Orchid Holdings 2026 audit/${root.code}/${rootChildren[0].code}/${folder.code}/`
    );
    expect(directEntry?.name).toContain(`/${refCode} `);
  });

  it("bundles a valid DOCX blob with the default preview project", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const attachments = await mockApi.projectAttachments("project-orchid-2026");
    const attachment = requireValue(
      attachments.find(
        (item) => item.originalName === "Preview bank confirmation.docx"
      )
    );
    expect(attachment).toMatchObject({
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const blob = await mockApi.previewAttachmentContent(
      "project-orchid-2026",
      attachment.id
    );

    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(new Uint8Array(await blob.arrayBuffer()).slice(0, 4)).toStrictEqual(
      new Uint8Array([80, 75, 3, 4])
    );
  });

  it("bundles CSV preview data with the project fixtures", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const attachments = await mockApi.projectAttachments("project-orchid-2026");
    const attachment = requireValue(
      attachments.find((item) => item.fileName.endsWith(".csv"))
    );
    expect(attachment).toMatchObject({
      mimeType: "text/csv",
      originalName: "Cash exceptions.csv",
    });

    const blob = await mockApi.previewAttachmentContent(
      "project-orchid-2026",
      attachment.id
    );

    expect(blob.type).toBe("text/csv");
    await expect(blob.text()).resolves.toContain("Cash,1200,Exception");
  });

  it("returns the original PPTX upload content", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const [project] = await mockApi.projects();
    const [root] = await mockApi.workflow(project.id);
    const node = await mockApi.createWorkflowNode(project.id, {
      parentId: root.id,
      code: `PPTX-${Date.now()}`,
      title: "PPTX preview folder",
    });
    const paper = await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: node.id,
      code: `PPTX-${Date.now()}`,
      title: "PPTX preview paper",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });
    const attachment = await mockApi.uploadWorkingPaperAttachment(
      project.id,
      paper.id,
      new File(["presentation"], "preview.pptx", {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      })
    );
    const blob = await mockApi.downloadAttachment(project.id, attachment.id);

    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    await expect(blob.text()).resolves.toBe("presentation");
  });

  it("keeps engagements available for multiple new projects", async () => {
    const all = await mockApi.cmpEngagements({
      q: "ORCHID",
      status: "ACTIVE",
    });
    const available = await mockApi.cmpEngagements({
      q: "ORCHID",
      status: "ACTIVE",
      availableForProject: true,
    });

    expect(
      all.engagements.map((engagement) => engagement.engagementCode)
    ).toContain("ORCHID-2026-AUD");
    expect(
      available.engagements.map((engagement) => engagement.engagementCode)
    ).toContain("ORCHID-2026-AUD");
  });

  it("keeps manual and generated project codes independent of the same CMP engagement in preview mode", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const { engagements } = await mockApi.cmpEngagements({
      q: "ORCHID",
      status: "ACTIVE",
    });
    const [engagement] = engagements;
    const input = {
      name: "Independent code preview",
      language: "zh-CN" as const,
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
      cmpClientId: engagement.clientId,
      cmpEngagementId: engagement.id,
    };
    const manual = await mockApi.createProject({
      ...input,
      projectCode: "USER-ORCHID-001",
    });
    const generated = await mockApi.createProject(input);
    expect(manual.projectCode).toBe("USER-ORCHID-001");
    expect(generated.projectCode).toMatch(/^DUMMY-EMP-\d+$/);
    expect(generated.projectCode).not.toBe(engagement.engagementCode);
    expect(manual.cmpEngagementId).toBe(engagement.id);
  });

  it("does not synthesize authoritative confirmation codes in the client mock", async () => {
    const { confirmation } = await createConfirmationDraft();

    expect(confirmation.confirmationCode).toBeNull();
  });

  it("hydrates older preview state before creating project templates", async () => {
    const legacyState = { ...initialState };
    delete (legacyState as Partial<typeof initialState>).projectTemplates;
    localStorage.setItem(
      "project-wing-preview-state",
      JSON.stringify(legacyState)
    );
    await mockApi.login("admin@projectwing.local", "anything");

    await expect(
      mockApi.createProjectTemplate({
        code: "LEGACY-TEMPLATE",
        name: "Legacy template",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
        status: "DRAFT",
      })
    ).resolves.toStrictEqual(
      expect.objectContaining({ code: "LEGACY-TEMPLATE" })
    );
  });

  it("returns uploaded project template file content for preview", async () => {
    const { template, file } = await createPublishedProjectTemplate();

    const blob = await mockApi.previewProjectTemplateFile(template.id, file.id);

    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    await expect(blob.text()).resolves.toBe("cash");
  });

  it("replays only the same active submission key without exposing it", async () => {
    const { projectId, confirmation } = await createConfirmationDraft();
    const draftUpdatedAt = requireValue(confirmation.draftUpdatedAt);
    const firstKey = "00000000-0000-4000-8000-000000000001";
    const submitted = await mockApi.submitProjectConfirmation(
      projectId,
      confirmation.id,
      {
        expectedDraftUpdatedAt: draftUpdatedAt,
        idempotencyKey: firstKey,
      }
    );
    const replayed = await mockApi.submitProjectConfirmation(
      projectId,
      confirmation.id,
      {
        expectedDraftUpdatedAt: draftUpdatedAt,
        idempotencyKey: firstKey,
      }
    );

    expect(replayed.currentArtifactId).toBe(submitted.currentArtifactId);
    expect(replayed.currentArtifact).not.toHaveProperty("submissionKey");
    expect(replayed.currentArtifact).not.toHaveProperty("docxObjectKey");
    expect(replayed.currentArtifact).not.toHaveProperty("structuredSnapshot");
    await expect(
      mockApi.submitProjectConfirmation(projectId, confirmation.id, {
        expectedDraftUpdatedAt: draftUpdatedAt,
        idempotencyKey: "00000000-0000-4000-8000-000000000003",
      })
    ).rejects.toMatchObject({ code: "CONFIRMATION_STATE_CONFLICT" });
  });

  it("compares draft timestamps by instant like the live API", async () => {
    const { projectId, confirmation } = await createConfirmationDraft();
    const draftUpdatedAt = requireValue(confirmation.draftUpdatedAt);
    const idempotencyKey = "00000000-0000-4000-8000-000000000001";
    const equivalentTimestamp = draftUpdatedAt.replace("Z", "+00:00");

    await expect(
      mockApi.submitProjectConfirmation(projectId, confirmation.id, {
        expectedDraftUpdatedAt: equivalentTimestamp,
        idempotencyKey,
      })
    ).resolves.toMatchObject({ status: "PREPARED" });

    await expect(
      mockApi.submitProjectConfirmation(projectId, confirmation.id, {
        expectedDraftUpdatedAt: equivalentTimestamp,
        idempotencyKey,
      })
    ).resolves.toMatchObject({ status: "PREPARED" });
  });

  it("keeps historical artifacts across withdrawal and resubmission", async () => {
    const { projectId, confirmation } = await createConfirmationDraft();
    const draftUpdatedAt = requireValue(confirmation.draftUpdatedAt);
    const firstKey = "00000000-0000-4000-8000-000000000001";
    const secondKey = "00000000-0000-4000-8000-000000000003";
    await mockApi.submitProjectConfirmation(projectId, confirmation.id, {
      expectedDraftUpdatedAt: draftUpdatedAt,
      idempotencyKey: firstKey,
    });
    await mockApi.withdrawProjectConfirmation(projectId, confirmation.id, {
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      reason: "Correct recipient",
    });

    await expect(
      mockApi.submitProjectConfirmation(projectId, confirmation.id, {
        expectedDraftUpdatedAt: draftUpdatedAt,
        idempotencyKey: firstKey,
      })
    ).rejects.toMatchObject({ code: "CONFIRMATION_STATE_CONFLICT" });

    const resubmitted = await mockApi.submitProjectConfirmation(
      projectId,
      confirmation.id,
      {
        expectedDraftUpdatedAt: draftUpdatedAt,
        idempotencyKey: secondKey,
      }
    );
    const state = JSON.parse(
      requireValue(localStorage.getItem("project-wing-preview-state"))
    ) as {
      confirmationArtifacts: Record<
        string,
        {
          submissionKey: string;
          artifact: { version: number; invalidationReason?: string | null };
        }[]
      >;
    };

    expect(resubmitted.submissionVersion).toBe(2);
    expect(state.confirmationArtifacts[confirmation.id]).toHaveLength(2);
    expect(state.confirmationArtifacts[confirmation.id]?.[0]).toMatchObject({
      submissionKey: firstKey,
      artifact: {
        version: 1,
        invalidationReason: "SUPERSEDED_BY_VERSION_2",
      },
    });
    expect(resubmitted).not.toHaveProperty("confirmationArtifacts");
    expect(resubmitted.currentArtifact).not.toHaveProperty("submissionKey");
  });

  it("requires an active artifact disposition for mock withdrawal", async () => {
    const { projectId, confirmation } = await createConfirmationDraft();
    const draftUpdatedAt = requireValue(confirmation.draftUpdatedAt);
    await mockApi.submitProjectConfirmation(projectId, confirmation.id, {
      expectedDraftUpdatedAt: draftUpdatedAt,
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });
    const state = JSON.parse(
      requireValue(localStorage.getItem("project-wing-preview-state"))
    );
    const storedConfirmation = state.confirmations[projectId].find(
      (item: { id: string }) => item.id === confirmation.id
    );
    storedConfirmation.currentArtifact.disposition = "INVALIDATED";
    localStorage.setItem("project-wing-preview-state", JSON.stringify(state));

    await expect(
      mockApi.withdrawProjectConfirmation(projectId, confirmation.id, {
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
        reason: "Should conflict",
      })
    ).rejects.toMatchObject({ code: "CONFIRMATION_STATE_CONFLICT" });
  });

  it("hydrates older preview state with prior and temporary files while preserving code-only group titles", async () => {
    const staleWorkflow = structuredClone(defaultWorkflow) as WorkflowNode[];
    const staleAccount = findTestWorkflowNode(staleWorkflow, "node-a1");
    if (staleAccount) {
      staleAccount.title = "A1";
    }
    const staleHarborWorkflow = structuredClone(
      initialState.workflows["project-harbor-2026"]
    ) as WorkflowNode[];
    const staleHarborAccount = findTestWorkflowNode(
      staleHarborWorkflow,
      "node-a1"
    );
    if (staleHarborAccount) {
      staleHarborAccount.title = "A1";
    }
    const legacyState = {
      ...initialState,
      workflows: {
        ...initialState.workflows,
        "project-orchid-2026": staleWorkflow,
        "project-harbor-2026": staleHarborWorkflow,
      },
    };
    localStorage.setItem(
      "project-wing-preview-state",
      JSON.stringify(legacyState)
    );

    const workflow = await mockApi.workflow("project-orchid-2026");
    const accountNode = findTestWorkflowNode(workflow, "node-a1");
    const cashNode = findTestWorkflowNode(workflow, "node-a1-1000");
    const tempNode = findTestWorkflowNode(workflow, "node-a2");

    expect(accountNode).toStrictEqual(
      expect.objectContaining({
        code: "A1",
        title: "A1",
      })
    );
    expect(cashNode?.workingPapers).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mock-paper-prior-cash",
          bucket: "PRIOR",
        }),
      ])
    );
    expect(tempNode?.workingPapers).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mock-paper-temp-request-list",
          bucket: "TEMPORARY",
        }),
      ])
    );

    const harborWorkflow = await mockApi.workflow("project-harbor-2026");
    expect(findTestWorkflowNode(harborWorkflow, "node-a1")).toStrictEqual(
      expect.objectContaining({
        code: "A1",
        title: "A1",
      })
    );
  });

  it("normalizes existing preview workflow code sequences without duplicates", async () => {
    const legacyPhase = {
      id: "legacy-phase",
      parentId: null,
      code: "Planning",
      title: "Planning",
      level: 1,
      nodeType: "PHASE",
      workingPapers: [],
      children: [
        {
          id: "legacy-node-a4",
          parentId: "legacy-phase",
          code: "A4",
          title: "A4",
          level: 2,
          nodeType: "ACCOUNT",
          workingPapers: [
            {
              id: "legacy-paper-f004",
              projectId: "project-orchid-2026",
              workflowNodeId: "legacy-node-a4",
              code: "A4-F004",
              title: "A4-F004",
              paperType: "WORKING_PAPER",
              bucket: "CURRENT",
              attachments: [],
            },
            {
              id: "legacy-paper-f005",
              projectId: "project-orchid-2026",
              workflowNodeId: "legacy-node-a4",
              code: "A4-F005",
              title: "A4-F005",
              paperType: "WORKING_PAPER",
              bucket: "CURRENT",
              attachments: [],
            },
          ],
          children: [
            {
              id: "legacy-node-a4-4000",
              parentId: "legacy-node-a4",
              code: "A4-4000",
              title: "A4-4000",
              level: 3,
              nodeType: "WORKING_PAPER",
              workingPapers: [],
              children: [],
            },
            {
              id: "legacy-node-a4-5000",
              parentId: "legacy-node-a4",
              code: "A4-5000",
              title: "A4-5000",
              level: 3,
              nodeType: "WORKING_PAPER",
              workingPapers: [],
              children: [],
            },
          ],
        },
        {
          id: "legacy-node-a5",
          parentId: "legacy-phase",
          code: "A5",
          title: "A5",
          level: 2,
          nodeType: "ACCOUNT",
          workingPapers: [],
          children: [],
        },
      ],
    } as WorkflowNode;
    localStorage.setItem(
      "project-wing-preview-state",
      JSON.stringify({
        ...initialState,
        workflows: {
          ...initialState.workflows,
          "project-orchid-2026": [legacyPhase],
        },
      })
    );

    const workflow = await mockApi.workflow("project-orchid-2026");

    expect(workflow[0]?.children?.[0]).toStrictEqual(
      expect.objectContaining({ code: "A5", title: "A5" })
    );
    expect(workflow[0]?.children?.[1]).toStrictEqual(
      expect.objectContaining({ code: "A6", title: "A6" })
    );
    expect(
      workflow[0]?.children?.[0]?.children?.map((node) => node.code)
    ).toStrictEqual(["A5-5000", "A5-6000"]);
    expect(
      workflow[0]?.children?.[0]?.workingPapers.map((paper) => paper.code)
    ).toStrictEqual(["A5-F005", "A5-F006"]);
    expect(workflow[0]?.children?.[0]?.workingPapers[0]).toStrictEqual(
      expect.objectContaining({ code: "A5-F005", title: "A5-F005" })
    );
  });

  it("updates preview system declaration state for the current user", async () => {
    await mockApi.login("staff@projectwing.local", "anything");

    await expect(mockApi.me()).resolves.toStrictEqual(
      expect.objectContaining({ declarationAccepted: false })
    );

    await mockApi.acceptDeclaration();

    await expect(mockApi.me()).resolves.toStrictEqual(
      expect.objectContaining({
        declarationAccepted: true,
        declarationAcceptedAt: expect.any(String),
      })
    );
  });

  it("creates workspaces and projects without a backend", async () => {
    const workspace = await mockApi.createWorkspace({
      name: "Preview Client",
      clientName: "Preview Limited",
      description: "Client demo",
    });
    const project = await mockApi.createProject({
      folderId: undefined,
      name: "Preview Limited audit",
      projectCode: "PREVIEW-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });

    expect(project.workspaceId).toBe(workspace.id);
    await expect(mockApi.workflow(project.id)).resolves.toHaveLength(3);
  });

  it("adds the CMP engagement PIC and MIC to preview projects", async () => {
    await mockApi.login("partner@projectwing.local", "anything");

    const project = await mockApi.createProject({
      folderId: undefined,
      name: "Orchid engagement project",
      cmpClientId: "cmp-client-orchid",
      cmpEngagementId: "cmp-engagement-orchid-audit-2026",
      language: "en-US",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });

    expect(project.members).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user: expect.objectContaining({ id: "user-partner" }),
          projectRole: "PARTNER",
          inChargeRole: "PARTNER_IN_CHARGE",
        }),
        expect.objectContaining({
          user: expect.objectContaining({ id: "user-manager" }),
          projectRole: "REVIEWER",
          inChargeRole: "MANAGER_IN_CHARGE",
        }),
      ])
    );
  });

  it("normalizes SME template names when creating preview projects", async () => {
    await mockApi.login("admin@projectwing.local", "anything");
    const template = await mockApi.createProjectTemplate({
      code: `SME-${Date.now()}`,
      name: "SME template",
      language: "zh-CN",
      frameworkTemplateId: "framework-cas",
      status: "DRAFT",
    });
    const phaseCodes = ["A", "B", "C", "D", "E", "F", "G"];
    let executionNodeId = "";
    for (const code of phaseCodes) {
      const node = await mockApi.createProjectTemplateNode(template.id, {
        code,
        title: code,
      });
      if (code === "C") {
        executionNodeId = node.id;
      }
    }
    await mockApi.createProjectTemplateNode(template.id, {
      parentId: executionNodeId,
      code: "C1",
      title: "C - Cash and cash equivalents",
    });
    await mockApi.updateProjectTemplate(template.id, { status: "PUBLISHED" });
    await mockApi.login("partner@projectwing.local", "anything");

    const project = await mockApi.createProject({
      name: "SME preview audit",
      projectCode: "SME-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-cas",
      projectTemplateId: template.id,
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });
    const workflow = await mockApi.workflow(project.id);

    expect(
      workflow.map((node) => `${node.code} - ${node.title}`)
    ).toStrictEqual([
      "A - Planning",
      "B - General Procedures",
      "C - Execution",
      "D - Reporting",
      "E - Completion",
      "F - Continued Connected Transactions (CCT)",
      "G - Other Audit Programmes",
    ]);
    expect(workflow[2]?.children?.[0]).toStrictEqual(
      expect.objectContaining({
        code: "C1",
        title: "Cash and cash equivalents",
      })
    );
  });

  it("normalizes imported SME template folders that stored names as root codes", async () => {
    await mockApi.login("admin@projectwing.local", "anything");
    const template = await mockApi.createProjectTemplate({
      code: `SME-LIVE-${Date.now()}`,
      name: "SME live template",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      status: "DRAFT",
    });
    const rootInputs = [
      "Planning",
      "General Procedures",
      "Execution",
      "Reporting",
      "Completion",
      "Continued Connected Transactions (CCT)",
      "Other Audit Programmes",
    ];
    let executionNodeId = "";
    let planningNodeId = "";
    for (const code of rootInputs) {
      const node = await mockApi.createProjectTemplateNode(template.id, {
        code,
        title: "新阶段",
      });
      if (code === "Planning") {
        planningNodeId = node.id;
      }
      if (code === "Execution") {
        executionNodeId = node.id;
      }
    }
    const planningChildren = [
      "A1 - Client acceptance or continuance",
      "A2 - Engagement letter",
      "A3 - Understanding the entity and its environment",
      "A5 - Planning materiality",
      "A6 - Audit planning programme",
    ];
    for (const code of planningChildren) {
      await mockApi.createProjectTemplateNode(template.id, {
        parentId: planningNodeId,
        code,
        title: code.split(" - ")[0] ?? code,
      });
    }
    await mockApi.createProjectTemplateNode(template.id, {
      parentId: executionNodeId,
      code: "C-Cash and cash equivalents",
      title: "C-Cash and cash equivalents",
    });
    await mockApi.updateProjectTemplate(template.id, { status: "PUBLISHED" });
    await mockApi.login("partner@projectwing.local", "anything");

    const project = await mockApi.createProject({
      name: "SME live preview audit",
      projectCode: "SME-LIVE-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-cas",
      projectTemplateId: template.id,
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });
    const workflow = await mockApi.workflow(project.id);

    expect(
      workflow.map((node) => `${node.code} - ${node.title}`)
    ).toStrictEqual([
      "A - Planning",
      "B - General Procedures",
      "C - Execution",
      "D - Reporting",
      "E - Completion",
      "F - Continued Connected Transactions (CCT)",
      "G - Other Audit Programmes",
    ]);
    expect(
      workflow[0]?.children?.map((node) => `${node.code} - ${node.title}`)
    ).toStrictEqual([
      "A1 - Client acceptance or continuance",
      "A2 - Engagement letter",
      "A3 - Understanding the entity and its environment",
      "A5 - Planning materiality",
      "A6 - Audit planning programme",
    ]);
    expect(workflow[2]?.children?.[0]).toStrictEqual(
      expect.objectContaining({
        code: "C1",
        title: "Cash and cash equivalents",
      })
    );
  });

  it("creates project-first preview projects in the desktop state", async () => {
    await mockApi.login("partner@projectwing.local", "anything");

    const project = await mockApi.createProject({
      name: "Desktop Client audit",
      projectCode: "DESKTOP-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });
    const desktop = await mockApi.desktop();

    expect(project.projectNumber).toBeGreaterThanOrEqual(1_000_000);
    expect(String(project.projectNumber)).toHaveLength(7);
    expect(
      desktop.placements.find(
        (placement) => placement.project.id === project.id
      )
    ).toStrictEqual(
      expect.objectContaining({
        folderId: expect.any(String),
        desktopX: expect.any(Number),
        desktopY: expect.any(Number),
      })
    );
  });

  it("preserves a custom name for an unlinked preview project", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const project = await mockApi.createProject({
      name: "Custom quick project",
      language: "zh-CN",
      applicableAccountingStandard: "HKFRS",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });

    expect(project.name).toBe("Custom quick project");
    expect(project.projectCode).toMatch(/^DUMMY-EMP-\d+$/);
  });

  it("creates preview projects in the requested desktop folder", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const folder = await mockApi.createDesktopFolder({ name: "Client folder" });
    const project = await mockApi.createProject({
      folderId: folder.id,
      name: "Folder project audit",
      projectCode: "FOLDER-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });
    const desktop = await mockApi.desktop();

    expect(
      desktop.placements.find(
        (placement) => placement.project.id === project.id
      )
    ).toStrictEqual(expect.objectContaining({ folderId: folder.id }));
  });

  it("keeps mixed template items editable and continuously numbered after reorder", async () => {
    const version = requireValue(
      await createPublishedRequiredSmartFormVersion()
    );
    const template = await mockApi.createProjectTemplate({
      code: `ORDER-${Date.now()}`,
      name: "Ordered template",
      language: "zh-CN",
      frameworkTemplateId: "framework-cas",
      status: "DRAFT",
    });
    const folder = await mockApi.createProjectTemplateNode(template.id, {
      code: "3200",
      title: "Deferred income",
    });
    const file = await mockApi.createProjectTemplatePlaceholder(
      template.id,
      folder.id,
      {
        code: "3200.1",
        title: "Audit programme",
        placeholderType: "GENERIC",
      }
    );
    const smartForm = await mockApi.createProjectTemplateSmartForm(
      template.id,
      folder.id,
      {
        smartFormTemplateVersionId: version.id,
        title: "Deferred income form",
      }
    );
    expect(smartForm.code).toBe("3200.2");

    await expect(
      mockApi.updateProjectTemplateSmartFormCode(template.id, smartForm.id, {
        sequence: 1,
      })
    ).rejects.toMatchObject({ code: "DUPLICATE_CODE" });

    const reordered = await mockApi.reorderProjectTemplateItems(
      template.id,
      folder.id,
      {
        items: [
          { type: "SMART_FORM", id: smartForm.id },
          { type: "FILE", id: file.id },
        ],
      }
    );

    expect(reordered.items).toStrictEqual([
      expect.objectContaining({
        type: "SMART_FORM",
        code: "3200.1",
        sortOrder: 1,
      }),
      expect.objectContaining({ type: "FILE", code: "3200.2", sortOrder: 2 }),
    ]);
  });

  it("creates independent project template copies on repeated import", async () => {
    const created = await createPublishedProjectTemplate();
    const templates = await mockApi.projectTemplates({
      language: "zh-CN",
      frameworkTemplateId: "framework-cas",
    });
    const template = requireValue(
      templates.find((item) => item.id === created.template.id)
    );
    const templateFileId = created.file.id;
    const targetNodeId = "node-a1-1000";
    const preview = await mockApi.previewProjectTemplate(
      "project-harbor-2026",
      template.id,
      {
        workflowNodeId: targetNodeId,
        bucket: "CURRENT",
        selectedTemplateFileIds: [templateFileId],
      }
    );

    expect(preview.plan.summary).toMatchObject({
      total: 1,
      create: 1,
      existing: 0,
    });
    expect(preview.plan.items[0]).toMatchObject({
      sourceCode: "A1-1000-F001",
      plannedCode: "1000.1",
    });

    const applied = await mockApi.applyProjectTemplate(
      "project-harbor-2026",
      template.id,
      {
        workflowNodeId: targetNodeId,
        bucket: "CURRENT",
        selectedTemplateFileIds: [templateFileId],
      }
    );

    expect(applied.createdWorkingPapers).toHaveLength(1);
    expect(applied.createdWorkingPapers[0].attachments).toHaveLength(1);
    expect(applied.skippedTemplateFileIds).toHaveLength(0);

    const secondPreview = await mockApi.previewProjectTemplate(
      "project-harbor-2026",
      template.id,
      {
        workflowNodeId: targetNodeId,
        bucket: "CURRENT",
        selectedTemplateFileIds: [templateFileId],
      }
    );

    expect(secondPreview.plan.summary.create).toBe(1);
    expect(secondPreview.plan.summary.existing).toBe(0);
    const repeated = await mockApi.applyProjectTemplate(
      "project-harbor-2026",
      template.id,
      {
        workflowNodeId: targetNodeId,
        bucket: "CURRENT",
        selectedTemplateFileIds: [templateFileId],
      }
    );
    expect(repeated.createdWorkingPapers).toHaveLength(1);
    expect(repeated.createdWorkingPapers[0].id).not.toBe(
      applied.createdWorkingPapers[0].id
    );
    expect(repeated.createdWorkingPapers[0].code).not.toBe(
      applied.createdWorkingPapers[0].code
    );
    expect(repeated.createdWorkingPapers[0].attachments?.[0].id).not.toBe(
      applied.createdWorkingPapers[0].attachments?.[0].id
    );
    expect(repeated.skippedTemplateFileIds).toHaveLength(0);
    const numericCopy = await mockApi.applyProjectTemplate(
      "project-harbor-2026",
      template.id,
      {
        workflowNodeId: targetNodeId,
        bucket: "CURRENT",
        selectedTemplateFileIds: [templateFileId],
        referenceCodeOverrides: [{ itemId: templateFileId, code: "1000.4" }],
      }
    );
    expect(numericCopy.createdWorkingPapers[0].code).toBe("1000.4");
    const readBack = await mockApi.projectAttachments("project-harbor-2026");
    expect(
      readBack.find(
        (item) =>
          item.id === numericCopy.createdWorkingPapers[0].attachments?.[0].id
      )?.workingPaper?.code
    ).toBe("1000.4");

    const phasePreview = await mockApi.previewProjectTemplate(
      "project-harbor-2026",
      template.id,
      {
        workflowNodeId: "node-planning",
        bucket: "TEMPORARY",
        selectedTemplateFileIds: [templateFileId],
      }
    );
    expect(phasePreview.plan.summary.create).toBe(1);
    expect(phasePreview.plan.items[0].plannedCode).toBe("Planning-F001");

    const phaseApplied = await mockApi.applyProjectTemplate(
      "project-harbor-2026",
      template.id,
      {
        workflowNodeId: "node-planning",
        bucket: "TEMPORARY",
        selectedTemplateFileIds: [templateFileId],
      }
    );
    expect(phaseApplied.createdWorkingPapers).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowNodeId: "node-planning",
          code: "Planning-F001",
          bucket: "TEMPORARY",
        }),
      ])
    );
  });

  it("allows applying a published project template across language and standard", async () => {
    const created = await createPublishedProjectTemplate();
    await mockApi.login("partner@projectwing.local", "anything");
    const project = await mockApi.createProject({
      name: "English client audit",
      projectCode: "EN-2026-AUD",
      language: "en-US",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });
    const templates = await mockApi.projectTemplates();
    const template = requireValue(
      templates.find((item) => item.id === created.template.id)
    );
    const result = await mockApi.applyProjectTemplate(project.id, template.id, {
      workflowNodeId: `${project.id}-node-a1-1000`,
      bucket: "CURRENT",
      selectedTemplateFileIds: [created.file.id],
    });

    expect(result.plan.summary.create).toBe(1);
  });

  it("reports archive blockers and prevents archiving until review blockers clear", async () => {
    const project = await mockApi.createProject({
      name: "Archive check client",
      projectCode: "ARCHIVE-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });
    const workflow = await mockApi.workflow(project.id);
    const targetNode = workflow[0]?.children?.[0]?.children?.[0] ?? null;
    expect(targetNode).toBeTruthy();

    const paper = await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: targetNode?.id ?? "",
      code: "A1-1000-F001",
      title: "Archive test workpaper",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });
    const attachment = await mockApi.uploadWorkingPaperAttachment(
      project.id,
      paper.id,
      new File(["archive"], "archive-test.pdf", { type: "application/pdf" })
    );
    const blockedReport = await mockApi.archiveCheck(project.id);
    expect(blockedReport.ready).toBeFalsy();
    expect(blockedReport.summary.attachments).toBe(1);
    expect(blockedReport.summary.missingReviewerSignoffs).toBe(1);
    expect(blockedReport.issues[0]?.location).toStrictEqual(
      expect.objectContaining({
        attachmentId: attachment.id,
        attachmentName: "archive-test.pdf",
        projectPath: expect.stringMatching(/A1-1000-F001$/),
      })
    );
    await expect(mockApi.archiveProject(project.id)).rejects.toMatchObject({
      code: "ARCHIVE_CHECK_FAILED",
    });

    await mockApi.login("partner@projectwing.local", "anything");
    await mockApi.prepareAttachment(project.id, attachment.id);
    await mockApi.reviewAttachment(project.id, attachment.id);

    const selfReviewedReport = await mockApi.archiveCheck(project.id);
    expect(selfReviewedReport.ready).toBeFalsy();
    expect(selfReviewedReport.summary.selfReviewedAttachments).toBe(1);

    await mockApi.prepareAttachment(project.id, attachment.id);
    await mockApi.login("manager@projectwing.local", "anything");
    await mockApi.reviewAttachment(project.id, attachment.id);

    const readyReport = await mockApi.archiveCheck(project.id);
    expect(readyReport.ready).toBeTruthy();
    expect(readyReport.summary.blockers).toBe(0);
    expect(readyReport.summary.warnings).toBe(0);
    await expect(mockApi.archiveProject(project.id)).resolves.toStrictEqual(
      expect.objectContaining({ status: "ARCHIVED" })
    );
    await mockApi.login("partner@projectwing.local", "anything");
    await expect(mockApi.inboxMessages()).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: project.id,
          type: "SYSTEM_NOTIFICATION",
          title: `Project successfully archived: ${project.projectCode}`,
          body: `${project.projectCode} has been successfully archived. The archive package is ready to download.`,
        }),
      ])
    );
  });

  it("blocks signing and archiving incomplete Smart Forms", async () => {
    const version = requireValue(
      await createPublishedRequiredSmartFormVersion()
    );
    await mockApi.login("partner@projectwing.local", "anything");
    const project = await mockApi.createProject({
      name: "Smart Form archive client",
      projectCode: "SF-ARCHIVE-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });
    const workflow = await mockApi.workflow(project.id);
    const targetNode = workflow[0]?.children?.[0]?.children?.[0] ?? null;
    expect(targetNode).toBeTruthy();

    const paper = await mockApi.createProjectSmartForm(
      project.id,
      targetNode?.id ?? "",
      {
        smartFormTemplateVersionId: version.id,
        title: "Required client acceptance",
      }
    );
    const attachment = paper.attachments?.[0];
    expect(attachment?.fileKind).toBe("SMART_FORM");

    await mockApi.login("partner@projectwing.local", "anything");
    await expect(
      mockApi.prepareWorkingPaper(project.id, paper.id)
    ).rejects.toMatchObject({
      code: "SMART_FORM_INCOMPLETE",
    });
    await expect(
      mockApi.prepareAttachment(project.id, attachment?.id ?? "")
    ).rejects.toMatchObject({ code: "SMART_FORM_INCOMPLETE" });

    const report = await mockApi.archiveCheck(project.id);
    expect(report.ready).toBeFalsy();
    expect(report.summary.incompleteSmartForms).toBe(1);
    expect(report.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SMART_FORM_INCOMPLETE",
          attachment: expect.objectContaining({ id: attachment?.id }),
        }),
      ])
    );
  });

  it("enforces the reviewer cooldown per attachment and clears it when the review is removed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T08:00:00.000Z"));
    try {
      await mockApi.login("partner@projectwing.local", "anything");
      const project = await mockApi.createProject({
        name: "Reviewer cooldown client",
        projectCode: "REVIEW-COOLDOWN-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      });
      const workflow = await mockApi.workflow(project.id);
      const targetNode = workflow[0]?.children?.[0]?.children?.[0] ?? null;
      expect(targetNode).toBeTruthy();
      const paper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: targetNode?.id ?? "",
        code: "A1-1000-F001",
        title: "Reviewer cooldown workpaper",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      const attachment = await mockApi.uploadWorkingPaperAttachment(
        project.id,
        paper.id,
        new File(["review"], "review.pdf", { type: "application/pdf" })
      );

      await mockApi.prepareAttachment(project.id, attachment.id);
      await mockApi.reviewAttachment(project.id, attachment.id);
      await mockApi.prepareAttachment(project.id, attachment.id);

      await expect(
        mockApi.reviewAttachment(project.id, attachment.id)
      ).rejects.toMatchObject({ code: "REVIEW_SIGNOFF_COOLDOWN_ACTIVE" });

      vi.setSystemTime(new Date("2026-09-01T08:00:01.000Z"));
      await mockApi.reviewAttachment(project.id, attachment.id);

      const projectAttachments = await mockApi.projectAttachments(project.id);
      const reviewed = projectAttachments.find(
        (item) => item.id === attachment.id
      );
      const [latestReview] = (reviewed?.signoffs ?? [])
        .filter((signoff) => signoff.type === "REVIEWER")
        .sort(
          (left, right) =>
            new Date(right.signedAt).getTime() -
            new Date(left.signedAt).getTime()
        );
      expect(latestReview).toBeTruthy();
      await mockApi.removeWorkingPaperSignoff(
        project.id,
        latestReview?.id ?? ""
      );
      await mockApi.reviewAttachment(project.id, attachment.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it("places preview projects in the next free folder position", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const folder = await mockApi.createDesktopFolder({ name: "Client folder" });
    let now = 1_780_580_258_000;
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => {
      now += 1;
      return now;
    });
    const first = await mockApi.createProject({
      folderId: folder.id,
      name: "Folder project one",
      projectCode: "FOLDER-2026-001",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });
    const second = await mockApi.createProject({
      folderId: folder.id,
      name: "Folder project two",
      projectCode: "FOLDER-2026-002",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });
    dateNow.mockRestore();
    const desktop = await mockApi.desktop();

    expect(
      desktop.placements.find((placement) => placement.project.id === first.id)
    ).toStrictEqual(
      expect.objectContaining({
        folderId: folder.id,
        desktopX: 24,
        desktopY: 24,
      })
    );
    expect(
      desktop.placements.find((placement) => placement.project.id === second.id)
    ).toStrictEqual(
      expect.objectContaining({
        folderId: folder.id,
        desktopX: 156,
        desktopY: 24,
      })
    );
  });

  it("persists preview desktop icon coordinates", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const desktop = await mockApi.desktop();
    const [placement] = desktop.placements;

    await mockApi.updateDesktopProjectPlacement(placement.project.id, {
      desktopX: 444,
      desktopY: 222,
    });

    await expect(mockApi.desktop()).resolves.toStrictEqual(
      expect.objectContaining({
        placements: expect.arrayContaining([
          expect.objectContaining({
            projectId: placement.project.id,
            desktopX: 444,
            desktopY: 222,
          }),
        ]),
      })
    );
  });

  it("moves preview desktop icons away from occupied positions", async () => {
    await mockApi.login("partner@projectwing.local", "anything");

    await mockApi.updateDesktopProjectPlacement("project-orchid-2026", {
      desktopX: 156,
      desktopY: 24,
    });

    await expect(mockApi.desktop()).resolves.toStrictEqual(
      expect.objectContaining({
        placements: expect.arrayContaining([
          expect.objectContaining({
            projectId: "project-orchid-2026",
            desktopX: 288,
            desktopY: 24,
          }),
        ]),
      })
    );
  });

  it("updates an existing workspace in preview mode", async () => {
    const workspace = await mockApi.createWorkspace({
      name: "Original",
      clientName: "Original Client",
      description: "Before",
    });
    const updated = await mockApi.updateWorkspace(workspace.id, {
      name: "Updated",
      clientName: "Updated Client",
      description: "After",
    });

    expect(updated).toStrictEqual(
      expect.objectContaining({
        id: workspace.id,
        name: "Updated",
        clientName: "Updated Client",
        description: "After",
      })
    );
  });

  it("records workflow mutations and audit logs", async () => {
    const [project] = await mockApi.projects();
    const [root] = await mockApi.workflow(project.id);
    const node = await mockApi.createWorkflowNode(project.id, {
      parentId: root.id,
      code: "A99",
      title: "Preview section",
    });
    const renamedNode = await mockApi.updateWorkflowNode(project.id, node.id, {
      code: "A98",
      title: "Renamed section",
    });
    await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: renamedNode.id,
      code: "A99-P1",
      title: "Preview paper",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });

    const logs = await mockApi.auditLogs(project.id);
    expect(renamedNode.code).toBe("A98");
    expect(logs.map((log) => log.action)).toContain("WORKFLOW_NODE_UPDATED");
    expect(logs.map((log) => log.action)).toContain("WORKING_PAPER_CREATED");
    expect(logs[0]).toStrictEqual(
      expect.objectContaining({
        targetType: "WORKING_PAPER",
        projectId: project.id,
        ipAddress: "preview",
        userAgent: "ProjectWing mock preview",
      })
    );
  });

  it(
    "moves workflow folders to root and reorders siblings",
    async () => {
      const [project] = await mockApi.projects();
      const firstRoot = await mockApi.createWorkflowNode(project.id, {
        parentId: null,
        code: `DND-A-${Date.now()}`,
        title: "Drag root A",
      });
      const secondRoot = await mockApi.createWorkflowNode(project.id, {
        parentId: null,
        code: `DND-B-${Date.now()}`,
        title: "Drag root B",
      });
      const nested = await mockApi.createWorkflowNode(project.id, {
        parentId: firstRoot.id,
        code: `DND-C-${Date.now()}`,
        title: "Drag nested",
      });

      await mockApi.updateWorkflowNode(project.id, nested.id, {
        parentId: null,
        insert: { targetNodeId: secondRoot.id, placement: "BEFORE" },
      });

      const workflow = await mockApi.workflow(project.id);
      const rootIds = workflow.map((node) => node.id);
      expect(rootIds.indexOf(nested.id)).toBe(
        rootIds.indexOf(secondRoot.id) - 1
      );
      expect(workflow.find((node) => node.id === nested.id)).toStrictEqual(
        expect.objectContaining({
          parentId: null,
          level: 1,
        })
      );

      await mockApi.updateWorkflowNode(project.id, secondRoot.id, {
        insert: { targetNodeId: firstRoot.id, placement: "BEFORE" },
      });

      const reordered = await mockApi.workflow(project.id);
      const reorderedRootIds = reordered.map((node) => node.id);
      expect(reorderedRootIds.indexOf(secondRoot.id)).toBe(
        reorderedRootIds.indexOf(firstRoot.id) - 1
      );

      await mockApi.updateWorkflowNode(project.id, firstRoot.id, {
        parentId: null,
      });

      const appended = await mockApi.workflow(project.id);
      const appendedRootIds = appended.map((node) => node.id);
      expect(appendedRootIds.at(-1)).toBe(firstRoot.id);
    },
    MOCK_API_SLOW_TEST_TIMEOUT_MS
  );

  it("normalizes manual preview code edits before storing them", async () => {
    const [project] = await mockApi.projects();
    const [root] = await mockApi.workflow(project.id);
    const node = await mockApi.createWorkflowNode(project.id, {
      parentId: root.id,
      code: "A4",
      title: "A4",
    });
    const renamedNode = await mockApi.updateWorkflowNode(project.id, node.id, {
      code: "A14",
      title: "A14",
    });
    const paper = await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: renamedNode.id,
      code: "A14-F004",
      title: "A14-F004",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });

    expect(node).toStrictEqual(
      expect.objectContaining({ code: "A5", title: "A5" })
    );
    expect(renamedNode).toStrictEqual(
      expect.objectContaining({ code: "A15", title: "A15" })
    );
    expect(paper).toStrictEqual(
      expect.objectContaining({ code: "A15-F005", title: "A15-F005" })
    );
  });

  it("strips legacy code prefixes from preview upload paper titles", async () => {
    const [project] = await mockApi.projects();
    const [root] = await mockApi.workflow(project.id);
    const node = await mockApi.createWorkflowNode(project.id, {
      parentId: root.id,
      code: "A1-1000",
      title: "Cash",
    });
    const paper = await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: node.id,
      code: "A1-1000-F001",
      title: "A4 - 1000 - F777 - Uploaded support.xlsx",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });

    expect(paper).toStrictEqual(
      expect.objectContaining({
        code: "A1-1000-F001",
        title: "Uploaded support.xlsx",
      })
    );
  });

  it(
    "keeps manually edited attachment refcodes out of preview auto numbering",
    async () => {
      await mockApi.login("partner@projectwing.local", "anything");
      const [project] = await mockApi.projects();
      const [root] = await mockApi.workflow(project.id);
      const accountNode = await mockApi.createWorkflowNode(project.id, {
        parentId: root.id,
        code: `MANUAL-${Date.now()}`,
        title: "Manual attachment account",
      });
      const node = await mockApi.createWorkflowNode(project.id, {
        parentId: accountNode.id,
        code: `MANUAL-F-${Date.now()}`,
        title: "Manual attachment folder",
      });
      const paper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: node.id,
        code: `${node.code}-F003`,
        title: "manual-refcode.zip",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      const attachment = await mockApi.uploadWorkingPaperAttachment(
        project.id,
        paper.id,
        new File(["zip"], "manual-refcode.zip", { type: "application/zip" })
      );

      await expect(
        mockApi.updateAttachmentIdentity(project.id, attachment.id, {
          code: "C-01-F002",
        })
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        message: `File code must use ${node.code}-F001 format`,
      });

      await expect(
        mockApi.updateAttachmentIdentity(project.id, attachment.id, {
          code: "1100.1",
        })
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        message: `File code must use ${node.code}-F001 format`,
      });

      await mockApi.updateAttachmentIdentity(project.id, attachment.id, {
        code: `${node.code}-F001`,
      });

      const projectFiles = await mockApi.projectAttachments(project.id);
      expect(projectFiles).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: attachment.id,
            code: `${node.code}-F001`,
            workingPaper: expect.objectContaining({
              id: paper.id,
              code: `${node.code}-F001`,
            }),
          }),
        ])
      );
      const workflowPaper = findTestWorkflowNode(
        await mockApi.workflow(project.id),
        node.id
      )?.workingPapers.find((item) => item.id === paper.id);
      expect(workflowPaper?.code).toBe(`${node.code}-F003`);
    },
    MOCK_API_SLOW_TEST_TIMEOUT_MS
  );

  it("reorders attachments across papers in one directory", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const [project] = await mockApi.projects();
    const [root] = await mockApi.workflow(project.id);
    const node = await mockApi.createWorkflowNode(project.id, {
      parentId: root.id,
      code: `ORDER-${Date.now()}`,
      title: "Attachment ordering",
    });
    const paper = await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: node.id,
      code: `${node.code}-F001`,
      title: "Attachment ordering",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });
    const firstAttachment = await mockApi.uploadWorkingPaperAttachment(
      project.id,
      paper.id,
      new File(["first"], "first-support.pdf", { type: "application/pdf" })
    );
    const secondAttachment = await mockApi.uploadWorkingPaperAttachment(
      project.id,
      paper.id,
      new File(["second"], "second-support.pdf", {
        type: "application/pdf",
      })
    );
    const siblingPaper = await mockApi.createWorkingPaper(project.id, {
      workflowNodeId: node.id,
      code: `${node.code}-F002`,
      title: "Attachment ordering sibling",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
    });
    const siblingAttachment = await mockApi.uploadWorkingPaperAttachment(
      project.id,
      siblingPaper.id,
      new File(["sibling"], "sibling-support.pdf", {
        type: "application/pdf",
      })
    );

    await mockApi.reorderWorkingPaperAttachments(project.id, {
      workflowNodeId: paper.workflowNodeId,
      bucket: paper.bucket ?? "CURRENT",
      attachmentIds: [
        secondAttachment.id,
        siblingAttachment.id,
        firstAttachment.id,
      ],
    });

    const reorderedPaper = await mockApi.workingPaper(project.id, paper.id);
    expect(
      reorderedPaper.attachments?.map((attachment) => attachment.id)
    ).toStrictEqual([secondAttachment.id, firstAttachment.id]);
    const projectAttachments = await mockApi.projectAttachments(project.id);
    const reorderedFiles = projectAttachments
      .filter(
        (attachment) => attachment.workingPaper?.workflowNodeId === node.id
      )
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
    expect(reorderedFiles.map((attachment) => attachment.id)).toStrictEqual([
      secondAttachment.id,
      siblingAttachment.id,
      firstAttachment.id,
    ]);
    await expect(
      mockApi.reorderWorkingPaperAttachments(project.id, {
        workflowNodeId: paper.workflowNodeId,
        bucket: paper.bucket ?? "CURRENT",
        attachmentIds: [firstAttachment.id, "other-paper-attachment"],
      })
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it(
    "keeps deleted attachments in a project recycle bin until restored",
    async () => {
      const [project] = await mockApi.projects();
      const [root] = await mockApi.workflow(project.id);
      const accountNode = await mockApi.createWorkflowNode(project.id, {
        parentId: root.id,
        code: `RB-${Date.now()}`,
        title: "Recycle bin account",
      });
      const node = await mockApi.createWorkflowNode(project.id, {
        parentId: accountNode.id,
        code: `RB-F-${Date.now()}`,
        title: "Recycle bin folder",
      });
      const paper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: node.id,
        code: `RB-${Date.now()}`,
        title: "Recycle bin paper",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      const attachment = await mockApi.uploadWorkingPaperAttachment(
        project.id,
        paper.id,
        new File(["cash"], "cash.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );

      await mockApi.deleteAttachment(project.id, attachment.id);

      await expect(
        mockApi.workingPaper(project.id, paper.id)
      ).rejects.toMatchObject({
        message: "底稿不存在",
      });
      let downloadError: unknown;
      try {
        await mockApi.downloadAttachment(project.id, attachment.id);
      } catch (error) {
        downloadError = error;
      }
      expect(downloadError).toMatchObject({ message: "文件不存在" });
      await expect(
        mockApi.deletedAttachments(project.id)
      ).resolves.toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: attachment.id,
            deletedAt: expect.any(String),
            deletedFromWorkingPaperId: paper.id,
          }),
        ])
      );

      await mockApi.restoreAttachment(project.id, attachment.id, {
        workflowNodeId: node.id,
      });

      await expect(
        mockApi.deletedAttachments(project.id)
      ).resolves.not.toStrictEqual(
        expect.arrayContaining([expect.objectContaining({ id: attachment.id })])
      );
      const restoredWorkflow = await mockApi.workflow(project.id);
      const restoredAccountNode = restoredWorkflow[0]?.children?.find(
        (item) => item.id === accountNode.id
      );
      const restoredNode = restoredAccountNode?.children?.find(
        (item) => item.id === node.id
      );
      expect(restoredNode?.workingPapers).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            attachments: [
              expect.objectContaining({
                id: attachment.id,
                deletedAt: null,
                restoredAt: expect.any(String),
              }),
            ],
          }),
        ])
      );
    },
    MOCK_API_SLOW_TEST_TIMEOUT_MS
  );

  it(
    "removes the source upload row after moving its only file",
    async () => {
      const [project] = await mockApi.projects();
      const [root] = await mockApi.workflow(project.id);
      const sourceNode = await mockApi.createWorkflowNode(project.id, {
        parentId: root.id,
        code: `MOVE-S-${Date.now()}`,
        title: "Move source",
      });
      const targetNode = await mockApi.createWorkflowNode(project.id, {
        parentId: root.id,
        code: `MOVE-T-${Date.now()}`,
        title: "Move target",
      });
      const targetExistingPaper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: targetNode.id,
        code: `${targetNode.code}-F001`,
        title: "existing-target-file.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      await mockApi.uploadWorkingPaperAttachment(
        project.id,
        targetExistingPaper.id,
        new File(["existing"], "existing-target-file.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const paper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: sourceNode.id,
        code: `${sourceNode.code}-F001`,
        title: "moved-file.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      const attachment = await mockApi.uploadWorkingPaperAttachment(
        project.id,
        paper.id,
        new File(["moved"], "moved-file.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const movedAttachment = await mockApi.moveAttachment(
        project.id,
        attachment.id,
        {
          workflowNodeId: targetNode.id,
          bucket: "CURRENT",
        }
      );
      const workflow = await mockApi.workflow(project.id);
      expect(
        findTestWorkflowNode(workflow, sourceNode.id)?.workingPapers
      ).toStrictEqual([]);
      expect(
        findTestWorkflowNode(workflow, targetNode.id)?.workingPapers
      ).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: targetExistingPaper.id,
            code: `${targetNode.code}-F001`,
          }),
          expect.objectContaining({
            code: `${targetNode.code}-F002`,
            title: "moved-file.xlsx",
            attachments: [
              expect.objectContaining({
                id: attachment.id,
                workingPaperId: expect.not.stringMatching(paper.id),
                code: `${targetNode.code}-F002`,
              }),
            ],
          }),
        ])
      );
      expect(movedAttachment).toStrictEqual(
        expect.objectContaining({
          code: `${targetNode.code}-F002`,
          workingPaperId: expect.not.stringMatching(paper.id),
        })
      );
    },
    MOCK_API_SLOW_TEST_TIMEOUT_MS
  );

  it(
    "prunes old empty upload file rows when loading workflow",
    async () => {
      const [project] = await mockApi.projects();
      const [root] = await mockApi.workflow(project.id);
      const node = await mockApi.createWorkflowNode(project.id, {
        parentId: root.id,
        code: `ORPHAN-${Date.now()}`,
        title: "Orphan cleanup",
      });
      await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: node.id,
        code: `${node.code}-F001`,
        title: "orphan-upload.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });

      const workflow = await mockApi.workflow(project.id);

      expect(
        findTestWorkflowNode(workflow, node.id)?.workingPapers
      ).toStrictEqual([]);
    },
    MOCK_API_SLOW_TEST_TIMEOUT_MS
  );

  it(
    "lists active project files and locks a file when downloaded",
    async () => {
      const [project] = await mockApi.projects();
      const [root] = await mockApi.workflow(project.id);
      const accountNode = await mockApi.createWorkflowNode(project.id, {
        parentId: root.id,
        code: `PF-${Date.now()}`,
        title: "Project file account",
      });
      const node = await mockApi.createWorkflowNode(project.id, {
        parentId: accountNode.id,
        code: `PF-F-${Date.now()}`,
        title: "Project file folder",
      });
      const paper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: node.id,
        code: `PF-${Date.now()}`,
        title: "Project file paper",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      const attachment = await mockApi.uploadWorkingPaperAttachment(
        project.id,
        paper.id,
        new File(["support"], "support.pdf", { type: "application/pdf" })
      );

      await mockApi.downloadAttachment(project.id, attachment.id);

      await expect(
        mockApi.projectAttachments(project.id)
      ).resolves.toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: attachment.id,
            lockedBy: expect.any(String),
            lockHolder: expect.objectContaining({ id: expect.any(String) }),
            workingPaper: expect.objectContaining({
              id: paper.id,
              workflowNodeId: node.id,
              path: expect.arrayContaining([
                expect.objectContaining({ id: node.id, level: 3 }),
              ]),
            }),
          }),
        ])
      );
    },
    MOCK_API_SLOW_TEST_TIMEOUT_MS
  );

  it(
    "downloads a preview project file read-only without locking it",
    async () => {
      const [project] = await mockApi.projects();
      const [root] = await mockApi.workflow(project.id);
      const accountNode = await mockApi.createWorkflowNode(project.id, {
        parentId: root.id,
        code: `RO-${Date.now()}`,
        title: "Read-only account",
      });
      const node = await mockApi.createWorkflowNode(project.id, {
        parentId: accountNode.id,
        code: `RO-F-${Date.now()}`,
        title: "Read-only folder",
      });
      const paper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: node.id,
        code: `RO-${Date.now()}`,
        title: "Read-only paper",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      const attachment = await mockApi.uploadWorkingPaperAttachment(
        project.id,
        paper.id,
        new File(["support"], "readonly.pdf", { type: "application/pdf" })
      );

      await mockApi.downloadAttachmentReadOnly(project.id, attachment.id);

      await expect(
        mockApi.projectAttachments(project.id)
      ).resolves.toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: attachment.id,
            lockedBy: null,
          }),
        ])
      );
      await expect(mockApi.auditLogs(project.id)).resolves.toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "ATTACHMENT_READONLY_DOWNLOADED",
            targetId: attachment.id,
          }),
        ])
      );
    },
    MOCK_API_SLOW_TEST_TIMEOUT_MS
  );

  it(
    "stores attachment revisions and continues from a historical revision as current",
    async () => {
      const [project] = await mockApi.projects();
      const [root] = await mockApi.workflow(project.id);
      const accountNode = await mockApi.createWorkflowNode(project.id, {
        parentId: root.id,
        code: `VH-${Date.now()}`,
        title: "Version history account",
      });
      const node = await mockApi.createWorkflowNode(project.id, {
        parentId: accountNode.id,
        code: `VH-F-${Date.now()}`,
        title: "Version history folder",
      });
      const paper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: node.id,
        code: `VH-${Date.now()}`,
        title: "Version history paper",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      const attachment = await mockApi.uploadWorkingPaperAttachment(
        project.id,
        paper.id,
        new File(["v1"], "support-v1.pdf", { type: "application/pdf" }),
        "2026-01-31"
      );

      await mockApi.downloadAttachment(project.id, attachment.id);
      await mockApi.uploadAttachmentNewVersion(
        project.id,
        attachment.id,
        new File(["v2"], "support-v2.pdf", { type: "application/pdf" }),
        "2026-02-28"
      );

      const history = await mockApi.attachmentHistory(
        project.id,
        attachment.id
      );
      const version1 = history.versions.find(
        (version) => version.version === 1
      );
      const version2 = history.versions.find(
        (version) => version.version === 2
      );
      expect(history.attachment).toStrictEqual(
        expect.objectContaining({
          version: 2,
          originalName: "support-v2.pdf",
          workDate: "2026-02-28T00:00:00.000Z",
          lockedBy: null,
        })
      );
      expect(version1).toStrictEqual(
        expect.objectContaining({
          version: 1,
          originalName: "support-v1.pdf",
          workDate: "2026-01-31T00:00:00.000Z",
          parentVersionId: null,
          sourceVersionId: null,
          action: "INITIAL",
          isCurrent: false,
        })
      );
      expect(version2).toStrictEqual(
        expect.objectContaining({
          version: 2,
          originalName: "support-v2.pdf",
          parentVersionId: version1?.id,
          sourceVersionId: null,
          action: "UPLOAD",
          isCurrent: true,
        })
      );

      await mockApi.downloadAttachmentVersion(
        project.id,
        attachment.id,
        version1?.id ?? ""
      );
      await expect(
        mockApi.projectAttachments(project.id)
      ).resolves.toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: attachment.id, lockedBy: null }),
        ])
      );

      await mockApi.restoreAttachmentVersion(
        project.id,
        attachment.id,
        version1?.id ?? ""
      );

      const continuedHistory = await mockApi.attachmentHistory(
        project.id,
        attachment.id
      );
      expect(continuedHistory).toStrictEqual(
        expect.objectContaining({
          attachment: expect.objectContaining({
            version: 1,
            originalName: "support-v1.pdf",
            workDate: "2026-01-31T00:00:00.000Z",
            lockedBy: null,
            headVersionId: version1?.id,
          }),
        })
      );
      expect(continuedHistory.versions).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ version: 1, isCurrent: true }),
          expect.objectContaining({ version: 2, isCurrent: false }),
        ])
      );

      await mockApi.downloadAttachment(project.id, attachment.id);
      await mockApi.uploadAttachmentNewVersion(
        project.id,
        attachment.id,
        new File(["v2b"], "support-v2-after-reset.pdf", {
          type: "application/pdf",
        }),
        "2026-03-31"
      );

      const replacedHistory = await mockApi.attachmentHistory(
        project.id,
        attachment.id
      );
      expect(replacedHistory.attachment).toStrictEqual(
        expect.objectContaining({
          version: 2,
          originalName: "support-v2-after-reset.pdf",
          workDate: "2026-03-31T00:00:00.000Z",
        })
      );
      expect(replacedHistory.versions).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ version: 1, isCurrent: false }),
          expect.objectContaining({
            version: 2,
            originalName: "support-v2-after-reset.pdf",
            parentVersionId: version1?.id,
            sourceVersionId: null,
            action: "UPLOAD",
            isCurrent: true,
          }),
        ])
      );
      expect(
        replacedHistory.versions.some(
          (version) => version.originalName === "support-v2.pdf"
        )
      ).toBeFalsy();
    },
    MOCK_API_SLOW_TEST_TIMEOUT_MS
  );

  it(
    "keeps attachments recoverable after deleting their workflow node",
    async () => {
      const [project] = await mockApi.projects();
      const [root] = await mockApi.workflow(project.id);
      const accountNode = await mockApi.createWorkflowNode(project.id, {
        parentId: root.id,
        code: `ND-${Date.now()}`,
        title: "Deleted node account",
      });
      const node = await mockApi.createWorkflowNode(project.id, {
        parentId: accountNode.id,
        code: `ND-F-${Date.now()}`,
        title: "Deleted node folder",
      });
      const paper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: node.id,
        code: `ND-${Date.now()}`,
        title: "Deleted node paper",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });
      const attachment = await mockApi.uploadWorkingPaperAttachment(
        project.id,
        paper.id,
        new File(["support"], "node-support.pdf", { type: "application/pdf" })
      );
      const restoreNode = await mockApi.createWorkflowNode(project.id, {
        parentId: accountNode.id,
        code: `ND-R-${Date.now()}`,
        title: "Restore target",
      });
      const restorePaper = await mockApi.createWorkingPaper(project.id, {
        workflowNodeId: restoreNode.id,
        code: `${restoreNode.code}-F001`,
        title: "Restore target paper",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      });

      await mockApi.deleteWorkflowNode(project.id, node.id);

      await expect(
        mockApi.deletedAttachments(project.id)
      ).resolves.toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: attachment.id,
            deletedAt: expect.any(String),
            deletedFromWorkingPaperId: paper.id,
          }),
        ])
      );

      await mockApi.restoreAttachment(project.id, attachment.id, {
        workflowNodeId: restoreNode.id,
      } as never);

      const workflow = await mockApi.workflow(project.id);
      const updatedRestoreNode = findTestWorkflowNode(workflow, restoreNode.id);
      expect(updatedRestoreNode?.workingPapers).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: restorePaper.id, attachments: [] }),
          expect.objectContaining({
            workflowNodeId: restoreNode.id,
            code: `${restoreNode.code}-F002`,
            title: "node-support.pdf",
            paperType: "WORKING_PAPER",
            bucket: "CURRENT",
            attachments: [expect.objectContaining({ id: attachment.id })],
          }),
        ])
      );
    },
    MOCK_API_SLOW_TEST_TIMEOUT_MS
  );

  it("filters preview admin users by search, role, and status", async () => {
    await mockApi.updateUser("user-staff", { status: "DISABLED" });

    await expect(
      mockApi.users({ q: "staff", globalRole: "STAFF", status: "DISABLED" })
    ).resolves.toStrictEqual([
      expect.objectContaining({
        id: "user-staff",
        email: "staff@projectwing.local",
        globalRole: "STAFF",
        status: "DISABLED",
      }),
    ]);
  });

  it("keeps preview user lifecycle guards aligned with the API", async () => {
    let duplicateError: unknown;
    try {
      await mockApi.createUser({
        email: "staff@projectwing.local",
        name: "Duplicate Staff",
        password: "User12345!",
        globalRole: "STAFF",
      });
    } catch (error) {
      duplicateError = error;
    }
    expect(duplicateError).toMatchObject({ code: "EMAIL_ALREADY_EXISTS" });

    let superAdminError: unknown;
    try {
      await mockApi.updateUser("user-admin", { status: "DISABLED" });
    } catch (error) {
      superAdminError = error;
    }
    expect(superAdminError).toMatchObject({ code: "LAST_SUPER_ADMIN" });
  });

  it("delivers newly created preview invitations to the recipient inbox", async () => {
    await mockApi.login("partner@projectwing.local", "anything");
    const [project] = await mockApi.projects();
    const invitation = await mockApi.createInvitation(project.id, {
      recipientUserId: "user-staff",
      invitedRole: "PREPARER",
      expiresInDays: 7,
    });

    await mockApi.login("staff@projectwing.local", "anything");
    const messages = await mockApi.inboxMessages();

    expect(invitation.delivery).toStrictEqual(
      expect.objectContaining({
        delivered: true,
        recipientEmail: "staff@projectwing.local",
      })
    );
    expect(messages).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientId: "user-staff",
          actionUrl: new URL(invitation.inviteUrl).pathname,
          projectInvitation: expect.objectContaining({
            status: "PENDING",
            invitedRole: "PREPARER",
          }),
        }),
      ])
    );
  });

  it("supports collaboration inbox messages and marks only current user messages read", async () => {
    await mockApi.login("staff@projectwing.local", "anything");

    const before = await mockApi.inboxMessages();
    expect(before).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientId: "user-staff",
          type: "REVIEW_QUESTION",
          project: expect.objectContaining({ projectCode: "AUD-2026-0001" }),
          workingPaper: expect.objectContaining({ code: "C-01" }),
          readAt: null,
        }),
      ])
    );

    const result = await mockApi.markAllInboxRead();
    const after = await mockApi.inboxMessages();

    expect(result.count).toBeGreaterThan(0);
    expect(after.every((message) => message.readAt)).toBeTruthy();
    await expect(mockApi.markInboxUnread(after[0].id)).resolves.toStrictEqual(
      expect.objectContaining({ readAt: null })
    );
    const afterUnread = await mockApi.inboxMessages();
    expect(afterUnread.some((message) => !message.readAt)).toBeTruthy();

    await mockApi.login("partner@projectwing.local", "anything");
    const partnerMessages = await mockApi.inboxMessages();
    expect(
      partnerMessages.some(
        (message) => message.type === "REVIEW_REPLY" && !message.readAt
      )
    ).toBeTruthy();
  });

  it("supports the local PDF confirmation-template lifecycle", async () => {
    await mockApi.login("admin@projectwing.local", "anything");
    const uploaded = await mockApi.uploadConfirmationTemplateLibraryFile({
      name: "Local bank template",
      confirmationType: "BANK",
      file: new File(["%PDF-1.7 mock"], "local-bank-template.pdf", {
        type: "application/pdf",
      }),
    });

    expect(uploaded).toMatchObject({
      name: "Local bank template",
      designStatus: "DRAFT",
      mimeType: "application/pdf",
    });
    await expect(mockApi.confirmationTemplateLibrary()).resolves.toContainEqual(
      expect.objectContaining({ id: uploaded.id })
    );
    await expect(
      mockApi.previewConfirmationTemplateLibraryFile(uploaded.id)
    ).resolves.toBeInstanceOf(Blob);
    await expect(
      mockApi.updateConfirmationTemplateLibraryDesign(uploaded.id, {
        designSchema: { version: 1, fields: [] },
        designStatus: "ENABLED",
      })
    ).resolves.toMatchObject({ designStatus: "ENABLED" });

    await mockApi.login("partner@projectwing.local", "anything");
    await expect(
      mockApi.updateConfirmationTemplateLibraryDesign(uploaded.id, {
        designSchema: { version: 1, fields: [] },
        designStatus: "DRAFT",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      mockApi.deleteConfirmationTemplateLibraryFile(uploaded.id)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await mockApi.login("admin@projectwing.local", "anything");
    await expect(
      mockApi.deleteConfirmationTemplateLibraryFile(uploaded.id)
    ).resolves.toStrictEqual({ id: uploaded.id });
  });
});
