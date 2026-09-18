import { randomUUID } from "node:crypto";
import { inspect } from "node:util";

import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { XLSX } from "../common/xlsx";

import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ProjectAccessService } from "./project-access.service";

export type ArchiveCheckSeverity = "BLOCKER" | "WARNING";

export type ArchiveCheckIssueType =
  | "MISSING_PREPARER_SIGNOFF"
  | "MISSING_REVIEWER_SIGNOFF"
  | "REVIEW_SIGNOFF_BEFORE_PREPARER"
  | "SELF_REVIEWED_WORKING_PAPER"
  | "OPEN_REVIEW_QUESTION"
  | "LOCKED_ATTACHMENT"
  | "SMART_FORM_INCOMPLETE"
  | "DOCX_TRACK_CHANGES"
  | "DOCX_UNRESOLVED_COMMENT"
  | "XLSX_UNRESOLVED_COMMENT"
  | "XLSX_ERROR_VALUE"
  | "OFFICE_FILE_CHECK_FAILED";

export type ArchiveCheckId =
  | "SIGNOFF_MISSING"
  | "SIGNOFF_DATE_ORDER"
  | "SELF_REVIEW"
  | "OPEN_REVIEW_QUESTIONS"
  | "MASTER_LOCKS"
  | "SMART_FORMS"
  | "WORD_ISSUES"
  | "EXCEL_COMMENTS"
  | "EXCEL_ERROR_VALUES"
  | "OFFICE_INSPECTION";

export type ArchiveCheckStatus = "PASSED" | "WARNING" | "BLOCKER" | "FAILED";

export type ArchiveCheckGroup = {
  id: ArchiveCheckId;
  name: string;
  status: ArchiveCheckStatus;
  severity?: ArchiveCheckSeverity;
  counts: {
    issues: number;
    blockers: number;
    warnings: number;
  };
  issues: ArchiveCheckIssue[];
};

export type ArchiveCheckIssueAction = {
  type:
    | "OPEN_WORKING_PAPER"
    | "OPEN_SIGNOFF"
    | "OPEN_REVIEW_QUESTION"
    | "OPEN_ATTACHMENT";
  workingPaperId?: string;
  reviewQuestionId?: string;
  attachmentId?: string;
};

export type ArchiveCheckIssueLocation = {
  attachmentId?: string;
  attachmentName?: string;
  projectPath?: string;
  sheetName?: string;
  cellAddress?: string;
  value?: string;
  part?: string;
  excerpt?: string;
  commentAuthor?: string;
};

export type ArchiveCheckIssue = {
  type: ArchiveCheckIssueType;
  severity: ArchiveCheckSeverity;
  message: string;
  workingPaper?: {
    id: string;
    code: string;
    title: string;
  };
  reviewQuestion?: {
    id: string;
    status: string;
    assignedTo?: { id: string; name: string; email: string } | null;
  };
  attachment?: {
    id: string;
    name: string;
    lockedBy?: { id: string; name: string; email: string } | null;
    lockedAt?: Date | null;
  };
  member?: { id: string; name: string; email: string } | null;
  location?: ArchiveCheckIssueLocation;
  action?: ArchiveCheckIssueAction;
};

export type ArchiveCheckSummary = {
  attachments: number;
  blockers: number;
  warnings: number;
  missingPreparerSignoffs: number;
  missingReviewerSignoffs: number;
  signoffDateIssues: number;
  unresolvedReviewQuestions: number;
  lockedAttachments: number;
  incompleteSmartForms: number;
  selfReviewedAttachments: number;
  officeFileIssues: number;
};

export type ArchiveCheckReport = {
  project: {
    id: string;
    projectCode: string;
    name: string;
  };
  generatedAt: Date;
  ready: boolean;
  summary: ArchiveCheckSummary;
  checks: ArchiveCheckGroup[];
  issues: ArchiveCheckIssue[];
};

export type ArchiveCheckProgressGroupId =
  | "signoffs"
  | "reviewQuestions"
  | "workpaperFiles"
  | "officeFiles"
  | "finalizing";

export type ArchiveCheckProgressGroupStatus =
  | "pending"
  | "running"
  | "completed";

export type ArchiveCheckProgressGroup = {
  id: ArchiveCheckProgressGroupId;
  label: string;
  completedUnits: number;
  totalUnits: number;
  status: ArchiveCheckProgressGroupStatus;
};

export type ArchiveCheckProgressSnapshot = {
  completedUnits: number;
  totalUnits: number;
  groups: ArchiveCheckProgressGroup[];
};

export type ArchiveCheckJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type ArchiveCheckJobSnapshot = {
  jobId: string;
  projectId: string;
  status: ArchiveCheckJobStatus;
  currentPhase: ArchiveCheckProgressGroupId;
  currentLabel?: string;
  progress: ArchiveCheckProgressSnapshot;
  report?: ArchiveCheckReport;
  error?: { message: string };
  createdAt: Date;
  updatedAt: Date;
};

type ArchiveCheckWorkingPaper = {
  id: string;
  code: string;
  title: string;
  projectPath?: string;
};

type ArchiveCheckWorkflowNode = {
  id: string;
  parentId: string | null;
  code: string;
  title: string;
};

type ArchiveCheckAttachment = {
  id: string;
  bucket?: string | null;
  deletedAt?: Date | null;
  originalName: string | null;
  fileName: string;
  fileUrl?: string | null;
  mimeType?: string | null;
  fileKind?: string | null;
  smartFormInstance?: { status: string } | null;
};

type ArchiveCheckReviewQuestion = {
  id: string;
  attachmentId?: string | null;
  status: string;
  assignedTo?: { id: string; name: string; email: string } | null;
};

type OfficePackage = ReturnType<typeof XLSX.CFB.read>;

type ArchiveCheckProgressReporter = {
  initialize: (totals: Record<ArchiveCheckProgressGroupId, number>) => void;
  start: (groupId: ArchiveCheckProgressGroupId, label?: string) => void;
  completeUnit: (groupId: ArchiveCheckProgressGroupId, label?: string) => void;
};

const EXCEL_ERROR_VALUES = new Set([
  "#NULL!",
  "#DIV/0!",
  "#VALUE!",
  "#REF!",
  "#NAME?",
  "#NUM!",
  "#N/A",
  "#GETTING_DATA",
  "#SPILL!",
  "#CALC!",
  "#FIELD!",
  "#BLOCKED!",
  "#UNKNOWN!",
  "#CONNECT!",
]);
const ARCHIVE_CHECK_JOB_TTL_MS = 15 * 60 * 1000;
const ARCHIVE_CHECK_PROGRESS_GROUPS: {
  id: ArchiveCheckProgressGroupId;
  label: string;
}[] = [
  { id: "signoffs", label: "Sign-off checks" },
  { id: "reviewQuestions", label: "Review question checks" },
  { id: "workpaperFiles", label: "Attachment file checks" },
  { id: "officeFiles", label: "Office document checks" },
  { id: "finalizing", label: "Finalizing report" },
];

