import { PDFDocument } from "pdf-lib";

import {
  buildArchiveFileIndexPdf,
  renderArchiveFileIndexTypstSource,
  type ArchiveFileIndexInput,
} from "./archive-file-index-pdf";

const input: ArchiveFileIndexInput = {
  generatedAt: "2026-09-03T05:00:00.000Z",
  project: {
    id: "project-1",
    projectCode: "HBR-2026-ACC",
    name: "Harbour Holdings 2026 audit",
    clientName: "海港控股有限公司",
    engagementCode: "HBR-2026-ACC",
    language: "zh-CN",
    yearEndDate: "2026-12-31T00:00:00.000Z",
  },
  fileCheckSummary: { blockers: 0, warnings: 2 },
  folders: [
    {
      workflowNodeId: "node-planning",
      parentId: null,
      code: "A",
      title: "Planning",
      level: 1,
      sortOrder: 1,
      entryPath: "workpapers/A Planning/",
    },
    {
      workflowNodeId: "node-a1",
      parentId: "node-planning",
      code: "A1",
      title: "Client acceptance or continuance",
      level: 2,
      sortOrder: 1,
      entryPath: "workpapers/A Planning/A1 Client acceptance or continuance/",
    },
    {
      workflowNodeId: "node-a1-1000",
      parentId: "node-a1",
      code: "A1-1000",
      title: "Engagement profile",
      level: 3,
      sortOrder: 1,
      entryPath:
        "workpapers/A Planning/A1 Client acceptance or continuance/A1-1000 Engagement profile/",
    },
  ],
  files: [
    {
      workflowNodeId: "node-a1-1000",
      workingPaperId: "paper-1",
      workingPaperCode: "A1-1000",
      workingPaperTitle: "Engagement profile",
      attachmentId: "attachment-1",
      fileReference: "A1-1000-F001",
      fileName: "A1-1000-F001 engagement-profile.pdf",
      archivePath:
        "workpapers/A Planning/A1 Client acceptance or continuance/A1-1000 Engagement profile/A1-1000-F001 engagement-profile.pdf",
      fileKind: "SUPPORTING",
      fileSize: 348_220,
      mimeType: "application/pdf",
      sha256:
        "c9be28d934661b9d98d90d6a334bed1592429eb4dfc18fd50ca9562f4fb93fe3",
      preparerSignoff: {
        name: "Amy Chan",
        email: "amy@example.com",
        signedAt: "2026-08-28T09:15:00.000Z",
      },
      reviewerSignoff: {
        name: "Edric Han",
        email: "edric@example.com",
        signedAt: "2026-08-29T10:30:00.000Z",
      },
      signoffStatus: "COMPLETE",
    },
  ],
};

describe("archive file index PDF", () => {
  it("renders folders and files in depth-first hierarchy with sign-offs", () => {
    const source = renderArchiveFileIndexTypstSource(input);

    expect(source.indexOf('text("Planning")')).toBeLessThan(
      source.indexOf('text("Client acceptance or continuance")')
    );
    expect(
      source.indexOf('text("Client acceptance or continuance")')
    ).toBeLessThan(source.indexOf('text("Engagement profile")'));
    expect(source.indexOf('text("Engagement profile")')).toBeLessThan(
      source.indexOf('text("A1-1000-F001 engagement-profile.pdf")')
    );
    expect(source).toContain('text("Amy Chan · 2026-08-28 09:15")');
    expect(source).toContain('text("Edric Han · 2026-08-29 10:30")');
    expect(source).toContain(
      'text("c9be28d934661b9d98d90d6a334bed15")#linebreak()#text("92429eb4dfc18fd50ca9562f4fb93fe3")'
    );
  });

  it("compiles a readable multi-page PDF", async () => {
    const pdf = buildArchiveFileIndexPdf(input);

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
