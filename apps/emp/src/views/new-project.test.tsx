import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewProjectPage } from "./new-project";

const mockRouter = vi.hoisted(() => ({ push: vi.fn() }));
const mockApi = vi.hoisted(() => ({
  createProject: vi.fn(),
  resolveCmpEngagementProjectCode: vi.fn(),
  cmpClients: vi.fn(),
  cmpEngagements: vi.fn(),
  frameworkTemplates: vi.fn(),
  projectTemplates: vi.fn(),
  projects: vi.fn(),
  me: vi.fn(),
  userDirectory: vi.fn(),
  projectInvitees: vi.fn(),
}));

function requireElement<T extends Element>(element: T | null): T {
  if (!element) {
    throw new Error("Expected test element to be present");
  }
  return element;
}

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../api/client", () => ({ api: mockApi }));
vi.mock("../components/project-wing-top-bar-controls", () => ({
  EmpPortalAction: () =>
    createElement("button", { type: "button" }, "Intranet"),
  EmpTopBarControls: () => null,
}));
vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: "en-US",
    localizedPath: (pathname: string) => pathname,
    dictionary: {
      projects: {
        createEyebrow: "Project",
        create: "Create project",
        createDescription: "Create a project.",
        name: "Project name",
        projectCode: "Project code",
        projectCodeAutomatic: "Leave blank to generate",
        cmpEngagement: "CMP engagement",
        cmpClient: "CMP client",
        language: "Language",
        projectTemplate: "Project template",
        notes: "Notes",
        statusColumn: "Status",
        yearEndDate: "Year end date",
        reportDate: "Report date",
        archiveDeadline: "Archive deadline",
        unlinkedProjectCode:
          "An independent project code. Leave blank to generate one.",
        initialInvitations: "Initial invitations",
        rankColumn: "Rank",
        dataGridColumnMenu: {
          clear: "Clear filter",
          empty: "No values found",
          filter: "Filter",
          search: "Search",
        },
        languages: { "zh-CN": "Chinese", "en-US": "English" },
        wizard: {
          selectTemplate: "Select template",
          introGreeting: "Welcome back, {name}",
          introGreetingFallback: "Welcome back",
          introDescription: "Choose a CMP engagement to start a project.",
          introQuickCreate: "Quick create without an engagement",
          regularMode: "Regular mode",
          comingSoon: "Not available yet. Coming soon.",
          regularModeDescription: "Link a CMP engagement",
          quickMode: "Quick mode",
          optionalCmpLink: "Link CMP engagement (optional)",
          optionalCmpDescription: "Optional engagement",
          independentPicHint: "Choose a project PIC in EMP",
          quickModeDescription: "Create first, link later",
          cmpPic: "CMP PIC",
          cmpMic: "CMP MIC",
          searchProjectTemplates: "Search template name or code",
          searchEngagementMinimum: "Enter at least 2 characters.",
          clearSelectionSearch: "Clear search",
          clearSelectedRecord: "Clear selection",
          back: "Back",
          continue: "Continue",
          review: "Review and create",
          required: "Complete required fields.",
          edit: "Edit",
          engagementStepTitle: "Project source",
          engagementStepDescription: "Choose CMP linkage",
          engagementCodeIntro: "Search active CMP engagements.",
          sourceModeLabel: "Choose CMP linkage",
          sourceModeDescription:
            "Choose the path that matches the work completed so far.",
          cmpSourceTitle: "Create from CMP engagement",
          cmpSourceDescription: "Use an active CMP engagement.",
          recommended: "Recommended",
          quickSourceTitle: "Quick create",
          quickSourceDescription: "Start without a client record.",
          rollForwardSourceTitle: "Roll forward a project",
          rollForwardSourceDescription: "Copy an archived project.",
          findCmpEngagement: "Find a CMP engagement",
          changeEngagement: "Choose another",
          engagementSearchPlaceholder: "Search engagement or client",
          noEngagementResults: "No active engagement found.",
          quickReadyTitle: "Quick project",
          quickReadyDescription: "Link a client later.",
          rollForwardSourceLabel: "Rolled-forward project",
          quickSourceLabel: "Quick create",
          engagementChecking: "Checking Engagement Code...",
          engagementUnavailable: "The Engagement Code is unavailable.",
          employeeName: "Name",
          noRankFilter: "Not selected",
          skipEngagement: "Skip Engagement association",
          unlinkedProject: "No CMP Engagement linked",
          rollForwardShow: "Roll forward from archived project",
          rollForwardHide: "Hide roll forward",
          archivedSourceProject: "Archived source project",
          searchArchivedProjects: "Search archived projects",
          noArchivedProjectMatches: "No archived projects match your search.",
          noTemplates: "No templates available.",
          noTemplateMatches: "No matching project templates.",
          noArchivedProjects: "No archived projects available.",
          inheritMembers: "Inherit active members",
          initializationTitle: "Initialization method",
          initializationDescription: "Choose how to initialize the project.",
          blankInitializationTitle: "Blank project",
          blankInitializationDescription:
            "Create only the base workflow without a template or prior project.",
          templateInitializationTitle: "Use project template",
          rollForwardInitializationTitle: "Roll forward archived project",
          projectSetupTitle: "Project setup",
          projectSetupDetail: "Settings and invitations",
          pendingConfiguration: "In progress",
          selectedMembersOnly: "Invitees become members only after accepting.",
          addMember: "Add member",
          inviteMember: "Invite members",
          pendingInvitation: "Pending invitation",
          noMembersSelected: "No invitees selected.",
          creationSummary: "Creation summary",
          memberSelected: "Pending invite",
          addMemberAction: "Select to invite",
          accountingStandard: "Applicable accounting standard",
          accountingStandardPlaceholder: "e.g. HKFRS, IFRS, CAS",
          projectPicTitle: "Project PIC",
          pic: "PIC",
          mic: "MIC",
          projectPicHint: "MIC is inherited from CMP.",
          selectPic: "Select PIC",
          selectMic: "Select MIC",
          selectLead: "Select",
          leadSelected: "Selected",
          clearLead: "Clear",
          projectLeadsTitle: "Project leads",
          searchEmployees: "Search employees",
          searchEmployeesMinimum:
            "Enter at least 2 letters to search employees.",
          currentUserAlreadyIncluded:
            "{name} is already included as the project owner and does not need an invitation.",
          active: "Active",
          invite: "Invite",
          cancelInvitation: "Cancel",
          removeSelection: "Remove selection",
          employeesCount: "{count} employees",
          previousPage: "Previous",
          nextPage: "Next",
          engagementOrRollForwardError: "Enter an active Engagement Code.",
          reviewDescription: "Confirm the selected Engagement.",
          reviewSource: "Project source",
          reviewClient: "Client",
          reviewEngagement: "Engagement",
          reviewAccountingStandard: "Applicable accounting standard",
          reviewInitialization: "Initialization method",
          reviewTemplate: "Project template",
          reviewPic: "PIC",
          reviewMic: "MIC",
          reviewPendingInvitations: "Pending invitations",
          reviewProjectDetails: "Project details",
          reviewSourceDetails: "Source and ownership",
          reviewDates: "Key dates",
          reviewTeam: "Pending invitations",
          reviewLanguage: "Display language",
          reviewNotes: "Notes",
          noNotes: "Not provided",
          reviewDirectMembers: "Members added on creation",
          reviewRequestOwner: "Request owner / project owner",
          reviewInheritedMembers: "Inherit active members",
          reviewInheritedMembersHint: "Source members are inherited directly.",
          directlyJoined: "Added directly",
          yes: "Yes",
          no: "No",
          notApplicable: "Not applicable",
          unlinkedCmpEngagement: "No client or CMP engagement linked",
          createProject: "Create project",
          creatingProject: "Creating...",
        },
      },
      common: { datePicker: { today: "Today" } },
      workspaces: { back: "Back" },
    },
  }),
}));