@Injectable()
export class ArchiveCheckService {
  private readonly jobs = new Map<string, ArchiveCheckJobSnapshot>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    @Optional() private readonly storage?: StorageService
  ) {}

  async report(projectId: string, user: RequestUser) {
    if (user.globalRole !== "SUPER_ADMIN") {
      await this.access.requireProjectMember(projectId, user.id);
    }
    return this.buildReport(projectId, undefined, { includeArchived: true });
  }

  async exportReportPdf(projectId: string, user: RequestUser) {
    if (user.globalRole !== "SUPER_ADMIN") {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const report = await this.buildReport(projectId, undefined, {
      includeArchived: true,
    });
    return {
      fileName: `${sanitizeDownloadFileName(report.project.projectCode)}-file-check.pdf`,
      mimeType: "application/pdf",
      buffer: this.renderReportPdf(report),
    };
  }

  renderReportPdf(report: ArchiveCheckReport) {
    return createArchiveCheckPdf(report);
  }

  async startJob(
    projectId: string,
    user: RequestUser
  ): Promise<ArchiveCheckJobSnapshot> {
    if (user.globalRole !== "SUPER_ADMIN") {
      await this.access.requireProjectMember(projectId, user.id);
    }
    this.cleanupJobs();

    const now = new Date();
    const job: ArchiveCheckJobSnapshot = {
      jobId: randomUUID(),
      projectId,
      status: "queued",
      currentPhase: "signoffs",
      progress: createProgressSnapshot(),
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.jobId, job);
    void this.runJob(job.jobId, projectId);
    return cloneJob(job);
  }

  async getJob(
    projectId: string,
    jobId: string,
    user: RequestUser
  ): Promise<ArchiveCheckJobSnapshot> {
    if (user.globalRole !== "SUPER_ADMIN") {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const job = this.jobs.get(jobId);
    if (!job || job.projectId !== projectId) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Archive File Check job was not found"
      );
    }
    return cloneJob(job);
  }

  async assertReadyForArchive(projectId: string) {
    const report = await this.buildReport(projectId, undefined, {
      includeArchived: false,
    });
    if (!report.ready) {
      throw new ApiBadRequestException(
        "ARCHIVE_CHECK_FAILED",
        `Archive File Check failed with ${report.summary.blockers} blocker(s)`
      );
    }
    return report;
  }

  private async buildReport(
    projectId: string,
    progress?: ArchiveCheckProgressReporter,
    options: { includeArchived?: boolean } = {}
  ): Promise<ArchiveCheckReport> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        status: options.includeArchived
          ? { in: ["ACTIVE", "PENDING_FINAL_CHECK", "ARCHIVED"] }
          : { in: ["ACTIVE", "PENDING_FINAL_CHECK"] },
      },
      select: { id: true, projectCode: true, name: true },
    });
    if (!project) {
      throw new ApiNotFoundException(
        "PROJECT_NOT_FOUND",
        options.includeArchived
          ? "Project does not exist"
          : "Project does not exist or is not active"
      );
    }

    const [workflowNodes, papers] = await Promise.all([
      this.prisma.workflowNode.findMany({
        where: { projectId },
        select: { id: true, parentId: true, code: true, title: true },
      }),
      this.prisma.workingPaper.findMany({
        where: { projectId, bucket: "CURRENT" },
        orderBy: [{ code: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          code: true,
          title: true,
          workflowNodeId: true,
          signoffs: {
            where: { isCurrent: true, revokedAt: null },
            orderBy: { signedAt: "desc" },
            select: {
              id: true,
              attachmentId: true,
              userId: true,
              type: true,
              signedAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          reviewQuestions: {
            where: { status: { not: "CLEARED" } },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              attachmentId: true,
              status: true,
              assignedTo: { select: { id: true, name: true, email: true } },
            },
          },
          attachments: {
            where: { bucket: "CURRENT", deletedAt: null },
            orderBy: [{ fileKind: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              bucket: true,
              deletedAt: true,
              originalName: true,
              fileName: true,
              fileUrl: true,
              mimeType: true,
              fileKind: true,
              lockedBy: true,
              lockedAt: true,
              lockHolder: { select: { id: true, name: true, email: true } },
              smartFormInstance: { select: { status: true } },
            },
          },
        },
      }),
    ]);
    const workflowNodeMap = new Map(
      workflowNodes.map((node) => [node.id, node] as const)
    );

    progress?.initialize(calculateProgressTotals(papers));

    const issues: ArchiveCheckIssue[] = [];
    let checkedAttachmentCount = 0;
    for (const paper of papers) {
      const workingPaper = {
        id: paper.id,
        code: paper.code,
        title: paper.title,
        projectPath: formatWorkingPaperProjectPath(
          paper.workflowNodeId,
          paper.code,
          workflowNodeMap
        ),
      };
      const attachments = paper.attachments.filter(isCurrentAttachment);
      checkedAttachmentCount += attachments.length;
      const attachmentIds = new Set(
        attachments.map((attachment) => attachment.id)
      );
      const questionsByAttachment = groupQuestionsByAttachment(
        paper.reviewQuestions,
        attachmentIds
      );

      for (const attachment of attachments) {
        const fileLabel = `${paper.code} ${attachment.originalName ?? attachment.fileName}`;
        const attachmentSummary = {
          id: attachment.id,
          name: attachment.originalName ?? attachment.fileName,
        };
        const attachmentSignoffs = paper.signoffs.filter(
          (signoff) => signoff.attachmentId === attachment.id
        );
        const preparerSignoffs = attachmentSignoffs.filter(
          (signoff) => signoff.type === "PREPARER"
        );
        const reviewerSignoffs = attachmentSignoffs.filter(
          (signoff) => signoff.type === "REVIEWER"
        );
        const latestPreparer = latestSignoff(preparerSignoffs);
        const latestReviewer = latestSignoff(reviewerSignoffs);

        progress?.start("signoffs", `${fileLabel} sign-offs`);
        if (!latestPreparer) {
          issues.push({
            type: "MISSING_PREPARER_SIGNOFF",
            severity: "BLOCKER",
            message: `${fileLabel} has no preparer sign-off`,
            workingPaper,
            attachment: attachmentSummary,
            location: baseAttachmentLocation(attachment, workingPaper),
            action: {
              type: "OPEN_SIGNOFF",
              workingPaperId: paper.id,
              attachmentId: attachment.id,
            },
          });
        }
        if (!latestReviewer) {
          issues.push({
            type: "MISSING_REVIEWER_SIGNOFF",
            severity: "BLOCKER",
            message: `${fileLabel} has no reviewer sign-off`,
            workingPaper,
            attachment: attachmentSummary,
            location: baseAttachmentLocation(attachment, workingPaper),
            action: {
              type: "OPEN_SIGNOFF",
              workingPaperId: paper.id,
              attachmentId: attachment.id,
            },
          });
        }
        if (
          latestPreparer &&
          latestReviewer &&
          latestReviewer.signedAt.getTime() <= latestPreparer.signedAt.getTime()
        ) {
          issues.push({
            type: "REVIEW_SIGNOFF_BEFORE_PREPARER",
            severity: "BLOCKER",
            message: `${fileLabel} reviewer sign-off is not after preparer sign-off`,
            workingPaper,
            attachment: attachmentSummary,
            member: latestReviewer.user,
            location: {
              ...baseAttachmentLocation(attachment, workingPaper),
              excerpt: `Preparer: ${latestPreparer.signedAt.toISOString()}; Reviewer: ${latestReviewer.signedAt.toISOString()}`,
            },
            action: {
              type: "OPEN_SIGNOFF",
              workingPaperId: paper.id,
              attachmentId: attachment.id,
            },
          });
        }

        if (
          latestPreparer &&
          latestReviewer &&
          latestPreparer.userId === latestReviewer.userId
        ) {
          issues.push({
            type: "SELF_REVIEWED_WORKING_PAPER",
            severity: "BLOCKER",
            message: `${fileLabel} was prepared and reviewed by ${latestReviewer.user.name}`,
            workingPaper,
            attachment: attachmentSummary,
            location: baseAttachmentLocation(attachment, workingPaper),
            member: latestReviewer.user,
            action: {
              type: "OPEN_SIGNOFF",
              workingPaperId: paper.id,
              attachmentId: attachment.id,
            },
          });
        }
        progress?.completeUnit("signoffs", `${fileLabel} sign-offs`);

        progress?.start("reviewQuestions", `${fileLabel} review questions`);
        for (const question of questionsByAttachment.get(attachment.id) ?? []) {
          issues.push({
            type: "OPEN_REVIEW_QUESTION",
            severity: "BLOCKER",
            message: `${fileLabel} has an unresolved review question`,
            workingPaper,
            attachment: attachmentSummary,
            location: baseAttachmentLocation(attachment, workingPaper),
            reviewQuestion: {
              id: question.id,
              status: question.status,
              assignedTo: question.assignedTo,
            },
            action: {
              type: "OPEN_REVIEW_QUESTION",
              workingPaperId: paper.id,
              attachmentId: attachment.id,
              reviewQuestionId: question.id,
            },
          });
        }
        progress?.completeUnit(
          "reviewQuestions",
          `${fileLabel} review questions`
        );

        progress?.start("workpaperFiles", fileLabel);
        if (attachment.lockedBy) {
          issues.push({
            type: "LOCKED_ATTACHMENT",
            severity: "BLOCKER",
            message: `${paper.code} has a file currently held by Master`,
            workingPaper,
            attachment: {
              id: attachment.id,
              name: attachment.originalName ?? attachment.fileName,
              lockedBy: attachment.lockHolder,
              lockedAt: attachment.lockedAt,
            },
            location: baseAttachmentLocation(attachment, workingPaper),
            action: {
              type: "OPEN_ATTACHMENT",
              workingPaperId: paper.id,
              attachmentId: attachment.id,
            },
          });
        }
        if (isIncompleteSmartFormAttachment(attachment)) {
          issues.push({
            type: "SMART_FORM_INCOMPLETE",
            severity: "BLOCKER",
            message: `${paper.code} ${attachment.originalName ?? attachment.fileName} is an incomplete Smart Form`,
            workingPaper,
            attachment: {
              id: attachment.id,
              name: attachment.originalName ?? attachment.fileName,
            },
            location: baseAttachmentLocation(attachment, workingPaper),
            action: {
              type: "OPEN_ATTACHMENT",
              workingPaperId: paper.id,
              attachmentId: attachment.id,
            },
          });
        }
        progress?.completeUnit("workpaperFiles", fileLabel);

        if (isInspectableOfficeAttachment(attachment)) {
          progress?.start("officeFiles", fileLabel);
        }
        issues.push(
          ...(await this.inspectOfficeAttachment(workingPaper, attachment))
        );
        if (isInspectableOfficeAttachment(attachment)) {
          progress?.completeUnit("officeFiles", fileLabel);
        }
      }
    }

    progress?.start("finalizing", "Finalizing report");
    const blockers = issues.filter((issue) => issue.severity === "BLOCKER");
    const warnings = issues.filter((issue) => issue.severity === "WARNING");
    const checks = buildArchiveCheckGroups(issues);
    const report = {
      project,
      generatedAt: new Date(),
      ready: blockers.length === 0,
      summary: {
        attachments: checkedAttachmentCount,
        blockers: blockers.length,
        warnings: warnings.length,
        missingPreparerSignoffs: countIssues(
          issues,
          "MISSING_PREPARER_SIGNOFF"
        ),
        missingReviewerSignoffs: countIssues(
          issues,
          "MISSING_REVIEWER_SIGNOFF"
        ),
        signoffDateIssues: countIssues(
          issues,
          "REVIEW_SIGNOFF_BEFORE_PREPARER"
        ),
        unresolvedReviewQuestions: countIssues(issues, "OPEN_REVIEW_QUESTION"),
        lockedAttachments: countIssues(issues, "LOCKED_ATTACHMENT"),
        incompleteSmartForms: countIssues(issues, "SMART_FORM_INCOMPLETE"),
        selfReviewedAttachments: countIssues(
          issues,
          "SELF_REVIEWED_WORKING_PAPER"
        ),
        officeFileIssues: issues.filter(
          (issue) =>
            issue.type === "DOCX_TRACK_CHANGES" ||
            issue.type === "DOCX_UNRESOLVED_COMMENT" ||
            issue.type === "XLSX_UNRESOLVED_COMMENT" ||
            issue.type === "XLSX_ERROR_VALUE" ||
            issue.type === "OFFICE_FILE_CHECK_FAILED"
        ).length,
      },
      checks,
      issues,
    };
    progress?.completeUnit("finalizing", "Finalizing report");
    return report;
  }

  private async inspectOfficeAttachment(
    workingPaper: ArchiveCheckWorkingPaper,
    attachment: ArchiveCheckAttachment
  ): Promise<ArchiveCheckIssue[]> {
    const fileName = attachment.originalName ?? attachment.fileName;
    const lowerName = fileName.toLowerCase();
    if (!lowerName.endsWith(".docx") && !lowerName.endsWith(".xlsx")) {
      return [];
    }
    if (!attachment.fileUrl) {
      return [];
    }

    try {
      const buffer = await this.fileStorage().getObjectBuffer(
        attachment.fileUrl
      );
      if (lowerName.endsWith(".docx")) {
        return inspectDocx(buffer, workingPaper, attachment);
      }
      return await inspectXlsx(buffer, workingPaper, attachment);
    } catch (error) {
      return [
        {
          type: "OFFICE_FILE_CHECK_FAILED",
          severity: "WARNING",
          message: `${workingPaper.code} ${fileName} could not be inspected`,
          workingPaper,
          location: {
            ...baseAttachmentLocation(attachment, workingPaper),
            excerpt: error instanceof Error ? error.message : "Unknown error",
          },
          action: attachmentAction(workingPaper, attachment),
        },
      ];
    }
  }

  private fileStorage() {
    return this.storage ?? new StorageService();
  }

  private async runJob(jobId: string, projectId: string) {
    this.updateJob(jobId, { status: "running" });
    try {
      const report = await this.buildReport(
        projectId,
        this.createProgressReporter(jobId)
      );
      this.updateJob(jobId, {
        status: "completed",
        report,
        currentPhase: "finalizing",
        currentLabel: undefined,
      });
    } catch (error) {
      this.updateJob(jobId, {
        status: "failed",
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
        currentLabel: undefined,
      });
    }
  }

  private createProgressReporter(jobId: string): ArchiveCheckProgressReporter {
    return {
      initialize: (totals) => {
        this.updateJobProgress(jobId, (job) => {
          job.progress = createProgressSnapshot(totals);
          job.currentPhase = "signoffs";
        });
      },
      start: (groupId, label) => {
        this.updateJobProgress(jobId, (job) => {
          job.currentPhase = groupId;
          job.currentLabel = label;
          const group = job.progress.groups.find(
            (candidate) => candidate.id === groupId
          );
          if (group && group.status !== "completed") {
            group.status = group.totalUnits === 0 ? "completed" : "running";
          }
        });
      },
      completeUnit: (groupId, label) => {
        this.updateJobProgress(jobId, (job) => {
          job.currentPhase = groupId;
          job.currentLabel = label;
          const group = job.progress.groups.find(
            (candidate) => candidate.id === groupId
          );
          if (!group) {
            return;
          }
          group.completedUnits = Math.min(
            group.totalUnits,
            group.completedUnits + 1
          );
          group.status =
            group.completedUnits >= group.totalUnits ? "completed" : "running";
          job.progress.completedUnits = job.progress.groups.reduce(
            (total, candidate) => total + candidate.completedUnits,
            0
          );
        });
      },
    };
  }

  private updateJob(
    jobId: string,
    patch: Partial<Omit<ArchiveCheckJobSnapshot, "jobId" | "createdAt">>
  ) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }
    Object.assign(job, patch, { updatedAt: new Date() });
  }

  private updateJobProgress(
    jobId: string,
    update: (job: ArchiveCheckJobSnapshot) => void
  ) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }
    update(job);
    job.updatedAt = new Date();
  }

  private cleanupJobs() {
    const cutoff = Date.now() - ARCHIVE_CHECK_JOB_TTL_MS;
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.updatedAt.getTime() < cutoff) {
        this.jobs.delete(jobId);
      }
    }
  }
}

