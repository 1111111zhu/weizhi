import { readFileSync } from "node:fs";

import { ProjectWingThemeProvider } from "@project-wing/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { CmpI18nProvider } from "../i18n/client";
import type { CmpLocale } from "../i18n/client";
import { CmpAppShell } from "./cmp-app-shell";

const { routerBack, routerPush, routerPrefetch, routerRefresh } = vi.hoisted(
  () => ({
    routerBack: vi.fn(),
    routerPush: vi.fn(),
    routerPrefetch: vi.fn(),
    routerRefresh: vi.fn(),
  })
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: routerBack,
    push: routerPush,
    prefetch: routerPrefetch,
    refresh: routerRefresh,
  }),
}));

vi.mock("../api/client", () => ({
  api: {
    workItems: vi.fn(),
    inboxMessages: vi.fn(),
    markInboxMessageRead: vi.fn(),
    markInboxMessageUnread: vi.fn(),
    cmpUsers: vi.fn(),
    cmpClients: vi.fn(),
    cmpAcceptance: vi.fn(),
    cmpApprovals: vi.fn(),
    cmpSettingsExchangeRates: vi.fn(),
    refreshCmpSettingsExchangeRates: vi.fn(),
    cmpBillingTemplates: vi.fn(),
    createCmpBillingFirmTemplate: vi.fn(),
    updateCmpBillingFirmTemplate: vi.fn(),
    deactivateCmpBillingFirmTemplate: vi.fn(),
    cmpAmlConfiguration: vi.fn(),
    updateCmpAmlConfiguration: vi.fn(),
    disableCmpAmlConfiguration: vi.fn(),
    listDevelopmentAccounts: vi.fn(),
    impersonateDevelopmentAccount: vi.fn(),
  },
}));

const user = {
  id: "user-1",
  email: "manager@example.com",
  name: "Wing Lau",
  globalRole: "MANAGER" as const,
};

