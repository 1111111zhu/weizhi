import { ProjectWingThemeProvider } from "@project-wing/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CmpToastProvider } from "../../../components/cmp-toast";
import { CmpI18nProvider } from "../../../i18n/client";
import { CmpClientsClient } from "./page-client";

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

const { apiMocks, routerMocks } = vi.hoisted(() => ({
  apiMocks: {
    cmpClientGroups: vi.fn(),
    cmpClients: vi.fn(),
    cmpUsers: vi.fn(),
    createCmpAcceptance: vi.fn(),
    inboxMessages: vi.fn(),
    listDevelopmentAccounts: vi.fn(),
    markInboxMessageRead: vi.fn(),
    me: vi.fn(),
    updateCmpAcceptance: vi.fn(),
  },
  routerMocks: {
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("../../../api/client", () => ({
  api: apiMocks,
}));

const currentUser = {
  id: "manager-1",
  email: "manager@example.com",
  name: "MIC Manager",
  globalRole: "MANAGER" as const,
};
const users = [
  currentUser,
  {
    id: "partner-1",
    email: "partner@example.com",
    name: "PIC Partner",
    globalRole: "PARTNER" as const,
  },
  {
    id: "staff-1",
    email: "staff@example.com",
    name: "Audit Staff",
    globalRole: "STAFF" as const,
  },
  {
    id: "admin-1",
    email: "admin@example.com",
    name: "IT Admin",
    globalRole: "SUPER_ADMIN" as const,
  },
];

describe("cmpClientsClient new acceptance page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.me.mockResolvedValue(currentUser);
    apiMocks.cmpClientGroups.mockResolvedValue({ groups: [] });
    apiMocks.cmpClients.mockResolvedValue({ clients: [] });
    apiMocks.cmpUsers.mockResolvedValue(users);
    apiMocks.inboxMessages.mockResolvedValue([]);
    apiMocks.listDevelopmentAccounts.mockResolvedValue([]);
    apiMocks.createCmpAcceptance.mockResolvedValue({ id: "request-1" });
    apiMocks.updateCmpAcceptance.mockResolvedValue({ id: "request-1" });
  });

  it("uses the client toolbar title, information badge, search shell, and header actions", async () => {
    renderPage();

    const title = await screen.findByRole("heading", {
      name: "New Client Acceptance",
      level: 1,
    });
    const topbar = screen.getByTestId("cmp-topbar");
    const form = title.closest("form");
    const header = title.closest("header");
    const searchbox = within(topbar).getByRole("searchbox");
    expect(searchbox).toBeInTheDocument();
    expect(within(topbar).queryByText("Client Management")).toBeNull();
    fireEvent.change(searchbox, { target: { value: "not connected" } });
    expect(searchbox).toHaveValue("not connected");
    expect(form).not.toBeNull();
    expect(header).not.toBeNull();
    expect(title).toHaveClass("text-xl", "leading-7", "font-semibold");

    const draftBadge = within(expectPresent(header)).getByText("Draft");
    const titleGroup = title.parentElement;
    const saveButton = within(expectPresent(header)).getByRole("button", {
      name: "Save",
    });
    const actions = expectPresent(header).querySelector(
      ".cmp-form-header-actions"
    );
    expect(draftBadge).toHaveAttribute("data-slot", "badge");
    expect(draftBadge).toHaveClass(
      "rounded-md!",
      "text-foreground",
      "before:bg-info-accent"
    );
    expect(titleGroup).toHaveClass("flex", "min-w-0", "flex-wrap");
    expect(titleGroup).toContainElement(draftBadge);
    expect(titleGroup).toContainElement(saveButton);
    expect(actions).not.toContainElement(saveButton);

    expect(saveButton).toHaveAttribute("data-stateful-motion-button", "true");
    const assignButton = within(expectPresent(header)).getByRole("button", {
      name: "Assign",
    });
    const nextButton = within(expectPresent(header)).getByRole("button", {
      name: "Next",
    });
    expect(assignButton).toBeEnabled();
    expect(assignButton).toHaveAttribute("data-variant", "secondary");
    expect(nextButton).toBeEnabled();
    expect(nextButton).toHaveAttribute("data-variant", "secondary");
    expect(nextButton.textContent).toBe("");
    expect(nextButton.querySelector(".lucide-arrow-right")).toBeInTheDocument();
    const majorStepper = within(expectPresent(form)).getByRole("navigation", {
      name: "Client form sections",
    });
    expect(majorStepper).toHaveClass("flex", "min-w-max");
    expect(majorStepper.parentElement).toHaveClass("overflow-x-auto");
    expect(
      majorStepper.querySelector('[data-slot="stepper-separator"]')
    ).not.toHaveClass("!w-8", "!flex-none");
    expect(majorStepper.querySelector(".lucide-circle-alert")).toBeNull();
    const accordion = expectPresent(form).querySelector(
      '[data-slot="accordion"]'
    );
    expect(accordion).toBeInTheDocument();
    expect(
      expectPresent(accordion).querySelectorAll('[data-slot="accordion-item"]')
    ).toHaveLength(4);
    expect(
      within(accordion as HTMLElement).getByRole("heading", {
        name: "Basic Information",
      })
    ).toBeInTheDocument();
    expect(
      within(accordion as HTMLElement).getByRole("heading", {
        name: "Incorporation",
      })
    ).toBeInTheDocument();
    expect(
      within(accordion as HTMLElement).getByRole("heading", {
        name: "Addresses",
      })
    ).toBeInTheDocument();
    expect(
      within(accordion as HTMLElement).getByRole("heading", {
        name: "Contact Person",
      })
    ).toBeInTheDocument();
    expect(
      within(accordion as HTMLElement).queryByText(
        "English or Chinese name required"
      )
    ).toBeNull();
    expect(
      expectPresent(accordion).querySelectorAll(
        "input[placeholder], textarea[placeholder]"
      )
    ).toHaveLength(0);
    const basicSection = expectPresent(accordion).querySelector<HTMLElement>(
      '[data-acceptance-form-section="basic"]'
    );
    const basicFields = [
      ...expectPresent(basicSection).querySelectorAll<HTMLElement>(
        "[data-validation-field]"
      ),
    ].map((field) => field.dataset.validationField);
    expect(basicFields.indexOf("status")).toBeLessThan(
      basicFields.indexOf("companyNumber")
    );
    expect(basicFields.indexOf("yearEndMonth")).toBeGreaterThan(
      basicFields.indexOf("companyNumber")
    );
    expect(basicFields.indexOf("registeredAddress")).toBeLessThan(
      basicFields.indexOf("referredBy")
    );
    expect(basicFields).not.toContain("contactPerson");
    expect(
      within(accordion as HTMLElement).getByTestId(
        "cmp-client-contact-data-grid"
      )
    ).toBeInTheDocument();
    const basicTrigger = within(accordion as HTMLElement).getByRole("button", {
      name: /Client Information/,
    });
    expect(basicTrigger).toHaveAttribute("aria-expanded", "true");
    const registrationTrigger = within(accordion as HTMLElement).getByRole(
      "button",
      {
        name: /Group Relationships/,
      }
    );
    expect(registrationTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(registrationTrigger);
    expect(basicTrigger).toHaveAttribute("aria-expanded", "false");
    expect(registrationTrigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(registrationTrigger);
    expect(registrationTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(
      within(majorStepper).getByRole("tab", {
        name: /2\. Group Relationships/,
      })
    );
    await waitFor(() =>
      expect(registrationTrigger).toHaveAttribute("aria-expanded", "true")
    );
    const basicStep = within(majorStepper).getByRole("tab", {
      name: /1\. Client Information/,
    });
    expect(basicStep.querySelector(".lucide-circle-alert")).toBeInTheDocument();
    expect(basicStep.querySelector(".lucide-check")).toBeNull();
    const currentStep = within(majorStepper).getByRole("tab", {
      name: /2\. Group Relationships/,
    });
    const futureStep = within(majorStepper).getByRole("tab", {
      name: /4\. Responsible Persons & Services/,
    });
    expect(currentStep.querySelector(".lucide-circle-alert")).toBeNull();
    expect(futureStep.querySelector(".lucide-circle-alert")).toBeNull();
    expect(
      within(majorStepper).getByRole("tab", { name: /3\. AML screening/i })
    ).toBeInTheDocument();

    fireEvent.click(
      within(majorStepper).getByRole("tab", { name: /5\. Preview/ })
    );
    const previewAccordion = await waitFor(() => {
      const currentAccordion = expectPresent(form).querySelector<HTMLElement>(
        '[data-slot="accordion"]'
      );
      expect(
        currentAccordion?.querySelectorAll('[data-slot="accordion-item"]')
      ).toHaveLength(1);
      return expectPresent(currentAccordion);
    });
    expect(
      within(previewAccordion).getByRole("button", {
        name: /Preview Incomplete/,
      })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(previewAccordion).queryByRole("button", { name: "Edit" })
    ).toBeNull();
    expect(
      within(previewAccordion).queryByText(/required items missing/i)
    ).toBeNull();
    expect(
      within(expectPresent(form)).queryByRole("heading", {
        name: "Basic client information",
      })
    ).toBeNull();
    expect(
      within(expectPresent(form)).queryByText("7 required items missing")
    ).toBeNull();
    expect(
      within(expectPresent(form)).queryByText(
        "Registered, principal business, and optional additional addresses."
      )
    ).toBeNull();
    expect(
      within(expectPresent(form)).queryByRole("heading", {
        name: "Contact Person",
      })
    ).toBeNull();
    expect(
      within(expectPresent(form)).queryByRole("heading", {
        name: "Additional Addresses",
      })
    ).toBeNull();
    expect(
      expectPresent(form).querySelector('[data-slot="frame"]')
    ).toHaveClass("cmp-form-workspace-frame");
    expect(
      expectPresent(form).querySelector('[data-slot="frame-panel"]')
    ).toHaveClass("cmp-form-workspace-frame-panel");
    expect(expectPresent(form).querySelector(".cmp-form-actions")).toBeNull();
    expect(
      within(expectPresent(form)).queryByText(/required fields/i)
    ).toBeNull();
    expect(expectPresent(form).querySelector("progress")).toBeNull();

    fireEvent.change(
      within(expectPresent(header)).getByLabelText("Draft name"),
      {
        target: { value: "Client acceptance draft" },
      }
    );
    await waitFor(() =>
      expect(apiMocks.createCmpAcceptance).toHaveBeenCalledWith(
        expect.objectContaining({
          micApproverId: "manager-1",
          submit: false,
        })
      )
    );
    const savedButton = await within(expectPresent(header)).findByRole(
      "button",
      {
        name: "Saved",
      }
    );
    expect(savedButton).toBeEnabled();

    fireEvent.mouseEnter(savedButton);
    const manualSaveButton = within(expectPresent(header)).getByRole("button", {
      name: "Save",
    });
    fireEvent.click(manualSaveButton);
    fireEvent.mouseLeave(manualSaveButton);
    await waitFor(() =>
      expect(apiMocks.updateCmpAcceptance).toHaveBeenCalledWith(
        "request-1",
        expect.objectContaining({ submit: false })
      )
    );
    await within(expectPresent(header)).findByRole("button", { name: "Saved" });

    fireEvent.click(assignButton);
    const assignDialog = await screen.findByRole("dialog");
    const empMemberPicker = assignDialog.closest<HTMLElement>(
      "[data-emp-settings-member-dialog]"
    );
    expect(empMemberPicker).toHaveClass(
      "h-[80dvh]!",
      "w-auto!",
      "min-w-[min(48rem,calc(100vw-2rem))]!",
      "max-w-[calc(100vw-2rem)]!",
      "rounded-[10px]",
      "bg-popover",
      "p-0"
    );
    expect(empMemberPicker?.className).not.toContain("cmp-");
    expect(
      within(assignDialog).getByRole("heading", { name: "Assign to" })
    ).toBeInTheDocument();
    expect(within(assignDialog).getByText("Assign to ...")).toBeInTheDocument();
    expect(within(assignDialog).queryByRole("navigation")).toBeNull();
    expect(assignDialog.querySelector("footer")).toBeNull();
    expect(
      within(assignDialog).queryByRole("combobox", { name: "Assign to" })
    ).toBeNull();
    expect(within(assignDialog).getByText("Audit Staff")).toBeInTheDocument();
    expect(within(assignDialog).queryByText("MIC Manager")).toBeNull();
    expect(within(assignDialog).queryByText("PIC Partner")).toBeNull();
    expect(within(assignDialog).queryByText("IT Admin")).toBeNull();
    expect(
      within(assignDialog).getByRole("table", { name: "Assign to" })
    ).toBeInTheDocument();
    expect(
      within(assignDialog).getByRole("columnheader", { name: "Member" })
    ).toBeInTheDocument();
    expect(
      within(assignDialog).getByRole("columnheader", { name: "Rank" })
    ).toBeInTheDocument();
    fireEvent.change(
      within(assignDialog).getByRole("searchbox", { name: "Search members" }),
      {
        target: { value: "staff@example.com" },
      }
    );
    fireEvent.click(
      within(assignDialog).getByRole("button", { name: "Assign Audit Staff" })
    );
    await waitFor(() =>
      expect(apiMocks.updateCmpAcceptance).toHaveBeenLastCalledWith(
        "request-1",
        expect.objectContaining({
          draftAssigneeId: "staff-1",
          submit: false,
        })
      )
    );
    const assignedButton = within(expectPresent(header)).getByRole("button", {
      name: "Assigned to Audit Staff",
    });
    expect(assignedButton).toBeInTheDocument();
    expect(
      within(assignedButton).getByRole("img", { name: "Audit Staff" })
    ).toHaveClass("project-wing-top-bar-avatar--xs");
  });

  it("opens a searchable Manager picker before a Partner submits to MIC", async () => {
    apiMocks.me.mockResolvedValue(users[1]);
    renderPage();

    const formTitle = await screen.findByRole("heading", {
      name: "New Client Acceptance",
      level: 1,
    });
    const form = formTitle.closest("form");
    const header = formTitle.closest("header");
    const stepper = within(expectPresent(form)).getByRole("navigation", {
      name: "Client form sections",
    });
    fireEvent.click(within(stepper).getByRole("tab", { name: /5\. Preview/ }));
    fireEvent.click(
      await within(expectPresent(header)).findByRole("button", {
        name: "Submit to MIC",
      })
    );

    const submitDialog = await screen.findByRole("dialog");
    expect(
      within(submitDialog).getByRole("heading", { name: "Submit to" })
    ).toBeInTheDocument();
    expect(within(submitDialog).getByText("Submit to ...")).toBeInTheDocument();
    expect(within(submitDialog).getByText("MIC Manager")).toBeInTheDocument();
    expect(within(submitDialog).queryByText("Audit Staff")).toBeNull();
    expect(within(submitDialog).queryByText("PIC Partner")).toBeNull();
    expect(within(submitDialog).queryByText("IT Admin")).toBeNull();
    fireEvent.change(
      within(submitDialog).getByRole("searchbox", { name: "Search members" }),
      {
        target: { value: "manager@example.com" },
      }
    );
    expect(
      within(submitDialog).getByRole("button", {
        name: "Submit MIC Manager",
      })
    ).toBeEnabled();
  });

  it("does not auto-save again after assigning the draft to Staff", async () => {
    apiMocks.updateCmpAcceptance
      .mockResolvedValueOnce({ id: "request-1", status: "STAFF_EDITING" })
      .mockRejectedValue(new Error("Only the assigned Staff user can edit"));
    renderPage();
    fireEvent.change(await screen.findByLabelText("Draft name"), {
      target: { value: "Assigned client draft" },
    });

    await waitFor(() =>
      expect(apiMocks.createCmpAcceptance).toHaveBeenCalledOnce()
    );
    fireEvent.click(await screen.findByRole("button", { name: "Assign" }));
    const assignDialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(assignDialog).getByRole("button", { name: "Assign Audit Staff" })
    );

    await waitFor(() =>
      expect(apiMocks.updateCmpAcceptance).toHaveBeenCalledOnce()
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 300);
      });
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 750);
    });

    expect(apiMocks.updateCmpAcceptance).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("Could not save client acceptance")
    ).not.toBeInTheDocument();
  });

  it("rolls back a failed Staff assignment without auto-save retry", async () => {
    apiMocks.updateCmpAcceptance.mockRejectedValue(
      new Error("Unable to assign draft")
    );
    renderPage();
    fireEvent.change(await screen.findByLabelText("Draft name"), {
      target: { value: "Failed assignment" },
    });

    await waitFor(() =>
      expect(apiMocks.createCmpAcceptance).toHaveBeenCalledOnce()
    );
    await screen.findByRole("button", { name: "Saved" });
    fireEvent.click(await screen.findByRole("button", { name: "Assign" }));
    const assignDialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(assignDialog).getByRole("button", { name: "Assign Audit Staff" })
    );

    await waitFor(() =>
      expect(apiMocks.updateCmpAcceptance).toHaveBeenCalledWith(
        "request-1",
        expect.objectContaining({
          draftAssigneeId: "staff-1",
          submit: false,
        })
      )
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 300);
      });
    });
    await screen.findByRole("button", { name: "Assign" });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 750);
    });

    expect(apiMocks.updateCmpAcceptance).toHaveBeenCalledOnce();
  });

  it("does not retry an unchanged failed auto-save", async () => {
    apiMocks.updateCmpAcceptance.mockRejectedValue(
      new Error("Unable to save draft")
    );
    renderPage();
    fireEvent.change(await screen.findByLabelText("Draft name"), {
      target: { value: "Retry prevention" },
    });

    await waitFor(() =>
      expect(apiMocks.createCmpAcceptance).toHaveBeenCalledOnce()
    );
    fireEvent.change(screen.getByLabelText("Client Code"), {
      target: { value: "C-UPDATED" },
    });
    await waitFor(() =>
      expect(apiMocks.updateCmpAcceptance).toHaveBeenCalledOnce()
    );
    await screen.findByText("Could not save client acceptance");
    await new Promise((resolve) => {
      window.setTimeout(resolve, 1250);
    });

    expect(apiMocks.updateCmpAcceptance).toHaveBeenCalledOnce();
  });

  it("auto-saves a changed Partner draft without choosing an MIC", async () => {
    apiMocks.me.mockResolvedValue(users[1]);
    renderPage();

    await screen.findByRole("heading", {
      name: "New Client Acceptance",
      level: 1,
    });
    expect(apiMocks.createCmpAcceptance).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText("Draft name"), {
      target: { value: "Partner client draft" },
    });

    fireEvent.change(screen.getByLabelText("Client Code"), {
      target: { value: "C-DRAFT" },
    });

    await waitFor(() =>
      expect(apiMocks.createCmpAcceptance).toHaveBeenCalledWith(
        expect.objectContaining({
          clientPayload: expect.objectContaining({ clientCode: "C-DRAFT" }),
          micApproverId: undefined,
          picApproverId: undefined,
          itApproverId: undefined,
          submit: false,
        })
      )
    );
    await screen.findByRole("button", { name: "Saved" }, { timeout: 15_000 });
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectWingThemeProvider>
        <CmpI18nProvider initialLocale="en-US">
          <CmpToastProvider>
            <CmpClientsClient formMode="new" />
          </CmpToastProvider>
        </CmpI18nProvider>
      </ProjectWingThemeProvider>
    </QueryClientProvider>
  );
}