function latestSignoff<T extends { signedAt: Date }>(signoffs: T[]) {
  return [...signoffs].sort(
    (a, b) => b.signedAt.getTime() - a.signedAt.getTime()
  )[0];
}

function groupQuestionsByAttachment(
  questions: ArchiveCheckReviewQuestion[],
  currentAttachmentIds: Set<string>
) {
  const groups = new Map<string, ArchiveCheckReviewQuestion[]>();
  for (const question of questions) {
    if (
      !question.attachmentId ||
      !currentAttachmentIds.has(question.attachmentId)
    ) {
      continue;
    }
    const list = groups.get(question.attachmentId) ?? [];
    list.push(question);
    groups.set(question.attachmentId, list);
  }
  return groups;
}

function countIssues(issues: ArchiveCheckIssue[], type: ArchiveCheckIssueType) {
  return issues.filter((issue) => issue.type === type).length;
}

const ARCHIVE_CHECK_DEFINITIONS: {
  id: ArchiveCheckId;
  name: string;
  issueTypes: ArchiveCheckIssueType[];
}[] = [
  {
    id: "SIGNOFF_MISSING",
    name: "Missing P/R sign-off",
    issueTypes: ["MISSING_PREPARER_SIGNOFF", "MISSING_REVIEWER_SIGNOFF"],
  },
  {
    id: "SIGNOFF_DATE_ORDER",
    name: "Reviewer sign-off date",
    issueTypes: ["REVIEW_SIGNOFF_BEFORE_PREPARER"],
  },
  {
    id: "SELF_REVIEW",
    name: "Prepare and review segregation",
    issueTypes: ["SELF_REVIEWED_WORKING_PAPER"],
  },
  {
    id: "OPEN_REVIEW_QUESTIONS",
    name: "Uncleared Q",
    issueTypes: ["OPEN_REVIEW_QUESTION"],
  },
  {
    id: "MASTER_LOCKS",
    name: "Master locks",
    issueTypes: ["LOCKED_ATTACHMENT"],
  },
  {
    id: "SMART_FORMS",
    name: "Smart Form completion",
    issueTypes: ["SMART_FORM_INCOMPLETE"],
  },
  {
    id: "WORD_ISSUES",
    name: "Word tracked changes and comments",
    issueTypes: ["DOCX_TRACK_CHANGES", "DOCX_UNRESOLVED_COMMENT"],
  },
  {
    id: "EXCEL_COMMENTS",
    name: "Excel unresolved comments",
    issueTypes: ["XLSX_UNRESOLVED_COMMENT"],
  },
  {
    id: "EXCEL_ERROR_VALUES",
    name: "Excel error value warnings",
    issueTypes: ["XLSX_ERROR_VALUE"],
  },
  {
    id: "OFFICE_INSPECTION",
    name: "Office file inspection",
    issueTypes: ["OFFICE_FILE_CHECK_FAILED"],
  },
];

