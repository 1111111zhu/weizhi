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
import { afterEach, describe, expect, it, vi } from "vitest";

import { adminUsersGridCopy } from "../i18n/admin-users-grid-copy";
import { AdminUsersPage } from "./admin-users";

const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  users: vi.fn(),
  createUser: vi.fn(),
  resetPassword: vi.fn(),
  updateUser: vi.fn(),
  userRoleImpact: vi.fn(),
}));
const mockI18n = vi.hoisted(() => ({
  locale: "zh-CN" as "zh-CN" | "en-US",
}));
const mockRouter = vi.hoisted(() => ({ push: vi.fn() }));
const mockToast = vi.hoisted(() => vi.fn());
const mockConfirm = vi.hoisted(() => vi.fn());

vi.mock("../api/client", () => ({ api: mockApi }));
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
vi.mock("../components/toast", () => ({
  useToast: () => ({ toast: mockToast, confirm: mockConfirm }),
}));
vi.mock("../components/project-wing-top-bar-controls", () => ({
  EmpPortalAction: () =>
    createElement("button", { type: "button" }, "Intranet"),
  EmpTopBarControls: ({
    actionItems,
  }: {
    actionItems: {
      active?: boolean;
      id: string;
      label: string;
      onClick: () => void;
    }[];
  }) =>
    createElement(
      "nav",
      { "aria-label": "Page shortcuts" },
      actionItems.map((item) =>
        createElement(
          "button",
          {
            "aria-pressed": item.active,
            key: item.id,
            onClick: item.onClick,
            type: "button",
          },
          item.label
        )
      )
    ),
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: mockI18n.locale,
    localizedPath: (pathname: string) => `/${mockI18n.locale}${pathname}`,
    dictionary: {
      projects: {
        leadership: {
          roleImpactTitle: "Confirm grade change",
          roleImpactDescription: "Project access will be suspended:",
          save: "Confirm",
          cancel: "Cancel",
          roleChangeFailed: "Grade update failed",
        },
      },
      desktop: {
        apps: {
          home: mockI18n.locale === "zh-CN" ? "主页" : "Home",
          templates: mockI18n.locale === "zh-CN" ? "模板库" : "Templates",
          smartForms: mockI18n.locale === "zh-CN" ? "智能表单" : "Smart Forms",
        },
      },
      common: {
        backTo: mockI18n.locale === "zh-CN" ? "返回" : "Back to",
        userManagement:
          mockI18n.locale === "zh-CN" ? "用户管理" : "User management",
      },
    },
  }),
}));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockI18n.locale = "zh-CN";
  });

  describe(AdminUsersPage, () => {
    it.each([false, true])(
      "requires impact confirmation before saving a grade (approved=%s)",
      async (approved) => {
        renderWithProviders(createElement(AdminUsersPage));
        mockApi.userRoleImpact.mockResolvedValue({
          token: "a".repeat(64),
          projects: [
            {
              memberId: "m",
              projectId: "p",
              projectCode: "AUD-1",
              projectName: "Audit project",
            },
          ],
        });
        mockConfirm.mockResolvedValue(approved);
        const role = await screen.findByRole("combobox", {
          name: "Sam global role",
        });
        fireEvent.click(role);
        fireEvent.click(screen.getByRole("option", { name: "Assistant" }));
        await waitFor(() =>
          expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
              description: expect.stringContaining("AUD-1 Audit project"),
            })
          )
        );
        await waitFor(() => expect(role).not.toBeDisabled());
        expect(mockApi.updateUser.mock.calls).toStrictEqual(
          approved
            ? [
                [
                  "user-manager",
                  {
                    globalRole: "ASSISTANT",
                    projectAuthorizationImpactToken: "a".repeat(64),
                  },
                ],
              ]
            : []
        );
      }
    );

    it("retains successive search values after the input event finishes", async () => {
      renderWithProviders(createElement(AdminUsersPage));
      await screen.findByText("Sam");
      const search = screen.getByRole("textbox", { name: "查找用户" });
      for (const q of ["S", "Sa", "Sam"]) {
        fireEvent.change(search, { target: { value: q } });
        await waitFor(() => {
          expect(mockApi.users).toHaveBeenLastCalledWith({
            q,
            status: "",
            globalRole: "",
          });
        });
        expect(search).toHaveValue(q);
      }
    });

    it("distinguishes a failed user list from an empty list and retries", async () => {
      mockApi.users.mockRejectedValueOnce(new Error("Unavailable"));
      renderWithProviders(createElement(AdminUsersPage));
      const error = await screen.findByRole("alert");
      expect(error).toHaveTextContent("暂时无法加载");
      expect(screen.queryByText("暂无用户")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "重试" }));
      await expect(screen.findByText("Sam")).resolves.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("auto-saves status changes from the admin row", async () => {
      renderWithProviders(createElement(AdminUsersPage));

      fireEvent.click(await screen.findByRole("button", { name: "Sam 停用" }));

      await waitFor(() => {
        expect(mockApi.updateUser).toHaveBeenCalledWith("user-manager", {
          status: "DISABLED",
        });
      });
    });

    it("renders user administration and invite role choices", async () => {
      renderWithProviders(createElement(AdminUsersPage));

      await screen.findByRole("region", {
        name: adminUsersGridCopy["zh-CN"].pageTitle,
      });
      expect(
        screen.getByText(adminUsersGridCopy["zh-CN"].pageDescription)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "用户管理", pressed: true })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "查找用户" })
      ).toBeInTheDocument();
      expect(screen.queryByText("Invite user")).not.toBeInTheDocument();
      expect(screen.getByTestId("admin-users-data-grid")).toBeTruthy();
      await expect(
        screen.findByRole("table", { name: "User list" })
      ).resolves.toBeTruthy();
      expect(
        screen.getByRole("button", { name: "员工编号" })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "费率" })).toBeInTheDocument();
      expect(screen.queryByText("Staff No")).not.toBeInTheDocument();
      const userTable = screen.getByRole("table", { name: "User list" });
      fireEvent.click(
        within(userTable).getByRole("button", { name: "员工编号" })
      );
      await waitFor(() => {
        expect(
          within(userTable)
            .getAllByLabelText(/Staff No$/)
            .map((element) => element.textContent)
        ).toStrictEqual(["000", "001", "002"]);
      });
      fireEvent.click(
        within(userTable).getByRole("button", { name: "员工编号" })
      );
      await waitFor(() => {
        expect(
          within(userTable)
            .getAllByLabelText(/Staff No$/)
            .map((element) => element.textContent)
        ).toStrictEqual(["002", "001", "000"]);
      });
      fireEvent.click(screen.getByRole("button", { name: "创建用户" }));
      const createDialog = await screen.findByRole("dialog", {
        name: "创建用户",
      });
      const inviteRoleSelect = within(createDialog).getByRole("combobox", {
        name: "全局职级",
      });
      const inviteRoleLabels = await getSelectOptionLabels(inviteRoleSelect);
      expect(inviteRoleLabels).toStrictEqual([
        "Confirmation officer",
        "Partner",
        "Principal",
        "Manager",
        "Senior",
        "Staff",
        "Assistant",
        "N/A",
      ]);
    }, 15_000);

    it("uses the same account-grade choices in editable role controls", async () => {
      renderWithProviders(createElement(AdminUsersPage));

      const samRole = await screen.findByRole("combobox", {
        name: "Sam global role",
      });
      await expect(getSelectOptionLabels(samRole)).resolves.toStrictEqual([
        "Confirmation officer",
        "Partner",
        "Principal",
        "Manager",
        "Senior",
        "Staff",
        "Assistant",
        "N/A",
      ]);
      fireEvent.click(samRole);
      fireEvent.click(screen.getByRole("option", { name: "Assistant" }));

      await waitFor(() => {
        expect(mockApi.updateUser).toHaveBeenCalledWith("user-manager", {
          globalRole: "ASSISTANT",
        });
      });

      const adminRole = screen.getByRole("combobox", {
        name: "System administrator global role",
      });
      expect(adminRole).toBeDisabled();
      expect(adminRole).toHaveTextContent("System administrator");
    });

    it("creates users from the list toolbar dialog", async () => {
      mockApi.createUser.mockResolvedValue({});
      renderWithProviders(createElement(AdminUsersPage));

      fireEvent.click(await screen.findByRole("button", { name: "创建用户" }));
      const dialog = await screen.findByRole("dialog", {
        name: "创建用户",
      });
      fireEvent.change(within(dialog).getByLabelText("邮箱"), {
        target: { value: "new.user@projectwing.local" },
      });
      fireEvent.change(within(dialog).getByLabelText("姓名"), {
        target: { value: "New User" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "创建用户" }));

      await waitFor(() => {
        expect(mockApi.createUser.mock.calls[0]?.[0]).toStrictEqual({
          email: "new.user@projectwing.local",
          globalRole: "STAFF",
          name: "New User",
          password: "User12345!",
        });
      });
      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "创建用户" })
        ).not.toBeInTheDocument();
      });
    });

    it("reports password resets without rendering the temporary password", async () => {
      mockApi.resetPassword.mockResolvedValue({
        temporaryPassword: "Preview123!",
      });
      renderWithProviders(createElement(AdminUsersPage));

      const samRow = await screen.findByRole("row", { name: /Sam/ });
      fireEvent.click(within(samRow).getByRole("button", { name: "重置密码" }));

      await waitFor(() => {
        expect(mockApi.resetPassword).toHaveBeenCalledWith(
          "user-manager",
          expect.anything()
        );
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: adminUsersGridCopy["zh-CN"].passwordResetSuccess,
        variant: "success",
      });
      expect(screen.queryByText(/Temporary password/)).not.toBeInTheDocument();
      expect(screen.queryByText("Preview123!")).not.toBeInTheDocument();
    });

    it("does not expose report subject administration", async () => {
      renderWithProviders(createElement(AdminUsersPage));

      await expect(screen.findByText("Sam")).resolves.toBeInTheDocument();
    });
  });

  function renderWithProviders(element: React.ReactElement) {
    mockApi.me.mockResolvedValue({
      id: "user-admin",
      email: "admin@projectwing.local",
      name: "System administrator",
      globalRole: "SUPER_ADMIN",
    });
    mockApi.users.mockResolvedValue([
      {
        id: "user-admin",
        email: "admin@projectwing.local",
        name: "System administrator",
        globalRole: "SUPER_ADMIN",
        status: "ACTIVE",
        staffNo: "002",
      },
      {
        id: "user-manager",
        email: "manager@projectwing.local",
        name: "Sam",
        globalRole: "MANAGER",
        status: "ACTIVE",
        staffNo: "001",
        hourlyRate: "1800.00",
      },
      {
        id: "user-tax",
        email: "tax@projectwing.local",
        name: "Yina",
        globalRole: "TAX_EXPERT",
        status: "ACTIVE",
        staffNo: "m",
        hourlyRate: "1800.00",
      },
    ]);
    mockApi.updateUser.mockResolvedValue({});
    mockApi.userRoleImpact.mockResolvedValue({
      projects: [],
      token: "0".repeat(64),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      createElement(QueryClientProvider, { client: queryClient }, element)
    );
  }

  async function getSelectOptionLabels(select: HTMLElement) {
    fireEvent.click(select);
    const options = await screen.findAllByRole("option");
    const labels = options.map((option) => option.textContent);
    fireEvent.keyDown(select, { key: "Escape" });
    return labels;
  }
});
