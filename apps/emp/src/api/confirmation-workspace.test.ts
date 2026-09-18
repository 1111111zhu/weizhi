import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchConfirmationWorkspaceSummary } from "./confirmation-workspace";

const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  projects: vi.fn(),
  confirmations: vi.fn(),
}));
const mockMode = vi.hoisted(() => ({
  getApiMode: vi.fn(),
  isMockApiMode: vi.fn(),
}));

vi.mock("./client", () => ({
  api: mockApi,
  ApiError: class MockApiError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly requestId: string
    ) {
      super(message);
      this.name = "MockApiError";
    }
  },
}));

vi.mock("./mode", () => mockMode);

describe(fetchConfirmationWorkspaceSummary, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMode.getApiMode.mockReturnValue("mock");
    mockMode.isMockApiMode.mockReturnValue(true);
    mockApi.projects.mockResolvedValue([]);
    mockApi.confirmations.mockResolvedValue([]);
  });

  it("uses the mock workspace when API mode is mock", async () => {
    mockApi.me.mockResolvedValue({ id: "user-1" });

    await expect(fetchConfirmationWorkspaceSummary()).resolves.toStrictEqual(
      []
    );
    expect(mockApi.me).toHaveBeenCalledOnce();
  });

  it("excludes archived projects from the mock confirmation center", async () => {
    mockApi.me.mockResolvedValue({ id: "user-1" });
    mockApi.projects.mockResolvedValue([
      {
        id: "active-project",
        name: "Active project",
        projectCode: "ACTIVE-001",
        reportDate: null,
        status: "ACTIVE",
      },
      {
        id: "archived-project",
        name: "Archived project",
        projectCode: "ARCHIVED-001",
        reportDate: null,
        status: "ARCHIVED",
      },
    ]);

    await expect(fetchConfirmationWorkspaceSummary()).resolves.toEqual([
      expect.objectContaining({ projectId: "active-project" }),
    ]);
  });

  it("rejects the mock workspace when no authenticated user exists", async () => {
    mockApi.me.mockResolvedValue(null);

    await expect(fetchConfirmationWorkspaceSummary()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      requestId: "mock",
    });
  });
});