function buildArchiveCheckGroups(
  issues: ArchiveCheckIssue[]
): ArchiveCheckGroup[] {
  return ARCHIVE_CHECK_DEFINITIONS.map((definition) => {
    const groupedIssues = coalesceArchiveIssues(
      issues.filter((issue) => definition.issueTypes.includes(issue.type))
    );
    const blockers = groupedIssues.filter(
      (issue) => issue.severity === "BLOCKER"
    ).length;
    const warnings = groupedIssues.filter(
      (issue) => issue.severity === "WARNING"
    ).length;
    const status: ArchiveCheckStatus = blockers
      ? definition.id === "OFFICE_INSPECTION"
        ? "FAILED"
        : "BLOCKER"
      : warnings
        ? "WARNING"
        : "PASSED";
    const severity: ArchiveCheckSeverity | undefined = blockers
      ? "BLOCKER"
      : warnings
        ? "WARNING"
        : undefined;
    return {
      id: definition.id,
      name: definition.name,
      status,
      severity,
      counts: {
        issues: groupedIssues.length,
        blockers,
        warnings,
      },
      issues: groupedIssues,
    };
  });
}

function coalesceArchiveIssues(issues: ArchiveCheckIssue[]) {
  const groups = new Map<string, ArchiveCheckIssue[]>();
  for (const [index, issue] of issues.entries()) {
    const attachmentId =
      issue.location?.attachmentId ??
      issue.attachment?.id ??
      issue.action?.attachmentId;
    const key = attachmentId
      ? `attachment:${attachmentId}`
      : `issue:${index}:${issue.type}`;
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }
  return [...groups.values()].map((group) => summarizeArchiveIssueGroup(group));
}

function summarizeArchiveIssueGroup(
  issues: ArchiveCheckIssue[]
): ArchiveCheckIssue {
  const [first] = issues;
  if (!first) {
    throw new Error("Cannot summarize an empty archive issue group");
  }
  if (issues.length === 1) {
    return first;
  }
  const severity: ArchiveCheckSeverity = issues.some(
    (issue) => issue.severity === "BLOCKER"
  )
    ? "BLOCKER"
    : "WARNING";
  const labels = [
    ...new Set(issues.map((issue) => archiveIssueTypeLabel(issue.type))),
  ];
  return {
    ...first,
    severity,
    message:
      labels.length === 1
        ? `${labels[0]} (${issues.length} occurrence${issues.length === 1 ? "" : "s"})`
        : labels.join("; "),
    location: summarizeArchiveIssueLocation(first, issues.length),
  };
}

function summarizeArchiveIssueLocation(
  issue: ArchiveCheckIssue,
  issueCount: number
) {
  if (!issue.location || issueCount <= 1) {
    return issue.location;
  }
  const location = { ...issue.location };
  delete location.cellAddress;
  delete location.value;
  return { ...location, excerpt: `${issueCount} occurrences` };
}

