import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { CmpI18nProvider } from "../i18n/client";
import type { CmpLocale } from "../i18n/client";
import {
  EMPTY_CLIENT_MASTER_FORM,
  buildClientPayload,
  getVisibleClientFields,
} from "./client-master-form";
import { CmpClientsView } from "./cmp-clients-view";
import { CmpMasterDraftLink } from "./cmp-master-drafts-section";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

function chooseSearchOption(
  container: HTMLElement,
  label: string,
  optionName: RegExp | string
) {
  const button = within(container).queryByRole("button", {
    name: label,
    hidden: true,
  });
  if (button) {
    fireEvent.click(button);
    fireEvent.click(
      within(container).getByRole("option", {
        name: optionName,
        hidden: true,
      })
    );
    return;
  }

  const select = within(container).getByLabelText(label);
  const option = within(select).getByRole("option", {
    name: optionName,
    hidden: true,
  });
  fireEvent.change(select, {
    target: { value: option.getAttribute("value") ?? "" },
  });
}

function chooseGridAction(_name: "New Client") {
  fireEvent.click(screen.getByRole("button", { name: "New Client" }));
}

function goToClientReview(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("tab", { name: /5\. Preview/ }));
}

const groups = [
  {
    id: "group-1",
    groupCode: "G001",
    nameZh: "Huaqian Group CN",
    nameEn: "Huaqian Group",
    status: "ACTIVE" as const,
    clientCount: 1,
    createdById: "user-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
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
    groupId: "group-1",
    group: {
      id: "group-1",
      groupCode: "G001",
      nameZh: "Huaqian Group CN",
      nameEn: "Huaqian Group",
      status: "ACTIVE" as const,
    },
    address: "1 Queen's Road Central",
    contactPerson: "Amy Chan",
    telephone: "+852 1111 2222",
    email: "amy@example.com",
    website: "https://example.com",
    yearEndDate: "2026-12-31",
    hsicSectionCode: "C" as const,
    placeOfIncorporation: "Hong Kong",
    incorporationYearMonth: "2010-01",
    listedOrPrivate: "OTHER",
    companyTypeOtherDescription: "Legacy company type",
    stockExchangeOrListingPlace: null,
    stockCode: null,
    marketSegment: null,
    regulatedEntities: null,
    isSubsidiary: false,
    parentClientCode: null,
    subsidiariesOrAssociates: null,
    referredBy: "Internal referral",
    clientPartnerPic: "Partner A",
    clientLeadingPartnerId: "user-pic",
    clientLeadingPartner: "PIC Partner",
    clientManagerMic: "Manager B",
    alternativePartnerSecondMic: "Partner C",
    expectedJobOrEngagementType: "Annual audit",
    serviceLines: "Audit, Tax",
    approvalReferenceNumber: "NCA-001",
    approvalDate: "2026-02-01",
    preparedBy: "Staff A",
    approvedBy: "Manager B",
    micApproval: "Approved",
    picApproval: "Approved",
    itAdmin: "IT Admin",
    signOffDate: "2026-02-03",
    remarks: "Priority client",
    status: "ACTIVE" as const,
    createdById: "user-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
  },
];
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
    id: "user-pic-alt",
    email: "partner-y@example.com",
    name: "Partner Y",
    globalRole: "PRINCIPAL" as const,
  },
  {
    id: "user-it",
    email: "it@example.com",
    name: "IT Admin",
    globalRole: "SUPER_ADMIN" as const,
  },
];

function renderClientsView(
  props: Partial<Parameters<typeof CmpClientsView>[0]> = {},
  locale: CmpLocale = "en-US"
) {
  return render(
    <CmpI18nProvider initialLocale={locale}>
      <CmpClientsView
        groups={groups}
        clients={clients}
        users={users}
        onCreateGroup={async () => {}}
        onLoadGroupStructure={(id) =>
          Promise.resolve({
            group:
              groups.find((group) => group.id === id) ??
              expectPresent(groups[0]),
            ultimateParent: null,
            subsidiaryTree: [],
            associates: [],
            jointVentures: [],
            relationshipHistory: [],
            warnings: [
              {
                code: "ULTIMATE_PARENT_NOT_ASSIGNED",
                message: "Ultimate Parent has not been assigned",
                clientId: null,
              },
            ],
          })
        }
        onSubmitClientChange={async () => {}}
        onUpdateGroup={async () => {}}
        {...props}
      />
    </CmpI18nProvider>
  );
}

