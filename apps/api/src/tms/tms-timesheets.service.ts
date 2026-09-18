import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  TmsApprovalActionInput,
  TmsApprovalEditInput,
  TmsApprovalLock,
  TmsApprovalProject,
  TmsApprovalProjectsResponse,
  TmsApprovalRecord,
  TmsApprovalRecordsResponse,
  TmsApprovalReturnInput,
  TmsApprovalStatus,
  TmsApproveInput,
  TmsOverviewDay,
  TmsOverviewPeriod,
  TmsOverviewQuery,
  TmsOverviewResponse,
  TmsProjectLink,
  TmsProjectLinkQuery,
  TmsProjectLinksResponse,
  TmsSaveDraftInput,
  TmsSubmitInput,
  TmsTimesheetHalf,
  TmsTimesheetMonth,
  TmsTimesheetRow,
} from "@project-wing/shared";
import {
  TMS_NORMAL_DAILY_HOURS_ERROR_MESSAGE,
  TMS_NORMAL_DAILY_HOURS_MAX,
  buildTmsApprovalOtRowId,
  TmsApprovalProjectsResponseSchema,
  TmsApprovalRecordSchema,
  TmsApprovalRecordsResponseSchema,
  TmsOverviewResponseSchema,
  TmsProjectLinkSchema,
  TmsProjectLinksResponseSchema,
  TmsSaveDraftInputSchema,
} from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { InboxService } from "../inbox/inbox.service";
import { PrismaService } from "../prisma/prisma.service";

type StoredMonth = Awaited<
  ReturnType<PrismaService["tmsTimesheetMonth"]["findUnique"]>
>;
type ApprovalStore = PrismaService["tmsApprovalSubmission"];
type PendingLinkStore = PrismaService["tmsPendingLinkSubmission"];
type ProjectLinkStore = PrismaService["tmsProjectLink"];
type TmsLinkStatus = "LINKED" | "PENDING_LINK";
type ApprovalPeriodStatuses = Record<TmsTimesheetHalf, TmsApprovalStatus>;
type OwnerApprovalState = {
  statuses: ApprovalPeriodStatuses;
  linkStatuses: Record<TmsTimesheetHalf, TmsLinkStatus>;
  locks: TmsApprovalLock[];
};
type ProjectLinkRecord = {
  id: string;
  referenceNumber: number;
  ownerUserId: string;
  rowId: string;
  year: number;
  month: number;
  periodScope: string;
  label?: string;
  projectId: string | null;
  status: "PENDING" | "LINKED";
  owner?: { name: string } | null;
  project?: {
    id: string;
    projectCode: string;
    name: string;
    cmpEngagement?: {
      id: string;
      engagementCode: string;
      client: {
        clientCode: string;
        nameEn: string | null;
        nameZh: string | null;
      };
      pic: string | null;
      mic: string | null;
    } | null;
  } | null;
};

