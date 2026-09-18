import { DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE } from "@project-wing/shared";
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DesktopState } from "../api/client";
import { ThemeProvider } from "../components/theme-provider";
import { ToastProvider } from "../components/toast";
import { defaultTheme } from "../lib/theme";
import { ProjectsPage } from "./projects";

configure({ asyncUtilTimeout: 5000 });

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  prefetch: vi.fn(),
  replace: vi.fn(),
}));
const mockI18n = vi.hoisted(() => ({
  locale: "en-US" as "en-US" | "zh-CN",
}));
const mockNavigation = vi.hoisted(() => ({
  searchParams: "",
}));
const mockApi = vi.hoisted(() => ({
  createDesktopFolder: vi.fn(),
  deleteDesktopFolder: vi.fn(),
  createProject: vi.fn(),
  cmpClients: vi.fn(),
  cmpEngagements: vi.fn(),
  desktop: vi.fn(),
  project: vi.fn(),
  projectMemberDirectory: vi.fn(),
  projects: vi.fn(),
  rollForwardPreview: vi.fn(),
  frameworkTemplates: vi.fn(),
  inboxMessages: vi.fn(),
  workItems: vi.fn(),
  listDevelopmentAccounts: vi.fn(),
  impersonateDevelopmentAccount: vi.fn(),
  markInboxRead: vi.fn(),
  markInboxUnread: vi.fn(),
  me: vi.fn(),
  signOut: vi.fn(),
  userDirectory: vi.fn(),
  adminProjectTemplate: vi.fn(),
  adminProjectTemplates: vi.fn(),
  adminSmartFormTemplates: vi.fn(),
  createProjectTemplate: vi.fn(),
  createProjectTemplatePlaceholder: vi.fn(),
  createProjectTemplateSmartForm: vi.fn(),
  createSmartFormTemplate: vi.fn(),
  deleteProjectTemplate: vi.fn(),
  deleteSmartFormTemplate: vi.fn(),
  importProjectTemplateZip: vi.fn(),
  createProjectTemplateNode: vi.fn(),
  publishSmartFormTemplate: vi.fn(),
  deleteProjectTemplateNode: vi.fn(),
  deleteProjectTemplateFile: vi.fn(),
  smartFormTemplates: vi.fn(),
  updateSmartFormTemplate: vi.fn(),
  updateProjectTemplate: vi.fn(),
  updateProjectTemplateNode: vi.fn(),
  uploadProjectTemplateFile: vi.fn(),
  projectTemplate: vi.fn(),
  projectTemplates: vi.fn(),
  createInvitation: vi.fn(),
  reorderDesktopProjectPlacements: vi.fn(),
  updateDesktopProjectPlacement: vi.fn(),
  updateDesktopFolder: vi.fn(),
  updateProject: vi.fn(),
  archiveProject: vi.fn(),
  deleteProject: vi.fn(),
  deletedProjects: vi.fn(),
  restoreProject: vi.fn(),
}));