function fillRequiredClientAcceptance(
  dialog: HTMLElement,
  values: {
    clientCode?: string;
    companyNumber?: string;
    nameEn?: string;
  } = {}
) {
  fireEvent.change(within(dialog).getByLabelText("Client Code"), {
    target: { value: values.clientCode ?? "C-REQUIRED" },
  });
  fireEvent.change(within(dialog).getByLabelText("Company Code"), {
    target: { value: "COMPANY-REQUIRED" },
  });
  fireEvent.change(within(dialog).getByLabelText("Company Number"), {
    target: { value: values.companyNumber ?? "7654321" },
  });
  fireEvent.change(within(dialog).getByLabelText("Client Status"), {
    target: { value: "ACTIVE" },
  });
  fireEvent.change(within(dialog).getByLabelText("Company Name English"), {
    target: { value: values.nameEn ?? "Required Client Limited" },
  });
  fireEvent.change(within(dialog).getByLabelText("Year End Month"), {
    target: { value: "12" },
  });
  fireEvent.change(within(dialog).getByLabelText("Registered Address"), {
    target: { value: "1 Queen's Road Central" },
  });
  fireEvent.change(
    expectPresent(
      dialog.querySelector('[data-validation-field="placeOfIncorporation"]')
    ),
    {
      target: { value: "Hong Kong" },
    }
  );
  fireEvent.change(within(dialog).getByLabelText("Industry"), {
    target: { value: "C" },
  });
  fireEvent.change(within(dialog).getByLabelText("Company Type"), {
    target: { value: "PRIVATE" },
  });

  fireEvent.click(
    within(dialog).getByRole("tab", {
      name: /2\. Group Relationships/,
    })
  );

  fireEvent.click(
    within(dialog).getByRole("tab", {
      name: /4\. Responsible Persons & Services/,
    })
  );
  chooseSearchOption(dialog, "Client Leading Partner", /Partner Y/);
  chooseSearchOption(dialog, "PIC", /PIC Partner/);
  chooseSearchOption(dialog, "MIC", /MIC Manager/);

  const audit = within(dialog).getByRole("checkbox", {
    name: "Annual Audit",
    hidden: true,
  });
  if (!(audit as HTMLInputElement).checked) {
    fireEvent.click(audit);
  }
}

