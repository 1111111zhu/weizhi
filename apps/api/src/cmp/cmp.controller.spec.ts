import type { INestApplication } from "@nestjs/common";
import "reflect-metadata";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AuthGuard } from "../auth/auth.guard";
import { BETTER_AUTH_SESSION_READER } from "../auth/better-auth-session-reader";
import { SKIP_DECLARATION_GATE_KEY } from "../auth/declaration-gate.decorator";
import {
  ApiBadRequestException,
  ApiForbiddenException,
} from "../common/api-error";
import { InboxService } from "../inbox/inbox.service";
import { PrismaService } from "../prisma/prisma.service";
import { CmpController } from "./cmp.controller";
import { CmpService } from "./cmp.service";
import { CmpEntityGraphController } from "./entity-graph/cmp-entity-graph.controller";
import { CmpEntityGraphService } from "./entity-graph/cmp-entity-graph.service";

describe(CmpController, () => {
  const cmp = {
    dashboard: vi.fn(),
    listClientGroups: vi.fn(),
    getClientGroupStructure: vi.fn(),
    createClientGroup: vi.fn(),
    updateClientGroup: vi.fn(),
    listUsers: vi.fn(),
    listClients: vi.fn(),
    listClientVersions: vi.fn(),
    getClientVersion: vi.fn(),
    compareClientVersionToCurrent: vi.fn(),
    exportClientVersionPdf: vi.fn(),
    createClient: vi.fn(),
    getClient: vi.fn(),
    getClientPreview: vi.fn(),
    exportClientPreviewPdf: vi.fn(),
    updateClient: vi.fn(),
    listEngagements: vi.fn(),
    listTmsEngagements: vi.fn(),
    getTmsEngagementSummary: vi.fn(),
    createEngagement: vi.fn(),
    getEngagement: vi.fn(),
    getEngagementPreview: vi.fn(),
    exportEngagementPreviewPdf: vi.fn(),
    exportEngagementBudgetWorkbook: vi.fn(),
    getEngagementFeeNote: vi.fn(),
    updateEngagementFeeNote: vi.fn(),
    exportEngagementFeeNote: vi.fn(),
    updateEngagement: vi.fn(),
    assignAcceptanceDraft: vi.fn(),
    recallAcceptanceDraft: vi.fn(),
    completeAcceptanceDraft: vi.fn(),
    listMasterDrafts: vi.fn(),
    getAcceptanceChanges: vi.fn(),
    createAcceptance: vi.fn(),
  };
  const inbox = {
    list: vi.fn(),
    markRead: vi.fn(),
    markUnread: vi.fn(),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    cmp.dashboard.mockResolvedValue({
      draftsAssignedToMe: 0,
      approvalsAssignedToMe: 0,
      returnedRequests: 0,
      myClients: 0,
      myEngagements: 0,
      recentChanges: [],
      recentApprovals: [],
    });
  });

  it("returns CMP health without user context", () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );

    expect(controller.getHealth()).toStrictEqual({ ok: true, service: "cmp" });
  });

  it("returns the empty CMP dashboard summary", async () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );

    await expect(
      controller.getDashboard({
        id: "user-1",
        email: "it@example.com",
        name: "IT Admin",
        globalRole: "SUPER_ADMIN",
      }),
    ).resolves.toStrictEqual({
      draftsAssignedToMe: 0,
      approvalsAssignedToMe: 0,
      returnedRequests: 0,
      myClients: 0,
      myEngagements: 0,
      recentChanges: [],
      recentApprovals: [],
    });
  });

  it("validates and forwards the scoped master draft query", async () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );
    const user = {
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF" as const,
    };
    cmp.listMasterDrafts.mockResolvedValue({ drafts: [] });

    await expect(
      controller.listAcceptanceDrafts({ type: "ENGAGEMENT" }, user),
    ).resolves.toStrictEqual({ drafts: [] });
    expect(cmp.listMasterDrafts).toHaveBeenCalledWith("ENGAGEMENT", user);
    expect(() =>
      controller.listAcceptanceDrafts({ type: "CLIENT_CHANGE" }, user),
    ).toThrow(ApiBadRequestException);
  });

  it("uses the requested locale for authenticated record previews and exports", async () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );
    const response = {
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    cmp.getClientPreview.mockResolvedValue({ recordId: "client-1" });
    cmp.exportEngagementPreviewPdf.mockResolvedValue({
      fileName: "E001-engagement-profile.pdf",
      body: Buffer.from("pdf"),
    });

    await expect(
      controller.getClientPreview("client-1", { locale: "zh-CN" }),
    ).resolves.toStrictEqual({ recordId: "client-1" });
    await controller.exportEngagementPreviewPdf(
      "engagement-1",
      { locale: "en-US" },
      response as never,
    );

    expect(cmp.getClientPreview).toHaveBeenCalledWith("client-1", "zh-CN");
    expect(cmp.exportEngagementPreviewPdf).toHaveBeenCalledWith(
      "engagement-1",
      "en-US",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      "attachment; filename=\"E001-engagement-profile.pdf\"; filename*=UTF-8''E001-engagement-profile.pdf",
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from("pdf"));
  });

  it("keeps legacy Fee Note reads authorized and rejects retired writes", async () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );
    const user = {
      id: "user-1",
      email: "partner@example.com",
      name: "Partner",
      globalRole: "PARTNER" as const,
    };
    const input = {
      feeNoteNumber: "28505",
      recipientAttention: "Director",
      currency: "HKD" as const,
      amount: "12000.00",
      disbursementAmount: "0.00",
      totalAmount: "12000.00",
      lineItems: [
        {
          id: "final-service-fee",
          description: "Final service fee",
          amount: "12000.00",
        },
      ],
    };
    const saved = { note: { id: "fee-note-1", ...input }, defaults: input };
    cmp.getEngagementFeeNote.mockResolvedValue(saved);

    await expect(
      controller.getEngagementFeeNote("engagement-1", user),
    ).resolves.toBe(saved);
    expect(() =>
      controller.updateEngagementFeeNote("engagement-1", input, user, "WEB" as never),
    ).toThrow(ApiBadRequestException);

    expect(cmp.getEngagementFeeNote).toHaveBeenCalledWith("engagement-1", user);
    expect(cmp.updateEngagementFeeNote).not.toHaveBeenCalled();
  });

  it("rejects retired or unknown Engagement fee note fields", () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );

    expect(() =>
      controller.updateEngagementFeeNote(
        "engagement-1",
        { retiredField: "value" },
        {
          id: "user-1",
          email: "partner@example.com",
          name: "Partner",
          globalRole: "PARTNER",
        },
        "WEB" as never,
      ),
    ).toThrow(ApiBadRequestException);
    expect(cmp.updateEngagementFeeNote).not.toHaveBeenCalled();
  });

  it("exports authenticated Fee Notes as PDF and Word for the requested language", async () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );
    const response = { setHeader: vi.fn(), send: vi.fn() };
    const user = {
      id: "user-1",
      email: "partner@example.com",
      name: "Partner",
      globalRole: "PARTNER" as const,
    };
    cmp.exportEngagementFeeNote.mockResolvedValue({
      fileName: "28505-fee-note-zh-CN.pdf",
      body: Buffer.from("pdf"),
    });

    await controller.exportEngagementFeeNotePdf(
      "engagement-1",
      { locale: "zh-CN" },
      user,
      response as never,
    );
    expect(cmp.exportEngagementFeeNote).toHaveBeenCalledWith(
      "engagement-1",
      "zh-CN",
      "pdf",
      user,
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/pdf",
    );

    cmp.exportEngagementFeeNote.mockResolvedValue({
      fileName: "28505-fee-note-en-US.docx",
      body: Buffer.from("docx"),
    });
    await controller.exportEngagementFeeNoteDocx(
      "engagement-1",
      { locale: "en-US" },
      user,
      response as never,
    );
    expect(cmp.exportEngagementFeeNote).toHaveBeenLastCalledWith(
      "engagement-1",
      "en-US",
      "docx",
      user,
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    await expect(
      controller.exportEngagementFeeNotePdf(
        "engagement-1",
        { locale: "invalid" },
        user,
        response as never,
      ),
    ).rejects.toThrow(ApiBadRequestException);
  });

  it("exports Engagement budget workbooks with the requested locale", async () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );
    const response = {
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    cmp.exportEngagementBudgetWorkbook.mockResolvedValue({
      fileName: "E001-budget.xlsx",
      body: Buffer.from("xlsx"),
    });

    await controller.exportEngagementBudgetWorkbook(
      "engagement-1",
      { locale: "zh-CN" },
      response as never,
    );

    expect(cmp.exportEngagementBudgetWorkbook).toHaveBeenCalledWith(
      "engagement-1",
      "zh-CN",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      "attachment; filename=\"E001-budget.xlsx\"; filename*=UTF-8''E001-budget.xlsx",
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from("xlsx"));
  });

  it("marks dashboard as exempt from the EMP declaration gate", () => {
    const metadata = Reflect.getMetadata(
      SKIP_DECLARATION_GATE_KEY,
      CmpController.prototype.getDashboard,
    );

    expect(metadata).toBeTruthy();
  });

  it("returns an explicit validation error for retired Client fields", () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );

    expect(() =>
      controller.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: { prcOperationStatus: "Yes" },
        },
        {
          id: "user-1",
          email: "manager@example.com",
          name: "Manager",
          globalRole: "MANAGER",
        },
        {},
      ),
    ).toThrow(
      new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Retired CMP Client fields are no longer supported: prcOperationStatus",
      ),
    );
    expect(cmp.createAcceptance).not.toHaveBeenCalled();
  });

  it("rejects direct formal Engagement deliverable updates", () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );

    expect(() =>
      controller.updateEngagement(
        "engagement-1",
        { deliverables: [] },
        {
          id: "user-1",
          email: "manager@example.com",
          name: "Manager",
          globalRole: "MANAGER",
        },
        {},
      ),
    ).toThrow(
      new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Reports and deliverables can only be changed through Engagement Acceptance",
      ),
    );
    expect(cmp.updateEngagement).not.toHaveBeenCalled();
    expect(() =>
      controller.createEngagement(
        {
          clientId: "client-1",
          engagementCode: "C001-2026-AUD",
          serviceType: "ANNUAL_AUDIT",
          budgetedHours: "1",
          agreedFee: "0",
          picUserId: "pic-1",
          micUserId: "mic-1",
          deliverables: [],
        },
        {
          id: "user-1",
          email: "manager@example.com",
          name: "Manager",
          globalRole: "MANAGER",
        },
        {},
      ),
    ).toThrow(
      new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Reports and deliverables can only be changed through Engagement Acceptance",
      ),
    );
    expect(cmp.createEngagement).not.toHaveBeenCalled();
  });

  it("accepts the legacy Engagement approvalDate input but forwards only engagementDate", async () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );
    const user = {
      id: "user-1",
      email: "manager@example.com",
      name: "Manager",
      globalRole: "MANAGER" as const,
    };
    cmp.createEngagement.mockResolvedValue({ id: "engagement-1" });
    await controller.createEngagement(
      {
        clientId: "client-1",
        engagementCode: "C001-2026-AUD",
        serviceType: "ANNUAL_AUDIT",
        budgetedHours: "1",
        agreedFee: "0",
        picUserId: "pic-1",
        micUserId: "mic-1",
        approvalDate: "2026-08-24",
      },
      user,
      {} as never,
    );
    expect(cmp.createEngagement).toHaveBeenCalledWith(
      expect.objectContaining({ engagementDate: "2026-08-24" }),
      user,
      expect.anything(),
    );
    expect(cmp.createEngagement.mock.calls[0]?.[0]).not.toHaveProperty(
      "approvalDate",
    );
    expect(() =>
      controller.createEngagement(
        {
          clientId: "client-1",
          engagementCode: "C001-2026-AUD",
          serviceType: "ANNUAL_AUDIT",
          budgetedHours: "1",
          agreedFee: "0",
          picUserId: "pic-1",
          micUserId: "mic-1",
          approvalDate: "2026-08-24",
          engagementDate: "2026-08-25",
        },
        user,
        {} as never,
      ),
    ).toThrow(ApiBadRequestException);
  });

  it("passes Client version list filters through the validated endpoint", async () => {
    const controller = new CmpController(
      cmp as unknown as CmpService,
      inbox as unknown as InboxService,
    );
    cmp.listClientVersions.mockResolvedValue({ versions: [], total: 0 });

    await expect(
      controller.listClientVersions("client-1", {
        requestNo: "CC-001",
        page: "2",
      }),
    ).resolves.toStrictEqual({ versions: [], total: 0 });

    expect(cmp.listClientVersions).toHaveBeenCalledWith("client-1", {
      requestNo: "CC-001",
      page: 2,
      pageSize: 25,
    });
  });
});