function requireElement<T extends Element>(element: T | null): T {
  if (!element) {
    throw new Error("Expected test element to be present");
  }
  return element;
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/engagement",
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(mockNavigation.searchParams),
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: mockI18n.locale,
    dictionary: {
      common: {
        settings: "Settings",
        userManagement: "User management",
        avatarSuffix: "avatar",
        moreActions: "More actions",
      },
      language: {
        label: "Language",
        zhCN: "Chinese",
        enUS: "English",
      },
      smartFormV2Preview: {
        readOnly: "Read only",
        schemaVersion: "Schema version",
        emptyValue: "Empty",
        unresolvedComponent: "Unresolved component",
        attachment: "Attachment",
        reference: "Reference",
        tableLabel: "Smart Form table",
        previewLabel: "SmartForm V2 preview",
        expand: "Expand",
        collapse: "Collapse",
        expandSection: "Expand section",
        collapseSection: "Collapse section",
        expansionControls: "Expansion controls",
        expandAll: "Expand all",
        collapseAll: "Collapse all",
      },
      smartFormV2Designer: {
        designerLabel: "SmartForm V2 Template Designer",
        astBadge: "V2 AST",
        save: "Save",
        saved: "Saved",
        unsaved: "Unsaved changes",
        outline: "Outline",
        preview: "Live preview",
        inspector: "Inspector",
        template: "Template",
        title: "Title",
        description: "Description",
        addSection: "Add section",
        addTopLevelContent: "Add top-level content",
        addField: "Add field",
        addContent: "Add content",
        addSheet: "Add audit procedure sheet",
        procedureRows: "Procedure rows",
        procedureLabel: "Procedure",
        addProcedure: "Add procedure row",
        procedureSheetTitleZh: "审计程序",
        procedureSheetTitleEn: "Audit procedures",
        descriptionPlaceholderZh: "补充说明（可选）",
        descriptionPlaceholderEn: "Add an optional description",
        deleteNode: "Delete node",
        selectNode: "Select a node",
        section: "Section",
        group: "Group",
        field: "Field",
        content: "Content",
        sheet: "Sheet",
        component: "Component",
        fieldLabel: "Field label",
        fieldType: "Field type",
        required: "Required",
        choice: "Choice",
        text: "Text",
        richText: "Rich text",
        yes: "Yes",
        no: "No",
        noSelection: "No node selected",
        invalidDefinition:
          "Fix the template structure before previewing or saving.",
        sectionTitlePlaceholder: "New section",
        fieldLabelPlaceholder: "New field",
        descriptionPlaceholder: "Add an optional description",
        contextHint: "Right-click any item in the preview to edit it.",
        canvasMenu: "Template",
        newSectionAfter: "New section after",
        insertQuestion: "Insert question",
        insertTable: "Insert table",
        editSection: "Edit section",
        editQuestion: "Edit question",
        editTable: "Edit table",
        editContent: "Edit content",
        delete: "Delete",
        cancel: "Cancel",
        create: "Create",
        update: "Update",
        questionLabel: "Question",
        questionHelp: "Help text",
        questionType: "Answer data type",
        singleChoice: "Single choice",
        multipleChoice: "Multiple choice",
        number: "Number",
        reference: "Reference",
        attachment: "Attachment",
        date: "Date",
        optionsOnePerLine: "Options",
        optionsPlaceholder: "One option per line",
        cardinality: "Quantity",
        one: "One",
        many: "Many",
        numberFormat: "Number format",
        decimal: "Decimal",
        currency: "Currency",
        percent: "Percent",
        currencyCode: "Currency code",
        tableTitle: "Table title",
        rowHeader: "Row header",
        columns: "Columns",
        columnHeader: "Column header",
        columnType: "Column data type",
        addColumn: "Add column",
        rows: "Rows",
        rowLabel: "Row item",
        rowType: "Row type",
        questionRow: "Question row",
        staticRow: "Static text row",
        addRow: "Add row",
        remove: "Remove",
        deleteTitle: "Delete item?",
        deleteDescription: "Delete {name} and its nested content?",
        confirmDelete: "This action cannot be undone.",
        manageStructure: "Manage structure",
        structureRecovery: "Structure recovery",
        structureRecoveryDescription: "Edit hidden or unavailable nodes.",
        edit: "Edit",
        staticText: "Static text",
        ribbonInsert: "Insert (drag onto page)",
        ribbonEdit: "Edit",
        ribbonView: "View",
        undo: "Undo",
        redo: "Redo",
        language: "Language",
        languageChinese: "中文",
        languageEnglish: "English",
        translationMode: "Translate text only.",
        chineseReference: "Chinese reference",
        dropIntoSection: "Drop blocks into this section",
        dropIntoDocument: "Drop sections or blocks onto the page",
        staticTextPlaceholder: "Enter static explanatory text",
      },
      nav: {
        account: "Current account",
        accountMenu: "Account menu",
        signOut: "Sign out",
      },
      workItems: {
        empTitle: "EMP work items",
        opsTitle: "OPS work items",
        projectTitle: "Project work items",
        resizeEmp: "Resize EMP work item sidebar",
        resizeProject: "Resize project work item sidebar",
      },
      inboxPopover: {
        triggerLabel: "Inbox",
        pendingTitle: "Pending invitations",
        pendingDescription: "Open an invitation and choose a folder to join.",
        emptyDescription: "No pending invitations.",
        openInvitation: "Open invitation",
        openMessage: "View message",
        viewAll: "View all messages",
      },
      inbox: {
        title: "Notifications",
        emptyTitle: "No notifications",
        emptyDescription: "Notifications appear here.",
        openInvitation: "Open invitation",
        openProject: "Open project",
        openWorkpaper: "Open workpaper",
        markRead: "Mark as read",
        markUnread: "Mark as unread",
        actionRequiredStatus: "Action required",
        unreadStatus: "Unread",
        readStatus: "Read",
        resolvedStatus: "Resolved",
        allTab: "All",
        todoTab: "To-do",
        todoEmptyTitle: "No to-dos",
        todoEmptyDescription: "No messages require action.",
        today: "Today",
        yesterday: "Yesterday",
        lastSevenDays: "Last 7 days",
        earlier: "Earlier",
        actionTab: "Action",
        reviewTab: "Note",
        signoffTab: "Sign-off",
        readTab: "Read",
        typeLabels: {
          PROJECT_INVITATION: "Invitation",
          REVIEW_QUESTION: "Review note",
          REVIEW_REPLY: "Review reply",
          REVIEW_FOLLOW_UP: "Follow-up",
          REVIEW_REOPENED: "Reopened",
          SIGNOFF: "Sign-off",
          SYSTEM_NOTIFICATION: "System",
        },
      },
      desktop: {
        title: "Project Wing",
        archivedStatus: "Archived",
        pendingFinalCheckStatus: "Pending archive review",
        searchPlaceholder: "Search projects, clients, folders...",
        folderSwitcher: "Project folders",
        clearSearch: "Clear search",
        create: "Create",
        cancel: "Cancel",
        apps: {
          home: "Home",
          inbox: "Inbox",
          templates: "Template library",
          smartForms: "Smart Forms",
        },
        templateLibrary: {
          title: "Template library",
          description: "Manage reusable template folders.",
          templatesLabel: "Template folders",
          projectTemplatesLabel: "Project templates",
          editProjectTemplates: "Edit project templates",
          editSmartForms: "Edit Smart Forms",
          projectTemplateWorkspaceDescription:
            "Maintain project-level templates with directory structure and reusable template files.",
          templateCount: "{count} templates",
          templateSummary: "{nodes} folders · {files} files",
          searchPlaceholder: "Search templates, subjects, or workpapers",
          searchLabel: "Search templates",
          filterSmartForms: "Filter Smart Forms",
          allSmartFormStatuses: "All statuses",
          loading: "Loading templates...",
          empty: "No templates available",
          noResults: "No matching templates",
          includedWorkpapers: "Included workpapers",
          itemCount: "{count} workpapers",
          nodeCount: "{count} directory nodes",
          fileCount: "{count} template files",
          emptyFolder: "Empty template folder",
          workpaperType: "Workpaper",
          supplementType: "Supporting file",
          templateStructure: "Template structure",
          templateFiles: "Template files",
          frameworkLabel: "Framework",
          globalTemplate: "Global template",
          selectTemplatePrompt: "Select a project template from the left",
          code: "Code",
          titleColumn: "Title",
          type: "Type",
          newFolderLabel: "New template folder",
          newFolderPlaceholder: "Template folder name",
          createFolder: "Create template folder",
          importLabel: "Import template",
          exportLabel: "Export template",
          renameLabel: "Rename template",
          renamePlaceholder: "Template name",
          saveRename: "Save name",
          cancelRename: "Cancel rename",
          folderCreatedTitle: "Template folder created",
          folderCreatedDescription: "Created {name}",
          importSuccessTitle: "Template imported",
          importSuccessDescription: "Imported {name}",
          exportSuccessTitle: "Template exported",
          exportSuccessDescription: "Exported {name}",
          renameSuccessTitle: "Template renamed",
          renameSuccessDescription: "Saved as {name}",
          noTemplateSelected: "Select a template first",
          invalidImportFile: "Template file is invalid",
          close: "Close",
          cancel: "Cancel",
          newProjectTemplate: "Generate",
          newOrImportProjectTemplate: "Create / Import template",
          importProjectTemplateZip: "Import",
          importProjectTemplateZipTitle: "Import template",
          newSmartFormTemplate: "New form",
          createSmartFormTemplateTitle: "New Smart Form",
          templateName: "Template name",
          templateCode: "Template code",
          smartFormName: "Smart Form name",
          smartFormCode: "Smart Form code",
          smartFormDescription: "Description",
          projectTemplateZipFile: "Template zip file",
          templateLanguage: "Template language",
          simplifiedChinese: "Simplified Chinese",
          english: "English",
          createTemplate: "Generate",
          createBlankTemplate: "Create blank template",
          importTemplate: "Import template",
          templateArchiveOptional:
            "Leave this empty to create a blank template.",
          createSmartFormTemplate: "Create Smart Form",
          publishSmartFormTemplate: "Publish",
          deleteProjectTemplate: "Delete template",
          deleteSmartFormTemplate: "Delete Smart Form",
          createTemplateError: "Project template failed",
          importTemplateError: "Project template import failed",
          createSmartFormTemplateError: "Smart Form creation failed",
          publishSmartFormTemplateError: "Smart Form publish failed",
          addRootFolder: "New top folder",
          addChildFolder: "New child folder",
          folderCode: "Folder code",
          folderTitle: "Folder title",
          fileSize: "Size",
          uploadFile: "Upload template file",
          addPlaceholderToFolder: "Add leave-blank",
          placeholderDialogTitle: "New leave-blank",
          placeholderCode: "Reference code",
          placeholderName: "Leave-blank name",
          placeholderType: "File type",
          createPlaceholder: "Create leave-blank",
          placeholderCreatedTitle: "Leave-blank created",
          placeholderCreateError: "Could not create leave-blank",
          placeholderBadge: "Leave-blank",
          addSmartFormToFolder: "Add Smart Form",
          addSmartForm: "Add",
          smartFormTemplateReference: "Smart Form template",
          noPublishedSmartForms: "No published Smart Forms",
          deleteFile: "Delete",
          deleteSmartFormReference: "Delete",
          viewTemplateFile: "View details",
          selectFolderPrompt: "Select a folder first",
          uploadSuccessTitle: "Template file uploaded",
          smartFormTemplateCreatedTitle: "Smart Form created",
          smartFormTemplatePublishedTitle: "Smart Form published",
          smartFormTemplateDeletedTitle: "Smart Form deleted",
          smartFormReferenceAddedTitle: "Smart Form added",
          smartFormReferenceDeletedTitle: "Smart Form removed",
          deleteSuccessTitle: "Template file deleted",
          folderSuccessTitle: "Template folder created",
          draftStatus: "Draft",
          publishedStatus: "Published",
          smartFormTemplateSummary:
            "{questions} questions · {required} required",
          smartFormSavedStatus: "Saved",
          smartFormSavingStatus: "Saving...",
          smartFormSettings: "Smart Form settings",
          templateSettings: "Template settings",
          saveTemplateSettings: "Save settings",
          recommendedFrameworkLabel: "Recommended standard",
          publishedToggleLabel: "Published",
          templateSettingsSavedTitle: "Template settings saved",
          makeTemplateAvailable: "Make template available",
          hideTemplateFromUse: "Hide template from use",
          templateAvailableTitle: "Template is available",
          templateHiddenTitle: "Template is hidden",
          resizeNavigationSidebar: "Resize navigation sidebar",
          resizeTemplateWorkspacePanels: "Resize template workspace panels",
        },
        folders: "Folders",
        defaultFolder: "Default",
        folderMenu: {
          newFolder: "New folder",
          renameFolder: "Rename folder",
          deleteFolder: "Delete folder",
          renameTitle: "Rename folder",
          save: "Save",
          deleteTitle: "Delete folder?",
          deleteDescription: "Delete “{name}”? This action cannot be undone.",
          deleteConfirm: "Delete",
          deleteNonEmpty: "Move every project out of this folder first",
          protectedFolder: "System folders cannot be renamed or deleted",
          actionFailed: "Folder action failed",
        },
        projectsViewTitle: "Project management",
        projectCount: "{count} projects",
        dataGridColumnMenu: {
          clear: "Clear filter",
          empty: "No options found",
          filter: "Filter",
          search: "Search",
        },
        engagement: "Engagement",
        projectCode: "Project code",
        systemId: "System ID",
        columns: "Columns",
        actions: "Actions",
        editProject: "Edit project",
        viewModeLabel: "Project view",
        clientCode: "Client Code",
        clientName: "Client Name",
        pic: "PIC",
        mic: "MIC",
        columnFilterPlaceholder: "Filter...",
        columnFilterEmpty: "No projects match the current filters",
        listView: "Details",
        iconView: "Icons",
        openProject: "Open project",
        context: {
          view: "View",
          sort: "Sort by",
          refresh: "Refresh",
          refreshing: "Refreshing...",
          new: "New",
          newProject: "New project",
          newFolder: "New folder",
          display: "Display settings",
          sortDirection:
            mockI18n.locale === "zh-CN" ? "排序方向" : "Sort direction",
          ascending: mockI18n.locale === "zh-CN" ? "升序" : "Ascending",
          descending: mockI18n.locale === "zh-CN" ? "降序" : "Descending",
          sortName: mockI18n.locale === "zh-CN" ? "名称" : "Name",
          sortCreatedAt:
            mockI18n.locale === "zh-CN" ? "创建时间" : "Created time",
          sortLastOpened:
            mockI18n.locale === "zh-CN" ? "涓婃鎵撳紑" : "Last opened",
          sortReportDate:
            mockI18n.locale === "zh-CN" ? "报告日期" : "Report date",
          sortArchiveDeadline:
            mockI18n.locale === "zh-CN" ? "归档截止日" : "Archive deadline",
          sortNameAsc: "Name (A-Z)",
          sortNameDesc: "Name (Z-A)",
          sortCreatedAtDesc: "Created time (Newest first)",
          sortCreatedAtAsc: "Created time (Oldest first)",
          sortReportDateDesc: "Report date (Latest first)",
          sortReportDateAsc: "Report date (Earliest first)",
          sortArchiveDeadlineDesc: "Archive deadline (Latest first)",
          sortArchiveDeadlineAsc: "Archive deadline (Earliest first)",
          density: "Icon density",
          densityCompact: "Compact",
          densityStandard: "Standard",
          densityComfortable: "Comfortable",
          showProjectCode:
            mockI18n.locale === "zh-CN" ? "显示项目代码" : "Show project code",
          showClientCode:
            mockI18n.locale === "zh-CN" ? "显示客户代码" : "Show Client Code",
          showClientName:
            mockI18n.locale === "zh-CN" ? "显示客户名称" : "Show Client Name",
          showLastOpened:
            mockI18n.locale === "zh-CN"
              ? "鏄剧ず涓婃鎵撳紑"
              : "Show last opened",
          showReportDate:
            mockI18n.locale === "zh-CN" ? "显示报告日期" : "Show report date",
          showArchiveDeadline:
            mockI18n.locale === "zh-CN"
              ? "显示归档截止日"
              : "Show archive deadline",
        },
        projectKind: "Project",
        folderKind: "Folder",
        lastOpened: "Last opened",
        lastOpenedRelative: "Opened {time}",
        justNow: "just now",
        neverOpened: "Never opened",
        reportDate: "Report date",
        archiveDeadline: "Archive deadline",
        noFramework: "No framework",
        empty: "No projects in this folder",
        projectRecycleBin: "Recycle bin",
        projectRecycleBinDescription: "Deleted projects are saved here.",
        projectRecycleBinEmpty: "No deleted projects.",
        deletedProjectsCount: "{count} deleted projects",
        backToProjects: "Back to projects",
        restoreProject: "Restore project",
        restoreSelectedProjects: "Restore selected",
        selectedDeletedProjectsCount: "{count} selected",
        selectDeletedProject: "Select {name}",
        selectAllDeletedProjects: "Select all deleted projects",
        errors: {
          savePosition: "Position was not saved",
        },
        createFolder: {
          title: "New folder",
          name: "Folder name",
          placeholder: "Client folder",
        },
        createProject: {
          title: "New project",
          editTitle: "Edit project",
          save: "Save changes",
          archiveProject: "Archive project",
          deleteProject: "Delete project",
          confirmDeleteProject: "Confirm delete project",
          deleteProjectDescription:
            "Deleted projects move to the project recycle bin.",
          name: "Project name",
          projectCode: "Project code",
          cmpClient: "CMP client",
          cmpEngagement: "CMP engagement",
          selectCmpClient: "Select client",
          selectCmpEngagement: "Select engagement",
          selectCmpClientFirst: "Select a client first",
          loadingCmpClients: "Loading clients...",
          loadingCmpEngagements: "Loading engagements...",
          engagementCode: "Engagement Code",
          engagementCodePlaceholder: "Enter Engagement Code",
          selectEngagementStep: "Select Engagement Code",
          completeProjectStep: "Complete project details",
          selectEngagementTitle: "Select Engagement Code",
          selectEngagementDescription:
            "Prefix match by Engagement Code, client, or client code",
          matchingCmpEngagement: "Matching CMP engagement",
          matchingEngagementCount: "{count} results found",
          nextStep: "Next",
          backStep: "Back",
          loadingCmpEngagementMatch: "Searching CMP engagements...",
          noMatchingEngagementCode: "No prefix-matching engagement found",
          matchInformation: "Match information",
          cmpMatch: "CMP Match",
          matchedClientName: "Auto matched client",
          matchedClientCode: "Client Code",
          pic: "PIC",
          mic: "MIC",
          projectCodeFromEngagement: "Project code from engagement",
          language: "Language",
          frameworkTemplate: "Applicable standard",
          projectTemplate: "Project template",
          noProjectTemplate: "No project template",
          yearEndDate: "Year end date",
          reportDate: "Report date",
          archiveDeadline: "Archive deadline",
          reportingDate: "Reporting date",
          rollForward: {
            label: "Roll forward from archived project",
            none: "Do not roll forward",
            inheritMembers: "Inherit active members and roles",
            loadingSummary: "Loading roll-forward summary...",
            retentionNotice:
              "File content and version history are retained; annual workflow state is reset.",
            retains:
              "Retains: folders, papers, files, full version history, Smart Form answers.",
            resets:
              "Resets: sign-offs, Qs, Master locks, archive packages, old audit logs.",
            sourceLabel: "Roll-forward source",
            inheritMembersSuffix: "inherit members",
            summary: {
              folders: "Folders",
              papers: "Papers",
              files: "Files",
              versions: "Versions",
            },
          },
          memberLibrary: "Member library",
          memberLibraryDisabled:
            "Project invitations are only available while editing project details.",
          memberSearch: "Search members",
          languages: {
            "zh-CN": "Simplified Chinese",
            "en-US": "English",
          },
        },
      },
      workbench: {
        searchLabel: "Search directories or files",
        loadingStructureTitle: "Loading project structure",
        loadingStructureDescription: "Please wait.",
        noMatchesTitle: "No matching groups or workpapers",
        noMatchesDescription: "Try another keyword.",
        searchResultsLabel: "Search results",
        searchNoResults: "No search results",
        searchDirectoryKind: "Directory",
        searchFileKind: "File",
        emptyStructureTitle: "Project structure is empty",
        emptyStructureDescription:
          "Default groups and workpapers are generated automatically after project creation.",
        group: "Group",
        workpaper: "Workpaper",
        renamePhase: "Rename phase",
        renameGroup: "Rename group",
        renameWorkpaper: "Rename workpaper",
        addPhase: "Add phase",
        addGroup: "Add group",
        addWorkpaper: "Add workpaper",
        deletePhase: "Delete phase",
        deleteGroup: "Delete group",
        deleteWorkpaper: "Delete workpaper",
        uploadFileTo: "Upload file to",
        uploadToBucket: "Upload to ",
        fileInput: "file input",
        otherMember: "another member",
        locked: "Locked",
        newPhase: "New phase",
        newGroup: "New group",
        newWorkpaper: "New workpaper",
        bucketLabels: {
          CURRENT: "Current workpapers",
          PRIOR: "Prior workpapers",
          TEMPORARY: "Temporary files",
        },
        backToEdit: "Back to edit",
        confirmReview: "Confirm and continue",
        confirming: "Creating...",
        reviewDescription: "Review the project setup before creating it.",
        reviewTitle: "Review project details",
        settingsPanel: {
          menu: {
            title: "Settings menu",
            description: "Choose a category.",
            navAriaLabel: "Settings navigation",
          },
          sections: {
            general: {
              label: "General",
              description: "Project information",
            },
            archive: {
              label: "Archive",
              description: "Archive settings",
            },
            members: {
              label: "Members",
              description: "Project members",
            },
            cmpEngagement: {
              label: "CMP engagement",
              description: "Linked client and engagement",
            },
            tmsLinks: {
              label: "TMS links",
              description: "Link saved TMS rows to this project",
            },
            personal: {
              label: "Personalization",
              description: "Language, font size, and appearance",
            },
            integrations: {
              label: "Connections & integrations",
              description: "Connect personal services",
            },
          },
          personal: {
            title: "Personal settings",
            description: "Adjust your workspace preferences.",
            fontSize: "Font size",
            darkMode: "Color mode",
            day: "Day",
            night: "Night",
            system: "System",
          },
          appearance: {
            title: "Workspace appearance",
            description: "Your personal homepage appearance settings.",
            flavorLabel: "Flavor: ",
            fontSizeLabel: "Font size: ",
            accentLabel: "Accent: ",
          },
          fontSizeOptions: {
            sm: "Small",
            md: "Medium",
            lg: "Large",
          },
          project: {
            loading: "Loading project...",
            updated: "Project updated",
            readOnly: "This project is read-only.",
            archiveProject: "Archive project",
            archivingProject: "Archiving...",
            checkingFiles: "Checking files...",
            archivePassword: "Archive password",
            archivePasswordPlaceholder: "Enter archive password",
            showArchivePassword: "Show archive password",
            hideArchivePassword: "Hide archive password",
            dangerZone: "Danger zone",
            dangerZoneDescription: "Irreversible actions.",
            deleteProject: "Delete project",
            deletingProject: "Deleting...",
            deleteProjectDescription: "Delete this project?",
            recycleBinTitle: "Recycle bin",
          },
        },
        archiveCheck: {
          title: "Archive File Check",
          checking: "Checking project files",
        },
      },
      projects: {
        archiveDeadline: "Archive deadline",
        frameworkTemplate: "Applicable standard",
        skipEngagementLink: "Skip engagement link",
        unlinkedProjectCode:
          "No engagement linked; a project code will be generated when the project is created.",
        language: "Language",
        name: "Project name",
        notes: "Notes",
        projectCode: "Project code",
        projectTemplate: "Project template",
        inviteProjectMembers: "Invite project members",
        loadingAvailableUsers: "Loading available users...",
        noInviteableUsers: "No inviteable users.",
        memberManagementTitle: "Member management",
        memberManagementDescription: "Project members",
        memberSearchPlaceholder: "Search or invite...",
        activeStatus: "Active",
        memberSearch: "Search members",
        memberCount: "{count} members",
        inviteAction: "Invite",
        invitedStatus: "Invited",
        notInvitedStatus: "Not invited",
        cancelInvitation: "Cancel",
        cancelInvitationDescription: "Cancel the invitation to {name}?",
        memberColumn: "Member",
        rankColumn: "Rank",
        roleInEngagementColumn: "Role in engagement",
        independenceColumn: "Independence",
        statusColumn: "Status",
        actionsColumn: "Actions",
        removeAction: "Remove",
        reportDate: "Report date",
        yearEndDate: "Year end date",
        languages: {
          "zh-CN": "Simplified Chinese",
          "en-US": "English",
        },
      },
    },
    localizedPath: (pathname: string) =>
      pathname.startsWith("/acceptance") ? `/zh-CN${pathname}` : pathname,
  }),
}));

const desktopState: DesktopState = {
  folders: [
    {
      id: "folder-default",
      ownerId: "user-partner",
      name: "Default",
      sortOrder: 0,
      isDefault: true,
    },
    {
      id: "folder-client",
      ownerId: "user-partner",
      name: "Client folder",
      sortOrder: 1,
      isDefault: false,
    },
  ],
  placements: [
    {
      id: "placement-1",
      userId: "user-partner",
      projectId: "project-1",
      folderId: "folder-default",
      desktopX: 24,
      desktopY: 24,
      sortOrder: 0,
      lastOpenedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      project: {
        id: "project-1",
        projectNumber: 1_000_001,
        workspaceId: "workspace-1",
        name: "Orchid Holdings",
        projectCode: "AUD-2026-0001",
        frameworkTemplateId: "framework-hkfrs",
        frameworkTemplate: {
          id: "framework-hkfrs",
          code: "HKFRS",
          name: "HKFRS",
          language: "zh-CN",
          isActive: true,
        },
        reportingDate: "2026-12-31T00:00:00.000Z",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
        status: "ACTIVE",
        members: [
          {
            id: "member-partner",
            membershipStatus: "ACTIVE",
            projectRole: "PARTNER",
            inChargeRole: "PARTNER_IN_CHARGE",
            allowedProjectRoles: ["PARTNER"],
            roleConsistent: true,
            declarationAccepted: true,
            user: {
              id: "user-partner",
              email: "partner@projectwing.local",
              name: "Jony Ma",
              globalRole: "PARTNER",
              status: "ACTIVE",
            },
          },
        ],
      },
    },
  ],
};

function waitForDragCleanup() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 60);
  });
}