const ARCHIVE_CHECK_REPORT_CATEGORIES: {
  id: string;
  title: string;
  issueTypes: ArchiveCheckIssueType[];
}[] = [
  {
    id: "signoffs",
    title: "Sign-off checks",
    issueTypes: [
      "MISSING_PREPARER_SIGNOFF",
      "MISSING_REVIEWER_SIGNOFF",
      "REVIEW_SIGNOFF_BEFORE_PREPARER",
      "SELF_REVIEWED_WORKING_PAPER",
    ],
  },
  {
    id: "reviewQuestions",
    title: "Review question checks",
    issueTypes: ["OPEN_REVIEW_QUESTION"],
  },
  {
    id: "workpaperFiles",
    title: "Attachment file checks",
    issueTypes: ["LOCKED_ATTACHMENT"],
  },
  {
    id: "smartForms",
    title: "Smart Form checks",
    issueTypes: ["SMART_FORM_INCOMPLETE"],
  },
  {
    id: "officeFiles",
    title: "Office document checks",
    issueTypes: [
      "DOCX_TRACK_CHANGES",
      "DOCX_UNRESOLVED_COMMENT",
      "XLSX_UNRESOLVED_COMMENT",
      "OFFICE_FILE_CHECK_FAILED",
    ],
  },
  {
    id: "excelHints",
    title: "Excel hints",
    issueTypes: ["XLSX_ERROR_VALUE"],
  },
];

type ArchiveCheckAttachmentRollup = {
  issues: ArchiveCheckIssue[];
  severity: ArchiveCheckSeverity;
  fileName: string;
  projectPath: string;
};

function buildArchiveCheckAttachmentRollups(issues: ArchiveCheckIssue[]) {
  const groups = new Map<string, ArchiveCheckIssue[]>();
  for (const issue of issues) {
    const attachmentId =
      issue.location?.attachmentId ??
      issue.attachment?.id ??
      issue.action?.attachmentId;
    const key = attachmentId
      ? `attachment:${attachmentId}`
      : `issue:${issue.type}:${issue.message}`;
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }
  return [...groups.values()].map((groupedIssues) => {
    const [first] = groupedIssues;
    return {
      issues: groupedIssues,
      severity: groupedIssues.some((issue) => issue.severity === "BLOCKER")
        ? "BLOCKER"
        : "WARNING",
      fileName:
        groupedIssues.find((issue) => issue.location?.attachmentName)?.location
          ?.attachmentName ??
        groupedIssues.find((issue) => issue.attachment?.name)?.attachment
          ?.name ??
        "—",
      projectPath:
        groupedIssues.find((issue) => issue.location?.projectPath)?.location
          ?.projectPath ??
        first?.workingPaper?.code ??
        "—",
    } satisfies ArchiveCheckAttachmentRollup;
  });
}

export function renderArchiveCheckTypstSource(report: ArchiveCheckReport) {
  const issueCategories = ARCHIVE_CHECK_REPORT_CATEGORIES.map((category) => {
    const issues = report.issues.filter((issue) =>
      category.issueTypes.includes(issue.type)
    );
    return {
      ...category,
      issues,
      attachments: buildArchiveCheckAttachmentRollups(issues),
    };
  }).filter((category) => category.issues.length > 0);
  const issueSections = issueCategories
    .map((category, index) => renderArchiveIssueTable(category, index + 1))
    .join("\n");
  const resultLabel = report.ready ? "Ready to archive" : "Action required";
  const generatedAt = formatReportGeneratedAt(report.generatedAt);

  return `
#let sans-fonts = ("Ubuntu", "Lato", "Fira Sans", "Source Sans Pro", "Inter", "Noto Sans", "Noto Sans CJK SC", "Microsoft YaHei", "Arial")
#let ink = rgb("#10231a")
#let muted = rgb("#63736b")
#let rule = rgb("#dce5e0")
#let paper-tint = rgb("#f6f9f7")
#let row-tint = rgb("#f3f7f5")
#let accent = rgb("#087a43")
#let accent-dark = rgb("#075a34")
#let accent-soft = rgb("#dcefe5")
#let attention = rgb("#b54708")
#let warning = rgb("#b7791f")
#let pass-fill = rgb("#e5f5eb")

// File Check uses a self-contained interpretation of the Typst Universe
// biz-report design language. Keeping it local avoids runtime package and
// font downloads in production while preserving a business-report layout.
#set text(font: sans-fonts, size: 9pt, fill: ink)
#set par(leading: 0.62em)

#set page(paper: "a4", margin: 0pt, header: none, footer: none)
#grid(
  columns: (26mm, 1fr),
  column-gutter: 0mm,
  rect(width: 26mm, height: 297mm, fill: accent-dark)[
    #align(center + horizon)[
      #rotate(-90deg)[
        #text(size: 9pt, tracking: 1.8pt, weight: "medium", fill: white)[EMP · FILE CHECK · ${typstText(report.project.projectCode)}]
      ]
    ]
  ],
  block(height: 297mm, inset: (left: 20mm, right: 18mm, top: 24mm, bottom: 20mm))[
    #grid(columns: (1fr, auto),
      [#text(size: 9pt, weight: "semibold", fill: accent)[ENGAGEMENT MANAGEMENT PLATFORM]],
      [#text(size: 8pt, fill: muted)[CONTROL REPORT]],
    )
    #v(44mm)
    #text(size: 10pt, weight: "semibold", fill: accent)[FILE CHECK]
    #v(5mm)
    #text(size: 30pt, weight: "bold", fill: ink)[${typstText(report.project.name)}]
    #v(7mm)
    #line(length: 38mm, stroke: 2pt + accent)
    #v(6mm)
    #text(size: 12pt, fill: muted)[${typstText(report.project.projectCode)}]
    #v(1fr)
    #block(width: 100%, fill: paper-tint, radius: 4pt, inset: 11pt)[
      #grid(columns: (1fr, 1fr), row-gutter: 7pt,
        [#text(size: 7pt, fill: muted)[REPORT STATUS]#linebreak()#text(size: 12pt, weight: "bold", fill: ${report.ready ? "accent" : "attention"})[${typstText(resultLabel)}]],
        [#text(size: 7pt, fill: muted)[GENERATED]#linebreak()#text(size: 10pt, weight: "semibold")[${typstText(generatedAt)}]],
        [#text(size: 7pt, fill: muted)[ATTACHMENTS CHECKED]#linebreak()#text(size: 12pt, weight: "bold")[${report.summary.attachments}]],
        [#text(size: 7pt, fill: muted)[ISSUES IDENTIFIED]#linebreak()#text(size: 12pt, weight: "bold")[${report.issues.length}]],
      )
    ]
    #v(9mm)
    #text(size: 7.5pt, fill: muted)[System-generated file control report · Internal use]
  ],
)

#pagebreak()

#set page(
  paper: "a4",
  margin: (top: 20mm, bottom: 17mm, left: 15mm, right: 15mm),
  header: context [
    #set text(font: sans-fonts, size: 7.5pt, fill: muted)
    #grid(columns: (1fr, auto),
      [#text(weight: "semibold", fill: accent)[FILE CHECK]  ·  ${typstText(report.project.projectCode)}],
      [${typstText(report.project.name)}],
    )
    #v(2mm)
    #line(length: 100%, stroke: 0.45pt + rule)
  ],
  footer: context [
    #set text(font: sans-fonts, size: 7pt, fill: muted)
    #line(length: 100%, stroke: 0.4pt + rule)
    #v(1.5mm)
    #grid(columns: (1fr, auto), [Internal control report], [${typstText(report.project.projectCode)} · #counter(page).display()])
  ],
)
#show heading.where(level: 1): it => block(above: 12pt, below: 6pt)[
  #set text(size: 14pt, weight: "bold", fill: ink)
  #it.body
]

#text(size: 8pt, weight: "semibold", tracking: 1.2pt, fill: accent)[EXECUTIVE SUMMARY]
#v(3pt)
#text(size: 22pt, weight: "bold")[File Check Report]
#v(3pt)
#text(size: 9pt, fill: muted)[Automated review of attachment integrity, sign-offs, open review points and Office document controls.]
#v(10pt)
#block(
  width: 100%,
  stroke: (top: 0.55pt + rule, bottom: 0.55pt + rule),
  inset: (top: 10pt, bottom: 10pt),
)[
  #grid(
    columns: (1fr, 1fr, 1fr, 1.3fr),
    align: (left, horizon),
    [#block(width: 100%, stroke: (right: 0.45pt + rule), inset: (right: 11pt))[
      #text(size: 7pt, tracking: 0.6pt, fill: muted)[ATTACHMENTS]
      #v(2pt)
      #text(size: 18pt, weight: "bold")[${report.summary.attachments}]
    ]],
    [#block(width: 100%, stroke: (right: 0.45pt + rule), inset: (left: 11pt, right: 11pt))[
      #text(size: 7pt, tracking: 0.6pt, fill: muted)[BLOCKERS]
      #v(2pt)
      #text(size: 18pt, weight: "bold")[${report.summary.blockers}]
    ]],
    [#block(width: 100%, stroke: (right: 0.45pt + rule), inset: (left: 11pt, right: 11pt))[
      #text(size: 7pt, tracking: 0.6pt, fill: muted)[WARNINGS]
      #v(2pt)
      #text(size: 18pt, weight: "bold")[${report.summary.warnings}]
    ]],
    [#block(width: 100%, inset: (left: 11pt))[
      #text(size: 7pt, tracking: 0.6pt, fill: muted)[RESULT]
      #v(4pt)
      #text(size: 11pt, weight: "bold", fill: ${report.ready ? "accent" : "attention"})[${typstText(resultLabel)}]
    ]],
  )
]

#v(11pt)
#block(width: 100%, stroke: (left: 2.5pt + accent), fill: paper-tint, inset: (left: 10pt, right: 10pt, top: 8pt, bottom: 8pt))[
  #grid(columns: (1.6fr, 1fr, 0.8fr), column-gutter: 14pt,
    [#text(size: 7pt, fill: muted)[PROJECT]#linebreak()#text(size: 9pt, weight: "semibold")[${typstText(report.project.name)}]],
    [#text(size: 7pt, fill: muted)[GENERATED]#linebreak()#text(size: 9pt, weight: "semibold")[${typstText(generatedAt)}]],
    [#text(size: 7pt, fill: muted)[ISSUE CATEGORIES]#linebreak()#text(size: 9pt, weight: "semibold")[${issueCategories.length} / ${ARCHIVE_CHECK_REPORT_CATEGORIES.length}]],
  )
]

#v(12pt)
#line(length: 100%, stroke: 0.45pt + rule)
#v(2pt)

${issueSections || renderArchiveCheckPassedState()}
`;
}

