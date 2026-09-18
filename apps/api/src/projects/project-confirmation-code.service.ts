import { Injectable } from "@nestjs/common";
import type { ConfirmationType } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

type ProjectConfirmationCodeTransaction = Pick<
  PrismaService,
  "projectConfirmationSequence"
>;

export type AllocatedProjectConfirmationCode = {
  confirmationCode: string;
  sequence: number;
};

const CONFIRMATION_TYPE_CODES = {
  BANK: "BANK",
  BALANCE: "BALANCE",
  RELATED_PARTY: "RELATED_PARTY",
  LAWYER: "LAWYER",
  INVENTORY: "INVENTORY",
  INTERMEDIARY: "INTERMEDIARY",
  OTHER: "OTHER",
  UNCLASSIFIED: "UNCLASSIFIED",
} satisfies Record<ConfirmationType, string>;

@Injectable()
export class ProjectConfirmationCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async allocate(
    projectId: string,
    projectCode: string,
    type: ConfirmationType
  ) {
    await Promise.resolve();
    return this.prisma.$transaction((tx) =>
      this.allocateInTransaction(tx, projectId, projectCode, type)
    );
  }

  async allocateInTransaction(
    tx: ProjectConfirmationCodeTransaction,
    projectId: string,
    projectCode: string,
    type: ConfirmationType
  ): Promise<AllocatedProjectConfirmationCode> {
    const sequence = await tx.projectConfirmationSequence.upsert({
      where: { projectId_type: { projectId, type } },
      create: { projectId, type, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
      select: { nextValue: true },
    });
    const numericSequence = sequence.nextValue - 1;
    return {
      confirmationCode: `${projectCode}-${getTypeCode(type)}-${String(
        numericSequence
      ).padStart(3, "0")}`,
      sequence: numericSequence,
    };
  }
}

function getTypeCode(type: ConfirmationType) {
  return CONFIRMATION_TYPE_CODES[type];
}