describe("cmpController routes", () => {
  let app: INestApplication;
  const auth = { getSession: vi.fn() };
  const cmp = {
    dashboard: vi.fn(),
    listClientGroups: vi.fn(),
    getClientGroupStructure: vi.fn(),
    createClientGroup: vi.fn(),
    updateClientGroup: vi.fn(),
    listUsers: vi.fn(),
    listClients: vi.fn(),
    listClientVersions: vi.fn(),
    getClientVersion: vi.fn(),
    compareClientVersionToCurrent: vi.fn(),
    exportClientVersionPdf: vi.fn(),
    createClient: vi.fn(),
    getClient: vi.fn(),
    getClientPreview: vi.fn(),
    exportClientPreviewPdf: vi.fn(),
    updateClient: vi.fn(),
    listEngagements: vi.fn(),
    listTmsEngagements: vi.fn(),
    getTmsEngagementSummary: vi.fn(),
    createEngagement: vi.fn(),
    getEngagement: vi.fn(),
    updateEngagement: vi.fn(),
    assignAcceptanceDraft: vi.fn(),
    recallAcceptanceDraft: vi.fn(),
    completeAcceptanceDraft: vi.fn(),
    getAcceptanceChanges: vi.fn(),
  };
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
  };
  const inbox = {
    list: vi.fn(),
    markRead: vi.fn(),
    markUnread: vi.fn(),
  };
  const entityGraph = {
    findCompanyIdentityMatch: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CmpController, CmpEntityGraphController],
      providers: [
        AuthGuard,
        Reflector,
        { provide: BETTER_AUTH_SESSION_READER, useValue: auth },
        { provide: PrismaService, useValue: prisma },
        { provide: CmpService, useValue: cmp },
        { provide: InboxService, useValue: inbox },
        { provide: CmpEntityGraphService, useValue: entityGraph },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue(null);
    cmp.dashboard.mockResolvedValue({
      draftsAssignedToMe: 0,
      approvalsAssignedToMe: 0,
      returnedRequests: 0,
      myClients: 0,
      myEngagements: 0,
      recentChanges: [],
      recentApprovals: [],
    });
    cmp.listClientGroups.mockResolvedValue({ groups: [] });
    cmp.getClientGroupStructure.mockResolvedValue({
      group: { id: "group-1" },
      ultimateParent: null,
      subsidiaryTree: [],
      associates: [],
      jointVentures: [],
      relationshipHistory: [],
      warnings: [],
    });
    cmp.listUsers.mockResolvedValue([]);
    cmp.listClients.mockResolvedValue({ clients: [] });
    cmp.listEngagements.mockResolvedValue({ engagements: [] });
    cmp.listTmsEngagements.mockResolvedValue({ engagements: [] });
    cmp.getTmsEngagementSummary.mockResolvedValue({
      approved: {
        rows: [],
        total: {
          userId: "total",
          name: "Total",
          budgetNormal: null,
          budgetOt: null,
          finalNormal: null,
          finalOt: null,
          absent: null,
          rate: null,
          budgetCost: null,
          actualCost: null,
          diff: null,
        },
      },
      draft: {
        rows: [],
        total: {
          userId: "total",
          name: "Total",
          budgetNormal: null,
          budgetOt: null,
          finalNormal: null,
          finalOt: null,
          absent: null,
          rate: null,
          budgetCost: null,
          actualCost: null,
          diff: null,
        },
      },
    });
    inbox.list.mockResolvedValue([]);
    inbox.markRead.mockResolvedValue({
      id: "message-1",
      readAt: new Date("2026-07-09T00:00:00.000Z"),
    });
    inbox.markUnread.mockResolvedValue({
      id: "message-1",
      readAt: null,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves CMP health without authentication", async () => {
    await request(app.getHttpServer())
      .get("/cmp/health")
      .expect(200)
      .expect({ ok: true, service: "cmp" });
    expect(app).toBeDefined();
  });

  it("routes company identity matching without treating the action as a client id", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });
    entityGraph.findCompanyIdentityMatch.mockResolvedValue({ match: null });

    await request(app.getHttpServer())
      .get(
        "/cmp/clients/identity/company-match?identifierType=COMPANY_REGISTRATION_NUMBER&identifierValue=7654321",
      )
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect({ match: null });

    expect(entityGraph.findCompanyIdentityMatch).toHaveBeenCalledWith({
      identifierType: "COMPANY_REGISTRATION_NUMBER",
      identifierValue: "7654321",
    });
    expect(cmp.getClient).not.toHaveBeenCalledWith("identity");
  });

  it("returns 404 for retired MOF detail endpoints", async () => {
    await request(app.getHttpServer())
      .get("/cmp/clients/client-1/mof-shareholding")
      .expect(404);
    await request(app.getHttpServer())
      .get("/cmp/clients/client-1/prc-establishments")
      .expect(404);
    expect(app).toBeDefined();
  });

  it("rejects unauthenticated dashboard requests", async () => {
    await request(app.getHttpServer()).get("/cmp/dashboard").expect(401);
    expect(app).toBeDefined();
  });

  it("serves CMP dashboard for authenticated IT users without system declaration", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "it@example.com",
      name: "IT Admin",
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });

    await request(app.getHttpServer())
      .get("/cmp/dashboard")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect({
        draftsAssignedToMe: 0,
        approvalsAssignedToMe: 0,
        returnedRequests: 0,
        myClients: 0,
        myEngagements: 0,
        recentChanges: [],
        recentApprovals: [],
      });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        status: true,
      },
    });
  });

  it("rejects authenticated non-IT users from the dashboard route", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });
    cmp.dashboard.mockRejectedValueOnce(
      new ApiForbiddenException(
        "FORBIDDEN",
        "CMP Dashboard is available to IT administrators only",
      ),
    );

    await request(app.getHttpServer())
      .get("/cmp/dashboard")
      .set("Authorization", "Bearer token")
      .expect(403);
    expect(auth.getSession).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated client master requests", async () => {
    await request(app.getHttpServer()).get("/cmp/clients").expect(401);
    await request(app.getHttpServer()).get("/cmp/client-groups").expect(401);
    await request(app.getHttpServer())
      .get("/cmp/engagements/engagement-1/tms-summary")
      .expect(401);
    expect(app).toBeDefined();
  });

  it("serves client master lists for authenticated users", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });

    await request(app.getHttpServer())
      .get("/cmp/client-groups")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect({ groups: [] });
    await request(app.getHttpServer())
      .get("/cmp/client-groups/group-1/structure")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect({
        group: { id: "group-1" },
        ultimateParent: null,
        subsidiaryTree: [],
        associates: [],
        jointVentures: [],
        relationshipHistory: [],
        warnings: [],
      });
    await request(app.getHttpServer())
      .get("/cmp/clients")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect({ clients: [] });
    expect(auth.getSession.mock.calls.length).toBeGreaterThan(0);
  });

  it("serves authenticated client preview documents through the HTTP route", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });
    cmp.getClientPreview.mockResolvedValue({
      kind: "CLIENT",
      recordId: "client-1",
      code: "C-001",
      title: "Client One",
      status: "Active",
      updatedAt: "2026-08-15T00:00:00.000Z",
      sections: [],
    });

    await request(app.getHttpServer())
      .get("/cmp/clients/client-1/preview?locale=zh-CN")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect((response) => {
        expect(response.body.recordId).toBe("client-1");
      });

    expect(cmp.getClientPreview).toHaveBeenCalledWith("client-1", "zh-CN");
  });

  it("serves engagement master lists for authenticated users", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });

    await request(app.getHttpServer())
      .get("/cmp/engagements")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect({ engagements: [] });

    await request(app.getHttpServer())
      .get("/cmp/engagements/engagement-1/tms-summary")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect((response) => {
        expect(response.body.approved.total.name).toBe("Total");
      });

    expect(cmp.getTmsEngagementSummary).toHaveBeenCalledWith("engagement-1");
  });

  it("routes delegated acceptance draft actions for authenticated users", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "manager@example.com",
      name: "Manager",
      globalRole: "MANAGER",
      status: "ACTIVE",
    });
    cmp.assignAcceptanceDraft.mockResolvedValue({ id: "request-1" });

    await request(app.getHttpServer())
      .post("/cmp/acceptance/request-1/assign-draft")
      .set("Authorization", "Bearer token")
      .send({ assigneeId: "staff-1" })
      .expect(201)
      .expect({ id: "request-1" });

    expect(cmp.assignAcceptanceDraft).toHaveBeenCalledWith(
      "request-1",
      { assigneeId: "staff-1" },
      expect.objectContaining({ id: "user-1" }),
      expect.anything(),
    );
  });

  it("serves an authorized Acceptance change comparison", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "manager@example.com",
      name: "Manager",
      globalRole: "MANAGER",
      status: "ACTIVE",
    });
    cmp.getAcceptanceChanges.mockResolvedValue({
      status: "AVAILABLE",
      changedFieldCount: 0,
      baselineCapturedAt: "2026-07-20T00:00:00.000Z",
      staleMasterData: false,
      groups: [],
    });

    await request(app.getHttpServer())
      .get("/cmp/acceptance/request-1/changes")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect({
        status: "AVAILABLE",
        changedFieldCount: 0,
        baselineCapturedAt: "2026-07-20T00:00:00.000Z",
        staleMasterData: false,
        groups: [],
      });

    expect(cmp.getAcceptanceChanges).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({ id: "user-1" }),
    );
  });

  it("serves the TMS CMP directory through the shared authenticated API", async () => {
    await request(app.getHttpServer())
      .get("/cmp/integrations/tms/engagements")
      .expect(401);

    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });

    await request(app.getHttpServer())
      .get("/cmp/integrations/tms/engagements")
      .query({ q: "ORC-2026-AUD" })
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect({ engagements: [] });

    expect(cmp.listTmsEngagements).toHaveBeenCalledWith(
      {
        q: "ORC-2026-AUD",
      },
      {
        id: "user-1",
        email: "staff@example.com",
        name: "Staff",
        globalRole: "STAFF",
      },
    );
  });

  it("serves CMP inbox without the EMP declaration gate", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });

    await request(app.getHttpServer())
      .get("/cmp/inbox/messages")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect([]);

    expect(inbox.list).toHaveBeenCalledWith("user-1", "CMP");

    await request(app.getHttpServer())
      .post("/cmp/inbox/messages/message-1/read")
      .set("Authorization", "Bearer token")
      .expect(201);
    expect(inbox.markRead).toHaveBeenCalledWith("message-1", "user-1", "CMP");

    await request(app.getHttpServer())
      .post("/cmp/inbox/messages/message-1/unread")
      .set("Authorization", "Bearer token")
      .expect(201);
    expect(inbox.markUnread).toHaveBeenCalledWith("message-1", "user-1", "CMP");
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        status: true,
      },
    });
  });

  it("rejects invalid CMP engagement dates before reaching the service", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });

    await request(app.getHttpServer())
      .post("/cmp/engagements")
      .set("Authorization", "Bearer token")
      .send({
        clientId: "client-1",
        engagementCode: "C001-2026-AUD",
        serviceType: "AUDIT",
        yearEndDate: "2026-02-31",
      })
      .expect(400);

    expect(cmp.createEngagement).not.toHaveBeenCalled();
  });

  it("does not expose direct CMP client mutation routes", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });

    await request(app.getHttpServer())
      .post("/cmp/clients")
      .set("Authorization", "Bearer token")
      .send({
        clientCode: "C001",
        nameZh: "Client CN",
        yearEndDate: "2026-02-31",
      })
      .expect(404);

    expect(cmp.createClient).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .patch("/cmp/clients/client-1")
      .set("Authorization", "Bearer token")
      .send({ nameZh: "Bypass attempt" })
      .expect(404);
    expect(cmp.updateClient).not.toHaveBeenCalled();
  });
});
