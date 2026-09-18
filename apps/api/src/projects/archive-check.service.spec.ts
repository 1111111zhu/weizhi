import { XLSX } from "../common/xlsx";

import { ApiBadRequestException } from "../common/api-error";
import {
  ArchiveCheckService,
  renderArchiveCheckTypstSource,
} from "./archive-check.service";

const prisma = {
  project: {
    findFirst: vi.fn(),
  },
  workingPaper: {
    findMany: vi.fn(),
  },
  workflowNode: {
    findMany: vi.fn(),
  },
};
const access = {
  requireProjectMember: vi.fn(),
};
const storage = {
  getObjectBuffer: vi.fn(),
};

describe(ArchiveCheckService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      projectCode: "ABC-2026-AUD",
      name: "ABC Holdings audit",
    });
    prisma.workflowNode.findMany.mockResolvedValue([]);
  });

  it("reports blockers and warnings before archive", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-1",
        code: "FA-F001",
        title: "Fixed assets roll-forward",
        signoffs: [],
        reviewQuestions: [
          {
            id: "question-1",
            attachmentId: "attachment-1",
            status: "OPEN",
            assignedTo: {
              id: "staff-1",
              name: "Staff",
              email: "staff@example.com",
            },
          },
        ],
        attachments: [
          {
            id: "attachment-1",
            originalName: "fa.pdf",
            fileName: "stored-fa.pdf",
            fileUrl: "working-papers/project-1/paper-1/fa.pdf",
            mimeType: "application/pdf",
            lockedBy: "manager-1",
            lockedAt: new Date("2026-06-12T01:00:00Z"),
            lockHolder: {
              id: "manager-1",
              name: "Manager",
              email: "manager@example.com",
            },
          },
        ],
      },
      {
        id: "paper-2",
        code: "IA-F001",
        title: "Intangible assets roll-forward",
        signoffs: [
          signoff(
            "signoff-p",
            "PREPARER",
            "preparer-1",
            "2026-06-12T01:00:00Z"
          ),
          signoff(
            "signoff-r",
            "REVIEWER",
            "reviewer-1",
            "2026-06-12T02:00:00Z"
          ),
        ],
        reviewQuestions: [],
        attachments: [],
      },
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.report("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "partner-1"
    );
    expect(report.ready).toBeFalsy();
    expect(report.summary).toStrictEqual(
      expect.objectContaining({
        attachments: 1,
        blockers: 4,
        warnings: 0,
        missingPreparerSignoffs: 1,
        missingReviewerSignoffs: 1,
        unresolvedReviewQuestions: 1,
        lockedAttachments: 1,
      })
    );
    expect(report.issues.map((issue) => issue.type)).toStrictEqual([
      "MISSING_PREPARER_SIGNOFF",
      "MISSING_REVIEWER_SIGNOFF",
      "OPEN_REVIEW_QUESTION",
      "LOCKED_ATTACHMENT",
    ]);
    const signoffCheck = report.checks.find(
      (check) => check.id === "SIGNOFF_MISSING"
    );
    expect(signoffCheck?.issues).toHaveLength(1);
    expect(signoffCheck?.issues[0]?.message).toContain(
      "Missing preparer sign-off"
    );
    expect(signoffCheck?.issues[0]?.message).toContain(
      "Missing reviewer sign-off"
    );
  });

  it("exports a readable Typst PDF file check report", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      preparedPaper({
        attachment: {
          id: "attachment-pdf",
          originalName: "cash.pdf",
          fileName: "cash.pdf",
          fileUrl: "working-papers/project-1/paper-1/cash.pdf",
          mimeType: "application/pdf",
          lockedBy: null,
          lockedAt: null,
          lockHolder: null,
        },
      }),
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const file = await service.exportReportPdf("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(file.fileName).toBe("ABC-2026-AUD-file-check.pdf");
    expect(file.mimeType).toBe("application/pdf");
    expect(file.buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("groups PDF findings by the six web categories and attachment", () => {
    const officeIssues = ["Inserted A", "Inserted B", "Inserted C"].map(
      (excerpt) => ({
        type: "DOCX_TRACK_CHANGES" as const,
        severity: "WARNING" as const,
        message: `memo.docx contains ${excerpt}`,
        workingPaper: {
          id: "paper-1",
          code: "1100.1",
          title: "Revenue memo",
        },
        location: {
          attachmentId: "attachment-1",
          attachmentName: "memo.docx",
          projectPath: "1000 Planning / 1100 Revenue / 1100.1",
          excerpt,
        },
      })
    );
    const source = renderArchiveCheckTypstSource({
      project: {
        id: "project-1",
        projectCode: "ABC-2026-AUD",
        name: "ABC Holdings audit",
      },
      generatedAt: new Date("2026-06-12T09:00:00.000Z"),
      ready: true,
      summary: {
        attachments: 1,
        blockers: 0,
        warnings: 3,
        missingPreparerSignoffs: 0,
        missingReviewerSignoffs: 0,
        signoffDateIssues: 0,
        unresolvedReviewQuestions: 0,
        lockedAttachments: 0,
        incompleteSmartForms: 0,
        selfReviewedAttachments: 0,
        officeFileIssues: 3,
      },
      checks: [],
      issues: officeIssues,
    });

    expect(source).toContain("Office document checks");
    expect(source).toContain("1 affected file");
    expect(source).toContain("3 findings");
    expect(source).toContain("Word tracked changes (3)");
    expect(source).toContain("1000 Planning / 1100 Revenue / 1100.1");
    expect(source).not.toContain("Inserted A");
    expect(source).not.toContain("[Workpaper]");
  });

  it("allows archive when prepared and reviewed papers with cleared questions remain", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-1",
        code: "CASH-F001",
        title: "Cash lead schedule",
        signoffs: [
          signoff(
            "signoff-p",
            "PREPARER",
            "preparer-1",
            "2026-06-12T01:00:00Z",
            "attachment-1"
          ),
          signoff(
            "signoff-r",
            "REVIEWER",
            "reviewer-1",
            "2026-06-12T02:00:00Z",
            "attachment-1"
          ),
        ],
        reviewQuestions: [],
        attachments: [
          {
            id: "attachment-1",
            originalName: "cash.pdf",
            fileName: "stored-cash.pdf",
            fileUrl: "working-papers/project-1/paper-1/cash.pdf",
            mimeType: "application/pdf",
            lockedBy: null,
            lockedAt: null,
            lockHolder: null,
          },
        ],
      },
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );

    await expect(
      service.assertReadyForArchive("project-1")
    ).resolves.toStrictEqual(expect.objectContaining({ ready: true }));
  });

  it("requires preparer and reviewer sign-offs on each current attachment", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-1",
        code: "CASH-F001",
        title: "Cash lead schedule",
        signoffs: [
          signoff(
            "paper-signoff-p",
            "PREPARER",
            "preparer-1",
            "2026-06-12T01:00:00Z"
          ),
          signoff(
            "paper-signoff-r",
            "REVIEWER",
            "reviewer-1",
            "2026-06-12T02:00:00Z"
          ),
        ],
        reviewQuestions: [
          {
            id: "question-no-attachment",
            attachmentId: null,
            status: "OPEN",
            assignedTo: null,
          },
          {
            id: "question-deleted",
            attachmentId: "attachment-deleted",
            status: "OPEN",
            assignedTo: null,
          },
          {
            id: "question-prior",
            attachmentId: "attachment-prior",
            status: "OPEN",
            assignedTo: null,
          },
          {
            id: "question-temp",
            attachmentId: "attachment-temp",
            status: "OPEN",
            assignedTo: null,
          },
        ],
        attachments: [
          {
            id: "attachment-current",
            bucket: "CURRENT",
            deletedAt: null,
            originalName: "cash.pdf",
            fileName: "cash.pdf",
            fileUrl: "working-papers/project-1/paper-1/cash.pdf",
            mimeType: "application/pdf",
            lockedBy: null,
            lockedAt: null,
            lockHolder: null,
          },
        ],
      },
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.report("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(report.ready).toBeFalsy();
    expect(report.summary).toStrictEqual(
      expect.objectContaining({
        attachments: 1,
        missingPreparerSignoffs: 1,
        missingReviewerSignoffs: 1,
      })
    );
    expect(report.issues.map((issue) => issue.type)).toStrictEqual([
      "MISSING_PREPARER_SIGNOFF",
      "MISSING_REVIEWER_SIGNOFF",
    ]);
    expect(report.issues[0]).toStrictEqual(
      expect.objectContaining({
        attachment: expect.objectContaining({
          id: "attachment-current",
          name: "cash.pdf",
        }),
        action: {
          type: "OPEN_SIGNOFF",
          workingPaperId: "paper-1",
          attachmentId: "attachment-current",
        },
      })
    );
  });

  it("ignores deleted, prior, and temporary attachments during File Check", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-1",
        code: "CASH-F001",
        title: "Cash lead schedule",
        signoffs: [
          signoff(
            "paper-signoff-p",
            "PREPARER",
            "preparer-1",
            "2026-06-12T01:00:00Z"
          ),
          signoff(
            "paper-signoff-r",
            "REVIEWER",
            "reviewer-1",
            "2026-06-12T02:00:00Z"
          ),
        ],
        reviewQuestions: [],
        attachments: [
          {
            id: "attachment-deleted",
            bucket: "CURRENT",
            deletedAt: new Date("2026-06-13T01:00:00Z"),
            originalName: "deleted.pdf",
            fileName: "deleted.pdf",
            fileUrl: "working-papers/project-1/paper-1/deleted.pdf",
            mimeType: "application/pdf",
            lockedBy: "manager-1",
            lockedAt: new Date("2026-06-12T01:00:00Z"),
            lockHolder: {
              id: "manager-1",
              name: "Manager",
              email: "manager@example.com",
            },
          },
          {
            id: "attachment-prior",
            bucket: "PRIOR",
            deletedAt: null,
            originalName: "prior.pdf",
            fileName: "prior.pdf",
            fileUrl: "working-papers/project-1/paper-1/prior.pdf",
            mimeType: "application/pdf",
            lockedBy: "manager-1",
            lockedAt: new Date("2026-06-12T01:00:00Z"),
            lockHolder: {
              id: "manager-1",
              name: "Manager",
              email: "manager@example.com",
            },
          },
          {
            id: "attachment-temp",
            bucket: "TEMPORARY",
            deletedAt: null,
            originalName: "temp.sf",
            fileName: "temp.sf",
            fileUrl: "working-papers/project-1/paper-1/temp.sf",
            mimeType: "application/octet-stream",
            fileKind: "SMART_FORM",
            smartFormInstance: { status: "DRAFT" },
            lockedBy: null,
            lockedAt: null,
            lockHolder: null,
          },
        ],
      },
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.report("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(report.ready).toBeTruthy();
    expect(report.summary).toStrictEqual(
      expect.objectContaining({
        attachments: 0,
        blockers: 0,
        warnings: 0,
        unresolvedReviewQuestions: 0,
        lockedAttachments: 0,
        incompleteSmartForms: 0,
      })
    );
    expect(report.issues).toStrictEqual([]);
  });

  it("blocks archive when a Smart Form is incomplete", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      preparedPaper({
        attachment: {
          id: "attachment-smart-form",
          originalName: "independence.sf",
          fileName: "independence.sf",
          fileUrl: "working-papers/project-1/paper-1/independence.sf",
          mimeType: "application/vnd.project-wing.smart-form+json",
          fileKind: "SMART_FORM",
          smartFormInstance: { status: "INCOMPLETE" },
          lockedBy: null,
          lockedAt: null,
          lockHolder: null,
        },
      }),
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.report("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(report.ready).toBeFalsy();
    expect(report.summary.incompleteSmartForms).toBe(1);
    expect(report.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SMART_FORM_INCOMPLETE",
          severity: "BLOCKER",
          attachment: expect.objectContaining({
            id: "attachment-smart-form",
          }),
        }),
      ])
    );
    expect(
      report.checks.find((check) => check.id === "SMART_FORMS")
    ).toStrictEqual(
      expect.objectContaining({
        status: "BLOCKER",
        issues: expect.arrayContaining([
          expect.objectContaining({ type: "SMART_FORM_INCOMPLETE" }),
        ]),
      })
    );
  });

  it("allows archive when a Smart Form is complete", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      preparedPaper({
        attachment: {
          id: "attachment-smart-form",
          originalName: "independence.sf",
          fileName: "independence.sf",
          fileUrl: "working-papers/project-1/paper-1/independence.sf",
          mimeType: "application/vnd.project-wing.smart-form+json",
          fileKind: "SMART_FORM",
          smartFormInstance: { status: "COMPLETE" },
          lockedBy: null,
          lockedAt: null,
          lockHolder: null,
        },
      }),
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );

    await expect(
      service.assertReadyForArchive("project-1")
    ).resolves.toStrictEqual(expect.objectContaining({ ready: true }));
  });

  it("blocks archive when reviewer signed before preparer", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-1",
        code: "REV-F001",
        title: "Revenue testing",
        signoffs: [
          signoff(
            "signoff-p",
            "PREPARER",
            "preparer-1",
            "2026-06-12T03:00:00Z",
            "attachment-1"
          ),
          signoff(
            "signoff-r",
            "REVIEWER",
            "reviewer-1",
            "2026-06-12T02:00:00Z",
            "attachment-1"
          ),
        ],
        reviewQuestions: [],
        attachments: [
          {
            id: "attachment-1",
            originalName: "revenue.pdf",
            fileName: "stored-revenue.pdf",
            fileUrl: "working-papers/project-1/paper-1/revenue.pdf",
            mimeType: "application/pdf",
            lockedBy: null,
            lockedAt: null,
            lockHolder: null,
          },
        ],
      },
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.report("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(report.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "REVIEW_SIGNOFF_BEFORE_PREPARER",
          severity: "BLOCKER",
        }),
      ])
    );
  });

  it("blocks archive when the same member prepared and reviewed a paper", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-1",
        code: "CASH-F001",
        title: "Cash lead schedule",
        signoffs: [
          signoff(
            "signoff-preparer",
            "PREPARER",
            "member-1",
            "2026-06-12T01:00:00Z",
            "attachment-1"
          ),
          signoff(
            "signoff-reviewer",
            "REVIEWER",
            "member-1",
            "2026-06-12T02:00:00Z",
            "attachment-1"
          ),
        ],
        reviewQuestions: [],
        attachments: [
          {
            id: "attachment-1",
            originalName: "cash.pdf",
            fileName: "stored-cash.pdf",
            fileUrl: "working-papers/project-1/paper-1/cash.pdf",
            mimeType: "application/pdf",
            lockedBy: null,
            lockedAt: null,
            lockHolder: null,
          },
        ],
      },
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.report("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(report.ready).toBeFalsy();
    expect(report.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SELF_REVIEWED_WORKING_PAPER",
          severity: "BLOCKER",
          message:
            "CASH-F001 cash.pdf was prepared and reviewed by User member-1",
        }),
      ])
    );
  });

  it("uses the latest effective reviewer signoff when evaluating self review", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-1",
        code: "CASH-F001",
        title: "Cash lead schedule",
        signoffs: [
          signoff(
            "signoff-preparer",
            "PREPARER",
            "member-1",
            "2026-06-12T01:00:00Z",
            "attachment-1"
          ),
          signoff(
            "signoff-self-review",
            "REVIEWER",
            "member-1",
            "2026-06-12T02:00:00Z",
            "attachment-1"
          ),
          signoff(
            "signoff-independent-review",
            "REVIEWER",
            "member-2",
            "2026-06-12T03:00:00Z",
            "attachment-1"
          ),
        ],
        reviewQuestions: [],
        attachments: [
          {
            id: "attachment-1",
            originalName: "cash.pdf",
            fileName: "stored-cash.pdf",
            fileUrl: "working-papers/project-1/paper-1/cash.pdf",
            mimeType: "application/pdf",
            lockedBy: null,
            lockedAt: null,
            lockHolder: null,
          },
        ],
      },
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.report("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(report.issues).not.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SELF_REVIEWED_WORKING_PAPER",
        }),
      ])
    );
  });

  it("reports Word track changes and unresolved comments", async () => {
    prisma.workflowNode.findMany.mockResolvedValue([
      { id: "node-1000", parentId: null, code: "1000", title: "Planning" },
      {
        id: "node-1100",
        parentId: "node-1000",
        code: "1100",
        title: "Revenue",
      },
    ]);
    storage.getObjectBuffer.mockResolvedValue(
      await buildDocxBuffer({
        documentXml:
          '<w:document xmlns:w="w"><w:body><w:ins><w:r><w:t>Inserted text</w:t></w:r></w:ins><w:del><w:r><w:t>Deleted text</w:t></w:r></w:del></w:body></w:document>',
        commentsXml:
          '<w:comments xmlns:w="w"><w:comment w:id="0" w:author="Reviewer"><w:p><w:r><w:t>Please resolve</w:t></w:r></w:p></w:comment></w:comments>',
      })
    );
    prisma.workingPaper.findMany.mockResolvedValue([
      preparedPaper({
        attachment: {
          id: "attachment-docx",
          originalName: "memo.docx",
          fileName: "memo.docx",
          fileUrl: "working-papers/project-1/paper-1/memo.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          lockedBy: null,
          lockedAt: null,
          lockHolder: null,
        },
      }),
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.report("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(report.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "DOCX_TRACK_CHANGES",
          severity: "WARNING",
          location: expect.objectContaining({
            excerpt: "Inserted text",
            projectPath: "1000 Planning / 1100 Revenue / CASH-F001",
          }),
        }),
        expect.objectContaining({
          type: "DOCX_TRACK_CHANGES",
          location: expect.objectContaining({ excerpt: "Deleted text" }),
        }),
        expect.objectContaining({
          type: "DOCX_UNRESOLVED_COMMENT",
          severity: "WARNING",
          location: expect.objectContaining({
            commentAuthor: "Reviewer",
            excerpt: "Please resolve",
          }),
        }),
      ])
    );
    expect(report.ready).toBeTruthy();
    expect(report.summary.blockers).toBe(0);
    expect(report.summary.warnings).toBe(3);
  });

  it("reports Excel comments and error values with locations", async () => {
    storage.getObjectBuffer.mockResolvedValue(await buildXlsxBuffer());
    prisma.workingPaper.findMany.mockResolvedValue([
      preparedPaper({
        attachment: {
          id: "attachment-xlsx",
          originalName: "errors.xlsx",
          fileName: "errors.xlsx",
          fileUrl: "working-papers/project-1/paper-1/errors.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          lockedBy: null,
          lockedAt: null,
          lockHolder: null,
        },
      }),
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.report("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(report.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "XLSX_UNRESOLVED_COMMENT",
          severity: "WARNING",
          location: expect.objectContaining({
            sheetName: "Sheet1",
            cellAddress: "A1",
            excerpt: "Needs follow-up",
          }),
        }),
        expect.objectContaining({
          type: "XLSX_ERROR_VALUE",
          severity: "WARNING",
          location: expect.objectContaining({
            sheetName: "Sheet1",
            cellAddress: "B2",
            value: "#REF!",
          }),
        }),
      ])
    );
  });

  it("does not block archive when Excel error values are the only file check issue", async () => {
    storage.getObjectBuffer.mockResolvedValue(await buildXlsxErrorOnlyBuffer());
    prisma.workingPaper.findMany.mockResolvedValue([
      preparedPaper({
        attachment: {
          id: "attachment-xlsx",
          originalName: "errors.xlsx",
          fileName: "errors.xlsx",
          fileUrl: "working-papers/project-1/paper-1/errors.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          lockedBy: null,
          lockedAt: null,
          lockHolder: null,
        },
      }),
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const report = await service.assertReadyForArchive("project-1");

    expect(report.ready).toBeTruthy();
    expect(report.summary.blockers).toBe(0);
    expect(report.summary.warnings).toBe(1);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        type: "XLSX_ERROR_VALUE",
        severity: "WARNING",
      })
    );
  });

  it("blocks archive when a current attachment has file check blockers", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-1",
        code: "REV-F001",
        title: "Revenue testing",
        signoffs: [],
        reviewQuestions: [],
        attachments: [
          {
            id: "attachment-1",
            originalName: "revenue.pdf",
            fileName: "stored-revenue.pdf",
            fileUrl: "working-papers/project-1/paper-1/revenue.pdf",
            mimeType: "application/pdf",
            lockedBy: null,
            lockedAt: null,
            lockHolder: null,
          },
        ],
      },
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );

    await expect(service.assertReadyForArchive("project-1")).rejects.toThrow(
      ApiBadRequestException
    );
  });

  it("runs archive checks as a job and exposes the completed report", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([
      preparedPaper({
        attachment: {
          id: "attachment-pdf",
          originalName: "cash.pdf",
          fileName: "cash.pdf",
          fileUrl: "working-papers/project-1/paper-1/cash.pdf",
          mimeType: "application/pdf",
          lockedBy: null,
          lockedAt: null,
          lockHolder: null,
        },
      }),
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const started = await service.startJob("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);
    const completed = await waitForArchiveJob(service, started.jobId);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "partner-1"
    );
    expect(started).toStrictEqual(
      expect.objectContaining({
        jobId: expect.any(String),
        projectId: "project-1",
      })
    );
    expect(completed.status).toBe("completed");
    expect(completed.report).toStrictEqual(
      expect.objectContaining({ ready: true })
    );
    expect(completed.progress.completedUnits).toBe(
      completed.progress.totalUnits
    );
    expect(
      completed.progress.groups.every((group) => group.status)
    ).toBeTruthy();
  });

  it("reports the office file currently being inspected by a running job", async () => {
    let resolveBuffer!: (buffer: Buffer) => void;
    storage.getObjectBuffer.mockImplementation(
      () =>
        new Promise<Buffer>((resolve) => {
          resolveBuffer = resolve;
        })
    );
    prisma.workingPaper.findMany.mockResolvedValue([
      preparedPaper({
        attachment: {
          id: "attachment-xlsx",
          originalName: "errors.xlsx",
          fileName: "errors.xlsx",
          fileUrl: "working-papers/project-1/paper-1/errors.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          lockedBy: null,
          lockedAt: null,
          lockHolder: null,
        },
      }),
    ]);
    const service = new ArchiveCheckService(
      prisma as never,
      access as never,
      storage as never
    );
    const started = await service.startJob("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);
    const running = await waitForArchiveJob(
      service,
      started.jobId,
      (job) => job.currentLabel?.includes("errors.xlsx") === true
    );

    expect(running.status).toBe("running");
    expect(running.currentPhase).toBe("officeFiles");
    expect(running.currentLabel).toContain("CASH-F001");
    expect(running.progress.groups).toContainEqual(
      expect.objectContaining({
        id: "officeFiles",
        status: "running",
        completedUnits: 0,
        totalUnits: 1,
      })
    );

    resolveBuffer(await buildXlsxErrorOnlyBuffer());
    const completed = await waitForArchiveJob(service, started.jobId);

    expect(completed.status).toBe("completed");
    expect(completed.progress.groups).toContainEqual(
      expect.objectContaining({
        id: "officeFiles",
        status: "completed",
        completedUnits: 1,
        totalUnits: 1,
      })
    );
    expect(completed.report?.summary.warnings).toBe(1);
  });
});

