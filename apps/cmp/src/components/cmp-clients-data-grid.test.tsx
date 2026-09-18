import type { CmpClient, CmpEngagement } from "@project-wing/shared";
import {
  fireEvent,
  render as renderDom,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { CmpI18nProvider } from "../i18n/client";
import { CmpClientsDataGrid } from "./cmp-clients-data-grid";
import {
  getCmpClientCompanyType,
  getCmpClientCountryCode,
} from "./cmp-clients-data-grid-utils";

const { pushRoute } = vi.hoisted(() => ({ pushRoute: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushRoute,
  }),
}));

const client = {
  id: "client-1",
  clientCode: "C001",
  companyCode: "HQ-001",
  companyNumber: "1234567",
  nameZh: "华勤有限公司",
  nameEn: "Huaqian Limited",
  groupId: "group-1",
  group: {
    id: "group-1",
    groupCode: "G001",
    nameZh: "华勤集团",
    nameEn: "Huaqian Group",
    status: "ACTIVE",
  },
  address: "1 Queen's Road Central",
  contactPerson: "Amy Chan",
  telephone: "+852 1111 2222",
  email: "amy@example.com",
  website: "https://example.com",
  hsicSectionCode: "C",
  industryOtherDescription: null,
  reportingGaap: null,
  yearEndDate: "2026-12-31",
  yearEndMonth: 12,
  placeOfIncorporation: "Hong Kong",
  listedOrPrivate: "PRIVATE",
  clientPartnerPic: "Partner A",
  clientManagerMic: "Manager B",
  serviceLines: "Audit, Tax",
  approvalReferenceNumber: "NCA-001",
  remarks: "Priority client",
  status: "ACTIVE",
  createdById: "user-1",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
} as unknown as CmpClient;
const engagement = {
  id: "engagement-1",
  clientId: client.id,
  client: {
    id: client.id,
    clientCode: client.clientCode,
    nameZh: client.nameZh,
    nameEn: client.nameEn,
    status: "ACTIVE",
  },
  engagementCode: "C001-2026-AUD",
  serviceType: "ANNUAL_AUDIT",
  yearEndDate: "2026-12-31",
  reportDate: "2027-03-31",
  approvalReferenceNumber: null,
  engagementDate: null,
  budgetedHours: "400.00",
  agreedFee: "180000.00",
  recoveryRate: null,
  feePlanningLines: [],
  feeNotes: [],
  feeCurrency: "HKD",
  amlRiskClassification: "NOT_HIGH",
  engagementRiskClassification: "NORMAL",
  picUserId: null,
  micUserId: null,
  eqReviewerUserId: null,
  riskManagementPartnerUserId: null,
  pic: "Partner A",
  mic: "Manager B",
  eqReviewer: null,
  riskManagementPartner: null,
  status: "ACTIVE",
  remarks: null,
  createdById: "user-1",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
  codeAliases: [],
} as CmpEngagement;

function render(children: ReactNode) {
  return renderDom(
    <CmpI18nProvider initialLocale="en-US">{children}</CmpI18nProvider>
  );
}

function renderGrid() {
  const onEdit = vi.fn();
  const onCreateClient = vi.fn();
  render(
    <CmpClientsDataGrid
      clients={[client]}
      onEdit={onEdit}
      onCreateClient={onCreateClient}
      canEdit
      canCreateClient
      loadingEditClientId={null}
    />
  );
  return { onCreateClient, onEdit };
}

