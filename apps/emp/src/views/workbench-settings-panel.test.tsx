import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArchiveCheckReport, ArchiveJobSnapshot } from "../api/client";
import {
  ArchiveCheckNavigator,
  WorkbenchSettingsPanel,
} from "./workbench-settings-panel";

function createIntegrationsCopy() {
  return {
    title: "Connections & integrations",
    description: "Connect once and reuse integrations.",
    mailTitle: "WeCom Mail",
    mailDescription: "Send mail from the registered address.",
    loading: "Loading...",
    connected: "Connected",
    notConnected: "Not connected",
    disconnected: "Disconnected",
    connectionError: "Connection error",
    clientPassword: "Client-specific password",
    clientPasswordHelp: "Generate it in WeCom Mail settings.",
    passwordGuide: "Get password",
    passwordGuideTitle: "Get a client-specific password",
    passwordGuideSteps: ["Open webmail", "Open settings", "Generate and paste"],
    openWebmail: "Open WeCom Mail",
    connect: "Connect mailbox",
    test: "Test connection",
    testSuccess: "Connection healthy",
    disconnect: "Disconnect",
  };
}

const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  project: vi.fn(),
  frameworkTemplates: vi.fn(),
  updateProject: vi.fn(),
  cmpEngagements: vi.fn(),
  linkProjectEngagement: vi.fn(),
  unlinkProjectEngagement: vi.fn(),
  members: vi.fn(),
  projectMemberDirectory: vi.fn(),
  userDirectory: vi.fn(),
  createInvitation: vi.fn(),
  deletedAttachments: vi.fn(),
  restoreAttachment: vi.fn(),
  archiveCheck: vi.fn(),
  exportArchiveCheck: vi.fn(),
  startArchiveCheckJob: vi.fn(),
  archiveCheckJob: vi.fn(),
  startArchiveJob: vi.fn(),
  confirmProjectArchive: vi.fn(),
  archiveJob: vi.fn(),
  watchArchiveJob: vi.fn(),
  downloadArchiveArtifact: vi.fn(),
  deleteProject: vi.fn(),
  tmsProjectLinks: vi.fn(),
  linkTmsProject: vi.fn(),
  unlinkTmsProject: vi.fn(),
  userMailConnection: vi.fn(),
  connectUserMail: vi.fn(),
  testUserMailConnection: vi.fn(),
  disconnectUserMail: vi.fn(),
}));
const mockToast = vi.hoisted(() => ({
  toast: vi.fn(),
  confirm: vi.fn(),
}));
const mockRouter = vi.hoisted(() => ({
  replace: vi.fn(),
}));