function signoff(
  id: string,
  type: "PREPARER" | "REVIEWER",
  userId: string,
  signedAt: string,
  attachmentId: string | null = null
) {
  return {
    id,
    attachmentId,
    userId,
    type,
    signedAt: new Date(signedAt),
    user: {
      id: userId,
      name: `User ${userId}`,
      email: `${userId}@example.com`,
    },
  };
}

function preparedPaper({
  attachment,
}: {
  attachment: Record<string, unknown>;
}) {
  const attachmentId =
    typeof attachment.id === "string" ? attachment.id : "attachment-1";
  return {
    id: "paper-1",
    code: "CASH-F001",
    title: "Cash lead schedule",
    workflowNodeId: "node-1100",
    signoffs: [
      signoff(
        "signoff-p",
        "PREPARER",
        "preparer-1",
        "2026-06-12T01:00:00Z",
        attachmentId
      ),
      signoff(
        "signoff-r",
        "REVIEWER",
        "reviewer-1",
        "2026-06-12T02:00:00Z",
        attachmentId
      ),
    ],
    reviewQuestions: [],
    attachments: [attachment],
  };
}

async function buildDocxBuffer({
  documentXml,
  commentsXml,
}: {
  documentXml: string;
  commentsXml: string;
}) {
  await Promise.resolve();
  const zip = XLSX.CFB.utils.cfb_new({ root: "Root Entry" });
  XLSX.CFB.utils.cfb_add(zip, "word/document.xml", Buffer.from(documentXml));
  XLSX.CFB.utils.cfb_add(zip, "word/comments.xml", Buffer.from(commentsXml));
  return XLSX.CFB.write(zip, { type: "buffer", fileType: "zip" }) as Buffer;
}

