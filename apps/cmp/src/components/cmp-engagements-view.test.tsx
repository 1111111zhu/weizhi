// @vitest-environment jsdom

import type { CmpEngagement, TmsEngagementSummary } from "@project-wing/shared";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CmpEngagementsView } from "./cmp-engagements-view";

const SUBMISSION_FAILURE_TEST_TIMEOUT_MS = 60_000;

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

vi.mock("./cmp-engagement-associations", () => ({
  CmpEngagementAssociations: () => null,
}));

function chooseSearchOption(
  container: HTMLElement,
  label: string,
  optionName: RegExp
) {
  fireEvent.click(
    within(container).getByRole("button", { name: label, hidden: true })
  );
  fireEvent.click(
    within(container).getByRole("option", { name: optionName, hidden: true })
  );
}

function goToEngagementReview(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("tab", { name: /4\. Preview/ }));
}

async function enterSinglePersonBudget(dialog: HTMLElement, hours = "480.00") {
  fireEvent.click(within(dialog).getByRole("tab", { name: /2\. Budget/ }));
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Enter budget details" })
  );
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Firm Grade" }));
  const gradeOption = screen.getByRole("option", { name: /^(Manager|经理)$/ });
  fireEvent.pointerDown(gradeOption, { button: 0 });
  fireEvent.pointerUp(gradeOption, { button: 0 });
  fireEvent.click(gradeOption);
  await waitFor(() =>
    expect(
      within(dialog).getByRole("combobox", { name: "Firm Grade" })
    ).toHaveTextContent(/Manager|经理/)
  );
  fireEvent.change(
    within(dialog).getByRole("spinbutton", { name: "Budget in Hours" }),
    { target: { value: hours } }
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Select staff" }));
  fireEvent.click(screen.getByRole("button", { name: "Add TBC" }));
}