describe(NewProjectPage, () => {
  beforeEach(() => {
    mockApi.cmpClients.mockResolvedValue({ clients: [] });
    mockApi.cmpEngagements.mockResolvedValue({ engagements: [] });
    mockApi.frameworkTemplates.mockResolvedValue([]);
    mockApi.projectTemplates.mockResolvedValue([
      {
        id: "template-audit",
        code: "AUDIT",
        name: "Audit template",
        language: "zh-CN",
        status: "PUBLISHED",
      },
    ]);
    mockApi.projects.mockResolvedValue([]);
    mockApi.createProject.mockResolvedValue({ id: "project-2" });
    mockApi.me.mockResolvedValue({
      id: "user-owner",
      email: "owner@projectwing.local",
      name: "Owner",
      globalRole: "PARTNER",
      status: "ACTIVE",
    });
    mockApi.userDirectory.mockResolvedValue([
      {
        id: "user-second-mic",
        email: "second@projectwing.local",
        name: "Second Lead",
        globalRole: "MANAGER",
        status: "ACTIVE",
      },
      {
        id: "user-mic",
        email: "manager@projectwing.local",
        name: "Selected Manager",
        globalRole: "MANAGER",
        status: "ACTIVE",
      },
      {
        id: "user-cmp-pic",
        email: "pic@projectwing.local",
        name: "CMP Partner",
        globalRole: "PARTNER",
        status: "ACTIVE",
      },
      {
        id: "user-other-pic",
        email: "other.pic@projectwing.local",
        name: "Other Partner",
        globalRole: "PRINCIPAL",
        status: "ACTIVE",
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens independent setup without contacting CMP or inserting a dummy name", async () => {
    mockApi.cmpEngagements.mockRejectedValue(new Error("CMP offline"));
    renderNewProject({}, false);
    await expect(
      screen.findByRole("heading", { name: "Welcome back, Owner" })
    ).resolves.toBeVisible();
    expect(screen.getByRole("button", { name: /Regular mode/ })).toBeDisabled();
    const search = screen.getByRole("combobox", {
      name: /Search engagement or client/,
    });
    expect(search).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Regular mode/ }));
    expect(
      screen.queryByRole("textbox", { name: "Project name" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Quick mode/ }));
    expect(screen.getByRole("textbox", { name: "Project name" })).toHaveValue(
      ""
    );
    expect(
      screen.queryByRole("button", { name: /Quick mode/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Regular mode/ })
    ).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "Select PIC" });
    expect(mockApi.cmpEngagements).not.toHaveBeenCalled();
    expect(mockApi.createProject).not.toHaveBeenCalled();
  });

  it("keeps initialization on one selection row with the empty hint inside its configuration field", async () => {
    mockApi.projectTemplates.mockResolvedValue([]);
    renderNewProject();
    const choices = screen.getByRole("group", {
      name: "Initialization method",
    });
    expect(choices).toHaveAttribute("data-layout", "inline");
    fireEvent.click(
      within(choices).getByRole("radio", { name: "Use project template" })
    );
    const hint = await screen.findByText("No templates available.");
    expect(hint.closest(".pw-guided-form-field")).not.toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Project template" })
    ).toHaveAttribute("aria-describedby", "project-projectTemplateId-help");
    expect(
      screen.queryByRole("combobox", { name: "Archived source project" })
    ).not.toBeInTheDocument();
    expect(mockApi.createProject).not.toHaveBeenCalled();
  });

  it("keeps templates independent of project language and distinguishes unmatched searches", async () => {
    renderNewProject();
    fireEvent.click(
      screen.getByRole("radio", { name: "Use project template" })
    );
    const picker = screen.getByRole("combobox", { name: "Project template" });
    await waitFor(() => expect(picker).not.toBeDisabled());
    expect(mockApi.projectTemplates).toHaveBeenCalledExactlyOnceWith();
    act(() => picker.focus());
    fireEvent.click(
      await screen.findByRole("option", { name: "Audit template AUDIT" })
    );
    expect(picker).toHaveValue("Audit template");
    fireEvent.click(screen.getByRole("button", { name: "Language Chinese" }));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "English" })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Language English" })
      ).toBeVisible()
    );
    expect(mockApi.projectTemplates).toHaveBeenCalledOnce();
    expect(picker).toHaveValue("Audit template");
    act(() => picker.focus());
    fireEvent.change(picker, { target: { value: "no-such-template" } });
    await expect(
      screen.findByText("No matching project templates.")
    ).resolves.toBeVisible();
    expect(
      screen.queryByText("No templates available.")
    ).not.toBeInTheDocument();
  });

  it("allows the quick-create path to continue without a CMP engagement", () => {
    renderNewProject();

    expect(
      screen.queryByRole("button", { name: "Continue" })
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Project setup" })
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Project name" })).toHaveValue(
      ""
    );
    expect(screen.queryByRole("textbox", { name: "Project code" })).toHaveValue(
      ""
    );
    expect(
      screen.queryByText(
        "An independent project code. Leave blank to generate one."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Project code" })
    ).toHaveAttribute("placeholder", "Leave blank to generate");
    expect(screen.getByRole("radio", { name: "Blank project" })).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Use project template" })
    ).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Roll forward archived project" })
    ).toBeVisible();
    expect(
      screen
        .getByText(
          "Create only the base workflow without a template or prior project."
        )
        .closest("p")
        ?.querySelector("svg")
    ).toBeNull();
    expect(screen.getByText("Creation summary")).toBeVisible();
    expect(screen.getByText("No invitees selected.")).toBeVisible();
  });

  it("returns an abandoned creation attempt to its originating folder", () => {
    renderNewProject({ folderId: "folder-client" });
    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "Abandoned draft" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Back" })[0]);
    expect(mockRouter.push).toHaveBeenCalledWith(
      "/engagement?folderId=folder-client"
    );
  });

  it("searches archived projects before selecting a roll-forward source", async () => {
    mockApi.projects.mockResolvedValue([
      {
        id: "archived-ocean",
        workspaceId: "workspace-1",
        projectCode: "ARCH-2025-001",
        name: "Ocean Trading Audit",
        reportingDate: "2025-12-31",
        status: "ARCHIVED",
        members: [],
      },
      {
        id: "archived-harbor",
        workspaceId: "workspace-1",
        projectCode: "ARCH-2025-002",
        name: "Harbor Holdings Audit",
        reportingDate: "2025-12-31",
        status: "ARCHIVED",
        members: [],
      },
    ]);
    const { container } = renderNewProject();

    fireEvent.click(
      screen.getByRole("radio", { name: "Roll forward archived project" })
    );
    const picker = await screen.findByRole("combobox", {
      name: "Archived source project",
    });
    await waitFor(() => expect(picker).not.toBeDisabled());
    fireEvent.click(picker);
    const search = picker;
    fireEvent.change(search, { target: { value: "  ocean  " } });

    await waitFor(() =>
      expect(
        screen.getByRole("option", {
          name: "Ocean Trading Audit ARCH-2025-001",
        })
      ).toBeVisible()
    );
    expect(
      screen.queryByRole("option", {
        name: "Harbor Holdings Audit ARCH-2025-002",
      })
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "no matching archive" } });
    expect(
      screen.getByText("No archived projects match your search.")
    ).toBeVisible();

    fireEvent.change(search, { target: { value: "ocean" } });

    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(picker).toHaveValue("Ocean Trading Audit");
    expect(container.querySelector("#project-name")).toHaveValue(
      "Ocean Trading Audit"
    );
  });

  it("shows readable labels when an archived project is selected", async () => {
    mockApi.projects.mockResolvedValue([
      {
        id: "archived-project-1",
        projectCode: "HBR-2025-AUD",
        name: "Harbour 2025 audit",
        status: "ARCHIVED",
        language: "en-US",
        frameworkTemplateId: "framework-hkfrs",
        applicableAccountingStandard: "HKFRS",
        yearEndDate: "2025-12-31T00:00:00.000Z",
        reportDate: "2026-03-31T00:00:00.000Z",
        archiveDeadline: "2026-06-29T00:00:00.000Z",
        members: [],
      },
    ]);
    renderNewProject();

    fireEvent.click(
      screen.getByRole("radio", { name: "Roll forward archived project" })
    );
    await waitFor(() => expect(mockApi.projects).toHaveBeenCalledOnce());
    const sourcePicker = await screen.findByRole("combobox", {
      name: "Archived source project",
    });
    await waitFor(() => expect(sourcePicker).not.toBeDisabled());
    fireEvent.click(sourcePicker);
    fireEvent.click(
      await screen.findByRole("option", {
        name: "Harbour 2025 audit HBR-2025-AUD",
      })
    );

    expect(sourcePicker).toHaveValue("Harbour 2025 audit");
    expect(
      document.querySelector("#project-rollForwardFromProjectId-code")
    ).toHaveTextContent("HBR-2025-AUD");
    expect(sourcePicker).not.toHaveValue("archived-project-1");
    expect(
      screen.getByRole("button", { name: "Year end date" })
    ).toHaveTextContent("Dec 31, 2026");
    expect(
      screen.getByRole("button", { name: "Report date" })
    ).toHaveTextContent("Mar 31, 2027");
    expect(
      screen.getByRole("button", { name: "Archive deadline" })
    ).toHaveTextContent("Jun 29, 2027");
  });

  it("describes selected people as pending invitations rather than joined members", async () => {
    mockApi.projectInvitees.mockResolvedValue({
      users: [
        {
          id: "user-invitee",
          email: "invitee@projectwing.local",
          name: "Pending Person",
          globalRole: "STAFF",
          status: "ACTIVE",
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    mockApi.userDirectory.mockResolvedValue([
      {
        id: "user-second-mic",
        email: "second@projectwing.local",
        name: "Second Lead",
        globalRole: "MANAGER",
        status: "ACTIVE",
      },
      {
        id: "user-invitee",
        email: "invitee@projectwing.local",
        name: "Pending Person",
        globalRole: "STAFF",
        status: "ACTIVE",
      },
    ]);
    renderNewProject();
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search employees" }),
      {
        target: { value: "Pe" },
      }
    );

    await expect(
      screen.findByRole("heading", { name: "Invite members" })
    ).resolves.toBeVisible();
    const selectInvitee = await screen.findByRole("button", {
      name: /Select to invite/,
    });
    expect(selectInvitee).toBeVisible();
    expect(screen.getByRole("img", { name: "Pending Person" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Add to project/ })
    ).not.toBeInTheDocument();
    fireEvent.click(selectInvitee);
    expect(
      screen.getAllByRole("img", { name: "Pending Person", hidden: true })
    ).toHaveLength(2);
    expect(screen.getByText("Pending invitation")).toBeInTheDocument();
  });

  it("requires a two-letter search and does not expose a full invitee list", async () => {
    mockApi.projectInvitees.mockResolvedValue({
      users: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
    });
    renderNewProject();
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));

    await expect(
      screen.findByText("Enter at least 2 letters to search employees.")
    ).resolves.toBeVisible();
    expect(mockApi.projectInvitees).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Full list" })
    ).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search employees" }),
      { target: { value: "Pe" } }
    );
    await waitFor(() =>
      expect(mockApi.projectInvitees).toHaveBeenCalledWith(
        expect.objectContaining({
          browseAll: false,
          page: 1,
          pageSize: 10,
          q: "Pe",
        })
      )
    );
  });

  it("explains why the current project owner is not returned by employee search", async () => {
    mockApi.me.mockResolvedValue({
      id: "user-partner",
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: "PARTNER",
      status: "ACTIVE",
    });
    mockApi.projectInvitees.mockResolvedValue({
      users: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
    });
    renderNewProject();
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search employees" }),
      {
        target: { value: "jony" },
      }
    );

    await expect(
      screen.findByText(
        "Jony Ma is already included as the project owner and does not need an invitation."
      )
    ).resolves.toBeVisible();
  });

  it.each(["", "  USER-QUICK-001  "])(
    "preserves a quick project's name and optional code through Back (%s)",
    async (manualCode) => {
      const { container } = renderNewProject({ folderId: "folder-client" });

      const projectName = requireElement(
        container.querySelector<HTMLInputElement>("#project-name")
      );
      expect(projectName).toHaveValue("");
      expect(projectName).not.toHaveAttribute("readonly");
      fireEvent.change(projectName, { target: { value: "Orchid fieldwork" } });
      fireEvent.change(screen.getByRole("textbox", { name: "Project code" }), {
        target: { value: manualCode },
      });
      expect(projectName).toHaveValue("Orchid fieldwork");
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Select PIC" })).toBeEnabled()
      );
      fireEvent.click(screen.getByRole("button", { name: "Select PIC" }));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search employees" }),
        { target: { value: "Other" } }
      );
      const picDialog = screen.getByRole("dialog", { name: "Select PIC" });
      expect(
        within(picDialog).queryByText("Selected Manager")
      ).not.toBeInTheDocument();
      fireEvent.click(
        await within(picDialog).findByRole("button", { name: "Select" })
      );
      expect(
        within(picDialog).getByRole("button", { name: "Selected" })
      ).toBeDisabled();
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search employees" }),
        { target: { value: "CMP" } }
      );
      fireEvent.click(
        await within(picDialog).findByRole("button", { name: "Select" })
      );
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      fireEvent.click(screen.getByRole("button", { name: "Select MIC" }));
      expect(
        screen.getByRole("textbox", { name: "Search employees" })
      ).toHaveValue("");
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search employees" }),
        { target: { value: "Other" } }
      );
      expect(
        within(screen.getByRole("dialog", { name: "Select MIC" })).queryByText(
          "Other Partner"
        )
      ).not.toBeInTheDocument();
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search employees" }),
        { target: { value: "Manager" } }
      );
      fireEvent.click(
        await within(
          screen.getByRole("dialog", { name: "Select MIC" })
        ).findByRole("button", { name: "Select" })
      );
      expect(
        within(screen.getByRole("dialog", { name: "Select MIC" })).getByRole(
          "button",
          { name: "Selected" }
        )
      ).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      fireEvent.click(screen.getByRole("button", { name: "Select MIC" }));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search employees" }),
        { target: { value: "Manager" } }
      );
      await expect(
        within(screen.getByRole("dialog", { name: "Select MIC" })).findByRole(
          "button",
          { name: "Selected" }
        )
      ).resolves.toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Clear MIC Selected Manager" })
      );
      expect(
        screen.queryByRole("button", { name: "Clear MIC Selected Manager" })
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Select MIC" }));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search employees" }),
        { target: { value: "Manager" } }
      );
      fireEvent.click(
        await within(
          screen.getByRole("dialog", { name: "Select MIC" })
        ).findByRole("button", { name: "Select" })
      );
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      fireEvent.click(screen.getByRole("button", { name: "Select MIC" }));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search employees" }),
        { target: { value: "Second" } }
      );
      fireEvent.click(
        await within(
          screen.getByRole("dialog", { name: "Select MIC" })
        ).findByRole("button", { name: "Select" })
      );
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      const backButtons = screen.getAllByRole("button", { name: "Back" });
      fireEvent.click(backButtons[backButtons.length - 1]);
      expect(
        screen.getByRole("combobox", { name: /Search engagement or client/ })
      ).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Continue" })
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Quick mode/ }));
      expect(screen.getByRole("textbox", { name: "Project name" })).toHaveValue(
        "Orchid fieldwork"
      );
      expect(screen.getByRole("textbox", { name: "Project code" })).toHaveValue(
        manualCode
      );
      fireEvent.change(
        requireElement(
          container.querySelector("#project-applicableAccountingStandard")
        ),
        {
          target: { value: "HKFRS" },
        }
      );
      expect(
        screen.getByRole("radio", { name: "Blank project" })
      ).toBeChecked();

      for (const id of ["yearEndDate", "reportDate", "archiveDeadline"]) {
        const trigger = requireElement(
          container.querySelector(`#project-${id}`)
        );
        const initialText = trigger.textContent;
        fireEvent.click(trigger);
        const todayButtons = screen.getAllByRole("button", { name: "Today" });
        fireEvent.click(todayButtons[todayButtons.length - 1]);
        await waitFor(() => expect(trigger.textContent).not.toBe(initialText));
      }
      fireEvent.click(
        screen.getByRole("button", { name: "Review and create" })
      );

      await expect(
        screen.findByRole("heading", { name: "Project details" })
      ).resolves.toBeVisible();
      expect(screen.getByText("Orchid fieldwork")).toBeVisible();
      expect(mockApi.cmpEngagements).not.toHaveBeenCalled();
      expect(
        screen.getByRole("heading", { name: "Members added on creation" })
      ).toBeVisible();
      expect(screen.getByText("Owner")).toBeVisible();
      expect(
        within(
          screen.getByRole("region", { name: "Members added on creation" })
        ).getByRole("img", { name: "Owner" })
      ).toHaveTextContent("OW");
      expect(screen.getAllByText("Added directly")).toHaveLength(5);
      expect(mockApi.createProject).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      expect(screen.getByRole("textbox", { name: "Project name" })).toHaveValue(
        "Orchid fieldwork"
      );
      expect(
        screen.getByRole("textbox", { name: "Applicable accounting standard" })
      ).toHaveValue("HKFRS");
      fireEvent.click(
        screen.getByRole("button", { name: "Review and create" })
      );
      expect(
        screen.getByRole("heading", { name: "Project details" })
      ).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Create project" }));
      await waitFor(() => expect(mockApi.createProject).toHaveBeenCalledOnce());
      expect(mockApi.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: "folder-client",
          name: "Orchid fieldwork",
          projectPicUserIds: ["user-other-pic", "user-cmp-pic"],
          projectMicUserIds: ["user-mic", "user-second-mic"],
        })
      );
      expect(
        mockApi.createProject.mock.calls[0][0].cmpEngagementId
      ).toBeUndefined();
      expect(
        mockApi.createProject.mock.calls[0][0].cmpClientId
      ).toBeUndefined();
      expect(mockApi.createProject.mock.calls[0][0].projectCode).toBe(
        manualCode.trim() || undefined
      );
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/engagement?folderId=folder-client"
      );
      expect(mockApi.createProject).toHaveBeenCalledWith(
        expect.not.objectContaining({
          projectTemplateId: expect.anything(),
          rollForwardFromProjectId: expect.anything(),
        })
      );
    },
    15_000
  );
});

function renderNewProject(
  props: Parameters<typeof NewProjectPage>[0] = {},
  enterQuick = true
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(NewProjectPage, props)
    )
  );
  if (enterQuick) {
    fireEvent.click(screen.getByRole("button", { name: /Quick mode/ }));
  }
  return result;
}