function renderArchiveIssueTable(
  category: (typeof ARCHIVE_CHECK_REPORT_CATEGORIES)[number] & {
    issues: ArchiveCheckIssue[];
    attachments: ArchiveCheckAttachmentRollup[];
  },
  sectionNumber: number
) {
  const blockerCount = category.issues.filter(
    (issue) => issue.severity === "BLOCKER"
  ).length;
  const rows = category.attachments
    .map((attachment, index) => {
      const severityLabel =
        attachment.severity === "BLOCKER" ? "Blocker" : "Warning";
      const findingCounts = new Map<ArchiveCheckIssueType, number>();
      for (const issue of attachment.issues) {
        findingCounts.set(issue.type, (findingCounts.get(issue.type) ?? 0) + 1);
      }
      const findings = category.issueTypes
        .filter((type) => findingCounts.has(type))
        .map((type) => {
          const count = findingCounts.get(type) ?? 0;
          return `${archiveIssueTypeLabel(type)}${count > 1 ? ` (${count})` : ""}`;
        })
        .join("; ");
      return [
        `[${typstText(`${index + 1}`)}]`,
        `[#text(weight: "semibold", fill: ${attachment.severity === "BLOCKER" ? "attention" : "warning"})[${typstText(severityLabel)}]]`,
        `[${typstText(attachment.projectPath)}]`,
        `[${typstText(attachment.fileName)}]`,
        `[${typstText(findings)}]`,
      ].join(",\n");
    })
    .join(",\n");
  return `
#block(above: 14pt, below: 6pt, breakable: false)[
  #grid(columns: (11mm, 1fr, auto), align: (left, horizon),
    [#text(size: 18pt, weight: "bold", fill: accent-soft)[${String(sectionNumber).padStart(2, "0")}]],
    [#text(size: 13pt, weight: "bold")[${typstText(category.title)}]],
    [#text(size: 8pt, fill: muted)[${category.attachments.length} affected file${category.attachments.length === 1 ? "" : "s"} · ${category.issues.length} finding${category.issues.length === 1 ? "" : "s"} · ${blockerCount} blocker${blockerCount === 1 ? "" : "s"}]],
  )
]
#table(
  columns: (8mm, 18mm, 46mm, 40mm, 1fr),
  inset: (x: 4pt, y: 5pt),
  stroke: 0.35pt + rule,
  fill: (x, y) => if y == 0 { accent-dark } else if calc.odd(y) { row-tint },
  table.header(
    [#text(weight: "semibold", fill: white)[No.]],
    [#text(weight: "semibold", fill: white)[Severity]],
    [#text(weight: "semibold", fill: white)[Location]],
    [#text(weight: "semibold", fill: white)[Attachment]],
    [#text(weight: "semibold", fill: white)[Findings]],
  ),
  ${rows}
)
`;
}

function renderArchiveCheckPassedState() {
  return `
#v(12pt)
#block(fill: pass-fill, radius: 5pt, inset: 12pt, width: 100%)[
  #text(size: 12pt, weight: "semibold", fill: accent)[No file check issues found]
  #v(3pt)
  #text(size: 8.5pt, fill: muted)[All configured checks passed at the time this report was generated.]
]
`;
}

