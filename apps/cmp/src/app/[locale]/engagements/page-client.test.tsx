import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CmpEngagementsView } from "../../../components/cmp-engagements-view";
import { CmpEngagementsClient } from "./page-client";

type EngagementSave = Parameters<
  typeof CmpEngagementsView
>[0]["onSubmitEngagementAcceptance"];

const { apiMocks, raceState } = vi.hoisted(() => ({
  apiMocks: {
    cmpAcceptance: vi.fn(),
    cmpClients: vi.fn(),
    cmpEngagementArchives: vi.fn(),
    cmpEngagements: vi.fn(),
    cmpUsers: vi.fn(),
    createCmpAcceptance: vi.fn(),
    me: vi.fn(),
    updateCmpAcceptance: vi.fn(),
  },
  raceState: {
    initialSave: null as null | EngagementSave,
  },
}));

vi.mock("../../../api/client", () => ({ api: apiMocks }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../../../components/cmp-app-shell", () => ({
  CmpAppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../../../components/cmp-auth-adapter", () => ({
  useCmpSignOut: () => vi.fn(),
}));
vi.mock("../../../components/cmp-form-route-shell", () => ({
  CmpFormRouteShell: ({ children }: { children: React.ReactNode }) => children,
  CmpFormRouteUnavailable: () => null,
}));
vi.mock("../../../components/cmp-toast", () => ({
  useCmpToast: () => ({ dismiss: vi.fn(), toast: vi.fn() }),
}));
vi.mock("../../../i18n/client", () => ({
  useCmpI18n: () => ({
    dictionary: { workspace: { formUnsavedConfirm: "Discard changes?" } },
    localizedPath: (path: string) => path,
  }),
}));
vi.mock("../../../lib/use-unsaved-form-navigation-guard", () => ({
  useUnsavedFormNavigationGuard: () => ({
    allowNextNavigation: vi.fn(),
    guardedAction: (action: () => void) => {
      action();
      return true;
    },
    guardedNavigate: vi.fn(),
    guardedReplace: vi.fn(),
  }),
}));
vi.mock("../../../components/cmp-engagements-view", () => ({
  CmpEngagementsView: ({
    isCreating,
    onSubmitEngagementAcceptance,
  }: {
    isCreating?: boolean;
    onSubmitEngagementAcceptance: (input: unknown) => Promise<unknown>;
  }) => {
    if (!isCreating && !raceState.initialSave) {
      raceState.initialSave = onSubmitEngagementAcceptance;
    }

    return (
      <button
        type="button"
        data-creating={String(Boolean(isCreating))}
        data-has-callback={String(Boolean(raceState.initialSave))}
        onClick={() =>
          void raceState.initialSave?.({
            type: "ENGAGEMENT_CHANGE",
            targetEngagementId: "engagement-1",
            engagementPayload: {},
            submit: false,
          })
        }
      >
        Mock engagement form
      </button>
    );
  },
}));

const currentUser = {
  id: "manager-1",
  email: "manager@example.com",
  name: "MIC Manager",
  globalRole: "MANAGER" as const,
};
const engagement = {
  id: "engagement-1",
  clientId: "client-1",
  client: {
    id: "client-1",
    clientCode: "C001",
    nameZh: "Client",
    nameEn: "Client",
    status: "ACTIVE" as const,
  },
  engagementCode: "C001-2026-AUD",
  serviceType: "ANNUAL_AUDIT" as const,
  otherServiceDescription: null,
  deliverables: [],
  yearEndDate: "2026-12-31",
  reportDate: "2027-03-31",
  approvalReferenceNumber: null,
  engagementDate: null,
  budgetedHours: "10.00",
  agreedFee: "100.00",
  recoveryRate: null,
  feePlanningLines: [],
  feeCurrency: "HKD",
  amlRiskClassification: "NOT_HIGH" as const,
  engagementRiskClassification: "NORMAL" as const,
  picUserId: "pic-1",
  micUserId: "manager-1",
  eqReviewerUserId: null,
  riskManagementPartnerUserId: null,
  pic: "PIC",
  mic: "MIC Manager",
  eqReviewer: null,
  riskManagementPartner: null,
  status: "ACTIVE" as const,
  remarks: null,
  createdById: "manager-1",
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
  codeAliases: [],
};

describe("cmpEngagementsClient edit page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    raceState.initialSave = null;
    apiMocks.me.mockResolvedValue(currentUser);
    apiMocks.cmpClients.mockResolvedValue({
      clients: [
        {
          id: "client-1",
          clientCode: "C001",
          nameZh: "Client",
          nameEn: "Client",
          status: "ACTIVE",
        },
      ],
    });
    apiMocks.cmpEngagements.mockResolvedValue({ engagements: [engagement] });
    apiMocks.cmpEngagementArchives.mockResolvedValue({ archives: [] });
    apiMocks.cmpUsers.mockResolvedValue([currentUser]);
    apiMocks.cmpAcceptance.mockResolvedValue({
      requests: [{ id: "change-draft-1", status: "DRAFT" }],
    });
    apiMocks.createCmpAcceptance.mockResolvedValue({
      id: "new-draft",
      status: "DRAFT",
    });
    apiMocks.updateCmpAcceptance.mockResolvedValue({
      id: "change-draft-1",
      status: "DRAFT",
    });
  });

  it("updates the existing engagement change draft during the initial save race", async () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <CmpEngagementsClient formMode="edit" engagementId="engagement-1" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(apiMocks.cmpAcceptance).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Mock engagement form" })
      ).toHaveAttribute("data-creating", "false")
    );
    expect(raceState.initialSave).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Mock engagement form" })
    );
    await waitFor(() =>
      expect(apiMocks.updateCmpAcceptance).toHaveBeenCalledOnce()
    );

    expect(apiMocks.updateCmpAcceptance).toHaveBeenCalledWith(
      "change-draft-1",
      expect.objectContaining({ submit: false })
    );
    expect(apiMocks.createCmpAcceptance).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Mock engagement form" })
    ).toBeInTheDocument();
  });
});
