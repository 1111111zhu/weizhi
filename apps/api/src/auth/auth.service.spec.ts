import { AuthService } from "./auth.service";

const prisma = {
  user: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
};

describe(AuthService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the current account without exposing credential data", async () => {
    const acceptedAt = new Date("2026-06-02T08:00:00.000Z");
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "partner@projectwing.local",
      name: "Partner",
      globalRole: "PARTNER",
      status: "ACTIVE",
      preferredLocale: "en-US",
      cmpCurrencyOrder: [],
      independenceDeclarations: [{ acceptedAt }],
    });
    const service = new AuthService(prisma as never);

    await expect(service.me("user-1")).resolves.toStrictEqual({
      id: "user-1",
      email: "partner@projectwing.local",
      name: "Partner",
      globalRole: "PARTNER",
      preferredLocale: "en-US",
      cmpCurrencyOrder: [],
      declarationAccepted: true,
      declarationAcceptedAt: acceptedAt,
    });

    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        status: true,
        preferredLocale: true,
        cmpCurrencyOrder: true,
        independenceDeclarations: {
          where: {
            projectId: null,
            declarationVersion: "v1",
          },
          select: { acceptedAt: true },
          take: 1,
        },
      },
    });
  });

  it("persists the current user's preferred locale", async () => {
    prisma.user.update.mockResolvedValue({});
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "partner@projectwing.local",
      name: "Partner",
      globalRole: "PARTNER",
      status: "ACTIVE",
      preferredLocale: "en-US",
      independenceDeclarations: [],
    });
    const service = new AuthService(prisma as never);

    await service.updatePreferences("user-1", { preferredLocale: "en-US" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { preferredLocale: "en-US" },
    });
  });
});
