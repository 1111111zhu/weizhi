import type { PrismaService } from "../prisma/prisma.service";
import type {
  SmartFormV2PdfEngagementDetails,
  SmartFormV2PdfSignoff,
} from "./smart-form-v2-pdf.service";

const SMART_FORM_PROJECT_CONTEXT_SELECT = {
  name: true,
  yearEndDate: true,
  workspace: { select: { clientName: true } },
  cmpClient: { select: { nameZh: true, nameEn: true } },
  cmpEngagement: { select: { engagementCode: true } },
} as const;

export async function loadSmartFormV2PdfEngagementDetails(
  prisma: PrismaService,
  projectId: string,
  locale = "zh-CN"
): Promise<SmartFormV2PdfEngagementDetails | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: SMART_FORM_PROJECT_CONTEXT_SELECT,
  });
  return project
    ? resolveSmartFormV2PdfEngagementDetails(project, locale)
    : null;
}

export function resolveSmartFormV2PdfEngagementDetails(
  project: {
    name: string;
    yearEndDate?: Date | string;
    workspace?: { clientName: string };
    cmpClient: { nameZh: string | null; nameEn: string | null } | null;
    cmpEngagement: { engagementCode: string } | null;
  },
  locale = "zh-CN"
): SmartFormV2PdfEngagementDetails {
  const prefersChinese = locale.toLowerCase().startsWith("zh");
  const clientName = prefersChinese
    ? project.cmpClient?.nameZh ||
      project.cmpClient?.nameEn ||
      project.workspace?.clientName
    : project.cmpClient?.nameEn ||
      project.cmpClient?.nameZh ||
      project.workspace?.clientName;

  return {
    clientName,
    engagementCode: project.cmpEngagement?.engagementCode || project.name,
    financialStatementDate: project.yearEndDate,
  };
}

export async function loadSmartFormV2PdfSignoffs(
  prisma: PrismaService,
  attachmentId: string
): Promise<SmartFormV2PdfSignoff[]> {
  const attachmentSignoffs = await prisma.workingPaperSignoff.findMany({
    where: {
      isCurrent: true,
      revokedAt: null,
      OR: [
        { attachmentId },
        {
          attachmentId: null,
          workingPaper: { attachments: { some: { id: attachmentId } } },
        },
      ],
    },
    orderBy: { signedAt: "asc" },
    select: {
      attachmentId: true,
      type: true,
      signedAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  const direct = attachmentSignoffs.filter(
    (signoff) => signoff.attachmentId === attachmentId
  );
  const applicable =
    direct.length > 0
      ? direct
      : attachmentSignoffs.filter((signoff) => signoff.attachmentId === null);
  return applicable.map((signoff) => ({
    type: signoff.type,
    userName: signoff.user.name || signoff.user.email,
    signedAt: signoff.signedAt,
  }));
}
