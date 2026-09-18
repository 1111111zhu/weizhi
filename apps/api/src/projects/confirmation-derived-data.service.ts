import { Injectable } from "@nestjs/common";

import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import type { ErrorCode } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";

export type ConfirmationDerivedSnapshot = {
  clientCode: string;
  clientName: string;
  projectCode: string;
  projectName: string;
  picName: string;
  fiscalYear: number;
  balanceSheetDate: string;
  contactUserId: string;
  contactName: string;
  contactEmail: string;
  confirmationCode: string;
};

@Injectable()
export class ConfirmationDerivedDataService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    projectId: string,
    submitter: RequestUser,
    confirmationCode: string
  ): Promise<ConfirmationDerivedSnapshot> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectCode: true,
        name: true,
        yearEndDate: true,
        cmpClient: {
          select: {
            clientCode: true,
            nameZh: true,
            nameEn: true,
            clientPartnerPic: true,
          },
        },
        cmpEngagement: {
          select: {
            pic: true,
            yearEndDate: true,
          },
        },
        members: {
          where: {
            status: "ACTIVE",
            OR: [
              { inChargeRole: "PARTNER_IN_CHARGE" },
              { userId: submitter.id },
            ],
          },
          select: {
            userId: true,
            inChargeRole: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!project) {
      fail("PROJECT_REQUIRED", "Project is required");
    }
    const clientCode = required(
      firstText(project.cmpClient?.clientCode, project.projectCode),
      "PROJECT_CODE_REQUIRED",
      "Project code is required"
    );
    const clientName = required(
      firstText(
        project.cmpClient?.nameZh,
        project.cmpClient?.nameEn,
        project.name
      ),
      "PROJECT_NAME_REQUIRED",
      "Project name is required"
    );
    const projectCode = required(
      project.projectCode,
      "PROJECT_CODE_REQUIRED",
      "Project code is required"
    );
    const projectName = required(
      project.name,
      "PROJECT_NAME_REQUIRED",
      "Project name is required"
    );
    const partnerMember = project.members.find(
      (member) => member.inChargeRole === "PARTNER_IN_CHARGE"
    );
    const picName = required(
      firstText(
        project.cmpEngagement?.pic,
        project.cmpClient?.clientPartnerPic,
        partnerMember?.user.name,
        submitter.name
      ),
      "PIC_REQUIRED",
      "Partner in charge is required"
    );
    const balanceSheetDateValue =
      project.cmpEngagement?.yearEndDate ?? project.yearEndDate;
    if (!balanceSheetDateValue) {
      fail("BALANCE_SHEET_DATE_REQUIRED", "Balance-sheet date is required");
    }
    const contact = project.members.find(
      (member) => member.userId === submitter.id
    );
    const isSuperAdmin = submitter.globalRole === "SUPER_ADMIN";
    if (!contact && !isSuperAdmin) {
      fail(
        "PROJECT_MEMBER_REQUIRED",
        "Submitter must be an active project member"
      );
    }
    const contactNameSource =
      contact?.user ?? (isSuperAdmin ? submitter : null);
    const contactName = required(
      contactNameSource?.name,
      "CONTACT_NAME_REQUIRED",
      "Project contact name is required"
    );
    const contactEmail = required(
      contactNameSource?.email,
      "CONTACT_EMAIL_REQUIRED",
      "Project contact email is required"
    );
    const resolvedConfirmationCode = required(
      confirmationCode,
      "CONFIRMATION_CODE_REQUIRED",
      "Confirmation code is required"
    );
    const balanceSheetDate = toDateOnly(balanceSheetDateValue);

    return {
      clientCode,
      clientName,
      projectCode,
      projectName,
      picName,
      fiscalYear: Number(balanceSheetDate.slice(0, 4)),
      balanceSheetDate,
      contactUserId: contact?.userId ?? submitter.id,
      contactName,
      contactEmail,
      confirmationCode: resolvedConfirmationCode,
    };
  }
}

function firstText(...values: (string | null | undefined)[]) {
  return values.find((value) => value?.trim())?.trim();
}

function required(
  value: string | null | undefined,
  code: ErrorCode,
  message: string
) {
  const resolved = value?.trim();
  if (!resolved) {
    fail(code, message);
  }
  return resolved;
}

function fail(code: ErrorCode, message: string): never {
  throw new ApiBadRequestException(code, message);
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
