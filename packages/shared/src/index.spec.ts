import { describe, expect, it } from "vitest";

import * as Shared from "./index";
import {
  AcceptInvitationSchema,
  ApplyProjectTemplateSchema,
  AttachmentFileKindSchema,
  CMP_DEMO_CLIENTS,
  CMP_DEMO_ENGAGEMENTS,
  ConfirmAttachmentUploadSchema,
  CreateInvitationSchema,
  CreateProjectSchema,
  CreateWorkflowNodeSchema,
  CreateWorkspaceSchema,
  GLOBAL_ROLE_METADATA,
  GlobalRoleSchema,
  ImportProjectTemplateZipSchema,
  MoveProjectPlacementSchema,
  ProjectRoleSchema,
  RelocateAttachmentSchema,
  RequestAttachmentUploadUrlSchema,
  ReturnWorkingPaperSchema,
  SmartFormPackageSchema,
  UpdateProjectMemberInChargeRoleSchema,
  UpdateProjectMemberRoleSchema,
  UpdateProjectSchema,
  UpdateUserSchema,
  UpdateWorkflowNodeSchema,
  UpdateWorkingPaperAssigneesSchema,
  UpdateWorkspaceSchema,
  UserListQuerySchema,
  ZipMasterEntrySchema,
  ZipMasterOperationSchema,
  buildTmsEngagementDirectoryFromCmp,
  canGlobalRoleManageConfirmationTemplates,
  canGlobalRoleCreateProject,
  canGlobalRoleManageProjectMembers,
  canProjectMemberPerformAction,
  getAssignableProjectRoleLabelsForGlobalRole,
  getAssignableProjectRolesForGlobalRole,
  getDeniedProjectPermissionTreatment,
  getInChargeRoleForGlobalRole,
  getProjectInvitationEligibility,
  isDesktopAgentOpenSupportedFileName,
  isInChargeRoleAssignableToGlobalRole,
  isProjectRoleAssignableToGlobalRole,
  isProjectWingMasterSupportedFileName,
  isSmartFormSupportedFileName,
  isZipMasterSupportedFileName,
} from "./index";

describe("system connection schemas", () => {
  it("requires a non-empty 17TRACK API key", () => {
    expect(
      Shared.ConnectTracking17TrackSchema.safeParse({ apiKey: " key-17 " }).data
    ).toStrictEqual({
      apiKey: "key-17",
    });
    expect(
      Shared.ConnectTracking17TrackSchema.safeParse({ apiKey: "" }).success
    ).toBeFalsy();
  });
});

describe("inbox content contracts", () => {
  it("accepts supported structured message keys and rejects unknown keys", () => {
    expect(
      Shared.InboxContentKeySchema.safeParse("CMP_ACCEPTANCE_APPROVED").success
    ).toBeTruthy();
    expect(
      Shared.InboxContentKeySchema.safeParse("UNREGISTERED_MESSAGE").success
    ).toBeFalsy();
  });
});

describe("work item contracts", () => {
  it("keeps the approved 50-rule implementation catalog explicit", () => {
    expect(Shared.IMPLEMENTED_WORK_ITEM_RULE_IDS).toHaveLength(50);
    expect(new Set(Shared.IMPLEMENTED_WORK_ITEM_RULE_IDS).size).toBe(50);
    expect(Shared.NON_WORK_ITEM_RULE_IDS).toContain("TMS-002");
    expect(
      Shared.NON_WORK_ITEM_RULE_IDS.some(
        (ruleId) => Shared.WorkItemRuleIdSchema.safeParse(ruleId).success
      )
    ).toBeFalsy();
  });

  it("accepts a structured team work item and rejects raw URL actions", () => {
    const result = Shared.WorkItemSchema.safeParse({
      id: "PRJ-005:q-1",
      ruleId: "PRJ-005",
      domain: "PROJECT",
      view: "TEAM",
      category: "REVIEW",
      state: "OPEN",
      severity: "BLOCKER",
      priority: "HIGH",
      title: "Question remains uncleared",
      description: "Reply or clear the question",
      subjectType: "REVIEW_QUESTION",
      subjectId: "q-1",
      project: { id: "p-1", projectCode: "AUD-1", name: "Audit" },
      reference: "A1",
      objectLabel: "Cash",
      responsibleLabel: "Reviewer",
      assignedTo: null,
      createdBy: null,
      dueAt: null,
      openedAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
      actionTarget: {
        app: "PROJECT",
        resourceType: "REVIEW_QUESTION",
        resourceId: "q-1",
        params: { projectId: "p-1" },
      },
    });
    expect(result.success).toBeTruthy();
    expect(
      Shared.WorkItemActionTargetSchema.safeParse({
        app: "PROJECT",
        resourceType: "REVIEW_QUESTION",
        resourceId: "q-1",
        params: { url: { pathname: "/engagement/p-1" } },
      }).success
    ).toBeFalsy();
  });

  it("renders localized sentence templates with business parameters", () => {
    const template = {
      "zh-CN": "您还没有填报 {{period}}的工时，请尽快填报。",
      "en-US": "You have not completed your timesheet for {{period}}.",
    };

    expect(
      Shared.renderWorkItemSentence("zh-CN", template, {
        period: "2026 年 8 月下半月",
      })
    ).toBe("您还没有填报 2026 年 8 月下半月的工时，请尽快填报。");
    expect(() => Shared.renderWorkItemSentence("en-US", template, {})).toThrow(
      "Missing work-item sentence parameter: period"
    );
  });
});

describe("confirmation template identities", () => {
  it("keeps the restored standard code and the HK English overlay as separate codes", () => {
    expect(
      Shared.ConfirmationDraftTemplateCodeSchema.safeParse(
        "STANDARD_FINANCIAL_INSTITUTION"
      ).success
    ).toBeTruthy();
    expect(
      Shared.ConfirmationDraftTemplateCodeSchema.safeParse(
        "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
      ).success
    ).toBeTruthy();
    expect(Shared.ConfirmationBuiltinTemplateCodeSchema.options).toStrictEqual([
      "PRC_BANK_TEMPLATE_1",
      "PRC_BANK_TEMPLATE_2",
      "SHINEWING_ENG_BANK",
      "STANDARD_FINANCIAL_INSTITUTION",
      "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
    ]);
  });

  it("accepts a library template code while rejecting malformed custom codes", () => {
    expect(
      Shared.ConfirmationDraftTemplateCodeSchema.safeParse("CTPL-42EE80005D40")
        .success
    ).toBeTruthy();
    expect(
      Shared.ConfirmationDraftTemplateCodeSchema.safeParse("CTPL-test").success
    ).toBeFalsy();
  });
});

describe("confirmation draft payload", () => {
  it("parses and trims salutation while enforcing its 120-character limit", () => {
    expect(
      Shared.ConfirmationDraftPayloadSchema.parse({
        salutation: "  Dear Sirs  ",
      })
    ).toStrictEqual({ salutation: "Dear Sirs" });
    expect(
      Shared.ConfirmationDraftPayloadSchema.safeParse({
        salutation: "x".repeat(121),
      }).success
    ).toBeFalsy();
  });
});