function clickSettingsTab(name: string) {
  fireEvent.click(
    within(
      screen.getByRole("complementary", { name: "Settings navigation" })
    ).getByRole("button", {
      name,
    })
  );
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/zh-CN/engagement/project-1",
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

vi.mock("../components/toast", () => ({
  useToast: () => mockToast,
}));

const mockSetTheme = vi.hoisted(() => vi.fn());
vi.mock("../components/theme-provider", () => ({
  useTheme: () => ({
    resolvedTheme: "dark",
    mounted: true,
    fontSize: "md",
    setTheme: mockSetTheme,
    setFontSize: vi.fn(),
    useNativePdfViewer: false,
    setUseNativePdfViewer: vi.fn(),
  }),
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: "en-US",
    localizedPath: (value: string) => `/en-US${value}`,
    dictionary: {
      common: {
        cancel: "Cancel",
        confirm: "Confirm",
      },
      language: {
        label: "Language",
        zhCN: "Chinese",
        zhCNShort: "简",
        zhHKShort: "繁",
        enUS: "English",
        enUSShort: "EN",
      },
      nav: {
        account: "Account",
        signOut: "Sign out",
      },
      projects: {
        memberCount: "{count} members",
        name: "Project name",
        projectCode: "Project code",
        language: "Language",
        frameworkTemplate: "Framework",
        yearEndDate: "Year end date",
        reportDate: "Report date",
        archiveDeadline: "Archive deadline",
        reportingDate: "Reporting date",
        notes: "Notes",
        confirmArchive: "Confirm archive",
        reopenProject: "Reopen",
        memberManagementTitle: "Member management",
        inviteMember: "Invite member",
        inviteProjectMembers: "Invite project members",
        loadingAvailableUsers: "Loading available users...",
        noInviteableUsers: "No inviteable users.",
        inviteAction: "Invite",
        activeStatus: "Active",
        invitedStatus: "Invited",
        notInvitedStatus: "Not invited",
        folderSelectPlaceholder: "Select a framework",
        workspaceSelectPlaceholder: "Select",
        languages: {
          "zh-CN": "Chinese",
          "en-US": "English",
        },
      },
      workbench: {
        archiveCheck: {
          title: "Archive File Check",
          checking: "Checking project files",
          checkedAt: "{projectCode} checked at {time}",
          confirmArchiveTitle: "Confirm project archive",
          confirmArchiveDescription:
            "The archive package will include current workpapers only.",
          archiveProgressTitle: "Archiving project",
          archiveProgressDescription: "Packaging project files.",
          archiveCompleteTitle: "Project archived",
          archiveCompleteDescription: "The archive package is ready.",
          archiveJobPhases: {
            fileCheck: "Running archive checks",
            packaging: "Generating archive package",
            uploading: "Uploading archive package",
            finalizing: "Locking project",
          },
          archivePackage: "Archive package",
          progress: {
            label: "Check progress",
            complete: "{completed} of {total} checks complete",
            current: "Checking: {label}",
          },
          metrics: {
            workpapers: "Workpapers",
            blockers: "Blockers",
            warnings: "Warnings",
            lockedFiles: "Locked files",
          },
          table: {
            severity: "Severity",
            issue: "Issue",
            workpaper: "Workpaper",
            file: "File",
            location: "Location",
            detail: "Detail",
            action: "Action",
          },
          severityLabels: {
            BLOCKER: "Blocker",
            WARNING: "Warning",
          },
          issueTypes: {
            MISSING_PREPARER_SIGNOFF: "Missing preparer sign-off",
            MISSING_REVIEWER_SIGNOFF: "Missing reviewer sign-off",
            REVIEW_SIGNOFF_BEFORE_PREPARER: "Reviewer signed before preparer",
            SELF_REVIEWED_WORKING_PAPER: "Self-reviewed workpaper",
            OPEN_REVIEW_QUESTION: "Open review question",
            EMPTY_WORKING_PAPER: "Empty workpaper",
            LOCKED_ATTACHMENT: "Locked file",
            SMART_FORM_INCOMPLETE: "Incomplete Smart Form",
            DOCX_TRACK_CHANGES: "Word track changes",
            DOCX_UNRESOLVED_COMMENT: "Word unresolved comment",
            XLSX_UNRESOLVED_COMMENT: "Excel unresolved comment",
            XLSX_ERROR_VALUE: "Excel error value",
            OFFICE_FILE_CHECK_FAILED: "Office file check failed",
          },
          groupTitles: {
            signoffs: "Sign-off checks",
            reviewQuestions: "Review question checks",
            workpaperFiles: "Workpaper file checks",
            smartForms: "Smart Form checks",
            officeFiles: "Office document checks",
            finalizing: "Finalizing report",
            excelHints: "Excel hints",
          },
          groupStatusLabels: {
            passed: "Passed",
            blockers: "Needs action",
            warnings: "Warnings",
          },
          reviewQuestionStatusLabels: {
            OPEN: "Open",
            REPLIED: "Replied",
            CLEARED: "Cleared",
          },
          details: {
            missingPreparer: "{code} has no preparer sign-off.",
            missingReviewer: "{code} has no reviewer sign-off.",
            openReviewQuestion: "Question status: {status}.",
            openReviewQuestionWithAssignee:
              "Question status: {status}, assigned to {assignee}.",
            empty: "{code} has no active attachments.",
            lockedAttachment: "{file} is currently held by {holder}.",
            incompleteSmartForm: "{file} is incomplete.",
            selfReviewed: "{member} prepared and reviewed this workpaper.",
            commentAuthor: "Author: {author}",
            unknownHolder: "Unknown member",
          },
          actions: {
            goTo: "Go to",
            exportWord: "Export PDF",
            downloadArchive: "Download archive",
            downloading: "Downloading...",
          },
          navigator: {
            title: "File Check checklist",
            searchPlaceholder: "Search issue, file, or location",
            clearSearch: "Clear search",
            all: "All",
            blockers: "Blockers",
            warnings: "Warnings",
            noMatches: "No matching check items.",
            previous: "Previous",
            next: "Next",
            position: "{current} of {total}",
            minimize: "Minimize File Check checklist",
            restore: "Expand File Check checklist",
            close: "Close File Check checklist",
          },
          noIssues: "No archive issues found.",
          close: "Close",
          emptyValue: "-",
        },
        settingsPanel: {
          menu: {
            title: "Settings",
            description: "Description",
            navAriaLabel: "Settings navigation",
          },
          sections: {
            general: {
              label: "General",
              description: "General description",
            },
            archive: {
              label: "Archive",
              description: "Archive description",
            },
            personal: {
              label: "Personalization",
              description: "Personal description",
            },
            members: {
              label: "Members",
              description: "Members description",
            },
            cmpEngagement: {
              label: "Client & business",
              description: "Link CMP Engagement",
            },
            integrations: {
              label: "Connections & integrations",
              description: "Connections description",
            },
            desktopAgent: {
              label: "Desktop Agent",
              description: "Manage Desktop Agent",
            },
            tmsLinks: {
              label: "Timesheets",
              description: "Link saved TMS rows to this project",
            },
          },
          integrations: createIntegrationsCopy(),
          appearance: {
            title: "Appearance",
            description: "Appearance description",
            flavorLabel: "Flavor: ",
            fontSizeLabel: "Font size: ",
            accentLabel: "Accent: ",
          },
          personal: {
            title: "Personal",
            description: "Personal settings",
            darkMode: "Appearance",
            day: "Day",
            night: "Night",
            system: "System",
            fontSize: "Font size",
            nativePdfViewer: "Use browser PDF viewer",
            flavor: "Flavor",
            accent: "Accent",
          },
          members: {
            description: "Members panel",
          },
          tmsLinks: {
            title: "TMS project links",
            description: "Review linked rows and link unassigned rows.",
            add: "Link timesheet",
            pickerTitle: "Link TMS timesheet",
            pickerDescription: "Only unassigned Chargeable rows are shown.",
            loading: "Loading pending TMS rows...",
            loadingLinked: "Loading linked timesheet rows...",
            searchPlaceholder: "Search description, employee or TMS code",
            searchHint: "",
            pending: "Pending TMS rows",
            noPending: "No pending TMS rows.",
            noLinked: "No linked TMS rows.",
            link: "Link",
            unlink: "Unlink",
            linked: "Linked timesheet rows",
            owner: "Employee",
            period: "Period",
            type: "Type",
            timeEntries: "Time entries",
            descriptionColumn: "Description",
            totalHours: "Total",
            actions: "Actions",
            tableLabel: "TMS timesheet links",
            firstHalf: "First half",
            secondHalf: "Second half",
            fullMonth: "Full month",
            normal: "Normal",
            ot: "OT",
            absent: "Absent",
            noHours: "No hours entered",
            moreTimeEntries: "more",
            showAllTimeEntries: "Show all time entries",
            close: "Close",
            periodConflict:
              "Only one timesheet row can be linked in the same period. Unlink the current row first.",
            error: "TMS link action failed.",
          },
          project: {
            generalSettings: "General settings",
            projectSchedule: "Reporting dates",
            loading: "Loading project information...",
            readOnly: "Read only",
            save: "Save changes",
            saving: "Saving...",
            updated: "Project information updated",
            cmpEngagement: "CMP Engagement binding",
            cmpEngagementDescription: "Link CMP Engagement",
            cmpEngagementSearch: "Search engagement code or client",
            cmpEngagementSearchPlaceholder: "Search CMP Engagement",
            cmpEngagementNoResults: "No matching active CMP Engagements.",
            cmpEngagementNoCurrent: "No CMP Engagement is currently linked.",
            cmpEngagementCurrent: "Currently linked",
            cmpEngagementUnlink: "Unlink",
            cmpEngagementConfirmUnlink: "Confirm unlink",
            cmpEngagementLinked: "CMP Engagement linked",
            cmpEngagementUnlinked: "CMP Engagement unlinked",
            cmpEngagementLinkFailed: "CMP Engagement link failed.",
            cmpEngagementUnlinkFailed: "CMP Engagement unlink failed.",
            cmpEngagementAlreadyLinked:
              "This EMP project is already linked to a CMP Engagement.",
            cmpEngagementCodeConflict:
              "The CMP Engagement base code is already in use.",
            cmpEngagementUnavailable:
              "The selected CMP Engagement is unavailable.",
            cmpEngagementPermissionDenied:
              "You do not have permission to change this CMP binding.",
            cmpEngagementProjectNotEditable:
              "This EMP project cannot currently be edited.",
            cmpEngagementResponsibles: "PIC: {pic} · MIC: {mic}",
            cmpEngagementSearchResult:
              "{clientCode} · {clientName} · PIC {pic} · MIC {mic}",
            cmpSharedInformation: {
              codeLabels: { AUDIT: "Audit", ACTIVE: "Active" },
              associationSummary: "Linked records",
              empProject: "EMP project",
              cmpClient: "CMP client",
              cmpEngagement: "CMP engagement",
              syncHealthy: "CMP sync is healthy",
              syncNeedsAttention: "CMP data needs attention",
              lastUpdated: "Last updated",
              businessSummary: "Business summary",
              auditYear: "Audit year",
              responsibles: "Responsibles",
              clientDetails: "Client details",
              showDetails: "Show all",
              hideDetails: "Collapse",
              companyCode: "Company code",
              companyRegistration: "Company registration",
              addresses: "Addresses",
              contacts: "Contacts",
              contactName: "Name",
              contactPosition: "Position",
              contactDepartment: "Department",
              contactOfficePhone: "Office phone",
              contactMobile: "Mobile",
              contactEmail: "Email",
              website: "Website",
              yearEndDate: "Year end",
              reportingGaap: "Reporting standard",
              industry: "Industry",
              incorporation: "Incorporation",
              listing: "Listing",
              group: "Group",
              parentCompany: "Parent company",
              subsidiaries: "Subsidiaries and associates",
              clientPic: "Client PIC",
              clientMic: "Client MIC",
              engagementCode: "Business code",
              serviceType: "Service type",
              status: "Status",
              engagementDate: "Engagement date",
              reportDate: "Report date",
              pic: "PIC",
              mic: "MIC",
              eqReviewer: "EQ Reviewer",
              deliverables: "Deliverables",
              auditorsReport: "Auditor's report",
              otherServiceDescription: "Other service description",
              noContacts: "No contacts",
              notProvided: "Not provided",
            },
            recycleBinTitle: "Recycle bin",
            recycleBinDescription: "Review and restore deleted project files.",
            deletedCountLabel: "deleted",
            deleteGroup: "Delete group",
            deletePaper: "Delete working paper",
            deleteProject: "Delete project",
            archiveProject: "Submit for archive review",
            archiveSchedule: "Archive schedule",
            archiveProtection: "Archive protection",
            archiveProtectionDescription:
              "Archive packages can use a password.",
            archiveWorkflow: "Archive workflow",
            archiveWorkflowDescription: "Check files before archive review.",
            archivePassword: "Archive password",
            archivePasswordPlaceholder: "Enter archive password",
            showArchivePassword: "Show archive password",
            hideArchivePassword: "Hide archive password",
            dangerZone: "Danger zone",
            dangerZoneDescription: "Delete this project from the workspace.",
            archivingProject: "Archiving...",
            checkingFiles: "Checking files...",
          },
          fontSizeOptions: {
            sm: "Small",
            md: "Medium",
            lg: "Large",
          },
        },
      },
    },
  }),
}));

