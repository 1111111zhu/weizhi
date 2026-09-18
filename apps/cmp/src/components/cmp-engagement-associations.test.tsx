import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { getCmpDictionary } from "../i18n/client";
import { CmpEngagementAssociations } from "./cmp-engagement-associations";

vi.mock("../api/client", () => ({
  api: {
    cmpAssociationDirectory: vi.fn(),
    cmpTmsEngagementSummary: vi.fn(),
    linkEmpProject: vi.fn(),
    unlinkEmpProject: vi.fn(),
  },
}));

const emptySummaryRow = (userId: string, name: string) => ({
  userId,
  name,
  budgetNormal: null,
  budgetOt: null,
  finalNormal: null,
  finalOt: null,
  absent: null,
  rate: null,
  budgetCost: null,
  actualCost: null,
  diff: null,
});

const tmsSummary = {
  approved: {
    rows: [
      {
        ...emptySummaryRow("manager-1", "Leo Li"),
        finalNormal: 22,
      },
    ],
    total: {
      ...emptySummaryRow("approved-total", "Total"),
      finalNormal: 22,
    },
  },
  draft: {
    rows: [
      {
        ...emptySummaryRow("staff-1", "King Su"),
        finalNormal: 8,
      },
    ],
    total: {
      ...emptySummaryRow("draft-total", "Total"),
      finalNormal: 8,
    },
  },
  periods: [
    {
      userId: "manager-1",
      name: "Leo Li",
      year: 2026,
      month: 8,
      half: "FIRST_HALF" as const,
      revision: 1,
      status: "APPROVED" as const,
      bucket: "APPROVED" as const,
      normal: 22,
      ot: 0,
      absent: 0,
      total: 22,
    },
    {
      userId: "staff-1",
      name: "King Su",
      year: 2026,
      month: 8,
      half: "SECOND_HALF" as const,
      revision: 1,
      status: "SUBMITTED" as const,
      bucket: "DRAFT" as const,
      normal: 8,
      ot: 0,
      absent: 0,
      total: 8,
    },
  ],
};

const engagement = {
  id: "engagement-hbr",
  clientId: "client-hbr",
  client: {
    id: "client-hbr",
    clientCode: "C-HBR-010",
    nameZh: "Harbour Retail Limited",
    nameEn: "Harbour Retail Limited",
    status: "ACTIVE" as const,
  },
  engagementCode: "HBR-2026-ACC",
} as never;

describe(CmpEngagementAssociations, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.cmpTmsEngagementSummary).mockResolvedValue(tmsSummary);
    vi.mocked(api.linkEmpProject).mockResolvedValue({} as never);
    vi.mocked(api.unlinkEmpProject).mockResolvedValue({} as never);
  });

  it("searches for an independently created EMP project before offering a link", async () => {
    vi.mocked(api.cmpAssociationDirectory).mockImplementation((query) =>
      Promise.resolve(
        query === "DUMMY-EMP-1000027"
          ? {
              engagements: [
                {
                  id: "unlinked:project-a",
                  source: "UNLINKED_PROJECT",
                  projectId: "project-a",
                  engagementCode: "DUMMY-EMP-1000027",
                  clientId: "project:project-a",
                  clientCode: "DUMMY-EMP-1000027",
                  clientName: "Dummy",
                  serviceType: "OTHERS",
                  budgetedHours: "0.00",
                  agreedFee: "0.00",
                  recoveryRate: null,
                  feeCurrency: "HKD",
                  pic: null,
                  mic: null,
                  codeAliases: [],
                  timesheetAccess: { allowed: true, reason: "ALLOWED" },
                },
              ],
            }
          : { engagements: [] }
      )
    );

    renderAssociations();

    expect(screen.queryByText("DUMMY-EMP-1000027")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续关联 EMP 项目" }));
    fireEvent.change(await screen.findByLabelText("搜索 EMP 项目"), {
      target: { value: "DUMMY-EMP-1000027" },
    });
    fireEvent.click(screen.getByRole("button", { name: "搜索 EMP" }));

    await expect(
      screen.findByText("DUMMY-EMP-1000027")
    ).resolves.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /关联 EMP: DUMMY-EMP-1000027/ })
    );

    await waitFor(() =>
      expect(api.linkEmpProject).toHaveBeenCalledWith("project-a", {
        cmpClientId: "client-hbr",
        cmpEngagementId: "engagement-hbr",
      })
    );
  });

  it("shows every linked EMP project and a read-only TMS contribution summary", async () => {
    vi.mocked(api.cmpAssociationDirectory).mockResolvedValue({
      engagements: [
        {
          id: "engagement-hbr",
          source: "ENGAGEMENT",
          projectId: "project-a",
          projectCode: "HBR-2026-ACC",
          projectName: "Dummy",
          engagementCode: "HBR-2026-ACC",
          clientId: "client-hbr",
          clientCode: "C-HBR-010",
          clientName: "Harbour Retail Limited",
          serviceType: "ANNUAL_AUDIT",
          budgetedHours: "100.00",
          agreedFee: "100000.00",
          recoveryRate: null,
          feeCurrency: "HKD",
          pic: "Edric Han",
          mic: "Leo Li",
          codeAliases: [],
          timesheetAccess: { allowed: true, reason: "ALLOWED" },
        },
        {
          id: "engagement-hbr",
          source: "ENGAGEMENT",
          projectId: "project-b",
          projectCode: "HBR-2026-ACC-B",
          projectName: "Harbour accounting support B",
          engagementCode: "HBR-2026-ACC",
          clientId: "client-hbr",
          clientCode: "C-HBR-010",
          clientName: "Harbour Retail Limited",
          serviceType: "ANNUAL_AUDIT",
          budgetedHours: "80.00",
          agreedFee: "80000.00",
          recoveryRate: null,
          feeCurrency: "HKD",
          pic: "Edric Han",
          mic: "Leo Li",
          codeAliases: [],
          timesheetAccess: { allowed: true, reason: "ALLOWED" },
        },
      ],
    });

    renderAssociations();

    await expect(
      screen.findByText("HBR-2026-ACC")
    ).resolves.toBeInTheDocument();
    await expect(
      screen.findByText("HBR-2026-ACC-B")
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByText("Harbour accounting support B")
    ).toBeInTheDocument();
    await expect(screen.findByText("Leo Li")).resolves.toBeInTheDocument();
    expect(screen.getByText("King Su")).toBeInTheDocument();
    expect(screen.getByText("只读")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "搜索 TMS" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "解除 EMP: HBR-2026-ACC" })
    );
    await waitFor(() =>
      expect(api.unlinkEmpProject).toHaveBeenCalledWith("project-a")
    );
  });
});

function renderAssociations() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CmpEngagementAssociations
        copy={getCmpDictionary("zh-CN").workspace.engagementAssociations}
        engagement={engagement}
      />
    </QueryClientProvider>
  );
}
