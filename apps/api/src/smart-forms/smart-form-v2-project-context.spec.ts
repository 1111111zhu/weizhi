import { vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import { loadSmartFormV2PdfSignoffs } from "./smart-form-v2-project-context";

describe(loadSmartFormV2PdfSignoffs, () => {
  it("returns only current unrevoked attachment sign-offs with display names", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        attachmentId: "attachment-1",
        type: "PREPARER",
        signedAt: new Date("2026-09-01T08:00:00.000Z"),
        user: { name: "Jony Ma", email: "jony@example.test" },
      },
      {
        attachmentId: "attachment-1",
        type: "REVIEWER",
        signedAt: new Date("2026-09-02T08:00:00.000Z"),
        user: { name: "", email: "reviewer@example.test" },
      },
    ]);
    const prisma = {
      workingPaperSignoff: { findMany },
    } as unknown as PrismaService;

    await expect(
      loadSmartFormV2PdfSignoffs(prisma, "attachment-1")
    ).resolves.toStrictEqual([
      {
        type: "PREPARER",
        userName: "Jony Ma",
        signedAt: new Date("2026-09-01T08:00:00.000Z"),
      },
      {
        type: "REVIEWER",
        userName: "reviewer@example.test",
        signedAt: new Date("2026-09-02T08:00:00.000Z"),
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isCurrent: true,
          revokedAt: null,
          OR: expect.arrayContaining([{ attachmentId: "attachment-1" }]),
        }),
        orderBy: { signedAt: "asc" },
      })
    );
  });

  it("falls back to current workpaper sign-offs when the attachment has none", async () => {
    const prisma = {
      workingPaperSignoff: {
        findMany: vi.fn().mockResolvedValue([
          {
            attachmentId: null,
            type: "PREPARER",
            signedAt: new Date("2026-09-01T08:00:00.000Z"),
            user: { name: "Jony Ma", email: "jony@example.test" },
          },
        ]),
      },
    } as unknown as PrismaService;

    await expect(
      loadSmartFormV2PdfSignoffs(prisma, "attachment-1")
    ).resolves.toStrictEqual([
      {
        type: "PREPARER",
        userName: "Jony Ma",
        signedAt: new Date("2026-09-01T08:00:00.000Z"),
      },
    ]);
  });
});