describe("confirmation EMP import contract", () => {
  const sourceProposal = {
    sourceConfirmationId: "confirmation-1",
    empCode: "A1-F001",
    businessName: "Orchid Bank outgoing confirmation",
  };
  const previewResponse = {
    projectId: "project-1",
    mode: "GROUPED",
    targetDirectoryId: "directory-1",
    targetDirectories: [
      {
        id: "directory-1",
        code: "A1",
        title: "Planning",
        path: "Planning",
        level: 1,
        canAcceptWorkflow: true,
      },
    ],
    batchDirectory: { code: "A1-B001", name: "Confirmation responses" },
    zipWorkingPaper: null,
    counts: { eligible: 1, imported: 0, blocked: 0 },
    items: [
      {
        id: "source-1",
        sourceConfirmationId: "confirmation-1",
        confirmationId: "confirmation-1",
        confirmationCode: "CONF-001",
        counterparty: "Orchid Bank",
        role: "OUTGOING",
        sourceFileName: "outgoing.msg",
        sourceFileSize: 42,
        sourceProposal,
        status: "ELIGIBLE",
        existingLocation: null,
        existingCode: null,
        signoff: {
          preparerName: "Preparer",
          reviewerName: "Reviewer",
          manual: false,
        },
        zipEntryName: null,
        blockingIssues: [],
      },
    ],
    zipEntries: [],
    blockers: [],
    fingerprint: "preview-fingerprint-1",
  };

  it("keeps EMP code and business name separate and rejects unknown fields", () => {
    const schema = (
      Shared as unknown as Record<
        string,
        { parse: (value: unknown) => unknown }
      >
    ).ConfirmationEmpImportSourceProposalSchema;

    expect(schema).toBeDefined();
    if (!schema) {
      return;
    }
    expect(schema.parse(sourceProposal)).toStrictEqual(sourceProposal);
    expect(() =>
      schema.parse({ ...sourceProposal, name: "legacy combined name" })
    ).toThrow(/./);
  });

  it("expresses mode-specific containers, fingerprinted create jobs, and withdraw scope", () => {
    const querySchema = (
      Shared as unknown as Record<
        string,
        { parse: (value: unknown) => unknown }
      >
    ).ConfirmationEmpImportPreviewQuerySchema;
    const previewSchema = (
      Shared as unknown as Record<
        string,
        { parse: (value: unknown) => unknown }
      >
    ).ConfirmationEmpImportPreviewResponseSchema;
    const createSchema = (
      Shared as unknown as Record<
        string,
        { parse: (value: unknown) => unknown }
      >
    ).CreateConfirmationEmpImportJobSchema;
    const withdrawSchema = (
      Shared as unknown as Record<
        string,
        { parse: (value: unknown) => unknown }
      >
    ).WithdrawConfirmationEmpImportSchema;
    const restoreSchema = (
      Shared as unknown as Record<
        string,
        { parse: (value: unknown) => unknown }
      >
    ).RestoreConfirmationEmpImportSchema;
    const retrySchema = (
      Shared as unknown as Record<
        string,
        { parse: (value: unknown) => unknown }
      >
    ).RetryConfirmationEmpImportSchema;

    expect(querySchema).toBeDefined();
    expect(previewSchema).toBeDefined();
    expect(createSchema).toBeDefined();
    expect(withdrawSchema).toBeDefined();
    expect(restoreSchema).toBeDefined();
    expect(retrySchema).toBeDefined();
    if (
      !querySchema ||
      !previewSchema ||
      !createSchema ||
      !withdrawSchema ||
      !restoreSchema ||
      !retrySchema
    ) {
      return;
    }

    expect(
      querySchema.parse({
        mode: "ZIP",
        targetDirectoryId: "directory-1",
        confirmationId: "confirmation-1",
      })
    ).toStrictEqual({
      mode: "ZIP",
      targetDirectoryId: "directory-1",
      confirmationId: "confirmation-1",
    });
    expect(
      querySchema.parse({
        mode: "ZIP",
        confirmationIds: "confirmation-1",
      })
    ).toStrictEqual({
      mode: "ZIP",
      confirmationIds: ["confirmation-1"],
    });
    expect(() =>
      querySchema.parse({
        mode: "ZIP",
        confirmationIds: " ",
      })
    ).toThrow(/./);
    expect(
      querySchema.parse({
        mode: "ZIP",
        targetDirectoryId: "directory-1",
        confirmationIds: ["confirmation-1", "confirmation-1", "confirmation-2"],
      })
    ).toStrictEqual({
      mode: "ZIP",
      targetDirectoryId: "directory-1",
      confirmationIds: ["confirmation-1", "confirmation-2"],
    });
    expect(() =>
      querySchema.parse({
        mode: "ZIP",
        targetDirectoryId: "directory-1",
        confirmationIds: [],
      })
    ).toThrow(/./);
    expect(previewSchema.parse(previewResponse)).toStrictEqual(previewResponse);
    expect(
      previewSchema.parse({
        ...previewResponse,
        mode: "ZIP",
        batchDirectory: null,
        zipWorkingPaper: {
          code: "A1-F001",
          name: "Confirmation responses.zip",
        },
      })
    ).toMatchObject({ mode: "ZIP", zipWorkingPaper: { code: "A1-F001" } });

    expect(
      createSchema.parse({
        mode: "GROUPED",
        targetDirectoryId: "directory-1",
        previewFingerprint: previewResponse.fingerprint,
        batchDirectory: previewResponse.batchDirectory,
        items: [
          {
            id: "source-1",
            sourceConfirmationId: "confirmation-1",
            empCode: sourceProposal.empCode,
            businessName: sourceProposal.businessName,
          },
        ],
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      })
    ).toMatchObject({
      mode: "GROUPED",
      previewFingerprint: previewResponse.fingerprint,
    });
    expect(
      createSchema.parse({
        mode: "ZIP",
        targetDirectoryId: "directory-1",
        previewFingerprint: previewResponse.fingerprint,
        zipWorkingPaper: {
          code: "A1-F001",
          name: "Confirmation responses.zip",
        },
        items: [
          {
            id: "source-1",
            sourceConfirmationId: "confirmation-1",
            empCode: sourceProposal.empCode,
            businessName: sourceProposal.businessName,
          },
        ],
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      })
    ).toMatchObject({ mode: "ZIP", zipWorkingPaper: { code: "A1-F001" } });
    expect(retrySchema.parse({})).toStrictEqual({});

    expect(
      withdrawSchema.parse({
        mode: "GROUPED",
        scope: "SOURCE_CONFIRMATION",
        sourceConfirmationId: "confirmation-1",
      })
    ).toStrictEqual({
      mode: "GROUPED",
      scope: "SOURCE_CONFIRMATION",
      sourceConfirmationId: "confirmation-1",
    });
    expect(withdrawSchema.parse({ mode: "ZIP", scope: "JOB" })).toStrictEqual({
      mode: "ZIP",
      scope: "JOB",
    });
    expect(
      withdrawSchema.parse({
        mode: "ZIP",
        scope: "ITEM",
        itemId: "item-1",
      })
    ).toStrictEqual({ mode: "ZIP", scope: "ITEM", itemId: "item-1" });
    expect(() =>
      restoreSchema.parse({ mode: "ZIP", scope: "ITEM", itemId: "item-1" })
    ).toThrow(/./);
    expect(
      withdrawSchema.parse({
        mode: "GROUPED",
        scope: "JOB",
        force: true,
      })
    ).toStrictEqual({ mode: "GROUPED", scope: "JOB", force: true });
    expect(() =>
      withdrawSchema.parse({
        mode: "ZIP",
        scope: "SOURCE_CONFIRMATION",
        sourceConfirmationId: "confirmation-1",
      })
    ).toThrow(/./);
    expect(
      restoreSchema.parse({
        mode: "GROUPED",
        scope: "SOURCE_CONFIRMATION",
        sourceConfirmationId: "confirmation-1",
      })
    ).toStrictEqual({
      mode: "GROUPED",
      scope: "SOURCE_CONFIRMATION",
      sourceConfirmationId: "confirmation-1",
    });
    expect(restoreSchema.parse({ mode: "ZIP", scope: "JOB" })).toStrictEqual({
      mode: "ZIP",
      scope: "JOB",
    });
    expect(() =>
      restoreSchema.parse({
        mode: "ZIP",
        scope: "SOURCE_CONFIRMATION",
        sourceConfirmationId: "confirmation-1",
      })
    ).toThrow(/./);
  });

  it("allows writable workflow directories at unknown depth and validates eligible projects", () => {
    const directorySelectionSchema = (
      Shared as unknown as Record<
        string,
        { safeParse: (value: unknown) => { success: boolean } }
      >
    ).ConfirmationEmpImportDirectorySelectionSchema;
    const eligibleProjectsSchema = (
      Shared as unknown as Record<
        string,
        { parse: (value: unknown) => unknown }
      >
    ).ConfirmationEmpImportEligibleProjectsResponseSchema;

    expect(directorySelectionSchema).toBeDefined();
    expect(eligibleProjectsSchema).toBeDefined();
    if (!directorySelectionSchema || !eligibleProjectsSchema) {
      return;
    }

    const levelThreeDirectory = {
      id: "directory-3",
      code: "A1-1000",
      title: "Cash",
      path: "Planning / Cash / Cash",
      level: 3,
      canAcceptWorkflow: true,
    };
    expect(
      directorySelectionSchema.safeParse({
        mode: "FLAT",
        directory: levelThreeDirectory,
      }).success
    ).toBeTruthy();
    expect(
      directorySelectionSchema.safeParse({
        mode: "ZIP",
        directory: levelThreeDirectory,
      }).success
    ).toBeTruthy();
    expect(
      directorySelectionSchema.safeParse({
        mode: "GROUPED",
        directory: levelThreeDirectory,
      }).success
    ).toBeTruthy();
    expect(
      directorySelectionSchema.safeParse({
        mode: "GROUPED",
        directory: { ...levelThreeDirectory, level: 8 },
      }).success
    ).toBeTruthy();
    expect(
      directorySelectionSchema.safeParse({
        mode: "FLAT",
        directory: { ...levelThreeDirectory, canAcceptWorkflow: false },
      }).success
    ).toBeFalsy();

    expect(
      eligibleProjectsSchema.parse({
        projects: [{ id: "project-1", code: "AUD-001", name: "Orchid Audit" }],
      })
    ).toStrictEqual({
      projects: [{ id: "project-1", code: "AUD-001", name: "Orchid Audit" }],
    });
    expect(() =>
      eligibleProjectsSchema.parse({
        projects: [
          {
            id: "project-1",
            code: "AUD-001",
            name: "Orchid Audit",
            status: "ACTIVE",
          },
        ],
      })
    ).toThrow(/./);
  });

  it("keeps target code and location on imported job items", () => {
    expect(
      Shared.ConfirmationEmpImportJobSchema.parse({
        id: "job-1",
        projectId: "project-1",
        mode: "FLAT",
        status: "COMPLETED",
        total: 1,
        completed: 1,
        failed: 0,
        retryable: false,
        previewFingerprint: "fingerprint-1",
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
        withdrawnAt: null,
        items: [
          {
            id: "source-1",
            sourceConfirmationId: "confirmation-1",
            confirmationId: "confirmation-1",
            sourceFileName: "evidence.msg",
            status: "COMPLETED",
            targetLocation: "Planning / A1-F001",
            targetCode: "A1-F001",
            errorMessage: null,
            retryable: false,
          },
        ],
      }).items[0]
    ).toMatchObject({
      targetLocation: "Planning / A1-F001",
      targetCode: "A1-F001",
    });
  });
});

describe("confirmation attachment contract", () => {
  it("preserves original metadata and safe download/preview hints", () => {
    const attachment = Shared.ConfirmationAttachmentContractSchema.parse({
      originalFileName: "evidence.msg",
      originalMimeType: "application/vnd.ms-outlook",
      previewability: "DOWNLOAD_ONLY",
      downloadUrl:
        "/engagement/project-1/confirmations/confirmation-1/attachment/download",
      previewUrl: null,
    });

    expect(attachment).toStrictEqual({
      originalFileName: "evidence.msg",
      originalMimeType: "application/vnd.ms-outlook",
      previewability: "DOWNLOAD_ONLY",
      downloadUrl:
        "/engagement/project-1/confirmations/confirmation-1/attachment/download",
      previewUrl: null,
    });
    expect(
      Shared.ConfirmationAttachmentContractSchema.safeParse({
        originalFileName: "confirmation.pdf",
        originalMimeType: "application/pdf",
        previewability: "INLINE",
      }).success
    ).toBeTruthy();
  });
});

describe("confirmation response review schema", () => {
  it("accepts review lifecycle events", () => {
    expect(
      Shared.ConfirmationFollowUpEventTypeSchema.parse("REVIEW_RECORDED")
    ).toBe("REVIEW_RECORDED");
    expect(
      Shared.ConfirmationFollowUpEventTypeSchema.parse("REVIEW_RETRACTED")
    ).toBe("REVIEW_RETRACTED");
  });

  it("requires a resolution action for mismatched responses", () => {
    expect(
      Shared.ReviewProjectConfirmationResponseSchema.safeParse({
        result: "MISMATCHED",
      }).success
    ).toBeFalsy();
    expect(
      Shared.ReviewProjectConfirmationResponseSchema.parse({
        result: "MISMATCHED",
        action: "REDISPATCH",
        notes: "Send an updated request",
      })
    ).toStrictEqual({
      result: "MISMATCHED",
      action: "REDISPATCH",
      notes: "Send an updated request",
    });
  });

  it("rejects an action for matched responses", () => {
    expect(
      Shared.ReviewProjectConfirmationResponseSchema.safeParse({
        result: "MATCHED",
        action: "ALTERNATIVE_PROCEDURE",
      }).success
    ).toBeFalsy();
  });
});

describe("tMS timesheet query schemas", () => {
  it("applies safe query defaults and rejects invalid ranges", () => {
    expect(Shared.TmsTimesheetQuerySchema.parse({})).toMatchObject({
      mode: "DETAIL",
      page: 1,
      pageSize: 50,
      sortBy: "JOB_CODE",
      sortDirection: "asc",
    });
    expect(
      Shared.TmsTimesheetQuerySchema.safeParse({
        dateFrom: "2026-07-31",
        dateTo: "2026-07-01",
      }).success
    ).toBeFalsy();
    expect(
      Shared.TmsTimesheetQuerySchema.safeParse({ pageSize: 101 }).success
    ).toBeFalsy();
  });
});