function createArchiveCheckPdf(report: ArchiveCheckReport) {
  try {
    const compiler = NodeCompiler.create();
    const compiled = compiler.compile({
      mainFileContent: renderArchiveCheckTypstSource(report),
    });
    if (compiled.hasError()) {
      const compileError = compiled.takeError() ?? compiled.takeDiagnostics();
      throw new Error(formatTypstCompileError(compileError));
    }
    if (!compiled.result) {
      throw new Error("Typst compilation returned no document");
    }
    return Buffer.from(compiler.pdf(compiled.result));
  } catch (error) {
    throw new ServiceUnavailableException({
      code: "FILE_CHECK_EXPORT_FAILED",
      message: `File Check PDF export failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function formatTypstCompileError(value: unknown) {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const diagnostic = value as {
      compilationStatus?: unknown;
      kind?: unknown;
      shortDiagnostics?: unknown;
    };
    const details = {
      compilationStatus: diagnostic.compilationStatus,
      kind: diagnostic.kind,
      shortDiagnostics: diagnostic.shortDiagnostics,
    };
    const serializedDetails = JSON.stringify(details);
    if (serializedDetails !== "{}") {
      return serializedDetails;
    }
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // Fall through to Node's diagnostic representation.
  }
  return inspect(value, { depth: 8, showHidden: true });
}

function typstText(value: string) {
  return `#text(${JSON.stringify(value)})`;
}

function formatReportGeneratedAt(value: Date) {
  return value
    .toISOString()
    .replace("T", " ")
    .replace(/:\d{2}\.\d{3}Z$/, " UTC");
}

function archiveIssueTypeLabel(type: ArchiveCheckIssueType) {
  switch (type) {
    case "MISSING_PREPARER_SIGNOFF": {
      return "Missing preparer sign-off";
    }
    case "MISSING_REVIEWER_SIGNOFF": {
      return "Missing reviewer sign-off";
    }
    case "REVIEW_SIGNOFF_BEFORE_PREPARER": {
      return "Reviewer sign-off is not after preparer sign-off";
    }
    case "SELF_REVIEWED_WORKING_PAPER": {
      return "Same user prepared and reviewed";
    }
    case "OPEN_REVIEW_QUESTION": {
      return "Uncleared Q";
    }
    case "LOCKED_ATTACHMENT": {
      return "Master lock is active";
    }
    case "SMART_FORM_INCOMPLETE": {
      return "Smart Form is incomplete";
    }
    case "DOCX_TRACK_CHANGES": {
      return "Word tracked changes";
    }
    case "DOCX_UNRESOLVED_COMMENT": {
      return "Word unresolved comments";
    }
    case "XLSX_UNRESOLVED_COMMENT": {
      return "Excel unresolved comments";
    }
    case "XLSX_ERROR_VALUE": {
      return "Excel error values";
    }
    case "OFFICE_FILE_CHECK_FAILED": {
      return "Office inspection failed";
    }

    default: {
      break;
    }
  }
}

function sanitizeDownloadFileName(value: string) {
  return value.replaceAll(/[\\/:*?"<>|]/g, "_").trim() || "project";
}

function baseAttachmentLocation(
  attachment: ArchiveCheckAttachment,
  workingPaper?: ArchiveCheckWorkingPaper
) {
  return {
    attachmentId: attachment.id,
    attachmentName: attachment.originalName ?? attachment.fileName,
    projectPath: workingPaper?.projectPath,
  };
}

function formatWorkingPaperProjectPath(
  workflowNodeId: string | null | undefined,
  workingPaperCode: string,
  nodes: Map<string, ArchiveCheckWorkflowNode>
) {
  const segments: string[] = [];
  const visited = new Set<string>();
  let nodeId = workflowNodeId;

  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = nodes.get(nodeId);
    if (!node) {
      break;
    }
    const title = node.title.trim();
    const label =
      title && title !== node.code ? `${node.code} ${title}` : node.code;
    if (label) {
      segments.unshift(label);
    }
    nodeId = node.parentId;
  }

  if (segments.at(-1) !== workingPaperCode) {
    segments.push(workingPaperCode);
  }
  return segments.join(" / ");
}

function isInspectableOfficeAttachment(attachment: ArchiveCheckAttachment) {
  if (!attachment.fileUrl) {
    return false;
  }
  const fileName = (
    attachment.originalName ?? attachment.fileName
  ).toLowerCase();
  return fileName.endsWith(".docx") || fileName.endsWith(".xlsx");
}

function isCurrentAttachment(attachment: ArchiveCheckAttachment) {
  return (
    (attachment.bucket ?? "CURRENT") === "CURRENT" &&
    (attachment.deletedAt === null || attachment.deletedAt === undefined)
  );
}

function isIncompleteSmartFormAttachment(attachment: ArchiveCheckAttachment) {
  return (
    attachment.fileKind === "SMART_FORM" &&
    attachment.smartFormInstance?.status !== "COMPLETE"
  );
}

function calculateProgressTotals(
  papers: {
    attachments: ArchiveCheckAttachment[];
  }[]
): Record<ArchiveCheckProgressGroupId, number> {
  const attachmentCount = papers.reduce(
    (total, paper) =>
      total + paper.attachments.filter(isCurrentAttachment).length,
    0
  );
  const officeAttachmentCount = papers.reduce(
    (total, paper) =>
      total +
      paper.attachments
        .filter(isCurrentAttachment)
        .filter(isInspectableOfficeAttachment).length,
    0
  );
  return {
    signoffs: attachmentCount,
    reviewQuestions: attachmentCount,
    workpaperFiles: attachmentCount,
    officeFiles: officeAttachmentCount,
    finalizing: 1,
  };
}

function createProgressSnapshot(
  totals: Partial<Record<ArchiveCheckProgressGroupId, number>> = {}
): ArchiveCheckProgressSnapshot {
  const groups: ArchiveCheckProgressGroup[] = ARCHIVE_CHECK_PROGRESS_GROUPS.map(
    (group) => {
      const totalUnits = totals[group.id] ?? 0;
      return {
        ...group,
        completedUnits: 0,
        totalUnits,
        status: totalUnits === 0 ? "completed" : "pending",
      };
    }
  );
  return {
    completedUnits: 0,
    totalUnits: groups.reduce((total, group) => total + group.totalUnits, 0),
    groups,
  };
}

function cloneJob(job: ArchiveCheckJobSnapshot): ArchiveCheckJobSnapshot {
  return {
    ...job,
    progress: {
      ...job.progress,
      groups: job.progress.groups.map((group) => ({ ...group })),
    },
  };
}

function attachmentAction(
  workingPaper: ArchiveCheckWorkingPaper,
  attachment: ArchiveCheckAttachment
): ArchiveCheckIssueAction {
  return {
    type: "OPEN_ATTACHMENT",
    workingPaperId: workingPaper.id,
    attachmentId: attachment.id,
  };
}

async function inspectDocx(
  buffer: Buffer,
  workingPaper: ArchiveCheckWorkingPaper,
  attachment: ArchiveCheckAttachment
): Promise<ArchiveCheckIssue[]> {
  await Promise.resolve();
  const zip = readOfficePackage(buffer);
  const issues: ArchiveCheckIssue[] = [];
  const documentXml = readPackageText(zip, "word/document.xml");
  if (documentXml) {
    for (const match of documentXml.matchAll(
      /<w:(ins|del)\b[\s\S]*?<\/w:\1>/g
    )) {
      const changeType = match[1] === "ins" ? "insertion" : "deletion";
      issues.push({
        type: "DOCX_TRACK_CHANGES",
        severity: "WARNING",
        message: `${workingPaper.code} ${attachment.originalName ?? attachment.fileName} contains tracked ${changeType}`,
        workingPaper,
        location: {
          ...baseAttachmentLocation(attachment, workingPaper),
          part: "word/document.xml",
          excerpt: extractWordText(match[0]),
        },
        action: attachmentAction(workingPaper, attachment),
      });
    }
  }

  const commentsXml = readPackageText(zip, "word/comments.xml");
  if (commentsXml) {
    for (const match of commentsXml.matchAll(
      /<w:comment\b([^>]*)>([\s\S]*?)<\/w:comment>/g
    )) {
      const author = getXmlAttribute(match[1], "w:author");
      issues.push({
        type: "DOCX_UNRESOLVED_COMMENT",
        severity: "WARNING",
        message: `${workingPaper.code} ${attachment.originalName ?? attachment.fileName} contains an unresolved Word comment`,
        workingPaper,
        location: {
          ...baseAttachmentLocation(attachment, workingPaper),
          part: "word/comments.xml",
          excerpt: extractWordText(match[2]),
          commentAuthor: author,
        },
        action: attachmentAction(workingPaper, attachment),
      });
    }
  }

  return issues;
}

async function inspectXlsx(
  buffer: Buffer,
  workingPaper: ArchiveCheckWorkingPaper,
  attachment: ArchiveCheckAttachment
): Promise<ArchiveCheckIssue[]> {
  await Promise.resolve();
  const zip = readOfficePackage(buffer);
  const issues: ArchiveCheckIssue[] = [];
  const commentsByPart = readXlsxComments(zip);
  const commentsPartToSheet = mapCommentsPartToSheet(zip);
  for (const [part, comments] of commentsByPart) {
    const sheetName = commentsPartToSheet.get(part);
    for (const comment of comments) {
      issues.push({
        type: "XLSX_UNRESOLVED_COMMENT",
        severity: "WARNING",
        message: `${workingPaper.code} ${attachment.originalName ?? attachment.fileName} contains an unresolved Excel comment`,
        workingPaper,
        location: {
          ...baseAttachmentLocation(attachment, workingPaper),
          part,
          sheetName,
          cellAddress: comment.ref,
          excerpt: comment.text,
          commentAuthor: comment.author,
        },
        action: attachmentAction(workingPaper, attachment),
      });
    }
  }

  const workbook = XLSX.read(buffer, { cellDates: true });
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    for (const cellAddress of Object.keys(sheet)) {
      if (cellAddress.startsWith("!")) {
        continue;
      }
      const cell = sheet[cellAddress] as XLSX.CellObject;
      const value = getExcelCellDisplayValue(cell);
      if (!value || !EXCEL_ERROR_VALUES.has(value)) {
        continue;
      }
      issues.push({
        type: "XLSX_ERROR_VALUE",
        severity: "WARNING",
        message: `${workingPaper.code} ${attachment.originalName ?? attachment.fileName} contains ${value}`,
        workingPaper,
        location: {
          ...baseAttachmentLocation(attachment, workingPaper),
          sheetName,
          cellAddress,
          value,
        },
        action: attachmentAction(workingPaper, attachment),
      });
    }
  }

  return issues;
}

function readXlsxComments(zip: OfficePackage) {
  const result = new Map<
    string,
    { ref?: string; author?: string; text?: string }[]
  >();
  for (const path of getOfficePackagePaths(zip)) {
    if (!/^xl\/comments\d*\.xml$/.test(path)) {
      continue;
    }
    const xml = readPackageText(zip, path);
    if (!xml) {
      continue;
    }
    const authors = [...xml.matchAll(/<author>([\s\S]*?)<\/author>/g)].map(
      (match) => decodeXml(match[1])
    );
    const comments = [];
    for (const match of xml.matchAll(
      /<comment\b([^>]*)>([\s\S]*?)<\/comment>/g
    )) {
      const ref = getXmlAttribute(match[1], "ref");
      const authorId = getXmlAttribute(match[1], "authorId");
      const author =
        authorId === undefined ? undefined : authors[Number(authorId)];
      comments.push({
        ref,
        author,
        text: extractSpreadsheetCommentText(match[2]),
      });
    }
    result.set(path, comments);
  }
  return result;
}

function mapCommentsPartToSheet(zip: OfficePackage) {
  const workbookXml = readPackageText(zip, "xl/workbook.xml");
  const workbookRelsXml = readPackageText(zip, "xl/_rels/workbook.xml.rels");
  if (!workbookXml || !workbookRelsXml) {
    return new Map<string, string>();
  }

  const relationshipTargets = new Map<string, string>();
  for (const match of workbookRelsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const id = getXmlAttribute(match[1], "Id");
    const target = getXmlAttribute(match[1], "Target");
    if (id && target) {
      relationshipTargets.set(id, normalizeXlsxPart(target));
    }
  }

  const sheetNamesByPart = new Map<string, string>();
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const name = getXmlAttribute(match[1], "name");
    const relId =
      getXmlAttribute(match[1], "r:id") ?? getXmlAttribute(match[1], "id");
    const part = relId ? relationshipTargets.get(relId) : undefined;
    if (name && part) {
      sheetNamesByPart.set(part, name);
    }
  }

  const result = new Map<string, string>();
  for (const sheetPart of sheetNamesByPart.keys()) {
    const relsPath = sheetPart.replace(
      /^xl\/worksheets\/([^/]+)$/,
      "xl/worksheets/_rels/$1.rels"
    );
    const relsXml = readPackageText(zip, relsPath);
    if (!relsXml) {
      continue;
    }
    for (const match of relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
      const type = getXmlAttribute(match[1], "Type") ?? "";
      const target = getXmlAttribute(match[1], "Target");
      if (!target || !type.endsWith("/comments")) {
        continue;
      }
      const commentPart = normalizeXlsxPart(target, "xl/worksheets");
      const sheetName = sheetNamesByPart.get(sheetPart);
      if (sheetName) {
        result.set(commentPart, sheetName);
      }
    }
  }
  return result;
}

function normalizeXlsxPart(target: string, base = "xl") {
  if (target.startsWith("/")) {
    return target.slice(1);
  }
  const parts = `${base}/${target}`.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }
  return normalized.join("/");
}

function readOfficePackage(buffer: Buffer): OfficePackage {
  return XLSX.CFB.read(buffer, { type: "buffer" });
}

function getOfficePackagePaths(pkg: OfficePackage) {
  return (pkg.FullPaths as string[])
    .map((path) => path.replace(/^Root Entry\//, ""))
    .filter(Boolean);
}

function readPackageText(pkg: OfficePackage, path: string) {
  const normalizedPath = path.replaceAll("\\", "/");
  const findEntry = XLSX.CFB.find.bind(XLSX.CFB);
  const file =
    findEntry(pkg, `Root Entry/${normalizedPath}`) ??
    findEntry(pkg, `Root Entry/${normalizedPath.replaceAll("/", "\\")}`);
  if (!file?.content) {
    return;
  }
  return Buffer.from(file.content).toString("utf-8");
}

function getExcelCellDisplayValue(cell: XLSX.CellObject) {
  const raw = cell.w ?? cell.v;
  if (raw === undefined || raw === null) {
    return "";
  }
  if (cell.t === "e") {
    return typeof cell.w === "string" ? cell.w : String(raw);
  }
  return String(raw).trim();
}

function extractWordText(xml: string) {
  return truncate(
    decodeXml(
      [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((match) => match[1])
        .join(" ")
    )
  );
}

function extractSpreadsheetCommentText(xml: string) {
  return truncate(
    decodeXml(
      [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
        .map((match) => match[1])
        .join(" ")
    )
  );
}

function getXmlAttribute(attributes: string, name: string) {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const match = attributes.match(new RegExp(`${escaped}="([^"]*)"`));
  return match ? decodeXml(match[1]) : undefined;
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function truncate(value?: string, maxLength = 160) {
  if (!value) {
    return;
  }
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1)}...`
    : value;
}
