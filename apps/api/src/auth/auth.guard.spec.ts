import type { ExecutionContext } from "@nestjs/common";

import { AuthGuard } from "./auth.guard";

const auth = {
  getSession: vi.fn(),
};
const prisma = {
  user: {
    findUnique: vi.fn(),
  },
  independenceDeclaration: {
    findFirst: vi.fn(),
  },
};
const reflector = {
  getAllAndOverride: vi.fn(),
};

describe(AuthGuard, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks business API access until the system declaration is accepted", async () => {
    const request = requestWithSession();
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue(
      activeUser({ independenceDeclarations: [] })
    );
    reflector.getAllAndOverride.mockReturnValue(false);
    const guard = new AuthGuard(
      auth as never,
      prisma as never,
      reflector as never
    );

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      "请先确认独立性声明"
    );

    expect(request.user).toStrictEqual({
      id: "user-1",
      email: "partner@projectwing.local",
      name: "Partner",
      globalRole: "PARTNER",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        status: true,
        independenceDeclarations: {
          where: {
            projectId: null,
            declarationVersion: "v1",
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    expect(prisma.independenceDeclaration.findFirst).not.toHaveBeenCalled();
  });

  it("allows declaration-gated exceptions such as auth/me", async () => {
    const request = requestWithSession();
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue(activeUser());
    reflector.getAllAndOverride.mockReturnValue(true);
    const guard = new AuthGuard(
      auth as never,
      prisma as never,
      reflector as never
    );

    await expect(guard.canActivate(contextFor(request))).resolves.toBeTruthy();

    expect(prisma.independenceDeclaration.findFirst).not.toHaveBeenCalled();
  });

  it("allows business API access after the system declaration is accepted", async () => {
    auth.getSession.mockResolvedValue({ user: { id: "user-1" } });
    prisma.user.findUnique.mockResolvedValue(
      activeUser({ independenceDeclarations: [{ id: "declaration-1" }] })
    );
    reflector.getAllAndOverride.mockReturnValue(false);
    const guard = new AuthGuard(
      auth as never,
      prisma as never,
      reflector as never
    );

    await expect(
      guard.canActivate(contextFor(requestWithSession()))
    ).resolves.toBeTruthy();
    expect(prisma.independenceDeclaration.findFirst).not.toHaveBeenCalled();
  });

  it("rejects requests without a Better Auth session", async () => {
    auth.getSession.mockResolvedValue(null);
    reflector.getAllAndOverride.mockReturnValue(true);
    const guard = new AuthGuard(
      auth as never,
      prisma as never,
      reflector as never
    );

    await expect(
      guard.canActivate(contextFor(requestWithSession()))
    ).rejects.toThrow("请先登录");
  });
});

function requestWithSession() {
  return {
    headers: { cookie: "project_wing.session_token=session-token" },
  } as { headers: Record<string, string>; user?: unknown };
}

function contextFor(request: ReturnType<typeof requestWithSession>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () =>
      class TestController {
        private readonly _moduleMarker = true;
      },
  } as unknown as ExecutionContext;
}

function activeUser(
  overrides: Partial<{
    independenceDeclarations: { id: string }[];
  }> = {}
) {
  return {
    id: "user-1",
    email: "partner@projectwing.local",
    name: "Partner",
    globalRole: "PARTNER",
    status: "ACTIVE",
    ...overrides,
  };
}
