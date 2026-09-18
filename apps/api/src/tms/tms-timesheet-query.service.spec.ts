import { TmsTimesheetRowSchema } from "@project-wing/shared";

import { TmsTimesheetQueryService } from "./tms-timesheet-query.service";

const prisma = {
  cmpEngagement: { findMany: vi.fn() },
  tmsApprovalSubmission: { findMany: vi.fn() },
  tmsTimesheetMonth: { findMany: vi.fn() },
};

describe(TmsTimesheetQueryService, () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds chargeable detail rows from live draft data", async () => {
    prisma.tmsTimesheetMonth.findMany.mockResolvedValue([
      {
        userId: "staff-1",
        year: 2026,
        month: 7,
        draftRows: [
          {
            id: "row-1",
            engagementId: "eng-1",
            type: "Chargeable",
            details: "Normal",
            periodScope: "all",
            description: "",
            hoursByDate: { "2026-07-01": 8 },
            periodTotal: 8,
          },
          {
            id: "row-2",
            engagementId: "eng-1",
            type: "Chargeable",
            details: "OT",
            periodScope: "all",
            description: "",
            hoursByDate: { "2026-07-01": 2 },
            periodTotal: 2,
          },
        ],
        user: {
          id: "staff-1",
          name: "Hugo Lam",
          staffNo: "A4050",
          hourlyRate: "1800.00",
          status: "ACTIVE",
          authSessions: [{ id: "session-1" }],
        },
      },
    ]);
    prisma.tmsApprovalSubmission.findMany.mockResolvedValue([]);
    prisma.cmpEngagement.findMany.mockResolvedValue([
      {
        id: "eng-1",
        engagementCode: "JOB-001",
        agreedFee: "480000.00",
        picUser: { name: "Billy Lau" },
        micUser: { name: "John Tu" },
        client: { nameEn: "Dragon Huge Asia Pacific Limited" },
      },
    ]);
    const service = new TmsTimesheetQueryService(prisma as never);
    const result = await service.query(
      { id: "manager-1", globalRole: "MANAGER" } as never,
      {
        mode: "DETAIL",
        sortBy: "JOB_CODE",
        sortDirection: "asc",
        page: 1,
        pageSize: 50,
      }
    );

    expect(result.rows).toStrictEqual([
      expect.objectContaining({
        jobCode: "JOB-001",
        staffNo: "A4050",
        normal: 8,
        ot: 2,
        total: "18000.00",
        activeStatus: "ACTIVE",
      }),
    ]);
  });

  it("matches text filters without depending on internal spaces", async () => {
    prisma.tmsTimesheetMonth.findMany.mockResolvedValue([
      {
        userId: "staff-1",
        year: 2026,
        month: 7,
        draftRows: [
          {
            id: "row-1",
            engagementId: "eng-1",
            type: "Chargeable",
            details: "Normal",
            periodScope: "all",
            description: "",
            hoursByDate: { "2026-07-01": 8 },
            periodTotal: 8,
          },
        ],
        user: {
          id: "staff-1",
          name: "Hugo Lam",
          staffNo: "A4050",
          hourlyRate: "1800.00",
          status: "ACTIVE",
          authSessions: [{ id: "session-1" }],
        },
      },
    ]);
    prisma.tmsApprovalSubmission.findMany.mockResolvedValue([]);
    prisma.cmpEngagement.findMany.mockResolvedValue([
      {
        id: "eng-1",
        engagementCode: "JOB-001",
        agreedFee: "480000.00",
        picUser: { name: "Billy Lau" },
        micUser: { name: "Leo Li" },
        client: { nameEn: "Dragon Huge Asia Pacific Limited" },
      },
    ]);
    const service = new TmsTimesheetQueryService(prisma as never);
    const result = await service.query(
      { id: "manager-1", globalRole: "MANAGER" } as never,
      {
        mode: "DETAIL",
        mic: "LeoLi",
        sortBy: "JOB_CODE",
        sortDirection: "asc",
        page: 1,
        pageSize: 50,
      }
    );

    expect(result.total).toBe(1);
    expect(result.rows[0]).toStrictEqual(
      expect.objectContaining({ mic: "Leo Li" })
    );
  });

  it("uses workType before legacy details when building detail rows", async () => {
    prisma.tmsTimesheetMonth.findMany.mockResolvedValue([
      {
        userId: "staff-1",
        year: 2026,
        month: 7,
        draftRows: [
          {
            id: "row-1",
            engagementId: "eng-1",
            type: "Chargeable",
            workType: "Absent",
            details: "Normal",
            periodScope: "all",
            description: "",
            hoursByDate: { "2026-07-01": 8 },
            periodTotal: 8,
          },
        ],
        user: {
          id: "staff-1",
          name: "Hugo Lam",
          staffNo: "A4050",
          hourlyRate: "1800.00",
          status: "ACTIVE",
          authSessions: [{ id: "session-1" }],
        },
      },
    ]);
    prisma.tmsApprovalSubmission.findMany.mockResolvedValue([]);
    prisma.cmpEngagement.findMany.mockResolvedValue([
      {
        id: "eng-1",
        engagementCode: "JOB-001",
        agreedFee: "480000.00",
        picUser: { name: "Billy Lau" },
        micUser: { name: "John Tu" },
        client: { nameEn: "Dragon Huge Asia Pacific Limited" },
      },
    ]);
    const service = new TmsTimesheetQueryService(prisma as never);
    const result = await service.query(
      { id: "manager-1", globalRole: "MANAGER" } as never,
      {
        mode: "DETAIL",
        sortBy: "JOB_CODE",
        sortDirection: "asc",
        page: 1,
        pageSize: 50,
      }
    );

    expect(result.rows).toStrictEqual([
      expect.objectContaining({
        normal: 0,
        ot: 0,
        absent: 8,
        total: "0.00",
      }),
    ]);
  });

  it("constrains workType by row category while accepting legacy rows", () => {
    const baseRow = {
      id: "row-1",
      periodScope: "all",
      details: "Marketing",
      description: "",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
    };

    expect(
      TmsTimesheetRowSchema.safeParse({
        ...baseRow,
        type: "Chargeable",
        workType: "Absent",
      }).success
    ).toBeTruthy();
    expect(
      TmsTimesheetRowSchema.safeParse({
        ...baseRow,
        type: "Non-Chargeable",
        workType: "OT",
      }).success
    ).toBeTruthy();
    expect(
      TmsTimesheetRowSchema.safeParse({
        ...baseRow,
        type: "Leave",
        workType: "Normal",
      }).success
    ).toBeTruthy();
    expect(
      TmsTimesheetRowSchema.safeParse({
        ...baseRow,
        type: "Non-Chargeable",
        workType: "Absent",
      }).success
    ).toBeFalsy();
    expect(
      TmsTimesheetRowSchema.safeParse({
        ...baseRow,
        type: "Leave",
        workType: "OT",
      }).success
    ).toBeFalsy();
    expect(
      TmsTimesheetRowSchema.safeParse({
        ...baseRow,
        type: "Leave",
      }).success
    ).toBeTruthy();
  });

  it("rejects roles outside Manager and Partner", async () => {
    const service = new TmsTimesheetQueryService(prisma as never);
    await expect(
      service.query({ id: "admin-1", globalRole: "SUPER_ADMIN" } as never, {
        mode: "DETAIL",
        sortBy: "JOB_CODE",
        sortDirection: "asc",
        page: 1,
        pageSize: 50,
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });
});