describe(CmpClientsDataGrid, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps phone previews on the existing full-detail route in the current application", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderGrid();
    fireEvent.click(
      screen.getByRole("button", { name: "Preview Client C001" })
    );
    expect(open).not.toHaveBeenCalled();
    expect(pushRoute).toHaveBeenCalledWith("/en-US/client/client-1");
  });

  it("keeps the phone action sheet connected to the existing edit callback", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { onEdit } = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /actions.*C001/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(client);
  });

  it("shows the Client year-end as the month only", () => {
    renderGrid();
    const grid = screen.getByTestId("cmp-clients-data-grid");

    expect(
      within(grid).getByRole("cell", { name: "December" })
    ).toBeInTheDocument();
  });

  it("opens the full Client preview in a safe new tab and keeps row expansion separate", () => {
    renderGrid();
    const grid = screen.getByTestId("cmp-clients-data-grid");
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const previewAction = within(grid).getByRole("button", {
      name: "Preview Client C001",
    });

    expect(previewAction).toHaveAttribute("data-variant", "quiet");
    expect(previewAction).toHaveAttribute("data-size", "md");
    expect(previewAction).not.toHaveAttribute("data-legacy-variant");
    expect(previewAction).not.toHaveAttribute("data-legacy-size");

    fireEvent.click(previewAction);
    expect(open).toHaveBeenCalledWith(
      "/en-US/client/client-1",
      "_blank",
      "noopener,noreferrer"
    );
    expect(within(grid).queryByText("Group details")).toBeNull();
  });

  it("keeps search and discarded demo controls out while retaining table controls", () => {
    renderGrid();
    const grid = screen.getByTestId("cmp-clients-data-grid");

    expect(within(grid).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(grid).queryByRole("button", { name: "Display" })).toBeNull();
    expect(
      within(grid).queryByRole("button", { name: "Infinite scroll" })
    ).toBeNull();
    expect(within(grid).queryByRole("button", { name: "Actions" })).toBeNull();
    expect(
      within(grid).queryByRole("button", { name: "Pin client row" })
    ).toBeNull();
    expect(
      within(grid).queryByRole("button", { name: /reorder rows/i })
    ).toBeNull();
    expect(within(grid).queryByRole("button", { name: "Filters" })).toBeNull();
    expect(
      grid.querySelector('[data-slot="frame-panel-title"]')
    ).toHaveTextContent("Client");
    expect(
      within(grid).getByRole("button", { name: "Columns" })
    ).toBeInTheDocument();
    expect(
      within(grid).getByRole("button", { name: "Columns" })
    ).toHaveAttribute("data-variant", "secondary");
    expect(
      within(grid).getByRole("button", { name: "Columns" })
    ).toHaveAttribute("data-size", "sm");
    expect(
      within(grid).getByRole("button", { name: "Columns" })
    ).not.toHaveAttribute("data-legacy-size");
    expect(
      within(grid).getByRole("button", { name: "New Client" })
    ).toHaveAttribute("data-variant", "secondary");
    expect(
      within(grid).getByRole("button", { name: "New Client" })
    ).toHaveAttribute("data-size", "sm");
    expect(
      within(grid).getByRole("button", { name: "New Client" })
    ).not.toHaveAttribute("data-legacy-size");
    expect(
      within(grid).getByRole("button", { name: "Columns" })
    ).toHaveTextContent("Columns");
    expect(
      within(grid).getByRole("button", { name: "New Client" })
    ).toHaveTextContent("New Client");
    expect(
      within(grid).queryByRole("img", {
        name: "Hong Kong Companies Registry",
      })
    ).not.toBeInTheDocument();
    expect(
      within(grid).queryByRole("columnheader", { name: "Contact Columns" })
    ).not.toBeInTheDocument();
    expect(
      within(grid).queryByRole("cell", { name: "Contact" })
    ).not.toBeInTheDocument();
    fireEvent.click(within(grid).getByRole("button", { name: "Client Code" }));
    expect(
      screen.getByRole("menuitem", { name: "Sort ascending" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Sort descending" })
    ).toBeInTheDocument();
    const clientCodeMenu = screen.getByRole("menu", { name: "Client Code" });
    expect(clientCodeMenu).toHaveClass("data-closed:animate-none");
    expect(
      within(clientCodeMenu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent?.trim())
    ).toStrictEqual(["Sort ascending", "Sort descending", "Filter"]);
    expect(
      screen.queryByRole("menuitem", { name: "Columns" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Filter" }));
    const filterOption = screen.getByRole("menuitemcheckbox", { name: "C001" });
    expect(
      filterOption.closest('[data-slot="dropdown-menu-sub-content"]')
    ).toHaveClass("w-max", "min-w-56", "max-w-[calc(100vw-2rem)]");
    expect(within(filterOption).getByText("C001")).toHaveClass(
      "whitespace-nowrap"
    );
    expect(within(filterOption).getByText("C001")).not.toHaveClass("truncate");
  }, 10_000);

  it("supports expansion and scrolling without pagination", () => {
    const { onEdit } = renderGrid();
    const grid = screen.getByTestId("cmp-clients-data-grid");
    const expandButton = within(grid).getByRole("button", {
      name: "Expand client details",
    });

    fireEvent.click(within(grid).getByRole("checkbox", { name: "Select row" }));
    expect(
      within(grid).queryByRole("checkbox", { name: "Select row" })
    ).toBeInTheDocument();
    expect(expandButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(within(grid).getByRole("cell", { name: "C001" }));
    expect(
      screen.queryByRole("dialog", { name: "Client preview · C001" })
    ).toBeNull();

    fireEvent.click(within(grid).getByRole("button", { name: "Edit client" }));
    expect(onEdit).toHaveBeenCalledWith(client);
    expect(expandButton).toHaveAttribute("aria-expanded", "true");

    expect(
      within(grid).queryByRole("button", { name: "Contact" })
    ).not.toBeInTheDocument();
    expect(within(grid).getByText("Position")).toBeInTheDocument();
    expect(within(grid).getByText("Department")).toBeInTheDocument();
    expect(within(grid).getByText("Mobile")).toBeInTheDocument();
    expect(within(grid).getByText("Registered address")).toBeInTheDocument();
    expect(
      within(grid).getByText("Principal business address")
    ).toBeInTheDocument();
    expect(within(grid).getByText("Contact notes")).toBeInTheDocument();
    expect(within(grid).getByText("Company profile")).toBeInTheDocument();
    expect(within(grid).getByText("Services")).toBeInTheDocument();
    expect(
      within(grid).getByRole("img", { name: "Audit service: Yes" })
    ).toBeInTheDocument();
    expect(
      within(grid).getByRole("img", { name: "Tax service: Yes" })
    ).toBeInTheDocument();
    expect(
      within(grid).getByRole("img", { name: "Risk service: No" })
    ).toBeInTheDocument();

    fireEvent.click(within(grid).getByRole("cell", { name: "G001" }));
    expect(expandButton).toHaveAttribute("aria-expanded", "false");

    expect(within(grid).queryByText("1 - 1 of 1")).not.toBeInTheDocument();
  });

  it("opens a Client engagement summary and links to the grouped view", async () => {
    const engagementsRequest = vi
      .spyOn(api, "cmpEngagements")
      .mockResolvedValue({ engagements: [engagement] });
    renderGrid();

    fireEvent.click(
      within(screen.getByTestId("cmp-clients-data-grid")).getByRole("button", {
        name: "View engagements for C001",
      })
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Engagements · C001",
    });
    expect(engagementsRequest).toHaveBeenCalledWith({ clientId: client.id });
    expect(within(dialog).getByText("Annual Audit")).toBeInTheDocument();
    expect(within(dialog).getByText("1 engagement")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "View all engagements" })
    ).toHaveAttribute(
      "href",
      "/en-US/engagements?view=client&clientId=client-1"
    );
  });

  it("retries a failed Client engagement request and shows an empty state", async () => {
    vi.spyOn(api, "cmpEngagements")
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ engagements: [] });
    renderGrid();

    fireEvent.click(
      within(screen.getByTestId("cmp-clients-data-grid")).getByRole("button", {
        name: "View engagements for C001",
      })
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Engagements · C001",
    });
    await expect(
      within(dialog).findByRole("button", { name: "Retry" })
    ).resolves.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));
    await expect(
      within(dialog).findByText("No engagements for this Client.")
    ).resolves.toBeInTheDocument();
  });

  it("provides a read-only version history entry for every visible Client", () => {
    renderGrid();

    expect(
      within(screen.getByTestId("cmp-clients-data-grid")).getByRole("button", {
        name: "Version history for C001",
      })
    ).toHaveAttribute("href", "/en-US/client/client-1/versions");
  });

  it("places the composite Client column first and keeps related fields together", () => {
    renderGrid();
    const grid = screen.getByTestId("cmp-clients-data-grid");
    const headers = within(grid)
      .getAllByRole("columnheader")
      .map((header) => header.textContent?.trim())
      .filter(Boolean);

    expect(headers.slice(0, 6)).toStrictEqual([
      "Client",
      "Client Code",
      "Company Code",
      "Group Code",
      "Company Number",
      "Company Type",
    ]);
    expect(within(grid).getByText("Huaqian Limited")).toBeInTheDocument();
    expect(within(grid).getByText("华勤有限公司")).toBeInTheDocument();
    expect(
      within(grid).getByRole("img", { name: "Hong Kong" })
    ).toHaveAttribute("src", "https://flagcdn.com/hk.svg");
    expect(within(grid).getByText("Private")).toBeInTheDocument();
    expect(within(grid).getByText("December")).toBeInTheDocument();
  });

  it("derives the flag and company type from their canonical fields", () => {
    expect(getCmpClientCountryCode(client)).toBe("HK");
    expect(getCmpClientCompanyType(client)).toBe("PRIVATE");
    expect(
      getCmpClientCompanyType({
        ...client,
        listedOrPrivate: "LISTED",
      })
    ).toBe("LISTED");
    expect(
      getCmpClientCompanyType({
        ...client,
        listedOrPrivate: null,
      })
    ).toBeNull();
  });

  it("opens Client creation directly from the plain New button", () => {
    const { onCreateClient } = renderGrid();
    const grid = screen.getByTestId("cmp-clients-data-grid");
    const newAction = within(grid).getByRole("button", {
      name: "New Client",
    });

    expect(newAction).not.toHaveAttribute("aria-haspopup");
    expect(newAction).not.toHaveAttribute("aria-expanded");
    fireEvent.click(newAction);
    expect(onCreateClient).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "New Client" })).toBeNull();
  });

  it("keeps the Columns morph popover responsive across repeated cycles", () => {
    renderGrid();
    const grid = screen.getByTestId("cmp-clients-data-grid");
    const columns = within(grid).getByRole("button", { name: "Columns" });

    fireEvent.pointerDown(columns, { button: 0 });
    let columnsMenu = screen.getByRole("menu", { name: "Columns" });
    expect(columnsMenu.closest('[role="dialog"]')).toHaveClass(
      "w-max",
      "max-w-[calc(100vw-2rem)]"
    );
    expect(columns).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(columns, { button: 0 });
    expect(columns).toHaveAttribute("aria-expanded", "false");

    fireEvent.pointerDown(columns, { button: 0 });
    columnsMenu = screen.getByRole("menu", { name: "Columns" });
    expect(columns).toHaveAttribute("aria-expanded", "true");
    expect(columnsMenu).not.toHaveClass("max-h-80", "overflow-y-auto");
    expect(
      within(columnsMenu).queryByRole("menuitemcheckbox", { name: "Contact" })
    ).not.toBeInTheDocument();

    fireEvent.pointerDown(columns, { button: 0 });
    fireEvent.pointerDown(columns, { button: 0 });
    expect(screen.getByRole("menu", { name: "Columns" })).toBeInTheDocument();
    expect(columns).toHaveAttribute("aria-expanded", "true");
  });
});
