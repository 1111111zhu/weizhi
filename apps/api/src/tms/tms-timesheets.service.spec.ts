import type { TmsTimesheetRow } from "@project-wing/shared";

import {
  ApiConflictException,
  ApiForbiddenException,
} from "../common/api-error";
import { TmsTimesheetsService } from "./tms-timesheets.service";

const member = {
  id: "member-1",
  email: "member@example.com",
  name: "Member",
  globalRole: "STAFF",
} as const;
const admin = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  globalRole: "MANAGER",
} as const;

describe(TmsTimesheetsService, () => {
  it("creates a new immutable submitted revision on every submit", async () => {
    const stored = {
      id: "month-1",
      userId: member.id,
      year: 2026,
      month: 7,
      draftRows: [],
      firstStatus: "SUBMITTED",
      firstSubmittedRevision: 1,
      firstSubmittedRows: [],
      secondStatus: "DRAFT",
      secondSubmittedRevision: 0,
      secondSubmittedRows: null,
    };
    const prisma = {
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(stored),
        update: vi.fn().mockResolvedValue({
          ...stored,
          firstSubmittedRevision: 2,
        }),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.submit(member as never, 2026, 7, {
      scope: "FIRST_HALF",
    });

    expect(result.periods.FIRST_HALF).toMatchObject({
      status: "SUBMITTED",
      revision: 2,
      editable: true,
    });
  });

  it("does not create an ambiguous approval record for a legacy row without an EMP project", async () => {
    const legacyRow = {
      id: "100204-Normal",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "",
      engagementId: "",
      engagementCode: "100204",
      clientCode: "E00421",
      clientName: "WZ Holdings Limited",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    } as unknown as TmsTimesheetRow;
    const stored = {
      id: "month-legacy-demo",
      userId: member.id,
      year: 2026,
      month: 7,
      draftRows: [legacyRow],
      firstStatus: "DRAFT",
      firstSubmittedRevision: 0,
      firstSubmittedRows: null,
      secondStatus: "DRAFT",
      secondSubmittedRevision: 0,
      secondSubmittedRows: null,
    };
    const approvalRecord = {
      id: "approval-legacy-demo",
      ownerUserId: member.id,
      engagementId: "engagement-hbr",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [legacyRow],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    };
    const create = vi.fn().mockResolvedValue(approvalRecord);
    const prisma = {
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(stored),
        update: vi
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...stored, ...data })
          ),
      },
      cmpEngagement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "engagement-hbr",
            engagementCode: "HBR-2026-ACC",
            codeAliases: [{ normalizedCode: "100204" }],
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({ id: "engagement-hbr" }),
      },
      tmsApprovalSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([approvalRecord]),
        create,
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.submit(member as never, 2026, 7, {
      scope: "FIRST_HALF",
    });

    expect(create).not.toHaveBeenCalled();
    expect(result.periods.FIRST_HALF.approvalStatus).toBe("SUBMITTED");
  });

  it("creates a MIC approval record for a row with a project but no code", async () => {
    const projectRow = {
      id: "project-without-code-Normal",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "",
      engagementId: "",
      engagementCode: "",
      projectId: "project-hbr",
      clientCode: "",
      clientName: "Harbour Retail Limited",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    } as unknown as TmsTimesheetRow;
    const stored = {
      id: "month-project-without-code",
      userId: member.id,
      year: 2026,
      month: 7,
      draftRows: [projectRow],
      firstStatus: "DRAFT",
      firstSubmittedRevision: 0,
      firstSubmittedRows: null,
      secondStatus: "DRAFT",
      secondSubmittedRevision: 0,
      secondSubmittedRows: null,
    };
    const approvalRecord = {
      id: "approval-project-without-code",
      ownerUserId: member.id,
      engagementId: "engagement-hbr",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [projectRow],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    };
    const create = vi.fn().mockResolvedValue(approvalRecord);
    const prisma = {
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(stored),
        update: vi
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...stored, ...data })
          ),
      },
      project: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "project-hbr", cmpEngagementId: "engagement-hbr" },
          ]),
      },
      cmpEngagement: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: "engagement-hbr" }),
      },
      tmsApprovalSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([approvalRecord]),
        create,
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.submit(member as never, 2026, 7, {
      scope: "FIRST_HALF",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          engagementId: "engagement-hbr",
          projectId: "project-hbr",
          submittedRows: [
            expect.objectContaining({ engagementId: "engagement-hbr" }),
          ],
        }),
      })
    );
    expect(result.periods.FIRST_HALF.approvalStatus).toBe("SUBMITTED");
  });

  it("keeps a submitted EMP row pending until its project is linked to CMP", async () => {
    const projectRow = {
      id: "project-without-cmp-Normal",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "",
      engagementId: "unlinked:project-a",
      engagementCode: "EMP-A",
      projectId: "project-a",
      clientCode: "EMP-A",
      clientName: "Project A",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    } as unknown as TmsTimesheetRow;
    const stored = {
      id: "month-pending-link",
      userId: member.id,
      year: 2026,
      month: 7,
      draftRows: [projectRow],
      firstStatus: "DRAFT",
      firstSubmittedRevision: 0,
      firstSubmittedRows: null,
      secondStatus: "DRAFT",
      secondSubmittedRevision: 0,
      secondSubmittedRows: null,
    };
    const pendingCreate = vi.fn().mockResolvedValue({
      id: "pending-1",
      ownerUserId: member.id,
      projectId: "project-a",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "PENDING_LINK",
      submittedRows: [projectRow],
    });
    const prisma = {
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(stored),
        update: vi
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...stored, ...data })
          ),
      },
      project: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "project-a", cmpEngagementId: null }]),
      },
      cmpEngagement: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      tmsApprovalSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      tmsPendingLinkSubmission: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi
          .fn()
          .mockResolvedValue([{ half: "FIRST_HALF", status: "PENDING_LINK" }]),
        create: pendingCreate,
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.submit(member as never, 2026, 7, {
      scope: "FIRST_HALF",
    });

    expect(pendingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: member.id,
          projectId: "project-a",
          half: "FIRST_HALF",
          status: "PENDING_LINK",
        }),
      })
    );
    expect(result.periods.FIRST_HALF).toMatchObject({
      status: "SUBMITTED",
      linkStatus: "PENDING_LINK",
    });
    expect(prisma.tmsApprovalSubmission.create).not.toHaveBeenCalled();
  });

  it("promotes a pending TMS submission after EMP links the project to CMP", async () => {
    const pendingRow = {
      id: "project-a-Normal",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "",
      engagementId: "unlinked:project-a",
      engagementCode: "EMP-A",
      projectId: "project-a",
      clientCode: "EMP-A",
      clientName: "Project A",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    } as unknown as TmsTimesheetRow;
    const pending = {
      id: "pending-1",
      ownerUserId: member.id,
      projectId: "project-a",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "PENDING_LINK",
      submittedRows: [pendingRow],
    };
    const approvalCreate = vi.fn().mockResolvedValue({
      id: "approval-1",
      ownerUserId: member.id,
      engagementId: "engagement-hbr",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [{ ...pendingRow, engagementId: "engagement-hbr" }],
    });
    const pendingUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: member.id,
          email: member.email,
          name: member.name,
          globalRole: member.globalRole,
        }),
      },
      cmpEngagement: {
        findFirst: vi.fn().mockResolvedValue({ id: "engagement-hbr" }),
      },
      tmsApprovalSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: approvalCreate,
      },
      tmsPendingLinkSubmission: {
        findMany: vi.fn().mockResolvedValue([pending]),
        update: pendingUpdate,
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-pending-link",
          userId: member.id,
          year: 2026,
          month: 7,
          draftRows: [pendingRow],
          firstSubmittedRows: [pendingRow],
          secondSubmittedRows: null,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);

    await service.reconcileProjectLink("project-a", "engagement-hbr");

    expect(approvalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          engagementId: "engagement-hbr",
          projectId: "project-a",
          submittedRows: [
            expect.objectContaining({ engagementId: "engagement-hbr" }),
          ],
        }),
      })
    );
    expect(pendingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pending.id },
        data: expect.objectContaining({
          status: "LINKED",
          linkedEngagementId: "engagement-hbr",
        }),
      })
    );
  });

  it("refreshes linked TMS draft rows after an EMP project gains a CMP link", async () => {
    const linkedRow = {
      id: "tms-row-linked-cmp",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "Dummy",
      engagementId: "",
      engagementCode: "DUMMY-EMP-1000028",
      projectId: "project-a",
      clientCode: "DUMMY-EMP-1000028",
      clientName: "Dummy",
      hoursByDate: {},
      periodTotal: 0,
      source: "UNLINKED_PROJECT",
    } as unknown as TmsTimesheetRow;
    const monthUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      tmsPendingLinkSubmission: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      tmsProjectLink: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "tms-link-cmp",
            referenceNumber: 102,
            ownerUserId: member.id,
            rowId: linkedRow.id,
            year: 2026,
            month: 8,
            periodScope: "first",
            projectId: "project-a",
            status: "LINKED",
          },
        ]),
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: "project-a",
          projectCode: "ORC-2026-AUD",
          name: "Dummy",
          cmpEngagementId: "engagement-orc",
          cmpEngagement: {
            id: "engagement-orc",
            engagementCode: "ORC-2026-AUD",
            client: {
              clientCode: "C-ORC-2026",
              nameEn: "Orchid Technology Limited",
              nameZh: "Orchid Technology Limited",
            },
            pic: "Jony Ma",
            mic: "Eden Chan",
          },
        }),
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-linked-cmp",
          userId: member.id,
          year: 2026,
          month: 8,
          draftRows: [linkedRow],
        }),
        update: monthUpdate,
      },
    };
    const service = new TmsTimesheetsService(prisma as never);

    await service.reconcileProjectLink("project-a", "engagement-orc");

    expect(monthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          draftRows: [
            expect.objectContaining({
              projectId: "project-a",
              engagementId: "engagement-orc",
              engagementCode: "ORC-2026-AUD",
              clientCode: "C-ORC-2026",
              clientName: "Orchid Technology Limited",
              pic: "Jony Ma",
              mic: "Eden Chan",
              source: "ENGAGEMENT",
            }),
          ],
        },
      })
    );
  });

  it("keeps the EMP link while refreshing a TMS row after CMP is unlinked", async () => {
    const linkedRow = {
      id: "tms-row-unlinked-cmp",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "Dummy",
      engagementId: "engagement-orc",
      engagementCode: "ORC-2026-AUD",
      projectId: "project-a",
      clientCode: "C-ORC-2026",
      clientName: "Orchid Technology Limited",
      hoursByDate: {},
      periodTotal: 0,
      source: "ENGAGEMENT",
    } as unknown as TmsTimesheetRow;
    const monthUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      tmsProjectLink: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "tms-link-unlinked-cmp",
            referenceNumber: 103,
            ownerUserId: member.id,
            rowId: linkedRow.id,
            year: 2026,
            month: 8,
            periodScope: "first",
            projectId: "project-a",
            status: "LINKED",
          },
        ]),
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: "project-a",
          projectCode: "DUMMY-EMP-1000028",
          name: "Dummy",
          cmpEngagementId: null,
          cmpEngagement: null,
        }),
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-unlinked-cmp",
          userId: member.id,
          year: 2026,
          month: 8,
          draftRows: [linkedRow],
        }),
        update: monthUpdate,
      },
    };
    const service = new TmsTimesheetsService(prisma as never);

    await service.refreshProjectLink("project-a");

    expect(monthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          draftRows: [
            expect.objectContaining({
              projectId: "project-a",
              engagementId: "",
              engagementCode: "DUMMY-EMP-1000028",
              clientCode: "DUMMY-EMP-1000028",
              clientName: "Dummy",
              pic: null,
              mic: null,
              source: "UNLINKED_PROJECT",
            }),
          ],
        },
      })
    );
  });

  it("stores a no-code Chargeable draft as an identifiable pending TMS link", async () => {
    const row = {
      id: "tms-row-pending",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "Unassigned fieldwork",
      engagementId: "",
      engagementCode: "",
      projectId: null,
      clientCode: "",
      clientName: "",
      hoursByDate: {},
      periodTotal: 0,
      source: "TMS_PENDING",
    } as unknown as TmsTimesheetRow;
    const stored = {
      id: "month-pending-draft",
      userId: member.id,
      year: 2026,
      month: 7,
      draftRows: [],
      firstStatus: "DRAFT",
      firstSubmittedRevision: 0,
      firstSubmittedRows: null,
      secondStatus: "DRAFT",
      secondSubmittedRevision: 0,
      secondSubmittedRows: null,
    };
    const linkUpsert = vi.fn().mockResolvedValue({
      id: "tms-link-1",
      referenceNumber: 7,
      ownerUserId: member.id,
      rowId: row.id,
      year: 2026,
      month: 7,
      periodScope: "first",
      projectId: null,
      status: "PENDING",
    });
    const prisma = {
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({
          ...stored,
          draftRows: [row],
        }),
        update: vi
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...stored, ...data })
          ),
      },
      tmsApprovalSubmission: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      tmsProjectLink: {
        upsert: linkUpsert,
        findMany: vi.fn().mockResolvedValue([]),
      },
      project: {
        findMany: vi.fn(),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);

    await service.saveDraft(member as never, 2026, 7, { rows: [row] });

    expect(linkUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerUserId_rowId: {
            ownerUserId: member.id,
            rowId: row.id,
          },
        },
        create: expect.objectContaining({
          ownerUserId: member.id,
          rowId: row.id,
          projectId: null,
          status: "PENDING",
        }),
      })
    );
    expect(prisma.project.findMany).not.toHaveBeenCalled();
    expect(prisma.tmsTimesheetMonth.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftRows: [
            expect.objectContaining({
              id: row.id,
              engagementCode: "DUMMY-TMS-000007",
            }),
          ],
        }),
      })
    );
  });

  it("links a pending TMS row to an EMP project through one reversible relation", async () => {
    const row = {
      id: "tms-row-link",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "Fieldwork",
      engagementId: "",
      engagementCode: "",
      projectId: null,
      clientCode: "",
      clientName: "",
      hoursByDate: {},
      periodTotal: 0,
      source: "TMS_PENDING",
    } as unknown as TmsTimesheetRow;
    const link = {
      id: "tms-link-2",
      referenceNumber: 8,
      ownerUserId: member.id,
      rowId: row.id,
      year: 2026,
      month: 7,
      periodScope: "first",
      projectId: null,
      status: "PENDING",
    };
    const linkUpdate = vi.fn().mockResolvedValue({
      ...link,
      projectId: "project-a",
      status: "LINKED",
    });
    const monthUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      tmsProjectLink: {
        findUnique: vi.fn().mockResolvedValue(link),
        findFirst: vi.fn().mockResolvedValue(null),
        update: linkUpdate,
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: "project-a",
          status: "ACTIVE",
          projectCode: "UNLINKED-A",
          name: "Project A",
          cmpEngagementId: null,
        }),
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-link",
          userId: member.id,
          year: 2026,
          month: 7,
          draftRows: [row],
        }),
        update: monthUpdate,
      },
      projectMember: {
        findUnique: vi.fn().mockResolvedValue({
          projectId: "project-a",
          userId: member.id,
          status: "ACTIVE",
        }),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.linkProjectRow(
      member as never,
      row.id,
      "project-a"
    );

    expect(linkUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: link.id },
        data: { projectId: "project-a", status: "LINKED" },
      })
    );
    expect(monthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "month-link" },
        data: expect.objectContaining({
          draftRows: [expect.objectContaining({ projectId: "project-a" })],
        }),
      })
    );
    expect(result).toMatchObject({
      id: link.id,
      rowId: row.id,
      projectId: "project-a",
      status: "LINKED",
      tmsCode: "DUMMY-TMS-000008",
    });
  });

  it("includes saved Chargeable row details when listing TMS project links", async () => {
    const row = {
      id: "tms-row-list",
      periodScope: "second",
      type: "Chargeable",
      workType: "OT",
      details: "OT",
      description: "Reporting support",
      hoursByDate: {
        "2026-07-16": 2,
        "2026-07-17": 3,
      },
      periodTotal: 5,
    } as unknown as TmsTimesheetRow;
    const record = {
      id: "tms-link-list",
      referenceNumber: 10,
      ownerUserId: member.id,
      rowId: row.id,
      year: 2026,
      month: 7,
      periodScope: "second",
      label: "Reporting support",
      projectId: null,
      status: "PENDING",
      owner: { name: member.name },
      project: null,
    };
    const prisma = {
      tmsProjectLink: {
        findMany: vi.fn().mockResolvedValue([record]),
      },
      tmsTimesheetMonth: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId: member.id,
            year: 2026,
            month: 7,
            draftRows: [row],
          },
        ]),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);

    const result = await service.listProjectLinks(member as never, {
      status: "PENDING",
    });

    expect(result.links).toStrictEqual([
      expect.objectContaining({
        rowId: row.id,
        workType: "OT",
        description: "Reporting support",
        hoursByDate: row.hoursByDate,
        periodTotal: 5,
      }),
    ]);
  });

  it("unlinks the same TMS/EMP relation without deleting its link record", async () => {
    const link = {
      id: "tms-link-3",
      referenceNumber: 9,
      ownerUserId: member.id,
      rowId: "tms-row-unlink",
      year: 2026,
      month: 7,
      periodScope: "first",
      projectId: "project-a",
      status: "LINKED",
    };
    const linkUpdate = vi.fn().mockResolvedValue({
      ...link,
      projectId: null,
      status: "PENDING",
    });
    const monthUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      tmsProjectLink: {
        findUnique: vi.fn().mockResolvedValue(link),
        update: linkUpdate,
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: "project-a",
          status: "ACTIVE",
          projectCode: "UNLINKED-A",
          name: "Project A",
          cmpEngagementId: null,
        }),
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-unlink",
          userId: member.id,
          year: 2026,
          month: 7,
          draftRows: [
            {
              id: link.rowId,
              type: "Chargeable",
              projectId: "project-a",
              engagementId: "",
              engagementCode: "UNLINKED-A",
              clientCode: "",
              clientName: "Project A",
              hoursByDate: {},
              periodTotal: 0,
              periodScope: "first",
              details: "Normal",
              description: "",
            },
          ],
        }),
        update: monthUpdate,
      },
      projectMember: {
        findUnique: vi.fn().mockResolvedValue({
          projectId: "project-a",
          userId: member.id,
          status: "ACTIVE",
        }),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.unlinkProjectRow(member as never, link.rowId);

    expect(linkUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: link.id },
        data: { projectId: null, status: "PENDING" },
      })
    );
    expect(monthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "month-unlink" },
        data: expect.objectContaining({
          draftRows: [
            expect.objectContaining({
              projectId: null,
              engagementId: "",
              engagementCode: "DUMMY-TMS-000009",
              clientName: "",
            }),
          ],
        }),
      })
    );
    expect(result).toMatchObject({
      id: link.id,
      rowId: link.rowId,
      projectId: null,
      status: "PENDING",
    });
  });

  it("approves only the explicit member and half", async () => {
    const prisma = {
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-1",
          userId: member.id,
          year: 2026,
          month: 7,
          draftRows: [],
          firstStatus: "SUBMITTED",
          firstSubmittedRevision: 2,
          firstSubmittedRows: [],
          secondStatus: "SUBMITTED",
          secondSubmittedRevision: 1,
          secondSubmittedRows: [],
        }),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "month-1",
            userId: member.id,
            year: 2026,
            month: 7,
            draftRows: [],
            firstStatus: data.firstStatus,
            firstSubmittedRevision: 2,
            firstSubmittedRows: [],
            secondStatus: "SUBMITTED",
            secondSubmittedRevision: 1,
            secondSubmittedRows: [],
          })
        ),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.approve(
      admin as never,
      member.id,
      2026,
      7,
      "FIRST_HALF",
      {
        expectedSubmittedRevision: 2,
      }
    );

    expect(prisma.tmsTimesheetMonth.findUnique).toHaveBeenCalledWith({
      where: {
        userId_year_month: { userId: member.id, year: 2026, month: 7 },
      },
    });
    expect(result.periods.FIRST_HALF.status).toBe("APPROVED");
    expect(result.periods.SECOND_HALF.status).toBe("SUBMITTED");
  });

  it("rejects changes to approved non-zero project hours", async () => {
    const approvedRow: TmsTimesheetRow = {
      id: "row-1",
      periodScope: "all",
      type: "Chargeable",
      details: "Normal",
      description: "",
      engagementId: "engagement-1",
      periodTotal: 1,
      hoursByDate: { "2026-07-15": 1 },
    };
    const prisma = {
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-1",
          userId: member.id,
          year: 2026,
          month: 7,
          draftRows: [approvedRow],
          firstStatus: "APPROVED",
          firstSubmittedRevision: 1,
          firstSubmittedRows: [],
          secondStatus: "DRAFT",
          secondSubmittedRevision: 0,
          secondSubmittedRows: null,
        }),
        update: vi.fn(),
      },
      tmsApprovalSubmission: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "approval-1",
            ownerUserId: member.id,
            engagementId: "engagement-1",
            half: "FIRST_HALF",
            revision: 1,
            status: "APPROVED",
            submittedRows: [approvedRow],
          },
        ]),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);

    await expect(
      service.saveDraft(member as never, 2026, 7, {
        rows: [
          {
            ...approvedRow,
            periodTotal: 2,
            hoursByDate: { "2026-07-15": 2 },
          },
        ],
      })
    ).rejects.toBeInstanceOf(ApiConflictException);
  });

  it("allows an approved zero-hour cell to be edited", async () => {
    const approvedRow: TmsTimesheetRow = {
      id: "row-zero",
      periodScope: "all",
      type: "Chargeable",
      details: "Normal",
      description: "",
      engagementId: "engagement-1",
      periodTotal: 0,
      hoursByDate: { "2026-07-15": 0 },
    };
    const upsert = vi.fn().mockResolvedValue({
      id: "month-1",
      userId: member.id,
      year: 2026,
      month: 7,
      draftRows: [
        { ...approvedRow, periodTotal: 2, hoursByDate: { "2026-07-15": 2 } },
      ],
      firstStatus: "APPROVED",
      firstSubmittedRevision: 1,
      firstSubmittedRows: [approvedRow],
      secondStatus: "DRAFT",
      secondSubmittedRevision: 0,
      secondSubmittedRows: null,
    });
    const prisma = {
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-1",
          userId: member.id,
          year: 2026,
          month: 7,
          draftRows: [approvedRow],
          firstStatus: "APPROVED",
          firstSubmittedRevision: 1,
          firstSubmittedRows: [approvedRow],
          secondStatus: "DRAFT",
          secondSubmittedRevision: 0,
          secondSubmittedRows: null,
        }),
        upsert,
      },
      tmsApprovalSubmission: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "approval-zero",
            ownerUserId: member.id,
            engagementId: "engagement-1",
            half: "FIRST_HALF",
            revision: 1,
            status: "APPROVED",
            submittedRows: [approvedRow],
          },
        ]),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);

    await service.saveDraft(member as never, 2026, 7, {
      rows: [
        { ...approvedRow, periodTotal: 2, hoursByDate: { "2026-07-15": 2 } },
      ],
    });

    expect(upsert).toHaveBeenCalledOnce();
  });

  it("saves Normal hours above 8 as a draft for later correction", async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: "month-1",
      userId: member.id,
      year: 2026,
      month: 7,
      draftRows: [],
      firstStatus: "DRAFT",
      firstSubmittedRevision: 0,
      firstSubmittedRows: null,
      secondStatus: "DRAFT",
      secondSubmittedRevision: 0,
      secondSubmittedRows: null,
    });
    const service = new TmsTimesheetsService({
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert,
      },
    } as never);
    const row: TmsTimesheetRow = {
      id: "normal-row",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "",
      hoursByDate: { "2026-07-01": 9 },
      periodTotal: 9,
    };

    await expect(
      service.saveDraft(member as never, 2026, 7, { rows: [row] })
    ).resolves.toBeDefined();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { draftRows: [row] },
      })
    );
  });

  it("saves Normal plus Leave above 8 as a draft for later correction", async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: "month-1",
      userId: member.id,
      year: 2026,
      month: 7,
      draftRows: [],
      firstStatus: "DRAFT",
      firstSubmittedRevision: 0,
      firstSubmittedRows: null,
      secondStatus: "DRAFT",
      secondSubmittedRevision: 0,
      secondSubmittedRows: null,
    });
    const service = new TmsTimesheetsService({
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert,
      },
    } as never);
    const rows: TmsTimesheetRow[] = [
      {
        id: "normal-row",
        periodScope: "first",
        type: "Chargeable",
        workType: "Normal",
        details: "Normal",
        description: "",
        hoursByDate: { "2026-07-01": 8 },
        periodTotal: 8,
      },
      {
        id: "leave-row",
        periodScope: "first",
        type: "Leave",
        details: "Annual Leave",
        description: "",
        hoursByDate: { "2026-07-01": 1 },
        periodTotal: 1,
      },
    ];

    await expect(
      service.saveDraft(member as never, 2026, 7, { rows })
    ).resolves.toBeDefined();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { draftRows: rows },
      })
    );
  });

  it("rejects an invalid draft when submitting", async () => {
    const rows: TmsTimesheetRow[] = [
      {
        id: "normal-row",
        periodScope: "first",
        type: "Chargeable",
        workType: "Normal",
        details: "Normal",
        description: "",
        hoursByDate: { "2026-07-01": 8 },
        periodTotal: 8,
      },
      {
        id: "leave-row",
        periodScope: "first",
        type: "Leave",
        details: "Annual Leave",
        description: "",
        hoursByDate: { "2026-07-01": 1 },
        periodTotal: 1,
      },
    ];
    const update = vi.fn();
    const service = new TmsTimesheetsService({
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-1",
          userId: member.id,
          year: 2026,
          month: 7,
          draftRows: rows,
          firstStatus: "DRAFT",
          firstSubmittedRevision: 0,
          firstSubmittedRows: null,
          secondStatus: "DRAFT",
          secondSubmittedRevision: 0,
          secondSubmittedRows: null,
        }),
        update,
      },
    } as never);

    await expect(
      service.submit(member as never, 2026, 7, { scope: "FIRST_HALF" })
    ).rejects.toMatchObject({
      response: {
        code: "VALIDATION_FAILED",
        message: expect.stringContaining("Normal + Leave"),
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("validates only the requested half when submitting a period", async () => {
    const rows: TmsTimesheetRow[] = [
      {
        id: "first-normal-row",
        periodScope: "first",
        type: "Chargeable",
        workType: "Normal",
        details: "Normal",
        description: "",
        hoursByDate: { "2026-07-01": 8 },
        periodTotal: 8,
      },
      {
        id: "first-leave-row",
        periodScope: "first",
        type: "Leave",
        workType: "Normal",
        details: "Annual Leave",
        description: "",
        hoursByDate: { "2026-07-01": 1 },
        periodTotal: 1,
      },
      {
        id: "second-normal-row",
        periodScope: "second",
        type: "Chargeable",
        workType: "Normal",
        details: "Normal",
        description: "",
        engagementId: "engagement-hbr",
        hoursByDate: { "2026-07-16": 8 },
        periodTotal: 8,
      },
    ];
    const stored = {
      id: "month-1",
      userId: member.id,
      year: 2026,
      month: 7,
      draftRows: rows,
      firstStatus: "DRAFT",
      firstSubmittedRevision: 0,
      firstSubmittedRows: null,
      secondStatus: "DRAFT",
      secondSubmittedRevision: 0,
      secondSubmittedRows: null,
    };
    const update = vi.fn().mockImplementation(({ data }) => ({
      ...stored,
      ...data,
    }));
    const service = new TmsTimesheetsService({
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findFirst: vi.fn().mockResolvedValue({ id: "engagement-hbr" }),
      },
      tmsApprovalSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      },
    } as never);
    const result = await service.submit(member as never, 2026, 7, {
      scope: "SECOND_HALF",
    });

    expect(result.periods.SECOND_HALF).toMatchObject({
      status: "SUBMITTED",
      revision: 1,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ secondStatus: "SUBMITTED" }),
      })
    );
  });

  it("lists only CMP projects where the actor is PIC or MIC", async () => {
    const prisma = {
      cmpEngagement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "engagement-1",
            engagementCode: "ENG-001",
            pic: "Partner",
            mic: "Manager",
            status: "ARCHIVED",
            client: {
              clientCode: "C-001",
              nameEn: "Client one",
              nameZh: "客户一",
            },
          },
        ]),
      },
      tmsApprovalSubmission: {
        findMany: vi.fn().mockResolvedValue([
          {
            engagementId: "engagement-1",
            ownerUserId: "employee-1",
            half: "FIRST_HALF",
            revision: 1,
            status: "SUBMITTED",
          },
        ]),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);

    await expect(
      service.listApprovalProjects(admin as never, 2026, 7)
    ).resolves.toStrictEqual({
      projects: [
        expect.objectContaining({
          engagementId: "engagement-1",
          status: "ARCHIVED",
          pendingCount: 1,
          returnedCount: 0,
        }),
      ],
    });
    expect(prisma.cmpEngagement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { OR: [{ picUserId: admin.id }, { micUserId: admin.id }] },
          ]),
        }),
      })
    );
  });

  it("keeps pending approvals visible across months when no period is selected", async () => {
    const prisma = {
      cmpEngagement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "engagement-1",
            engagementCode: "ENG-001",
            pic: "Partner",
            mic: "Manager",
            status: "ACTIVE",
            client: {
              clientCode: "C-001",
              nameEn: "Client one",
              nameZh: "客户一",
            },
          },
        ]),
      },
      tmsApprovalSubmission: {
        findMany: vi.fn().mockResolvedValue([
          {
            engagementId: "engagement-1",
            ownerUserId: "employee-1",
            year: 2026,
            month: 8,
            half: "FIRST_HALF",
            revision: 1,
            status: "APPROVED",
          },
          {
            engagementId: "engagement-1",
            ownerUserId: "employee-1",
            year: 2026,
            month: 7,
            half: "FIRST_HALF",
            revision: 1,
            status: "SUBMITTED",
          },
        ]),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);

    await expect(
      service.listApprovalProjects(admin as never)
    ).resolves.toStrictEqual({
      projects: [
        expect.objectContaining({
          engagementId: "engagement-1",
          pendingCount: 1,
        }),
      ],
    });
    expect(prisma.tmsApprovalSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { engagementId: { in: ["engagement-1"] } },
      })
    );
  });

  it("lists active ordinary project members as not-submitted baseline rows", async () => {
    const prisma = {
      cmpEngagement: {
        findUnique: vi
          .fn()
          .mockImplementation(
            ({ select }: { select?: { picUserId?: boolean } }) =>
              Promise.resolve(
                select?.picUserId
                  ? { picUserId: admin.id, micUserId: "mic-1" }
                  : {
                      engagementCode: "ENG-001",
                      client: {
                        clientCode: "C-001",
                        nameEn: "Client one",
                        nameZh: "客户一",
                      },
                    }
              )
          ),
      },
      projectMember: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId: "ordinary-1",
            status: "ACTIVE",
            user: {
              id: "ordinary-1",
              name: "Ordinary One",
              email: "ordinary@example.com",
              globalRole: "STAFF",
            },
            project: {
              id: "project-1",
              projectCode: "EMP-001",
              name: "Annual audit",
              status: "ACTIVE",
              cmpEngagementId: "engagement-1",
            },
          },
          {
            userId: admin.id,
            status: "ACTIVE",
            user: {
              id: admin.id,
              name: admin.name,
              email: admin.email,
              globalRole: admin.globalRole,
            },
            project: { cmpEngagementId: "engagement-1" },
          },
          {
            userId: "partner-1",
            status: "ACTIVE",
            user: {
              id: "partner-1",
              name: "Partner One",
              email: "partner@example.com",
              globalRole: "PARTNER",
            },
            project: { cmpEngagementId: "engagement-1" },
          },
          {
            userId: "manager-1",
            status: "ACTIVE",
            user: {
              id: "manager-1",
              name: "Manager One",
              email: "manager@example.com",
              globalRole: "MANAGER",
            },
            project: { cmpEngagementId: "engagement-1" },
          },
          {
            userId: "inactive-1",
            status: "INACTIVE",
            user: {
              id: "inactive-1",
              name: "Inactive One",
              email: "inactive@example.com",
              globalRole: "STAFF",
            },
            project: { cmpEngagementId: "engagement-1" },
          },
        ]),
      },
      tmsApprovalSubmission: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.listApprovalRecords(
      admin as never,
      "engagement-1",
      2026,
      7
    );

    expect(result.records).toHaveLength(2);
    expect(
      result.records.map((record) => record.ownerUserId)
    ).not.toStrictEqual(expect.arrayContaining(["partner-1", "manager-1"]));
    expect(result.records).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerUserId: "ordinary-1",
          ownerName: "Ordinary One",
          projectId: "project-1",
          projectCode: "EMP-001",
          projectName: "Annual audit",
          half: "FIRST_HALF",
          status: "NOT_SUBMITTED",
          submittedRows: [],
        }),
        expect.objectContaining({
          ownerUserId: "ordinary-1",
          half: "SECOND_HALF",
          status: "NOT_SUBMITTED",
        }),
      ])
    );
  });

  it("rejects approval project listing for a non-Partner/Manager before querying", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new TmsTimesheetsService({
      cmpEngagement: { findMany },
      tmsApprovalSubmission: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as never);
    const staff = { id: "staff-1", globalRole: "STAFF" };

    await expect(
      service.listApprovalProjects(staff as never, 2026, 7)
    ).rejects.toBeInstanceOf(ApiForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rejects a non-Partner/Manager from approving a submission", async () => {
    const stored = {
      id: "approval-1",
      ownerUserId: "employee-1",
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    } as const;
    const findUnique = vi.fn().mockResolvedValue(stored);
    const service = new TmsTimesheetsService({
      tmsApprovalSubmission: {
        findUnique,
        findFirst: vi.fn().mockResolvedValue(stored),
        update: vi.fn().mockResolvedValue({
          ...stored,
          status: "APPROVED",
          reviewedById: "staff-1",
          reviewedAt: new Date("2026-07-17T09:00:00.000Z"),
        }),
      },
      cmpEngagement: {
        findUnique: vi.fn().mockImplementation(({ select }) =>
          Promise.resolve(
            select?.picUserId
              ? { picUserId: "staff-1", micUserId: "mic-1" }
              : {
                  engagementCode: "ENG-001",
                  client: {
                    clientCode: "C-001",
                    nameEn: "Client one",
                    nameZh: "客户一",
                  },
                }
          )
        ),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          name: "Employee",
          email: "employee@example.com",
        }),
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as never);
    const staff = { id: "staff-1", globalRole: "STAFF" };

    await expect(
      service.approveSubmission(staff as never, "approval-1", {
        expectedRevision: 1,
      })
    ).rejects.toBeInstanceOf(ApiForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("keeps a reason-free return as RETURNED instead of treating it as approval", async () => {
    const stored = {
      id: "approval-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    };
    const update = vi.fn().mockResolvedValue({
      ...stored,
      status: "RETURNED",
      reviewedById: admin.id,
      reviewedAt: new Date("2026-07-17T09:00:00.000Z"),
    });
    const prisma = {
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi
          .fn()
          .mockImplementation(
            ({ select }: { select?: { picUserId?: boolean } }) =>
              Promise.resolve(
                select?.picUserId
                  ? { picUserId: admin.id, micUserId: "mic-1" }
                  : {
                      engagementCode: "ENG-001",
                      client: {
                        clientCode: "C-001",
                        nameEn: "Client one",
                        nameZh: "",
                      },
                    }
              )
          ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.returnSubmission(
      admin as never,
      "approval-1",
      {
        expectedRevision: 1,
      }
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "approval-1" },
      data: expect.objectContaining({ status: "RETURNED", returnReason: null }),
    });
    expect(result.status).toBe("RETURNED");
  });

  it("notifies the employee with the return reason", async () => {
    const stored = {
      id: "approval-notify-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    };
    const prisma = {
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update: vi.fn().mockResolvedValue({
          ...stored,
          status: "RETURNED",
          returnReason: "请补充项目描述",
        }),
      },
      cmpEngagement: {
        findUnique: vi.fn().mockImplementation(({ select }) =>
          Promise.resolve(
            select?.picUserId
              ? { picUserId: admin.id, micUserId: "mic-1" }
              : {
                  engagementCode: "ENG-001",
                  client: {
                    clientCode: "C-001",
                    nameEn: "Client one",
                    nameZh: "客户一",
                  },
                }
          )
        ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
    };
    const inbox = { createCollaborationMessage: vi.fn() };
    const service = new TmsTimesheetsService(prisma as never, inbox as never);

    await service.returnSubmission(admin as never, stored.id, {
      expectedRevision: stored.revision,
      reason: "请补充项目描述",
    });

    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: member.id,
        senderId: admin.id,
        type: "SYSTEM_NOTIFICATION",
        body: expect.stringContaining("请补充项目描述"),
        contentKey: "TMS_TIMESHEET_RETURNED",
        contentParams: {
          year: 2026,
          month: 7,
          half: "FIRST_HALF",
          reason: "请补充项目描述",
        },
      })
    );
  });

  it("toggles an approved approval back to SUBMITTED", async () => {
    const stored = {
      id: "approval-approved-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 2,
      status: "APPROVED",
      submittedRows: [],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: admin.id,
      reviewedAt: new Date("2026-07-17T09:00:00.000Z"),
      returnReason: null,
    };
    const update = vi
      .fn()
      .mockResolvedValue({ ...stored, status: "SUBMITTED" });
    const prisma = {
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi
          .fn()
          .mockImplementation(
            ({ select }: { select?: { picUserId?: boolean } }) =>
              Promise.resolve(
                select?.picUserId
                  ? { picUserId: admin.id, micUserId: "mic-1" }
                  : {
                      engagementCode: "ENG-001",
                      client: {
                        clientCode: "C-001",
                        nameEn: "Client one",
                        nameZh: "客户一",
                      },
                    }
              )
          ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.approveSubmission(admin as never, stored.id, {
      expectedRevision: stored.revision,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: stored.id },
      data: expect.objectContaining({
        status: "SUBMITTED",
        reviewedById: null,
        reviewedAt: null,
      }),
    });
    expect(result.status).toBe("SUBMITTED");
  });

  it("restores an approved approval to PENDING_CONFIRMATION when requested", async () => {
    const stored = {
      id: "approval-approved-pending-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 2,
      status: "APPROVED",
      submittedRows: [],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: admin.id,
      reviewedAt: new Date("2026-07-17T09:00:00.000Z"),
      returnReason: null,
    };
    const update = vi.fn().mockResolvedValue({
      ...stored,
      status: "PENDING_CONFIRMATION",
      reviewedById: null,
      reviewedAt: null,
    });
    const monthUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi.fn().mockImplementation(({ select }) =>
          Promise.resolve(
            select?.picUserId
              ? { picUserId: admin.id, micUserId: "mic-1" }
              : {
                  engagementCode: "ENG-001",
                  client: {
                    clientCode: "C-001",
                    nameEn: "Project one",
                    nameZh: "客户一",
                  },
                }
          )
        ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({ id: "month-1" }),
        update: monthUpdate,
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.approveSubmission(admin as never, stored.id, {
      expectedRevision: stored.revision,
      restoreStatus: "PENDING_CONFIRMATION",
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: stored.id },
      data: expect.objectContaining({
        status: "PENDING_CONFIRMATION",
        reviewedById: null,
        reviewedAt: null,
        returnReason: null,
      }),
    });
    expect(monthUpdate).toHaveBeenCalledWith({
      where: { id: "month-1" },
      data: { firstStatus: "APPROVED" },
    });
    expect(result.status).toBe("PENDING_CONFIRMATION");
  });

  it("cancels a RETURNED approval back to SUBMITTED", async () => {
    const stored = {
      id: "approval-returned-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 2,
      status: "RETURNED",
      submittedRows: [],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: admin.id,
      reviewedAt: new Date("2026-07-17T09:00:00.000Z"),
      returnReason: "Fix it",
    };
    const update = vi.fn().mockResolvedValue({
      ...stored,
      status: "SUBMITTED",
      returnReason: null,
    });
    const prisma = {
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi
          .fn()
          .mockImplementation(
            ({ select }: { select?: { picUserId?: boolean } }) =>
              Promise.resolve(
                select?.picUserId
                  ? { picUserId: admin.id, micUserId: "mic-1" }
                  : {
                      engagementCode: "ENG-001",
                      client: {
                        clientCode: "C-001",
                        nameEn: "Client one",
                        nameZh: "客户一",
                      },
                    }
              )
          ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.returnSubmission(admin as never, stored.id, {
      expectedRevision: stored.revision,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: stored.id },
      data: expect.objectContaining({
        status: "SUBMITTED",
        reviewedById: null,
        reviewedAt: null,
        returnReason: null,
      }),
    });
    expect(result.status).toBe("SUBMITTED");
  });

  it("approves pending confirmation and only then synchronizes the employee month", async () => {
    const stored = {
      id: "approval-pending-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 2,
      status: "PENDING_CONFIRMATION",
      submittedRows: [],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    };
    const update = vi.fn().mockResolvedValue({ ...stored, status: "APPROVED" });
    const monthUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi
          .fn()
          .mockImplementation(
            ({ select }: { select?: { picUserId?: boolean } }) =>
              Promise.resolve(
                select?.picUserId
                  ? { picUserId: admin.id, micUserId: "mic-1" }
                  : {
                      engagementCode: "ENG-001",
                      client: {
                        clientCode: "C-001",
                        nameEn: "Client one",
                        nameZh: "客户一",
                      },
                    }
              )
          ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-1",
          draftRows: [],
          firstSubmittedRows: [],
        }),
        update: monthUpdate,
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.approveSubmission(admin as never, stored.id, {
      expectedRevision: stored.revision,
    });

    expect(result.status).toBe("APPROVED");
    expect(monthUpdate).toHaveBeenCalledOnce();
  });

  it("edits a submitted snapshot only with the latest revision", async () => {
    const row: TmsTimesheetRow = {
      id: "row-1",
      engagementId: "engagement-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Adjusted fieldwork",
      hoursByDate: { "2026-07-03": 7.5 },
      periodTotal: 7.5,
    };
    const stored = {
      id: "approval-edit-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [
        { ...row, hoursByDate: { "2026-07-03": 8 }, periodTotal: 8 },
      ],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    };
    const update = vi.fn().mockResolvedValue({
      ...stored,
      revision: 2,
      submittedRows: [row],
      submittedAt: new Date("2026-07-17T09:00:00.000Z"),
    });
    const prisma = {
      tmsApprovalSubmission: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(stored)
          .mockResolvedValueOnce({ ...stored, revision: 2 }),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi
          .fn()
          .mockImplementation(
            ({ select }: { select?: { picUserId?: boolean } }) =>
              Promise.resolve(
                select?.picUserId
                  ? { picUserId: admin.id, micUserId: "mic-1" }
                  : {
                      engagementCode: "ENG-001",
                      client: {
                        clientCode: "C-001",
                        nameEn: "Project one",
                        nameZh: "",
                      },
                    }
              )
          ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-1",
          draftRows: [
            { ...row, hoursByDate: { "2026-07-03": 8 }, periodTotal: 8 },
          ],
          firstSubmittedRows: [
            { ...row, hoursByDate: { "2026-07-03": 8 }, periodTotal: 8 },
          ],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new TmsTimesheetsService(prisma as never);
    const result = await service.editSubmission(
      admin as never,
      "approval-edit-1",
      {
        expectedRevision: 1,
        rows: [row],
      }
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "approval-edit-1" },
      data: expect.objectContaining({
        revision: 2,
        status: "PENDING_CONFIRMATION",
        submittedRows: [
          expect.objectContaining({
            ...row,
            approvalOriginalHoursByDate: { "2026-07-03": 8 },
          }),
        ],
        reviewedById: null,
        reviewedAt: null,
      }),
    });
    expect(result.revision).toBe(2);
    expect(prisma.tmsTimesheetMonth.update).not.toHaveBeenCalled();
    await expect(
      service.editSubmission(admin as never, "approval-edit-1", {
        expectedRevision: 1,
        rows: [row],
      })
    ).rejects.toBeInstanceOf(ApiConflictException);
  });

  it("allows an approval OT edit when an existing regular-hours excess is unchanged", async () => {
    const normalRow = (id: string): TmsTimesheetRow => ({
      id,
      engagementId: "engagement-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Fieldwork",
      hoursByDate: { "2026-07-06": 8 },
      periodTotal: 8,
    });
    const otRow: TmsTimesheetRow = {
      ...normalRow("row-ot"),
      details: "OT",
      description: "Overtime",
      hoursByDate: { "2026-07-01": 0 },
      periodTotal: 0,
    };
    const leaveRow: TmsTimesheetRow = {
      id: "row-leave",
      periodScope: "first",
      type: "Leave",
      details: "Leave",
      description: "Annual leave",
      hoursByDate: {},
      periodTotal: 0,
    };
    const currentRows = [
      normalRow("row-normal-1"),
      normalRow("row-normal-2"),
      otRow,
      leaveRow,
    ];
    const editedRows = currentRows.map((row) =>
      row.id === otRow.id
        ? {
            ...row,
            hoursByDate: { "2026-07-01": 2 },
            periodTotal: 2,
          }
        : row
    );
    const stored = {
      id: "approval-existing-excess-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: currentRows,
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    };
    const update = vi.fn().mockResolvedValue({
      ...stored,
      revision: 2,
      status: "PENDING_CONFIRMATION",
      submittedRows: editedRows,
    });
    const service = new TmsTimesheetsService({
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi.fn().mockImplementation(({ select }) =>
          Promise.resolve(
            select?.picUserId
              ? { picUserId: admin.id, micUserId: "mic-1" }
              : {
                  engagementCode: "ENG-001",
                  client: {
                    clientCode: "C-001",
                    nameEn: "Project one",
                    nameZh: "",
                  },
                }
          )
        ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
    } as never);

    const result = await service.editSubmission(admin as never, stored.id, {
      expectedRevision: stored.revision,
      rows: editedRows,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: stored.id },
      data: expect.objectContaining({
        revision: 2,
        status: "PENDING_CONFIRMATION",
        submittedRows: editedRows.map((row) =>
          row.type === "Chargeable"
            ? {
                ...row,
                approvalOriginalHoursByDate:
                  currentRows.find((current) => current.id === row.id)
                    ?.hoursByDate ?? {},
              }
            : row
        ),
      }),
    });
    expect(result.status).toBe("PENDING_CONFIRMATION");
  });

  it("allows an approver to add a missing OT row for the current engagement", async () => {
    const normalRow: TmsTimesheetRow = {
      id: "row-normal-only",
      engagementId: "engagement-1",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "Fieldwork",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    };
    const otRow: TmsTimesheetRow = {
      ...normalRow,
      id: "row-normal-only-approval-ot",
      workType: "OT",
      details: "OT",
      hoursByDate: { "2026-07-01": 2 },
      periodTotal: 2,
    };
    const stored = {
      id: "approval-add-ot",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 1,
      status: "SUBMITTED",
      submittedRows: [normalRow],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    } as const;
    const update = vi
      .fn()
      .mockImplementation(({ data }) =>
        Promise.resolve({ ...stored, ...data })
      );
    const service = new TmsTimesheetsService({
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi.fn().mockImplementation(({ select }) =>
          Promise.resolve(
            select?.picUserId
              ? { picUserId: admin.id, micUserId: "mic-1" }
              : {
                  engagementCode: "ENG-001",
                  client: {
                    clientCode: "C-001",
                    nameEn: "Project one",
                    nameZh: "",
                  },
                }
          )
        ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
    } as never);

    await service.editSubmission(admin as never, stored.id, {
      expectedRevision: 1,
      rows: [normalRow, otRow],
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: stored.id },
      data: expect.objectContaining({
        status: "PENDING_CONFIRMATION",
        submittedRows: expect.arrayContaining([
          expect.objectContaining({
            id: otRow.id,
            approvalOriginalHoursByDate: {},
          }),
        ]),
      }),
    });
  });

  it("exposes modified approved cells separately from unchanged approved cells", async () => {
    const row: TmsTimesheetRow = {
      id: "row-approved-provenance",
      engagementId: "engagement-1",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "Fieldwork",
      hoursByDate: { "2026-07-01": 8, "2026-07-02": 6 },
      periodTotal: 14,
      approvalOriginalHoursByDate: { "2026-07-01": 8, "2026-07-02": 8 },
    };
    const approvalRecord = {
      id: "approval-provenance",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 2,
      status: "APPROVED",
      submittedRows: [row],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: admin.id,
      reviewedAt: new Date("2026-07-17T09:00:00.000Z"),
      returnReason: null,
    } as const;
    const service = new TmsTimesheetsService({
      tmsTimesheetMonth: { findUnique: vi.fn().mockResolvedValue(null) },
      tmsApprovalSubmission: {
        findMany: vi.fn().mockResolvedValue([approvalRecord]),
      },
    } as never);

    const result = await service.getMonth(member as never, 2026, 7);

    expect(result.approvalLocks).toContainEqual(
      expect.objectContaining({
        lockedCells: [
          { rowId: row.id, date: "2026-07-01" },
          { rowId: row.id, date: "2026-07-02" },
        ],
        modifiedCells: [{ rowId: row.id, date: "2026-07-02" }],
      })
    );
  });

  it("syncs an approver-added OT row into the employee month on approval", async () => {
    const normalRow: TmsTimesheetRow = {
      id: "row-sync-normal",
      engagementId: "engagement-1",
      periodScope: "first",
      type: "Chargeable",
      workType: "Normal",
      details: "Normal",
      description: "Fieldwork",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
      approvalOriginalHoursByDate: { "2026-07-01": 8 },
    };
    const otRow: TmsTimesheetRow = {
      ...normalRow,
      id: "row-sync-normal-approval-ot",
      workType: "OT",
      details: "OT",
      hoursByDate: { "2026-07-01": 2 },
      periodTotal: 2,
      approvalOriginalHoursByDate: {},
    };
    const stored = {
      id: "approval-sync-added-ot",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 2,
      status: "PENDING_CONFIRMATION",
      submittedRows: [normalRow, otRow],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    } as const;
    const monthUpdate = vi.fn().mockResolvedValue({});
    const service = new TmsTimesheetsService({
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update: vi.fn().mockResolvedValue({ ...stored, status: "APPROVED" }),
      },
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue({
          id: "month-sync-added-ot",
          draftRows: [normalRow],
          firstSubmittedRows: [normalRow],
        }),
        update: monthUpdate,
      },
      cmpEngagement: {
        findUnique: vi.fn().mockImplementation(({ select }) =>
          Promise.resolve(
            select?.picUserId
              ? { picUserId: admin.id, micUserId: "mic-1" }
              : {
                  engagementCode: "ENG-001",
                  client: {
                    clientCode: "C-001",
                    nameEn: "Project one",
                    nameZh: "",
                  },
                }
          )
        ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
    } as never);

    await service.approveSubmission(admin as never, stored.id, {
      expectedRevision: stored.revision,
    });

    expect(monthUpdate).toHaveBeenCalledWith({
      where: { id: "month-sync-added-ot" },
      data: expect.objectContaining({
        firstStatus: "APPROVED",
        draftRows: expect.arrayContaining([
          expect.objectContaining({
            id: otRow.id,
            hoursByDate: { "2026-07-01": 2 },
          }),
        ]),
        firstSubmittedRows: expect.arrayContaining([
          expect.objectContaining({
            id: otRow.id,
            hoursByDate: { "2026-07-01": 2 },
          }),
        ]),
      }),
    });
  });

  it("keeps the current approval status when an edit does not change hours", async () => {
    const row: TmsTimesheetRow = {
      id: "row-no-op",
      engagementId: "engagement-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Fieldwork",
      hoursByDate: { "2026-07-03": 7.5 },
      periodTotal: 7.5,
    };
    const stored = {
      id: "approval-no-op-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 4,
      status: "SUBMITTED",
      submittedRows: [row],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    } as const;
    const update = vi.fn().mockResolvedValue({
      ...stored,
      revision: stored.revision + 1,
    });
    const service = new TmsTimesheetsService({
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi.fn().mockImplementation(({ select }) =>
          Promise.resolve(
            select?.picUserId
              ? { picUserId: admin.id, micUserId: "mic-1" }
              : {
                  engagementCode: "ENG-001",
                  client: {
                    clientCode: "C-001",
                    nameEn: "Project one",
                    nameZh: "",
                  },
                }
          )
        ),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ name: member.name, email: member.email }),
      },
    } as never);
    const result = await service.editSubmission(admin as never, stored.id, {
      expectedRevision: stored.revision,
      rows: [{ ...row, description: "Blurred without a hours edit" }],
    });

    expect(result).toMatchObject({
      status: "SUBMITTED",
      revision: stored.revision,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects approval edits outside the current project or half", async () => {
    const row: TmsTimesheetRow = {
      id: "row-validated",
      engagementId: "engagement-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Fieldwork",
      hoursByDate: { "2026-07-03": 7.5 },
      periodTotal: 7.5,
    };
    const stored = {
      id: "approval-validated-1",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF" as const,
      revision: 1,
      status: "SUBMITTED" as const,
      submittedRows: [row],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: null,
      reviewedAt: null,
      returnReason: null,
    };
    const update = vi.fn();
    const service = new TmsTimesheetsService({
      tmsApprovalSubmission: {
        findUnique: vi.fn().mockResolvedValue(stored),
        findFirst: vi.fn().mockResolvedValue(stored),
        update,
      },
      cmpEngagement: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ picUserId: admin.id, micUserId: "mic-1" }),
      },
    } as never);

    await expect(
      service.editSubmission(admin as never, stored.id, {
        expectedRevision: 1,
        rows: [{ ...row, engagementId: "engagement-2" }],
      })
    ).rejects.toBeInstanceOf(ApiConflictException);
    await expect(
      service.editSubmission(admin as never, stored.id, {
        expectedRevision: 1,
        rows: [{ ...row, hoursByDate: { "2026-07-16": 2 } }],
      })
    ).rejects.toBeInstanceOf(ApiConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it("exposes returned cells and the return reason in the employee month", async () => {
    const row: TmsTimesheetRow = {
      id: "row-returned",
      engagementId: "engagement-1",
      periodScope: "first",
      type: "Chargeable",
      details: "Normal",
      description: "Fieldwork",
      hoursByDate: { "2026-07-03": 7.5 },
      periodTotal: 7.5,
    };
    const approvalRecord = {
      id: "approval-returned-cells",
      ownerUserId: member.id,
      engagementId: "engagement-1",
      year: 2026,
      month: 7,
      half: "FIRST_HALF",
      revision: 2,
      status: "RETURNED",
      submittedRows: [row],
      submittedAt: new Date("2026-07-16T09:00:00.000Z"),
      reviewedById: admin.id,
      reviewedAt: new Date("2026-07-17T09:00:00.000Z"),
      returnReason: "Please correct the hours.",
    } as const;
    const service = new TmsTimesheetsService({
      tmsTimesheetMonth: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      tmsApprovalSubmission: {
        findMany: vi.fn().mockResolvedValue([approvalRecord]),
      },
    } as never);
    const result = await service.getMonth(member as never, 2026, 7);

    expect(result.periods.FIRST_HALF.approvalStatus).toBe("RETURNED");
    expect(result.approvalLocks).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          engagementId: "engagement-1",
          half: "FIRST_HALF",
          status: "RETURNED",
          returnedCells: [{ rowId: "row-returned", date: "2026-07-03" }],
          returnReason: "Please correct the hours.",
        }),
      ])
    );
  });
});