const clients = [
  {
    id: "client-1",
    clientCode: "C001",
    companyNumber: "1234567",
    nameZh: "Huaqian Limited CN",
    nameEn: "Huaqian Limited",
    groupId: null,
    group: null,
    address: null,
    contactPerson: "Amy Chan",
    telephone: null,
    email: null,
    website: null,
    yearEndDate: "2026-12-31",
    yearEndMonth: 12,
    reportingGaap: "HKFRS",
    hsicSectionCode: "G" as const,
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
    clientPartnerPic: "Partner A",
    clientPartnerPicId: "user-pic",
    clientManagerMic: "Manager B",
    alternativePartnerSecondMic: null,
    expectedJobOrEngagementType: "Annual audit",
    serviceType: "Annual Audit",
    serviceLines: "Audit",
    approvalReferenceNumber: "NCA-001",
    approvalDate: "2026-02-01",
    preparedBy: null,
    approvedBy: null,
    micApproval: null,
    picApproval: null,
    itAdmin: null,
    signOffDate: null,
    status: "ACTIVE" as const,
    createdById: "user-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
  },
];
const engagements: CmpEngagement[] = [
  {
    id: "engagement-1",
    clientId: "client-1",
    client: {
      id: "client-1",
      clientCode: "C001",
      nameZh: "Huaqian Limited CN",
      nameEn: "Huaqian Limited",
      status: "ACTIVE" as const,
    },
    engagementCode: "C001-2026-AUD",
    serviceType: "ANNUAL_AUDIT" as const,
    otherServiceDescription: null,
    deliverables: [],
    yearEndDate: "2026-12-31",
    reportDate: "2027-03-31",
    approvalReferenceNumber: "NEA-001",
    engagementDate: "2026-02-10",
    budgetedHours: "420.00",
    agreedFee: "180000.00",
    recoveryRate: "84.50",
    feePlanningLines: [
      {
        id: "fee-plan-1",
        grade: "MANAGER" as const,
        assignmentType: "TBC" as const,
        hourlyRate: "2400.00",
        budgetHours: "420.00",
        dateFrom: null,
        dateTo: null,
        lineTotal: "1008000.00",
        staff: null,
        sortOrder: 0,
      },
    ],
    feeNotes: [],
    feeCurrency: "HKD",
    amlRiskClassification: "NOT_HIGH" as const,
    engagementRiskClassification: "NORMAL" as const,
    picUserId: "user-pic",
    micUserId: "user-mic",
    eqReviewerUserId: null,
    pic: "Partner A",
    mic: "Manager B",
    eqReviewer: null,
    status: "ACTIVE" as const,
    remarks: "Demo engagement",
    createdById: "user-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    codeAliases: [] as string[],
  },
];
const secondClient = {
  ...clients[0],
  id: "client-2",
  clientCode: "C002",
  companyNumber: "7654321",
  nameZh: "Second Client CN",
  nameEn: "Second Client",
};
const secondEngagement: CmpEngagement = {
  ...engagements[0],
  id: "engagement-2",
  clientId: secondClient.id,
  client: {
    id: secondClient.id,
    clientCode: secondClient.clientCode,
    nameZh: secondClient.nameZh,
    nameEn: secondClient.nameEn,
    status: "ACTIVE",
  },
  engagementCode: "C002-2026-REV",
  serviceType: "REVIEW",
  pic: "Partner C",
  status: "ARCHIVED",
};
const users = [
  {
    id: "user-mic",
    email: "mic@example.com",
    name: "MIC Manager",
    globalRole: "MANAGER" as const,
  },
  {
    id: "user-mic-z",
    email: "manager.z@example.com",
    name: "Manager Z",
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
    id: "user-staff",
    email: "staff@example.com",
    name: "Staff User",
    globalRole: "STAFF" as const,
  },
];
const tmsSummary: TmsEngagementSummary = {
  approved: {
    rows: [
      {
        userId: "user-staff",
        name: "Staff User",
        budgetNormal: null,
        budgetOt: null,
        finalNormal: 8,
        finalOt: null,
        absent: null,
        rate: null,
        budgetCost: null,
        actualCost: null,
        diff: null,
      },
    ],
    total: {
      userId: "total",
      name: "Total",
      budgetNormal: null,
      budgetOt: null,
      finalNormal: 8,
      finalOt: null,
      absent: null,
      rate: null,
      budgetCost: null,
      actualCost: null,
      diff: null,
    },
  },
  draft: {
    rows: [],
    total: {
      userId: "total",
      name: "Total",
      budgetNormal: null,
      budgetOt: null,
      finalNormal: null,
      finalOt: null,
      absent: null,
      rate: null,
      budgetCost: null,
      actualCost: null,
      diff: null,
    },
  },
};

