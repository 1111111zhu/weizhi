import { UpdateCmpAcceptanceRequestSchema } from "@project-wing/shared";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as acceptanceChangesClient from "../api/acceptance-changes-client";
import { CmpI18nProvider } from "../i18n/client";
import { CmpAcceptanceView } from "./cmp-acceptance-view";

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

function goToAcceptanceReview(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("tab", { name: /Review & Submit/ }));
}

const currentUser = {
  id: "user-staff",
  email: "staff@example.com",
  name: "Staff User",
  globalRole: "STAFF" as const,
};
const users = [
  {
    id: "user-mic",
    email: "mic@example.com",
    name: "MIC Manager",
    globalRole: "MANAGER" as const,
  },
  {
    id: "user-pic",
    email: "pic@example.com",
    name: "PIC Partner",
    globalRole: "PARTNER" as const,
  },
  {
    id: "user-it",
    email: "it@example.com",
    name: "IT Admin",
    globalRole: "SUPER_ADMIN" as const,
  },
  {
    id: "user-junior",
    email: "junior@example.com",
    name: "Junior Staff",
    globalRole: "STAFF" as const,
  },
];
const clients = [
  {
    id: "client-1",
    clientCode: "C001",
    companyCode: "COMPANY-001",
    companyNumber: "1234567",
    nameZh: "Huaqian Limited CN",
    nameEn: "Huaqian Limited",
    groupId: null,
    group: null,
    address: null,
    contactPerson: null,
    telephone: null,
    email: null,
    website: null,
    yearEndDate: "2026-12-31",
    yearEndMonth: 12,
    hsicSectionCode: "C" as const,
    industryBusinessNatureDetails: null,
    contactPosition: null,
    contactDepartment: null,
    contactMobile: null,
    contactRemarks: null,
    principalAddressSameAsRegistered: true,
    addresses: [],
    placeOfIncorporation: null,
    dateOfIncorporation: null,
    countryOrDistrict: null,
    listedOrPrivate: "PRIVATE",
    stockExchangeOrListingPlace: null,
    stockCode: null,
    marketSegment: null,
    regulatedEntities: null,
    companyTypeOrSpecialIndustry: null,
    isSubsidiary: false,
    parentClientCode: null,
    subsidiariesOrAssociates: null,
    referredBy: null,
    internalSource: null,
    externalSource: null,
    sourceDescription: null,
    clientPartnerPic: "PIC Partner",
    clientPartnerPicId: "user-pic",
    clientManagerMic: "MIC Manager",
    alternativePartnerSecondMic: null,
    expectedJobOrEngagementType: null,
    serviceLines: null,
    approvalReferenceNumber: null,
    approvalDate: null,
    preparedBy: null,
    approvedBy: null,
    micApproval: null,
    picApproval: null,
    itAdmin: null,
    signOffDate: null,
    status: "ACTIVE" as const,
    createdById: "user-staff",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
  },
];

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    requestNo: "CA-001",
    type: "CLIENT" as const,
    status: "PENDING_MIC" as const,
    currentStep: "MIC" as const,
    submittedById: "user-staff",
    submittedBy: currentUser,
    micApproverId: "user-mic",
    micApprover: users[0],
    picApproverId: "user-pic",
    picApprover: users[1],
    itApproverId: "user-it",
    itApprover: users[2],
    workflowVersion: 1,
    draftAssigneeId: null,
    draftAssignee: null,
    draftCompletedAt: null,
    draftCompletedById: null,
    draftCompletedBy: null,
    returnedFromStep: null,
    picApprovedAt: null,
    targetClientId: null,
    targetEngagementId: null,
    clientPayload: {
      clientCode: "C-NEW",
      nameZh: "New Client CN",
    },
    engagementPayload: null,
    returnReason: null,
    submittedAt: "2026-07-05T00:00:00.000Z",
    approvedAt: null,
    returnedAt: null,
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    approvalSteps: [
      {
        id: "step-1",
        step: "MIC" as const,
        approverId: "user-mic",
        approver: users[0],
        status: "PENDING" as const,
        comment: null,
        actedAt: null,
        createdAt: "2026-07-05T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function completeClientPayload(overrides: Record<string, unknown> = {}) {
  return {
    clientCode: "C-NEW",
    companyCode: "COMPANY-NEW",
    companyNumber: "7654321",
    nameEn: "New Client Limited",
    status: "ACTIVE",
    yearEndDate: "2026-12-31",
    yearEndMonth: 12,
    hsicSectionCode: "C",
    registeredAddress: "1 Queen's Road Central",
    principalBusinessAddress: "1 Queen's Road Central",
    principalAddressSameAsRegistered: true,
    placeOfIncorporation: "Hong Kong",
    dateOfIncorporation: "2020-01-01",
    listedOrPrivate: "PRIVATE",
    clientPartnerPicId: "user-pic",
    clientLeadingPartnerId: "user-pic",
    clientLeadingPartner: "PIC Partner",
    clientManagerMicId: "user-mic",
    serviceType: "Audit",
    serviceLines: "Audit",
    ...overrides,
  };
}

describe(CmpAcceptanceView, () => {
  afterEach(() => {
    window.localStorage.removeItem("cmp-language");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("routes both client and engagement edits through the full-page handler", () => {
    const onEditRequest = vi.fn();
    const { rerender } = render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[request({ status: "DRAFT" })]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        onEditRequest={onEditRequest}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEditRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "CLIENT" }),
      false
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            type: "ENGAGEMENT",
            status: "DRAFT",
            clientPayload: null,
            engagementPayload: {
              clientId: "client-1",
              engagementCode: "ENG-001",
              serviceType: "ANNUAL_AUDIT",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        onEditRequest={onEditRequest}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEditRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "ENGAGEMENT" }),
      false
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a Client draft in full-page edit mode", async () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "DRAFT",
            clientPayload: completeClientPayload(),
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        formPageMode
        initialEditRequestId="request-1"
      />
    );

    await expect(screen.findByLabelText("Client Code")).resolves.toHaveValue(
      "C-NEW"
    );
  });

  it("expands Client Change differences inside the existing View dialog", async () => {
    vi.spyOn(
      acceptanceChangesClient,
      "getCmpAcceptanceChanges"
    ).mockResolvedValue({
      status: "AVAILABLE",
      changedFieldCount: 1,
      baselineCapturedAt: "2026-07-05T00:00:00.000Z",
      staleMasterData: false,
      groups: [
        {
          section: "basicInformation",
          changes: [
            {
              field: "nameEn",
              kind: "MODIFIED",
              before: "Huaqian Limited",
              after: "Huaqian Advisory Limited",
            },
          ],
        },
      ],
    });
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            type: "CLIENT_CHANGE",
            changedFieldCount: 1,
            targetClientId: "client-1",
            clientPayload: {
              clientCode: "C001",
              nameEn: "Huaqian Advisory Limited",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", {
        name: /(?:View changes|查看修改) \(1\)/,
      })
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /(?:View changes|查看修改)/,
      })
    );

    await expect(
      within(dialog).findByText("Huaqian Advisory Limited")
    ).resolves.toBeInTheDocument();
    expect(within(dialog).getByText("Huaqian Limited")).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      acceptanceChangesClient.getCmpAcceptanceChanges
    ).toHaveBeenCalledWith("request-1");
  });

  it("shows a safe warning and retries a failed request", async () => {
    vi.spyOn(acceptanceChangesClient, "getCmpAcceptanceChanges")
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        status: "BASELINE_UNAVAILABLE",
        changedFieldCount: 0,
        baselineCapturedAt: null,
        staleMasterData: false,
        groups: [],
      });
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({ type: "ENGAGEMENT_CHANGE", targetEngagementId: "eng-1" }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /(?:View changes|查看修改)/,
      })
    );

    await expect(
      within(dialog).findByRole("button", { name: /(?:Retry|重试)/ })
    ).resolves.toBeInTheDocument();
    expect(within(dialog).queryByText("Network error")).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /(?:Retry|重试)/ })
    );
    await expect(
      within(dialog).findByText(
        /(?:Original version unavailable|原始版本不可用)/
      )
    ).resolves.toBeInTheDocument();
    expect(
      acceptanceChangesClient.getCmpAcceptanceChanges
    ).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("does not offer change comparison for a new Acceptance", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(
      screen.queryByRole("button", {
        name: /(?:View changes|查看修改)/,
      })
    ).not.toBeInTheDocument();
  });

  it("renders the acceptance workspace in Chinese when selected", async () => {
    window.localStorage.setItem("cmp-language", "zh-CN");

    render(
      <CmpI18nProvider>
        <CmpAcceptanceView
          mode="acceptance"
          requests={[request()]}
          users={users}
          clients={clients}
          currentUser={currentUser}
        />
      </CmpI18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("我的申请")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("columnheader", { name: "申请编号" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看" })).toBeInTheDocument();
  });

  it("does not show duplicate creation buttons in the acceptance center", () => {
    const onCreate = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        onCreate={onCreate}
        titleActions={<button type="button">My Approvals</button>}
      />
    );

    expect(
      screen.getByRole("button", { name: "My Approvals" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New Client Acceptance" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New Engagement Acceptance" })
    ).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("filters acceptance requests using the page-level search", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        searchValue="not present"
      />
    );

    expect(screen.queryByText("CA-001")).not.toBeInTheDocument();
    expect(
      screen.getByText("No acceptance requests found.")
    ).toBeInTheDocument();
  });

  it("marks the request that was just updated", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        recentlyUpdatedRequestId="request-1"
      />
    );

    expect(screen.getByText("CA-001").closest("tr")).toHaveClass(
      "is-recently-updated"
    );
  });

  it("renders request type as a dedicated filterable column", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request(),
          request({
            id: "request-2",
            requestNo: "EA-002",
            type: "ENGAGEMENT",
            clientPayload: null,
            engagementPayload: {
              clientId: "client-1",
              engagementCode: "ENG-2026-002",
            },
            status: "PENDING_PIC",
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByText("EA-002")).toBeInTheDocument();
    expect(screen.getByText("CA-001")).toBeInTheDocument();
    const grid = screen.getByTestId("cmp-acceptance-data-grid");
    const columnVisibility = within(grid).getByRole("button", {
      name: /Columns|显示列/,
    });
    expect(columnVisibility).toHaveTextContent(/Columns|显示列/);
    expect(
      within(grid)
        .getByText(/Client Acceptance|客户承接/)
        .closest('[data-slot="badge"]')
    ).toBeNull();
    expect(
      within(grid)
        .getByText(/Engagement Acceptance|业务承接/)
        .closest('[data-slot="badge"]')
    ).toBeNull();
    const [statusBadge] = within(grid).getAllByText(
      /Pending MIC|等待 MIC 审批/
    );
    expect(statusBadge).toHaveClass("rounded-sm");
    expect(statusBadge).toHaveClass(
      "text-foreground",
      "bg-warning-subtle",
      "before:bg-warning-accent"
    );
    expect(statusBadge).not.toHaveClass("rounded-full");
    expect(
      within(grid).getAllByText(/Pending PIC|等待 PIC 审批/)[0]
    ).toHaveClass(
      "text-foreground",
      "bg-warning-subtle",
      "before:bg-warning-accent"
    );
    expect(
      screen.queryByRole("button", { name: /All acceptance/i })
    ).toBeNull();
  });

  it("uses the filterable status column instead of status overview cards", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({ id: "draft", requestNo: "CA-DRAFT", status: "DRAFT" }),
          request({ id: "review", requestNo: "CA-REVIEW" }),
          request({
            id: "returned",
            requestNo: "CA-RETURNED",
            status: "RETURNED",
          }),
          request({
            id: "approved",
            requestNo: "CA-APPROVED",
            status: "APPROVED",
            currentStep: "DONE",
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("CA-REVIEW")).toBeInTheDocument();
    expect(screen.getByText("CA-DRAFT")).toBeInTheDocument();
    expect(screen.getByText("CA-RETURNED")).toBeInTheDocument();
    expect(screen.getByText("CA-APPROVED")).toBeInTheDocument();
  });

  it("shows approval actions for the current approver", () => {
    const onApprove = vi.fn();
    const onReturn = vi.fn();
    render(
      <CmpAcceptanceView
        mode="approvals"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={{ ...currentUser, id: "user-mic" }}
        onApprove={onApprove}
        onReturn={onReturn}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Approve comment"), {
      target: { value: "Looks good" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    expect(onApprove).toHaveBeenCalledWith("request-1", "Looks good");
  });

  it("shows My Approvals View as a complete Client form with direct approval and keeps Review unchanged", async () => {
    const onApprove = vi.fn(async () => {});
    render(
      <CmpAcceptanceView
        mode="approvals"
        requests={[
          request({
            clientPayload: {
              clientCode: "C-READONLY",
              companyNumber: "12345678",
              nameEn: "Read-only Client Limited",
              nameZh: "只读客户有限公司",
              status: "ACTIVE",
              yearEndDate: "2026-12-31",
              placeOfIncorporation: "Hong Kong",
              listedOrPrivate: "PRIVATE",
              clientPartnerPic: "PIC Partner",
              clientManagerMic: "MIC Manager",
              expectedJobOrEngagementType: "Annual audit",
              serviceLines: "Audit, Tax, Risk",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={{ ...currentUser, id: "user-mic" }}
        onApprove={onApprove}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const preview = screen.getByRole("dialog", {
      name: "Client acceptance form",
    });
    expect(within(preview).getByText("Client information")).toBeInTheDocument();
    expect(
      within(preview).getByText("Incorporation, Industry & Regulation")
    ).toBeInTheDocument();
    expect(within(preview).getByText("Audit, Tax, Risk")).toBeInTheDocument();
    expect(within(preview).queryByText(/PRC|Shareholding/)).toBeNull();
    expect(
      within(preview).queryByRole("region", { name: "Approval workflow" })
    ).toBeNull();
    expect(within(preview).getByText("Approval action")).toBeInTheDocument();
    const approveComment = within(preview).getByLabelText("Approve comment");
    const approveButton = within(preview).getByRole("button", {
      name: "Approve",
    });
    const returnReason = within(preview).getByLabelText("Return reason");
    const returnButton = within(preview).getByRole("button", {
      name: "Return to MIC",
    });
    expect(
      approveComment.compareDocumentPosition(approveButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      returnReason.compareDocumentPosition(returnButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    fireEvent.change(approveComment, {
      target: { value: "Approved from View" },
    });
    fireEvent.click(approveButton);
    expect(onApprove).toHaveBeenCalledWith("request-1", "Approved from View");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const review = screen.getByRole("dialog");
    expect(
      within(review).getByRole("region", { name: "Approval workflow" })
    ).toBeInTheDocument();
    expect(within(review).getByText("Approval action")).toBeInTheDocument();
  });

  it("returns directly from My Approvals View after a reason is provided", async () => {
    const onReturn = vi.fn(async () => {});
    render(
      <CmpAcceptanceView
        mode="approvals"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={{ ...currentUser, id: "user-mic" }}
        onReturn={onReturn}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const preview = screen.getByRole("dialog", {
      name: "Client acceptance form",
    });
    const returnButton = within(preview).getByRole("button", {
      name: "Return to MIC",
    });
    expect(returnButton).toBeDisabled();
    fireEvent.change(within(preview).getByLabelText("Return reason"), {
      target: { value: "Please correct the client name." },
    });
    expect(returnButton).toBeEnabled();
    fireEvent.click(returnButton);

    expect(onReturn).toHaveBeenCalledWith(
      "request-1",
      "Please correct the client name."
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("loads differences automatically before the complete form in My Approvals View", async () => {
    vi.spyOn(
      acceptanceChangesClient,
      "getCmpAcceptanceChanges"
    ).mockResolvedValue({
      status: "AVAILABLE",
      changedFieldCount: 1,
      baselineCapturedAt: "2026-07-05T00:00:00.000Z",
      staleMasterData: false,
      groups: [
        {
          section: "basicInformation",
          changes: [
            {
              field: "nameEn",
              kind: "MODIFIED",
              before: "Huaqian Limited",
              after: "Huaqian Advisory Limited",
            },
          ],
        },
      ],
    });
    render(
      <CmpAcceptanceView
        mode="approvals"
        requests={[
          request({
            type: "CLIENT_CHANGE",
            changedFieldCount: 1,
            targetClientId: "client-1",
            clientPayload: {
              clientCode: "C001",
              nameEn: "Huaqian Advisory Limited",
              serviceLines: "Audit, Tax",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={{ ...currentUser, id: "user-mic" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const preview = screen.getByRole("dialog", {
      name: "Client acceptance form",
    });
    await expect(
      within(preview).findAllByText("Huaqian Advisory Limited")
    ).resolves.not.toHaveLength(0);
    expect(within(preview).getByText("Huaqian Limited")).toBeInTheDocument();
    expect(within(preview).getByText("Audit, Tax")).toBeInTheDocument();
    expect(
      acceptanceChangesClient.getCmpAcceptanceChanges
    ).toHaveBeenCalledWith("request-1");
  });

  it("renders complete Engagement values in My Approvals View", () => {
    render(
      <CmpAcceptanceView
        mode="approvals"
        requests={[
          request({
            type: "ENGAGEMENT",
            clientPayload: null,
            engagementPayload: {
              clientId: "client-1",
              engagementCode: "ENG-2026-001",
              serviceType: "ANNUAL_AUDIT",
              yearEndDate: "2026-12-31",
              reportDate: "2027-03-31",
              approvalReferenceNumber: "APP-2026-001",
              engagementDate: "2026-07-01",
              budgetedHours: "120",
              agreedFee: "180000",
              recoveryRate: "82.50",
              feeCurrency: "HKD",
              pic: "PIC Partner",
              picUserId: "user-pic",
              mic: "MIC Manager",
              micUserId: "user-mic",
              status: "ACTIVE",
              remarks: "Core statutory audit engagement.",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={{ ...currentUser, id: "user-mic" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const preview = screen.getByRole("dialog", {
      name: "Engagement acceptance form",
    });
    expect(
      within(preview).getByText("C001 — Huaqian Limited")
    ).toBeInTheDocument();
    expect(within(preview).getAllByText("ENG-2026-001")).not.toHaveLength(0);
    expect(
      within(preview).getAllByText("HK$180,000.00").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(preview).getByText("Core statutory audit engagement.")
    ).toBeInTheDocument();
  });

  it("keeps request timestamps in View instead of the acceptance table", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    expect(
      screen.queryByRole("columnheader", { name: "Updated At" })
    ).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Current Step" })
    ).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "IT" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Request details")).toBeInTheDocument();
    expect(within(dialog).getByText("Updated at")).toBeInTheDocument();
    expect(
      within(dialog).queryByText("Approval route")
    ).not.toBeInTheDocument();
    expect(within(dialog).getByText("Approval history")).toBeInTheDocument();
  });

  it.each([
    ["DRAFT", "MIC", ["is-active", "is-upcoming", "is-upcoming"]],
    ["PENDING_PIC", "PIC", ["is-complete", "is-active", "is-upcoming"]],
    ["PENDING_IT", "IT", ["is-complete", "is-complete", "is-active"]],
    ["APPROVED", "DONE", ["is-complete", "is-complete", "is-complete"]],
  ] as const)(
    "shows the %s workflow state",
    (status, currentStep, expectedClasses) => {
      const { unmount } = render(
        <CmpAcceptanceView
          mode="acceptance"
          requests={[request({ status, currentStep })]}
          users={users}
          clients={clients}
          currentUser={currentUser}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "View" }));
      const workflow = within(screen.getByRole("dialog")).getByRole("region", {
        name: "Approval workflow",
      });
      const steps = within(workflow).getAllByRole("listitem");
      expectedClasses.forEach((className, index) => {
        expect(steps[index]).toHaveClass(className);
      });
      unmount();
    }
  );

  it("shows IT return while preserving the one-time PIC approval", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "RETURNED",
            currentStep: "MIC",
            workflowVersion: 2,
            returnedFromStep: "IT",
            returnReason: "Update the supporting documents",
            returnedAt: "2026-07-08T08:00:00.000Z",
            picApprovedAt: "2026-07-07T08:00:00.000Z",
            approvalSteps: [
              {
                id: "step-mic-approved",
                step: "MIC",
                approverId: "user-mic",
                approver: users[0],
                status: "APPROVED",
                comment: "Submitted",
                actedAt: "2026-07-06T08:00:00.000Z",
                createdAt: "2026-07-06T08:00:00.000Z",
              },
              {
                id: "step-pic-approved",
                step: "PIC",
                approverId: "user-pic",
                approver: users[1],
                status: "APPROVED",
                comment: "PIC approved once",
                actedAt: "2026-07-07T08:00:00.000Z",
                createdAt: "2026-07-07T08:00:00.000Z",
              },
              {
                id: "step-it-returned",
                step: "IT",
                approverId: "user-it",
                approver: users[2],
                status: "RETURNED",
                comment: "Update the supporting documents",
                actedAt: "2026-07-08T08:00:00.000Z",
                createdAt: "2026-07-08T08:00:00.000Z",
              },
            ],
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    const workflow = within(dialog).getByRole("region", {
      name: "Approval workflow",
    });
    const steps = within(workflow).getAllByRole("listitem");
    expect(steps[0]).toHaveClass("is-needs-changes");
    expect(steps[1]).toHaveClass("is-complete");
    expect(steps[2]).toHaveClass("is-returned");
    expect(within(dialog).getByText("Returned from IT")).toBeInTheDocument();
    expect(
      within(dialog).getAllByText("Update the supporting documents").length
    ).toBeGreaterThan(0);
    expect(within(dialog).getByText("PIC approved once")).toBeInTheDocument();
  });

  it("preserves the return route while Staff edits an IT-returned request", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: "user-junior",
            draftAssignee: users[3],
            returnedFromStep: "IT",
            returnReason: "Update the supporting documents",
            returnedAt: "2026-07-08T08:00:00.000Z",
            picApprovedAt: "2026-07-07T08:00:00.000Z",
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    const workflow = within(dialog).getByRole("region", {
      name: "Approval workflow",
    });
    const steps = within(workflow).getAllByRole("listitem");
    expect(steps[0]).toHaveClass("is-needs-changes");
    expect(steps[1]).toHaveClass("is-complete");
    expect(steps[2]).toHaveClass("is-returned");
    expect(
      within(dialog).getByText("Junior Staff is editing")
    ).toBeInTheDocument();
  });

  it("derives the return source from legacy approval history", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "RETURNED",
            currentStep: "MIC",
            returnedFromStep: null,
            returnReason: "Legacy IT return",
            approvalSteps: [
              {
                id: "step-it-returned",
                step: "IT",
                approverId: "user-it",
                approver: users[2],
                status: "RETURNED",
                comment: "Legacy IT return",
                actedAt: "2026-07-08T08:00:00.000Z",
                createdAt: "2026-07-08T08:00:00.000Z",
              },
            ],
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Returned from IT")).toBeInTheDocument();
    const workflow = within(dialog).getByRole("region", {
      name: "Approval workflow",
    });
    expect(within(workflow).getAllByRole("listitem")[2]).toHaveClass(
      "is-returned"
    );
  });

  it("keeps an effective approval comment tied to its approval record", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "APPROVED",
            currentStep: "DONE",
            picApprovedAt: "2026-07-08T08:00:00.000Z",
            approvalSteps: [
              {
                id: "step-pic-returned",
                step: "PIC",
                approverId: "user-pic",
                approver: users[1],
                status: "RETURNED",
                comment: "Outdated return comment",
                actedAt: "2026-07-07T08:00:00.000Z",
                createdAt: "2026-07-07T08:00:00.000Z",
              },
              {
                id: "step-pic-approved",
                step: "PIC",
                approverId: "user-pic",
                approver: users[1],
                status: "APPROVED",
                comment: null,
                actedAt: "2026-07-08T08:00:00.000Z",
                createdAt: "2026-07-08T08:00:00.000Z",
              },
            ],
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(
      within(screen.getByRole("dialog")).queryByText("Outdated return comment")
    ).toBeNull();
  });

  it("merges repeated role records into the latest role summary", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "PENDING_PIC",
            currentStep: "PIC",
            approvalSteps: [
              {
                id: "step-mic-old",
                step: "MIC",
                approverId: "user-mic",
                approver: users[0],
                status: "APPROVED",
                comment: "Old MIC comment",
                actedAt: "2026-07-05T08:00:00.000Z",
                createdAt: "2026-07-05T08:00:00.000Z",
              },
              {
                id: "step-mic-new",
                step: "MIC",
                approverId: "user-mic",
                approver: users[0],
                status: "APPROVED",
                comment: "Latest MIC comment",
                actedAt: "2026-07-06T08:00:00.000Z",
                createdAt: "2026-07-06T08:00:00.000Z",
              },
            ],
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Latest MIC comment")).toBeInTheDocument();
    expect(within(dialog).queryByText("Old MIC comment")).toBeNull();
    expect(within(dialog).getAllByRole("article")).toHaveLength(3);
  });

  it("shows delegated Staff readiness beneath MIC", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "DRAFT",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: "user-junior",
            draftAssignee: users[3],
            draftCompletedAt: "2026-07-06T08:00:00.000Z",
            draftCompletedById: "user-junior",
            draftCompletedBy: users[3],
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(
      within(screen.getByRole("dialog")).getByText(/Junior Staff ready/)
    ).toBeInTheDocument();
  });

  it.each([
    ["not delegated", {}, "Not delegated"],
    [
      "being edited",
      {
        status: "STAFF_EDITING",
        draftAssigneeId: "user-junior",
        draftAssignee: users[3],
      },
      "Junior Staff is editing",
    ],
  ])("shows the Staff draft as %s", (_label, draftState, expectedText) => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "DRAFT",
            currentStep: "MIC",
            workflowVersion: 2,
            ...draftState,
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(
      within(screen.getByRole("dialog")).getByText(expectedText)
    ).toBeInTheDocument();
  });

  it("manages dialog focus and closes with Escape", async () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    const viewButton = screen.getByRole("button", { name: "View" });
    viewButton.focus();
    fireEvent.click(viewButton);
    expect(screen.getByRole("dialog")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(viewButton).toHaveFocus());
  });

  it("renders approval controls in the dialog footer only for the current approver", () => {
    const { rerender } = render(
      <CmpAcceptanceView
        mode="approvals"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={{ ...currentUser, id: "user-mic" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(
      within(screen.getByRole("dialog"))
        .getByText("Approval action")
        .closest("footer")
    ).not.toBeNull();

    rerender(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );
    expect(screen.queryByText("Approval action")).toBeNull();
  });

  it("requires a return reason before returning to staff", () => {
    const onReturn = vi.fn();
    render(
      <CmpAcceptanceView
        mode="approvals"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={{ ...currentUser, id: "user-mic" }}
        onReturn={onReturn}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Return to MIC" })
    ).toBeDisabled();
  });

  it("opens a request from a selected request id and can prefilter status", () => {
    const onDetailClose = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({ id: "request-1", status: "PENDING_MIC" }),
          request({
            id: "request-2",
            requestNo: "CA-002",
            status: "RETURNED",
            returnReason: "Needs update",
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        initialStatus="RETURNED"
        selectedRequestId="request-2"
        onDetailClose={onDetailClose}
      />
    );

    expect(screen.queryByText("CA-001")).not.toBeInTheDocument();
    expect(screen.getAllByText("CA-002").length).toBeGreaterThan(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Returned from MIC")).toBeInTheDocument();
    expect(screen.getAllByText("Needs update").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Close acceptance details" })
    );
    expect(onDetailClose).toHaveBeenCalledOnce();
  });

  it("prefilters both MIC drafts and Staff editing requests", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            id: "request-draft",
            requestNo: "CA-DRAFT",
            status: "DRAFT",
          }),
          request({
            id: "request-staff",
            requestNo: "CA-STAFF",
            status: "STAFF_EDITING",
            draftAssigneeId: "user-junior",
            draftAssignee: users[3],
          }),
          request({
            id: "request-returned",
            requestNo: "CA-RETURNED",
            status: "RETURNED",
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        initialStatus="DRAFT,STAFF_EDITING"
      />
    );

    expect(screen.getByText("CA-DRAFT")).toBeInTheDocument();
    expect(screen.getByText("CA-STAFF")).toBeInTheDocument();
    expect(screen.queryByText("CA-RETURNED")).not.toBeInTheDocument();
  });

  it("distinguishes client acceptance and client change in the type column and filter", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request(),
          request({
            id: "request-2",
            requestNo: "CC-002",
            type: "CLIENT_CHANGE",
            targetClientId: "client-1",
            clientPayload: {
              clientCode: "C001",
              nameZh: "Updated Client CN",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    expect(
      screen.getAllByText(/Client Acceptance|客户承接/).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Client Change|客户资料变更/).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Type" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Filter" }));
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", {
        name: /Client Change|客户资料变更/,
      })
    );

    expect(screen.queryByText("CA-001")).not.toBeInTheDocument();
    expect(screen.getByText("CC-002")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Client Change|客户资料变更/).length
    ).toBeGreaterThan(0);
  });

  it("does not render a duplicate acceptance filter panel", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[request()]}
        users={users}
        clients={clients}
        currentUser={currentUser}
      />
    );

    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "cmp-acceptance-requests-tab"
    );
  });

  it("lets assigned Staff mark a V2 draft ready for MIC", () => {
    const onCompleteDraft = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: currentUser.id,
            draftAssignee: currentUser,
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        onCompleteDraft={onCompleteDraft}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark ready for MIC" }));
    expect(onCompleteDraft).toHaveBeenCalledWith("request-1");
  });

  it("lets assigned Staff return a Partner-owned draft to the request owner", () => {
    const onCompleteDraft = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            submittedById: "user-pic",
            submittedBy: users[1],
            submittedAt: null,
            micApproverId: "user-mic",
            micApprover: users[0],
            draftAssigneeId: currentUser.id,
            draftAssignee: currentUser,
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        onCompleteDraft={onCompleteDraft}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Mark ready for request owner" })
    );
    expect(onCompleteDraft).toHaveBeenCalledWith("request-1");
  });

  it("shows request-scoped progress while other Staff drafts remain available", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            id: "request-pending",
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: currentUser.id,
            draftAssignee: currentUser,
          }),
          request({
            id: "request-available",
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: currentUser.id,
            draftAssignee: currentUser,
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        pendingActions={[{ requestId: "request-pending", kind: "complete" }]}
      />
    );

    expect(
      screen.getByRole("button", { name: "Marking ready for MIC..." })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Mark ready for MIC" })
    ).not.toBeDisabled();
    expect(screen.getAllByRole("button", { name: "View" })[0]).toBeDisabled();
  });

  it("shows nonblocking workspace feedback while a Staff action completes", async () => {
    vi.useFakeTimers();
    let resolveCompletion: (() => void) | undefined;
    const onCompleteDraft = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCompletion = resolve;
        })
    );
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            id: "request-pending",
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: currentUser.id,
            draftAssignee: currentUser,
          }),
          request({
            id: "request-available",
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: currentUser.id,
            draftAssignee: currentUser,
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        onCompleteDraft={onCompleteDraft}
      />
    );

    const readyButtons = screen.getAllByRole("button", {
      name: "Mark ready for MIC",
    });
    fireEvent.click(expectPresent(readyButtons[0]));
    expect(onCompleteDraft).toHaveBeenCalledWith("request-pending");
    expect(readyButtons[1]).toBeEnabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    const feedback = screen.getByRole("status");
    expect(feedback).toHaveAttribute("data-presentation", "workspace");
    expect(feedback).toHaveTextContent("Marking ready for MIC...");

    await act(async () => {
      resolveCompletion?.();
      await Promise.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Draft returned to MIC"
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("locks a pending approval while its existing View dialog shows progress", () => {
    render(
      <CmpAcceptanceView
        mode="approvals"
        requests={[
          request({
            status: "PENDING_PIC",
            currentStep: "PIC",
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={users[1]}
        pendingActions={[{ requestId: "request-1", kind: "approve" }]}
        selectedRequestId="request-1"
      />
    );

    expect(screen.getByRole("button", { name: "View" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Approving..." })).toBeDisabled();
  });

  it("lets assigned Staff save an incomplete engagement draft", async () => {
    const onUpdate = vi.fn(async () => {});
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            type: "ENGAGEMENT",
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: currentUser.id,
            draftAssignee: currentUser,
            clientPayload: null,
            engagementPayload: {
              clientId: "client-1",
              engagementCode: "",
              serviceType: "AUDIT",
              budgetedHours: "",
              agreedFee: "",
              feeCurrency: "HKD",
              picUserId: "user-pic",
              micUserId: "user-mic",
              pic: "PIC Partner",
              mic: "MIC Manager",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Save Draft" }));
    expect(onUpdate).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({
        engagementPayload: expect.objectContaining({
          clientId: "client-1",
          engagementCode: "",
          budgetedHours: "",
        }),
      })
    );

    await waitFor(
      () => {
        expect(
          within(dialog).getByRole("button", { name: "Save changes" })
        ).toBeEnabled();
      },
      { timeout: 15_000 }
    );
    onUpdate.mockClear();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" })
    );
    expect(onUpdate).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({
        engagementPayload: expect.objectContaining({
          clientId: "client-1",
          engagementCode: "",
          agreedFee: "",
        }),
      })
    );
  });

  it("uses the Engagement workspace actions when a MIC edits an Acceptance draft", async () => {
    const onUpdate = vi.fn(async () => {});
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            type: "ENGAGEMENT",
            status: "DRAFT",
            currentStep: "MIC",
            workflowVersion: 2,
            submittedById: "user-mic",
            submittedBy: users[0],
            micApproverId: "user-mic",
            micApprover: users[0],
            clientPayload: null,
            engagementPayload: {
              clientId: "client-1",
              engagementCode: "ENG-001",
              serviceType: "ANNUAL_AUDIT",
              budgetedHours: "10",
              agreedFee: "1000",
              feePlanningLines: [
                {
                  key: "budget-1",
                  grade: "MANAGER",
                  assignmentType: "TBC",
                  staffUserId: null,
                  hourlyRate: "100.00",
                  budgetHours: "10.00",
                  sortOrder: 0,
                },
              ],
              feeCurrency: "HKD",
              picUserId: "user-pic",
              micUserId: "user-mic",
              pic: "PIC Partner",
              mic: "MIC Manager",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={users[0]}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    expect(
      dialog.querySelector(".cmp-form-workspace-frame")
    ).toBeInTheDocument();
    expect(dialog.querySelector(".cmp-form-actions")).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("navigation", {
        name: "Engagement request sections",
      })
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Draft assignment")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Save Draft" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Next" })
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Assign to"), {
      target: { value: "user-junior" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Assign" }));
    expect(onUpdate).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({ draftAssigneeId: "user-junior" })
    );

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Next" })
      ).toBeEnabled();
    });
    onUpdate.mockClear();
    goToAcceptanceReview(dialog);
    fireEvent.click(
      expectPresent(
        within(dialog).getAllByRole("button", { name: "Submit to PIC" }).at(-1)
      )
    );
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        "request-1",
        expect.objectContaining({ submit: true })
      )
    );
    expect(onUpdate).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({ submit: true })
    );
  });

  it("lets a Partner reopen and manage their own unsubmitted draft", () => {
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "DRAFT",
            currentStep: "MIC",
            workflowVersion: 2,
            submittedById: "user-pic",
            submittedBy: users[1],
            submittedAt: null,
            micApproverId: "user-mic",
            micApprover: users[0],
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={users[1]}
        onUpdate={async () => {}}
      />
    );

    expect(
      screen.getByRole("button", { name: "Submit to MIC" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Draft assignment")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Request owner owns this draft")
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Next" })
    ).toBeInTheDocument();
  });

  it("marks the Engagement navigation when formal validation fails", () => {
    const onUpdate = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            type: "ENGAGEMENT",
            status: "DRAFT",
            currentStep: "MIC",
            workflowVersion: 2,
            submittedById: "user-mic",
            submittedBy: users[0],
            micApproverId: "user-mic",
            micApprover: users[0],
            clientPayload: null,
            engagementPayload: {
              clientId: "client-1",
              engagementCode: "ENG-002",
              serviceType: "AUDIT",
              budgetedHours: "10",
              agreedFee: "",
              feeCurrency: "HKD",
              picUserId: "user-pic",
              micUserId: "user-mic",
              pic: "PIC Partner",
              mic: "MIC Manager",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={users[0]}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    goToAcceptanceReview(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Submit to PIC" })
    );

    expect(onUpdate).not.toHaveBeenCalled();
    expect(
      within(dialog).getByRole("tab", {
        name: /1\. Engagement Setup: Has errors/,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Confirm submission" })
    ).not.toBeInTheDocument();
  });

  it("requires an explicit Service Type in an Engagement draft", () => {
    const onUpdate = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            type: "ENGAGEMENT",
            status: "DRAFT",
            currentStep: "MIC",
            workflowVersion: 2,
            submittedById: "user-mic",
            submittedBy: users[0],
            micApproverId: "user-mic",
            micApprover: users[0],
            clientPayload: null,
            engagementPayload: {
              clientId: "client-1",
              engagementCode: "ENG-003",
              budgetedHours: "10",
              agreedFee: "1000",
              feeCurrency: "HKD",
              picUserId: "user-pic",
              micUserId: "user-mic",
              pic: "PIC Partner",
              mic: "MIC Manager",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={users[0]}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    goToAcceptanceReview(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Submit to PIC" })
    );

    expect(onUpdate).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText("Service Type is required.")
    ).toBeInTheDocument();
  });

  it("opens the form and locates errors before submitting a MIC draft", async () => {
    const onSubmit = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "DRAFT",
            currentStep: "MIC",
            workflowVersion: 2,
            submittedById: "user-mic",
            submittedBy: users[0],
            micApproverId: "user-mic",
            micApprover: users[0],
            clientPayload: {
              clientCode: "",
              nameEn: "",
              status: "PROSPECT",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={users[0]}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit to PIC" }));

    const dialog = screen.getByRole("dialog");
    const clientCode = dialog.querySelector<HTMLInputElement>(
      '[data-validation-field="clientCode"]'
    );
    expect(clientCode).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(clientCode).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(clientCode).toHaveFocus());
  });

  it("allows a blank Recovery Rate when a MIC edits an Engagement", () => {
    const onSubmit = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            type: "ENGAGEMENT",
            status: "DRAFT",
            currentStep: "MIC",
            workflowVersion: 2,
            submittedById: "user-mic",
            submittedBy: users[0],
            micApproverId: "user-mic",
            micApprover: users[0],
            clientPayload: null,
            engagementPayload: {
              clientId: "client-1",
              engagementCode: "ENG-RECOVERY",
              serviceType: "AUDIT",
              budgetedHours: "10",
              agreedFee: "1000",
              recoveryRate: "",
              feeCurrency: "HKD",
              picUserId: "user-pic",
              micUserId: "user-mic",
              pic: "PIC Partner",
              mic: "MIC Manager",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={users[0]}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit to PIC" }));
    const dialog = screen.getByRole("dialog");
    const recoveryRate =
      within(dialog).getByText("Recovery Rate (%)").parentElement;
    const mic = within(dialog).getByText("MIC Manager");
    expect(recoveryRate).toHaveTextContent("—");
    expect(mic).toHaveTextContent("MIC Manager");

    expect(within(dialog).queryByLabelText("Budget Fee Next Year")).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("locates invalid Engagement values while editing an Acceptance draft", async () => {
    const onUpdate = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            type: "ENGAGEMENT",
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: currentUser.id,
            draftAssignee: currentUser,
            clientPayload: null,
            engagementPayload: {
              clientId: "client-1",
              engagementCode: "ENG-001",
              serviceType: "AUDIT",
              budgetedHours: "10",
              recoveryRate: "",
              agreedFee: "-1",
              feeCurrency: "HKD",
              picUserId: "user-pic",
              micUserId: "user-mic",
              pic: "PIC Partner",
              mic: "MIC Manager",
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" })
    );

    expect(onUpdate).not.toHaveBeenCalled();
    expect(
      within(dialog).getByRole("tab", {
        name: /2\. Budget: Has errors/,
      })
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("tab", { name: /2\. Budget/ }));
    const agreedFee = within(dialog).getByLabelText("Agreed Fee");
    expect(agreedFee).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(agreedFee).toHaveFocus());
  });

  it("lets assigned Staff save an incomplete client request with a related company", () => {
    const onUpdate = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "STAFF_EDITING",
            currentStep: "MIC",
            workflowVersion: 2,
            draftAssigneeId: currentUser.id,
            draftAssignee: currentUser,
            picApproverId: null,
            picApprover: null,
            itApproverId: null,
            itApprover: null,
            targetClientId: "",
            targetEngagementId: "",
            clientPayload: {
              clientCode: "C-NEW",
              nameZh: "New Client CN",
              relatedEntities: [
                {
                  draftKey: "holding",
                  kind: "COMPANY",
                  displayName: "ABC Holdings Ltd",
                  companyProfile: {
                    identifierType: "COMPANY_REGISTRATION_NUMBER",
                    identifierValue: "CR-123",
                  },
                },
              ],
              relatedRelationships: [],
            },
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={currentUser}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" })
    );

    expect(onUpdate).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({
        clientPayload: expect.objectContaining({
          clientCode: "C-NEW",
          nameZh: "New Client CN",
        }),
        picApproverId: undefined,
        itApproverId: undefined,
        targetClientId: undefined,
        targetEngagementId: undefined,
      })
    );
    expect(
      UpdateCmpAcceptanceRequestSchema.safeParse(onUpdate.mock.calls[0]?.[1])
        .success
    ).toBeTruthy();
  });

  it("lets the MIC assign a V2 draft to Staff from the detail view", () => {
    const onAssignDraft = vi.fn();
    const requestState = {
      status: "DRAFT",
      currentStep: "MIC",
      workflowVersion: 2,
      submittedById: "user-mic",
      submittedBy: users[0],
      micApproverId: "user-mic",
      micApprover: users[0],
    };
    const { rerender } = render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[request(requestState)]}
        users={users}
        clients={clients}
        currentUser={users[0]}
        onAssignDraft={onAssignDraft}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Assign to"), {
      target: { value: "user-junior" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Assign draft" })
    );

    expect(onAssignDraft).toHaveBeenCalledWith("request-1", "user-junior");

    rerender(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            ...requestState,
            status: "STAFF_EDITING",
            draftAssigneeId: "user-junior",
            draftAssignee: users[3],
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={users[0]}
        onAssignDraft={onAssignDraft}
      />
    );

    expect(
      within(screen.getByRole("dialog")).getByText("Junior Staff is editing")
    ).toBeInTheDocument();
    const recallDraftButton = within(screen.getByRole("dialog")).getByRole(
      "button",
      {
        name: "Recall draft",
      }
    );
    expect(recallDraftButton).toBeInTheDocument();
    expect(
      recallDraftButton.closest(".cmp-draft-delegation-actions")
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("lets the MIC resubmit directly to IT after PIC approval", () => {
    const onSubmit = vi.fn();
    render(
      <CmpAcceptanceView
        mode="acceptance"
        requests={[
          request({
            status: "RETURNED",
            currentStep: "MIC",
            workflowVersion: 2,
            submittedById: "user-mic",
            submittedBy: users[0],
            micApproverId: "user-mic",
            micApprover: users[0],
            picApprovedAt: "2026-07-05T00:00:00.000Z",
            returnedFromStep: "IT",
            clientPayload: completeClientPayload(),
          }),
        ]}
        users={users}
        clients={clients}
        currentUser={users[0]}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Resubmit to IT" }));
    expect(onSubmit).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("dialog", {
      name: "Confirm submission",
    });
    expect(
      within(confirmation).getByText(
        "Are you sure you want to submit this request?"
      )
    ).toBeInTheDocument();
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Resubmit to IT" })
    );
    expect(onSubmit).toHaveBeenCalledWith("request-1");
  });
});