async function buildXlsxBuffer() {
  await Promise.resolve();
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Has comment"], [null, "#REF!"]]);
  sheet.B2 = { t: "e", v: 23, w: "#REF!" };
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
  const zip = XLSX.CFB.read(buffer, { type: "buffer" });
  XLSX.CFB.utils.cfb_add(
    zip,
    "xl/worksheets/_rels/sheet1.xml.rels",
    Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/></Relationships>'
    )
  );
  XLSX.CFB.utils.cfb_add(
    zip,
    "xl/comments1.xml",
    Buffer.from(
      '<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors><author>Reviewer</author></authors><commentList><comment ref="A1" authorId="0"><text><r><t>Needs follow-up</t></r></text></comment></commentList></comments>'
    )
  );
  return XLSX.CFB.write(zip, { type: "buffer", fileType: "zip" }) as Buffer;
}

async function buildXlsxErrorOnlyBuffer() {
  await Promise.resolve();
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([[null, "#REF!"]]);
  sheet.B1 = { t: "e", v: 23, w: "#REF!" };
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

async function waitForArchiveJob(
  service: ArchiveCheckService,
  jobId: string,
  predicate: (
    job: Awaited<ReturnType<ArchiveCheckService["getJob"]>>
  ) => boolean = (job) => job.status === "completed"
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const job = await service.getJob("project-1", jobId, {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);
    if (predicate(job)) {
      return job;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  throw new Error("Timed out waiting for archive check job");
}