describe(WorkbenchSettingsPanel, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.me.mockResolvedValue({
      id: "user-1",
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: "PARTNER",
      status: "ACTIVE",
    });
    mockApi.userMailConnection.mockResolvedValue({
      emailAddress: "partner@projectwing.local",
      connected: false,
      provider: "WECOM_EXMAIL",
      status: null,
    });
    mockApi.connectUserMail.mockResolvedValue({
      emailAddress: "partner@projectwing.local",
      connected: true,
      provider: "WECOM_EXMAIL",
      status: "CONNECTED",
    });
    mockApi.project.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      name: "Existing project",
      projectCode: "AUD-2026-0001",
      language: "en-US",
      frameworkTemplateId: "framework-ifrs",
      status: "ACTIVE",
      reportDate: "2027-03-31T00:00:00.000Z",
      reportingDate: "2027-03-31T00:00:00.000Z",
      yearEndDate: "2026-12-31T00:00:00.000Z",
      archiveDeadline: "2027-06-29T00:00:00.000Z",
      notes: "Initial note",
    });
    mockApi.frameworkTemplates.mockResolvedValue([
      {
        id: "framework-ifrs",
        code: "IFRS",
        name: "IFRS audit framework",
        language: "en-US",
        isActive: true,
      },
    ]);
    mockApi.updateProject.mockResolvedValue({});
    mockApi.cmpEngagements.mockResolvedValue({ engagements: [] });
    mockApi.linkProjectEngagement.mockResolvedValue({});
    mockApi.unlinkProjectEngagement.mockResolvedValue({});
    mockApi.members.mockResolvedValue([]);
    mockApi.projectMemberDirectory.mockResolvedValue([]);
    mockApi.userDirectory.mockResolvedValue([]);
    mockApi.createInvitation.mockResolvedValue({
      inviteUrl: "https://wing.example/invitations/token",
      delivery: null,
    });
    mockApi.deletedAttachments.mockResolvedValue([]);
    mockApi.restoreAttachment.mockResolvedValue({});
    const archiveCheckReport = {
      project: {
        id: "project-1",
        projectCode: "AUD-2026-0001",
        name: "Existing project",
      },
      generatedAt: "2026-06-12T09:00:00.000Z",
      ready: true,
      summary: {
        attachments: 0,
        blockers: 0,
        warnings: 0,
        selfReviewedAttachments: 0,
        unresolvedReviewQuestions: 0,
        lockedAttachments: 0,
      },
      issues: [],
    };
    mockApi.archiveCheck.mockResolvedValue(archiveCheckReport);
    mockApi.startArchiveCheckJob.mockResolvedValue(
      buildArchiveCheckJob(archiveCheckReport)
    );
    mockApi.archiveCheckJob.mockResolvedValue(
      buildArchiveCheckJob(archiveCheckReport)
    );
    mockApi.startArchiveJob.mockResolvedValue(buildArchiveJob("project-1"));
    mockApi.confirmProjectArchive.mockResolvedValue(
      buildArchiveJob("project-1")
    );
    mockApi.archiveJob.mockResolvedValue(buildArchiveJob("project-1"));
    mockApi.watchArchiveJob.mockResolvedValue(null as never);
    mockApi.downloadArchiveArtifact.mockResolvedValue(
      new Blob(["archive"], { type: "application/zip" })
    );
    mockApi.deleteProject.mockResolvedValue({
      id: "project-1",
      status: "DELETED",
    });
    mockApi.tmsProjectLinks.mockResolvedValue({ links: [] });
    mockApi.linkTmsProject.mockResolvedValue({});
    mockApi.unlinkTmsProject.mockResolvedValue({});
    mockApi.exportArchiveCheck.mockResolvedValue(
      new Blob(["file-check"], {
        type: "application/pdf",
      })
    );
    mockToast.confirm.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  describe("mobile archive", () => {
    let restoreViewport: () => void;
    beforeEach(() => {
      const previousImplementation = vi.isMockFunction(window.matchMedia)
        ? window.matchMedia.getMockImplementation()
        : undefined;
      const media = vi
        .spyOn(window, "matchMedia")
        .mockImplementation((query: string) => ({
          matches: query.includes("767"),
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));
      restoreViewport = () => {
        media.mockRestore();
        if (previousImplementation && vi.isMockFunction(window.matchMedia)) {
          window.matchMedia.mockImplementation(previousImplementation);
        }
      };
    });
    afterEach(() => {
      cleanup();
      restoreViewport();
    });

    it("shows the calculated deadline and truthful idle state without starting a check", async () => {
      renderSettingsPanel({ initialSection: "archive" });
      const page = await screen.findByTestId("project-archive-settings");
      await within(page).findByText("May 30, 2027");
      expect(
        within(page).getByText("Calculated from the report date")
      ).toBeVisible();
      expect(within(page).queryByText("Checking project files")).toBeNull();
      expect(within(page).queryByRole("progressbar")).toBeNull();
      expect(mockApi.startArchiveCheckJob).not.toHaveBeenCalled();
      const password = within(page).getByPlaceholderText(
        "Enter archive password"
      );
      expect(password).toHaveAttribute("type", "password");
      fireEvent.click(
        within(page).getByRole("button", { name: "Show archive password" })
      );
      expect(password).toHaveAttribute("type", "text");
      fireEvent.click(
        within(page).getByRole("button", { name: "Hide archive password" })
      );
      expect(password).toHaveAttribute("type", "password");
    });

    it("honors workflow, editing and deletion permissions", async () => {
      renderSettingsPanel({
        initialSection: "archive",
        canRunArchiveWorkflow: false,
        canEditProject: false,
        canDeleteProject: false,
      });
      await expect(
        screen.findByPlaceholderText("Enter archive password")
      ).resolves.toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Submit for archive review" })
      ).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Delete project" })
      ).toBeNull();
    });

    it("reports a failed check and retries without submitting an archive", async () => {
      const onArchiveProject = vi.fn();
      mockApi.startArchiveCheckJob.mockRejectedValueOnce(
        new Error("Unavailable")
      );
      renderSettingsPanel({ initialSection: "archive", onArchiveProject });
      fireEvent.click(
        await screen.findByRole("button", { name: "Submit for archive review" })
      );
      await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
        "File check did not complete"
      );
      expect(screen.queryByRole("progressbar")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Retry check" }));
      await screen.findByRole("combobox", { name: "Check category" });
      expect(mockApi.startArchiveCheckJob).toHaveBeenCalledTimes(2);
      expect(onArchiveProject).not.toHaveBeenCalled();
    });

    it("shows a failed job instead of an indefinite progress bar", async () => {
      mockApi.startArchiveCheckJob.mockResolvedValueOnce(
        buildArchiveCheckJob(
          {
            project: { id: "project-1" },
            ready: false,
            summary: {},
            issues: [],
          },
          { status: "failed", report: undefined }
        )
      );
      renderSettingsPanel({ initialSection: "archive" });
      fireEvent.click(
        await screen.findByRole("button", { name: "Submit for archive review" })
      );
      await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
        "File check did not complete"
      );
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByRole("button", { name: "Retry check" })).toBeEnabled();
    });

    it("keeps blocked mobile checks navigable without permitting archive submission", async () => {
      const onLocateWorkingPaper = vi.fn();
      const onOpenArchiveCheckNavigator = vi.fn();
      const onArchiveProject = vi.fn();
      const report = {
        project: {
          id: "project-1",
          name: "Existing project",
          projectCode: "AUD-2026-0001",
        },
        generatedAt: "2026-09-12T00:00:00Z",
        ready: false,
        summary: {
          attachments: 1,
          blockers: 1,
          warnings: 0,
          lockedAttachments: 0,
        },
        issues: [
          {
            type: "MISSING_PREPARER_SIGNOFF",
            severity: "BLOCKER",
            message: "Missing P",
            workingPaper: { id: "paper-1", code: "A01", title: "Cash" },
            action: { workingPaperId: "paper-1" },
          },
        ],
      };
      mockApi.startArchiveCheckJob.mockResolvedValueOnce(
        buildArchiveCheckJob(report)
      );
      renderSettingsPanel({
        initialSection: "archive",
        onLocateWorkingPaper,
        onOpenArchiveCheckNavigator,
        onArchiveProject,
      });
      fireEvent.click(
        await screen.findByRole("button", { name: "Submit for archive review" })
      );
      await screen.findByRole("combobox", { name: "Check category" });
      expect(screen.getByText("Missing preparer sign-off")).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Submit for archive review" })
      ).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Go to" }));
      expect(onLocateWorkingPaper).toHaveBeenCalledWith("paper-1", undefined);
      expect(onOpenArchiveCheckNavigator).toHaveBeenCalledWith(
        expect.objectContaining({ report })
      );
      expect(onArchiveProject).not.toHaveBeenCalled();
    });

    it("retains confirmation steps after a clean mobile check", async () => {
      const onArchiveProject = vi.fn();
      renderSettingsPanel({ initialSection: "archive", onArchiveProject });
      fireEvent.click(
        await screen.findByRole("button", { name: "Submit for archive review" })
      );
      const report = await screen.findByRole("region", {
        name: "Archive File Check",
      });
      await within(report).findByRole("combobox", { name: "Check category" });
      expect(within(report).queryByRole("tablist")).toBeNull();
      fireEvent.click(
        within(report).getByRole("button", {
          name: "Submit for archive review",
        })
      );
      expect(within(report).getByText("Confirm project archive")).toBeVisible();
      expect(onArchiveProject).not.toHaveBeenCalled();
      fireEvent.click(
        within(report).getByRole("button", {
          name: "Submit for archive review",
        })
      );
      expect(onArchiveProject).toHaveBeenCalledOnce();
    });

    it("keeps running checks visible and deletion disabled", async () => {
      mockApi.startArchiveCheckJob.mockReturnValueOnce(new Promise(() => {}));
      renderSettingsPanel({ initialSection: "archive" });
      fireEvent.click(
        await screen.findByRole("button", { name: "Submit for archive review" })
      );
      await screen.findByRole("progressbar", { name: "Check progress" });
      expect(
        screen.getByRole("button", { name: "Delete project" })
      ).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Submit for archive review" })
      ).toBeNull();
    });

    it("keeps project deletion behind its separate confirmation", async () => {
      renderSettingsPanel({ initialSection: "archive" });
      fireEvent.click(
        await screen.findByRole("button", { name: "Delete project" })
      );
      const confirmation = await screen.findByRole("dialog", {
        name: "Delete project",
      });
      expect(mockApi.deleteProject).not.toHaveBeenCalled();
      fireEvent.click(
        within(confirmation).getByRole("button", { name: "Cancel" })
      );
      expect(mockApi.deleteProject).not.toHaveBeenCalled();
      expect(mockApi.startArchiveCheckJob).not.toHaveBeenCalled();
    });
  });

  it("opens general settings first and keeps integrations last", async () => {
    renderSettingsPanel();

    const nav = screen.getByRole("complementary", {
      name: "Settings navigation",
    });

    expect(
      within(nav)
        .getAllByRole("button")
        .map((tab) => tab.textContent)
    ).toStrictEqual([
      "General",
      "Archive",
      "Members",
      "Client & business",
      "Timesheets",
      "Personalization",
      "Desktop Agent",
      "Connections & integrations",
    ]);

    await expect(
      screen.findByLabelText("Project name")
    ).resolves.toBeInTheDocument();

    await waitFor(() => {
      expect(mockApi.project).toHaveBeenCalledWith("project-1");
    });
  }, 15_000);

  it("limits the external project editor to project settings sections", () => {
    renderSettingsPanel({ projectOnly: true });

    expect(screen.getByText("Project settings")).toBeInTheDocument();
    expect(
      within(screen.getByRole("complementary", { name: "Settings navigation" }))
        .getAllByRole("button")
        .map((tab) => tab.textContent)
    ).toStrictEqual([
      "General",
      "Archive",
      "Members",
      "Client & business",
      "Timesheets",
    ]);
  });

  it("shows the specific CMP binding failure reason", async () => {
    mockApi.cmpEngagements.mockResolvedValue({
      engagements: [
        {
          id: "engagement-a",
          clientId: "client-a",
          engagementCode: "A-2026-AUD",
          pic: "Partner One",
          mic: "Manager One",
          client: {
            id: "client-a",
            clientCode: "CLIENT-A",
            nameZh: "",
            nameEn: "Client A",
          },
        },
      ],
    });
    mockApi.linkProjectEngagement.mockRejectedValue(
      Object.assign(new Error("Code conflict"), {
        code: "PROJECT_CODE_ALREADY_IN_USE",
      })
    );
    renderSettingsPanel();

    clickSettingsTab("Client & business");
    fireEvent.change(
      await screen.findByPlaceholderText("Search CMP Engagement"),
      {
        target: { value: "A-" },
      }
    );
    fireEvent.click(await screen.findByRole("button", { name: /A-2026-AUD/ }));

    await waitFor(() => {
      expect(mockToast.toast).toHaveBeenCalledWith({
        title: "CMP Engagement link failed.",
        description: "The CMP Engagement base code is already in use.",
        variant: "destructive",
      });
    });
  });

  it("uses unlink-specific copy and preserves the backend failure reason", async () => {
    mockApi.project.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      name: "Orchid audit",
      projectCode: "ORCHID-2026-AUD",
      status: "ACTIVE",
      reportingDate: "2027-03-31",
      cmpClientId: null,
      cmpEngagementId: "engagement-1",
      cmpClient: null,
      cmpEngagement: {
        id: "engagement-1",
        clientId: "client-1",
        engagementCode: "ORCHID-2026-AUD",
        serviceType: "AUDIT",
        status: "ACTIVE",
        deliverables: [],
        updatedAt: "2026-09-02T10:00:00.000Z",
      },
    });
    mockApi.unlinkProjectEngagement.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" })
    );
    renderSettingsPanel({ projectOnly: true });
    fireEvent.click(
      await screen.findByRole("button", { name: "Client & business" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Unlink" }));

    await waitFor(() => {
      expect(mockToast.toast).toHaveBeenCalledWith({
        title: "CMP Engagement unlink failed.",
        description: "You do not have permission to change this CMP binding.",
        variant: "destructive",
      });
    });
  });

  it("shows live CMP client and engagement information for a linked project", async () => {
    mockApi.project.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      name: "Orchid audit",
      projectCode: "ORCHID-2026-AUD",
      language: "en-US",
      status: "ACTIVE",
      reportingDate: "2027-03-31",
      cmpClientId: "client-1",
      cmpEngagementId: "engagement-1",
      cmpClient: {
        id: "client-1",
        clientCode: "C-ORCHID",
        nameZh: "兰花控股有限公司",
        nameEn: "Orchid Holdings Limited",
        status: "ACTIVE",
        companyNumber: "7654321",
        addresses: [],
        contacts: [],
        clientPartnerPic: "Jony Ma",
        clientManagerMic: "Leo Li",
        updatedAt: "2026-09-02T09:30:00.000Z",
      },
      cmpEngagement: {
        id: "engagement-1",
        clientId: "client-1",
        engagementCode: "ORCHID-2026-AUD",
        serviceType: "AUDIT",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        engagementDate: "2026-11-15",
        deliverables: [],
        pic: "Jony Ma",
        mic: "Leo Li",
        eqReviewer: "Eden Chan",
        status: "ACTIVE",
        updatedAt: "2026-09-02T10:00:00.000Z",
      },
    });

    renderSettingsPanel({ projectOnly: true });
    fireEvent.click(
      await screen.findByRole("button", { name: "Client & business" })
    );

    await expect(
      screen.findByRole("heading", { name: "Linked records" })
    ).resolves.toBeVisible();
    expect(
      screen.getByRole("region", { name: "Linked records" })
    ).toHaveTextContent("C-ORCHID");
    expect(
      screen.getByRole("region", { name: "Responsibles" })
    ).toHaveTextContent("Eden Chan");
    expect(
      screen.queryByRole("heading", { name: "CMP Engagement binding" })
    ).not.toBeInTheDocument();
  });

  it("links a pending TMS row to the current EMP project", async () => {
    const pendingRow = {
      id: "tms-link-1",
      rowId: "tms-row-1",
      ownerUserId: "user-1",
      ownerName: "Jony Ma",
      year: 2026,
      month: 7,
      periodScope: "second" as const,
      tmsCode: "DUMMY-TMS-000001",
      label: "Unassigned fieldwork",
      projectId: null,
      workType: "OT" as const,
      description: "Unassigned fieldwork",
      hoursByDate: { "2026-07-16": 2, "2026-07-17": 3 },
      periodTotal: 5,
      status: "PENDING" as const,
    };
    mockApi.tmsProjectLinks.mockImplementation((input) =>
      Promise.resolve({ links: input.projectId ? [] : [pendingRow] })
    );
    mockApi.linkTmsProject.mockResolvedValue({
      id: "tms-link-1",
      rowId: "tms-row-1",
      projectId: "project-1",
      status: "LINKED",
    });

    renderSettingsPanel({ projectOnly: true });
    fireEvent.click(await screen.findByRole("button", { name: "Timesheets" }));

    const toggle = screen.getByRole("button", { name: "Link timesheet" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const picker = await screen.findByRole("region", {
      name: "Link TMS timesheet",
    });
    await expect(
      within(picker).findByText("Unassigned fieldwork")
    ).resolves.toBeVisible();
    expect(within(picker).getByText("2026/07 · Second half")).toBeVisible();
    expect(within(picker).getByText("07/16")).toBeVisible();
    expect(within(picker).getByText("2.0h")).toBeVisible();
    expect(within(picker).getByText("07/17")).toBeVisible();
    expect(within(picker).getByText("3.0h")).toBeVisible();
    await waitFor(() =>
      expect(mockApi.tmsProjectLinks).toHaveBeenCalledWith({
        status: "PENDING",
      })
    );
    fireEvent.click(within(picker).getByRole("button", { name: "Link" }));

    await waitFor(() =>
      expect(mockApi.linkTmsProject).toHaveBeenCalledWith(
        "tms-row-1",
        "project-1"
      )
    );
  });

  it("shows only the current user's linked TMS rows without an employee column", async () => {
    const ownRow = {
      id: "tms-link-own",
      rowId: "tms-row-own",
      ownerUserId: "user-1",
      ownerName: "Jony Ma",
      year: 2026,
      month: 7,
      periodScope: "first" as const,
      tmsCode: "DUMMY-TMS-000000",
      label: "Audit planning",
      projectId: "project-1",
      projectCode: "EMP-2026-AUD",
      projectName: "Audit project",
      workType: "Normal" as const,
      description: "Audit planning",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
      status: "LINKED" as const,
    };
    const otherUserRow = {
      ...ownRow,
      id: "tms-link-other",
      rowId: "tms-row-other",
      ownerUserId: "user-2",
      ownerName: "Leo Li",
      description: "Team fieldwork",
    };
    mockApi.tmsProjectLinks.mockResolvedValue({
      links: [ownRow, otherUserRow],
    });

    renderSettingsPanel({ projectOnly: true });
    fireEvent.click(await screen.findByRole("button", { name: "Timesheets" }));

    await expect(screen.findByText("Audit planning")).resolves.toBeVisible();
    expect(screen.queryByText("Team fieldwork")).not.toBeInTheDocument();
    expect(screen.queryByText("DUMMY-TMS-000000")).not.toBeInTheDocument();
    expect(screen.getByText("2026/07 · First half")).toBeVisible();
    const firstTimeEntry = screen.getByText("07/01").parentElement;
    expect(firstTimeEntry).toHaveTextContent("8.0h");
    expect(
      screen.queryByRole("columnheader", { name: "Employee" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Unlink" })).toHaveClass(
      "text-destructive"
    );
  });

  it("shows four time-entry dates and reveals the remaining dates on demand", async () => {
    mockApi.tmsProjectLinks.mockResolvedValue({
      links: [
        {
          id: "tms-link-many-days",
          rowId: "tms-row-many-days",
          ownerUserId: "user-1",
          ownerName: "Jony Ma",
          year: 2026,
          month: 7,
          periodScope: "first",
          tmsCode: "DUMMY-TMS-000020",
          label: "Audit fieldwork",
          projectId: "project-1",
          workType: "Normal",
          description: "Audit fieldwork",
          hoursByDate: {
            "2026-07-01": 8,
            "2026-07-02": 8,
            "2026-07-03": 6,
            "2026-07-06": 8,
            "2026-07-07": 4,
          },
          periodTotal: 34,
          status: "LINKED",
        },
      ],
    });

    renderSettingsPanel({ projectOnly: true });
    fireEvent.click(await screen.findByRole("button", { name: "Timesheets" }));

    const showAll = await screen.findByRole("button", {
      name: "Show all time entries (5)",
    });
    expect(screen.queryByText("07/07")).not.toBeInTheDocument();
    fireEvent.click(showAll);
    await expect(screen.findByText("07/07")).resolves.toBeVisible();
    expect(screen.getByText("4.0h")).toBeVisible();
  });

  it("keeps same-period pending rows visible and explains the link conflict", async () => {
    const linkedRow = {
      id: "tms-link-current",
      rowId: "tms-row-current",
      ownerUserId: "user-1",
      ownerName: "Jony Ma",
      year: 2026,
      month: 7,
      periodScope: "first" as const,
      tmsCode: "DUMMY-TMS-000010",
      label: "Audit planning",
      projectId: "project-1",
      workType: "Normal" as const,
      description: "Audit planning",
      hoursByDate: { "2026-07-01": 8 },
      periodTotal: 8,
      status: "LINKED" as const,
    };
    const pendingRow = {
      ...linkedRow,
      id: "tms-link-pending",
      rowId: "tms-row-pending",
      tmsCode: "DUMMY-TMS-000011",
      label: "Reporting support",
      projectId: null,
      workType: "OT" as const,
      description: "Reporting support",
      hoursByDate: { "2026-07-02": 2 },
      periodTotal: 2,
      status: "PENDING" as const,
    };
    mockApi.tmsProjectLinks.mockImplementation((input) =>
      Promise.resolve({ links: input.projectId ? [linkedRow] : [pendingRow] })
    );

    renderSettingsPanel({ projectOnly: true });
    fireEvent.click(await screen.findByRole("button", { name: "Timesheets" }));
    fireEvent.click(screen.getByRole("button", { name: "Link timesheet" }));
    const picker = await screen.findByRole("region", {
      name: "Link TMS timesheet",
    });

    await expect(
      within(picker).findByText("Reporting support")
    ).resolves.toBeVisible();
    fireEvent.click(within(picker).getByRole("button", { name: "Link" }));

    expect(mockApi.linkTmsProject).not.toHaveBeenCalled();
    expect(mockToast.toast).toHaveBeenCalledWith({
      title:
        "Only one timesheet row can be linked in the same period. Unlink the current row first.",
      variant: "destructive",
    });
    expect(within(picker).getByText("Reporting support")).toBeVisible();
  });

  it("omits explanatory text from project settings navigation and action panels", () => {
    renderSettingsPanel();

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("keeps the settings panel size stable when switching sections", async () => {
    renderSettingsPanel();

    const panel = screen.getByTestId("workbench-settings-panel");
    const initialClassName = panel.className;

    clickSettingsTab("Archive");
    await waitFor(() => {
      expect(panel.className).toBe(initialClassName);
    });

    clickSettingsTab("Members");
    await waitFor(() => {
      expect(panel.className).toBe(initialClassName);
    });

    clickSettingsTab("Personalization");
    await waitFor(() => {
      expect(panel.className).toBe(initialClassName);
    });
  });

  it("offers the browser PDF viewer preference in personalization", () => {
    renderSettingsPanel();

    clickSettingsTab("Personalization");

    expect(
      screen.getByRole("switch", { name: "Use browser PDF viewer" })
    ).toHaveAttribute("aria-checked", "false");
  });

  it("selects the theme through labeled preview cards", () => {
    renderSettingsPanel();
    clickSettingsTab("Personalization");
    expect(screen.getByRole("radio", { name: "Night" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
    fireEvent.click(screen.getByRole("radio", { name: "System" }));
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });

  it("uses a separate project delete confirmation in project settings", async () => {
    renderSettingsPanel();

    clickSettingsTab("Archive");
    await screen.findByRole("heading", { level: 3, name: "Danger zone" });
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));

    expect(mockApi.startArchiveCheckJob).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", {
      name: "Delete project",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete project" })
    );

    await waitFor(() => {
      expect(mockApi.deleteProject).toHaveBeenCalledWith("project-1");
    });
    expect(mockRouter.replace).toHaveBeenCalledWith("/en-US/engagement");
  });

  it("opens the year-end calendar without a render loop", async () => {
    renderSettingsPanel();
    const trigger = await screen.findByLabelText("Year end date");
    fireEvent.click(trigger);
    expect(await screen.findByTestId("settings-project-year-end-date-calendar"))
      .toBeInTheDocument();
    expect(mockApi.updateProject).not.toHaveBeenCalled();
  });

  it("updates basic project information from the settings panel", async () => {
    renderSettingsPanel();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Existing project")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Year end date")).toHaveTextContent(
      "Dec 31, 2026"
    );
    expect(screen.getByLabelText("Report date")).toHaveTextContent(
      "Mar 31, 2027"
    );
    expect(screen.queryByLabelText("Archive deadline")).toBeNull();
    expect(screen.queryByLabelText("Reporting date")).not.toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Existing project"), {
      target: { value: "Updated project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(mockApi.updateProject).toHaveBeenCalledWith("project-1", {
        name: "Updated project",
        projectCode: "AUD-2026-0001",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-05-30",
        archivePassword: "",
      });
    });
  });

  it("keeps archive workflow and protection controls in the archive section", async () => {
    renderSettingsPanel();

    clickSettingsTab("Archive");

    await expect(
      screen.findByLabelText("Archive deadline")
    ).resolves.toBeInTheDocument();
    expect(screen.getByLabelText("Archive deadline")).toHaveTextContent(
      "May 30, 2027"
    );
    const passwordInput = screen.getByPlaceholderText("Enter archive password");
    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(
      screen.getByRole("button", { name: "Show archive password" })
    );
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Submit for archive review" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete project" })
    ).toBeInTheDocument();
  });

  it("hides project deletion controls without delete permission", async () => {
    renderSettingsPanel({ canDeleteProject: false });

    clickSettingsTab("Archive");

    await expect(
      screen.findByLabelText("Archive deadline")
    ).resolves.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete project" })
    ).not.toBeInTheDocument();
  });

  it("shows archive check blockers before archiving", async () => {
    const onArchiveProject = vi.fn();
    const createObjectURL = vi.fn(() => "blob:archive-check");
    const revokeObjectURL = vi.fn();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockReturnValue();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    const archiveCheckReport = {
      project: {
        id: "project-1",
        projectCode: "AUD-2026-0001",
        name: "Existing project",
      },
      generatedAt: "2026-06-12T09:00:00.000Z",
      ready: false,
      summary: {
        attachments: 2,
        blockers: 1,
        warnings: 3,
        missingPreparerSignoffs: 1,
        missingReviewerSignoffs: 1,
        signoffDateIssues: 0,
        selfReviewedAttachments: 0,
        unresolvedReviewQuestions: 0,
        lockedAttachments: 0,
        incompleteSmartForms: 0,
        officeFileIssues: 1,
      },
      issues: [
        {
          type: "MISSING_PREPARER_SIGNOFF",
          severity: "BLOCKER",
          message: "A01-F001 has no preparer sign-off",
          workingPaper: {
            id: "paper-1",
            code: "A01-F001",
            title: "Cash",
          },
          location: {
            attachmentId: "attachment-1",
            attachmentName: "cash.xlsx",
            projectPath: "1000 Planning / A01-F001",
          },
          action: {
            type: "OPEN_SIGNOFF",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
          },
        },
        {
          type: "MISSING_REVIEWER_SIGNOFF",
          severity: "BLOCKER",
          message: "A01-F001 has no reviewer sign-off",
          workingPaper: {
            id: "paper-1",
            code: "A01-F001",
            title: "Cash",
          },
          location: {
            attachmentId: "attachment-1",
            attachmentName: "cash.xlsx",
            projectPath: "1000 Planning / A01-F001",
          },
          action: {
            type: "OPEN_SIGNOFF",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
          },
        },
        {
          type: "XLSX_ERROR_VALUE",
          severity: "WARNING",
          message: "A01-F001 cash.xlsx contains #REF!",
          workingPaper: {
            id: "paper-1",
            code: "A01-F001",
            title: "Cash",
          },
          location: {
            attachmentId: "attachment-1",
            attachmentName: "cash.xlsx",
            projectPath: "1000 Planning / A01-F001",
            sheetName: "Sheet1",
            cellAddress: "B2",
            value: "#REF!",
          },
          action: {
            type: "OPEN_ATTACHMENT",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
          },
        },
        {
          type: "XLSX_ERROR_VALUE",
          severity: "WARNING",
          message: "A01-F001 ledger.xlsx contains #DIV/0!",
          workingPaper: {
            id: "paper-1",
            code: "A01-F001",
            title: "Cash",
          },
          location: {
            attachmentId: "attachment-2",
            attachmentName: "ledger.xlsx",
            projectPath: "1000 Planning / A01-F001",
            sheetName: "Ledger",
            cellAddress: "D4",
            value: "#DIV/0!",
          },
          action: {
            type: "OPEN_ATTACHMENT",
            workingPaperId: "paper-1",
            attachmentId: "attachment-2",
          },
        },
        {
          type: "XLSX_ERROR_VALUE",
          severity: "WARNING",
          message: "A01-F001 cash.xlsx contains #VALUE!",
          workingPaper: {
            id: "paper-1",
            code: "A01-F001",
            title: "Cash",
          },
          location: {
            attachmentId: "attachment-1",
            attachmentName: "cash.xlsx",
            projectPath: "1000 Planning / A01-F001",
            sheetName: "Sheet1",
            cellAddress: "C3",
            value: "#VALUE!",
          },
          action: {
            type: "OPEN_ATTACHMENT",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
          },
        },
      ],
    };
    mockApi.archiveCheck.mockResolvedValue(archiveCheckReport);
    mockApi.startArchiveCheckJob.mockResolvedValue(
      buildArchiveCheckJob(archiveCheckReport)
    );
    renderSettingsPanel({ onArchiveProject });

    clickSettingsTab("Archive");
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit for archive review" })
    );

    await waitFor(() => {
      expect(mockApi.startArchiveCheckJob).toHaveBeenCalledWith("project-1");
    });
    await expect(
      screen.findByText("Archive File Check")
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByText("Check progress", { selector: ":not([hidden])" })
    ).toBeInTheDocument();
    expect(screen.getByText("5 of 5 checks complete")).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar", {
      name: "Check progress",
    });
    expect(progressBar).toHaveAttribute("data-slot", "progress");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
    expect(
      progressBar.querySelector('[data-slot="progress-indicator"]')
    ).not.toBeNull();
    expect(
      screen.getByRole("tab", { name: /Sign-off checks/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Excel hints/ })
    ).toBeInTheDocument();
    const excelHintsTab = screen.getByRole("tab", { name: /Excel hints/ });
    expect(within(excelHintsTab).getByText("2")).toHaveClass(
      "bg-warning/10",
      "text-warning"
    );
    const archiveGroupTabs = screen
      .getByRole("tab", { name: /Excel hints/ })
      .closest('[data-slot="tabs-list"]');
    expect(archiveGroupTabs).not.toBeNull();
    expect(archiveGroupTabs).toHaveClass(
      "group-data-[orientation=horizontal]/tabs:h-auto"
    );
    expect(archiveGroupTabs).toHaveClass("flex-wrap");
    expect(
      screen.getByText("Missing preparer sign-off / Missing reviewer sign-off")
    ).toBeInTheDocument();
    const signoffSection = screen
      .getByRole("tab", { name: /Sign-off checks/ })
      .closest('[data-slot="tabs"]');
    expect(signoffSection).not.toBeNull();
    expect(
      within(signoffSection as HTMLElement).getAllByText("A01-F001 Cash")
    ).toHaveLength(1);
    const signoffActionLink = within(signoffSection as HTMLElement).getByRole(
      "link",
      {
        name: "Go to",
      }
    );
    expect(signoffActionLink).toHaveAttribute(
      "href",
      expect.stringContaining("locatePaperId=paper-1")
    );
    expect(signoffActionLink).not.toHaveAttribute(
      "href",
      expect.stringContaining("focus=signoff")
    );
    expect(screen.queryByText("Excel error value")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Excel hints/ }));
    expect(screen.getAllByText("Excel error value")).toHaveLength(2);
    expect(screen.queryByText("Sheet1 / B2")).not.toBeInTheDocument();
    expect(screen.queryByText("Sheet1 / C3")).not.toBeInTheDocument();
    expect(screen.queryByText("#REF!")).not.toBeInTheDocument();
    expect(screen.queryByText("#VALUE!")).not.toBeInTheDocument();
    const excelSection = screen
      .getByRole("heading", { name: "Excel hints" })
      .closest("section");
    expect(excelSection).not.toBeNull();
    expect(
      within(excelSection as HTMLElement).getByText("Warnings")
    ).toHaveClass("bg-warning/10", "text-warning");
    for (const warningBadge of within(excelSection as HTMLElement).getAllByText(
      "Warning"
    )) {
      expect(warningBadge).toHaveClass("bg-warning/10", "text-warning");
    }
    expect(
      within(excelSection as HTMLElement).getAllByText("A01-F001 Cash")
    ).toHaveLength(2);
    expect(
      within(excelSection as HTMLElement).getAllByText("A01-F001 cash.xlsx")
    ).toHaveLength(1);
    expect(
      within(excelSection as HTMLElement).getAllByText("A01-F001 ledger.xlsx")
    ).toHaveLength(1);
    const excelActionLinks = within(excelSection as HTMLElement).getAllByRole(
      "link",
      { name: "Go to" }
    );
    expect(excelActionLinks).toHaveLength(2);
    expect(excelActionLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("locatePaperId=paper-1")
    );
    expect(excelActionLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("focus=attachment")
    );
    expect(excelActionLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("attachmentId=attachment-1")
    );
    expect(excelActionLinks[1]).toHaveAttribute(
      "href",
      expect.stringContaining("attachmentId=attachment-2")
    );
    expect(excelActionLinks[0]).not.toHaveAttribute(
      "href",
      expect.stringContaining("sheetName=Sheet1")
    );
    expect(excelActionLinks[0]).not.toHaveAttribute(
      "href",
      expect.stringContaining("cellAddress=B2")
    );
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() => {
      expect(mockApi.exportArchiveCheck).toHaveBeenCalledWith("project-1");
    });
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalledWith();
    expect(
      screen.getByRole("button", { name: "Submit for archive review" })
    ).toBeInTheDocument();
    expect(onArchiveProject).not.toHaveBeenCalled();
    anchorClick.mockRestore();
  }, 15_000);

  it("keeps archive issues navigable in the floating checklist", () => {
    const onSelectIssue = vi.fn();
    const onLocateWorkingPaper = vi.fn();
    const report = {
      project: {
        id: "project-1",
        projectCode: "AUD-2026-0001",
        name: "Existing project",
      },
      generatedAt: "2026-06-12T09:00:00.000Z",
      ready: false,
      summary: {
        attachments: 2,
        blockers: 1,
        warnings: 1,
        missingPreparerSignoffs: 1,
        missingReviewerSignoffs: 0,
        signoffDateIssues: 0,
        selfReviewedAttachments: 0,
        unresolvedReviewQuestions: 0,
        lockedAttachments: 0,
        incompleteSmartForms: 0,
        officeFileIssues: 1,
      },
      issues: [
        {
          type: "MISSING_PREPARER_SIGNOFF",
          severity: "BLOCKER",
          message: "A01-F001 has no preparer sign-off",
          workingPaper: { id: "paper-1", code: "A01-F001", title: "Cash" },
          location: {
            attachmentId: "attachment-1",
            attachmentName: "cash.xlsx",
            projectPath: "1000 Planning / A01-F001",
          },
          action: {
            type: "OPEN_SIGNOFF",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
          },
        },
        {
          type: "DOCX_TRACK_CHANGES",
          severity: "WARNING",
          message: "Track changes remain",
          workingPaper: {
            id: "paper-2",
            code: "A02-F001",
            title: "Revenue",
          },
          location: {
            attachmentId: "attachment-2",
            attachmentName: "revenue.docx",
            projectPath: "2000 Execution / A02-F001",
          },
          action: {
            type: "OPEN_ATTACHMENT",
            workingPaperId: "paper-2",
            attachmentId: "attachment-2",
          },
        },
      ],
    } satisfies ArchiveCheckReport;
    const onDragPointerDown = vi.fn();
    const { container } = render(
      <ArchiveCheckNavigator
        snapshot={{
          report,
          activeIssueKey: "signoffs:attachment:attachment-1",
        }}
        minimized={false}
        onMinimizedChange={vi.fn()}
        onClose={vi.fn()}
        onSelectIssue={onSelectIssue}
        onLocateWorkingPaper={onLocateWorkingPaper}
        onDragPointerDown={onDragPointerDown}
      />
    );

    expect(screen.getByText("File Check checklist")).toBeInTheDocument();
    expect(screen.getByText("A01-F001 cash.xlsx")).toBeInTheDocument();
    expect(screen.getByText("A02-F001 revenue.docx")).toBeInTheDocument();
    expect(screen.getByText("1000 Planning / A01-F001")).toBeInTheDocument();

    const dragHandle = container.querySelector(
      "[data-archive-check-drag-handle]"
    );
    expect(dragHandle).not.toBeNull();
    fireEvent.pointerDown(dragHandle as HTMLElement, {
      button: 0,
      clientX: 100,
      clientY: 80,
      pointerId: 1,
    });
    expect(onDragPointerDown).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onSelectIssue).toHaveBeenCalledWith(
      "officeFiles:attachment:attachment-2"
    );
    expect(onLocateWorkingPaper).toHaveBeenCalledWith(
      "paper-2",
      "attachment-2"
    );

    fireEvent.click(screen.getByRole("button", { name: /Warnings/ }));
    expect(screen.queryByText("A01-F001 cash.xlsx")).not.toBeInTheDocument();
    expect(screen.getByText("A02-F001 revenue.docx")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toHaveClass(
      "bg-warning/10",
      "text-warning"
    );
  });

  it("keeps warning rows distinct from blockers for the same attachment", () => {
    const onSelectIssue = vi.fn();
    const report = {
      project: {
        id: "project-1",
        projectCode: "AUD-2026-0001",
        name: "Existing project",
      },
      generatedAt: "2026-06-12T09:00:00.000Z",
      ready: false,
      summary: {
        attachments: 1,
        blockers: 1,
        warnings: 1,
        missingPreparerSignoffs: 1,
        missingReviewerSignoffs: 0,
        signoffDateIssues: 0,
        selfReviewedAttachments: 0,
        unresolvedReviewQuestions: 0,
        lockedAttachments: 0,
        incompleteSmartForms: 0,
        officeFileIssues: 1,
      },
      issues: [
        {
          type: "MISSING_PREPARER_SIGNOFF",
          severity: "BLOCKER",
          message: "A01-F001 has no preparer sign-off",
          workingPaper: { id: "paper-1", code: "A01-F001", title: "Cash" },
          location: {
            attachmentId: "attachment-1",
            attachmentName: "cash.docx",
            projectPath: "1000 Planning / A01-F001",
          },
          action: {
            type: "OPEN_SIGNOFF",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
          },
        },
        {
          type: "DOCX_TRACK_CHANGES",
          severity: "WARNING",
          message: "Track changes remain",
          workingPaper: { id: "paper-1", code: "A01-F001", title: "Cash" },
          location: {
            attachmentId: "attachment-1",
            attachmentName: "cash.docx",
            projectPath: "1000 Planning / A01-F001",
          },
          action: {
            type: "OPEN_ATTACHMENT",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
          },
        },
      ],
    } satisfies ArchiveCheckReport;

    render(
      <ArchiveCheckNavigator
        snapshot={{
          report,
          activeIssueKey: "signoffs:attachment:attachment-1",
        }}
        minimized={false}
        onMinimizedChange={vi.fn()}
        onClose={vi.fn()}
        onSelectIssue={onSelectIssue}
        onLocateWorkingPaper={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Warnings/ }));

    expect(
      screen.queryByText("Missing preparer sign-off")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Word track changes")).toBeInTheDocument();
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    expect(onSelectIssue).toHaveBeenLastCalledWith(
      "officeFiles:attachment:attachment-1"
    );
  });

  it("hands the full archive report to the floating checklist before locating an issue", async () => {
    const onLocateWorkingPaper = vi.fn();
    const onOpenArchiveCheckNavigator = vi.fn();
    const report = {
      project: {
        id: "project-1",
        projectCode: "AUD-2026-0001",
        name: "Existing project",
      },
      generatedAt: "2026-06-12T09:00:00.000Z",
      ready: false,
      summary: {
        attachments: 1,
        blockers: 1,
        warnings: 0,
        missingPreparerSignoffs: 1,
        missingReviewerSignoffs: 0,
        signoffDateIssues: 0,
        selfReviewedAttachments: 0,
        unresolvedReviewQuestions: 0,
        lockedAttachments: 0,
        incompleteSmartForms: 0,
        officeFileIssues: 0,
      },
      issues: [
        {
          type: "MISSING_PREPARER_SIGNOFF",
          severity: "BLOCKER",
          message: "A01-F001 has no preparer sign-off",
          workingPaper: { id: "paper-1", code: "A01-F001", title: "Cash" },
          location: {
            attachmentId: "attachment-1",
            attachmentName: "cash.xlsx",
            projectPath: "1000 Planning / A01-F001",
          },
          action: {
            type: "OPEN_SIGNOFF",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
          },
        },
      ],
    } satisfies ArchiveCheckReport;
    mockApi.startArchiveCheckJob.mockResolvedValue(
      buildArchiveCheckJob(report)
    );
    mockApi.archiveCheckJob.mockResolvedValue(buildArchiveCheckJob(report));

    renderSettingsPanel({
      onLocateWorkingPaper,
      onOpenArchiveCheckNavigator,
    });

    clickSettingsTab("Archive");
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit for archive review" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Go to" }));

    expect(onOpenArchiveCheckNavigator).toHaveBeenCalledWith({
      report,
      activeIssueKey: "signoffs:attachment:attachment-1",
    });
    expect(onLocateWorkingPaper).toHaveBeenCalledWith(
      "paper-1",
      "attachment-1"
    );
  });

  it("shows detailed progress while archive check is running", async () => {
    mockApi.startArchiveCheckJob.mockResolvedValue(
      buildArchiveCheckJob(
        {
          project: { id: "project-1" },
          ready: false,
          summary: {},
          issues: [],
        },
        {
          status: "queued",
          currentPhase: "signoffs",
          report: undefined,
          progress: {
            completedUnits: 0,
            totalUnits: 8,
            groups: [
              {
                id: "signoffs",
                label: "signoffs",
                completedUnits: 2,
                totalUnits: 3,
                status: "running",
              },
              {
                id: "reviewQuestions",
                label: "reviewQuestions",
                completedUnits: 0,
                totalUnits: 3,
                status: "pending",
              },
              {
                id: "officeFiles",
                label: "officeFiles",
                completedUnits: 0,
                totalUnits: 1,
                status: "pending",
              },
              {
                id: "finalizing",
                label: "finalizing",
                completedUnits: 0,
                totalUnits: 1,
                status: "pending",
              },
            ],
          },
        }
      )
    );
    mockApi.archiveCheckJob.mockResolvedValue(
      buildArchiveCheckJob(
        {
          project: { id: "project-1" },
          ready: false,
          summary: {},
          issues: [],
        },
        {
          status: "running",
          currentPhase: "officeFiles",
          currentLabel: "A01-F001 cash.xlsx",
          report: undefined,
          progress: {
            completedUnits: 5,
            totalUnits: 8,
            groups: [
              {
                id: "signoffs",
                label: "signoffs",
                completedUnits: 3,
                totalUnits: 3,
                status: "completed",
              },
              {
                id: "reviewQuestions",
                label: "reviewQuestions",
                completedUnits: 2,
                totalUnits: 3,
                status: "running",
              },
              {
                id: "officeFiles",
                label: "officeFiles",
                completedUnits: 0,
                totalUnits: 1,
                status: "running",
              },
              {
                id: "finalizing",
                label: "finalizing",
                completedUnits: 0,
                totalUnits: 1,
                status: "pending",
              },
            ],
          },
        }
      )
    );
    renderSettingsPanel();

    clickSettingsTab("Archive");
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit for archive review" })
    );

    await expect(
      screen.findByText("Archive File Check")
    ).resolves.toBeInTheDocument();
    await expect(
      screen.findAllByText("Checking: A01-F001 cash.xlsx")
    ).resolves.toHaveLength(2);
    expect(
      screen.getByRole("button", { hidden: true, name: "Delete project" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { hidden: true, name: "Checking files..." })
    ).toBeDisabled();
    expect(screen.getByText("5 of 8 checks complete")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Check progress" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mockApi.archiveCheckJob).toHaveBeenCalledWith(
        "project-1",
        "archive-job-1"
      );
    });
    const progressBar = screen.getByRole("progressbar", {
      name: "Check progress",
    });
    expect(progressBar).toHaveAttribute("data-slot", "progress");
    expect(progressBar).toHaveAttribute("aria-valuenow", "63");
    expect(
      progressBar.querySelector('[data-slot="progress-indicator"]')
    ).not.toBeNull();
  });

  it("submits archive review after a clean archive check and secondary confirmation", async () => {
    const onArchiveProject = vi.fn();
    renderSettingsPanel({ onArchiveProject });

    clickSettingsTab("Archive");
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit for archive review" })
    );
    const dialog = await screen.findByRole("region", {
      name: "Archive File Check",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Submit for archive review" })
    );
    await expect(
      within(dialog).findByText("Confirm project archive")
    ).resolves.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Submit for archive review" })
    );

    await waitFor(() => {
      expect(onArchiveProject).toHaveBeenCalledOnce();
    });
    expect(mockApi.startArchiveJob).not.toHaveBeenCalled();
  });

  it("uses the final archive action after a clean pending-review archive check", async () => {
    const onArchiveProject = vi.fn();
    mockApi.project.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      name: "Existing project",
      projectCode: "AUD-2026-0001",
      language: "en-US",
      frameworkTemplateId: "framework-ifrs",
      status: "PENDING_FINAL_CHECK",
      reportDate: "2027-03-31T00:00:00.000Z",
      reportingDate: "2027-03-31T00:00:00.000Z",
      yearEndDate: "2026-12-31T00:00:00.000Z",
      archiveDeadline: "2027-06-29T00:00:00.000Z",
      notes: "Initial note",
    });
    renderSettingsPanel({
      canArchiveProject: false,
      canRunArchiveWorkflow: true,
      isFinalArchiveReview: true,
      onArchiveProject,
    });

    clickSettingsTab("Archive");
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm archive" })
    );
    const dialog = await screen.findByRole("region", {
      name: "Archive File Check",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm archive" })
    );
    await expect(
      within(dialog).findByText("Confirm project archive")
    ).resolves.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm archive" })
    );

    await waitFor(() => {
      expect(onArchiveProject).toHaveBeenCalledOnce();
    });
  });

  it("shows persisted final archive job progress in the archive dialog", async () => {
    renderSettingsPanel({
      archivePending: true,
      archiveJob: buildArchiveJob("project-1", {
        status: "running",
        currentPhase: "uploading",
        progress: {
          completedUnits: 2,
          totalUnits: 4,
        },
        artifact: undefined,
      }),
    });

    clickSettingsTab("Archive");
    const archiveJobButton = await screen.findByRole("button", {
      name: "Archiving...",
    });
    expect(archiveJobButton).not.toBeDisabled();
    fireEvent.click(archiveJobButton);
    expect(
      screen.queryByRole("button", { name: "Submit for archive review" })
    ).toBeNull();

    const dialog = await screen.findByRole("region", {
      name: "Archive File Check",
    });
    await expect(
      within(dialog).findByText("Archiving project", {
        selector: ":not([hidden])",
      })
    ).resolves.toBeInTheDocument();
    expect(
      within(dialog).getByText("Uploading archive package")
    ).toBeInTheDocument();
    expect(within(dialog).getByText("2/4")).toBeInTheDocument();
    const progressBar = within(dialog).getByRole("progressbar", {
      name: "Archiving project",
    });
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
    expect(
      within(dialog).queryByRole("button", {
        name: "Submit for archive review",
      })
    ).toBeNull();
  });

  it("offers reopen after final archive blockers", async () => {
    const onReopenProject = vi.fn();
    const blockedReport = {
      project: {
        id: "project-1",
        projectCode: "AUD-2026-0001",
        name: "Existing project",
      },
      generatedAt: "2026-06-12T09:00:00.000Z",
      ready: false,
      summary: {
        attachments: 1,
        blockers: 1,
        warnings: 0,
        selfReviewedAttachments: 0,
        unresolvedReviewQuestions: 0,
        lockedAttachments: 0,
      },
      issues: [
        {
          type: "EMPTY_WORKING_PAPER",
          severity: "BLOCKER",
          message: "A01-F001 has no active attachments",
          workingPaper: {
            id: "paper-1",
            code: "A01-F001",
            title: "Cash",
          },
        },
      ],
    };
    mockApi.project.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      name: "Existing project",
      projectCode: "AUD-2026-0001",
      language: "en-US",
      frameworkTemplateId: "framework-ifrs",
      status: "PENDING_FINAL_CHECK",
      reportDate: "2027-03-31T00:00:00.000Z",
      reportingDate: "2027-03-31T00:00:00.000Z",
      yearEndDate: "2026-12-31T00:00:00.000Z",
      archiveDeadline: "2027-06-29T00:00:00.000Z",
      notes: "Initial note",
    });
    mockApi.startArchiveCheckJob.mockResolvedValue(
      buildArchiveCheckJob(blockedReport)
    );
    renderSettingsPanel({
      canArchiveProject: false,
      canRunArchiveWorkflow: true,
      isFinalArchiveReview: true,
      onReopenProject,
    });

    clickSettingsTab("Archive");
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm archive" })
    );
    const dialog = await screen.findByRole("region", {
      name: "Archive File Check",
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Reopen" }));

    await waitFor(() => {
      expect(onReopenProject).toHaveBeenCalledOnce();
    });
  });
});