describe("working paper review question schemas", () => {
  it("accepts a Smart Form row locator", () => {
    expect(
      Shared.CreateWorkingPaperQuestionSchema.parse({
        body: "Please explain this row.",
        smartFormNodeId: "deferred-income-general-procedures",
        smartFormRowId: "deferred-income-procedure-2-a",
        smartFormTargetLabel: "Compare the current and prior periods",
      })
    ).toMatchObject({
      smartFormNodeId: "deferred-income-general-procedures",
      smartFormRowId: "deferred-income-procedure-2-a",
      smartFormTargetLabel: "Compare the current and prior periods",
    });
  });

  it("rejects a Smart Form row locator without its containing node", () => {
    expect(
      Shared.CreateWorkingPaperQuestionSchema.safeParse({
        body: "Please explain this row.",
        smartFormRowId: "deferred-income-procedure-2-a",
      }).success
    ).toBeFalsy();
  });

  it("rejects a Smart Form target label without its containing node", () => {
    expect(
      Shared.CreateWorkingPaperQuestionSchema.safeParse({
        body: "Please explain this item.",
        smartFormTargetLabel: "Audit procedure 4",
      }).success
    ).toBeFalsy();
  });
});

describe("cMP client status lifecycle", () => {
  const client = { clientCode: "C-001", nameEn: "Client Limited" };

  it("allows only Active or Inactive when creating a client", () => {
    expect(
      Shared.CreateCmpClientSchema.safeParse({ ...client, status: "ACTIVE" })
        .success
    ).toBeTruthy();
    expect(
      Shared.CreateCmpClientSchema.safeParse({ ...client, status: "INACTIVE" })
        .success
    ).toBeTruthy();
    expect(
      Shared.CreateCmpClientSchema.safeParse({ ...client, status: "RESIGNED" })
        .success
    ).toBeFalsy();
  });

  it("allows Resigned in changes and acceptance drafts", () => {
    expect(
      Shared.UpdateCmpClientSchema.safeParse({ status: "RESIGNED" }).success
    ).toBeTruthy();
    expect(
      Shared.CmpClientAcceptanceDraftPayloadSchema.safeParse({
        status: "RESIGNED",
      }).success
    ).toBeTruthy();
  });

  it("rejects retired PRC and shareholding fields at every Client input boundary", () => {
    for (const schema of [
      Shared.CreateCmpClientSchema,
      Shared.UpdateCmpClientSchema,
      Shared.CmpClientAcceptanceDraftPayloadSchema,
    ]) {
      expect(
        schema.safeParse({
          ...client,
          prcEstablishments: [{ establishmentName: "Shenzhen" }],
        }).success
      ).toBeFalsy();
    }
    expect(
      Shared.findRetiredCmpClientFields({
        prcOperationStatus: "Yes",
        shareholdingRemark: "legacy",
      })
    ).toStrictEqual(["prcOperationStatus", "shareholdingRemark"]);
  });
});

describe("numbering helpers", () => {
  it("formats generated numeric segments without digit 4", () => {
    expect(Shared.formatNumberWithoutDigitFour(4, 1)).toBe("5");
    expect(Shared.formatNumberWithoutDigitFour(4, 3)).toBe("005");
    expect(Shared.formatNumberWithoutDigitFour(40, 3)).toBe("050");
    expect(Shared.formatNumberWithoutDigitFour(4000, 4, 1000)).toBe("5000");
    expect(Shared.formatNumberWithoutDigitFour(1_783_425_800_000, 13)).toBe(
      "1783500000000"
    );
  });

  it("normalizes historical codes that already contain digit 4", () => {
    expect(Shared.normalizeCodeWithoutDigitFour("A4")).toBe("A5");
    expect(Shared.normalizeCodeWithoutDigitFour("A3-4000")).toBe("A3-5000");
    expect(Shared.normalizeCodeWithoutDigitFour("A1-1000-F004")).toBe(
      "A1-1000-F005"
    );
    expect(Shared.normalizeCodeWithoutDigitFour("A3-3400")).toBe("A3-3500");
  });

  it("normalizes code sequences without creating duplicates", () => {
    expect(
      Shared.normalizeCodeSequenceWithoutDigitFour(["A4", "A5"])
    ).toStrictEqual(["A5", "A6"]);
    expect(
      Shared.normalizeCodeSequenceWithoutDigitFour(["A3-4000", "A3-5000"])
    ).toStrictEqual(["A3-5000", "A3-6000"]);
    expect(
      Shared.normalizeCodeSequenceWithoutDigitFour([
        "A1-1000-F004",
        "A1-1000-F005",
      ])
    ).toStrictEqual(["A1-1000-F005", "A1-1000-F006"]);
  });
});

describe("cMP timesheet mapping", () => {
  it("maps CMP engagement master data into the TMS engagement directory", () => {
    expect(buildTmsEngagementDirectoryFromCmp()).toStrictEqual([
      {
        engagementCode: "WKS-2026-AUD",
        clientCode: "C-WKS-001",
        clientName: "Workshop Company Limited",
        pic: "Jony Ma",
        mic: "Leo Li",
        codeAliases: [],
      },
      {
        engagementCode: "ORC-2026-AUD",
        clientCode: "C-ORC-2026",
        clientName: "Orchid Technology Limited",
        pic: "Jony Ma",
        mic: "Eden Chan",
        codeAliases: [],
      },
      {
        engagementCode: "ORC-2026-RISK",
        clientCode: "C-ORC-2026",
        clientName: "Orchid Technology Limited",
        pic: "Edric Han",
        mic: "Sam Lu",
        codeAliases: [],
      },
      {
        engagementCode: "HBR-2026-ACC",
        clientCode: "C-HBR-010",
        clientName: "Harbour Retail Limited",
        pic: "Edric Han",
        mic: "Leo Li",
        codeAliases: [],
      },
    ]);
    expect(CMP_DEMO_ENGAGEMENTS[1]?.clientCode).toBe(
      CMP_DEMO_CLIENTS[1]?.clientCode
    );
  });

  it("exposes an explicit TMS timesheet access contract", () => {
    const schema = (
      Shared as typeof Shared & {
        TmsEngagementDirectoryItemSchema?: {
          safeParse: (value: unknown) => {
            success: boolean;
            data?: { timesheetAccess?: unknown };
          };
        };
      }
    ).TmsEngagementDirectoryItemSchema;

    expect(schema).toBeDefined();
    const parsed = schema?.safeParse({
      id: "engagement-1",
      engagementCode: "WKS-2026-AUD",
      clientId: "client-1",
      clientCode: "C-WKS-001",
      clientName: "Workshop Company Limited",
      serviceType: "AUDIT",
      budgetedHours: "420.00",
      agreedFee: "180000.00",
      recoveryRate: null,
      feeCurrency: "HKD",
      pic: "Jony Ma",
      mic: "Leo Li",
      codeAliases: [],
      timesheetAccess: {
        allowed: false,
        reason: "INDEPENDENCE_DECLARATION_REQUIRED",
      },
    });

    expect(parsed?.success).toBeTruthy();
    expect(parsed?.data?.timesheetAccess).toStrictEqual({
      allowed: false,
      reason: "INDEPENDENCE_DECLARATION_REQUIRED",
    });
  });
});