@Injectable()
export class TmsTimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox?: InboxService
  ) {}

  async getMonth(
    user: RequestUser,
    year: number,
    month: number
  ): Promise<TmsTimesheetMonth> {
    const value = await this.prisma.tmsTimesheetMonth.findUnique({
      where: { userId_year_month: { userId: user.id, year, month } },
    });
    return this.toResponse(
      value,
      year,
      month,
      await this.getOwnerApprovalState(user.id, year, month)
    );
  }

  async getOverview(
    actor: RequestUser,
    input: TmsOverviewQuery
  ): Promise<TmsOverviewResponse> {
    this.assertHrOverviewRole(actor);
    const [users, months] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          status: "ACTIVE",
          globalRole: {
            notIn: ["SUPER_ADMIN", "HR", "CONFIRMATION_OFFICER"],
          },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, globalRole: true },
      }),
      this.prisma.tmsTimesheetMonth.findMany({
        where: { year: input.year, month: input.month },
        select: {
          userId: true,
          draftRows: true,
          firstStatus: true,
          secondStatus: true,
        },
      }),
    ]);
    const monthByUserId = new Map(months.map((month) => [month.userId, month]));
    const days = buildOverviewDays(input.year, input.month, input.period);

    return TmsOverviewResponseSchema.parse({
      year: input.year,
      month: input.month,
      period: input.period,
      employees: users.map((user) => {
        const month = monthByUserId.get(user.id);
        const rows = readTimesheetRows(month?.draftRows);
        const daily = days.map((day) => calculateOverviewDay(rows, day));
        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          globalRole: user.globalRole,
          status: overviewStatus(month, input.period),
          normal: daily.reduce((total, day) => total + day.normal, 0),
          ot: daily.reduce((total, day) => total + day.ot, 0),
          leave: daily.reduce((total, day) => total + day.leave, 0),
          warningCount: daily.filter((day) => day.state === "WARNING").length,
          errorCount: daily.filter((day) => day.state === "ERROR").length,
          daily,
        };
      }),
    });
  }

  async saveDraft(
    user: RequestUser,
    year: number,
    month: number,
    input: TmsSaveDraftInput
  ): Promise<TmsTimesheetMonth> {
    const rows = parseTimesheetRows(input.rows);
    const current = await this.prisma.tmsTimesheetMonth.findUnique({
      where: { userId_year_month: { userId: user.id, year, month } },
    });
    await this.assertApprovedProjectsUnchanged(
      user,
      year,
      month,
      current,
      rows
    );
    const saved = await this.prisma.tmsTimesheetMonth.upsert({
      where: { userId_year_month: { userId: user.id, year, month } },
      create: {
        userId: user.id,
        year,
        month,
        draftRows: rows as Prisma.InputJsonValue,
      },
      update: { draftRows: rows as Prisma.InputJsonValue },
    });
    const normalizedRows = await this.syncProjectLinks(
      user.id,
      year,
      month,
      rows
    );
    const normalizedSaved =
      JSON.stringify(normalizedRows) === JSON.stringify(rows)
        ? saved
        : await this.prisma.tmsTimesheetMonth.update({
            where: { id: saved.id },
            data: { draftRows: normalizedRows as Prisma.InputJsonValue },
          });
    return this.toResponse(
      normalizedSaved,
      year,
      month,
      await this.getOwnerApprovalState(user.id, year, month)
    );
  }

  async submit(
    user: RequestUser,
    year: number,
    month: number,
    input: TmsSubmitInput
  ): Promise<TmsTimesheetMonth> {
    const current =
      (await this.prisma.tmsTimesheetMonth.findUnique({
        where: { userId_year_month: { userId: user.id, year, month } },
      })) ??
      (await this.prisma.tmsTimesheetMonth.create({
        data: { userId: user.id, year, month, draftRows: [] },
      }));
    const draftRows = parseTimesheetRows(current.draftRows);
    for (const half of submitHalves(input.scope)) {
      validateTimesheetRows(rowsForHalf(draftRows, half, year, month));
    }
    const normalizedDraftRows = await this.resolveRowsForSubmission(
      draftRows,
      submitHalves(input.scope),
      year,
      month
    );
    const data: Record<string, unknown> = {};
    if (JSON.stringify(normalizedDraftRows) !== JSON.stringify(draftRows)) {
      data.draftRows = normalizedDraftRows as Prisma.InputJsonValue;
    }
    for (const half of submitHalves(input.scope)) {
      const prefix = half === "FIRST_HALF" ? "first" : "second";
      data[`${prefix}Status`] = "SUBMITTED";
      data[`${prefix}SubmittedRevision`] =
        Number(current[`${prefix}SubmittedRevision` as keyof typeof current]) +
        1;
      data[`${prefix}SubmittedRows`] = rowsForHalf(
        normalizedDraftRows,
        half,
        year,
        month
      );
    }
    const saved =
      Object.keys(data).length > 0
        ? await this.prisma.tmsTimesheetMonth.update({
            where: { id: current.id },
            data,
          })
        : current;
    for (const half of submitHalves(input.scope)) {
      const prefix = half === "FIRST_HALF" ? "first" : "second";
      const revision = Number(data[`${prefix}SubmittedRevision`]);
      const submittedRows = rowsForHalf(normalizedDraftRows, half, year, month);
      await this.createApprovalRecordsForSubmission(
        user,
        year,
        month,
        half,
        submittedRows
      );
      await this.createPendingLinkSubmissions(
        user,
        year,
        month,
        half,
        revision,
        submittedRows
      );
    }
    return this.toResponse(
      saved,
      year,
      month,
      await this.getOwnerApprovalState(user.id, year, month)
    );
  }

  async listProjectLinks(
    actor: RequestUser,
    input: TmsProjectLinkQuery
  ): Promise<TmsProjectLinksResponse> {
    const store = this.getProjectLinkStore();
    if (!store) {
      return { links: [] };
    }

    const records = await store.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.projectId
          ? {
              projectId: input.projectId,
              ...(actor.globalRole === "SUPER_ADMIN"
                ? {}
                : {
                    OR: [
                      { ownerUserId: actor.id },
                      {
                        project: {
                          members: {
                            some: { userId: actor.id, status: "ACTIVE" },
                          },
                        },
                      },
                    ],
                  }),
            }
          : { ownerUserId: actor.id }),
      },
      include: {
        owner: { select: { name: true } },
        project: { select: { id: true, projectCode: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
    const query = input.q?.toLocaleLowerCase("en-US");
    const filteredRecords = records.filter((record) => {
      if (!query) {
        return true;
      }
      return [
        record.label,
        formatTmsProjectCode(record.referenceNumber, record.id),
        record.owner.name,
        record.project?.projectCode,
        record.project?.name,
      ].some((value) => value?.toLocaleLowerCase("en-US").includes(query));
    });
    const rowByLinkId = await this.getProjectLinkRows(filteredRecords);
    const links = filteredRecords.map((record) =>
      this.formatProjectLink(record, rowByLinkId.get(record.id))
    );
    return TmsProjectLinksResponseSchema.parse({ links });
  }

  async linkProjectRow(
    actor: RequestUser,
    rowId: string,
    projectId: string
  ): Promise<TmsProjectLink> {
    const store = this.getProjectLinkStore();
    if (!store) {
      throw new ApiNotFoundException("NOT_FOUND", "TMS 行不存在");
    }
    const link = await store.findUnique({
      where: { ownerUserId_rowId: { ownerUserId: actor.id, rowId } },
    });
    if (!link) {
      throw new ApiNotFoundException("NOT_FOUND", "TMS 行不存在");
    }
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        status: true,
        projectCode: true,
        name: true,
        cmpEngagementId: true,
        cmpEngagement: {
          select: {
            id: true,
            engagementCode: true,
            client: {
              select: { clientCode: true, nameEn: true, nameZh: true },
            },
            pic: true,
            mic: true,
          },
        },
      },
    });
    if (!project || project.status !== "ACTIVE") {
      throw new ApiNotFoundException("NOT_FOUND", "项目不存在或已归档");
    }
    await this.assertProjectLinkAccess(actor, project.id);
    const duplicate = await store.findFirst({
      where: {
        ownerUserId: actor.id,
        rowId: { not: rowId },
        projectId,
        status: "LINKED",
      },
    });
    if (duplicate) {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "该 TMS 项目已关联另一条工时行"
      );
    }
    const saved = await store.update({
      where: { id: link.id },
      data: { projectId, status: "LINKED" },
    });
    await this.updateProjectLinkDraftRow(link, project);
    return this.formatProjectLink({
      ...link,
      ...saved,
      project,
    });
  }

  async unlinkProjectRow(
    actor: RequestUser,
    rowId: string
  ): Promise<TmsProjectLink> {
    const store = this.getProjectLinkStore();
    if (!store) {
      throw new ApiNotFoundException("NOT_FOUND", "TMS 行不存在");
    }
    const link = await store.findUnique({
      where: { ownerUserId_rowId: { ownerUserId: actor.id, rowId } },
    });
    if (!link) {
      throw new ApiNotFoundException("NOT_FOUND", "TMS 行不存在");
    }
    if (link.projectId) {
      await this.assertProjectLinkAccess(actor, link.projectId);
    }
    const saved = await store.update({
      where: { id: link.id },
      data: { projectId: null, status: "PENDING" },
    });
    await this.clearProjectLinkDraftRow(link);
    return this.formatProjectLink({ ...link, ...saved, project: null });
  }

  private async resolveRowsForSubmission(
    rows: TmsTimesheetRow[],
    halves: TmsTimesheetHalf[],
    year: number,
    month: number
  ) {
    const submittedRowIds = new Set(
      halves
        .flatMap((half) => rowsForHalf(rows, half, year, month))
        .filter((row) => row.type === "Chargeable")
        .map((row) => row.id)
    );
    const rowsNeedingResolution = rows.filter(
      (row) =>
        submittedRowIds.has(row.id) &&
        row.type === "Chargeable" &&
        !getRowEngagementId(row)
    );
    if (rowsNeedingResolution.length === 0) {
      return rows;
    }

    const normalizedCodes = [
      ...new Set(
        rowsNeedingResolution
          .map((row) => normalizeSubmissionCode(getRowEngagementCode(row)))
          .filter(Boolean)
      ),
    ];
    const projectIds = [
      ...new Set(
        rowsNeedingResolution
          .map(getRowProjectId)
          .filter((value): value is string => Boolean(value))
      ),
    ];
    const [projects, engagements] = await Promise.all([
      projectIds.length > 0
        ? this.prisma.project.findMany({
            where: {
              id: { in: projectIds },
              status: "ACTIVE",
            },
            select: { id: true, cmpEngagementId: true },
          })
        : Promise.resolve([]),
      normalizedCodes.length > 0
        ? this.prisma.cmpEngagement.findMany({
            where: {
              status: "ACTIVE",
              OR: [
                { engagementCode: { in: normalizedCodes } },
                {
                  codeAliases: {
                    some: { normalizedCode: { in: normalizedCodes } },
                  },
                },
              ],
            },
            select: {
              id: true,
              engagementCode: true,
              codeAliases: { select: { normalizedCode: true } },
            },
          })
        : Promise.resolve([]),
    ]);
    const engagementByProjectId = new Map(
      projects.flatMap((project) =>
        project.cmpEngagementId
          ? [[project.id, project.cmpEngagementId] as const]
          : []
      )
    );
    const engagementByCode = new Map<string, string>();
    for (const engagement of engagements) {
      engagementByCode.set(
        normalizeSubmissionCode(engagement.engagementCode),
        engagement.id
      );
      for (const alias of engagement.codeAliases) {
        engagementByCode.set(alias.normalizedCode, engagement.id);
      }
    }
    const normalizedRows = rows.map((row) => {
      if (
        row.type !== "Chargeable" ||
        getRowEngagementId(row) ||
        !submittedRowIds.has(row.id)
      ) {
        return row;
      }
      const engagementId =
        engagementByProjectId.get(getRowProjectId(row) ?? "") ??
        engagementByCode.get(
          normalizeSubmissionCode(getRowEngagementCode(row))
        );
      return engagementId ? { ...row, engagementId } : row;
    });
    const activeProjectIds = new Set(projects.map((project) => project.id));
    const unresolved = normalizedRows.filter(
      (row) =>
        submittedRowIds.has(row.id) &&
        row.type === "Chargeable" &&
        !getRowEngagementId(row) &&
        !(
          getRowProjectId(row) &&
          activeProjectIds.has(getRowProjectId(row) as string)
        )
    );
    if (unresolved.length > 0) {
      const [first] = unresolved;
      const code = getRowEngagementCode(first);
      const projectId = getRowProjectId(first);
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        code
          ? `提交失败：收费工时 ${code} 未关联有效 CMP 项目`
          : projectId
            ? "提交失败：收费工时所选项目未关联有效 CMP 项目"
            : "提交失败：收费工时缺少项目归属，请先选择项目"
      );
    }
    return normalizedRows;
  }

  private async createPendingLinkSubmissions(
    user: RequestUser,
    year: number,
    month: number,
    half: TmsTimesheetHalf,
    revision: number,
    rows: TmsTimesheetRow[]
  ) {
    const pendingStore = this.getPendingLinkStore();
    if (!pendingStore) {
      return;
    }

    const groups = groupPendingLinkRows(rows);
    if (groups.size === 0) {
      return;
    }

    const projectIds = [...groups.keys()];
    await pendingStore.updateMany({
      where: {
        ownerUserId: user.id,
        projectId: { in: projectIds },
        year,
        month,
        half,
        status: "PENDING_LINK",
      },
      data: { status: "SUPERSEDED" },
    });
    for (const [projectId, submittedRows] of groups) {
      await pendingStore.create({
        data: {
          ownerUserId: user.id,
          projectId,
          year,
          month,
          half,
          revision,
          status: "PENDING_LINK",
          submittedRows: submittedRows as Prisma.InputJsonValue,
        },
      });
    }
  }

  async reconcileProjectLink(projectId: string, engagementId: string) {
    const pendingStore = this.getPendingLinkStore();
    if (pendingStore) {
      const pending = await pendingStore.findMany({
        where: { projectId, status: "PENDING_LINK" },
        orderBy: { revision: "desc" },
      });
      for (const submission of latestPendingLinkSubmissions(pending)) {
        const owner = await this.prisma.user.findUnique({
          where: { id: submission.ownerUserId },
          select: { id: true, email: true, name: true, globalRole: true },
        });
        if (!owner) {
          continue;
        }

        const submittedRows = parseTimesheetRows(submission.submittedRows).map(
          (row) =>
            row.type === "Chargeable" && getRowProjectId(row) === projectId
              ? { ...row, engagementId }
              : row
        );
        await this.createApprovalRecordsForSubmission(
          owner as RequestUser,
          submission.year,
          submission.month,
          submission.half,
          submittedRows
        );
        await this.updateLinkedTimesheetSnapshot(
          submission.ownerUserId,
          submission.year,
          submission.month,
          submission.half,
          submittedRows
        );
        await pendingStore.update({
          where: { id: submission.id },
          data: {
            status: "LINKED",
            linkedEngagementId: engagementId,
            linkedAt: new Date(),
          },
        });
      }
    }

    await this.refreshLinkedProjectDraftRows(projectId);
  }

  async refreshProjectLink(projectId: string) {
    await this.refreshLinkedProjectDraftRows(projectId);
  }

  private async refreshLinkedProjectDraftRows(projectId: string) {
    const store = this.getProjectLinkStore();
    if (!store) {
      return;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectCode: true,
        name: true,
        cmpEngagementId: true,
        cmpEngagement: {
          select: {
            id: true,
            engagementCode: true,
            client: {
              select: { clientCode: true, nameEn: true, nameZh: true },
            },
            pic: true,
            mic: true,
          },
        },
      },
    });
    if (!project) {
      return;
    }

    const links = await store.findMany({
      where: { projectId, status: "LINKED" },
    });
    for (const link of links) {
      await this.updateProjectLinkDraftRow(link, project);
    }
  }

  private async updateLinkedTimesheetSnapshot(
    ownerUserId: string,
    year: number,
    month: number,
    half: TmsTimesheetHalf,
    rows: TmsTimesheetRow[]
  ) {
    const current = await this.prisma.tmsTimesheetMonth.findUnique({
      where: { userId_year_month: { userId: ownerUserId, year, month } },
    });
    if (!current) {
      return;
    }
    const prefix = half === "FIRST_HALF" ? "first" : "second";
    const submittedField = `${prefix}SubmittedRows` as const;
    await this.prisma.tmsTimesheetMonth.update({
      where: { id: current.id },
      data: {
        draftRows: mergeRowMetadataById(
          current.draftRows,
          rows
        ) as Prisma.InputJsonValue,
        [submittedField]: mergeRowsById(
          current[submittedField],
          rows
        ) as Prisma.InputJsonValue,
      },
    });
  }

  private async syncProjectLinks(
    ownerUserId: string,
    year: number,
    month: number,
    rows: TmsTimesheetRow[]
  ) {
    const store = this.getProjectLinkStore();
    const chargeableRows = rows.filter((row) => row.type === "Chargeable");
    if (!store || chargeableRows.length === 0) {
      return rows;
    }

    const normalizedRows = [...rows];
    const rowIds = chargeableRows.map((row) => row.id);
    const existing = await store.findMany({
      where: { ownerUserId, rowId: { in: rowIds } },
      select: { rowId: true, projectId: true, status: true },
    });
    const existingByRowId = new Map(existing.map((link) => [link.rowId, link]));
    for (const row of chargeableRows) {
      const prior = existingByRowId.get(row.id);
      const requestedProjectId = getRowProjectId(row);
      const projectId =
        requestedProjectId ??
        (prior?.status === "LINKED" ? prior.projectId : null);
      const saved = await store.upsert({
        where: { ownerUserId_rowId: { ownerUserId, rowId: row.id } },
        update: {
          year,
          month,
          periodScope: row.periodScope,
          label: projectLinkLabel(row),
          projectId,
          status: projectId ? "LINKED" : "PENDING",
        },
        create: {
          ownerUserId,
          rowId: row.id,
          year,
          month,
          periodScope: row.periodScope,
          label: projectLinkLabel(row),
          projectId,
          status: projectId ? "LINKED" : "PENDING",
        },
      });
      if (!projectId && shouldAssignPendingTmsCode(row)) {
        const tmsCode = formatTmsProjectCode(saved.referenceNumber, saved.id);
        const index = normalizedRows.findIndex((item) => item.id === row.id);
        if (index !== -1) {
          normalizedRows[index] = {
            ...normalizedRows[index],
            source: "TMS_PENDING",
            engagementId: "",
            engagementCode: tmsCode,
            description: normalizedRows[index].description.trim()
              ? normalizedRows[index].description
              : "Dummy",
          };
        }
      }
    }
    return normalizedRows;
  }

  private async assertProjectLinkAccess(actor: RequestUser, projectId: string) {
    if (actor.globalRole === "SUPER_ADMIN") {
      return;
    }
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: actor.id } },
      select: { status: true },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有项目成员可以关联 TMS 工时"
      );
    }
  }

  private async updateProjectLinkDraftRow(
    link: ProjectLinkRecord,
    project: NonNullable<ProjectLinkRecord["project"]>
  ) {
    const current = await this.prisma.tmsTimesheetMonth.findUnique({
      where: {
        userId_year_month: {
          userId: link.ownerUserId,
          year: link.year,
          month: link.month,
        },
      },
    });
    if (!current) {
      return;
    }
    const rows = parseTimesheetRows(current.draftRows);
    const cmp = project.cmpEngagement;
    const nextRows = rows.map((row) =>
      row.id === link.rowId
        ? {
            ...row,
            projectId: project.id,
            projectCode: project.projectCode,
            projectName: project.name,
            source: cmp ? "ENGAGEMENT" : "UNLINKED_PROJECT",
            engagementId: cmp?.id ?? "",
            engagementCode: cmp?.engagementCode ?? project.projectCode,
            clientCode: cmp?.client.clientCode ?? project.projectCode,
            clientName:
              cmp?.client.nameEn || cmp?.client.nameZh || project.name,
            pic: cmp?.pic ?? null,
            mic: cmp?.mic ?? null,
          }
        : row
    );
    await this.prisma.tmsTimesheetMonth.update({
      where: { id: current.id },
      data: { draftRows: nextRows as Prisma.InputJsonValue },
    });
  }

  private async clearProjectLinkDraftRow(link: ProjectLinkRecord) {
    const current = await this.prisma.tmsTimesheetMonth.findUnique({
      where: {
        userId_year_month: {
          userId: link.ownerUserId,
          year: link.year,
          month: link.month,
        },
      },
    });
    if (!current) {
      return;
    }
    const rows = parseTimesheetRows(current.draftRows);
    const nextRows = rows.map((row) =>
      row.id === link.rowId
        ? {
            ...row,
            projectId: null,
            projectCode: null,
            projectName: null,
            source: "TMS_PENDING",
            engagementId: "",
            engagementCode: formatTmsProjectCode(link.referenceNumber, link.id),
            clientCode: "",
            clientName: "",
            pic: null,
            mic: null,
          }
        : row
    );
    await this.prisma.tmsTimesheetMonth.update({
      where: { id: current.id },
      data: { draftRows: nextRows as Prisma.InputJsonValue },
    });
  }

  private async getProjectLinkRows(records: ProjectLinkRecord[]) {
    if (records.length === 0) {
      return new Map<string, TmsTimesheetRow>();
    }
    const uniqueMonths = new Map<
      string,
      { userId: string; year: number; month: number }
    >();
    for (const record of records) {
      uniqueMonths.set(`${record.ownerUserId}:${record.year}:${record.month}`, {
        userId: record.ownerUserId,
        year: record.year,
        month: record.month,
      });
    }
    const months = await this.prisma.tmsTimesheetMonth.findMany({
      where: { OR: [...uniqueMonths.values()] },
      select: { userId: true, year: true, month: true, draftRows: true },
    });
    const rowByOwnerAndId = new Map<string, TmsTimesheetRow>();
    for (const month of months) {
      for (const row of readTimesheetRows(month.draftRows)) {
        rowByOwnerAndId.set(`${month.userId}:${row.id}`, row);
      }
    }
    return new Map(
      records.flatMap((record) => {
        const row = rowByOwnerAndId.get(
          `${record.ownerUserId}:${record.rowId}`
        );
        return row ? ([[record.id, row]] as const) : [];
      })
    );
  }

  private formatProjectLink(
    record: ProjectLinkRecord,
    row?: TmsTimesheetRow
  ): TmsProjectLink {
    return TmsProjectLinkSchema.parse({
      id: record.id,
      rowId: record.rowId,
      ownerUserId: record.ownerUserId,
      ownerName: record.owner?.name ?? record.ownerUserId,
      year: record.year,
      month: record.month,
      periodScope: record.periodScope,
      tmsCode: formatTmsProjectCode(record.referenceNumber, record.id),
      label: record.label || record.rowId,
      projectId: record.projectId,
      projectCode: record.project?.projectCode ?? null,
      projectName: record.project?.name ?? null,
      workType: row ? getStoredRowWorkType(row) : null,
      description: row?.description ?? record.label ?? "",
      hoursByDate: row?.hoursByDate ?? {},
      periodTotal: row?.periodTotal ?? 0,
      status: record.status,
    });
  }

  async listApprovalProjects(
    actor: RequestUser,
    year?: number,
    month?: number,
    query = ""
  ): Promise<TmsApprovalProjectsResponse> {
    this.assertApprovalRole(actor);
    const approvalStore = this.getApprovalStore();
    if (!approvalStore) {
      return { projects: [] };
    }
    const normalizedQuery = query.trim().toLowerCase();
    const engagements = await this.prisma.cmpEngagement.findMany({
      where: {
        AND: [
          { OR: [{ picUserId: actor.id }, { micUserId: actor.id }] },
          ...(normalizedQuery
            ? [
                {
                  OR: [
                    {
                      engagementCode: {
                        contains: normalizedQuery,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      client: {
                        clientCode: {
                          contains: normalizedQuery,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                    {
                      client: {
                        nameEn: {
                          contains: normalizedQuery,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                    {
                      client: {
                        nameZh: {
                          contains: normalizedQuery,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: { engagementCode: "asc" },
      select: {
        id: true,
        engagementCode: true,
        pic: true,
        mic: true,
        status: true,
        client: { select: { clientCode: true, nameEn: true, nameZh: true } },
        _count: { select: { projects: true } },
      },
    });
    const records = await approvalStore.findMany({
      where: {
        ...(year !== undefined && month !== undefined ? { year, month } : {}),
        engagementId: { in: engagements.map((item) => item.id) },
      },
      orderBy: { revision: "desc" },
      select: {
        engagementId: true,
        projectId: true,
        ownerUserId: true,
        year: true,
        month: true,
        half: true,
        revision: true,
        status: true,
      },
    });
    const latest = latestApprovalRecords(records);
    const projects = engagements.map((engagement) => {
      const projectRecords = latest.filter(
        (record) => record.engagementId === engagement.id
      );
      return {
        engagementId: engagement.id,
        engagementCode: engagement.engagementCode,
        clientCode: engagement.client.clientCode,
        clientName:
          engagement.client.nameEn ||
          engagement.client.nameZh ||
          engagement.client.clientCode ||
          engagement.engagementCode,
        pic: engagement.pic,
        mic: engagement.mic,
        status: engagement.status,
        pendingCount: projectRecords.filter(
          (record) =>
            record.status === "SUBMITTED" ||
            record.status === "PENDING_CONFIRMATION"
        ).length,
        returnedCount: projectRecords.filter(
          (record) => record.status === "RETURNED"
        ).length,
        projectCount: engagement._count?.projects ?? 0,
      } satisfies TmsApprovalProject;
    });
    return TmsApprovalProjectsResponseSchema.parse({ projects });
  }

  async listApprovalRecords(
    actor: RequestUser,
    engagementId: string,
    year: number,
    month: number,
    query: { status?: TmsApprovalStatus; q?: string } = {}
  ): Promise<TmsApprovalRecordsResponse> {
    this.assertApprovalRole(actor);
    const approvalStore = this.getApprovalStore();
    if (!approvalStore) {
      return { records: [] };
    }
    const access = await this.assertApprovalAccess(actor, engagementId);
    const records = await approvalStore.findMany({
      where: { engagementId, year, month },
      orderBy: { revision: "desc" },
    });
    const latest = latestApprovalRecords(records);
    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        status: "ACTIVE",
        project: { cmpEngagementId: engagementId, status: "ACTIVE" },
      },
      select: {
        userId: true,
        status: true,
        user: {
          select: { id: true, name: true, email: true, globalRole: true },
        },
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
            cmpEngagementId: true,
          },
        },
      },
    });
    const eligibleMemberships = projectMembers.filter(
      (member) =>
        member.status === "ACTIVE" &&
        member.userId !== access.picUserId &&
        member.userId !== access.micUserId &&
        member.user.globalRole !== "PARTNER" &&
        member.user.globalRole !== "MANAGER"
    );
    const search = query.q?.trim().toLowerCase();
    const engagement = await this.prisma.cmpEngagement.findUnique({
      where: { id: engagementId },
      select: {
        engagementCode: true,
        client: { select: { clientCode: true, nameEn: true, nameZh: true } },
      },
    });
    const latestByKey = new Map(
      latest.flatMap((record) => {
        const projectId =
          record.projectId ??
          getRowProjectId((record.submittedRows as TmsTimesheetRow[])[0]);
        return projectId
          ? [
              [
                `${record.ownerUserId}:${projectId}:${record.half}`,
                record,
              ] as const,
            ]
          : [];
      })
    );
    const membershipsByOwner = new Map<string, typeof eligibleMemberships>();
    for (const membership of eligibleMemberships) {
      const memberships = membershipsByOwner.get(membership.userId) ?? [];
      memberships.push(membership);
      membershipsByOwner.set(membership.userId, memberships);
    }
    const legacyByOwnerHalf = new Map(
      latest
        .filter((record) => !record.projectId)
        .map(
          (record) => [`${record.ownerUserId}:${record.half}`, record] as const
        )
    );
    const response: TmsApprovalRecord[] = [];
    for (const membership of eligibleMemberships) {
      const owner = membership.user;
      if (
        search &&
        !`${owner.name} ${owner.email} ${membership.project.projectCode} ${membership.project.name}`
          .toLowerCase()
          .includes(search)
      ) {
        continue;
      }
      for (const half of ["FIRST_HALF", "SECOND_HALF"] as const) {
        const record =
          latestByKey.get(`${owner.id}:${membership.project.id}:${half}`) ??
          (membershipsByOwner.get(owner.id)?.length === 1
            ? legacyByOwnerHalf.get(`${owner.id}:${half}`)
            : undefined);
        const status = record?.status ?? "NOT_SUBMITTED";
        if (query.status && status !== query.status) {
          continue;
        }
        response.push(
          TmsApprovalRecordSchema.parse({
            id:
              record?.id ??
              `baseline:${engagementId}:${membership.project.id}:${owner.id}:${year}:${month}:${half}`,
            ownerUserId: owner.id,
            ownerName: owner.name,
            ownerEmail: owner.email,
            year,
            month,
            half,
            engagementId,
            engagementCode: engagement?.engagementCode ?? engagementId,
            projectId: membership.project.id,
            projectCode: membership.project.projectCode,
            projectName: membership.project.name,
            clientCode: engagement?.client.clientCode ?? engagementId,
            clientName: engagement
              ? engagement.client.nameEn ||
                engagement.client.nameZh ||
                engagement.client.clientCode
              : engagementId,
            revision: record?.revision ?? 1,
            status,
            submittedRows: (record?.submittedRows ?? []) as TmsTimesheetRow[],
            submittedAt: record?.submittedAt?.toISOString() ?? null,
            reviewedById: record?.reviewedById ?? null,
            reviewedAt: record?.reviewedAt?.toISOString() ?? null,
            returnReason: record?.returnReason ?? null,
          })
        );
      }
    }
    return TmsApprovalRecordsResponseSchema.parse({ records: response });
  }

  async approveSubmission(
    actor: RequestUser,
    submissionId: string,
    input: TmsApprovalActionInput
  ): Promise<TmsApprovalRecord> {
    await Promise.resolve();
    return this.reviewSubmission(actor, submissionId, input, "APPROVE", null);
  }

  async returnSubmission(
    actor: RequestUser,
    submissionId: string,
    input: TmsApprovalReturnInput
  ): Promise<TmsApprovalRecord> {
    await Promise.resolve();
    return this.reviewSubmission(
      actor,
      submissionId,
      input,
      "RETURN",
      input.reason ?? null
    );
  }

  async editSubmission(
    actor: RequestUser,
    submissionId: string,
    input: TmsApprovalEditInput
  ): Promise<TmsApprovalRecord> {
    const approvalStore = this.getApprovalStore();
    if (!approvalStore) {
      throw new ApiNotFoundException("NOT_FOUND", "审批记录不存在");
    }
    const current = await approvalStore.findUnique({
      where: { id: submissionId },
    });
    if (!current) {
      throw new ApiNotFoundException("NOT_FOUND", "审批记录不存在");
    }
    await this.assertApprovalAccess(actor, current.engagementId);
    const latest = await approvalStore.findFirst({
      where: {
        ownerUserId: current.ownerUserId,
        engagementId: current.engagementId,
        projectId: current.projectId,
        year: current.year,
        month: current.month,
        half: current.half,
      },
      orderBy: { revision: "desc" },
    });
    if (
      !latest ||
      latest.id !== current.id ||
      current.revision !== input.expectedRevision
    ) {
      throw new ApiConflictException(
        "TIMESHEET_REVISION_CONFLICT",
        "提交版本已更新，请刷新后再保存"
      );
    }
    if (current.status === "NOT_SUBMITTED") {
      throw new ApiConflictException(
        "TIMESHEET_REVISION_CONFLICT",
        "该员工尚未提交，不能修改审批快照"
      );
    }
    const currentRows = current.submittedRows as TmsTimesheetRow[];
    const validatedRows = validateTimesheetRows(input.rows, currentRows);
    const safeRows = validateApprovalEditRows(
      currentRows,
      validatedRows,
      current.engagementId,
      current.projectId,
      current.half,
      current.year,
      current.month
    );
    if (approvalRowsHoursEqual(currentRows, safeRows)) {
      return this.formatApprovalRecord(current);
    }
    const hasHours = safeRows.some((row) =>
      Object.values(row.hoursByDate).some((hours) => hours > 0)
    );
    const nextStatus = hasHours ? "PENDING_CONFIRMATION" : "NOT_SUBMITTED";
    const saved = await approvalStore.update({
      where: { id: current.id },
      data: {
        revision: current.revision + 1,
        status: nextStatus,
        submittedRows: safeRows as Prisma.InputJsonValue,
        submittedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        returnReason: null,
      },
    });
    return this.formatApprovalRecord(saved);
  }

  private async syncOwnerMonthAfterApprovalEdit(
    current: {
      ownerUserId: string;
      engagementId: string;
      projectId: string | null;
      year: number;
      month: number;
      half: TmsTimesheetHalf;
    },
    rows: TmsTimesheetRow[],
    periodStatus: "SUBMITTED" | "APPROVED"
  ) {
    const monthStore = (
      this.prisma as PrismaService & {
        tmsTimesheetMonth?: PrismaService["tmsTimesheetMonth"];
      }
    ).tmsTimesheetMonth;
    if (!monthStore) {
      return;
    }
    const month = await monthStore.findUnique({
      where: {
        userId_year_month: {
          userId: current.ownerUserId,
          year: current.year,
          month: current.month,
        },
      },
    });
    if (!month) {
      return;
    }
    const prefix = current.half === "FIRST_HALF" ? "first" : "second";
    await monthStore.update({
      where: { id: month.id },
      data: {
        [`${prefix}Status`]: periodStatus,
        draftRows: replaceApprovalRows(
          month.draftRows,
          current.engagementId,
          current.projectId,
          current.half,
          current.year,
          current.month,
          rows
        ) as Prisma.InputJsonValue,
        [`${prefix}SubmittedRows`]: replaceApprovalRows(
          month[`${prefix}SubmittedRows` as keyof typeof month],
          current.engagementId,
          current.projectId,
          current.half,
          current.year,
          current.month,
          rows
        ) as Prisma.InputJsonValue,
      },
    });
  }

  private async getOwnerMonthPeriodStatusFromApprovals(
    current: {
      ownerUserId: string;
      year: number;
      month: number;
      half: TmsTimesheetHalf;
    },
    fallbackStatus: TmsApprovalStatus
  ): Promise<"SUBMITTED" | "APPROVED"> {
    const approvalStore = this.getApprovalStore();
    if (!approvalStore || typeof approvalStore.findMany !== "function") {
      return fallbackStatus === "APPROVED" ||
        fallbackStatus === "PENDING_CONFIRMATION"
        ? "APPROVED"
        : "SUBMITTED";
    }
    const records = await approvalStore.findMany({
      where: {
        ownerUserId: current.ownerUserId,
        year: current.year,
        month: current.month,
        half: current.half,
      },
      orderBy: { revision: "desc" },
    });
    const latest = latestApprovalRecords(records);
    return latest.length > 0 &&
      latest.every(
        (record) =>
          record.status === "APPROVED" ||
          record.status === "PENDING_CONFIRMATION"
      )
      ? "APPROVED"
      : "SUBMITTED";
  }

  private async setOwnerMonthPeriodStatus(
    current: {
      ownerUserId: string;
      year: number;
      month: number;
      half: TmsTimesheetHalf;
    },
    status: "SUBMITTED" | "APPROVED"
  ) {
    const monthStore = (
      this.prisma as PrismaService & {
        tmsTimesheetMonth?: PrismaService["tmsTimesheetMonth"];
      }
    ).tmsTimesheetMonth;
    if (!monthStore) {
      return;
    }
    const month = await monthStore.findUnique({
      where: {
        userId_year_month: {
          userId: current.ownerUserId,
          year: current.year,
          month: current.month,
        },
      },
    });
    if (!month) {
      return;
    }
    const prefix = current.half === "FIRST_HALF" ? "first" : "second";
    await monthStore.update({
      where: { id: month.id },
      data: { [`${prefix}Status`]: status },
    });
  }

  private async reviewSubmission(
    actor: RequestUser,
    submissionId: string,
    input: TmsApprovalActionInput,
    action: "APPROVE" | "RETURN",
    returnReason: string | null
  ): Promise<TmsApprovalRecord> {
    this.assertApprovalRole(actor);
    const approvalStore = this.getApprovalStore();
    if (!approvalStore) {
      throw new ApiNotFoundException("NOT_FOUND", "审批记录不存在");
    }
    const current = await approvalStore.findUnique({
      where: { id: submissionId },
    });
    if (!current) {
      throw new ApiNotFoundException("NOT_FOUND", "审批记录不存在");
    }
    await this.assertApprovalAccess(actor, current.engagementId);
    const latest = await approvalStore.findFirst({
      where: {
        ownerUserId: current.ownerUserId,
        engagementId: current.engagementId,
        projectId: current.projectId,
        year: current.year,
        month: current.month,
        half: current.half,
      },
      orderBy: { revision: "desc" },
    });
    if (!latest || latest.id !== current.id) {
      throw new ApiConflictException(
        "TIMESHEET_REVISION_CONFLICT",
        "提交版本已更新，请刷新后审批"
      );
    }
    if (current.revision !== input.expectedRevision) {
      throw new ApiConflictException(
        "TIMESHEET_REVISION_CONFLICT",
        "提交版本已更新，请刷新后审批"
      );
    }
    const nextStatus =
      action === "APPROVE"
        ? current.status === "APPROVED"
          ? (input.restoreStatus ?? "SUBMITTED")
          : current.status === "SUBMITTED" ||
              current.status === "PENDING_CONFIRMATION"
            ? "APPROVED"
            : null
        : current.status === "RETURNED"
          ? "SUBMITTED"
          : current.status === "SUBMITTED" ||
              current.status === "PENDING_CONFIRMATION"
            ? "RETURNED"
            : null;
    if (!nextStatus) {
      throw new ApiConflictException(
        "TIMESHEET_REVISION_CONFLICT",
        "当前状态不能执行该操作"
      );
    }
    const saved = await approvalStore.update({
      where: { id: current.id },
      data:
        nextStatus === "SUBMITTED" || nextStatus === "PENDING_CONFIRMATION"
          ? {
              status: nextStatus,
              reviewedById: null,
              reviewedAt: null,
              returnReason: null,
            }
          : action === "RETURN"
            ? {
                status: nextStatus,
                returnReason,
                reviewedById: actor.id,
                reviewedAt: new Date(),
              }
            : {
                status: nextStatus,
                reviewedById: actor.id,
                reviewedAt: new Date(),
                returnReason: null,
              },
    });
    const ownerMonthStatus = await this.getOwnerMonthPeriodStatusFromApprovals(
      current,
      nextStatus
    );
    await (nextStatus === "APPROVED"
      ? this.syncOwnerMonthAfterApprovalEdit(
          current,
          current.submittedRows as TmsTimesheetRow[],
          ownerMonthStatus
        )
      : this.setOwnerMonthPeriodStatus(current, ownerMonthStatus));
    if (action === "RETURN" && nextStatus === "RETURNED") {
      await this.inbox?.createCollaborationMessage({
        recipientId: current.ownerUserId,
        senderId: actor.id,
        type: "SYSTEM_NOTIFICATION",
        title: "TMS 工时已退回",
        body: returnReason?.trim()
          ? `你的 ${current.year} 年 ${current.month} 月 ${current.half === "FIRST_HALF" ? "上半月" : "下半月"} 工时已退回。理由：${returnReason.trim()}`
          : `你的 ${current.year} 年 ${current.month} 月 ${current.half === "FIRST_HALF" ? "上半月" : "下半月"} 工时已退回，请打开 TMS 查看并修正。`,
        contentKey: "TMS_TIMESHEET_RETURNED",
        contentParams: {
          year: current.year,
          month: current.month,
          half: current.half,
          reason: returnReason?.trim() ?? "",
        },
        actionUrl: `/timesheet?year=${current.year}&month=${current.month}`,
      });
    }
    return this.formatApprovalRecord(saved);
  }

  private getApprovalStore(): ApprovalStore | undefined {
    return (
      this.prisma as PrismaService & { tmsApprovalSubmission?: ApprovalStore }
    ).tmsApprovalSubmission;
  }

  private getPendingLinkStore(): PendingLinkStore | undefined {
    return (
      this.prisma as PrismaService & {
        tmsPendingLinkSubmission?: PendingLinkStore;
      }
    ).tmsPendingLinkSubmission;
  }

  private getProjectLinkStore(): ProjectLinkStore | undefined {
    return (
      this.prisma as PrismaService & { tmsProjectLink?: ProjectLinkStore }
    ).tmsProjectLink;
  }

  private assertApprovalRole(actor: RequestUser) {
    if (actor.globalRole !== "PARTNER" && actor.globalRole !== "MANAGER") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有 Partner 或 Manager 可以审批"
      );
    }
  }

  private assertHrOverviewRole(actor: RequestUser) {
    if (actor.globalRole !== "HR" && actor.globalRole !== "SUPER_ADMIN") {
      throw new ApiForbiddenException("FORBIDDEN", "只有 HR 可以查看 TMS 总览");
    }
  }

  private async assertApprovalAccess(actor: RequestUser, engagementId: string) {
    const engagement = await this.prisma.cmpEngagement.findUnique({
      where: { id: engagementId },
      select: { picUserId: true, micUserId: true },
    });
    if (!engagement) {
      throw new ApiNotFoundException("NOT_FOUND", "项目不存在");
    }
    if (
      engagement.picUserId !== actor.id &&
      engagement.micUserId !== actor.id
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有该项目的 PIC 或 MIC 可以审批"
      );
    }
    return engagement;
  }

  private async assertApprovedProjectsUnchanged(
    user: RequestUser,
    year: number,
    month: number,
    current: StoredMonth,
    rows: TmsTimesheetRow[]
  ) {
    const approvalStore = this.getApprovalStore();
    if (!approvalStore) {
      return;
    }
    for (const half of ["FIRST_HALF", "SECOND_HALF"] as const) {
      const records = await approvalStore.findMany({
        where: {
          ownerUserId: user.id,
          year,
          month,
          half,
        },
        orderBy: { revision: "desc" },
      });
      const latest = latestApprovalRecords(records);
      for (const record of latest) {
        const history = records.filter(
          (candidate) =>
            candidate.ownerUserId === record.ownerUserId &&
            candidate.engagementId === record.engagementId &&
            candidate.projectId === record.projectId &&
            candidate.half === record.half
        );
        const approvedRecord = history.find(
          (candidate) => candidate.status === "APPROVED"
        );
        const lockRecord =
          record.status === "PENDING_CONFIRMATION" ||
          record.status === "APPROVED"
            ? record
            : record.status === "SUBMITTED"
              ? approvedRecord
              : null;
        if (!lockRecord) {
          continue;
        }
        const before = rowsForEngagement(
          current?.draftRows,
          record.engagementId,
          record.projectId,
          half,
          year,
          month
        );
        const after = rowsForEngagement(
          rows,
          record.engagementId,
          record.projectId,
          half,
          year,
          month
        );
        const changed =
          record.status === "PENDING_CONFIRMATION"
            ? JSON.stringify(before) !== JSON.stringify(after)
            : !approvedNonZeroHoursUnchanged(
                lockRecord.submittedRows as TmsTimesheetRow[],
                after
              );
        if (changed) {
          throw new ApiConflictException(
            "TIMESHEET_PERIOD_APPROVED",
            "该项目工时已审批，不能再修改"
          );
        }
      }
    }
  }

  private async createApprovalRecordsForSubmission(
    user: RequestUser,
    year: number,
    month: number,
    half: TmsTimesheetHalf,
    rows: TmsTimesheetRow[]
  ) {
    const approvalStore = this.getApprovalStore();
    if (!approvalStore) {
      return;
    }
    if (
      [
        "PARTNER",
        "PRINCIPAL",
        "MANAGER",
        "EQCR",
        "TAX_EXPERT",
        "SUPER_ADMIN",
        "CONFIRMATION_OFFICER",
      ].includes(user.globalRole)
    ) {
      return;
    }
    const groups = groupChargeableRows(rows);
    for (const {
      engagementId,
      projectId,
      rows: submittedRows,
    } of groups.values()) {
      const engagement = await this.prisma.cmpEngagement.findFirst({
        where: { id: engagementId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!engagement) {
        continue;
      }
      const latest = await approvalStore.findFirst({
        where: {
          ownerUserId: user.id,
          engagementId,
          projectId,
          year,
          month,
          half,
        },
        orderBy: { revision: "desc" },
      });
      if (
        latest?.status === "APPROVED" &&
        JSON.stringify(latest.submittedRows) === JSON.stringify(submittedRows)
      ) {
        continue;
      }
      await approvalStore.create({
        data: {
          ownerUserId: user.id,
          engagementId,
          projectId,
          year,
          month,
          half,
          revision: (latest?.revision ?? 0) + 1,
          status: "SUBMITTED",
          submittedRows: submittedRows as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async formatApprovalRecord(record: {
    id: string;
    ownerUserId: string;
    engagementId: string;
    projectId: string | null;
    year: number;
    month: number;
    half: "FIRST_HALF" | "SECOND_HALF";
    revision: number;
    status: TmsApprovalStatus;
    submittedRows: Prisma.JsonValue;
    submittedAt: Date | null;
    reviewedById: string | null;
    reviewedAt: Date | null;
    returnReason: string | null;
  }): Promise<TmsApprovalRecord> {
    const [owner, engagement, project] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: record.ownerUserId },
        select: { name: true, email: true },
      }),
      this.prisma.cmpEngagement.findUnique({
        where: { id: record.engagementId },
        select: {
          engagementCode: true,
          client: { select: { clientCode: true, nameEn: true, nameZh: true } },
        },
      }),
      record.projectId
        ? this.prisma.project.findUnique({
            where: { id: record.projectId },
            select: { id: true, projectCode: true, name: true },
          })
        : Promise.resolve(null),
    ]);
    return TmsApprovalRecordSchema.parse({
      id: record.id,
      ownerUserId: record.ownerUserId,
      ownerName: owner?.name ?? record.ownerUserId,
      ownerEmail: owner?.email ?? `${record.ownerUserId}@projectwing.local`,
      year: record.year,
      month: record.month,
      half: record.half,
      engagementId: record.engagementId,
      engagementCode: engagement?.engagementCode ?? record.engagementId,
      projectId: project?.id ?? record.projectId,
      projectCode: project?.projectCode ?? null,
      projectName: project?.name ?? null,
      clientCode: engagement?.client.clientCode ?? record.engagementId,
      clientName: engagement
        ? engagement.client.nameEn ||
          engagement.client.nameZh ||
          engagement.client.clientCode
        : record.engagementId,
      revision: record.revision,
      status: record.status,
      submittedRows: record.submittedRows as TmsTimesheetRow[],
      submittedAt: record.submittedAt?.toISOString() ?? null,
      reviewedById: record.reviewedById,
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
      returnReason: record.returnReason,
    });
  }

  async approve(
    actor: RequestUser,
    ownerUserId: string,
    year: number,
    month: number,
    half: TmsTimesheetHalf,
    input: TmsApproveInput
  ): Promise<TmsTimesheetMonth> {
    this.assertApprovalRole(actor);
    const current = await this.prisma.tmsTimesheetMonth.findUnique({
      where: { userId_year_month: { userId: ownerUserId, year, month } },
    });
    const prefix = half === "FIRST_HALF" ? "first" : "second";
    const revision = Number(
      current?.[
        `${prefix}SubmittedRevision` as keyof NonNullable<StoredMonth>
      ] ?? 0
    );
    if (!current || revision === 0) {
      throw new ApiConflictException(
        "TIMESHEET_SUBMISSION_NOT_FOUND",
        "该半月尚未提交"
      );
    }
    if (revision !== input.expectedSubmittedRevision) {
      throw new ApiConflictException(
        "TIMESHEET_REVISION_CONFLICT",
        "提交版本已更新，请刷新后审批"
      );
    }
    if (current[`${prefix}Status` as keyof typeof current] === "APPROVED") {
      return this.toResponse(
        current,
        year,
        month,
        await this.getOwnerApprovalState(ownerUserId, year, month)
      );
    }
    const saved = await this.prisma.tmsTimesheetMonth.update({
      where: { id: current.id },
      data: {
        [`${prefix}Status`]: "APPROVED",
        [`${prefix}ApprovedById`]: actor.id,
        [`${prefix}ApprovedAt`]: new Date(),
      },
    });
    return this.toResponse(
      saved,
      year,
      month,
      await this.getOwnerApprovalState(ownerUserId, year, month)
    );
  }

  private async getOwnerApprovalState(
    ownerUserId: string,
    year: number,
    month: number
  ): Promise<OwnerApprovalState> {
    const approvalStore = this.getApprovalStore();
    const pendingLinkStore = this.getPendingLinkStore();
    const statuses = defaultApprovalPeriodStatuses();
    const linkStatuses = defaultLinkStatuses();
    if (!approvalStore && !pendingLinkStore) {
      return { statuses, linkStatuses, locks: [] };
    }

    const records = approvalStore
      ? await approvalStore.findMany({
          where: { ownerUserId, year, month },
          orderBy: { revision: "desc" },
        })
      : [];
    const latest = latestApprovalRecords(records);
    for (const half of ["FIRST_HALF", "SECOND_HALF"] as const) {
      statuses[half] = aggregateApprovalStatus(
        latest.filter((record) => record.half === half)
      );
    }
    if (pendingLinkStore) {
      const pending = await pendingLinkStore.findMany({
        where: { ownerUserId, year, month, status: "PENDING_LINK" },
        select: { half: true },
      });
      for (const record of pending) {
        linkStatuses[record.half] = "PENDING_LINK";
      }
    }

    const locks: TmsApprovalLock[] = [];
    for (const record of latest) {
      const history = records.filter(
        (candidate) =>
          candidate.ownerUserId === record.ownerUserId &&
          candidate.engagementId === record.engagementId &&
          candidate.projectId === record.projectId &&
          candidate.half === record.half
      );
      const approvedRecord = history.find(
        (candidate) => candidate.status === "APPROVED"
      );
      const lockSource =
        record.status === "APPROVED"
          ? record
          : record.status === "SUBMITTED"
            ? approvedRecord
            : null;
      locks.push({
        engagementId: record.engagementId,
        projectId: record.projectId,
        half: record.half,
        status: record.status,
        lockAll: record.status === "PENDING_CONFIRMATION",
        lockedCells: lockSource
          ? approvalCells(lockSource.submittedRows as TmsTimesheetRow[])
          : [],
        modifiedCells: lockSource
          ? modifiedApprovalCells(lockSource.submittedRows as TmsTimesheetRow[])
          : [],
        returnedCells:
          record.status === "RETURNED"
            ? approvalCells(record.submittedRows as TmsTimesheetRow[])
            : [],
        returnReason: record.status === "RETURNED" ? record.returnReason : null,
      });
    }
    return { statuses, linkStatuses, locks };
  }

  private toResponse(
    value: StoredMonth,
    year: number,
    month: number,
    approvalState?: OwnerApprovalState
  ): TmsTimesheetMonth {
    const firstStatus = value?.firstStatus ?? "DRAFT";
    const secondStatus = value?.secondStatus ?? "DRAFT";
    const firstApprovalStatus = effectiveApprovalStatus(
      approvalState?.statuses.FIRST_HALF,
      firstStatus
    );
    const secondApprovalStatus = effectiveApprovalStatus(
      approvalState?.statuses.SECOND_HALF,
      secondStatus
    );
    return {
      year,
      month,
      rows: (value?.draftRows ?? []) as TmsTimesheetRow[],
      persistence: "SERVER",
      approvalLocks: approvalState?.locks,
      periods: {
        FIRST_HALF: {
          status: firstStatus,
          revision: value?.firstSubmittedRevision ?? 0,
          editable: firstStatus !== "APPROVED",
          approvalStatus: firstApprovalStatus,
          linkStatus: approvalState?.linkStatuses.FIRST_HALF ?? "LINKED",
        },
        SECOND_HALF: {
          status: secondStatus,
          revision: value?.secondSubmittedRevision ?? 0,
          editable: secondStatus !== "APPROVED",
          approvalStatus: secondApprovalStatus,
          linkStatus: approvalState?.linkStatuses.SECOND_HALF ?? "LINKED",
        },
      },
    };
  }
}

function buildOverviewDays(
  year: number,
  month: number,
  period: TmsOverviewPeriod
) {
  const days: { date: string; isWorkday: boolean }[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  while (cursor.getUTCMonth() === month - 1) {
    const dayOfMonth = cursor.getUTCDate();
    if (
      period === "all" ||
      (period === "first" && dayOfMonth <= 15) ||
      (period === "second" && dayOfMonth >= 16)
    ) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
      const weekday = cursor.getUTCDay();
      days.push({ date, isWorkday: weekday !== 0 && weekday !== 6 });
    }
    cursor.setUTCDate(dayOfMonth + 1);
  }
  return days;
}

function calculateOverviewDay(
  rows: TmsTimesheetRow[],
  day: { date: string; isWorkday: boolean }
): TmsOverviewDay {
  let isPublicHoliday = false;
  let leave = 0;
  let normal = 0;
  let ot = 0;
  for (const row of rows) {
    const hours = row.hoursByDate[day.date] ?? 0;
    if (row.type === "Chargeable" && getStoredRowWorkType(row) === "Absent") {
      continue;
    }
    if (row.type === "Leave") {
      leave += hours;
      normal += hours;
      if (row.details === "Public Holiday" && hours > 0) {
        isPublicHoliday = true;
      }
    } else if (getStoredRowWorkType(row) === "OT") {
      ot += hours;
    } else {
      normal += hours;
    }
  }
  const total = normal + ot;
  const isHoliday = !day.isWorkday || isPublicHoliday;
  const state =
    normal > TMS_NORMAL_DAILY_HOURS_MAX || total > 24
      ? "ERROR"
      : day.isWorkday && !isHoliday && (total < 8 || total > 12)
        ? "WARNING"
        : "OK";
  return { ...day, isHoliday, normal, ot, leave, total, state };
}

function overviewStatus(
  month: { firstStatus: string; secondStatus: string } | null | undefined,
  period: TmsOverviewPeriod
): "DRAFT" | "SUBMITTED" | "APPROVED" {
  const statuses =
    period === "all"
      ? [month?.firstStatus, month?.secondStatus]
      : [period === "first" ? month?.firstStatus : month?.secondStatus];
  if (statuses.every((status) => status === "APPROVED")) {
    return "APPROVED";
  }
  if (statuses.some((status) => status === "SUBMITTED")) {
    return "SUBMITTED";
  }
  return "DRAFT";
}

function readTimesheetRows(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? (value as TmsTimesheetRow[]) : [];
}

function parseTimesheetRows(value: unknown): TmsTimesheetRow[] {
  const result = TmsSaveDraftInputSchema.safeParse({ rows: value });
  if (!result.success) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      result.error.issues[0]?.message ?? "工时数据无效"
    );
  }
  return result.data.rows;
}

function validateTimesheetRows(
  value: unknown,
  baselineRows?: TmsTimesheetRow[]
): TmsTimesheetRow[] {
  const rows = parseTimesheetRows(value);
  const baselineById = new Map(
    (baselineRows ?? []).map((row) => [row.id, row])
  );
  for (const row of rows) {
    const workType = getStoredRowWorkType(row);
    for (const [date, hours] of Object.entries(row.hoursByDate)) {
      const baselineHours = baselineById.get(row.id)?.hoursByDate[date] ?? 0;
      if (
        workType === "Normal" &&
        hours > TMS_NORMAL_DAILY_HOURS_MAX &&
        hours > baselineHours
      ) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          `${TMS_NORMAL_DAILY_HOURS_ERROR_MESSAGE}（${date}）`
        );
      }
    }
  }
  const dailyTotals = getTimesheetDailyTotals(rows);
  const baselineDailyTotals = getTimesheetDailyTotals(baselineRows ?? []);
  for (const [date, totals] of dailyTotals) {
    const baselineTotals = baselineDailyTotals.get(date);
    if (
      totals.regular > TMS_NORMAL_DAILY_HOURS_MAX &&
      totals.regular > (baselineTotals?.regular ?? 0)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `${date} Normal + Leave 不能超过 8 小时，请将超出部分记入 OT`
      );
    }
    if (totals.total > 24 && totals.total > (baselineTotals?.total ?? 0)) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `${date} 工时不能超过 24 小时`
      );
    }
  }
  return rows;
}

function getTimesheetDailyTotals(rows: TmsTimesheetRow[]) {
  const dailyTotals = new Map<string, { regular: number; total: number }>();
  for (const row of rows) {
    const workType = getStoredRowWorkType(row);
    for (const [date, hours] of Object.entries(row.hoursByDate)) {
      const current = dailyTotals.get(date) ?? { regular: 0, total: 0 };
      if (!(row.type === "Chargeable" && workType === "Absent")) {
        current.total += hours;
        if (workType !== "OT") {
          current.regular += hours;
        }
      }
      dailyTotals.set(date, current);
    }
  }
  return dailyTotals;
}

function getStoredRowWorkType(row: TmsTimesheetRow) {
  if (row.type === "Leave") {
    return "Normal";
  }
  if (row.workType) {
    return row.workType;
  }
  if (
    row.type === "Chargeable" &&
    (row.details === "Normal" ||
      row.details === "OT" ||
      row.details === "Absent")
  ) {
    return row.details;
  }
  return "Normal";
}

function submitHalves(scope: TmsSubmitInput["scope"]): TmsTimesheetHalf[] {
  return scope === "ALL" ? ["FIRST_HALF", "SECOND_HALF"] : [scope];
}

function getRowEngagementId(row: TmsTimesheetRow) {
  const value = (row as TmsTimesheetRow & { engagementId?: unknown })
    .engagementId;
  if (typeof value !== "string" || !value) {
    return null;
  }
  return value.startsWith("unlinked:") ? null : value;
}

function getRowProjectId(row: TmsTimesheetRow) {
  const value = (row as TmsTimesheetRow & { projectId?: unknown }).projectId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRowEngagementCode(row: TmsTimesheetRow) {
  const value = (row as TmsTimesheetRow & { engagementCode?: unknown })
    .engagementCode;
  return typeof value === "string" ? value.trim() : "";
}

function projectLinkLabel(row: TmsTimesheetRow) {
  const { clientName } = row as TmsTimesheetRow & { clientName?: unknown };
  return (
    row.description.trim() ||
    getRowEngagementCode(row) ||
    (typeof clientName === "string" ? clientName.trim() : "") ||
    row.id
  );
}

function shouldAssignPendingTmsCode(row: TmsTimesheetRow) {
  return (
    row.source === "TMS_PENDING" ||
    (!getRowEngagementCode(row) && !getRowEngagementId(row))
  );
}

function formatTmsProjectCode(
  referenceNumber: number | null | undefined,
  id: string
) {
  if (typeof referenceNumber === "number" && referenceNumber > 0) {
    return `DUMMY-TMS-${String(referenceNumber).padStart(6, "0")}`;
  }
  return `DUMMY-TMS-${id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

function normalizeSubmissionCode(value: string) {
  return value.trim().toLocaleUpperCase("en-US");
}

function rowsForHalf(
  value: unknown,
  half: TmsTimesheetHalf,
  year: number,
  month: number
) {
  if (!Array.isArray(value)) {
    return [];
  }
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return (value as TmsTimesheetRow[])
    .map((row) => ({
      ...row,
      hoursByDate: Object.fromEntries(
        Object.entries(row.hoursByDate)
          .filter(([date]) => {
            if (!date.startsWith(prefix)) {
              return false;
            }
            const day = Number(date.slice(-2));
            return half === "FIRST_HALF" ? day <= 15 : day >= 16;
          })
          .sort(([left], [right]) => left.localeCompare(right))
      ),
    }))
    .filter(
      (row) =>
        Object.keys(row.hoursByDate).length > 0 ||
        row.periodScope === "all" ||
        (half === "FIRST_HALF" && row.periodScope === "first") ||
        (half === "SECOND_HALF" && row.periodScope === "second")
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

function defaultLinkStatuses(): Record<TmsTimesheetHalf, TmsLinkStatus> {
  return {
    FIRST_HALF: "LINKED",
    SECOND_HALF: "LINKED",
  };
}

function groupPendingLinkRows(rows: TmsTimesheetRow[]) {
  const groups = new Map<string, TmsTimesheetRow[]>();
  for (const row of rows) {
    const projectId = row.type === "Chargeable" ? getRowProjectId(row) : null;
    if (row.type !== "Chargeable" || getRowEngagementId(row) || !projectId) {
      continue;
    }
    const existing = groups.get(projectId) ?? [];
    existing.push(row);
    groups.set(projectId, existing);
  }
  return groups;
}

function latestPendingLinkSubmissions<
  T extends {
    ownerUserId: string;
    projectId: string;
    year: number;
    month: number;
    half: TmsTimesheetHalf;
    revision: number;
  },
>(records: T[]) {
  const latest = new Map<string, T>();
  for (const record of records) {
    const key = `${record.ownerUserId}:${record.projectId}:${record.year}:${record.month}:${record.half}`;
    const current = latest.get(key);
    if (!current || record.revision > current.revision) {
      latest.set(key, record);
    }
  }
  return [...latest.values()];
}

function mergeRowsById(value: unknown, replacements: TmsTimesheetRow[]) {
  const existing = Array.isArray(value) ? (value as TmsTimesheetRow[]) : [];
  const replacementById = new Map(replacements.map((row) => [row.id, row]));
  const existingIds = new Set<string>();
  const merged = existing.map((row) => {
    const replacement = replacementById.get(row.id);
    if (!replacement) {
      return row;
    }
    existingIds.add(row.id);
    return { ...row, ...replacement };
  });
  return [...merged, ...replacements.filter((row) => !existingIds.has(row.id))];
}

function mergeRowMetadataById(value: unknown, replacements: TmsTimesheetRow[]) {
  const existing = Array.isArray(value) ? (value as TmsTimesheetRow[]) : [];
  const replacementById = new Map(replacements.map((row) => [row.id, row]));
  return existing.map((row) => {
    const replacement = replacementById.get(row.id);
    return replacement
      ? {
          ...row,
          ...replacement,
          hoursByDate: row.hoursByDate,
          periodTotal: row.periodTotal,
        }
      : row;
  });
}

function groupChargeableRows(rows: TmsTimesheetRow[]) {
  const groups = new Map<
    string,
    { engagementId: string; projectId: string; rows: TmsTimesheetRow[] }
  >();
  for (const row of rows) {
    if (row.type !== "Chargeable") {
      continue;
    }
    const engagementId = getRowEngagementId(row);
    const projectId = getRowProjectId(row);
    if (!engagementId || !projectId) {
      continue;
    }
    const key = `${engagementId}:${projectId}`;
    const group = groups.get(key) ?? { engagementId, projectId, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return groups;
}

function rowsForEngagement(
  value: unknown,
  engagementId: string,
  projectId: string | null,
  half: TmsTimesheetHalf,
  year: number,
  month: number
) {
  return rowsForHalf(value, half, year, month).filter(
    (row) =>
      row.type === "Chargeable" &&
      getRowEngagementId(row) === engagementId &&
      (!projectId || getRowProjectId(row) === projectId)
  );
}

function replaceApprovalRows(
  value: unknown,
  engagementId: string,
  projectId: string | null,
  half: TmsTimesheetHalf,
  year: number,
  month: number,
  replacement: TmsTimesheetRow[]
) {
  const existing = Array.isArray(value) ? (value as TmsTimesheetRow[]) : [];
  const replacementById = new Map(replacement.map((row) => [row.id, row]));
  const existingIds = new Set<string>();
  const next = existing.flatMap((row) => {
    if (
      row.type !== "Chargeable" ||
      getRowEngagementId(row) !== engagementId ||
      (projectId && getRowProjectId(row) !== projectId)
    ) {
      return [row];
    }
    existingIds.add(row.id);
    const nextRow = replacementById.get(row.id);
    const outsideHours = Object.fromEntries(
      Object.entries(row.hoursByDate).filter(([date]) =>
        isOutsideHalf(date, half, year, month)
      )
    );
    if (!nextRow) {
      return Object.keys(outsideHours).length > 0
        ? [
            {
              ...row,
              hoursByDate: outsideHours,
              periodTotal: sumRowHours(outsideHours),
            },
          ]
        : [];
    }
    const hoursByDate = { ...outsideHours, ...nextRow.hoursByDate };
    return [
      {
        ...row,
        ...nextRow,
        hoursByDate,
        periodTotal: sumRowHours(hoursByDate),
      },
    ];
  });
  return [...next, ...replacement.filter((row) => !existingIds.has(row.id))];
}

function isOutsideHalf(
  date: string,
  half: TmsTimesheetHalf,
  year: number,
  month: number
) {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  if (!date.startsWith(prefix)) {
    return true;
  }
  const day = Number(date.slice(-2));
  return half === "FIRST_HALF" ? day > 15 : day < 16;
}

function sumRowHours(hoursByDate: Record<string, number>) {
  return Object.values(hoursByDate).reduce((total, hours) => total + hours, 0);
}

function validateApprovalEditRows(
  currentRows: TmsTimesheetRow[],
  inputRows: TmsTimesheetRow[],
  engagementId: string,
  projectId: string | null,
  half: TmsTimesheetHalf,
  year: number,
  month: number
) {
  if (
    inputRows.length < currentRows.length ||
    inputRows.length > currentRows.length + 1
  ) {
    throw new ApiConflictException(
      "TIMESHEET_REVISION_CONFLICT",
      "审批快照的工时行已变化，请刷新后再保存"
    );
  }

  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  const normalTemplate = currentRows.find(
    (row) =>
      row.type === "Chargeable" &&
      getRowEngagementId(row) === engagementId &&
      (!projectId || getRowProjectId(row) === projectId) &&
      (row.workType ?? row.details) === "Normal"
  );
  const seen = new Set<string>();
  return inputRows.map((inputRow) => {
    const currentRow = currentById.get(inputRow.id);
    if (seen.has(inputRow.id)) {
      throw new ApiConflictException(
        "TIMESHEET_REVISION_CONFLICT",
        "审批快照的工时行已变化，请刷新后再保存"
      );
    }
    if (!currentRow) {
      const isAllowedOtRow =
        normalTemplate &&
        inputRow.id === buildTmsApprovalOtRowId(normalTemplate.id) &&
        inputRow.type === "Chargeable" &&
        getRowEngagementId(inputRow) === engagementId &&
        (!projectId || getRowProjectId(inputRow) === projectId) &&
        (inputRow.workType ?? inputRow.details) === "OT" &&
        inputRow.periodScope === normalTemplate.periodScope &&
        inputRow.description === normalTemplate.description &&
        Object.keys(inputRow.hoursByDate).every(
          (date) => !isOutsideHalf(date, half, year, month)
        );
      if (!isAllowedOtRow) {
        throw new ApiConflictException(
          "TIMESHEET_REVISION_CONFLICT",
          "审批快照的工时行已变化，请刷新后再保存"
        );
      }
      seen.add(inputRow.id);
      const hoursByDate = { ...inputRow.hoursByDate };
      return {
        ...inputRow,
        approvalOriginalHoursByDate: {},
        hoursByDate,
        periodTotal: sumRowHours(hoursByDate),
      };
    }
    const currentEngagementId = getRowEngagementId(currentRow);
    const inputEngagementId = getRowEngagementId(inputRow);
    const currentProjectId = getRowProjectId(currentRow);
    const inputProjectId = getRowProjectId(inputRow);
    const hoursChanged = !approvalRowsHoursEqual([currentRow], [inputRow]);
    if (
      currentEngagementId !== inputEngagementId ||
      currentProjectId !== inputProjectId ||
      (hoursChanged &&
        (currentEngagementId !== engagementId ||
          (projectId && currentProjectId !== projectId))) ||
      currentRow.type !== inputRow.type ||
      currentRow.details !== inputRow.details ||
      currentRow.periodScope !== inputRow.periodScope ||
      (currentEngagementId === engagementId &&
        (!projectId || currentProjectId === projectId) &&
        Object.keys(inputRow.hoursByDate).some((date) =>
          isOutsideHalf(date, half, year, month)
        ))
    ) {
      throw new ApiConflictException(
        "TIMESHEET_REVISION_CONFLICT",
        "只能修改当前项目当前半月的工时"
      );
    }
    seen.add(inputRow.id);
    const hoursByDate = { ...inputRow.hoursByDate };
    return {
      ...currentRow,
      ...(currentEngagementId === engagementId &&
      (!projectId || currentProjectId === projectId)
        ? {
            approvalOriginalHoursByDate:
              currentRow.approvalOriginalHoursByDate ?? {
                ...currentRow.hoursByDate,
              },
          }
        : {}),
      hoursByDate,
      periodTotal: sumRowHours(hoursByDate),
    };
  });
}

function approvedNonZeroHoursUnchanged(
  approvedRows: TmsTimesheetRow[],
  afterRows: TmsTimesheetRow[]
) {
  const afterById = new Map(afterRows.map((row) => [row.id, row]));
  for (const approvedRow of approvedRows) {
    const afterRow = afterById.get(approvedRow.id);
    for (const [date, hours] of Object.entries(approvedRow.hoursByDate)) {
      if (hours > 0 && Number(afterRow?.hoursByDate[date] ?? 0) !== hours) {
        return false;
      }
    }
  }
  return true;
}

function defaultApprovalPeriodStatuses(): ApprovalPeriodStatuses {
  return {
    FIRST_HALF: "NOT_SUBMITTED",
    SECOND_HALF: "NOT_SUBMITTED",
  };
}

function aggregateApprovalStatus(
  records: { status: TmsApprovalStatus }[]
): TmsApprovalStatus {
  for (const status of [
    "PENDING_CONFIRMATION",
    "SUBMITTED",
    "RETURNED",
    "APPROVED",
  ] as const) {
    if (records.some((record) => record.status === status)) {
      return status;
    }
  }
  return "NOT_SUBMITTED";
}

function legacyApprovalStatus(status: string): TmsApprovalStatus {
  if (status === "APPROVED") {
    return "APPROVED";
  }
  if (status === "SUBMITTED") {
    return "SUBMITTED";
  }
  return "NOT_SUBMITTED";
}

function effectiveApprovalStatus(
  approvalStatus: TmsApprovalStatus | undefined,
  periodStatus: string
) {
  if (approvalStatus && approvalStatus !== "NOT_SUBMITTED") {
    return approvalStatus;
  }
  return legacyApprovalStatus(periodStatus);
}

function approvalCells(rows: TmsTimesheetRow[]) {
  return rows.flatMap((row) =>
    Object.entries(row.hoursByDate)
      .filter(([, hours]) => hours > 0)
      .map(([date]) => ({ rowId: row.id, date }))
  );
}

function modifiedApprovalCells(rows: TmsTimesheetRow[]) {
  return rows.flatMap((row) => {
    const original = row.approvalOriginalHoursByDate;
    if (!original) {
      return [];
    }
    return Object.entries(row.hoursByDate)
      .filter(
        ([date, hours]) =>
          hours > 0 && Number(original[date] ?? 0) !== Number(hours)
      )
      .map(([date]) => ({ rowId: row.id, date }));
  });
}

function approvalRowsHoursEqual(
  before: TmsTimesheetRow[],
  after: TmsTimesheetRow[]
) {
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const afterById = new Map(after.map((row) => [row.id, row]));
  const rowIds = new Set([...beforeById.keys(), ...afterById.keys()]);

  for (const rowId of rowIds) {
    const beforeHours = beforeById.get(rowId)?.hoursByDate ?? {};
    const afterHours = afterById.get(rowId)?.hoursByDate ?? {};
    const dates = new Set([
      ...Object.keys(beforeHours),
      ...Object.keys(afterHours),
    ]);
    for (const date of dates) {
      if (Number(beforeHours[date] ?? 0) !== Number(afterHours[date] ?? 0)) {
        return false;
      }
    }
  }
  return true;
}

function latestApprovalRecords<
  T extends {
    ownerUserId: string;
    engagementId: string;
    projectId?: string | null;
    year?: number;
    month?: number;
    half: string;
    revision: number;
  },
>(records: T[]) {
  const latest = new Map<string, T>();
  for (const record of records) {
    const period =
      record.year === undefined || record.month === undefined
        ? ""
        : `:${record.year}:${record.month}`;
    const project = record.projectId ? `:${record.projectId}` : ":legacy";
    const key = `${record.ownerUserId}:${record.engagementId}${project}${period}:${record.half}`;
    if (!latest.has(key)) {
      latest.set(key, record);
    }
  }
  return [...latest.values()];
}