function buildArchiveCheckJob(
  report: {
    project: { id: string };
    ready: boolean;
    summary: unknown;
    issues: unknown[];
  },
  overrides: Record<string, unknown> = {}
) {
  const groups = [
    { id: "signoffs", completedUnits: 1, totalUnits: 1 },
    { id: "reviewQuestions", completedUnits: 1, totalUnits: 1 },
    { id: "workpaperFiles", completedUnits: 1, totalUnits: 1 },
    { id: "officeFiles", completedUnits: 1, totalUnits: 1 },
    { id: "finalizing", completedUnits: 1, totalUnits: 1 },
  ].map((group) => ({
    ...group,
    label: group.id,
    status: "completed",
  }));
  return {
    jobId: "archive-job-1",
    projectId: report.project.id,
    status: "completed",
    currentPhase: "finalizing",
    progress: {
      completedUnits: groups.length,
      totalUnits: groups.length,
      groups,
    },
    report,
    createdAt: "2026-06-12T09:00:00.000Z",
    updatedAt: "2026-06-12T09:00:00.000Z",
    ...overrides,
  };
}

function buildArchiveJob(
  projectId: string,
  overrides: Partial<ArchiveJobSnapshot> = {}
): ArchiveJobSnapshot {
  const job: ArchiveJobSnapshot = {
    jobId: "archive-job-1",
    projectId,
    status: "completed",
    currentPhase: "finalizing",
    progress: {
      completedUnits: 4,
      totalUnits: 4,
    },
    artifact: {
      id: "artifact-1",
      projectId,
      fileName: "AUD-2026-0001-archive.zip",
      objectKey: "project-archives/project-1/AUD-2026-0001-archive.zip",
      fileSize: 2048,
      mimeType: "application/zip",
      createdBy: "user-1",
      createdAt: "2026-06-12T09:01:00.000Z",
    },
    createdAt: "2026-06-12T09:00:00.000Z",
    updatedAt: "2026-06-12T09:01:00.000Z",
  };
  return { ...job, ...overrides };
}

function renderSettingsPanel(
  overrides: Partial<Parameters<typeof WorkbenchSettingsPanel>[0]> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(WorkbenchSettingsPanel, {
        projectId: "project-1",
        canArchiveProject: true,
        canDeleteProject: true,
        canEditProject: true,
        archivePending: false,
        onArchiveProject: vi.fn(),
        ...overrides,
      })
    )
  );
}