function setViewportWidth(width: number) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => {
    const maxWidth = /max-width:\s*(\d+)px/.exec(query)?.[1];
    const minWidth = /min-width:\s*(\d+)px/.exec(query)?.[1];
    return {
      matches:
        Boolean(maxWidth || minWidth) &&
        (!maxWidth || width <= Number(maxWidth)) &&
        (!minWidth || width >= Number(minWidth)),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

describe("ProjectsPage desktop launcher", () => {
  beforeEach(() => {
    setViewportWidth(1440);
    mockI18n.locale = "en-US";
    mockNavigation.searchParams = "";
    window.localStorage.clear();
    mockApi.me.mockResolvedValue({
      id: "user-partner",
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: "PARTNER",
      status: "ACTIVE",
    });
    mockApi.inboxMessages.mockResolvedValue([]);
    mockApi.workItems.mockResolvedValue({
      items: [],
      categories: [],
      counts: { total: 0, EMP: 0, PROJECT: 0, CMP: 0, TMS: 0, OPS: 0 },
    });
    mockApi.listDevelopmentAccounts.mockResolvedValue([]);
    mockApi.markInboxRead.mockResolvedValue({});
    mockApi.markInboxUnread.mockResolvedValue({});
    mockApi.desktop.mockResolvedValue(desktopState);
    mockApi.projects.mockResolvedValue([desktopState.placements[0].project]);
    mockApi.project.mockResolvedValue(desktopState.placements[0].project);
    mockApi.projectMemberDirectory.mockResolvedValue(
      desktopState.placements[0].project.members
    );
    mockApi.rollForwardPreview.mockResolvedValue({
      project: {
        id: "archived-project-1",
        workspaceId: "workspace-1",
        name: "Prior year audit",
        projectCode: "PY-2025-AUD",
        language: "en-US",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2025-12-31",
        reportDate: "2026-03-31",
        archiveDeadline: "2026-05-30",
        status: "ARCHIVED",
      },
      summary: {
        workflowNodes: 3,
        workingPapers: 2,
        attachments: 2,
        attachmentVersions: 3,
        smartForms: 1,
      },
      reset: {
        signoffs: true,
        reviewQuestions: true,
        locks: true,
        archiveArtifacts: true,
        auditLogs: true,
      },
      retained: {
        workflow: true,
        workingPapers: true,
        attachments: true,
        attachmentVersions: true,
        smartFormAnswers: true,
      },
    });
    mockApi.frameworkTemplates.mockResolvedValue([
      {
        id: "framework-hkfrs",
        code: "HKFRS",
        name: "HKFRS",
        language: "zh-CN",
        isActive: true,
      },
    ]);
    mockApi.cmpClients.mockResolvedValue({
      clients: [
        {
          id: "cmp-client-abc",
          clientCode: "C-ABC",
          nameZh: "ABC 客户",
          nameEn: "ABC Limited",
          status: "ACTIVE",
        },
      ],
    });
    mockApi.cmpEngagements.mockResolvedValue({
      engagements: [
        {
          id: "cmp-engagement-abc-audit",
          clientId: "cmp-client-abc",
          client: {
            id: "cmp-client-abc",
            clientCode: "C-ABC",
            nameZh: "ABC 客户",
            nameEn: "ABC Limited",
            status: "ACTIVE",
          },
          engagementCode: "ABC-2026-AUD",
          serviceType: "AUDIT",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          approvalReferenceNumber: null,
          engagementDate: null,
          picUserId: "user-pic",
          micUserId: "user-mic",
          pic: "Jony Ma",
          mic: "Leo Li",
          status: "ACTIVE",
          remarks: null,
        },
      ],
    });
    mockApi.updateDesktopProjectPlacement.mockResolvedValue(
      desktopState.placements[0]
    );
    mockApi.updateDesktopFolder.mockResolvedValue(desktopState.folders[1]);
    mockApi.deleteDesktopFolder.mockResolvedValue({ id: "folder-client" });
    mockApi.updateProject.mockResolvedValue(desktopState.placements[0].project);
    mockApi.archiveProject.mockResolvedValue({
      ...desktopState.placements[0].project,
      status: "ARCHIVED",
    });
    mockApi.deleteProject.mockResolvedValue({
      ...desktopState.placements[0].project,
      status: "DELETED",
    });
    mockApi.deletedProjects.mockResolvedValue([]);
    mockApi.restoreProject.mockResolvedValue({
      ...desktopState.placements[0].project,
      status: "ACTIVE",
    });
    mockApi.projectTemplate.mockRejectedValue(
      new Error("Project template not found")
    );
    mockApi.projectTemplates.mockResolvedValue([]);
    mockApi.userDirectory.mockResolvedValue([]);
    mockApi.createInvitation.mockResolvedValue({
      inviteUrl: "/invitations/test-token",
      invitedRole: "PREPARER",
      expiresAt: "2026-07-07T00:00:00.000Z",
    });
    mockApi.adminProjectTemplates.mockResolvedValue([]);
    mockApi.adminProjectTemplate.mockRejectedValue(
      new Error("Project template not found")
    );
    mockApi.adminSmartFormTemplates.mockResolvedValue([]);
    mockApi.smartFormTemplates.mockResolvedValue([]);
    mockApi.createSmartFormTemplate.mockResolvedValue({});
    mockApi.deleteProjectTemplate.mockResolvedValue({});
    mockApi.updateSmartFormTemplate.mockResolvedValue({});
    mockApi.publishSmartFormTemplate.mockResolvedValue({});
    mockApi.deleteSmartFormTemplate.mockResolvedValue({});
    mockApi.updateProjectTemplate.mockResolvedValue({});
    mockApi.updateProjectTemplateNode.mockResolvedValue({});
    mockApi.deleteProjectTemplateNode.mockResolvedValue({});
    mockApi.reorderDesktopProjectPlacements.mockResolvedValue({ count: 2 });
  });

  afterEach(async () => {
    cleanup();
    await waitForDragCleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("restores the independent project code column once without resetting other preferences", async () => {
    window.localStorage.setItem(
      "project-wing-home-display-settings",
      JSON.stringify({
        showProjectCode: false,
        showClientCode: false,
        showReportDate: true,
        density: "compact",
      })
    );
    renderProjects();
    await screen.findByRole("columnheader", { name: "Project code" });
    expect(
      screen.queryByRole("columnheader", { name: "Client code" })
    ).not.toBeInTheDocument();
    const saved = JSON.parse(
      window.localStorage.getItem("project-wing-home-display-settings") ?? "{}"
    );
    expect(saved).toMatchObject({
      showProjectCode: true,
      showClientCode: false,
      showReportDate: true,
      density: "compact",
      projectCodePreferenceVersion: 1,
    });
  });

  it("honors a later explicit choice to hide the project code", async () => {
    window.localStorage.setItem(
      "project-wing-home-display-settings",
      JSON.stringify({
        showProjectCode: false,
        projectCodePreferenceVersion: 1,
      })
    );
    renderProjects();
    await screen.findByTestId("project-home-data-grid");
    expect(
      screen.queryByRole("columnheader", { name: "Project code" })
    ).not.toBeInTheDocument();
  });

  describe("projectsPage desktop launcher", () => {
    it("switches project folders with the compact keyboard navigation without moving records", async () => {
      const user = userEvent.setup();
      renderProjects();
      await screen.findByText("Orchid Holdings");
      act(() =>
        screen.getByRole("combobox", { name: "Project folders" }).focus()
      );
      await user.keyboard("{Enter}");
      await screen.findByRole("option", { name: "Client folder" });
      await user.keyboard("{ArrowDown}{Enter}");
      await expect(
        screen.findByText("No projects in this folder")
      ).resolves.toBeVisible();
      expect(screen.queryByText("Orchid Holdings")).not.toBeInTheDocument();
      expect(mockApi.updateDesktopProjectPlacement).not.toHaveBeenCalled();
      expect(mockApi.createProject).not.toHaveBeenCalled();
    });

    it("shows a failed desktop request as recoverable, not an empty folder", async () => {
      mockApi.desktop.mockRejectedValueOnce(new Error("Network unavailable"));
      renderProjects();
      const grid = await screen.findByTestId("project-home-data-grid");
      await expect(within(grid).findByRole("alert")).resolves.toHaveTextContent(
        "Unable to load"
      );
      expect(
        within(grid).queryByText("No projects in this folder")
      ).not.toBeInTheDocument();
      expect(within(grid).queryByText("0")).not.toBeInTheDocument();
      fireEvent.click(within(grid).getByRole("button", { name: "Retry" }));
      await expect(screen.findByText("Orchid Holdings")).resolves.toBeVisible();
      expect(
        within(screen.getByTestId("project-home-data-grid")).queryByRole(
          "alert"
        )
      ).not.toBeInTheDocument();
      expect(mockApi.createProject).not.toHaveBeenCalled();
      expect(mockApi.createDesktopFolder).not.toHaveBeenCalled();
    });

    it("keeps the project search scope visible and names the clear action after dismissing suggestions", async () => {
      renderProjects();
      await screen.findByText("Orchid Holdings");
      const search = screen.getByRole("combobox", {
        name: "Search projects, clients, folders...",
      });
      expect(search).toHaveAttribute(
        "placeholder",
        "Search projects, clients, folders..."
      );
      fireEvent.change(search, { target: { value: "Orchid" } });
      fireEvent.keyDown(search, { key: "Escape" });
      fireEvent.click(
        await screen.findByRole("button", { name: "Clear search" })
      );
      expect(search).toHaveValue("");
      expect(search).toHaveFocus();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("shows a failed recycle-bin request with retry and blocks restoration", async () => {
      mockApi.deletedProjects.mockRejectedValueOnce(
        new Error("Network unavailable")
      );
      renderProjects();
      fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
      fireEvent.click(
        within(
          await screen.findByRole("complementary", {
            hidden: true,
            name: "Settings navigation",
          })
        ).getByRole("button", { name: "Recycle bin" })
      );
      const recycle = await screen.findByTestId(
        "project-recycle-bin-workspace"
      );
      await expect(
        within(recycle).findByRole("alert")
      ).resolves.toHaveTextContent("Unable to load");
      expect(
        within(recycle).queryByText("No deleted projects.")
      ).not.toBeInTheDocument();
      expect(
        within(recycle).queryByRole("button", { name: "Restore selected" })
      ).not.toBeInTheDocument();
      fireEvent.click(within(recycle).getByRole("button", { name: "Retry" }));
      await expect(
        within(recycle).findByText("No deleted projects.")
      ).resolves.toBeVisible();
      expect(within(recycle).queryByRole("checkbox")).not.toBeInTheDocument();
      expect(
        within(recycle).queryByRole("button", { name: "Restore selected" })
      ).not.toBeInTheDocument();
      expect(
        within(recycle).queryByRole("heading", { name: "Recycle bin" })
      ).not.toBeInTheDocument();
      expect(
        within(recycle).queryByRole("button", { name: "Back to projects" })
      ).not.toBeInTheDocument();
      expect(mockApi.restoreProject).not.toHaveBeenCalled();
    });

    it("renders project detail rows by default", async () => {
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("AUD-2026-0001")).toBeInTheDocument()
      );
      expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
      const viewToggle = screen.getByRole("button", {
        name: "Project view",
      });
      expect(viewToggle).not.toHaveAttribute("aria-pressed");
      expect(viewToggle.querySelector(".lucide-list")).toBeTruthy();
      expect(
        screen.getByRole("columnheader", { name: "Engagement" })
      ).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Last opened" })
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Open project: Orchid Holdings" })
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Edit project: Orchid Holdings" })
      ).toBeVisible();
    }, 15_000);

    it("keeps phone folder navigation and project actions outside desktop columns", async () => {
      setViewportWidth(390);
      mockNavigation.searchParams = "folderId=folder-default";
      renderProjects();

      const table = await screen.findByTestId("emp-mobile-project-browser");
      const projectLink = await within(table).findByRole("link", {
        name: /Orchid Holdings/,
      });
      expect(projectLink).toBeVisible();
      expect(projectLink).toHaveAttribute(
        "href",
        "/engagement/project-1?returnTo=%2Fengagement%3FfolderId%3Dfolder-default"
      );
      expect(within(table).queryByTestId("project-file-icon")).toBeNull();
      expect(
        screen.queryByRole("columnheader", { name: "Project code" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("columnheader", { name: "System ID" })
      ).not.toBeInTheDocument();
      expect(within(table).queryByRole("checkbox")).not.toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: /More.*Orchid Holdings/,
        })
      ).toHaveAttribute("aria-haspopup", "dialog");
      fireEvent.click(
        screen.getByRole("button", { name: /More.*Orchid Holdings/ })
      );
      await expect(screen.findByRole("dialog")).resolves.toBeVisible();
    }, 15_000);

    it("uses a full-height workbench table with compact project rows", async () => {
      const { container: _container } = renderProjects();
      const table = await screen.findByRole("table", {
        name: "Default projects",
      });
      const toolbar = screen.getByTestId("project-home-toolbar");
      const canvas = screen.getByTestId("desktop-canvas");
      const _panel = canvas.parentElement;
      const _projectButton = within(table).getByRole("button", {
        name: /AUD-2026-0001 Orchid Holdings/,
      });

      expect(toolbar.closest("main")).toBe(canvas);
      expect(table.closest("main")).toBe(canvas);
    }, 15_000);

    it("uses the shared autocomplete pattern for compact home search results", async () => {
      renderProjects();

      const search = await screen.findByLabelText(
        "Search projects, clients, folders..."
      );
      fireEvent.focus(search);
      fireEvent.change(search, { target: { value: "AUD-2026-0001" } });

      await expect(screen.findByText("Project")).resolves.toHaveAttribute(
        "data-slot",
        "autocomplete-group-label"
      );
      const result = within(await screen.findByRole("listbox"))
        .getByText("AUD-2026-0001")
        .closest('[data-slot="autocomplete-item"]');
      const searchResult = result as HTMLElement;
      const popup = result?.closest('[data-slot="autocomplete-popup"]');

      expect(popup).toHaveClass(
        "w-(--anchor-width)",
        "rounded-b-2xl",
        "border"
      );
      expect(result).toHaveClass(
        "flex",
        "items-center",
        "gap-2.5",
        "rounded-lg"
      );
      expect(within(searchResult).getByText("Orchid Holdings")).toHaveClass(
        "truncate"
      );
      expect(within(searchResult).getByText("AUD-2026-0001")).toHaveClass(
        "text-muted-foreground",
        "shrink-0",
        "text-right",
        "text-xs"
      );
      expect(result?.className).not.toContain("ring");
    });

    it("opens the dedicated project creation page without mounting the legacy dialog", async () => {
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("AUD-2026-0001")).toBeInTheDocument()
      );
      expect(mockApi.projectTemplates).not.toHaveBeenCalled();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.click(screen.getByRole("menuitem", { name: "New project" }));

      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\/engagement\/new\?attempt=\d+&folderId=folder-default$/
        )
      );
      expect(mockApi.projectTemplates).not.toHaveBeenCalled();
      expect(
        screen.queryByText("Select engagement code")
      ).not.toBeInTheDocument();
    });

    it("marks the active folder as the current directory", async () => {
      renderProjects();

      const activeFolder = await screen.findByRole("button", {
        name: "Default",
      });

      expect(activeFolder).toHaveAttribute("aria-current", "page");
    });

    it("uses compact shared grid toolbar actions", async () => {
      renderProjects();

      const _newProjectButton = await screen.findByRole("button", {
        name: "New",
      });
      const viewToggle = screen.getByRole("button", {
        name: "Project view",
      });
      const _columnsButton = screen.getByRole("button", { name: "Columns" });

      expect(viewToggle).toHaveClass("size-8");
      expect(viewToggle).not.toHaveTextContent("Details");
      expect(viewToggle).not.toHaveTextContent("Icons");
    });

    it("uses the active folder as the only home toolbar heading", async () => {
      renderProjects();

      const toolbar = await screen.findByTestId("project-home-toolbar");
      const folderHeading = await waitFor(() =>
        within(screen.getByTestId("project-home-toolbar")).getByText("Default")
      );

      expect(toolbar).toHaveAttribute("data-slot", "frame-panel-header");
      expect(folderHeading).toHaveClass("font-semibold");
    });

    it("uses the three-line EMP brand lockup", async () => {
      const { container } = renderProjects();

      await screen.findByText("AUD-2026-0001");

      const brand = container.querySelector(".project-wing-top-bar-brand");
      expect(brand).toBeInTheDocument();
      expect(brand).toHaveClass("project-wing-top-bar-brand");
      const brandMark = brand?.querySelector(
        ".project-wing-top-bar-brand-mark"
      );
      expect(brandMark).toBeTruthy();
      expect(brandMark).toHaveAttribute("src", "/brand/icon-white-green.svg");
      const brandLines = brand?.querySelectorAll(
        ".project-wing-top-bar-brand-line"
      );
      expect(brandLines).toHaveLength(3);
      expect(
        [...(brandLines ?? [])].map((line) => line.textContent)
      ).toStrictEqual(["Engagement", "Management", "Platform"]);
    });

    it("adds the responsive global confirmation shortcut with shared icon tone", async () => {
      renderProjects();

      const settingsButton = await screen.findByRole("button", {
        name: "Settings",
      });

      expect(
        screen.getByRole("button", { name: "Confirmation" })
      ).toBeInTheDocument();
      expect(
        screen
          .getByRole("button", { name: "Confirmation" })
          .querySelector(".lucide-truck")
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute(
        "data-active",
        "true"
      );
      const actionBar = settingsButton.closest('[role="toolbar"]');
      expect(actionBar).toHaveAttribute("data-slot", "expandable-action-bar");
      expect(actionBar).toHaveAttribute("data-expanded", "true");
      expect(actionBar).toHaveAttribute("data-motion", "animated");
      expect(
        within(actionBar as HTMLElement)
          .getAllByRole("button")
          .map((button) => button.dataset.actionId)
      ).toStrictEqual(["home", "confirmation-center", "tasks", "settings"]);
    });

    it("keeps the search hidden after its exit animation is cleaned up", async () => {
      renderProjects();
      const button = await screen.findByRole("button", {
        name: "Confirmation",
      });
      const search = document.querySelector<HTMLElement>(
        "[data-top-bar-search]"
      );
      if (!search) {
        throw new Error("Expected the global top bar search shell");
      }
      let finish: (() => void) | undefined;
      const cancel = vi.fn();
      Object.defineProperty(search, "getClientRects", {
        value: () => [new DOMRect()],
      });
      Object.defineProperty(search, "animate", {
        value: () => ({
          finished: new Promise<void>((resolve) => {
            finish = resolve;
          }),
          cancel,
        }),
      });
      fireEvent.click(button);
      expect(search.style.visibility).not.toBe("hidden");
      await act(() => {
        finish?.();
      });
      expect(mockRouter.push).toHaveBeenCalledWith("/confirmations");
      expect(search.style.visibility).toBe("hidden");
      cleanup();
      expect(cancel).toHaveBeenCalledWith();
      expect(search.style.visibility).toBe("hidden");
      expect(search.style.opacity).toBe("0");
      expect(search.style.clipPath).toBe("inset(0 50% round 999px)");
    });

    it("opens global settings in the Sidebar 13 dialog shell", async () => {
      renderProjects();

      fireEvent.click(await screen.findByRole("button", { name: "Settings" }));

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveClass(
        "rounded-[10px]",
        "border-border",
        "h-[80dvh]",
        "w-[80vw]",
        "max-h-[80dvh]",
        "max-w-[80vw]"
      );
      expect(
        within(dialog).getByRole("button", { name: "Personalization" })
      ).toHaveAttribute("aria-current", "page");
      expect(within(dialog).getByLabelText("Language")).toBeInTheDocument();
      expect(
        document.querySelector('[data-slot="dialog-overlay"]')
      ).toHaveClass("bg-black/50", "backdrop-blur-none");
    });

    it("composes the desktop navigation with shadcn sidebar slots", async () => {
      renderProjects();

      const sidebar = await screen.findByTestId("desktop-navigation-sidebar");
      const _folderButton = await screen.findByRole("button", {
        name: "Default",
      });

      expect(sidebar.querySelector('[data-slot="sidebar"]')).toBeTruthy();
      expect(sidebar.querySelector('[data-slot="sidebar-menu"]')).toBeTruthy();
      expect(
        document.querySelector('[data-slot="resizable-panel-group"]')
      ).toBeTruthy();
      expect(
        document.querySelector('[data-slot="splitter-rail"]')
      ).toBeTruthy();
    });

    it("uses the compact folder switcher through tablet widths", async () => {
      setViewportWidth(834);
      renderProjects();

      const switcher = await screen.findByTestId("compact-folder-switcher");
      const sidebar = screen.getByTestId("desktop-navigation-sidebar");
      const rail = screen.getByRole("separator", {
        name: "Resize navigation sidebar",
      });

      expect(switcher).toHaveClass("lg:hidden");
      expect(sidebar.closest('[data-slot="resizable-panel"]')).toHaveAttribute(
        "data-compact-hidden",
        "true"
      );
      expect(rail).toHaveClass("max-lg:hidden");
      const folderControl = within(switcher).getByRole("combobox");
      act(() => folderControl.focus());
      await userEvent.keyboard("{Enter}");
      await expect(
        screen.findByRole("option", { name: "Client folder" })
      ).resolves.toBeVisible();
      await userEvent.keyboard("{Escape}");
      await waitFor(() =>
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      );
    });

    it("uses a full-height splitter rail for home navigation collapse", async () => {
      renderProjects();

      const rail = await screen.findByRole("separator", {
        name: "Resize navigation sidebar",
      });
      expect(rail).toHaveAttribute("aria-orientation", "vertical");
      expect(rail).toHaveAttribute("data-state", "expanded");
      expect(rail).toHaveClass(
        "h-full",
        "cursor-pointer",
        "touch-none",
        "select-none"
      );

      const hitArea = screen.getByTestId("home-navigation-splitter-hit-area");
      expect(hitArea).toHaveClass(
        "absolute",
        "inset-y-0",
        "-inset-x-3",
        "cursor-pointer"
      );

      fireEvent.click(rail);
      expect(rail).toHaveAttribute("data-state", "collapsed");

      fireEvent.click(hitArea);
      expect(rail).toHaveAttribute("data-state", "expanded");

      fireEvent.keyDown(rail, { key: "Enter" });
      expect(rail).toHaveAttribute("data-state", "collapsed");

      fireEvent.keyDown(rail, { key: " " });
      expect(rail).toHaveAttribute("data-state", "expanded");
    });

    it("keeps the home rail expanded after a rightward drag before the next click", async () => {
      renderProjects();

      const navigationPanel = document.querySelector(
        "#project-home-navigation"
      );
      expect(navigationPanel).toBeInTheDocument();
      const rail = await screen.findByRole("separator", {
        name: "Resize navigation sidebar",
      });
      const initialWidth = Number(
        (navigationPanel as HTMLElement).style.flexGrow
      );

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 11,
      });
      fireEvent.pointerMove(window, { clientX: 140, pointerId: 11 });
      fireEvent.pointerUp(window, { pointerId: 11 });

      expect(rail).toHaveAttribute("data-state", "expanded");
      expect(
        Number((navigationPanel as HTMLElement).style.flexGrow)
      ).toBeGreaterThan(initialWidth);

      fireEvent.click(rail);
      expect(rail).toHaveAttribute("data-state", "expanded");
    });

    it("collapses the home navigation when dragging below its minimum width", async () => {
      renderProjects();

      const rail = await screen.findByRole("separator", {
        name: "Resize navigation sidebar",
      });
      const sidebar = screen.getByTestId("desktop-navigation-sidebar");

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 12,
      });
      fireEvent.pointerMove(window, { clientX: 0, pointerId: 12 });

      expect(rail).toHaveAttribute("data-state", "expanded");
      expect(rail).toHaveAttribute("aria-valuenow", "184");
      expect(sidebar).not.toHaveAttribute("aria-hidden", "true");

      fireEvent.pointerMove(window, { clientX: -60, pointerId: 12 });

      expect(rail).toHaveAttribute("data-state", "collapsed");
      expect(rail).toHaveAttribute("aria-valuenow", "0");
      expect(sidebar).toHaveAttribute("aria-hidden", "true");
      fireEvent.pointerUp(window, { pointerId: 12 });

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 0,
        pointerId: 13,
      });
      fireEvent.pointerMove(window, { clientX: 60, pointerId: 13 });

      expect(rail).toHaveAttribute("data-state", "expanded");
      expect(sidebar).not.toHaveAttribute("aria-hidden", "true");
      fireEvent.pointerUp(window, { pointerId: 13 });
    });

    it("collapses and restores the home navigation from its sidebar rail", async () => {
      renderProjects();

      const rail = await screen.findByRole("separator", {
        name: "Resize navigation sidebar",
      });
      fireEvent.click(rail);
      expect(rail).toHaveAttribute("data-state", "collapsed");

      fireEvent.click(rail);

      expect(rail).toHaveAttribute("data-state", "expanded");
    });

    it("renders the project file icon instead of generated initials", async () => {
      renderProjects();

      const projectIcon = await screen.findByTestId("project-file-icon");

      expect(projectIcon.querySelector(".lucide-file-text")).toBeTruthy();
      expect(projectIcon.querySelectorAll("svg")).toHaveLength(2);
    });

    it("shows pending archive review status on project cards", async () => {
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: [
          {
            ...desktopState.placements[0],
            project: {
              ...desktopState.placements[0].project,
              status: "PENDING_FINAL_CHECK",
            },
          },
        ],
      });
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("Pending archive review")).toBeInTheDocument()
      );
    });

    it("opens the project editor from the detail row action", async () => {
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("AUD-2026-0001")).toBeInTheDocument()
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Edit project: Orchid Holdings" })
      );

      await waitFor(() =>
        expect(screen.getAllByText("Project settings")).toHaveLength(2)
      );
      expect(screen.getByRole("dialog")).toHaveClass("h-[80dvh]");
      expect(
        within(
          screen.getByRole("complementary", {
            hidden: true,
            name: "Settings navigation",
          })
        )
          .getAllByRole("button")
          .map((button) => button.textContent)
      ).toStrictEqual([
        "General",
        "Archive",
        "Members",
        "CMP engagement",
        "TMS links",
      ]);
      await waitFor(() =>
        expect(screen.getByLabelText("Project name")).toHaveValue(
          "Orchid Holdings"
        )
      );
      expect(screen.queryByText("Edit project")).toBeNull();
      expect(mockApi.createProject).not.toHaveBeenCalled();
    }, 15_000);

    it("shows archive and delete actions in the project editor", async () => {
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("AUD-2026-0001")).toBeInTheDocument()
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Edit project: Orchid Holdings" })
      );

      const settingsNavigation = await waitFor(() =>
        screen.getByRole("complementary", {
          hidden: true,
          name: "Settings navigation",
        })
      );
      fireEvent.click(
        within(settingsNavigation).getByRole("button", { name: "Archive" })
      );
      await screen.findByRole("heading", { level: 3, name: "Danger zone" });
      expect(
        screen.getByRole("button", { name: "Archive project" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Delete project" })
      ).toBeInTheDocument();
    });

    it("requires confirmation before deleting a project from the editor", async () => {
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("AUD-2026-0001")).toBeInTheDocument()
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Edit project: Orchid Holdings" })
      );
      fireEvent.click(
        within(
          await waitFor(() =>
            screen.getByRole("complementary", {
              hidden: true,
              name: "Settings navigation",
            })
          )
        ).getByRole("button", { name: "Archive" })
      );
      await screen.findByRole("heading", { level: 3, name: "Danger zone" });
      fireEvent.click(screen.getByRole("button", { name: "Delete project" }));

      expect(mockApi.deleteProject).not.toHaveBeenCalled();
      const dialog = await screen.findByRole("dialog", {
        name: "Delete project",
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete project" })
      );

      await waitFor(() => {
        expect(mockApi.deleteProject).toHaveBeenCalledWith("project-1");
      });
      expect(mockApi.archiveProject).not.toHaveBeenCalled();
    });

    it("opens a workspace project recycle bin and restores selected projects", async () => {
      const secondProject = {
        ...desktopState.placements[0].project,
        id: "project-2",
        projectNumber: 1_000_002,
        name: "Harbor Trading",
        projectCode: "AUD-2026-0002",
        status: "DELETED",
        notes: "Internal project details are not recycle-bin content",
      };
      mockApi.deletedProjects.mockResolvedValue([
        {
          ...desktopState.placements[0].project,
          status: "DELETED",
        },
        secondProject,
      ]);
      renderProjects();

      fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
      fireEvent.click(
        within(
          await screen.findByRole("complementary", {
            hidden: true,
            name: "Settings navigation",
          })
        ).getByRole("button", { name: "Recycle bin" })
      );

      await waitFor(() => {
        expect(mockApi.deletedProjects).toHaveBeenCalledOnce();
      });
      expect(
        screen.queryByRole("dialog", { name: "Recycle bin" })
      ).not.toBeInTheDocument();
      const recycleBin = await screen.findByTestId(
        "project-recycle-bin-workspace"
      );
      expect(
        within(recycleBin).getByText("Orchid Holdings")
      ).toBeInTheDocument();
      expect(within(recycleBin).getAllByText("AUD-2026-0001")).not.toHaveLength(
        0
      );
      expect(
        within(recycleBin).getByText("Harbor Trading")
      ).toBeInTheDocument();
      expect(within(recycleBin).queryByText("DELETED")).not.toBeInTheDocument();
      expect(
        within(recycleBin).queryByText(
          "Internal project details are not recycle-bin content"
        )
      ).not.toBeInTheDocument();
      expect(recycleBin.querySelector("dl")).toBeNull();
      expect(
        within(recycleBin).queryByText("Deleted projects are saved here.")
      ).not.toBeInTheDocument();

      fireEvent.click(
        within(recycleBin).getByRole("checkbox", {
          name: "Select Orchid Holdings",
        })
      );
      fireEvent.click(
        within(recycleBin).getByRole("checkbox", {
          name: "Select Harbor Trading",
        })
      );
      fireEvent.click(
        within(recycleBin).getByRole("button", { name: "Restore selected" })
      );

      await waitFor(() => {
        expect(mockApi.restoreProject).toHaveBeenCalledWith("project-1");
        expect(mockApi.restoreProject).toHaveBeenCalledWith("project-2");
      });
    });

    it("allows adjusting project members from the project editor with member search", async () => {
      mockApi.userDirectory.mockResolvedValue([
        {
          id: "user-staff-2",
          email: "sam.lu@projectwing.local",
          name: "Sam Lu",
          globalRole: "STAFF",
          status: "ACTIVE",
        },
        {
          id: "user-manager-2",
          email: "maggie.chan@projectwing.local",
          name: "Maggie Chan",
          globalRole: "MANAGER",
          status: "ACTIVE",
        },
      ]);
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("AUD-2026-0001")).toBeInTheDocument()
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Edit project: Orchid Holdings" })
      );
      await waitFor(() => {
        const settingsNavigation = screen.getByRole("complementary", {
          hidden: true,
          name: "Settings navigation",
        });
        if (!screen.queryByRole("searchbox", { name: "Search members" })) {
          fireEvent.click(
            within(settingsNavigation).getByRole("button", {
              name: "Members",
            })
          );
        }
        expect(
          screen.getByRole("searchbox", { name: "Search members" })
        ).toBeInTheDocument();
      });
      const search = screen.getByRole("searchbox", {
        name: "Search members",
      });
      fireEvent.change(search, { target: { value: "Sam" } });

      await expect(screen.findByText("Sam Lu")).resolves.toBeInTheDocument();
      expect(screen.queryByText("Maggie Chan")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Invite Sam Lu" }));

      expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();

      await waitFor(() =>
        expect(mockApi.createInvitation).toHaveBeenCalledWith("project-1", {
          recipientUserId: "user-staff-2",
          invitedRole: "PREPARER",
          expiresInDays: 7,
        })
      );
    }, 15_000);

    it("marks archived projects on the desktop", async () => {
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: desktopState.placements.map((placement) => ({
          ...placement,
          project: { ...placement.project, status: "ARCHIVED" },
        })),
      });

      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("Archived")).toBeInTheDocument()
      );
    });

    it("switches from detail rows to the draggable icon layout", async () => {
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Project view" })
      );

      await expect(findProjectGridItem()).resolves.toBeInTheDocument();
      expect(window.localStorage.getItem("project-wing-home-view-mode")).toBe(
        "icons"
      );
      expect(
        screen
          .getByRole("button", { name: "Project view" })
          .querySelector(".lucide-layout-grid")
      ).toBeTruthy();
    });

    it("opens a floating context menu on desktop right click", async () => {
      renderProjectsInIconView();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });

      expect(
        screen.getByRole("menuitem", { name: "New project" })
      ).toBeInTheDocument();
      expect(screen.getByText("New folder")).toBeInTheDocument();
    });

    it("closes the floating context menu through an inert exit on Escape", async () => {
      renderProjectsInIconView();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });

      const menu = await screen.findByRole("menu");
      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => {
        expect(menu).toHaveAttribute("aria-hidden", "true");
        expect(menu).toHaveAttribute("inert");
        expect(menu).toHaveClass("pointer-events-none");
      });
      await waitFor(() => {
        expect(
          document.querySelector('[data-emp-surface-motion="menu"]')
        ).toBeNull();
      });
    });

    it("hides the project template library for non-super-admin users", async () => {
      renderProjectsInIconView();

      await screen.findByText("AUD-2026-0001");

      expect(
        screen.queryByRole("button", { name: "Template library" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Smart Forms" })
      ).not.toBeInTheDocument();
    });

    it("shows user management beside homepage settings for super admins", async () => {
      mockCurrentUserAsSuperAdmin();
      renderProjectsInIconView();

      await expect(
        screen.findByRole("img", { name: "Current account" })
      ).resolves.toBeTruthy();
      await expect(
        screen.findByRole("button", { name: "User management" })
      ).resolves.toBeInTheDocument();
    });

    it("shows the homepage project template library in the workspace", async () => {
      mockCurrentUserAsSuperAdmin();
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockApi.adminProjectTemplates).toHaveBeenCalledWith()
      );
      expect(
        screen.queryByRole("button", { name: "Edit project templates" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Edit Smart Forms" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "New template folder" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "Maintain project-level templates with directory structure and reusable template files."
        )
      ).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Folder code")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Folder title")
      ).not.toBeInTheDocument();
      expect(screen.queryByText("CAS-STANDARD-AUDIT")).not.toBeInTheDocument();
      expect(screen.queryByText("Published")).not.toBeInTheDocument();
    });

    it("opens the Smart Form admin workspace from query params", async () => {
      mockCurrentUserAsSuperAdmin();
      mockNavigation.searchParams = "smartForms=1";
      mockApi.adminSmartFormTemplates.mockResolvedValue([
        {
          id: "smart-form-template-1",
          code: "SF-ONBOARD",
          name: "Onboarding checklist",
          language: "zh-CN",
          frameworkTemplateId: "framework-hkfrs",
          frameworkTemplate: {
            id: "framework-hkfrs",
            code: "HKFRS",
            name: "HKFRS",
            language: "zh-CN",
            isActive: true,
          },
          description: "",
          status: "DRAFT",
          currentPublishedVersionId: null,
          currentPublishedVersion: null,
          draftDefinitionJson: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
          publishedDefinitionJson: null,
        },
      ]);

      renderProjects();

      await expect(
        screen.findByRole(
          "button",
          { name: /Onboarding checklistSF-ONBOARD/ },
          { timeout: 10_000 }
        )
      ).resolves.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "New form" })
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Filter Smart Forms" })
      );
      fireEvent.click(screen.getByRole("menuitemradio", { name: "Published" }));
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /Onboarding checklist/ })
        ).not.toBeInTheDocument();
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Filter Smart Forms" })
      );
      fireEvent.click(
        screen.getByRole("menuitemradio", { name: "All statuses" })
      );
      await screen.findByRole("button", {
        name: /Onboarding checklistSF-ONBOARD/,
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: "Onboarding checklist: More actions",
        })
      );
      expect(
        screen.getByRole("menuitem", { name: "Smart Form settings" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Delete Smart Form" })
      ).toBeInTheDocument();
      expect(mockRouter.replace).toHaveBeenCalledWith("/engagement");
      expect(
        screen.queryByRole("button", { name: "Edit Smart Forms" })
      ).not.toBeInTheDocument();
    });

    it("keeps a legacy Smart Form definition from crashing the admin designer", async () => {
      mockCurrentUserAsSuperAdmin();
      mockNavigation.searchParams = "smartForms=1";
      mockApi.adminSmartFormTemplates.mockResolvedValue([
        {
          id: "smart-form-template-legacy",
          code: "SF-LEGACY",
          name: "Legacy checklist",
          language: "zh-CN",
          frameworkTemplateId: null,
          frameworkTemplate: null,
          description: "",
          status: "DRAFT",
          currentPublishedVersionId: null,
          currentPublishedVersion: null,
          // Simulate a pre-V2 row returned by the database. The V2-only UI
          // Must keep it manageable without passing it into the designer.
          draftDefinitionJson: { sections: [] } as never,
        },
      ]);

      renderProjects();

      await expect(
        screen.findByText("Legacy checklist", undefined, {
          timeout: 10_000,
        })
      ).resolves.toBeInTheDocument();
      await expect(
        screen.findAllByText(
          "Fix the template structure before previewing or saving."
        )
      ).resolves.toHaveLength(2);
      expect(mockRouter.replace).toHaveBeenCalledWith("/engagement");
    });

    it("opens the template library workspace from query params", async () => {
      mockCurrentUserAsSuperAdmin();
      mockNavigation.searchParams = "templateLibrary=1";
      mockApi.adminProjectTemplates.mockResolvedValue([
        {
          id: "project-template-cas",
          code: "CAS-STANDARD-AUDIT",
          name: "CAS standard audit template",
          language: "zh-CN",
          frameworkTemplateId: "framework-hkfrs",
          frameworkTemplate: {
            id: "framework-hkfrs",
            code: "HKFRS",
            name: "HKFRS",
            language: "zh-CN",
            isActive: true,
          },
          status: "DRAFT",
          _count: { nodes: 0, files: 0, smartForms: 0 },
          nodes: [],
        },
      ]);

      renderProjects();

      await expect(
        screen.findByText("CAS standard audit template", undefined, {
          timeout: 10_000,
        })
      ).resolves.toBeInTheDocument();
      expect(mockRouter.replace).toHaveBeenCalledWith("/engagement");
    });

    it("closes an inline folder draft when switching project templates", async () => {
      mockCurrentUserAsSuperAdmin();
      const templates = [
        {
          id: "project-template-one",
          code: "TEMPLATE-ONE",
          name: "Template one",
          language: "zh-CN",
          frameworkTemplateId: null,
          frameworkTemplate: null,
          status: "DRAFT",
          _count: { nodes: 1, files: 0, smartForms: 0 },
        },
        {
          id: "project-template-two",
          code: "TEMPLATE-TWO",
          name: "Template two",
          language: "zh-CN",
          frameworkTemplateId: null,
          frameworkTemplate: null,
          status: "DRAFT",
          _count: { nodes: 1, files: 0, smartForms: 0 },
        },
      ];
      mockApi.adminProjectTemplates.mockResolvedValue(templates);
      mockApi.adminProjectTemplate.mockImplementation((templateId: string) => {
        const template = templates.find((item) => item.id === templateId);
        return Promise.resolve({
          ...template,
          nodes: [
            {
              id: `${templateId}-planning`,
              projectTemplateId: templateId,
              parentId: null,
              level: 1,
              code: "Planning",
              title: "Planning",
              nodeType: "PHASE",
              sortOrder: 1,
              files: [],
            },
          ],
        });
      });
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );
      await screen.findByRole("treeitem", { name: /Planning/ });
      const planningNode = document.querySelector<HTMLElement>(
        '[data-directory-selectable-id="node:project-template-one-planning"]'
      );
      expect(planningNode).not.toBeNull();
      fireEvent.contextMenu(requireElement(planningNode));
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Add group" })
      );
      expect(screen.getByRole("textbox", { name: "New group" })).toBeVisible();

      fireEvent.click(screen.getByText("Template two"));

      await waitFor(() =>
        expect(
          screen.queryByRole("textbox", { name: "New group" })
        ).not.toBeInTheDocument()
      );
    });

    it("keeps template editing modes free of the desktop folder rail", async () => {
      mockCurrentUserAsSuperAdmin();
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );

      await waitFor(() =>
        expect(mockApi.adminProjectTemplates).toHaveBeenCalledWith()
      );
      const sidebar = screen.getByTestId("desktop-navigation-sidebar");
      expect(sidebar).toHaveStyle({ width: "0px" });
      expect(sidebar).toHaveAttribute("aria-hidden", "true");
      expect(
        screen.queryByRole("button", { name: "Default" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("separator", { name: "Resize navigation sidebar" })
      ).not.toBeInTheDocument();
    });

    it("shows project template details in the homepage template workspace", async () => {
      mockCurrentUserAsSuperAdmin();
      mockApi.adminProjectTemplates.mockResolvedValue([
        {
          id: "project-template-cas-standard-audit",
          code: "CAS-STANDARD-AUDIT",
          name: "CAS standard audit template",
          language: "zh-CN",
          frameworkTemplateId: "framework-hkfrs",
          frameworkTemplate: {
            id: "framework-hkfrs",
            code: "HKFRS",
            name: "HKFRS",
            language: "zh-CN",
            isActive: true,
          },
          description: "Reusable audit project template.",
          status: "PUBLISHED",
          _count: { nodes: 3, files: 1 },
        },
      ]);
      mockApi.adminProjectTemplate.mockResolvedValue({
        id: "project-template-cas-standard-audit",
        code: "CAS-STANDARD-AUDIT",
        name: "CAS standard audit template",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        frameworkTemplate: {
          id: "framework-hkfrs",
          code: "HKFRS",
          name: "HKFRS",
          language: "zh-CN",
          isActive: true,
        },
        description: "Reusable audit project template.",
        status: "PUBLISHED",
        _count: { nodes: 3, files: 1 },
        nodes: [
          {
            id: "template-node-planning",
            projectTemplateId: "project-template-cas-standard-audit",
            parentId: null,
            level: 1,
            code: "Planning",
            title: "Planning",
            nodeType: "PHASE",
            sortOrder: 1,
            files: [],
          },
          {
            id: "template-node-a1",
            projectTemplateId: "project-template-cas-standard-audit",
            parentId: "template-node-planning",
            level: 2,
            code: "A1",
            title: "Cash",
            nodeType: "ACCOUNT",
            sortOrder: 1,
            files: [],
          },
          {
            id: "template-node-a1-1000",
            projectTemplateId: "project-template-cas-standard-audit",
            parentId: "template-node-a1",
            level: 3,
            code: "A1-1000",
            title: "Cash",
            nodeType: "WORKING_PAPER",
            sortOrder: 1,
            files: [
              {
                id: "template-file-a1-1000-f001",
                projectTemplateId: "project-template-cas-standard-audit",
                templateNodeId: "template-node-a1-1000",
                code: "A1-1000-F001",
                title: "Cash lead schedule",
                fileName: "cash-lead-schedule.xlsx",
                originalName: "cash-lead-schedule.xlsx",
                fileUrl: "mock://project-templates/cash-lead-schedule.xlsx",
                fileSize: 4096,
                mimeType:
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                paperType: "WORKING_PAPER",
                sortOrder: 1,
              },
            ],
          },
        ],
      });
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );

      await expect(
        screen.findByText("CAS standard audit template")
      ).resolves.toBeInTheDocument();
      expect(
        screen.queryByText("Reusable audit project template.")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Folder code")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Folder title")
      ).not.toBeInTheDocument();
      expect(screen.getByText("Published")).toHaveAttribute(
        "data-slot",
        "badge"
      );
      await expect(
        screen.findByText("A1-1000-F001")
      ).resolves.toBeInTheDocument();
      expect(screen.getByTestId("desktop-canvas")).toHaveClass("h-full");
      const templateEntry = screen.getByRole("button", {
        name: /CAS standard audit template/,
        pressed: true,
      });
      expect(templateEntry).toHaveAttribute("aria-pressed", "true");
      expect(templateEntry.parentElement).toHaveClass("w-full", "min-w-0");
      expect(
        document.querySelector("#project-template-audit-area")
      ).not.toBeInTheDocument();
      expect(screen.getByText("Cash lead schedule")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "View details" })
      ).toHaveAttribute(
        "href",
        "/templates/project/project-template-cas-standard-audit/files/template-file-a1-1000-f001?returnTo=%2Fengagement%3FtemplateLibrary%3D1"
      );

      const directoryPanel = screen.getByTestId(
        "project-template-directory-panel"
      );
      expect(directoryPanel).toHaveStyle({ width: "300px" });

      const resizeHandles = screen.getAllByRole("separator", {
        name: "Resize template workspace panels",
      });
      const [libraryResizeHandle] = resizeHandles;
      const libraryPanel = libraryResizeHandle.previousElementSibling;
      expect(libraryResizeHandle).toHaveAttribute("data-slot", "splitter-rail");
      expect(libraryResizeHandle).toHaveAttribute("data-state", "expanded");
      expect(libraryResizeHandle).toHaveAttribute("aria-valuemin", "0");
      expect(libraryResizeHandle).toHaveAttribute("aria-valuemax", "420");
      expect(
        screen.getByTestId("template-library-splitter-hit-area")
      ).toHaveClass("absolute", "inset-y-0", "-inset-x-3", "cursor-pointer");
      expect(libraryPanel).toHaveStyle({ width: "320px" });
      fireEvent.pointerDown(libraryResizeHandle, {
        button: 2,
        clientX: 320,
        pointerId: 10,
      });
      fireEvent.pointerMove(window, {
        button: 2,
        clientX: 400,
        pointerId: 10,
      });
      fireEvent.pointerUp(window, { button: 2, pointerId: 10 });
      expect(libraryPanel).toHaveStyle({ width: "320px" });

      fireEvent.pointerDown(libraryResizeHandle, {
        button: 0,
        clientX: 320,
        pointerId: 11,
      });
      fireEvent.pointerMove(window, { clientX: 400, pointerId: 11 });
      fireEvent.pointerUp(window, { pointerId: 11 });
      expect(libraryPanel).toHaveStyle({ width: "400px" });
      fireEvent.click(libraryResizeHandle);
      expect(libraryPanel).toHaveStyle({ width: "400px" });
      fireEvent.click(libraryResizeHandle);
      expect(libraryPanel).toHaveStyle({ width: "0px" });
      fireEvent.click(libraryResizeHandle);
      expect(libraryPanel).toHaveStyle({ width: "400px" });

      fireEvent.pointerDown(libraryResizeHandle, {
        button: 0,
        clientX: 400,
        pointerId: 12,
      });
      fireEvent.pointerMove(window, { clientX: 360, pointerId: 12 });
      fireEvent.pointerUp(window, { pointerId: 12 });
      expect(libraryPanel).toHaveStyle({ width: "360px" });

      fireEvent.pointerDown(libraryResizeHandle, {
        button: 0,
        clientX: 360,
        pointerId: 13,
      });
      fireEvent.pointerMove(window, { clientX: 400, pointerId: 13 });
      fireEvent.pointerUp(window, { pointerId: 13 });
      expect(libraryPanel).toHaveStyle({ width: "400px" });

      const resizeHandle = resizeHandles[resizeHandles.length - 1];
      expect(resizeHandle).toHaveAttribute("data-slot", "splitter-rail");
      expect(resizeHandle).toHaveAttribute("aria-orientation", "vertical");
      expect(resizeHandle).toHaveAttribute("data-state", "expanded");
      expect(resizeHandle).toHaveAttribute("aria-valuemin", "240");
      expect(resizeHandle).toHaveAttribute("aria-valuemax", "520");
      expect(resizeHandle).toHaveAttribute("tabindex", "0");
      expect(resizeHandle).toHaveClass(
        "bg-transparent",
        "h-full",
        "cursor-pointer",
        "focus-visible:ring-2",
        "focus-visible:ring-ring"
      );
      expect(
        screen.getByTestId("template-directory-splitter-hit-area")
      ).toHaveClass("absolute", "inset-y-0", "-inset-x-3", "cursor-pointer");
      fireEvent.pointerDown(resizeHandle, {
        button: 0,
        clientX: 300,
        pointerId: 14,
      });
      fireEvent.pointerMove(window, { clientX: 400, pointerId: 14 });
      fireEvent.pointerUp(window, { pointerId: 14 });

      expect(directoryPanel).toHaveStyle({ width: "400px" });

      fireEvent.click(resizeHandle);
      expect(directoryPanel).toHaveStyle({ width: "400px" });
      fireEvent.click(resizeHandle);
      expect(directoryPanel).toHaveStyle({ width: "0px" });
      fireEvent.click(resizeHandle);
      expect(directoryPanel).toHaveStyle({ width: "400px" });

      fireEvent.pointerDown(resizeHandle, {
        button: 0,
        clientX: 400,
        pointerId: 15,
      });
      fireEvent.pointerMove(window, { clientX: 340, pointerId: 15 });
      fireEvent.pointerUp(window, { pointerId: 15 });
      expect(directoryPanel).toHaveStyle({ width: "340px" });

      fireEvent.pointerDown(resizeHandle, {
        button: 0,
        clientX: 340,
        pointerId: 16,
      });
      fireEvent.pointerMove(window, { clientX: 400, pointerId: 16 });
      fireEvent.pointerUp(window, { pointerId: 16 });
      expect(directoryPanel).toHaveStyle({ width: "400px" });

      fireEvent.pointerDown(resizeHandle, {
        button: 0,
        clientX: 400,
        pointerId: 17,
      });
      fireEvent.pointerMove(window, { clientX: 480, pointerId: 17 });
      fireEvent.pointerCancel(window, { pointerId: 17 });
      expect(directoryPanel).toHaveStyle({ width: "400px" });

      fireEvent.keyDown(resizeHandle, { key: "Enter" });
      expect(directoryPanel).toHaveStyle({ width: "0px" });
      fireEvent.keyDown(resizeHandle, { key: " " });
      expect(directoryPanel).toHaveStyle({ width: "400px" });
    });

    it("uploads template files to folders that have child folders", async () => {
      mockCurrentUserAsSuperAdmin();
      const template = {
        id: "project-template-cas-standard-audit",
        code: "CAS-STANDARD-AUDIT",
        name: "CAS standard audit template",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        frameworkTemplate: {
          id: "framework-hkfrs",
          code: "HKFRS",
          name: "HKFRS",
          language: "zh-CN",
          isActive: true,
        },
        description: "Reusable audit project template.",
        status: "DRAFT",
        _count: { nodes: 4, files: 0 },
      } as const;
      const templateDetails = {
        ...template,
        nodes: [
          {
            id: "template-node-planning",
            projectTemplateId: template.id,
            parentId: null,
            level: 1,
            code: "Planning",
            title: "Planning",
            nodeType: "PHASE",
            sortOrder: 1,
            files: [],
          },
          {
            id: "template-node-a1",
            projectTemplateId: template.id,
            parentId: "template-node-planning",
            level: 2,
            code: "A1",
            title: "Cash",
            nodeType: "ACCOUNT",
            sortOrder: 1,
            files: [],
          },
          {
            id: "template-node-a1-1000",
            projectTemplateId: template.id,
            parentId: "template-node-a1",
            level: 3,
            code: "A1-1000",
            title: "Cash",
            nodeType: "WORKING_PAPER",
            sortOrder: 1,
            files: [],
          },
          {
            id: "template-node-a1-1000-01",
            projectTemplateId: template.id,
            parentId: "template-node-a1-1000",
            level: 4,
            code: "A1-1000-01",
            title: "Bank reconciliation",
            nodeType: "WORKING_PAPER",
            sortOrder: 1,
            files: [],
          },
        ],
      };
      const uploadedFile = {
        id: "template-file-uploaded",
        projectTemplateId: template.id,
        templateNodeId: "template-node-a1-1000",
        code: "A1-1000-F001",
        title: "Uploaded template.xlsx",
        fileName: "Uploaded template.xlsx",
        originalName: "Uploaded template.xlsx",
        fileUrl: "mock://template/uploaded.xlsx",
        fileSize: 4096,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        paperType: "WORKING_PAPER",
        sortOrder: 1,
        templateItemId: "template-file-uploaded",
      };
      mockApi.adminProjectTemplates.mockResolvedValue([template]);
      mockApi.adminProjectTemplate.mockResolvedValue(templateDetails);
      mockApi.uploadProjectTemplateFile.mockResolvedValue(uploadedFile);
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );

      const uploadButton = await screen.findByRole("button", {
        name: "Upload template file",
      });
      fireEvent.click(
        await screen.findByRole("treeitem", { name: /A1\s*-\s*1000.*Cash/ })
      );
      const templateFilesPanel = screen
        .getByText("Template files")
        .closest("section");
      expect(templateFilesPanel).not.toBeNull();
      await waitFor(() =>
        expect(
          within(requireElement(templateFilesPanel)).getByText(/A1\s*-\s*1000/)
        ).toBeInTheDocument()
      );
      await waitFor(() => expect(uploadButton).not.toBeDisabled());
      const fileInput =
        requireElement(templateFilesPanel).querySelector<HTMLInputElement>(
          'input[type="file"]'
        );
      expect(fileInput).not.toBeNull();
      const file = new File(["uploaded"], "Uploaded template.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      fireEvent.change(requireElement(fileInput), {
        target: { files: [file] },
      });

      await waitFor(() =>
        expect(mockApi.uploadProjectTemplateFile).toHaveBeenCalledWith(
          template.id,
          "template-node-a1-1000",
          {},
          file
        )
      );
      await expect(
        within(templateFilesPanel as HTMLElement).findByText(
          "Uploaded template.xlsx"
        )
      ).resolves.toBeInTheDocument();
    }, 15_000);

    it("shows a Smart Form added to a template folder without refreshing", async () => {
      mockCurrentUserAsSuperAdmin();
      const template = {
        id: "project-template-smart-form",
        code: "SMART-FORM-TEMPLATE",
        name: "Smart Form template",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        frameworkTemplate: {
          id: "framework-hkfrs",
          code: "HKFRS",
          name: "HKFRS",
          language: "zh-CN",
          isActive: true,
        },
        description: "",
        status: "DRAFT",
        _count: { nodes: 1, files: 0, smartForms: 0 },
      } as const;
      const templateDetails = {
        ...template,
        nodes: [
          {
            id: "template-node-a1-1000",
            projectTemplateId: template.id,
            parentId: null,
            level: 1,
            code: "1000",
            title: "Planning",
            nodeType: "WORKING_PAPER",
            sortOrder: 1,
            files: [],
            smartForms: [],
          },
        ],
      };
      const smartFormTemplate = {
        id: "smart-form-template-planning",
        code: "SF-PLAN",
        name: "Planning checklist",
        frameworkTemplateId: "framework-hkfrs",
        description: "",
        status: "PUBLISHED",
        currentPublishedVersionId: "smart-form-version-planning-1",
        draftDefinitionJson: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
      };
      const reference = {
        id: "template-smart-form-reference-planning",
        projectTemplateId: template.id,
        templateNodeId: "template-node-a1-1000",
        smartFormTemplateId: smartFormTemplate.id,
        smartFormTemplateVersionId: "smart-form-version-planning-1",
        code: "1000.1",
        title: "Planning checklist",
        fileName: "Planning checklist",
        sortOrder: 1,
      };
      const updatedTemplateDetails = {
        ...templateDetails,
        _count: { ...templateDetails._count, smartForms: 1 },
        nodes: templateDetails.nodes.map((node) => ({
          ...node,
          smartForms: [reference],
        })),
      };
      mockApi.adminProjectTemplates.mockResolvedValue([template]);
      mockApi.adminProjectTemplate
        .mockResolvedValueOnce(templateDetails)
        .mockResolvedValue(updatedTemplateDetails);
      mockApi.smartFormTemplates.mockResolvedValue([smartFormTemplate]);
      mockApi.createProjectTemplateSmartForm.mockResolvedValue(reference);
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );
      fireEvent.click(
        await screen.findByRole("treeitem", { name: /1000.*Planning/ })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Add Smart Form" })
      );
      const dialog = await screen.findByRole("dialog", {
        name: "Add Smart Form",
      });
      const addSmartFormButton = within(dialog).getByRole("button", {
        name: "Add",
      });
      expect(
        within(dialog).getByRole("textbox", { name: "Smart Form name" })
      ).toHaveValue("Planning checklist");
      expect(
        within(dialog).getByRole("textbox", { name: "Smart Form code" })
      ).toHaveValue("1000.1");
      await waitFor(() => expect(addSmartFormButton).not.toBeDisabled());
      fireEvent.click(addSmartFormButton);

      await waitFor(() =>
        expect(mockApi.createProjectTemplateSmartForm).toHaveBeenCalledWith(
          template.id,
          "template-node-a1-1000",
          {
            smartFormTemplateVersionId: "smart-form-version-planning-1",
            code: "1000.1",
            title: "Planning checklist",
          }
        )
      );
      await expect(screen.findByText("1000.1")).resolves.toBeVisible();
      await waitFor(() =>
        expect(mockApi.adminProjectTemplate).toHaveBeenCalledTimes(2)
      );
    }, 15_000);

    it("creates a numbered leave-blank in the selected template folder", async () => {
      mockCurrentUserAsSuperAdmin();
      const template = {
        id: "project-template-leave-blank",
        code: "LEAVE-BLANK-TEMPLATE",
        name: "Leave-blank template",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        frameworkTemplate: {
          id: "framework-hkfrs",
          code: "HKFRS",
          name: "HKFRS",
          language: "zh-CN",
          isActive: true,
        },
        description: "",
        status: "DRAFT",
        _count: { nodes: 1, files: 0, smartForms: 0 },
      } as const;
      const templateDetails = {
        ...template,
        nodes: [
          {
            id: "template-node-1000",
            projectTemplateId: template.id,
            parentId: null,
            level: 1,
            code: "1000",
            title: "Planning",
            nodeType: "WORKING_PAPER",
            sortOrder: 1,
            files: [],
            smartForms: [],
          },
        ],
      };
      const leaveBlank = {
        id: "template-leave-blank-1",
        projectTemplateId: template.id,
        templateNodeId: "template-node-1000",
        code: "1000.1",
        title: "Client representation",
        fileName: "Client representation",
        originalName: "Client representation",
        fileUrl: "",
        fileSize: 0,
        mimeType: "application/octet-stream",
        placeholderType: "GENERIC",
        paperType: "WORKING_PAPER",
        sortOrder: 1,
      } as const;
      mockApi.adminProjectTemplates.mockResolvedValue([template]);
      mockApi.adminProjectTemplate.mockResolvedValue(templateDetails);
      mockApi.createProjectTemplatePlaceholder.mockResolvedValue(leaveBlank);
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );
      fireEvent.click(
        await screen.findByRole("treeitem", { name: /1000.*Planning/ })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Add leave-blank" })
      );

      const dialog = await screen.findByRole("dialog", {
        name: "New leave-blank",
      });
      const codeInput = within(dialog).getByLabelText("Reference code");
      expect(codeInput).toHaveValue("1000.1");
      expect(within(dialog).queryByLabelText("File type")).toBeNull();
      fireEvent.change(codeInput, { target: { value: "1000.7" } });
      fireEvent.change(within(dialog).getByLabelText("Leave-blank name"), {
        target: { value: "Client representation" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Create leave-blank" })
      );

      await waitFor(() =>
        expect(mockApi.createProjectTemplatePlaceholder).toHaveBeenCalledWith(
          template.id,
          "template-node-1000",
          {
            code: "1000.7",
            title: "Client representation",
            placeholderType: "GENERIC",
          }
        )
      );
      await expect(
        screen.findByText("Client representation")
      ).resolves.toBeVisible();
      expect(screen.getByText("Leave-blank")).toBeVisible();
    }, 15_000);

    it("updates project template metadata from the template settings gear", async () => {
      mockCurrentUserAsSuperAdmin();
      mockApi.frameworkTemplates.mockResolvedValue([
        {
          id: "framework-hkfrs",
          code: "HKFRS",
          name: "HKFRS",
          language: "zh-CN",
          isActive: true,
        },
        {
          id: "framework-cas",
          code: "CAS",
          name: "CAS",
          language: "zh-CN",
          isActive: true,
        },
      ]);
      const draftTemplate = {
        id: "project-template-draft",
        code: "DRAFT-TEMPLATE",
        name: "Draft template",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        frameworkTemplate: {
          id: "framework-hkfrs",
          code: "HKFRS",
          name: "HKFRS",
          language: "zh-CN",
          isActive: true,
        },
        description: "",
        status: "DRAFT",
        _count: { nodes: 0, files: 0 },
      };
      mockApi.adminProjectTemplates.mockResolvedValue([draftTemplate]);
      mockApi.adminProjectTemplate.mockResolvedValue({
        ...draftTemplate,
        nodes: [],
      });
      mockApi.updateProjectTemplate.mockResolvedValue({
        ...draftTemplate,
        code: "UPDATED-TEMPLATE",
        name: "Updated template",
        frameworkTemplateId: "framework-cas",
        frameworkTemplate: {
          id: "framework-cas",
          code: "CAS",
          name: "CAS",
          language: "zh-CN",
          isActive: true,
        },
        status: "PUBLISHED",
        nodes: [],
      });
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "Draft template: More actions" },
          { timeout: 10_000 }
        )
      );
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Template settings" })
      );

      const dialog = await screen.findByRole("dialog", {
        name: "Template settings",
      });
      fireEvent.change(within(dialog).getByLabelText("Template name"), {
        target: { value: "Updated template" },
      });
      fireEvent.change(within(dialog).getByLabelText("Template code"), {
        target: { value: "UPDATED-TEMPLATE" },
      });
      await selectScopedOption(dialog, "Recommended standard", "CAS - CAS");
      fireEvent.click(
        within(dialog).getByRole("checkbox", { name: "Published" })
      );
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Save settings" })
      );

      await waitFor(() =>
        expect(mockApi.updateProjectTemplate).toHaveBeenCalledWith(
          "project-template-draft",
          {
            code: "UPDATED-TEMPLATE",
            name: "Updated template",
            frameworkTemplateId: "framework-cas",
            status: "PUBLISHED",
          }
        )
      );
    });

    it("creates V2 Smart Form templates before opening the AST designer", async () => {
      mockCurrentUserAsSuperAdmin();
      mockApi.adminSmartFormTemplates
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);
      mockApi.createSmartFormTemplate.mockImplementation((input) => ({
        id: "smart-form-template-client-acceptance",
        code: input.code,
        name: input.name,
        frameworkTemplateId: input.frameworkTemplateId ?? null,
        frameworkTemplate: null,
        description: input.description ?? "",
        status: "DRAFT",
        currentPublishedVersionId: null,
        currentPublishedVersion: null,
        draftDefinitionJson: input.definition,
      }));

      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Smart Forms" })
      );
      fireEvent.click(await screen.findByRole("button", { name: "New form" }));

      const dialog = await screen.findByRole("dialog", {
        name: "New Smart Form",
      });
      fireEvent.change(within(dialog).getByPlaceholderText("Smart Form name"), {
        target: { value: "Client acceptance" },
      });
      fireEvent.change(within(dialog).getByPlaceholderText("Smart Form code"), {
        target: { value: "SF-ACCEPT" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Create Smart Form" })
      );

      await waitFor(() =>
        expect(mockApi.createSmartFormTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Client acceptance",
            code: "SF-ACCEPT",
            frameworkTemplateId: null,
            definition: expect.objectContaining({
              kind: "smartForm",
              schemaVersion: 2,
              children: expect.any(Array),
            }),
          })
        )
      );
    });

    it("shows an error when project template creation fails", async () => {
      mockCurrentUserAsSuperAdmin();
      mockApi.createProjectTemplate.mockRejectedValue(
        new Error("Project template code already exists")
      );
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Create / Import template" })
      );

      const dialog = screen.getByRole("dialog");
      fireEvent.change(within(dialog).getByPlaceholderText("Template name"), {
        target: { value: "Template1" },
      });
      fireEvent.change(within(dialog).getByPlaceholderText("Template code"), {
        target: { value: "TM1" },
      });

      const createButton = within(dialog).getByRole("button", {
        name: "Create blank template",
      });
      await waitFor(() => expect(createButton).not.toBeDisabled());
      fireEvent.click(createButton);

      await expect(
        screen.findByText("Project template failed")
      ).resolves.toBeInTheDocument();
      expect(
        screen.queryByText("Project template code already exists")
      ).not.toBeInTheDocument();
    });

    it("creates project templates with explicit language and framework", async () => {
      mockCurrentUserAsSuperAdmin();
      mockApi.createProjectTemplate.mockResolvedValue({
        id: "project-template-new",
        code: "TM1",
        name: "Template1",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        status: "DRAFT",
        _count: { nodes: 0, files: 0 },
        nodes: [],
      });
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Create / Import template" })
      );

      const dialog = screen.getByRole("dialog");
      fireEvent.change(within(dialog).getByPlaceholderText("Template name"), {
        target: { value: "Template1" },
      });
      fireEvent.change(within(dialog).getByPlaceholderText("Template code"), {
        target: { value: "TM1" },
      });

      const createButton = within(dialog).getByRole("button", {
        name: "Create blank template",
      });
      await waitFor(() => expect(createButton).not.toBeDisabled());
      fireEvent.click(createButton);

      await waitFor(() =>
        expect(mockApi.createProjectTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "TM1",
            name: "Template1",
            language: "zh-CN",
            frameworkTemplateId: "framework-hkfrs",
          })
        )
      );
    });

    it("imports project templates from a zip with explicit metadata", async () => {
      mockCurrentUserAsSuperAdmin();
      const zipFile = new File(["zip"], "template.zip", {
        type: "application/zip",
      });
      mockApi.importProjectTemplateZip.mockResolvedValue({
        id: "project-template-imported",
        code: "TMP-IMPORT",
        name: "Imported template",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        status: "DRAFT",
        _count: { nodes: 0, files: 0 },
        nodes: [],
      });
      renderProjects();

      fireEvent.click(
        await screen.findByRole("button", { name: "Template library" })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Create / Import template" })
      );

      const dialog = screen.getByRole("dialog");
      fireEvent.change(within(dialog).getByPlaceholderText("Template name"), {
        target: { value: "Imported template" },
      });
      fireEvent.change(within(dialog).getByPlaceholderText("Template code"), {
        target: { value: "TMP-IMPORT" },
      });
      fireEvent.change(within(dialog).getByLabelText("Template zip file"), {
        target: { files: [zipFile] },
      });

      const importButton = within(dialog).getByRole("button", {
        name: "Import template",
      });
      await waitFor(() => expect(importButton).not.toBeDisabled());
      fireEvent.click(importButton);

      await waitFor(() =>
        expect(mockApi.importProjectTemplateZip).toHaveBeenCalledWith(
          {
            code: "TMP-IMPORT",
            name: "Imported template",
            language: "zh-CN",
            frameworkTemplateId: "framework-hkfrs",
          },
          zipFile
        )
      );
    });

    it("opens a project from the default detail row", async () => {
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("AUD-2026-0001")).toBeInTheDocument()
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Open project: Orchid Holdings" })
        ).toBeInTheDocument()
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Open project: Orchid Holdings" })
      );

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/engagement/project-1?returnTo=%2Fengagement%3FfolderId%3Dfolder-default"
        );
      });
    });

    it("opens a project when its detail data row is clicked", async () => {
      renderProjects();

      const table = await screen.findByRole("table", {
        name: "Default projects",
      });
      const projectRow = within(table).getByRole("row", {
        name: /Orchid Holdings/,
      });
      fireEvent.click(projectRow);
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/engagement/project-1?returnTo=%2Fengagement%3FfolderId%3Dfolder-default"
        );
      });

      fireEvent.click(projectRow);
      await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(2));
    });

    it("restores the folder requested by a project return link", async () => {
      mockNavigation.searchParams = "folderId=folder-client";
      renderProjects();

      await expect(
        screen.findByRole("button", { name: "Client folder" })
      ).resolves.toHaveAttribute("aria-current", "page");
    });

    it("opens EMP work items in the right-side dock", async () => {
      mockApi.workItems.mockResolvedValue({
        items: [
          {
            id: "EMP-001:invitation-1",
            ruleId: "EMP-001",
            domain: "EMP",
            view: "PERSONAL",
            category: "PROJECT",
            state: "OPEN",
            severity: "ACTION_REQUIRED",
            priority: "NORMAL",
            title: "You have a pending project invitation.",
            description: "Open the invitation to respond.",
            subjectType: "PROJECT_INVITATION",
            subjectId: "invitation-1",
            reference: null,
            objectLabel: "Orchid Holdings",
            responsibleLabel: "Jony Ma",
            assignedTo: null,
            createdBy: null,
            dueAt: null,
            openedAt: "2026-08-31T08:00:00.000Z",
            updatedAt: "2026-08-31T08:00:00.000Z",
            project: null,
            actionTarget: {
              app: "EMP",
              resourceType: "PROJECT_INVITATION",
              resourceId: "invitation-1",
              params: { path: "/inbox/invitations/invitation-1" },
            },
          },
        ],
        categories: [],
        counts: { total: 1, EMP: 1, PROJECT: 0, CMP: 0, TMS: 0, OPS: 0 },
      });
      renderProjects();

      const workItemButton = await screen.findByRole("button", {
        name: "EMP work items",
      });
      expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
      expect(screen.queryByText("Folders")).toBeNull();
      await waitFor(() =>
        expect(
          workItemButton.querySelector(
            '[data-slot="project-wing-top-bar-inbox-unread-dot"]'
          )
        ).toBeTruthy()
      );

      fireEvent.click(workItemButton);

      await expect(
        screen.findByRole("dialog", { name: "EMP work items" })
      ).resolves.toBeInTheDocument();
      expect(
        screen.getByText("You have a pending project invitation.")
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", {
          name: /Complete declaration: You have a pending project invitation\./,
        })
      );
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/inbox/invitations/invitation-1"
      );
    });

    it("shows account details and signs out from the avatar hover card", async () => {
      renderProjects();

      const accountMenuButton = await screen.findByRole("button", {
        name: "Account menu",
      });
      expect(
        within(accountMenuButton).getByRole("img", { name: "Current account" })
      ).toBeTruthy();

      fireEvent.click(await screen.findByRole("button", { name: "Settings" }));

      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).queryByText("partner@projectwing.local")
      ).toBeNull();
      expect(
        within(dialog).queryByRole("button", { name: "Sign out" })
      ).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      fireEvent.pointerEnter(accountMenuButton);

      await expect(screen.findByText("Jony Ma")).resolves.toBeInTheDocument();
      await expect(
        screen.findByText("partner@projectwing.local")
      ).resolves.toBeInTheDocument();
      fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    });

    it("shows last opened metadata on home project rows instead of a recent view", async () => {
      vi.spyOn(Date, "now").mockReturnValue(
        new Date("2026-06-05T12:05:00.000Z").getTime()
      );
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: [
          {
            ...desktopState.placements[0],
            lastOpenedAt: "2026-06-05T12:00:00.000Z",
          },
          makePlacement({
            id: "placement-2",
            projectId: "project-2",
            desktopX: 156,
            desktopY: 24,
            sortOrder: 1,
            lastOpenedAt: null,
            project: {
              id: "project-2",
              projectNumber: 1_000_002,
              name: "Harbor Trading",
              projectCode: "AUD-2026-0002",
            },
          }),
        ],
      });
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("Orchid Holdings")).toBeInTheDocument()
      );
      expect(screen.getByText("Harbor Trading")).toBeInTheDocument();
      expect(screen.getByText("Opened 5 minutes ago")).toBeInTheDocument();
      expect(screen.getByText("Never opened")).toBeInTheDocument();
    });

    it("creates a folder from the context menu", async () => {
      mockApi.createDesktopFolder.mockResolvedValue({
        id: "folder-2",
        ownerId: "user-partner",
        name: "Archive",
        sortOrder: 1,
        isDefault: false,
      });
      renderProjects();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.click(screen.getByRole("menuitem", { name: "New folder" }));
      fireEvent.change(await screen.findByLabelText("Folder name"), {
        target: { value: "Archive" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() =>
        expect(mockApi.createDesktopFolder).toHaveBeenCalledWith({
          name: "Archive",
        })
      );
    });

    it("opens the shared new-folder menu from blank navigation space", async () => {
      renderProjects();

      const blankNavigation = await screen.findByTestId(
        "desktop-folder-blank-context-target"
      );
      fireEvent.contextMenu(blankNavigation);

      const newFolderItem = await screen.findByRole("menuitem", {
        name: "New folder",
      });
      const menu = newFolderItem.closest('[data-slot="context-menu-content"]');
      expect(menu).toHaveClass("w-64", "rounded-md", "shadow-xl");
      expect(newFolderItem).toHaveClass("h-9", "px-3", "text-sm");
      fireEvent.click(newFolderItem);

      await expect(
        screen.findByRole("dialog", { name: "New folder" })
      ).resolves.toBeVisible();
    });

    it("renames a custom folder from its context menu", async () => {
      renderProjects();

      const folder = await screen.findByRole("button", {
        name: "Client folder",
      });
      fireEvent.contextMenu(folder);
      const renameItem = await screen.findByRole("menuitem", {
        name: "Rename folder",
      });
      const menu = renameItem.closest('[data-slot="context-menu-content"]');
      expect(menu).toHaveClass("w-64", "rounded-md", "shadow-xl");
      expect(renameItem).toHaveClass("h-9", "px-3", "text-sm");
      fireEvent.click(renameItem);

      const dialog = await screen.findByRole("dialog", {
        name: "Rename folder",
      });
      const nameInput = within(dialog).getByLabelText("Folder name");
      expect(nameInput).toHaveValue("Client folder");
      fireEvent.change(nameInput, { target: { value: "Renamed client" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(mockApi.updateDesktopFolder).toHaveBeenCalledWith(
          "folder-client",
          { name: "Renamed client" }
        )
      );
    });

    it("disables folder deletion while the folder contains projects", async () => {
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: [
          {
            ...desktopState.placements[0],
            folderId: "folder-client",
          },
        ],
      });
      renderProjects();

      const folder = await screen.findByRole("button", {
        name: "Client folder",
      });
      fireEvent.contextMenu(folder);

      await expect(
        screen.findByRole("menuitem", { name: "Delete folder" })
      ).resolves.toHaveAttribute("data-disabled");
    });

    it("deletes an empty custom folder after confirmation", async () => {
      renderProjects();

      const folder = await screen.findByRole("button", {
        name: "Client folder",
      });
      fireEvent.contextMenu(folder);
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Delete folder" })
      );

      const dialog = await screen.findByRole("alertdialog", {
        name: "Delete folder?",
      });
      expect(dialog).toHaveTextContent("Client folder");
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(mockApi.deleteDesktopFolder).toHaveBeenCalledWith(
          "folder-client"
        )
      );
    });

    it("opens a sort submenu and persists sorted desktop positions in one batch", async () => {
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: [
          makePlacement({
            id: "placement-1",
            projectId: "project-1",
            desktopX: 156,
            desktopY: 24,
            sortOrder: 1,
            createdAt: "2026-02-01T00:00:00.000Z",
            project: {
              id: "project-1",
              name: "Zulu Holdings",
              projectCode: "AUD-2026-0009",
            },
          }),
          makePlacement({
            id: "placement-2",
            projectId: "project-2",
            desktopX: 24,
            desktopY: 24,
            sortOrder: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            project: {
              id: "project-2",
              projectNumber: 1_000_002,
              name: "Alpha Trading",
              projectCode: "AUD-2026-0001",
            },
          }),
        ],
      });
      renderProjects();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "Sort by" }));
      fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Name" }));

      await waitFor(() =>
        expect(mockApi.reorderDesktopProjectPlacements).toHaveBeenCalledWith(
          "folder-default",
          {
            placements: [
              {
                projectId: "project-2",
                sortOrder: 0,
                desktopX: 24,
                desktopY: 24,
              },
              {
                projectId: "project-1",
                sortOrder: 1,
                desktopX: 156,
                desktopY: 24,
              },
            ],
          }
        )
      );
      expect(mockApi.updateDesktopProjectPlacement).not.toHaveBeenCalled();
      expect(
        window.localStorage.getItem("project-wing-home-sort-preferences")
      ).toContain('"folder-default"');
    });

    it("sorts project icons by last opened with newest first", async () => {
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: [
          makePlacement({
            id: "placement-1",
            projectId: "project-1",
            desktopX: 156,
            desktopY: 24,
            sortOrder: 1,
            lastOpenedAt: "2026-06-01T09:00:00.000Z",
            project: {
              id: "project-1",
              name: "Older Project",
              projectCode: "AUD-2026-0001",
            },
          }),
          makePlacement({
            id: "placement-2",
            projectId: "project-2",
            desktopX: 24,
            desktopY: 24,
            sortOrder: 0,
            lastOpenedAt: "2026-06-05T12:00:00.000Z",
            project: {
              id: "project-2",
              projectNumber: 1_000_002,
              name: "Newer Project",
              projectCode: "AUD-2026-0002",
            },
          }),
        ],
      });
      renderProjects();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "Sort by" }));
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Last opened" })
      );

      await waitFor(() =>
        expect(mockApi.reorderDesktopProjectPlacements).toHaveBeenCalledWith(
          "folder-default",
          {
            placements: [
              {
                projectId: "project-2",
                sortOrder: 0,
                desktopX: 24,
                desktopY: 24,
              },
              {
                projectId: "project-1",
                sortOrder: 1,
                desktopX: 156,
                desktopY: 24,
              },
            ],
          }
        )
      );
      expect(
        window.localStorage.getItem("project-wing-home-sort-preferences")
      ).toContain('"lastOpenedAt"');
    });

    it("renders persisted coordinates while a saved sort preference is active", async () => {
      window.localStorage.setItem(
        "project-wing-home-sort-preferences",
        JSON.stringify({
          "folder-default": { field: "name", direction: "asc" },
        })
      );
      window.localStorage.setItem("project-wing-home-view-mode", "icons");
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: [
          makePlacement({
            id: "placement-1",
            projectId: "project-1",
            desktopX: 288,
            desktopY: 24,
            sortOrder: 1,
            project: {
              id: "project-1",
              name: "Zulu Holdings",
              projectCode: "AUD-2026-0009",
            },
          }),
          makePlacement({
            id: "placement-2",
            projectId: "project-2",
            desktopX: 156,
            desktopY: 24,
            sortOrder: 0,
            project: {
              id: "project-2",
              projectNumber: 1_000_002,
              name: "Alpha Trading",
              projectCode: "AUD-2026-0001",
            },
          }),
        ],
      });
      renderProjects();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "Sort by" }));

      await waitFor(() =>
        expect(
          screen.getByRole("menuitemcheckbox", { name: "Name" })
        ).toHaveAttribute("aria-checked", "true")
      );
      expect(screen.getByText("Alpha Trading")).toBeInTheDocument();
    });

    it("reapplies sorting when the global direction toggle changes", async () => {
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: [
          makePlacement({
            id: "placement-1",
            projectId: "project-1",
            desktopX: 24,
            desktopY: 24,
            sortOrder: 0,
            project: {
              id: "project-1",
              name: "Alpha Trading",
              projectCode: "AUD-2026-0001",
            },
          }),
          makePlacement({
            id: "placement-2",
            projectId: "project-2",
            desktopX: 156,
            desktopY: 24,
            sortOrder: 1,
            project: {
              id: "project-2",
              projectNumber: 1_000_002,
              name: "Zulu Holdings",
              projectCode: "AUD-2026-0009",
            },
          }),
        ],
      });
      renderProjects();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "Sort by" }));
      fireEvent.click(screen.getByRole("button", { name: "Descending" }));

      await waitFor(() =>
        expect(mockApi.reorderDesktopProjectPlacements).toHaveBeenCalledWith(
          "folder-default",
          expect.objectContaining({
            placements: expect.arrayContaining([
              expect.objectContaining({
                projectId: "project-2",
                sortOrder: 0,
                desktopX: 24,
                desktopY: 24,
              }),
            ]),
          })
        )
      );
    });

    it("omits unimplemented view and refresh actions from the context menu", async () => {
      renderProjects();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });

      expect(
        screen.queryByRole("menuitem", { name: "View" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("menuitem", { name: "Refresh" })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Sort by" })
      ).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "New" })).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Display settings" })
      ).toBeInTheDocument();
    });

    it("updates homepage display settings from the context menu", async () => {
      renderProjects();

      expect(screen.queryByText("2027-03-31")).not.toBeInTheDocument();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(
        screen.getByRole("menuitem", { name: "Display settings" })
      );
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Show report date" })
      );

      await expect(
        screen.findByText("2027-03-31")
      ).resolves.toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Report date" })
      ).toBeVisible();
      expect(
        window.localStorage.getItem("project-wing-home-display-settings")
      ).toContain('"showReportDate":true');
    });

    it("toggles last opened metadata from the display settings menu", async () => {
      vi.spyOn(Date, "now").mockReturnValue(
        new Date("2026-06-05T12:05:00.000Z").getTime()
      );
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: [
          {
            ...desktopState.placements[0],
            lastOpenedAt: "2026-06-05T12:00:00.000Z",
          },
        ],
      });
      renderProjectsInIconView();

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Project view" })
        ).not.toHaveAttribute("aria-pressed")
      );
      await expect(
        screen.findByText("Opened 5 minutes ago")
      ).resolves.toBeInTheDocument();

      fireEvent.contextMenu(screen.getByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(
        screen.getByRole("menuitem", { name: "Display settings" })
      );
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Show last opened" })
      );

      expect(
        screen.queryByText("Opened 5 minutes ago")
      ).not.toBeInTheDocument();
      expect(
        window.localStorage.getItem("project-wing-home-display-settings")
      ).toContain('"showLastOpened":false');
    });

    it("keeps the submenu open while moving into it and closes on outside click", async () => {
      renderProjects();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(
        screen.getByRole("menuitem", { name: "Display settings" })
      );

      const submenuItem = screen.getByRole("menuitemcheckbox", {
        name: "Show project code",
      });
      fireEvent.mouseEnter(submenuItem);

      expect(submenuItem).toBeInTheDocument();

      fireEvent.mouseDown(document.body);

      await waitFor(() =>
        expect(
          screen.queryByRole("menuitemcheckbox", { name: "Show project code" })
        ).not.toBeInTheDocument()
      );
    });

    it("uses locale-specific menu copy for chinese pages", async () => {
      mockI18n.locale = "zh-CN";
      renderProjects();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "Sort by" }));

      expect(screen.getByRole("button", { name: "升序" })).toBeInTheDocument();
      fireEvent.mouseEnter(
        screen.getByRole("menuitem", { name: "Display settings" })
      );
      expect(
        screen.getByRole("menuitemcheckbox", { name: "显示报告日期" })
      ).toBeInTheDocument();
    });

    it("hides project creation for super admins", async () => {
      mockCurrentUserAsSuperAdmin();
      renderProjects();

      await expect(
        screen.findByTestId("project-home-toolbar")
      ).resolves.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "New project" })
      ).not.toBeInTheDocument();

      fireEvent.contextMenu(await screen.findByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      expect(
        screen.queryByRole("menuitem", { name: "New project" })
      ).not.toBeInTheDocument();
    });

    it("opens project creation in the active desktop folder", async () => {
      renderProjects();

      fireEvent.click(await screen.findByText("Client folder"));
      fireEvent.contextMenu(screen.getByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.click(screen.getByRole("menuitem", { name: "New project" }));

      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\/engagement\/new\?attempt=\d+&folderId=folder-client$/
        )
      );
    });

    it("treats the archived collection as read-only instead of offering project creation", async () => {
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        folders: desktopState.folders.map((folder) =>
          folder.id === "folder-client"
            ? { ...folder, name: "Archived" }
            : folder
        ),
      });
      renderProjects();

      fireEvent.click(await screen.findByRole("button", { name: "Archived" }));
      expect(screen.queryByRole("button", { name: "New" })).toBeNull();
      fireEvent.contextMenu(screen.getByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      expect(
        screen.queryByRole("menuitem", { name: "New project" })
      ).toBeNull();
    });
  });

  describe("projectsPage client columns", () => {
    const harbourClient = {
      id: "cmp-client-harbour",
      clientCode: "HBR",
      nameZh: "海港会计",
      nameEn: "Harbour Accounting",
      status: "ACTIVE" as const,
      clientPartnerPic: null,
      clientManagerMic: null,
    };
    const orchidClient = {
      id: "cmp-client-orchid",
      clientCode: "ORC",
      nameZh: "兰花控股",
      nameEn: "Orchid Holdings",
      status: "ACTIVE" as const,
      clientPartnerPic: null,
      clientManagerMic: null,
    };

    function placementWith(
      id: string,
      name: string,
      cmpClient: DesktopState["placements"][number]["project"]["cmpClient"]
    ) {
      const [base] = desktopState.placements;
      return {
        ...base,
        id: `placement-${id}`,
        projectId: `project-${id}`,
        project: {
          ...base.project,
          id: `project-${id}`,
          name,
          projectCode: `AUD-2026-${id}`,
          cmpClientId: cmpClient?.id ?? null,
          cmpClient,
        },
      };
    }

    function mockThreeProjects() {
      mockApi.desktop.mockResolvedValue({
        ...desktopState,
        placements: [
          placementWith("0001", "Harbour audit", harbourClient),
          placementWith("0002", "Orchid audit", orchidClient),
          placementWith("0003", "Unlinked audit", null),
        ],
      });
    }

    it("renders a flat project table with client columns and no client selector", async () => {
      mockThreeProjects();
      renderProjects();

      await waitFor(() =>
        expect(screen.getByText("Harbour audit")).toBeVisible()
      );
      expect(screen.getByText("Orchid audit")).toBeVisible();
      expect(screen.getByText("Unlinked audit")).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Client Code" })
      ).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Client Name" })
      ).toBeVisible();
      expect(screen.getByText("HBR")).toBeVisible();
      expect(screen.getByText("ORC")).toBeVisible();
      expect(screen.getByText("Harbour Accounting")).toBeVisible();
      expect(screen.getByText("Orchid Holdings")).toBeVisible();
      expect(screen.getByText("Unassigned client")).toBeVisible();
    });

    it("exposes each visible non-operation project column through its menu", async () => {
      mockThreeProjects();
      renderProjects();

      await screen.findByText("Harbour audit");
      expect(screen.getByRole("button", { name: "Engagement" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Client Code" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Last opened" })).toBeVisible();
    });

    it("hides Client Code and Client Name columns from display settings", async () => {
      mockThreeProjects();
      renderProjects();

      await screen.findByText("Harbour audit");
      await expect(
        screen.findByRole("columnheader", { name: "Client Code" })
      ).resolves.toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Client Name" })
      ).toBeVisible();

      fireEvent.contextMenu(screen.getByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(
        screen.getByRole("menuitem", { name: "Display settings" })
      );
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Show Client Code" })
      );

      fireEvent.contextMenu(screen.getByTestId("desktop-canvas"), {
        clientX: 220,
        clientY: 180,
      });
      fireEvent.mouseEnter(
        screen.getByRole("menuitem", { name: "Display settings" })
      );
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Show Client Name" })
      );

      expect(
        screen.queryByRole("columnheader", { name: "Client Code" })
      ).toBeNull();
      expect(
        screen.queryByRole("columnheader", { name: "Client Name" })
      ).toBeNull();
      await expect(screen.findByText("Harbour audit")).resolves.toBeVisible();
      expect(
        window.localStorage.getItem("project-wing-home-display-settings")
      ).toContain('"showClientCode":false');
      expect(
        window.localStorage.getItem("project-wing-home-display-settings")
      ).toContain('"showClientName":false');
    });
  });

  function renderProjects() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          ThemeProvider,
          { initialTheme: defaultTheme } as unknown as Parameters<
            typeof ThemeProvider
          >[0],
          createElement(ToastProvider, null, createElement(ProjectsPage))
        )
      )
    );
  }

  function renderProjectsInIconView() {
    window.localStorage.setItem("project-wing-home-view-mode", "icons");
    return renderProjects();
  }

  async function findProjectGridItem(projectId = "project-1") {
    await screen.findByText("Orchid Holdings");
    return await waitFor(() => {
      const card = document.querySelector<HTMLElement>(
        `[data-project-grid-project="${projectId}"]`
      );
      const item = card?.closest<HTMLElement>('[data-slot="sortable-item"]');
      if (!item) {
        throw new Error(`Project grid item ${projectId} was not found`);
      }
      return item;
    });
  }

  function mockCurrentUserAsSuperAdmin() {
    mockApi.me.mockResolvedValue({
      id: "user-admin",
      email: "admin@projectwing.local",
      name: "Admin",
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });
  }

  async function selectScopedOption(
    scope: HTMLElement,
    label: string,
    optionName: string
  ) {
    const combobox = within(scope).getByLabelText(label);
    await selectComboboxOption(combobox, optionName);
  }

  async function selectComboboxOption(
    combobox: HTMLElement,
    optionName: string
  ) {
    await closeOpenSelectPopups();
    await waitFor(() => expect(combobox).not.toBeDisabled());
    fireEvent.pointerDown(combobox);
    fireEvent.mouseDown(combobox);
    fireEvent.click(combobox);
    if (screen.queryAllByRole("listbox").length === 0) {
      fireEvent.keyDown(combobox, { key: "ArrowDown" });
    }
    await waitFor(() =>
      expect(screen.getAllByRole("listbox").length).toBeGreaterThan(0)
    );
    const listboxes = screen.getAllByRole("listbox");
    const listbox = listboxes[listboxes.length - 1];
    fireEvent.click(
      await within(listbox).findByRole("option", { name: optionName })
    );
    await waitFor(() => expect(combobox).toHaveTextContent(optionName));
  }

  async function closeOpenSelectPopups() {
    if (screen.queryAllByRole("listbox").length === 0) {
      return;
    }
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    await waitFor(() =>
      expect(screen.queryAllByRole("listbox")).toHaveLength(0)
    );
  }

  function makePlacement(
    overrides: Omit<
      Partial<(typeof desktopState.placements)[number]>,
      "project"
    > & {
      project?: Partial<(typeof desktopState.placements)[number]["project"]>;
    }
  ) {
    return {
      ...desktopState.placements[0],
      ...overrides,
      project: {
        ...desktopState.placements[0].project,
        ...overrides.project,
      },
    };
  }
});