describe(CmpAppShell, () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
    document.cookie = "project-wing-theme-flavor=; path=/; max-age=0";
    document.cookie = "project-wing-font-size=; path=/; max-age=0";
    vi.clearAllMocks();
    vi.mocked(api.workItems).mockResolvedValue({
      items: [],
      categories: [],
      counts: { total: 0, EMP: 0, PROJECT: 0, CMP: 0, TMS: 0, OPS: 0 },
    });
    vi.mocked(api.inboxMessages).mockResolvedValue([]);
    vi.mocked(api.markInboxMessageRead).mockResolvedValue({
      id: "message-1",
      recipientId: "user-1",
      senderId: null,
      type: "SYSTEM_NOTIFICATION",
      title: "Read",
      body: "",
      actionUrl: "/cmp/acceptance",
      readAt: "2026-07-09T00:00:00.000Z",
      createdAt: "2026-07-09T00:00:00.000Z",
    });
    vi.mocked(api.markInboxMessageUnread).mockResolvedValue({
      id: "message-1",
      recipientId: "user-1",
      senderId: null,
      type: "SYSTEM_NOTIFICATION",
      title: "Unread",
      body: "",
      actionUrl: "/cmp/acceptance",
      readAt: null,
      createdAt: "2026-07-09T00:00:00.000Z",
    });
    vi.mocked(api.cmpUsers).mockResolvedValue([]);
    vi.mocked(api.cmpClients).mockResolvedValue({ clients: [] });
    vi.mocked(api.cmpAcceptance).mockResolvedValue({ requests: [] });
    vi.mocked(api.cmpApprovals).mockResolvedValue({ requests: [] });
    vi.mocked(api.cmpSettingsExchangeRates).mockResolvedValue({
      batch: {
        id: "rate-batch-1",
        baseCurrency: "HKD",
        provider: "HKMA_DAILY",
        sourceDate: "2026-08-28",
        sourceUrl: "https://apidocs.hkma.gov.hk/",
        fetchedAt: "2026-08-28T08:00:00.000Z",
        refreshedBy: { id: "user-1", name: "Wing Lau" },
        stale: false,
      },
      rates: [
        {
          id: "rate-hkd",
          currency: "HKD",
          hkdPerUnit: "1.00000000",
          periodStart: null,
          periodEnd: null,
          fetchedAt: "2026-08-28T08:00:00.000Z",
          stale: false,
        },
        {
          id: "rate-cny",
          currency: "CNY",
          hkdPerUnit: "1.12000000",
          periodStart: "2026-08-28",
          periodEnd: "2026-08-28",
          fetchedAt: "2026-08-28T08:00:00.000Z",
          stale: false,
        },
        {
          id: "rate-usd",
          currency: "USD",
          hkdPerUnit: "7.80000000",
          periodStart: "2026-08-28",
          periodEnd: "2026-08-28",
          fetchedAt: "2026-08-28T08:00:00.000Z",
          stale: false,
        },
      ],
      canRefresh: true,
    });
    vi.mocked(api.refreshCmpSettingsExchangeRates).mockResolvedValue({
      batch: {
        id: "rate-batch-1",
        baseCurrency: "HKD",
        provider: "HKMA_DAILY",
        sourceDate: "2026-08-28",
        sourceUrl: "https://apidocs.hkma.gov.hk/",
        fetchedAt: "2026-08-28T08:00:00.000Z",
        refreshedBy: { id: "user-1", name: "Wing Lau" },
        stale: false,
      },
      rates: [
        {
          id: "rate-hkd",
          currency: "HKD",
          hkdPerUnit: "1.00000000",
          periodStart: null,
          periodEnd: null,
          fetchedAt: "2026-08-28T08:00:00.000Z",
          stale: false,
        },
        {
          id: "rate-cny",
          currency: "CNY",
          hkdPerUnit: "1.12000000",
          periodStart: "2026-08-28",
          periodEnd: "2026-08-28",
          fetchedAt: "2026-08-28T08:00:00.000Z",
          stale: false,
        },
        {
          id: "rate-usd",
          currency: "USD",
          hkdPerUnit: "7.80000000",
          periodStart: "2026-08-28",
          periodEnd: "2026-08-28",
          fetchedAt: "2026-08-28T08:00:00.000Z",
          stale: false,
        },
      ],
      canRefresh: true,
    });
    vi.mocked(api.cmpBillingTemplates).mockResolvedValue({
      canManage: true,
      firmTemplates: [
        {
          id: "firm-1",
          version: 1,
          status: "ACTIVE",
          createdAt: "2026-09-02T08:00:00.000Z",
          updatedAt: "2026-09-02T08:00:00.000Z",
          name: "Firm One",
          firmLegalNameZh: "事务所一",
          firmLegalNameEn: "Firm One Limited",
          firmAddressZh: "香港",
          firmAddressEn: "Hong Kong",
          phone: "12345678",
          email: "firm@example.com",
          website: "https://example.com",
          isDefault: true,
        },
      ],
      bankTemplates: [],
    });
    vi.mocked(api.createCmpBillingFirmTemplate).mockResolvedValue({
      id: "firm-new",
    } as never);
    vi.mocked(api.updateCmpBillingFirmTemplate).mockResolvedValue({
      id: "firm-1",
    } as never);
    vi.mocked(api.deactivateCmpBillingFirmTemplate).mockResolvedValue({
      id: "firm-1",
    } as never);
    vi.mocked(api.cmpAmlConfiguration).mockResolvedValue({
      enabled: false,
      configured: false,
      source: null,
      updatedAt: null,
      updatedBy: null,
    });
    vi.mocked(api.updateCmpAmlConfiguration).mockResolvedValue({
      enabled: true,
      configured: true,
      source: "DATABASE",
      updatedAt: "2026-09-02T08:00:00.000Z",
      updatedBy: { id: "admin-1", name: "Admin" },
    });
    vi.mocked(api.disableCmpAmlConfiguration).mockResolvedValue({
      enabled: false,
      configured: false,
      source: null,
      updatedAt: "2026-09-02T08:01:00.000Z",
      updatedBy: { id: "admin-1", name: "Admin" },
    });
    vi.mocked(api.listDevelopmentAccounts).mockReturnValue(
      new Promise(() => {})
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the fixed English CMP brand without a page title", () => {
    renderWithClient(
      <CmpAppShell activeSection="clients" user={user} onSignOut={() => {}}>
        <div>Dashboard content</div>
      </CmpAppShell>
    );

    const topbar = screen.getByTestId("cmp-topbar");
    expect(
      topbar.querySelector('[data-slot="constrained-expandable-action-bar"]')
    ).toBeInTheDocument();
    expect(
      topbar.querySelector(".project-wing-top-bar-brand-copy")
    ).toBeInTheDocument();
    expect(
      Array.from(
        topbar.querySelectorAll(".project-wing-top-bar-brand-line"),
        (line) => line.textContent
      )
    ).toStrictEqual(["Client", "Management", "Portal"]);
  });

  it("uses the shared EMP topbar search shell", () => {
    renderWithClient(
      <CmpAppShell
        activeSection="clients"
        user={user}
        onSignOut={() => {}}
        searchValue=""
        onSearchChange={() => {}}
      >
        <div>Dashboard content</div>
      </CmpAppShell>
    );

    const searchbox = screen.getByRole("searchbox");
    expect(searchbox.closest(".project-wing-top-bar-search")).toBeTruthy();
    expect(searchbox).toHaveAttribute(
      "placeholder",
      searchbox.getAttribute("aria-label")
    );
    expect(
      screen
        .getByTestId("cmp-topbar")
        .querySelector(".project-wing-top-bar-search-icon")
    ).toBeTruthy();

    const sharedStyles = readFileSync(
      "../../packages/ui/src/styles.css",
      "utf-8"
    );
    expect(sharedStyles).toMatch(
      /\.project-wing-top-bar-search > \[data-slot="input-group-control"\][\s\S]*outline:\s*none;/
    );
    expect(sharedStyles).toMatch(
      /\[data-slot="expandable-action-bar"\]\[data-size="sm"\][\s\S]*\[data-slot="expandable-action-bar-track"\][\s\S]*height:\s*2rem;[\s\S]*gap:\s*0\.125rem;[\s\S]*padding:\s*0\.125rem;/
    );
    expect(sharedStyles).toMatch(
      /\[data-slot="expandable-action-bar-highlight"\][\s\S]*background:\s*color-mix\(in oklab, var\(--primary\) 7%, transparent\);/
    );

    const cmpStyles = readFileSync("src/app/styles.css", "utf-8");
    expect(cmpStyles).toMatch(
      /button,\s*input,\s*select,\s*textarea,\s*option,\s*optgroup\s*\{\s*font:\s*inherit;\s*\}/
    );
  });

  it("places CMP work items in the former inbox position", () => {
    renderWithClient(
      <CmpAppShell activeSection="clients" user={user} onSignOut={() => {}}>
        <div>Dashboard content</div>
      </CmpAppShell>
    );

    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    const topbar = screen.getByTestId("cmp-topbar");
    const expectedOrder = [
      "Intranet",
      "Client",
      "Engagement",
      "Acceptance",
      "CMP work items",
    ];
    const orderedLabels = within(topbar)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
      .filter((label): label is string => expectedOrder.includes(label ?? ""));
    expect(orderedLabels).toStrictEqual(expectedOrder);
    const engagementButton = within(topbar).getByRole("button", {
      name: "Engagement",
    });
    fireEvent.mouseEnter(engagementButton);
    expect(
      engagementButton.querySelector(
        '[data-slot="expandable-action-bar-highlight"]'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Approvals")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Back to ProjectWing \/ EMP/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Intranet" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(
      screen.getByRole("button", { name: "CMP work items" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Setting" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Account menu" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("expandable-action-bar")).toBeInTheDocument();
    expect(screen.getByTestId("expandable-action-bar")).toHaveAttribute(
      "data-size",
      "sm"
    );
    expect(
      screen
        .getByTestId("expandable-action-bar")
        .querySelector('[data-slot="expandable-action-bar-track"]')
    ).toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("returns to the actual previous browser page from the arrow-only button", async () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    window.sessionStorage.setItem(
      "project-wing:cmp:action-history",
      JSON.stringify([{ id: "acceptance", href: "/acceptance" }])
    );

    renderWithClient(
      <CmpAppShell activeSection="clients" user={user} onSignOut={() => {}}>
        <div>Client content</div>
      </CmpAppShell>
    );

    const returnButton = await screen.findByRole("button", {
      name: "Back to Acceptance",
    });
    expect(returnButton).toHaveTextContent("");
    expect(returnButton).toHaveAttribute("data-size", "icon");
    expect(returnButton).toHaveClass("cmp-top-bar-return-action");
    expect(returnButton.querySelectorAll("svg")).toHaveLength(1);
    expect(
      returnButton.querySelector(
        '[data-slot="project-wing-top-bar-return-destination"]'
      )
    ).toBeNull();
    fireEvent.click(returnButton);
    expect(routerBack).toHaveBeenCalledOnce();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("uses CMP action history when a direct entry has no browser history", async () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    window.sessionStorage.setItem(
      "project-wing:cmp:action-history",
      JSON.stringify([{ id: "acceptance", href: "/acceptance" }])
    );

    renderWithClient(
      <CmpAppShell activeSection="clients" user={user} onSignOut={() => {}}>
        <div>Client content</div>
      </CmpAppShell>
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Back to Acceptance" })
    );
    expect(routerBack).not.toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith("/en-US/acceptance");
  });

  it("opens CMP work items on the right and closes them before settings", async () => {
    vi.mocked(api.workItems).mockResolvedValue({
      items: [
        {
          id: "CMP-004:request-1",
          ruleId: "CMP-004",
          domain: "CMP",
          view: "PERSONAL",
          category: "ACCEPTANCE",
          state: "OPEN",
          severity: "ACTION_REQUIRED",
          priority: "HIGH",
          title: "Acceptance requires PIC approval",
          description: "Orchid Technology Limited",
          subjectType: "CMP_ACCEPTANCE",
          subjectId: "request-1",
          reference: "CA-001",
          objectLabel: "Orchid Technology Limited",
          responsibleLabel: "Wing Lau",
          assignedTo: {
            id: "user-1",
            name: "Wing Lau",
            email: "manager@example.com",
          },
          createdBy: null,
          dueAt: null,
          openedAt: "2026-08-31T08:00:00.000Z",
          updatedAt: "2026-08-31T08:00:00.000Z",
          project: null,
          actionTarget: {
            app: "CMP",
            resourceType: "CMP_ACCEPTANCE",
            resourceId: "request-1",
            params: { requestId: "request-1" },
          },
        },
      ],
      categories: [],
      counts: { total: 1, EMP: 0, PROJECT: 0, CMP: 1, TMS: 0, OPS: 0 },
    });
    renderWithClient(
      <CmpAppShell activeSection="clients" user={user} onSignOut={() => {}}>
        <div>Dashboard content</div>
      </CmpAppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "CMP work items" }));
    const workItems = await screen.findByRole("dialog", {
      name: "CMP work items",
    });
    expect(workItems).toHaveAttribute("aria-modal", "false");
    expect(
      within(workItems).getByRole("slider", {
        name: "Resize CMP work item sidebar",
      })
    ).toBeInTheDocument();
    await expect(
      screen.findByText("Acceptance requires PIC approval")
    ).resolves.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Setting" }));
    expect(
      screen.queryByRole("dialog", { name: "CMP work items" })
    ).not.toBeInTheDocument();
    const settings = screen.getByRole("dialog", { name: "Setting" });
    expect(settings).toBeInTheDocument();
    expect(settings).toHaveClass("h-[80dvh]");
    expect(settings.closest("header")).toBeNull();
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Font size")).toBeInTheDocument();
    expect(
      within(settings).getByRole("button", { name: "Personal" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Compact tables")).not.toBeInTheDocument();
    expect(screen.queryByText("Theme color")).not.toBeInTheDocument();
  });

  it("shows exchange rates as a settings page and lets finance users request a refresh", async () => {
    renderWithClient(
      <CmpAppShell activeSection="clients" user={user} onSignOut={() => {}}>
        <div>Dashboard content</div>
      </CmpAppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Setting" }));
    fireEvent.click(screen.getByRole("button", { name: "Exchange rates" }));

    const dialog = await screen.findByRole("dialog", { name: "Setting" });
    expect(within(dialog).getByText("CNY")).toBeInTheDocument();
    expect(within(dialog).getByText("1 unit = HKD")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Hong Kong Monetary Authority daily rates/)
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Update rates" })
    );
    await waitFor(() =>
      expect(api.refreshCmpSettingsExchangeRates).toHaveBeenCalledOnce()
    );
  });

  it("persists CMP personal appearance settings", () => {
    const { container } = renderWithClient(
      <CmpAppShell activeSection="clients" user={user} onSignOut={() => {}}>
        <div>Dashboard content</div>
      </CmpAppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Setting" }));
    fireEvent.click(screen.getByRole("tab", { name: "Night" }));
    fireEvent.click(screen.getByRole("tab", { name: "Large" }));
    fireEvent.click(screen.getByRole("tab", { name: "简" }));

    expect(window.localStorage.getItem("cmp-language")).toBe("zh-CN");
    expect(document.cookie).toContain("project-wing-theme-flavor=mocha");
    expect(document.cookie).toContain("project-wing-font-size=lg");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(container.firstElementChild).toHaveClass("is-night");
    expect(document.documentElement).toHaveClass("font-size-lg");
  });

  it("shows AML configuration only to Super Admin and clears the entered key after save", async () => {
    renderWithClient(
      <CmpAppShell
        activeSection="clients"
        user={{ ...user, globalRole: "SUPER_ADMIN" }}
        onSignOut={() => {}}
      >
        <div>Dashboard content</div>
      </CmpAppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Setting" }));
    fireEvent.click(screen.getByRole("button", { name: "AML configuration" }));
    const keyInput = await screen.findByLabelText("API key");
    fireEvent.change(keyInput, { target: { value: "test-api-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save API key" }));

    await waitFor(() =>
      expect(api.updateCmpAmlConfiguration).toHaveBeenCalledOnce()
    );
    expect(vi.mocked(api.updateCmpAmlConfiguration).mock.calls[0]?.[0]).toBe(
      "test-api-key"
    );
    expect(keyInput).toHaveValue("");
    expect(screen.getByText("Configured")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Disable AML" }));
    await waitFor(() =>
      expect(api.disableCmpAmlConfiguration).toHaveBeenCalledOnce()
    );
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  it("loads billing templates only after the manager opens the template page and supports template actions", async () => {
    renderWithClient(
      <CmpAppShell activeSection="clients" user={user} onSignOut={() => {}}>
        <div>Dashboard content</div>
      </CmpAppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Setting" }));
    expect(api.cmpBillingTemplates).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Billing templates" }));
    await screen.findByText("Firm One");
    expect(api.cmpBillingTemplates).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "New firm template" }));
    fireEvent.change(screen.getByLabelText("Template name"), {
      target: { value: "Firm Two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() =>
      expect(api.createCmpBillingFirmTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Firm Two" })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() =>
      expect(api.updateCmpBillingFirmTemplate).toHaveBeenCalledWith(
        "firm-1",
        expect.objectContaining({ name: "Firm One", expectedVersion: 1 })
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() =>
      expect(api.deactivateCmpBillingFirmTemplate).toHaveBeenCalledWith(
        "firm-1",
        { expectedVersion: 1 }
      )
    );
  });

  it("uses a single-column shell without a reserved sidebar track", () => {
    const styles = readFileSync("src/app/styles.css", "utf-8");

    expect(styles).toMatch(
      /\.cmp-shell-body\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/
    );
  });

  it("keeps the top bar compact while the page body fills the remaining height", () => {
    const styles = readFileSync("src/app/styles.css", "utf-8");

    expect(styles).toMatch(
      /\.cmp-shell\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);/
    );
    expect(styles).toMatch(
      /\.cmp-clients-workspace\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\);/
    );
  });

  it("keeps raw CMP colors behind the public token boundary", () => {
    const styles = readFileSync("src/app/styles.css", "utf-8");
    const publicStyles = readFileSync(
      "../../packages/ui/src/styles.css",
      "utf-8"
    );
    const cssRgb = (channels: string) =>
      `${["r", "g", "b"].join("")}(${channels})`;
    const hex = (channels: string) => ["#", channels].join("");
    const expectedTokens = [
      ["shadow-black", cssRgb("0 0 0")],
      ["shadow-deep", cssRgb("2 6 23")],
      ["shadow-ink", cssRgb("15 23 42")],
      ["login-geometry", cssRgb("0 129 56 / 2.5%")],
      ["login-principle-border", cssRgb("0 129 56 / 15%")],
      ["login-principle-surface", cssRgb("0 129 56 / 6%")],
      ["login-principle-shadow", cssRgb("23 32 51 / 5%")],
      ["login-secure-border", cssRgb("0 129 56 / 20%")],
      ["login-secure-surface", cssRgb("0 129 56 / 10%")],
      ["login-title-border", cssRgb("0 129 56 / 10%")],
      ["login-title-surface", cssRgb("0 129 56 / 4.5%")],
      ["login-title-shadow", cssRgb("0 129 56 / 5%")],
      ["login-action", hex("006b3f")],
      ["login-action-shadow", cssRgb("0 107 63 / 18%")],
      ["login-action-hover", hex("007a48")],
      ["login-action-hover-shadow", cssRgb("0 107 63 / 24%")],
      ["login-focus-ring", cssRgb("0 129 56 / 16%")],
      ["login-option-surface", cssRgb("246 247 249 / 70%")],
      ["login-portal-border", cssRgb("255 255 255 / 50%")],
      ["success", hex("15803d")],
      ["approval-returned-border", hex("cf7474")],
      ["approval-returned-surface", hex("fff0f0")],
      ["approval-returned-foreground", hex("8a2424")],
      ["approval-active-border", hex("c59e2e")],
    ] as const;

    expect(styles).not.toMatch(
      /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|color)\s*\(/i
    );
    expect(styles.match(/var\(\s*--project-wing-cmp-/g)).toHaveLength(28);
    expect(expectedTokens).toHaveLength(24);

    for (const [name, value] of expectedTokens) {
      expect(publicStyles).toContain(`--project-wing-cmp-${name}: ${value};`);
    }
    expect(
      styles.match(/var\(--cmp-shadow-(?:black|deep|ink)\)/g)
    ).toHaveLength(36);
  });

  it("keeps full-page wizard actions on the bottom row", () => {
    const styles = readFileSync("src/app/styles.css", "utf-8");

    expect(styles).toMatch(
      /\.cmp-form-wizard-workspace\s*>\s*\.cmp-form-actions\s*\{[^}]*grid-row:\s*4;/
    );
    const modalLayer = styles.match(
      /\.cmp-engagements-workspace:has\(\.cmp-modal-backdrop\),\s*\.cmp-acceptance-workspace:has\(\.cmp-modal-backdrop\)\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*(\d+);/
    );
    const sharedStyles = readFileSync(
      "../../packages/ui/src/styles.css",
      "utf-8"
    );
    const headerLayer = sharedStyles.match(
      /\.project-wing-top-bar\s*\{[^}]*z-index:\s*(\d+);/
    );
    expect(modalLayer).not.toBeNull();
    expect(headerLayer).not.toBeNull();
    expect(Number(modalLayer?.[1])).toBeGreaterThan(Number(headerLayer?.[1]));
  });

  it("provides consistent workspace and interaction motion with a reduced-motion fallback", () => {
    const styles = readFileSync("src/app/styles.css", "utf-8");

    expect(styles).toMatch(
      /\.cmp-dashboard,\s*\.cmp-clients-workspace,\s*\.cmp-engagements-workspace,\s*\.cmp-acceptance-workspace\s*\{[^}]*animation:\s*cmp-workspace-enter/
    );
    expect(styles).toMatch(
      /@keyframes cmp-workspace-enter\s*\{\s*from\s*\{\s*opacity:\s*0;\s*\}\s*to\s*\{\s*opacity:\s*1;\s*\}/
    );
    expect(styles).toMatch(
      /\.cmp-shell-body :where\(\[data-slot="button"\]\):active:not\(:disabled\)[^{]*\{[^}]*scale\(0\.985\)/
    );
    expect(styles).not.toMatch(/^:where\(\[data-slot="button"\]\)/m);
    expect(styles).toMatch(
      /\.cmp-icon-button:hover:not\(:disabled\):not\(\.cmp-sidebar-toggle\)/
    );
    expect(styles).toMatch(
      /\.cmp-icon-button:active:not\(:disabled\):not\(\.cmp-sidebar-toggle\)/
    );
    expect(styles).toMatch(
      /\.cmp-filter-collapse\.is-open \.cmp-client-filter-panel\s*\{[^}]*animation:\s*cmp-client-filter-panel-enter/
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*animation-duration:\s*0\.01ms !important;/
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\.cmp-client-list-table-wrap\.cmp-results-settle/
    );
  });

  it("keeps billing permission-gated in mobile navigation", async () => {
    const viewport = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query) => ({
        matches: query.includes("767"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    try {
      renderWithClient(
        <CmpAppShell
          activeSection="clients"
          user={{ ...user, globalRole: "STAFF" }}
          onSignOut={() => {}}
        >
          <div>Clients</div>
        </CmpAppShell>,
        "en-US"
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Workspace navigation" })
      );
      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).queryByRole("button", { name: "Billing" })
      ).not.toBeInTheDocument();
      expect(
        within(dialog).queryByRole("button", { name: "Dashboard" })
      ).not.toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", { name: "Acceptance" })
      ).toBeInTheDocument();
    } finally {
      viewport.mockRestore();
    }
  });

  it.each(["MANAGER", "PARTNER", "SUPER_ADMIN"] as const)(
    "matches the dashboard route permission in the %s mobile menu",
    async (globalRole) => {
      const viewport = vi
        .spyOn(window, "matchMedia")
        .mockImplementation((query) => ({
          matches: query.includes("767"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));
      try {
        renderWithClient(
          <CmpAppShell
            activeSection="clients"
            user={{ ...user, globalRole }}
            onSignOut={() => {}}
          >
            <div>Clients</div>
          </CmpAppShell>,
          "en-US"
        );
        fireEvent.click(
          screen.getByRole("button", { name: "Workspace navigation" })
        );
        const dialog = await screen.findByRole("dialog");
        const dashboard = within(dialog).queryAllByRole("button", {
          name: "Dashboard",
        });
        expect(dashboard).toHaveLength(globalRole === "SUPER_ADMIN" ? 1 : 0);
        expect(
          within(dialog).getByRole("button", { name: "Client" })
        ).toBeVisible();
      } finally {
        viewport.mockRestore();
      }
    }
  );

  it("prefetches the destination section while navigating", () => {
    const navigate = vi.fn();
    renderWithClient(
      <CmpAppShell
        activeSection="clients"
        user={user}
        onSignOut={() => {}}
        navigate={navigate}
      >
        <div>Client content</div>
      </CmpAppShell>
    );
    fireEvent.click(screen.getByRole("button", { name: "Acceptance" }));

    expect(navigate).toHaveBeenCalledWith("/en-US/acceptance");
    expect(api.cmpAcceptance).toHaveBeenCalledOnce();
    expect(api.cmpApprovals).toHaveBeenCalledOnce();
  });
});

function renderWithClient(
  element: React.ReactElement,
  initialLocale?: CmpLocale
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectWingThemeProvider>
        <CmpI18nProvider initialLocale={initialLocale}>
          {element}
        </CmpI18nProvider>
      </ProjectWingThemeProvider>
    </QueryClientProvider>
  );
}