describe(CmpEngagementsView, () => {
  it("renders engagement master data in a dense table", () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    expect(screen.queryByText("Engagement Management")).not.toBeInTheDocument();
    expect(screen.getByText("Engagement")).toBeInTheDocument();
    expect(screen.getByText("C001-2026-AUD")).toBeInTheDocument();
    expect(screen.getByText("Huaqian Limited")).toBeInTheDocument();
    expect(screen.getByText("NEA-001")).toBeInTheDocument();
    const grid = screen.getByTestId("cmp-engagements-data-grid");
    expect(screen.getAllByTestId("cmp-engagements-data-grid")).toHaveLength(1);
    expect(within(grid).getByText("Active")).toBeInTheDocument();
  });

  it("keeps Engagement drafts out of the formal table and switches to a draft view", () => {
    render(
      <CmpEngagementsView
        clients={clients}
        drafts={
          [
            {
              request: {
                id: "engagement-draft-1",
                requestNo: "EA-DRAFT-001",
                createdAt: "2026-08-23T00:00:00.000Z",
                updatedAt: "2026-08-23T02:00:00.000Z",
                submittedById: "user-mic",
                engagementPayload: {
                  clientId: "client-1",
                  engagementCode: "C001-2027-AUD",
                  serviceType: "ANNUAL_AUDIT",
                },
              },
              displayStatus: "DRAFT",
              currentOwner: {
                id: "user-mic",
                name: "MIC Manager",
                email: "mic@example.com",
                globalRole: "MANAGER",
              },
              canEdit: true,
              canDelete: true,
            },
          ] as never
        }
        engagements={engagements}
        users={users}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    const grid = screen.getByTestId("cmp-engagements-data-grid");
    expect(grid).not.toHaveTextContent("C001-2027-AUD");
    expect(screen.queryByRole("link", { name: /EA-DRAFT-001/ })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Show drafts|显示草稿/ })
    );
    const draftGrid = screen.getByTestId("cmp-engagements-data-grid");
    expect(screen.getAllByTestId("cmp-engagements-data-grid")).toHaveLength(1);
    expect(draftGrid).toHaveTextContent("C001-2027-AUD");
    expect(within(draftGrid).getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /EA-DRAFT-001/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/acceptance/requests/engagement-draft-1/edit")
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Back to records|返回主表/ })
    );
    expect(
      screen.getByTestId("cmp-engagements-data-grid")
    ).not.toHaveTextContent("C001-2027-AUD");
  });

  it("keeps the completed Engagement badge on the info color", () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={[{ ...engagements[0], status: "COMPLETED" }]}
        users={users}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    expect(
      within(screen.getByTestId("cmp-engagements-data-grid")).getByText(
        "Completed"
      )
    ).toBeInTheDocument();
  });

  it("groups Engagements into expandable Client cards", () => {
    render(
      <CmpEngagementsView
        clients={[...clients, secondClient]}
        engagements={[...engagements, secondEngagement]}
        users={users}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Group by Client" }));

    const groups = screen.getByTestId("cmp-engagement-client-groups");
    const firstGroup = groups.querySelector('[data-client-id="client-1"]');
    const secondGroup = groups.querySelector('[data-client-id="client-2"]');
    expect(firstGroup).not.toBeNull();
    expect(secondGroup).not.toBeNull();
    expect(
      within(firstGroup as HTMLElement).getByRole("button", {
        name: "Collapse engagements for C001",
      })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(secondGroup as HTMLElement).getByText("C002-2026-REV")
    ).toBeInTheDocument();

    fireEvent.click(
      within(firstGroup as HTMLElement).getByRole("button", {
        name: "Collapse engagements for C001",
      })
    );
    expect(
      within(firstGroup as HTMLElement).queryByText("C001-2026-AUD")
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(
      screen.queryByTestId("cmp-engagement-client-groups")
    ).not.toBeInTheDocument();
    expect(screen.getByText("C001-2026-AUD")).toBeInTheDocument();
  });

  it("opens Engagement and Client records in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        initialView="list"
        onSubmitEngagementAcceptance={vi.fn()}
      />
    );

    const previewAction = screen.getByRole("button", {
      name: "Preview Engagement C001-2026-AUD",
    });
    expect(previewAction).toHaveAttribute("data-variant", "quiet");
    expect(previewAction).toHaveAttribute("data-size", "md");
    expect(previewAction).not.toHaveAttribute("data-legacy-variant");
    expect(previewAction).not.toHaveAttribute("data-legacy-size");

    fireEvent.click(previewAction);
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("/engagement/engagement-1"),
      "_blank",
      "noopener,noreferrer"
    );

    fireEvent.click(screen.getByRole("button", { name: "Group by Client" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Preview Client C001" })
    );
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("/client/client-1"),
      "_blank",
      "noopener,noreferrer"
    );
    open.mockRestore();
  });

  it("does not open a preview when editing an Engagement", () => {
    const onEditEngagement = vi.fn();
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        onEditEngagement={onEditEngagement}
        onSubmitEngagementAcceptance={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEditEngagement).toHaveBeenCalledWith(engagements[0]);
    expect(
      screen.queryByRole("dialog", {
        name: "Engagement preview · C001-2026-AUD",
      })
    ).not.toBeInTheDocument();
  });

  it("opens the matching Billing list from the Engagement action column", () => {
    const onOpenFeeNote = vi.fn();
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        onOpenFeeNote={onOpenFeeNote}
        onSubmitEngagementAcceptance={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open billing" }));

    expect(onOpenFeeNote).toHaveBeenCalledWith(engagements[0]);
  });

  it("opens the grouped view at a targeted Client, including zero results", () => {
    render(
      <CmpEngagementsView
        clients={[...clients, secondClient]}
        engagements={engagements}
        users={users}
        initialView="client"
        initialGroupedClientId={secondClient.id}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    const groups = screen.getByTestId("cmp-engagement-client-groups");
    const firstGroup = groups.querySelector('[data-client-id="client-1"]');
    const targetGroup = groups.querySelector('[data-client-id="client-2"]');
    expect(targetGroup).toHaveClass("ring-2", "ring-primary/50");
    expect(
      within(firstGroup as HTMLElement).getByRole("button", {
        name: "Expand engagements for C001",
      })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      within(targetGroup as HTMLElement).getByRole("button", {
        name: "Collapse engagements for C002",
      })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(targetGroup as HTMLElement).getByText(
        "No engagements for this Client."
      )
    ).toBeInTheDocument();
  });

  it("uses column filters without a duplicate global filter panel", () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "PIC" }));
    expect(
      screen.getByRole("menuitem", { name: "Filter" })
    ).toBeInTheDocument();
  });

  it("filters engagements using the page-level search", () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        searchValue="not present"
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    expect(screen.queryByText("C001-2026-AUD")).not.toBeInTheDocument();
    expect(screen.getByText("No matching engagements")).toBeInTheDocument();
  });

  it(
    "keeps engagement input available when a submission fails",
    async () => {
      let rejectSubmission: ((error: Error) => void) | undefined;
      const onSubmitEngagementAcceptance = vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectSubmission = reject;
          })
      );
      render(
        <CmpEngagementsView
          clients={clients}
          engagements={engagements}
          users={users}
          onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
        />
      );

      const newEngagementButton = screen.getByRole("button", {
        name: "New Engagement",
      });
      expect(newEngagementButton).toHaveTextContent("New Engagement");
      expect(newEngagementButton).toHaveAttribute("data-variant", "secondary");
      expect(newEngagementButton).toHaveAttribute("data-size", "sm");
      expect(newEngagementButton).not.toHaveAttribute(
        "data-slot",
        "tooltip-trigger"
      );
      expect(newEngagementButton).not.toHaveTextContent(
        "New Engagement Acceptance"
      );
      expect(newEngagementButton).not.toHaveAttribute("data-action-id");
      expect(
        screen.queryByTestId("expandable-action-bar")
      ).not.toBeInTheDocument();
      fireEvent.click(newEngagementButton);
      const dialog = screen.getByRole("dialog", {
        name: "New engagement acceptance",
      });

      expect(
        within(dialog).queryByText("Acceptance approval No.")
      ).not.toBeInTheDocument();
      expect(
        within(dialog).queryByText("Generated after final approval")
      ).not.toBeInTheDocument();

      fireEvent.change(within(dialog).getByLabelText("Engagement Code"), {
        target: { value: "C001-2027-AUD" },
      });
      fireEvent.change(within(dialog).getByLabelText("Service Type"), {
        target: { value: "ANNUAL_AUDIT" },
      });
      chooseSearchOption(dialog, "Client", /C001 - Huaqian Limited/);
      chooseSearchOption(dialog, "PIC", /PIC Partner/);
      chooseSearchOption(dialog, "MIC", /MIC Manager/);
      fireEvent.change(within(dialog).getByLabelText("Agreed Fee"), {
        target: { value: "200000.00" },
      });
      await enterSinglePersonBudget(dialog);
      goToEngagementReview(dialog);
      fireEvent.click(screen.getByRole("button", { name: /Submit/ }));

      expect(onSubmitEngagementAcceptance).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ENGAGEMENT",
          submit: true,
          engagementPayload: expect.objectContaining({
            clientId: "client-1",
            engagementCode: "C001-2027-AUD",
            serviceType: "ANNUAL_AUDIT",
            budgetedHours: "480.00",
            agreedFee: "200000.00",
            feeCurrency: "HKD",
          }),
        })
      );

      await act(async () => {
        rejectSubmission?.(new Error("Submission failed"));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(
          screen.getByRole("dialog", { name: "New engagement acceptance" })
        ).toBeInTheDocument();
        expect(
          within(dialog).getByRole("button", {
            name: /Submit/,
          })
        ).toBeEnabled();
      });
      const previewTrigger = within(dialog).getByRole("button", {
        name: "Preview Complete",
      });
      expect(previewTrigger).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(previewTrigger);
      expect(previewTrigger).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(within(dialog).getByRole("tab", { name: /4\. Preview/ }));
      expect(previewTrigger).toHaveAttribute("aria-expanded", "true");
    },
    SUBMISSION_FAILURE_TEST_TIMEOUT_MS
  );

  it("requires an explicit Client when creating from the engagement list", () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });
    expect(
      within(dialog).getByRole("button", { name: "Client" })
    ).toHaveTextContent("Select client");
    expect(within(dialog).getByLabelText("Year End")).toHaveValue("");
  });

  it("uses compact risk selectors and clears conditional people when risk is lowered", async () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });
    fireEvent.click(
      within(dialog).getByRole("tab", { name: /1\. Engagement Setup/i })
    );

    expect(
      within(dialog).getByText("Required responsible persons: PIC · MIC")
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("combobox", { name: "Engagement Risk" })
    );
    const greaterRiskOption = screen.getByRole("option", {
      name: /^Greater than normal/,
    });
    fireEvent.pointerDown(greaterRiskOption, { button: 0 });
    fireEvent.pointerUp(greaterRiskOption, { button: 0 });
    fireEvent.click(greaterRiskOption);
    await expect(
      within(dialog).findByText("Required responsible persons: PIC · MIC · EQR")
    ).resolves.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "EQR", hidden: true })
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("combobox", { name: "Engagement Risk" })
    );
    const normalRiskOption = screen.getByRole("option", {
      name: /^Normal \(e\.g\. Private entity\)/,
    });
    fireEvent.pointerDown(normalRiskOption, { button: 0 });
    fireEvent.pointerUp(normalRiskOption, { button: 0 });
    fireEvent.click(normalRiskOption);
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("button", { name: "EQR", hidden: true })
      ).toBeNull()
    );
  });

  it("prefills Client context when creation starts from a Client record", async () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        initialClientId="client-1"
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    const prefillWorkspace = await screen.findByRole("region", {
      name: "Use client details",
    });
    expect(
      screen.queryByRole("dialog", { name: "Use client details" })
    ).not.toBeInTheDocument();
    expect(
      within(prefillWorkspace).getByText("C001 - Huaqian Limited")
    ).toBeInTheDocument();
    expect(within(prefillWorkspace).getByText("Partner A")).toBeInTheDocument();
    expect(within(prefillWorkspace).getByText("Manager B")).toBeInTheDocument();
    expect(
      within(prefillWorkspace).getByText("2026-12-31")
    ).toBeInTheDocument();
    expect(
      within(prefillWorkspace).getByText("Annual Audit")
    ).toBeInTheDocument();
    expect(within(prefillWorkspace).getByText("HKFRS")).toBeInTheDocument();
    fireEvent.click(
      within(prefillWorkspace).getByRole("button", {
        name: "Use selected details",
      })
    );

    const dialog = await screen.findByRole("dialog", {
      name: "New engagement acceptance",
    });
    expect(
      within(dialog).getByRole("button", { name: "Client" })
    ).toHaveTextContent("C001 - Huaqian Limited");
    expect(within(dialog).getByLabelText("Year End")).toHaveValue("2026-12-31");
    expect(within(dialog).getByLabelText("Service Type")).toHaveValue(
      "ANNUAL_AUDIT"
    );
  });

  it("copies a selected source Engagement into a new form-page draft", () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        formPageMode
        initialClientId="client-1"
        initialFormMode="create"
        initialSourceEngagement={engagements[0]}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );

    expect(screen.getByLabelText("Engagement Code")).toHaveValue("");
    expect(screen.getByLabelText("Year End")).toHaveValue("2026-12-31");
    expect(screen.getByLabelText("Estimated Report Date")).toHaveValue(
      "2027-03-31"
    );
    expect(screen.getByLabelText("Engagement Date")).toHaveValue("2026-02-10");
    expect(
      screen.getByRole("button", { name: "PIC", hidden: true })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "MIC", hidden: true })
    ).toBeInTheDocument();
    expect(onSubmitEngagementAcceptance).not.toHaveBeenCalled();
  });

  it("imports only the selected source groups and locks the source Client", () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        formPageMode
        initialClientId="client-1"
        initialFormMode="create"
        initialSourceEngagement={engagements[0]}
        initialImportSections={["commercial"]}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );

    expect(screen.getByLabelText("Year End")).toHaveValue("");
    expect(screen.getByLabelText("Estimated Report Date")).toHaveValue("");
    expect(screen.getByLabelText("Engagement Date")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Client", hidden: true })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "PIC", hidden: true })
    ).toBeInTheDocument();
    expect(onSubmitEngagementAcceptance).not.toHaveBeenCalled();
  });

  it("converts unavailable copied budget staff into TBC", () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    const sourceWithUnavailableBudgetStaff: CmpEngagement = {
      ...engagements[0],
      feePlanningLines: [
        {
          ...engagements[0].feePlanningLines[0],
          assignmentType: "STAFF",
          staff: {
            id: "inactive-staff",
            name: "Former Staff",
            email: "former@example.com",
          },
        },
      ],
    };
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={[sourceWithUnavailableBudgetStaff]}
        users={users}
        formPageMode
        initialClientId="client-1"
        initialFormMode="create"
        initialSourceEngagement={sourceWithUnavailableBudgetStaff}
        initialImportSections={["commercial"]}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );
    expect(onSubmitEngagementAcceptance).not.toHaveBeenCalled();
  });

  it("uses a standalone selection workspace for a preselected Client on the form route", async () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        formPageMode
        initialClientId="client-1"
        initialFormMode="create"
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    const workspace = await screen.findByRole("region", {
      name: "Use client details",
    });
    expect(workspace).toHaveTextContent("C001 - Huaqian Limited");
    expect(workspace).toHaveTextContent("Copy from an existing Engagement");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      within(workspace).getByRole("button", { name: "Use selected details" })
    );

    await expect(
      screen.findByText("Engagement setup")
    ).resolves.toBeInTheDocument();
  });

  it("can inherit most editable fields from an existing Client Engagement", async () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        initialClientId="client-1"
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    const prefillWorkspace = await screen.findByRole("region", {
      name: "Use client details",
    });
    fireEvent.change(
      within(prefillWorkspace).getByLabelText(
        "Copy from an existing Engagement"
      ),
      { target: { value: "engagement-1" } }
    );
    expect(
      within(prefillWorkspace).getByText("Engagement sections to copy")
    ).toBeInTheDocument();

    fireEvent.click(
      within(prefillWorkspace).getByRole("button", {
        name: "Use selected details",
      })
    );

    const dialog = await screen.findByRole("dialog", {
      name: "New engagement acceptance",
    });
    expect(within(dialog).getByLabelText("Year End")).toHaveValue("2026-12-31");
    expect(within(dialog).getByLabelText("Estimated Report Date")).toHaveValue(
      "2027-03-31"
    );
    expect(
      within(dialog).getByRole("button", { name: "PIC", hidden: true })
    ).toHaveTextContent("PIC Partner");

    fireEvent.click(within(dialog).getByRole("tab", { name: /2\. Budget/ }));
    expect(within(dialog).getByLabelText("Agreed Fee")).toHaveValue(180_000);
  });

  it("clears inherited Year End and PIC when switching to a Client without them", () => {
    const clientWithoutOwner = {
      ...clients[0],
      id: "client-2",
      clientCode: "C002",
      nameEn: "No Owner Limited",
      nameZh: "No Owner CN",
      yearEndDate: null,
      clientPartnerPicId: null,
      clientPartnerPic: null,
    };
    render(
      <CmpEngagementsView
        clients={[clients[0], clientWithoutOwner]}
        engagements={engagements}
        users={users}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });
    chooseSearchOption(dialog, "Client", /C001 - Huaqian Limited/);
    chooseSearchOption(dialog, "Client", /C002 - No Owner Limited/);

    expect(within(dialog).getByLabelText("Year End")).toHaveValue("");
    expect(
      within(dialog).getByRole("button", { name: "PIC", hidden: true })
    ).toHaveTextContent("Select PIC");
  });

  it("does not mark an empty optional Engagement section complete", () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        currentUser={users[0]}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });
    const basic = dialog.querySelector<HTMLElement>(
      '[data-acceptance-form-section="setup"]'
    );
    const notes = dialog.querySelector<HTMLElement>(
      '[data-acceptance-form-section="notes"]'
    );

    expect(
      within(expectPresent(basic)).getByText("Incomplete")
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("tab", { name: /1\. Engagement Setup/ })
    );
    expect(
      within(expectPresent(basic)).getByLabelText("Service Type")
    ).toHaveValue("");
    expect(notes).not.toBeNull();
    expect(
      within(expectPresent(notes)).getByText("Not started")
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("tab", { name: /3\. Status And Remarks/ })
    );
    fireEvent.change(within(expectPresent(notes)).getByLabelText("Remarks"), {
      target: { value: "Initial planning note" },
    });

    expect(
      within(expectPresent(notes)).getByText("Complete")
    ).toBeInTheDocument();
  });

  it("saves an incomplete engagement draft without formal required fields", () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        currentUser={users[0]}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });
    expect(
      within(dialog).getByRole("navigation", {
        name: "Engagement form sections",
      })
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("Approval route")
    ).not.toBeInTheDocument();
    expect(
      within(
        expectPresent(dialog.querySelector(".cmp-form-workspace-header"))
      ).getByRole("button", {
        name: "Assign",
      })
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(onSubmitEngagementAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ENGAGEMENT",
        submit: false,
        engagementPayload: expect.not.objectContaining({
          clientId: expect.anything(),
        }),
      })
    );
  });

  it("highlights and focuses the first invalid Engagement field", async () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });
    goToEngagementReview(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /Submit/,
      })
    );

    expect(onSubmitEngagementAcceptance).not.toHaveBeenCalled();
    expect(
      within(dialog).getByRole("tab", {
        name: /1\. Engagement Setup: Has errors/,
      })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.queryByRole("dialog", { name: "Confirm submission" })
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Client" })
      ).toHaveFocus()
    );
  });

  it("blocks and locates an invalid agreed fee when saving a draft", async () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        currentUser={users[0]}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });
    const agreedFee = within(dialog).getByLabelText("Agreed Fee");
    fireEvent.change(agreedFee, { target: { value: "-1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(onSubmitEngagementAcceptance).not.toHaveBeenCalled();
    expect(agreedFee).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(agreedFee).toHaveFocus());
  });

  it("assigns an incomplete engagement draft after selecting Staff", () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        currentUser={users[0]}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Assign" }));
    fireEvent.click(screen.getByRole("button", { name: "Assign Staff User" }));

    expect(onSubmitEngagementAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ENGAGEMENT",
        draftAssigneeId: "user-staff",
        submit: false,
        engagementPayload: expect.objectContaining({
          feeCurrency: "HKD",
        }),
      })
    );
  });

  it("keeps the selected Staff member when saving a draft", () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        currentUser={users[0]}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Assign" }));
    fireEvent.click(screen.getByRole("button", { name: "Assign Staff User" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(onSubmitEngagementAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ENGAGEMENT",
        draftAssigneeId: "user-staff",
        submit: false,
      })
    );
  });

  it("opens an edit engagement modal and submits a change request", () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Edit engagement" });
    chooseSearchOption(dialog, "MIC", /Manager Z/);
    goToEngagementReview(dialog);
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));

    expect(onSubmitEngagementAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ENGAGEMENT_CHANGE",
        targetEngagementId: "engagement-1",
        submit: true,
        engagementPayload: expect.objectContaining({
          micUserId: "user-mic-z",
          mic: "Manager Z",
        }),
      })
    );
  });

  it("renders the TMS summary inside an existing engagement fee plan", () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        tmsSummary={tmsSummary}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Edit engagement" });
    fireEvent.click(within(dialog).getByRole("tab", { name: /2\. Budget/ }));

    expect(
      within(dialog).getByRole("table", {
        name: /TMS contribution by person and period/i,
      })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("cell", { name: "Staff User" })
    ).toBeInTheDocument();
  });

  it("does not auto-save an unnamed form-page Engagement draft and confirms deletion", async () => {
    const onDeleteDraft = vi.fn(async () => {});
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        formPageMode
        initialFormMode="create"
        hasPersistedDraft
        onDeleteDraft={onDeleteDraft}
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );
    expect(onSubmitEngagementAcceptance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete Draft" }));
    expect(
      screen.getByRole("heading", { name: "Delete draft?" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDeleteDraft).toHaveBeenCalledOnce());
  });

  it("does not auto-save after assigning an unnamed form-page draft", async () => {
    const onSubmitEngagementAcceptance = vi.fn(async () => {});
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        formPageMode
        initialFormMode="create"
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Assign" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Assign Staff User" })
    );

    await waitFor(() =>
      expect(onSubmitEngagementAcceptance).toHaveBeenCalledOnce()
    );
    await new Promise((resolve) => {
      window.setTimeout(resolve, 750);
    });

    expect(onSubmitEngagementAcceptance).toHaveBeenCalledOnce();
  });

  it("rolls back a failed form-page assignment without auto-save retry", async () => {
    const onSubmitEngagementAcceptance = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValue(new Error("Unable to assign draft"));
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        formPageMode
        initialFormMode="create"
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Assign" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Assign Staff User" })
    );

    await waitFor(() =>
      expect(onSubmitEngagementAcceptance).toHaveBeenCalledOnce()
    );
    await new Promise((resolve) => {
      window.setTimeout(resolve, 750);
    });

    expect(onSubmitEngagementAcceptance).toHaveBeenCalledOnce();
  });

  it("does not auto-save an unchanged unnamed form-page draft", async () => {
    const onSubmitEngagementAcceptance = vi.fn();
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        formPageMode
        initialFormMode="create"
        onSubmitEngagementAcceptance={onSubmitEngagementAcceptance}
      />
    );
    fireEvent.change(screen.getByLabelText("Engagement Code"), {
      target: { value: "ENG-UPDATED" },
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 1250);
    });

    expect(onSubmitEngagementAcceptance).not.toHaveBeenCalled();
  });

  it("hides acceptance creation and engagement changes from Staff", () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        currentUser={{
          id: "user-staff",
          email: "staff@example.com",
          name: "Staff User",
          globalRole: "STAFF",
        }}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    expect(
      screen.queryByRole("button", { name: "New Engagement" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" })
    ).not.toBeInTheDocument();
  });

  it("lets a Partner create and edit engagements with Staff assignment", async () => {
    render(
      <CmpEngagementsView
        clients={clients}
        engagements={engagements}
        users={users}
        currentUser={users[2]}
        onSubmitEngagementAcceptance={async () => {}}
      />
    );

    expect(
      screen.getByRole("button", { name: "New Engagement" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New Engagement" }));
    const dialog = screen.getByRole("dialog", {
      name: "New engagement acceptance",
    });

    expect(
      within(dialog).getByRole("button", { name: "Next" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Assign" })
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editDialog = await screen.findByRole("dialog", {
      name: "Edit engagement",
    });
    chooseSearchOption(editDialog, "MIC", /Manager Z/);
    goToEngagementReview(editDialog);

    expect(
      screen.getByRole("button", { name: "Submit to MIC" })
    ).toBeInTheDocument();
  });
});