describe("shared schemas", () => {
  it("validates required engagement commercial fields", () => {
    const base = {
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      serviceType: "ANNUAL_AUDIT" as const,
      budgetedHours: "420.00",
      agreedFee: "180000.00",
      recoveryRate: "82.50",
      feeCurrency: "HKD" as const,
      picUserId: "user-pic",
      micUserId: "user-mic",
    };

    expect(
      Shared.CreateCmpEngagementSchema.safeParse(base).success
    ).toBeTruthy();
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        recoveryRate: "100.01",
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        budgetedHours: "0",
        recoveryRate: "82.50",
      }).success
    ).toBeFalsy();
  });

  it("requires a foreign-currency snapshot and one valid assignment per budget row", () => {
    const base = {
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      serviceType: "ANNUAL_AUDIT" as const,
      budgetedHours: "420.00",
      agreedFee: "180000.00",
      picUserId: "user-pic",
      micUserId: "user-mic",
      feeCurrency: "CNY" as const,
      feePlanningLines: [
        {
          key: "budget-line-1",
          grade: "MANAGER" as const,
          assignmentType: "TBC" as const,
          staffUserId: null,
          hourlyRate: "1555.50",
          budgetHours: "20.00",
          sortOrder: 0,
        },
      ],
    };

    expect(
      Shared.CreateCmpEngagementSchema.safeParse(base).success
    ).toBeFalsy();
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        feeExchangeRateSnapshotId: "rate-cny-1",
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        feeExchangeRateSnapshotId: "rate-cny-1",
        feePlanningLines: [
          {
            ...base.feePlanningLines[0],
            assignmentType: "STAFF",
            staffUserId: null,
          },
        ],
      }).success
    ).toBeFalsy();
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        feeExchangeRateSnapshotId: "rate-cny-1",
        feePlanningLines: [
          {
            ...base.feePlanningLines[0],
            budgetHours: "2.50",
          },
        ],
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        feeExchangeRateSnapshotId: "rate-cny-1",
        feePlanningLines: [
          {
            ...base.feePlanningLines[0],
            budgetHours: "0",
          },
        ],
      }).success
    ).toBeFalsy();
  });

  it("uses the approved fee-planning budget grades and hourly rates", () => {
    expect(Shared.CMP_ENGAGEMENT_FEE_PLAN_ACTIVE_GRADES).toStrictEqual([
      "MANAGING_PARTNER",
      "PARTNER",
      "PRINCIPAL",
      "SENIOR_MANAGER",
      "MANAGER",
      "EQ_REVIEWER",
      "ASSISTANT_MANAGER",
      "SENIOR_ACCOUNTANT_II",
      "SENIOR_ACCOUNTANT_I",
      "STAFF_ACCOUNTANT_II",
      "STAFF_ACCOUNTANT_I",
      "TRAINEE",
    ]);
    expect(Shared.CMP_ENGAGEMENT_FEE_PLAN_GRADE_RATES).toMatchObject({
      MANAGING_PARTNER: 4500,
      PARTNER: 4200,
      PRINCIPAL: 3700,
      SENIOR_MANAGER: 3000,
      MANAGER: 2400,
      EQ_REVIEWER: 4200,
      ASSISTANT_MANAGER: 1800,
      SENIOR_ACCOUNTANT_II: 900,
      SENIOR_ACCOUNTANT_I: 500,
      STAFF_ACCOUNTANT_II: 400,
      STAFF_ACCOUNTANT_I: 280,
      TRAINEE: 0,
    });
  });

  it("validates fee-planning date pairs on formal submissions", () => {
    const line = {
      key: "budget-line-1",
      grade: "MANAGER" as const,
      assignmentType: "STAFF" as const,
      staffUserId: "staff-1",
      hourlyRate: "2400.00",
      budgetHours: "8.00",
      sortOrder: 0,
    };

    expect(
      Shared.CmpEngagementFeePlanLineInputSchema.safeParse(line).success
    ).toBeTruthy();
    expect(
      Shared.CmpEngagementFeePlanLineInputSchema.safeParse({
        ...line,
        dateFrom: "2026-04-01",
      }).success
    ).toBeFalsy();
    expect(
      Shared.CmpEngagementFeePlanLineInputSchema.safeParse({
        ...line,
        dateFrom: "2026-04-02",
        dateTo: "2026-04-01",
      }).success
    ).toBeFalsy();
    expect(
      Shared.CmpEngagementFeePlanLineInputSchema.safeParse({
        ...line,
        dateFrom: "2026-04-01",
        dateTo: "2026-04-02",
      }).success
    ).toBeTruthy();
  });

  it("expands legacy multi-person budget lines into single-person rows", () => {
    const result = Shared.CmpEngagementFeePlanLinesInputSchema.safeParse([
      {
        key: "legacy-budget-1",
        grade: "MANAGER",
        quantity: 2,
        hourlyRate: "2400.00",
        hoursPerPerson: "8.00",
        otHoursPerPerson: "2.00",
        staffUserIds: ["staff-1"],
        tbcQuantity: 1,
        sortOrder: 0,
      },
    ]);

    expect(result.success).toBeTruthy();
    if (!result.success) {
      return;
    }
    expect(result.data).toStrictEqual([
      expect.objectContaining({
        assignmentType: "STAFF",
        staffUserId: "staff-1",
        budgetHours: "10.00",
      }),
      expect.objectContaining({
        assignmentType: "TBC",
        staffUserId: null,
        budgetHours: "10.00",
      }),
    ]);
  });

  it("checks the private-client senior-cost rule for single-person rows", () => {
    const underThirtyPercent = Shared.validateCmpEngagementBudget({
      isPrivateClient: true,
      hkdPerUnit: 1,
      lines: [
        {
          grade: "MANAGER",
          hourlyRate: 5998,
          budgetHours: 1,
        },
        {
          grade: "STAFF_ACCOUNTANT_I",
          hourlyRate: 14_002,
          budgetHours: 1,
        },
      ],
    });

    expect(underThirtyPercent.privateCostRule.applicable).toBeTruthy();
    expect(underThirtyPercent.privateCostRule.passed).toBeFalsy();
    expect(underThirtyPercent.privateCostRule.seniorCostRatio).toBeCloseTo(
      0.2999
    );

    const atThirtyPercent = Shared.validateCmpEngagementBudget({
      isPrivateClient: true,
      hkdPerUnit: 1,
      lines: [
        {
          grade: "PARTNER",
          hourlyRate: 3000,
          budgetHours: 1,
        },
        {
          grade: "STAFF_ACCOUNTANT_I",
          hourlyRate: 7000,
          budgetHours: 1,
        },
      ],
    });
    expect(atThirtyPercent.privateCostRule.seniorCostRatio).toBe(0.3);
    expect(atThirtyPercent.privateCostRule.passed).toBeTruthy();

    const threshold = Shared.validateCmpEngagementBudget({
      isPrivateClient: true,
      hkdPerUnit: 2,
      lines: [
        {
          grade: "STAFF_ACCOUNTANT_I",
          hourlyRate: 5000,
          budgetHours: 1,
        },
      ],
    });
    expect(threshold.privateCostRule.totalCostHkd).toBe(10_000);
    expect(threshold.privateCostRule.applicable).toBeFalsy();
  });

  it("requires the risk-specific responsible people and keeps the low-risk defaults", () => {
    const base = {
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      serviceType: "ANNUAL_AUDIT" as const,
      budgetedHours: "420.00",
      agreedFee: "180000.00",
      feeCurrency: "HKD" as const,
      picUserId: "user-pic",
      micUserId: "user-mic",
    };
    const normal = Shared.CreateCmpEngagementSchema.parse(base);
    expect(normal.amlRiskClassification).toBe("NOT_HIGH");
    expect(normal.engagementRiskClassification).toBe("NORMAL");
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        engagementRiskClassification: "GREATER_THAN_NORMAL",
      }).success
    ).toBeFalsy();
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        engagementRiskClassification: "GREATER_THAN_NORMAL",
        eqReviewerUserId: "user-eqr",
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        eqReviewerUserId: "user-pic",
      }).success
    ).toBeFalsy();
  });

  it("accepts optional structured engagement deliverables and rejects invalid custom rows", () => {
    const base = {
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      serviceType: "ANNUAL_AUDIT" as const,
      budgetedHours: "420.00",
      agreedFee: "180000.00",
      feeCurrency: "HKD" as const,
      picUserId: "user-pic",
      micUserId: "user-mic",
    };
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        deliverables: [
          {
            key: "AUDITORS_REPORT",
            category: "ANNUAL_AUDIT",
            code: "AUDITORS_REPORT",
            sortOrder: 0,
          },
          {
            key: "custom-1",
            category: "ANNUAL_AUDIT",
            code: "CUSTOM",
            description: "Management letter",
            sortOrder: 1,
          },
        ],
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateCmpEngagementSchema.safeParse({
        ...base,
        deliverables: [
          {
            key: "custom-1",
            category: "ANNUAL_AUDIT",
            code: "CUSTOM",
            sortOrder: 0,
          },
        ],
      }).success
    ).toBeFalsy();
  });

  it("requires projects to belong to a workspace", () => {
    const parsed = CreateProjectSchema.safeParse({
      workspaceId: "workspace-1",
      name: "ABC Holdings 2026 audit",
      projectCode: "ABC-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
      reportingDate: "2026-12-31",
    });

    expect(parsed.success).toBeTruthy();
    if (!parsed.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(parsed.data).toStrictEqual(
      expect.objectContaining({
        projectCode: "ABC-2026-AUD",
        frameworkTemplateId: "framework-hkfrs",
        name: "ABC Holdings 2026 audit",
      })
    );
    expect("companyName" in parsed.data).toBeFalsy();
    expect("companyRegion" in parsed.data).toBeFalsy();
    expect("listingStatus" in parsed.data).toBeFalsy();
  });

  it("allows project code to be supplied later but requires a framework template", () => {
    expect(
      CreateProjectSchema.safeParse({
        workspaceId: "workspace-1",
        name: "ABC Holdings 2026 audit",
        projectCode: "",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
        reportingDate: "2027-03-31",
      }).success
    ).toBeTruthy();

    expect(
      CreateProjectSchema.safeParse({
        workspaceId: "workspace-1",
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
        reportingDate: "2027-03-31",
      }).success
    ).toBeFalsy();
  });

  it("accepts optional project PIC and MIC selections", () => {
    const parsed = CreateProjectSchema.safeParse({
      name: "ABC Holdings 2026 audit",
      projectCode: "ABC-2026-AUD",
      projectPicUserId: "partner-1",
      projectMicUserId: "manager-1",
      projectPicUserIds: ["partner-1", "partner-2"],
      projectMicUserIds: ["manager-1", "manager-2"],
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });

    expect(parsed.success).toBeTruthy();
    if (!parsed.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(parsed.data).toEqual(
      expect.objectContaining({
        projectPicUserId: "partner-1",
        projectMicUserId: "manager-1",
        projectPicUserIds: ["partner-1", "partner-2"],
        projectMicUserIds: ["manager-1", "manager-2"],
      })
    );
    expect(
      CreateProjectSchema.safeParse({
        name: "Independent audit",
        projectMicUserId: "",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      }).success
    ).toBeTruthy();
  });

  it("allows a blank project without a project template or roll-forward source", () => {
    const parsed = CreateProjectSchema.safeParse({
      name: "Rapid investigation",
      projectCode: "RAPID-001",
      language: "zh-CN",
      applicableAccountingStandard: "HKFRS",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });

    expect(parsed.success).toBeTruthy();
  });

  it("strips legacy company nature fields from project creation input", () => {
    const parsed = CreateProjectSchema.safeParse({
      workspaceId: "workspace-1",
      name: "ABC Holdings 2026 audit",
      projectCode: "ABC-2026-AUD",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      companyRegion: "HONG_KONG",
      listingStatus: "LISTED",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-06-29",
    });

    expect(parsed.success).toBeTruthy();
    if (!parsed.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect("companyRegion" in parsed.data).toBeFalsy();
    expect("listingStatus" in parsed.data).toBeFalsy();
  });

  it("validates workspace creation input", () => {
    expect(
      CreateWorkspaceSchema.safeParse({
        name: "ABC client folder",
        clientName: "ABC Holdings",
      }).success
    ).toBeTruthy();
  });

  it("validates workspace update input", () => {
    expect(
      UpdateWorkspaceSchema.safeParse({
        name: "Updated folder",
        clientName: "Updated Client",
        description: "Internal label",
      }).success
    ).toBeTruthy();
    expect(
      UpdateWorkspaceSchema.safeParse({
        name: "",
        clientName: "Updated Client",
      }).success
    ).toBeFalsy();
  });

  it("validates prepared confirmation dispatch input separately from sent dispatches", () => {
    expect(
      Shared.PrepareProjectConfirmationDispatchSchema.safeParse({
        method: "EMAIL",
        recipientContact: "confirmations@example.com",
        markReady: true,
      }).success
    ).toBeTruthy();

    expect(
      Shared.PrepareProjectConfirmationDispatchSchema.safeParse({
        recipientContact: "confirmations@example.com",
        markReady: false,
      }).success
    ).toBeTruthy();

    expect(
      Shared.PrepareProjectConfirmationDispatchSchema.safeParse({
        recipientContact: "confirmations@example.com",
        markReady: true,
      }).success
    ).toBeFalsy();
  });

  it("allows externally booked courier dispatches without a tracking number", () => {
    const baseInput = {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      method: "COURIER" as const,
      sentAt: "2026-07-14T12:00:00.000Z",
    };

    expect(
      Shared.CreateProjectConfirmationDispatchSchema.safeParse(baseInput)
        .success
    ).toBeTruthy();
    expect(
      Shared.CreateProjectConfirmationDispatchSchema.safeParse({
        ...baseInput,
        trackingNumber: "SF1234567890",
      }).success
    ).toBeTruthy();
  });

  it("creates confirmation drafts only from a template and structured payload", () => {
    expect(
      Shared.CreateProjectConfirmationSchema.safeParse({
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateProjectConfirmationSchema.safeParse({
        draftTemplateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
        draftPayload: {
          recipientName: "Custodian Limited",
          recipientAddress: "1 Finance Street, Hong Kong",
          yearEndDate: "2026-12-31",
          accountNumber: "SEC-001",
          micName: "Engagement MIC",
        },
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateProjectConfirmationSchema.safeParse({
        draftTemplateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
        draftPayload: {
          recipientName: "Broker Limited",
          micEmail: "mic@example.com",
          micNameAndInitial: "A. Example",
        },
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateProjectConfirmationSchema.safeParse({
        draftTemplateCode: "PRC_BANK_TEMPLATE_1",
        draftPayload: { bankName: "HSBC Hong Kong" },
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateProjectConfirmationSchema.safeParse({}).success
    ).toBeFalsy();
    expect(
      Shared.CreateProjectConfirmationSchema.safeParse({
        confirmationType: "BANK",
        counterpartyName: "HSBC Hong Kong",
        draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      }).success
    ).toBeFalsy();
  });

  it("rejects authoritative identity and state fields in generic confirmation updates", () => {
    const authoritativeFields = {
      confirmationType: "LAWYER",
      status: "PREPARED",
      clientName: "Orchid Holdings",
      confirmationCode: "LEGACY-001",
      auditPeriod: "2026",
      counterpartyName: "Legal Counsel",
      respondingEntityName: "Responding Entity",
      thirdPartyName: "Third Party",
      subjectName: "Subject",
      attachmentName: "Attachment",
      counterpartyContact: "Contact",
      counterpartyAddress: "Address",
      responsibleUserId: "user-2",
      differenceStatus: "MATCHED",
    };

    for (const [field, value] of Object.entries(authoritativeFields)) {
      expect(
        Shared.UpdateProjectConfirmationSchema.safeParse({
          notes: "Allowed review note",
          [field]: value,
        }).success
      ).toBeFalsy();
    }

    expect(
      Shared.UpdateProjectConfirmationSchema.safeParse({
        notes: "Allowed review note",
      }).success
    ).toBeTruthy();
  });

  it("does not accept redispatch as a generic follow-up event", () => {
    expect(
      Shared.CreateProjectConfirmationFollowUpEventSchema.safeParse({
        eventType: "REDISPATCH_REQUESTED",
      }).success
    ).toBeFalsy();
    expect(
      Shared.CreateProjectConfirmationFollowUpEventSchema.safeParse({
        eventType: "COUNTERPARTY_RECEIVED",
      }).success
    ).toBeTruthy();
  });

  it("accepts an unclassified confirmation type", () => {
    expect(Shared.ConfirmationTypeSchema.options).toContain("UNCLASSIFIED");
    expect(
      Shared.CreateProjectConfirmationSchema.safeParse({
        type: "UNCLASSIFIED",
      }).success
    ).toBeTruthy();
  });

  it("validates confirmation dispatch pipeline enums", () => {
    const pipelineEnums = [
      [
        Shared.ConfirmationArtifactDispositionSchema,
        ["ACTIVE", "INVALIDATED", "RETURNED"],
      ],
      [
        Shared.ConfirmationDispatchBatchStatusSchema,
        [
          "QUEUED",
          "EXECUTING",
          "COMPLETED",
          "PARTIAL_FAILURE",
          "FAILED",
          "CANCELLED",
        ],
      ],
      [
        Shared.ConfirmationDispatchBatchItemStatusSchema,
        ["QUEUED", "CLAIMED", "SENT", "FAILED", "RETURNED"],
      ],
      [
        Shared.ConfirmationDispatchExecutionStatusSchema,
        ["QUEUED", "STARTED", "SENT", "DELIVERED", "FAILED"],
      ],
      [
        Shared.ConfirmationDispatchEventTypeSchema,
        [
          "CREATED",
          "QUEUED",
          "CLAIMED",
          "RETURNED",
          "STARTED",
          "SENT",
          "DELIVERED",
          "FAILED",
          "DISPATCHED",
          "RECEIVED",
          "VOIDED",
        ],
      ],
      [
        Shared.ConfirmationPhysicalPackageStatusSchema,
        [
          "CREATED",
          "IN_CUSTODY",
          "DISPATCHED",
          "DELIVERED",
          "RECEIVED",
          "VOIDED",
          "REPLACED",
        ],
      ],
      [
        Shared.ConfirmationResponseChannelSchema,
        ["PAPER", "EMAIL", "PORTAL", "ELECTRONIC", "OTHER"],
      ],
      [
        Shared.ConfirmationResponseMatchMethodSchema,
        ["SCAN_TOKEN", "PACKAGE_CODE", "MANUAL"],
      ],
      [
        Shared.ConfirmationResponseRoutingStatusSchema,
        ["PENDING", "ROUTED", "CONCLUDED"],
      ],
      [
        Shared.ConfirmationIntakeExceptionReasonSchema,
        [
          "UNKNOWN_SCAN_TOKEN",
          "INVALID_PACKAGE_CODE",
          "DUPLICATE_RESPONSE",
          "UNMATCHED_RESPONSE",
          "DAMAGED_RESPONSE",
          "OTHER",
        ],
      ],
      [
        Shared.ConfirmationIntakeExceptionStatusSchema,
        ["OPEN", "RESOLVED", "DISMISSED"],
      ],
    ];

    for (const [schema, options] of pipelineEnums) {
      expect(schema.options).toStrictEqual(options);
      expect(schema.safeParse(options[0]).success).toBeTruthy();
      expect(schema.safeParse("UNSUPPORTED").success).toBeFalsy();
    }
  });

  it("limits manually entered response channels to paper, electronic, and other", () => {
    expect(Shared.ConfirmationResponseInputChannelSchema.options).toStrictEqual(
      ["PAPER", "ELECTRONIC", "OTHER"]
    );
    expect(
      Shared.CreateProjectConfirmationResponseSchema.safeParse({
        responseChannel: "EMAIL",
        receivedAt: "2026-08-19T09:00:00.000Z",
      }).success
    ).toBeFalsy();
  });

  it("validates confirmation dispatch pipeline requests", () => {
    const idempotencyKey = "00000000-0000-4000-8000-000000000001";

    expect(
      Shared.SubmitProjectConfirmationSchema.safeParse({
        expectedDraftUpdatedAt: "2026-07-11T12:00:00.000Z",
        idempotencyKey,
      }).success
    ).toBeTruthy();
    expect(
      Shared.WithdrawProjectConfirmationSchema.safeParse({
        idempotencyKey,
        reason: "Counterparty record superseded",
      }).success
    ).toBeTruthy();
    expect(
      Shared.WithdrawProjectConfirmationSchema.safeParse({
        idempotencyKey,
      }).success
    ).toBeTruthy();
    expect(
      Shared.ClaimConfirmationDispatchQueueSchema.safeParse({
        artifactId: "artifact-1",
        expectedQueuedAt: "2026-07-11T12:00:00.000Z",
        idempotencyKey,
      }).success
    ).toBeTruthy();
    expect(
      Shared.ReturnConfirmationDispatchQueueSchema.safeParse({
        artifactId: "artifact-1",
        idempotencyKey,
        reason: "Recipient details need review",
      }).success
    ).toBeTruthy();
    expect(
      Shared.ReleaseConfirmationDispatchQueueSchema.safeParse({
        artifactId: "artifact-1",
        idempotencyKey,
      }).success
    ).toBeTruthy();
    expect(
      Shared.ConfirmationDispatchQueueQuerySchema.safeParse({
        stage: "AWAITING_CLAIM",
        plannedSendFrom: "2026-07-11T00:00:00.000Z",
      }).success
    ).toBeTruthy();
    expect(
      Shared.CreateConfirmationDispatchBatchSchema.safeParse({
        method: "COURIER",
        idempotencyKey,
        items: [{ confirmationId: "confirmation-1", artifactId: "artifact-1" }],
      }).success
    ).toBeTruthy();
    expect(
      Shared.ExecuteConfirmationDispatchBatchSchema.safeParse({
        idempotencyKey,
      }).success
    ).toBeTruthy();
    expect(
      Shared.RecordConfirmationPackageEventSchema.safeParse({
        idempotencyKey,
        eventType: "DISPATCHED",
      }).success
    ).toBeTruthy();
    expect(
      Shared.ReceivePaperResponseSchema.safeParse({
        idempotencyKey,
        pageCount: 1,
        storageLocation: "Archive room A",
      }).success
    ).toBeTruthy();
    expect(
      Shared.ResolveConfirmationIntakeExceptionSchema.safeParse({
        idempotencyKey,
        resolutionReason: "Matched by manual review",
      }).success
    ).toBeTruthy();
    expect(
      Shared.ConcludeConfirmationResponseSchema.safeParse({
        idempotencyKey,
        conclusion: "MATCHED",
      }).success
    ).toBeTruthy();
  });

  it("rejects invalid confirmation dispatch pipeline requests", () => {
    const idempotencyKey = "00000000-0000-4000-8000-000000000001";

    expect(
      Shared.CreateConfirmationDispatchBatchSchema.safeParse({
        method: "COURIER",
        idempotencyKey,
        items: [],
      }).success
    ).toBeFalsy();
    expect(
      Shared.CreateConfirmationDispatchBatchSchema.safeParse({
        method: "COURIER",
        idempotencyKey,
        items: Array.from({ length: 101 }, (_, index) => ({
          confirmationId: `confirmation-${index}`,
          artifactId: `artifact-${index}`,
        })),
      }).success
    ).toBeFalsy();
    expect(
      Shared.ReturnConfirmationDispatchQueueSchema.safeParse({
        artifactId: "artifact-1",
        idempotencyKey,
      }).success
    ).toBeFalsy();
    expect(
      Shared.ClaimConfirmationDispatchQueueSchema.safeParse({ idempotencyKey })
        .success
    ).toBeFalsy();
    expect(
      Shared.ReceivePaperResponseSchema.safeParse({
        idempotencyKey,
        pageCount: 0,
        storageLocation: "Archive room A",
      }).success
    ).toBeFalsy();
    expect(
      Shared.SubmitProjectConfirmationSchema.safeParse({
        expectedDraftUpdatedAt: "2026-07-11T12:00:00.000Z",
        idempotencyKey: "not-a-uuid",
      }).success
    ).toBeFalsy();
    expect(
      Shared.SubmitProjectConfirmationSchema.safeParse({
        expectedDraftUpdatedAt: "2026-07-11T12:00:00.000Z",
        idempotencyKey,
        courierName: "Injected courier",
        trackingNumber: "WAYBILL-1",
      }).success
    ).toBeFalsy();
  });

  it("allows project invitations to target an inbox email", () => {
    expect(
      CreateInvitationSchema.safeParse({
        invitedRole: "PREPARER",
        expiresInDays: 7,
        recipientEmail: "staff@example.com",
      }).success
    ).toBeTruthy();

    expect(
      CreateInvitationSchema.safeParse({
        invitedRole: "PREPARER",
        expiresInDays: 7,
        recipientEmail: "not-an-email",
      }).success
    ).toBeFalsy();
  });

  it("preserves the selected recipient user id for project invitations", () => {
    const parsed = CreateInvitationSchema.safeParse({
      invitedRole: "PREPARER",
      expiresInDays: 7,
      recipientUserId: "user-1",
    });

    expect(parsed.success).toBeTruthy();
    if (!parsed.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(parsed.data.recipientUserId).toBe("user-1");
  });

  it("uses project responsibility roles instead of staff grade roles", () => {
    expect(GlobalRoleSchema.options).toStrictEqual([
      "SUPER_ADMIN",
      "HR",
      "CONFIRMATION_OFFICER",
      "PARTNER",
      "PRINCIPAL",
      "MANAGER",
      "SENIOR",
      "STAFF",
      "ASSISTANT",
      "EQCR",
      "TAX_EXPERT",
    ]);
    expect(ProjectRoleSchema.options).toStrictEqual([
      "PARTNER",
      "REVIEWER",
      "PREPARER",
      "EQCR",
      "TAX_REVIEWER",
    ]);
    expect(
      CreateInvitationSchema.safeParse({
        invitedRole: "MANAGER",
        expiresInDays: 7,
        recipientUserId: "user-1",
      }).success
    ).toBeFalsy();
  });

  it("limits confirmation template management to Super Admin", () => {
    expect(
      GlobalRoleSchema.options.filter(canGlobalRoleManageConfirmationTemplates)
    ).toStrictEqual(["SUPER_ADMIN"]);
  });

  it("limits assignable project roles by the recipient account grade", () => {
    expect(getAssignableProjectRolesForGlobalRole("PARTNER")).toStrictEqual([
      "PARTNER",
      "EQCR",
    ]);
    expect(getAssignableProjectRolesForGlobalRole("PRINCIPAL")).toStrictEqual([
      "PARTNER",
      "REVIEWER",
    ]);
    expect(
      getAssignableProjectRolesForGlobalRole("SENIOR_MANAGER")
    ).toStrictEqual(["REVIEWER"]);
    expect(getAssignableProjectRolesForGlobalRole("MANAGER")).toStrictEqual([
      "REVIEWER",
    ]);
    expect(getAssignableProjectRolesForGlobalRole("SENIOR")).toStrictEqual([
      "REVIEWER",
    ]);
    expect(getAssignableProjectRolesForGlobalRole("STAFF")).toStrictEqual([
      "PREPARER",
    ]);
    expect(getAssignableProjectRolesForGlobalRole("ASSISTANT")).toStrictEqual([
      "PREPARER",
    ]);
    expect(getAssignableProjectRolesForGlobalRole("EQCR")).toStrictEqual([
      "EQCR",
    ]);
    expect(getAssignableProjectRolesForGlobalRole("TAX_EXPERT")).toStrictEqual([
      "TAX_REVIEWER",
    ]);
    expect(getAssignableProjectRolesForGlobalRole("SUPER_ADMIN")).toStrictEqual(
      []
    );
    expect(getAssignableProjectRolesForGlobalRole("HR")).toStrictEqual([]);
    expect(
      getAssignableProjectRolesForGlobalRole("CONFIRMATION_OFFICER")
    ).toStrictEqual([]);
    expect(
      getAssignableProjectRoleLabelsForGlobalRole("MANAGER")
    ).toStrictEqual(["Manager"]);
    expect(
      getAssignableProjectRoleLabelsForGlobalRole("PARTNER")
    ).toStrictEqual(["Partner", "Engagement Quality Reviewer"]);
    expect(
      getAssignableProjectRoleLabelsForGlobalRole("TAX_EXPERT")
    ).toStrictEqual(["Expert"]);
    expect(
      isProjectRoleAssignableToGlobalRole("TAX_EXPERT", "TAX_REVIEWER")
    ).toBeTruthy();
    expect(
      isProjectRoleAssignableToGlobalRole("STAFF", "REVIEWER")
    ).toBeFalsy();
    expect(isProjectRoleAssignableToGlobalRole("STAFF", "PARTNER")).toBeFalsy();
  });

  it("describes each global role in product language", () => {
    expect(GLOBAL_ROLE_METADATA.SUPER_ADMIN.label.length).toBeGreaterThan(0);
    expect(GLOBAL_ROLE_METADATA.PARTNER.projectParticipation).toContain(
      "Partner"
    );
    expect(GLOBAL_ROLE_METADATA.SENIOR.label.length).toBeGreaterThan(0);
  });

  it("keeps every account grade mapped to the intended project responsibilities", () => {
    const matrix = [
      ["SUPER_ADMIN", []],
      ["HR", []],
      ["CONFIRMATION_OFFICER", []],
      ["PARTNER", ["PARTNER", "EQCR"]],
      ["PRINCIPAL", ["PARTNER", "REVIEWER"]],
      ["SENIOR_MANAGER", ["REVIEWER"]],
      ["MANAGER", ["REVIEWER"]],
      ["SENIOR", ["REVIEWER"]],
      ["STAFF", ["PREPARER"]],
      ["ASSISTANT", ["PREPARER"]],
      ["EQCR", ["EQCR"]],
      ["TAX_EXPERT", ["TAX_REVIEWER"]],
    ] as const;

    for (const [globalRole, projectRoles] of matrix) {
      expect(getAssignableProjectRolesForGlobalRole(globalRole)).toStrictEqual(
        projectRoles
      );
      for (const candidate of ProjectRoleSchema.options) {
        expect(isProjectRoleAssignableToGlobalRole(globalRole, candidate)).toBe(
          projectRoles.includes(candidate)
        );
      }
    }
  });

  it("centralizes the global grades that can maintain project teams", () => {
    expect(canGlobalRoleManageProjectMembers("PARTNER")).toBeTruthy();
    expect(canGlobalRoleManageProjectMembers("PRINCIPAL")).toBeTruthy();
    expect(canGlobalRoleManageProjectMembers("SENIOR_MANAGER")).toBeTruthy();
    expect(canGlobalRoleManageProjectMembers("MANAGER")).toBeTruthy();
    expect(canGlobalRoleManageProjectMembers("SENIOR")).toBeFalsy();
    expect(canGlobalRoleManageProjectMembers("STAFF")).toBeFalsy();
    expect(canGlobalRoleManageProjectMembers("ASSISTANT")).toBeFalsy();
    expect(canGlobalRoleManageProjectMembers("EQCR")).toBeFalsy();
    expect(canGlobalRoleManageProjectMembers("TAX_EXPERT")).toBeFalsy();
    expect(canGlobalRoleManageProjectMembers("SUPER_ADMIN")).toBeFalsy();
    expect(canGlobalRoleManageProjectMembers("HR")).toBeFalsy();
    expect(
      canGlobalRoleManageProjectMembers("CONFIRMATION_OFFICER")
    ).toBeFalsy();
  });

  it("keeps project creation as a firm-rank permission, not an engagement-role permission", () => {
    expect(canGlobalRoleCreateProject("PARTNER")).toBeTruthy();
    expect(canGlobalRoleCreateProject("PRINCIPAL")).toBeTruthy();
    expect(canGlobalRoleCreateProject("SENIOR_MANAGER")).toBeTruthy();
    expect(canGlobalRoleCreateProject("MANAGER")).toBeTruthy();
    expect(canGlobalRoleCreateProject("SENIOR")).toBeTruthy();
    expect(canGlobalRoleCreateProject("STAFF")).toBeTruthy();
    expect(canGlobalRoleCreateProject("ASSISTANT")).toBeTruthy();
    expect(canGlobalRoleCreateProject("TAX_EXPERT")).toBeFalsy();
    expect(canGlobalRoleCreateProject("SUPER_ADMIN")).toBeFalsy();
    expect(canGlobalRoleCreateProject("HR")).toBeFalsy();
  });

  it("maps engagement roles to the requested project permission matrix", () => {
    const partnerInCharge = {
      globalRole: "PARTNER",
      projectRole: "PARTNER",
      inChargeRole: "PARTNER_IN_CHARGE",
    } as const;
    const partner = {
      globalRole: "PARTNER",
      projectRole: "PARTNER",
      inChargeRole: null,
    } as const;
    const staff = {
      globalRole: "STAFF",
      projectRole: "PREPARER",
      inChargeRole: null,
    } as const;
    const assistant = {
      globalRole: "ASSISTANT",
      projectRole: "PREPARER",
      inChargeRole: null,
    } as const;
    const expert = {
      globalRole: "TAX_EXPERT",
      projectRole: "TAX_REVIEWER",
      inChargeRole: null,
    } as const;
    const eqr = {
      globalRole: "PARTNER",
      projectRole: "EQCR",
      inChargeRole: null,
    } as const;

    expect(
      canProjectMemberPerformAction(partnerInCharge, "deleteProject")
    ).toBeTruthy();
    expect(canProjectMemberPerformAction(partner, "deleteProject")).toBeFalsy();
    expect(
      canProjectMemberPerformAction(partner, "archiveProject")
    ).toBeTruthy();
    expect(
      canProjectMemberPerformAction(staff, "inviteProjectMembers")
    ).toBeTruthy();
    expect(
      canProjectMemberPerformAction(staff, "removeProjectMembers")
    ).toBeFalsy();
    expect(
      canProjectMemberPerformAction(staff, "updateProjectInfo")
    ).toBeFalsy();
    expect(
      canProjectMemberPerformAction(assistant, "archiveProject")
    ).toBeFalsy();
    expect(
      canProjectMemberPerformAction(assistant, "modifyIndex")
    ).toBeTruthy();
    expect(canProjectMemberPerformAction(expert, "signPreparer")).toBeFalsy();
    expect(
      canProjectMemberPerformAction(expert, "uploadWorkingPapers")
    ).toBeFalsy();
    expect(canProjectMemberPerformAction(eqr, "modifyIndex")).toBeFalsy();
    expect(canProjectMemberPerformAction(eqr, "viewRecycleBin")).toBeFalsy();
  });

  it("does not accept framework changes in project updates", () => {
    const parsed = UpdateProjectSchema.parse({
      name: "ABC Holdings 2026 audit",
      projectCode: "ABC-2026-AUD",
      frameworkTemplateId: "framework-ifrs",
      yearEndDate: "2026-12-31",
      reportDate: "2027-03-31",
      archiveDeadline: "2027-05-30",
    });

    expect(parsed).not.toHaveProperty("frameworkTemplateId");
  });

  it("distinguishes hidden permission denials from disabled permission denials", () => {
    expect(getDeniedProjectPermissionTreatment("viewTemporaryFiles")).toBe(
      "hidden"
    );
    expect(getDeniedProjectPermissionTreatment("viewNotifications")).toBe(
      "hidden"
    );
    expect(getDeniedProjectPermissionTreatment("viewRecycleBin")).toBe(
      "hidden"
    );
    expect(getDeniedProjectPermissionTreatment("uploadWorkingPapers")).toBe(
      "hidden"
    );
    expect(getDeniedProjectPermissionTreatment("useLibrary")).toBe("hidden");
    expect(getDeniedProjectPermissionTreatment("deleteProject")).toBe(
      "disabled"
    );
    expect(getDeniedProjectPermissionTreatment("modifyIndex")).toBe("disabled");
  });

  it("centralizes which account grades can be marked In Charge", () => {
    expect(getInChargeRoleForGlobalRole("PARTNER")).toBe("PARTNER_IN_CHARGE");
    expect(getInChargeRoleForGlobalRole("PRINCIPAL")).toBe("PARTNER_IN_CHARGE");
    expect(getInChargeRoleForGlobalRole("SENIOR_MANAGER")).toBe(
      "MANAGER_IN_CHARGE"
    );
    expect(getInChargeRoleForGlobalRole("MANAGER")).toBe("MANAGER_IN_CHARGE");
    expect(getInChargeRoleForGlobalRole("SENIOR")).toBeNull();
    expect(getInChargeRoleForGlobalRole("STAFF")).toBeNull();
    expect(getInChargeRoleForGlobalRole("ASSISTANT")).toBeNull();

    expect(
      isInChargeRoleAssignableToGlobalRole("PARTNER", "PARTNER_IN_CHARGE")
    ).toBeTruthy();
    expect(
      isInChargeRoleAssignableToGlobalRole("MANAGER", "MANAGER_IN_CHARGE")
    ).toBeTruthy();
    expect(
      isInChargeRoleAssignableToGlobalRole("STAFF", "MANAGER_IN_CHARGE")
    ).toBeFalsy();
  });

  it("centralizes invitation eligibility for active business-grade accounts", () => {
    expect(
      getProjectInvitationEligibility({
        globalRole: "MANAGER",
        status: "ACTIVE",
      })
    ).toStrictEqual({
      canReceiveInvitation: true,
      assignableProjectRoles: ["REVIEWER"],
      reason: null,
    });
    expect(
      getProjectInvitationEligibility({
        globalRole: "EQCR",
        status: "ACTIVE",
      })
    ).toStrictEqual({
      canReceiveInvitation: true,
      assignableProjectRoles: ["EQCR"],
      reason: null,
    });
    expect(
      getProjectInvitationEligibility({
        globalRole: "TAX_EXPERT",
        status: "ACTIVE",
      })
    ).toStrictEqual({
      canReceiveInvitation: true,
      assignableProjectRoles: ["TAX_REVIEWER"],
      reason: null,
    });
    expect(
      getProjectInvitationEligibility({
        globalRole: "SUPER_ADMIN",
        status: "ACTIVE",
      })
    ).toMatchObject({
      canReceiveInvitation: false,
      assignableProjectRoles: [],
    });
    expect(
      getProjectInvitationEligibility({
        globalRole: "STAFF",
        status: "DISABLED",
      })
    ).toMatchObject({
      canReceiveInvitation: false,
      assignableProjectRoles: ["PREPARER"],
    });
  });

  it("validates project member role updates", () => {
    expect(
      UpdateProjectMemberRoleSchema.safeParse({ projectRole: "REVIEWER" })
        .success
    ).toBeTruthy();
    expect(
      UpdateProjectMemberRoleSchema.safeParse({ projectRole: "MANAGER" })
        .success
    ).toBeFalsy();
  });

  it("validates project member In Charge updates", () => {
    expect(
      UpdateProjectMemberInChargeRoleSchema.safeParse({
        inChargeRole: "PARTNER_IN_CHARGE",
      }).success
    ).toBeTruthy();
    expect(
      UpdateProjectMemberInChargeRoleSchema.safeParse({
        inChargeRole: null,
      }).success
    ).toBeTruthy();
    expect(
      UpdateProjectMemberInChargeRoleSchema.safeParse({
        inChargeRole: "PREPARER",
      }).success
    ).toBeFalsy();
  });

  it("validates admin user updates", () => {
    expect(
      UpdateUserSchema.parse({
        staffNo: " A4050 ",
        hourlyRate: 1800.5,
      })
    ).toStrictEqual({
      staffNo: "A4050",
      hourlyRate: 1800.5,
    });
    expect(UpdateUserSchema.parse({ staffNo: "" })).toStrictEqual({
      staffNo: null,
    });
    expect(
      UpdateUserSchema.safeParse({
        hourlyRate: -1,
      }).success
    ).toBeFalsy();
    expect(
      UpdateUserSchema.safeParse({
        hourlyRate: 1.234,
      }).success
    ).toBeFalsy();
    expect(
      UpdateUserSchema.safeParse({
        globalRole: "SENIOR_MANAGER",
      }).success
    ).toBeFalsy();
    expect(
      UpdateUserSchema.safeParse({
        globalRole: "EQCR",
      }).success
    ).toBeTruthy();
    expect(
      UpdateUserSchema.safeParse({
        globalRole: "TAX_EXPERT",
      }).success
    ).toBeTruthy();
    expect(
      UpdateUserSchema.safeParse({
        status: "DISABLED",
      }).success
    ).toBeTruthy();
    expect(
      UpdateUserSchema.safeParse({
        reportSubjects: ["Wing Zenith", "Harbor Advisory"],
      }).success
    ).toBeFalsy();
    expect(UpdateUserSchema.safeParse({}).success).toBeFalsy();
    expect(
      UpdateUserSchema.safeParse({
        globalRole: "REVIEWER",
      }).success
    ).toBeFalsy();
  });

  it("validates admin user search and filter query parameters", () => {
    expect(
      UserListQuerySchema.safeParse({
        globalRole: "EQCR",
      }).success
    ).toBeTruthy();
    expect(
      UserListQuerySchema.safeParse({
        q: "staff@example.com",
        globalRole: "TAX_EXPERT",
        status: "ACTIVE",
      }).success
    ).toBeTruthy();
    expect(
      UserListQuerySchema.safeParse({
        globalRole: "REVIEWER",
      }).success
    ).toBeFalsy();
    expect(
      UserListQuerySchema.safeParse({
        status: "ARCHIVED",
      }).success
    ).toBeFalsy();
  });

  it("validates workflow node creation input", () => {
    expect(
      CreateWorkflowNodeSchema.safeParse({
        parentId: "phase-1",
        code: "A02",
        title: "Revenue",
      }).success
    ).toBeTruthy();

    expect(
      CreateWorkflowNodeSchema.safeParse({
        parentId: null,
        code: "Completion",
        title: "Completion",
      }).success
    ).toBeTruthy();

    expect(
      CreateWorkflowNodeSchema.safeParse({
        code: "Completion",
        title: "Completion",
      }).success
    ).toBeTruthy();

    expect(
      CreateWorkflowNodeSchema.safeParse({
        parentId: "",
        code: "A02",
        title: "Revenue",
      }).success
    ).toBeTruthy();
  });

  it("validates workflow node update input", () => {
    expect(
      UpdateWorkflowNodeSchema.safeParse({
        code: "A02",
        title: "Revenue",
      }).success
    ).toBeTruthy();

    expect(
      UpdateWorkflowNodeSchema.safeParse({
        parentId: null,
      }).success
    ).toBeTruthy();

    expect(
      UpdateWorkflowNodeSchema.safeParse({
        parentId: "phase-1",
        insert: {
          targetNodeId: "node-2",
          placement: "BEFORE",
        },
      }).success
    ).toBeTruthy();

    expect(
      UpdateWorkflowNodeSchema.safeParse({
        code: "",
        title: "Revenue",
      }).success
    ).toBeFalsy();

    expect(
      UpdateWorkflowNodeSchema.safeParse({
        code: "A02",
      }).success
    ).toBeFalsy();
  });

  it("validates working paper document workflow inputs", () => {
    expect("PaperStatusSchema" in Shared).toBeFalsy();
    expect("PAPER_STATUS_LABELS" in Shared).toBeFalsy();
    expect(AttachmentFileKindSchema.options).toStrictEqual([
      "SPREADSHEET",
      "SUPPORTING",
      "SMART_FORM",
    ]);
    expect(
      UpdateWorkingPaperAssigneesSchema.safeParse({
        preparerId: "user-1",
        reviewerId: "user-2",
      }).success
    ).toBeTruthy();
    expect(
      UpdateWorkingPaperAssigneesSchema.safeParse({
        preparerId: "",
        reviewerId: "",
      }).success
    ).toBeTruthy();
    expect(
      ReturnWorkingPaperSchema.safeParse({
        reviewNote: "Please reconcile the bank difference.",
      }).success
    ).toBeTruthy();
    expect(
      ReturnWorkingPaperSchema.safeParse({
        reviewNote: "",
      }).success
    ).toBeFalsy();
    expect(
      RequestAttachmentUploadUrlSchema.safeParse({
        fileName: "support.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
      }).success
    ).toBeTruthy();
    expect(
      RequestAttachmentUploadUrlSchema.safeParse({
        fileKind: "SUPPORTING",
        fileName: "board-deck.pptx",
        fileSize: 1024,
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }).success
    ).toBeTruthy();
    expect(
      RequestAttachmentUploadUrlSchema.safeParse({
        fileKind: "SUPPORTING",
        fileName: "archive-deck.ppt",
        fileSize: 1024,
        mimeType: "application/vnd.ms-powerpoint",
      }).success
    ).toBeTruthy();
    expect(
      RequestAttachmentUploadUrlSchema.safeParse({
        fileKind: "SUPPORTING",
        fileName: "",
        fileSize: 0,
        mimeType: "application/pdf",
      }).success
    ).toBeFalsy();
    expect(
      ConfirmAttachmentUploadSchema.safeParse({
        fileName: "support.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        objectKey: "working-papers/project-1/paper-1/support.pdf",
      }).success
    ).toBeTruthy();
    expect(
      RelocateAttachmentSchema.safeParse({
        workingPaperId: "paper-2",
      }).success
    ).toBeFalsy();
    expect(
      RelocateAttachmentSchema.safeParse({
        workflowNodeId: "node-2",
        bucket: "PRIOR",
      }).success
    ).toBeTruthy();
    expect(
      RelocateAttachmentSchema.safeParse({
        workflowNodeId: "node-2",
      }).success
    ).toBeFalsy();
    expect(
      RelocateAttachmentSchema.safeParse({
        workingPaperId: "paper-2",
        workflowNodeId: "node-2",
        bucket: "CURRENT",
      }).success
    ).toBeFalsy();
  });

  it("keeps desktop agent Master support scoped to trackable desktop files", () => {
    expect(
      isDesktopAgentOpenSupportedFileName("cash.xlsx", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("legacy.xls", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("macro-enabled.xlsm", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("binary-model.xlsb", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("trial-balance.csv", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("trial-balance.tsv", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("memo.docx", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("legacy-memo.doc", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("deck.pptx", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("board.ppt", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("support.pdf", "MASTER")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("archive.zip", "MASTER")
    ).toBeFalsy();
  });

  it("supports zip as a first-party Master file", () => {
    expect(isProjectWingMasterSupportedFileName("support.zip")).toBeTruthy();
    expect(isZipMasterSupportedFileName("support.zip")).toBeTruthy();
  });

  it("does not send zip files to Desktop Agent as a tracked file", () => {
    expect(
      isDesktopAgentOpenSupportedFileName("support.zip", "MASTER")
    ).toBeFalsy();
    expect(
      isDesktopAgentOpenSupportedFileName("support.zip", "READ_ONLY")
    ).toBeFalsy();
  });

  it("accepts V2 Smart Form definitions in template contracts", () => {
    const definition = Shared.DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE;

    expect(
      Shared.SmartFormV2DefinitionSchema.safeParse(definition).success
    ).toBeTruthy();
    expect(
      Shared.CreateSmartFormTemplateSchema.safeParse({
        code: "SF-DEFERRED-INCOME",
        name: "Deferred income",
        frameworkTemplateId: null,
        definition,
      }).success
    ).toBeTruthy();
    expect(
      Shared.UpdateSmartFormTemplateSchema.safeParse({ definition }).success
    ).toBeTruthy();
  });

  it("rejects V1 Smart Form definitions", () => {
    const legacyDefinition = {
      title: { "zh-CN": "旧表单", "en-US": "Legacy form" },
      sections: [],
    };

    expect(
      Shared.CreateSmartFormTemplateSchema.safeParse({
        code: "SF-LEGACY",
        name: "Legacy",
        definition: legacyDefinition,
      }).success
    ).toBeFalsy();
    expect(
      Shared.UpdateSmartFormTemplateSchema.safeParse({
        definition: legacyDefinition,
      }).success
    ).toBeFalsy();
  });

  it("validates V2 Smart Form packages as immutable file snapshots", () => {
    expect(
      SmartFormPackageSchema.safeParse({
        packageType: "PROJECT_WING_SMART_FORM",
        formatVersion: 2,
        template: {
          id: "template-1",
          versionId: "template-version-1",
          code: "SF-DEFERRED-INCOME",
          title: "Deferred income",
          publishedAt: "2026-06-22T00:00:00.000Z",
          language: "en-US",
        },
        definition: Shared.DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
        response: Shared.DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
        createdAt: "2026-06-22T00:01:00.000Z",
        updatedAt: "2026-06-22T00:02:00.000Z",
      }).success
    ).toBeTruthy();
  });

  it("supports sf as a first-party Master file without Desktop Agent", () => {
    expect(isProjectWingMasterSupportedFileName("acceptance.sf")).toBeTruthy();
    expect(isSmartFormSupportedFileName("acceptance.sf")).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("acceptance.sf", "MASTER")
    ).toBeFalsy();
    expect(
      isDesktopAgentOpenSupportedFileName("acceptance.sf", "READ_ONLY")
    ).toBeFalsy();
  });

  it("parses valid zip Master file entries", () => {
    expect(
      ZipMasterEntrySchema.safeParse({
        path: "evidence/a.txt",
        name: "a.txt",
        type: "file",
        size: 12,
      }).success
    ).toBeTruthy();
  });

  it("rejects zip Master file entries with children", () => {
    expect(
      ZipMasterEntrySchema.safeParse({
        path: "evidence/a.txt",
        name: "a.txt",
        type: "file",
        size: 12,
        children: [],
      }).success
    ).toBeFalsy();
  });

  it("parses valid zip Master folder entries with children", () => {
    expect(
      ZipMasterEntrySchema.safeParse({
        path: "evidence",
        name: "evidence",
        type: "folder",
        children: [
          {
            path: "evidence/a.txt",
            name: "a.txt",
            type: "file",
            size: 12,
          },
        ],
      }).success
    ).toBeTruthy();
  });

  it("rejects zip Master folder entries with size", () => {
    expect(
      ZipMasterEntrySchema.safeParse({
        path: "evidence",
        name: "evidence",
        type: "folder",
        size: 12,
      }).success
    ).toBeFalsy();
  });

  it("parses valid zip Master add-file operations", () => {
    expect(
      ZipMasterOperationSchema.safeParse({
        type: "ADD_FILE",
        entryPath: "evidence/a.txt",
        objectKey: "uploads/object-1",
        fileName: "a.txt",
        mimeType: "text/plain",
        fileSize: 12,
      }).success
    ).toBeTruthy();
  });

  it("rejects zip Master add-file operations without object keys", () => {
    expect(
      ZipMasterOperationSchema.safeParse({
        type: "ADD_FILE",
        entryPath: "evidence/a.txt",
        fileName: "a.txt",
        mimeType: "text/plain",
        fileSize: 12,
      }).success
    ).toBeFalsy();
  });

  it("parses valid zip Master move-entry operations", () => {
    expect(
      ZipMasterOperationSchema.safeParse({
        type: "MOVE_ENTRY",
        entryPath: "evidence/a.txt",
        targetPath: "archive/a.txt",
      }).success
    ).toBeTruthy();
  });

  it("rejects zip Master move-entry operations without target paths", () => {
    expect(
      ZipMasterOperationSchema.safeParse({
        type: "MOVE_ENTRY",
        entryPath: "evidence/a.txt",
      }).success
    ).toBeFalsy();
  });

  it("parses valid zip Master copy-entry operations", () => {
    expect(
      ZipMasterOperationSchema.safeParse({
        type: "COPY_ENTRY",
        entryPath: "evidence/a.txt",
        targetPath: "archive/a.txt",
      }).success
    ).toBeTruthy();
  });

  it("limits desktop agent read-only open to tracked desktop files", () => {
    expect(
      isDesktopAgentOpenSupportedFileName("cash.xlsx", "READ_ONLY")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("cash-exceptions.csv", "READ_ONLY")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("cash-exceptions.tsv", "READ_ONLY")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("memo.docx", "READ_ONLY")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("legacy.doc", "READ_ONLY")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("deck.pptx", "READ_ONLY")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("board.ppt", "READ_ONLY")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("support.pdf", "READ_ONLY")
    ).toBeTruthy();
    expect(
      isDesktopAgentOpenSupportedFileName("archive.zip", "READ_ONLY")
    ).toBeFalsy();
    expect(
      isDesktopAgentOpenSupportedFileName("evidence.msg", "READ_ONLY")
    ).toBeFalsy();
  });

  it("validates project template apply file selections", () => {
    const parsed = ApplyProjectTemplateSchema.safeParse({
      workflowNodeId: "node-1",
      bucket: "CURRENT",
      selectedTemplateFileIds: ["file-1", "file-2"],
      referenceCodeOverrides: [
        { itemId: "file-1", code: "A01-0001-F001" },
        { itemId: "file-2", code: "A01-0001-F002" },
      ],
    });
    expect(parsed.success).toBeTruthy();
    if (!parsed.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(parsed.data.selectedTemplateFileIds).toStrictEqual([
      "file-1",
      "file-2",
    ]);
    expect(parsed.data.referenceCodeOverrides).toStrictEqual([
      { itemId: "file-1", code: "A01-0001-F001" },
      { itemId: "file-2", code: "A01-0001-F002" },
    ]);
  });

  it("rejects applying a project template without selected content", () => {
    expect(
      ApplyProjectTemplateSchema.safeParse({
        workflowNodeId: "node-1",
        bucket: "CURRENT",
        selectedTemplateFileIds: [],
        selectedSmartFormReferenceIds: [],
      }).success
    ).toBeFalsy();
  });

  it("validates explicit Smart Form project language selection", () => {
    const parsed = Shared.CreateProjectSmartFormSchema.safeParse({
      smartFormTemplateVersionId: "version-1",
      title: "Independence confirmation",
      language: "en-US",
    });
    expect(parsed.success).toBeTruthy();
    if (!parsed.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(parsed.data.language).toBe("en-US");
  });

  it("validates project template zip import metadata", () => {
    const parsed = ImportProjectTemplateZipSchema.safeParse({
      name: "Imported template",
      code: "TMP-IMPORT",
      frameworkTemplateId: "framework-cas",
    });
    expect(parsed.success).toBeTruthy();
    if (!parsed.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(parsed.data).toStrictEqual({
      name: "Imported template",
      code: "TMP-IMPORT",
      frameworkTemplateId: "framework-cas",
      language: "zh-CN",
    });
  });

  it("accepts an invitation without a workspace", () => {
    // WorkspaceId is no longer part of AcceptInvitationSchema
    expect(AcceptInvitationSchema.safeParse({}).success).toBeTruthy();
    expect(
      AcceptInvitationSchema.safeParse({ workspaceId: "workspace-1" }).success
    ).toBeTruthy();
  });

  it("validates moving a joined project between desktop folders", () => {
    expect(
      MoveProjectPlacementSchema.safeParse({ folderId: "folder-2" }).success
    ).toBeTruthy();
    expect(
      MoveProjectPlacementSchema.safeParse({ folderId: "" }).success
    ).toBeFalsy();
  });

  it("accepts editable Engagement fee-note fields and rejects unknown fields", () => {
    const input = {
      feeNoteNumber: "28505",
      engagementReference: "H247AUP202412010001",
      issueDate: "2026-08-19",
      recipientName: "Harbour Investment Limited",
      recipientAddress: "Hong Kong",
      currency: "HKD" as const,
      serviceDescription: "Audit services for the year ended 2024-12-31",
      lineItems: [
        {
          id: "final-service-fee",
          description: "Final service fee",
          amount: "138000.00",
        },
      ],
      amount: "138000.00",
      issuerReference: "JMZ/JKCP",
      signatoryName: "Jane Manager",
      bankPayeeName: "SHINEWING (HK) CPA LIMITED",
      bankName: "Hang Seng Bank Limited",
      hkdAccountNumber: "787-800014-001",
      cnyAccountNumber: "787-800014-883",
      usdAccountNumber: "787-300914-883",
      swiftCode: "HASEHKHH",
      firmLegalName: "SHINEWING (HK) CPA LIMITED",
      firmAddress: "Hong Kong",
      firmPhone: "Tel. (852) 3583 8000",
      firmFax: "Fax. (852) 3583 8001",
      firmEmail: "info@shinewing.hk",
      firmWebsite: "www.shinewing.hk",
    };
    expect(
      Shared.CmpEngagementFeeNoteUpdateSchema.safeParse(input).success
    ).toBeTruthy();
    expect(
      Shared.CmpEngagementFeeNoteUpdateSchema.safeParse({
        ...input,
        retiredField: "not allowed",
      }).success
    ).toBeFalsy();
    expect(
      Shared.CmpEngagementFeeNoteUpdateSchema.safeParse({
        ...input,
        lineItems: [{ id: "", description: "Invalid", amount: "1.00" }],
      }).success
    ).toBeFalsy();
    expect(
      Shared.CmpEngagementFeeNoteUpdateSchema.safeParse({
        ...input,
        localizedContent: {
          "zh-CN": {
            recipientName: "维致客户",
            recipientAttention: "董事",
            recipientSalutation: "贵公司",
            recipientAddress: "香港",
            serviceDescription: "专业服务",
            lineItemDescriptions: { "final-service-fee": "专业服务" },
            signatoryName: "张三",
            bankPayeeName: "维致（香港）会计师事务所",
            bankName: "恒生银行",
            firmLegalName: "维致（香港）会计师事务所",
            firmAddress: "香港灣仔",
          },
          "en-US": {
            recipientName: "Wing Client",
            recipientAttention: "Director",
            recipientSalutation: "Your company",
            recipientAddress: "Hong Kong",
            serviceDescription: "Professional services",
            lineItemDescriptions: {
              "final-service-fee": "Professional services",
            },
            signatoryName: "Jane Manager",
            bankPayeeName: "Wing Zenith",
            bankName: "Hang Seng Bank",
            firmLegalName: "Wing Zenith",
            firmAddress: "Wan Chai, Hong Kong",
          },
        },
      }).success
    ).toBeTruthy();
  });
});