describe(CmpClientsView, () => {
  beforeEach(() => {
    vi.spyOn(api, "cmpCompanyIdentityMatch").mockResolvedValue({ match: null });
  });

  it("does not bubble a draft link click into the clickable table row", () => {
    const onRowClick = vi.fn();
    const draft = {
      request: {
        id: "draft-client-link",
        requestNo: "CA-DRAFT-LINK",
      },
      canEdit: true,
    } as unknown as Parameters<typeof CmpMasterDraftLink>[0]["draft"];

    render(
      <CmpI18nProvider initialLocale="en-US">
        <div
          role="presentation"
          onClick={onRowClick}
          onClickCapture={(event) => event.preventDefault()}
          onKeyDown={() => {}}
        >
          <CmpMasterDraftLink draft={draft} returnTo="/client">
            Draft Client
          </CmpMasterDraftLink>
        </div>
      </CmpI18nProvider>
    );

    fireEvent.click(screen.getByRole("link", { name: /CA-DRAFT-LINK/ }));

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("keeps Client Acceptance drafts out of the formal table and switches to a draft view", () => {
    const drafts = [
      {
        request: {
          id: "draft-client-1",
          requestNo: "CA-DRAFT-001",
          updatedAt: "2026-08-23T02:00:00.000Z",
          clientPayload: {
            clientCode: "C-DRAFT-001",
            nameEn: "Draft Client Limited",
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
    ] as unknown as NonNullable<Parameters<typeof CmpClientsView>[0]["drafts"]>;

    renderClientsView({ drafts });

    const grid = screen.getByTestId("cmp-clients-data-grid");
    expect(screen.getAllByTestId("cmp-clients-data-grid")).toHaveLength(1);
    expect(grid).not.toHaveTextContent("C-DRAFT-001");
    expect(grid).not.toHaveTextContent("Draft Client Limited");
    expect(screen.getByLabelText("Client: 1")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /CA-DRAFT-001/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Show drafts/ }));
    expect(screen.getAllByTestId("cmp-clients-data-grid")).toHaveLength(1);
    expect(grid).toHaveTextContent("C-DRAFT-001");
    expect(grid).toHaveTextContent("Draft Client Limited");
    expect(within(grid).getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CA-DRAFT-001/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/acceptance/requests/draft-client-1/edit")
    );

    fireEvent.click(screen.getByRole("button", { name: /Back to records/ }));
    expect(grid).not.toHaveTextContent("C-DRAFT-001");
  });

  it("does not apply the formal Client search to the separate draft table", () => {
    const drafts = [
      {
        request: {
          id: "draft-client-search",
          requestNo: "CA-DRAFT-SEARCH",
          updatedAt: "2026-08-23T02:00:00.000Z",
          clientPayload: {
            clientCode: "C-DRAFT-SEARCH",
            nameEn: "Independent Draft Limited",
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
    ] as unknown as NonNullable<Parameters<typeof CmpClientsView>[0]["drafts"]>;

    renderClientsView({ drafts, searchValue: "formal-only-search" });
    fireEvent.click(screen.getByRole("button", { name: /Show drafts/ }));

    expect(screen.getByTestId("cmp-clients-data-grid")).toHaveTextContent(
      "C-DRAFT-SEARCH"
    );
  });

  it("localizes and groups the basic client fields", async () => {
    renderClientsView({}, "zh-CN");

    fireEvent.click(screen.getByRole("button", { name: "新建客户" }));
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });

    expect(
      within(dialog).getAllByRole("heading", { name: "客户信息" }).length
    ).toBeGreaterThan(0);
    expect(within(dialog).getByLabelText("客户编号")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("公司英文名称")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "地址资料" })
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("公司注册地址")).toBeInTheDocument();
    const sameAddress = within(dialog).getByRole("checkbox", {
      name: "与公司注册地址相同",
    });
    expect(sameAddress).toBeChecked();
    expect(within(dialog).queryByLabelText("主要经营地址")).toBeNull();
    fireEvent.click(sameAddress);
    expect(within(dialog).getByLabelText("主要经营地址")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "联系人" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByTestId("cmp-client-contact-data-grid")
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "新增联系人" }));
    const contactDialog = screen.getByRole("dialog", { name: "新增联系人" });
    expect(
      within(contactDialog).getByLabelText("联络备注")
    ).toBeInTheDocument();
    fireEvent.click(
      within(contactDialog).getByRole("button", { name: "取消" })
    );
    expect(within(dialog).getByLabelText("介绍来源")).toBeInTheDocument();

    expect(
      within(dialog).getAllByLabelText("注册成立地").length
    ).toBeGreaterThan(0);
    expect(within(dialog).getByLabelText("行业")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("公司类型")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("tab", { name: /2\. 集团关系/ }));

    expect(within(dialog).getAllByText("相关主体").length).toBeGreaterThan(0);
    expect(
      within(dialog).getByRole("button", { name: "新增关联公司" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "新增关联个人" })
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "新增关联公司" })
    );
    const companyDialog = screen.getByRole("dialog", {
      name: "新增关联公司",
    });
    expect(
      within(companyDialog).getByLabelText("公司代码")
    ).toBeInTheDocument();
    fireEvent.change(within(companyDialog).getByLabelText("公司代码"), {
      target: { value: "REL-001" },
    });
    fireEvent.change(within(companyDialog).getByLabelText(/英文名称/), {
      target: { value: "Example Holdings Limited" },
    });
    fireEvent.change(within(companyDialog).getByLabelText(/证件号码/), {
      target: { value: "7654321" },
    });
    expect(
      within(companyDialog).getByRole("button", { name: "保存主体" })
    ).toBeEnabled();
    fireEvent.click(
      within(companyDialog).getByRole("button", { name: "保存主体" })
    );
    await waitFor(() =>
      expect(
        within(dialog).getAllByText("Example Holdings Limited")
      ).toHaveLength(2)
    );

    fireEvent.click(
      within(dialog).getByRole("tab", { name: /4\. 负责人及服务信息/ })
    );
    expect(within(dialog).getByLabelText("客户主管合伙人")).toBeInTheDocument();

    expect(within(dialog).getByText("年度审计")).toBeInTheDocument();
  }, 20_000);

  it("renders the client list first and opens the client form as a secondary view", () => {
    renderClientsView();

    expect(screen.getByTestId("cmp-clients-data-grid")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Clients" })).toBeNull();
    expect(screen.getByText("C001")).toBeInTheDocument();
    expect(screen.queryByText("Client Management")).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Company Number" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Client Code" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Tax Ref")).not.toBeInTheDocument();
    expect(screen.queryByText("Place of Listing")).not.toBeInTheDocument();
    expect(screen.queryByText("Stock Code")).not.toBeInTheDocument();
    expect(screen.queryByText("Listed Type")).not.toBeInTheDocument();
    expect(screen.queryByText("MOF: Shareholding")).not.toBeInTheDocument();
    expect(
      screen.queryByText("MOF: PRC Establishments")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Audit service: Yes" })
    ).toBeNull();
    expect(screen.queryByRole("img", { name: "Tax service: Yes" })).toBeNull();
    expect(screen.queryByRole("img", { name: "Risk service: No" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Edit client" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "1. Basic client information",
      })
    ).not.toBeInTheDocument();

    const newClientAction = screen.getByRole("button", {
      name: "New Client",
    });
    expect(newClientAction).not.toHaveAttribute("aria-haspopup");
    expect(
      screen.queryByTestId("expandable-action-bar")
    ).not.toBeInTheDocument();
    fireEvent.click(newClientAction);
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });

    expect(
      within(dialog).getByRole("tab", {
        name: /1\. Client Information/,
      })
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Draft assignment")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("navigation", {
        name: "Client form sections",
      })
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/required fields/)).toBeInTheDocument();
    expect(
      within(dialog).queryByText("Approval route")
    ).not.toBeInTheDocument();
    expect(
      within(
        expectPresent(dialog.querySelector(".cmp-form-workspace-header"))
      ).getByText("Draft assignment")
    ).toBeInTheDocument();
    const sectionNavigation = within(dialog).getByRole("navigation", {
      name: "Client form sections",
    });
    expect(within(sectionNavigation).getAllByRole("tab")).toHaveLength(5);
    expect(
      within(sectionNavigation)
        .getAllByRole("tab")
        .map((button) => button.textContent)
    ).toStrictEqual([
      expect.stringContaining("Client Information"),
      expect.stringContaining("Group Relationships"),
      expect.stringMatching(/AML screening/i),
      expect.stringContaining("Responsible Persons & Services"),
      expect.stringContaining("Preview"),
    ]);
    expect(within(sectionNavigation).queryByText("Compliance")).toBeNull();
    goToClientReview(dialog);
    expect(
      within(dialog).getByRole("region", { name: "Preview" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Client Information" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", {
        name: "Group Relationships",
      })
    ).toBeInTheDocument();
    expect(within(sectionNavigation).getAllByRole("tab")).toHaveLength(5);
    expect(within(dialog).queryByRole("button", { name: "Edit" })).toBeNull();
    fireEvent.click(
      within(sectionNavigation).getByRole("tab", {
        name: /1\. Client Information/,
      })
    );
    expect(sectionNavigation).not.toHaveClass("is-compact");
    expect(within(dialog).getByLabelText("Client Code")).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Confirm submission" })
    ).not.toBeInTheDocument();
  });

  it("tracks required Client fields without page-level missing-item copy", () => {
    renderClientsView();

    chooseGridAction("New Client");
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });
    const section = (id: string) =>
      expectPresent(
        dialog.querySelector<HTMLElement>(
          `[data-acceptance-form-section="${id}"]`
        )
      );
    const clientInformation = section("basic");

    expect(within(dialog).getByText(/required fields/)).toBeInTheDocument();
    expect(within(section("basic")).queryByText(/required item/)).toBeNull();
    expect(within(clientInformation).queryByText(/required item/)).toBeNull();
    expect(within(dialog).getByLabelText("Client Status")).toHaveValue("");

    expect(
      within(clientInformation).getByLabelText("Company Type")
    ).toHaveValue("");
    fireEvent.change(within(clientInformation).getByLabelText("Industry"), {
      target: { value: "C" },
    });
    fireEvent.change(
      expectPresent(
        clientInformation.querySelector(
          '[data-validation-field="placeOfIncorporation"]'
        )
      ),
      { target: { value: "Hong Kong" } }
    );
    fireEvent.change(within(clientInformation).getByLabelText("Company Type"), {
      target: { value: "PRIVATE" },
    });

    expect(
      within(clientInformation).getByLabelText("Company Type")
    ).toHaveValue("PRIVATE");
    expect(
      within(clientInformation).getByText("Incomplete")
    ).toBeInTheDocument();
  });

  it("keeps Client form sections manual and closes the previous section", () => {
    renderClientsView();

    chooseGridAction("New Client");
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });
    const trigger = (sectionId: string) =>
      expectPresent(
        dialog.querySelector<HTMLButtonElement>(
          `[data-acceptance-form-section-anchor="${sectionId}"]`
        )
      );

    expect(trigger("basic")).toHaveAttribute("aria-expanded", "true");
    expect(trigger("relationships")).toHaveAttribute("aria-expanded", "false");
    expect(trigger("responsible")).toHaveAttribute("aria-expanded", "false");

    fireEvent.wheel(dialog, { deltaY: 120 });
    expect(trigger("basic")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(trigger("relationships"));
    expect(trigger("basic")).toHaveAttribute("aria-expanded", "false");
    expect(trigger("relationships")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger("relationships"));
    expect(trigger("relationships")).toHaveAttribute("aria-expanded", "false");

    const accordion = expectPresent(
      dialog.querySelector<HTMLElement>(".cmp-client-form-accordion")
    );
    const previewLink = within(accordion).getByRole("button", {
      name: "Preview",
    });
    expect(previewLink).not.toHaveAttribute("aria-expanded");
    expect(within(previewLink).queryByText("Incomplete")).toBeNull();
    expect(
      previewLink.querySelector(".lucide-circle-dashed")
    ).toBeInTheDocument();
    expect(previewLink.querySelector(".lucide-eye")).toBeNull();

    fireEvent.click(previewLink);
    expect(
      within(dialog).getByRole("region", { name: "Preview" })
    ).toBeInTheDocument();
  });

  it("keeps client filtering out of the grid toolbar", () => {
    renderClientsView();

    const grid = screen.getByTestId("cmp-clients-data-grid");
    expect(within(grid).queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      within(grid).getByRole("button", { name: "Columns" })
    ).toBeInTheDocument();
  });

  it("uses exact Service Type selections in expandable Client details", () => {
    renderClientsView({
      clients: [
        {
          ...clients[0],
          clientCode: "C-TAXONOMY",
          serviceLines: "Audit, Taxonomy",
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", {
        name: "Audit service",
      })
    );
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", {
        name: "Tax service",
      })
    );
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", {
        name: "Risk service",
      })
    );
    expect(
      screen.getByRole("img", { name: "Audit service: Yes" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Tax service: No" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Risk service: No" })
    ).toBeInTheDocument();
  });

  it("shows Contact as read-only expanded details", () => {
    const onSubmitClientChange = vi.fn();
    renderClientsView({ onSubmitClientChange });

    fireEvent.click(
      screen.getByRole("button", { name: "Expand client details" })
    );
    expect(
      screen.queryByRole("heading", {
        name: "1. Basic client information",
      })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Contact & responsibility")).toBeInTheDocument();
    expect(screen.getByText("+852 1111 2222")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save contact" })
    ).not.toBeInTheDocument();
    expect(onSubmitClientChange).not.toHaveBeenCalled();
  });

  it("submits a new client acceptance request without a Group", async () => {
    const onCreateGroup = vi.fn();
    const onSubmitClientChange = vi.fn();
    renderClientsView({ onCreateGroup, onSubmitClientChange });

    chooseGridAction("New Client");
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });
    fillRequiredClientAcceptance(dialog, {
      clientCode: "C002",
      companyNumber: "998877",
      nameEn: "New Client Limited",
    });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Review" }));
    expect(
      within(dialog).getByRole("checkbox", { name: "Annual Audit" })
    ).toBeChecked();
    expect(
      within(dialog).getByRole("checkbox", { name: "Review" })
    ).toBeChecked();
    expect(
      within(dialog).queryByLabelText("NCA / NEA / EEA approval no.")
    ).toBeNull();
    goToClientReview(dialog);
    fireEvent.click(
      screen.getByRole("button", { name: "Submit client acceptance" })
    );
    await waitFor(() =>
      expect(onSubmitClientChange).toHaveBeenCalledWith(
        expect.objectContaining({ submit: true })
      )
    );

    expect(onSubmitClientChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CLIENT",
        submit: true,
        clientPayload: expect.objectContaining({
          clientCode: "C002",
          nameEn: "New Client Limited",
          companyNumber: "998877",
          relatedEntities: [],
          relatedRelationships: [],
          clientPartnerPicId: "user-pic",
          clientPartnerPic: "PIC Partner",
          serviceType: "Annual Audit",
          serviceLines: "Annual Audit, Review",
          status: "ACTIVE",
        }),
      })
    );
  }, 15_000);

  it("keeps a client form open when Escape is pressed during a failed save", async () => {
    let rejectSubmission: ((error: Error) => void) | undefined;
    const onSubmitClientChange = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSubmission = reject;
        })
    );
    renderClientsView({ onSubmitClientChange });

    chooseGridAction("New Client");
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });
    fillRequiredClientAcceptance(dialog, { clientCode: "C-BUSY" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Save Draft" }));
    await waitFor(() => {
      expect(onSubmitClientChange).toHaveBeenCalledOnce();
      expect(
        within(dialog).getByRole("button", { name: "Saving..." })
      ).toBeDisabled();
    });

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(
      screen.getByRole("dialog", { name: "New client acceptance" })
    ).toBeInTheDocument();

    await act(async () => {
      rejectSubmission?.(new Error("Save failed"));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Save Draft" })
      ).toBeEnabled();
    });
    fireEvent.click(
      within(dialog).getByRole("tab", { name: /1\. Client Information/ })
    );
    expect(within(dialog).getByLabelText("Client Code")).toHaveValue("C-BUSY");
  }, 15_000);

  it("saves an incomplete Client draft so the MIC can delegate completion", async () => {
    const onSubmitClientChange = vi.fn();
    renderClientsView({ onSubmitClientChange });

    chooseGridAction("New Client");
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save Draft" })
      );
      await Promise.resolve();
    });

    expect(onSubmitClientChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CLIENT",
        submit: false,
        clientPayload: expect.objectContaining({
          clientCode: "",
          nameEn: undefined,
          nameZh: undefined,
        }),
      })
    );
  });

  it("shows invalid Client fields in the submit review", async () => {
    const onSubmitClientChange = vi.fn();
    renderClientsView({ onSubmitClientChange });

    chooseGridAction("New Client");
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });
    goToClientReview(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Submit client acceptance" })
    );

    expect(onSubmitClientChange).not.toHaveBeenCalled();
    const invalidClientCode = await waitFor(() => {
      const field = within(dialog).getByLabelText("Client Code");
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(
        within(dialog).getByRole("tab", {
          name: /1\. Client Information: Has errors/,
        })
      ).toHaveAttribute("aria-selected", "true");
      return field;
    });
    expect(
      screen.queryByRole("dialog", { name: "Confirm submission" })
    ).not.toBeInTheDocument();

    fireEvent.change(invalidClientCode, { target: { value: "C-VALID" } });
    expect(invalidClientCode).toHaveAttribute("aria-invalid", "false");
  });

  it("keeps an invalid contact email in the editor until it is corrected", () => {
    renderClientsView();

    chooseGridAction("New Client");
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add Contact" })
    );
    const contactDialog = screen.getByRole("dialog", { name: "Add Contact" });
    const email = within(contactDialog).getByLabelText("Email");
    fireEvent.change(email, { target: { value: "not-an-email" } });
    expect(email).toHaveValue("not-an-email");
    expect(
      within(contactDialog).getByRole("button", { name: "Save Contact" })
    ).toBeDisabled();
  });

  it("allows over-limit text to remain recoverable in a Client draft", async () => {
    const onSubmitClientChange = vi.fn();
    renderClientsView({ onSubmitClientChange });

    chooseGridAction("New Client");
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });
    const companyNumber = within(dialog).getByLabelText("Company Number");
    fireEvent.change(companyNumber, { target: { value: "1".repeat(101) } });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save Draft" })
      );
      await Promise.resolve();
    });

    expect(onSubmitClientChange).toHaveBeenCalledWith(
      expect.objectContaining({
        submit: false,
        clientPayload: expect.objectContaining({
          companyNumber: "1".repeat(101),
        }),
      })
    );
  });

  it("keeps Referred By as a single basic information field", () => {
    const form = {
      ...EMPTY_CLIENT_MASTER_FORM,
      clientCode: "C-SOURCE",
      nameZh: "Source Client",
      referredBy: "",
    };

    expect(getVisibleClientFields(form)).not.toHaveProperty("internalSource");
    expect(buildClientPayload(form)).toStrictEqual(
      expect.objectContaining({
        referredBy: undefined,
      })
    );
    expect(buildClientPayload(form)).not.toHaveProperty("internalSource");
  });

  it("submits client edits as an approval request", async () => {
    const onSubmitClientChange = vi.fn();
    renderClientsView({ onSubmitClientChange });

    fireEvent.click(screen.getByRole("button", { name: "Edit client" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit client" });
    fireEvent.click(
      within(dialog).getByRole("tab", {
        name: /4\. Responsible Persons & Services/,
      })
    );
    chooseSearchOption(dialog, "PIC", /Partner Y/);
    chooseSearchOption(dialog, "MIC", /MIC Manager/);
    fireEvent.click(
      within(dialog).getByRole("tab", {
        name: /1\. Client Information/,
      })
    );
    fireEvent.change(within(dialog).getByLabelText("Company Type"), {
      target: { value: "PRIVATE" },
    });
    expect(within(dialog).getByLabelText("Assign to")).toBeInTheDocument();
    goToClientReview(dialog);
    fireEvent.click(
      screen.getByRole("button", { name: "Submit change request" })
    );
    await waitFor(() =>
      expect(onSubmitClientChange).toHaveBeenCalledWith(
        expect.objectContaining({ submit: true })
      )
    );

    expect(onSubmitClientChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CLIENT_CHANGE",
        targetClientId: "client-1",
        submit: true,
        clientPayload: expect.objectContaining({
          clientCode: "C001",
          clientPartnerPicId: "user-pic-alt",
          clientPartnerPic: "Partner Y",
          listedOrPrivate: "PRIVATE",
        }),
      })
    );
  });

  it("requires a Client Partner / PIC before submitting a change", async () => {
    const onSubmitClientChange = vi.fn();
    renderClientsView({ onSubmitClientChange });

    fireEvent.click(screen.getByRole("button", { name: "Edit client" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit client" });
    fireEvent.click(
      within(dialog).getByRole("tab", {
        name: /4\. Responsible Persons & Services/,
      })
    );
    chooseSearchOption(dialog, "MIC", /MIC Manager/);
    goToClientReview(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Submit change request" })
    );

    expect(onSubmitClientChange).not.toHaveBeenCalled();
    expect(
      within(dialog).getAllByText("PIC is required.").length
    ).toBeGreaterThan(0);
  });

  it("hides acceptance creation and client changes from Staff", () => {
    renderClientsView({
      currentUser: {
        id: "user-staff",
        email: "staff@example.com",
        name: "Staff User",
        globalRole: "STAFF",
      },
    });

    expect(
      screen.queryByRole("button", { name: "New Client" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit client" })
    ).not.toBeInTheDocument();
  });

  it("lets a Partner create and edit clients with Staff assignment", async () => {
    renderClientsView({
      currentUser: users[1],
    });

    expect(
      screen.getByRole("button", { name: "Edit client" })
    ).toBeInTheDocument();

    chooseGridAction("New Client");
    const dialog = screen.getByRole("dialog", {
      name: "New client acceptance",
    });

    expect(
      within(dialog).getByRole("button", { name: "Next" })
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Draft assignment")).toBeInTheDocument();
    expect(within(dialog).getByText("Request owner")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Assign form completion to Staff without changing the approval route."
      )
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit client" }));
    const editDialog = await screen.findByRole("dialog", {
      name: "Edit client",
    });
    fireEvent.click(
      within(editDialog).getByRole("tab", {
        name: /4\. Responsible Persons & Services/,
      })
    );
    chooseSearchOption(editDialog, "PIC", /Partner Y/);
    chooseSearchOption(editDialog, "MIC", /MIC Manager/);
    fireEvent.click(
      within(editDialog).getByRole("tab", {
        name: /1\. Client Information/,
      })
    );
    fireEvent.change(within(editDialog).getByLabelText("Company Type"), {
      target: { value: "PRIVATE" },
    });
    goToClientReview(editDialog);

    expect(
      screen.getByRole("button", { name: "Submit change to MIC" })
    ).toBeInTheDocument();
  });

  it("honors the shared shell search value", () => {
    renderClientsView({ searchValue: "missing" });

    expect(screen.queryByText("C001")).not.toBeInTheDocument();
    expect(screen.getByText("No matching clients")).toBeInTheDocument();
  });
});
