import {
  ProjectWingThemeProvider,
  actionBarTapAnimation,
  themeCookieNames,
} from "@project-wing/ui";
import {
  fireEvent,
  render as renderBase,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { intranetDictionaries } from "@/i18n/dictionaries";
import { localeCookieName } from "@/i18n/settings";
import type { IntranetCurrentAccount } from "@/lib/current-user";
import type { KnowledgeItem } from "@/lib/knowledge-catalog";

import { IntranetHomeClient } from "./page-client";

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

function render(ui: ReactElement) {
  return renderBase(<ProjectWingThemeProvider>{ui}</ProjectWingThemeProvider>);
}

describe("intranet home", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    window.history.replaceState(null, "", "/zh-CN");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ projects: [] }),
      })
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.cookie = `${themeCookieNames.flavor}=; path=/; max-age=0`;
    document.cookie = `${themeCookieNames.fontSize}=; path=/; max-age=0`;
    document.cookie = `${localeCookieName}=; path=/; max-age=0`;
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
  });

  const systems = [
    {
      name: "EMP",
      label: "Engagement Management Platform",
      href: "http://localhost:3001/zh-CN/login",
      description: "Engagement execution",
    },
    {
      name: "CMP",
      label: "Client Management Portal",
      href: "http://localhost:3002/login",
      description: "Client records",
    },
    {
      name: "TMS",
      label: "Timesheet Management System",
      href: "http://localhost:3004/zh-CN/login",
      description: "Time entry",
    },
  ];
  const recentKnowledgeDate = new Date().toISOString().slice(0, 10);
  const knowledgeItems: KnowledgeItem[] = [
    {
      id: "knowledge-1",
      referenceCode: "IT-004",
      title: "Outlook Calendar User Guide",
      department: "it",
      type: "guide",
      owner: "G0847",
      updatedAt: recentKnowledgeDate,
      fileName: "outlook-guide.pdf",
      mimeType: "application/pdf",
      previewUrl: "https://files.example.test/outlook-guide.pdf",
      downloadUrl:
        "https://files.example.test/outlook-guide.pdf?response-content-disposition=attachment",
    },
    {
      referenceCode: "ADM-006",
      title: "PRC Archive Procedure",
      department: "admin",
      type: "process",
      owner: "G4061",
      updatedAt: "2025-04-25",
    },
  ];
  const account: IntranetCurrentAccount = {
    email: "admin@projectwing.local",
    globalRole: "SUPER_ADMIN",
    id: "user-admin",
    name: "Project Wing Admin",
  };

  describe(IntranetHomeClient, () => {
    it("filters the existing catalog through the compact department selector", async () => {
      render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );
      fireEvent.click(screen.getByRole("combobox", { name: "部门" }));
      const option = await screen.findByRole("option", { name: "IT" });
      fireEvent.pointerDown(option, { pointerType: "mouse" });
      fireEvent.click(option);
      await waitFor(() =>
        expect(
          screen.getByRole("combobox", { name: "部门" }).textContent
        ).toContain("IT")
      );
      expect(screen.getByText("Outlook Calendar User Guide")).toBeTruthy();
      expect(screen.queryByText("PRC Archive Procedure")).toBeNull();
      expect(screen.queryByRole("button", { name: "发布通知" })).toBeNull();
    });

    it("keeps the action-bar tap gesture stable across reduced-motion hydration", () => {
      expect(actionBarTapAnimation(null, false)).toStrictEqual({ scale: 0.96 });
      expect(actionBarTapAnimation(true, false)).toStrictEqual({ scale: 1 });
      expect(actionBarTapAnimation(false, true)).toBeUndefined();
    });

    it("opens systems through their configured entry", () => {
      const consoleError = vi.spyOn(console, "error");
      render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      const nativeButtonErrors = consoleError.mock.calls.filter((args) =>
        args.some((arg) => String(arg).includes("nativeButton"))
      );
      consoleError.mockRestore();
      expect(nativeButtonErrors).toStrictEqual([]);
      const navigation = screen.getByRole("navigation", {
        name: "Project Wing 系统",
      });
      expect(
        within(navigation)
          .getByRole("link", { name: /CMP/ })
          .getAttribute("href")
      ).toBe("http://localhost:3002/login");
      expect(
        within(navigation)
          .getByRole("link", { name: /TMS/ })
          .getAttribute("href")
      ).toBe("http://localhost:3004/zh-CN/login");
    });

    it("marks the TMS entry when the current account has pending approvals", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({
          projects: [{ engagementId: "engagement-1", pendingCount: 2 }],
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <IntranetHomeClient
          account={{ ...account, globalRole: "MANAGER" }}
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      await expect(
        screen.findByTestId("tms-pending-indicator")
      ).resolves.toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/tms\/timesheets\/approvals\/projects$/),
        { credentials: "include" }
      );
    });

    it("uses the shared settings action and account popover", async () => {
      render(
        <IntranetHomeClient
          account={account}
          canManageKnowledge
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      const toolbar = screen.getByRole("toolbar", { name: "设置" });
      expect(
        within(toolbar).getByRole("button", { name: "设置" })
      ).toBeTruthy();
      expect(
        Array.from(
          document.querySelectorAll(".project-wing-top-bar-brand-line"),
          (line) => line.textContent
        )
      ).toStrictEqual(["Wing", "Zenith", "Intranet"]);
      expect(
        document.querySelector(
          '[data-slot="project-wing-top-bar-return-action"]'
        )
      ).toBeNull();

      const accountTrigger = screen.getByRole("button", { name: "账号菜单" });
      expect(
        within(accountTrigger).getByRole("img", { name: "当前账号" })
      ).toBeTruthy();
      fireEvent.pointerEnter(accountTrigger);

      await expect(
        screen.findByText("Project Wing Admin")
      ).resolves.toBeTruthy();
      expect(screen.getByText("SUPER ADMIN")).toBeTruthy();
    });

    it("keeps language and shared font size controls in top-bar settings", async () => {
      render(
        <IntranetHomeClient
          account={account}
          canManageKnowledge
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      expect(screen.queryByText("简体中文")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "设置" }));

      const dialog = screen.getByRole("dialog", { name: "设置" });
      expect(within(dialog).getByText("语言")).toBeTruthy();
      expect(within(dialog).getByText("字号")).toBeTruthy();
      expect(within(dialog).queryByText("设置")).toBeNull();
      expect(within(dialog).queryByText("个人偏好")).toBeNull();
      expect(dialog.parentElement?.dataset.morphPopoverPortal).not.toBeNull();
      expect(
        within(dialog).getByRole("tab", { name: "中" }).dataset.active
      ).not.toBeNull();

      fireEvent.click(within(dialog).getByRole("tab", { name: "大" }));
      await waitFor(() => {
        expect(document.documentElement.style.fontSize).toBe("18px");
      });
      expect(document.cookie).toContain(`${themeCookieNames.fontSize}=lg`);

      fireEvent.click(within(dialog).getByRole("tab", { name: "EN" }));

      expect(mockReplace).toHaveBeenCalledWith("/en-US");
      expect(document.cookie).toContain(`${localeCookieName}=en-US`);
    });

    it("opens persisted documents in the shared EMP viewer", () => {
      render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      expect(
        screen.getByRole("link", { name: "预览资料" }).getAttribute("href")
      ).toBe(
        `/knowledge-preview/knowledge-1?fileName=outlook-guide.pdf&mimeType=application%2Fpdf&version=${recentKnowledgeDate}&downloadAllowed=true`
      );
    });

    it("searches the unified knowledge catalog", () => {
      render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      const searchbox = screen.getByRole("searchbox");
      const topbar = searchbox.closest('[data-slot="project-wing-top-bar"]');
      expect(
        topbar?.classList.contains("project-wing-top-bar--center-priority")
      ).toBeTruthy();
      expect(
        topbar?.classList.contains("project-wing-top-bar--center-on-mobile")
      ).toBeFalsy();
      expect(
        topbar?.querySelector('[data-slot="constrained-expandable-action-bar"]')
      ).toBeTruthy();
      expect(searchbox.closest(".project-wing-top-bar-search")).toBeTruthy();
      expect(searchbox.getAttribute("placeholder")).toBe(
        searchbox.getAttribute("aria-label")
      );
      fireEvent.change(searchbox, {
        target: { value: "Outlook" },
      });

      expect(screen.getByText("Outlook Calendar User Guide")).toBeTruthy();
      expect(screen.queryByText("PRC Archive Procedure")).toBeNull();
    });

    it("combines department and directory filters", () => {
      render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      fireEvent.click(screen.getByRole("tab", { name: "Admin" }));
      expect(screen.getByText("PRC Archive Procedure")).toBeTruthy();
      expect(screen.queryByText("Outlook Calendar User Guide")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "制度与治理" }));
      expect(screen.getByText("没有找到匹配的知识条目")).toBeTruthy();
    });

    it("separates recent updates from the complete knowledge view", () => {
      render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      expect(screen.getByRole("tab", { name: "最近更新" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "全部" })).toBeTruthy();
      expect(screen.queryByText("PRC Archive Procedure")).toBeNull();

      fireEvent.click(screen.getByRole("tab", { name: "全部" }));
      expect(screen.getByText("PRC Archive Procedure")).toBeTruthy();
      expect(screen.getByText("Outlook Calendar User Guide")).toBeTruthy();
    });

    it("keeps publishing actions available across knowledge navigation", () => {
      render(
        <IntranetHomeClient
          canManageKnowledge
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      expect(screen.getByRole("button", { name: "发布通知" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "上传资料" })).toBeTruthy();

      fireEvent.click(screen.getByRole("tab", { name: "QM" }));
      expect(screen.getByRole("button", { name: "发布通知" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "上传资料" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Technical" }));
      expect(screen.getByRole("button", { name: "发布通知" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "上传资料" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Audit" }));
      expect(screen.getByRole("button", { name: "发布通知" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "上传资料" })).toBeTruthy();
    });

    it("opens a tertiary cascade only for directories that contain children", () => {
      render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      fireEvent.click(screen.getByRole("tab", { name: "QM" }));
      expect(screen.getByRole("button", { name: "Technical" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Audit" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Technical" }));
      expect(screen.getByRole("button", { name: "Audit" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Accounting" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Tax" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "风险提示" }));
      expect(screen.queryByRole("button", { name: "Audit" })).toBeNull();
    });

    it("opens PDF preview in a new page and exposes a download action", () => {
      render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      const previewLinks = screen.getAllByRole("link", { name: "预览资料" });
      const downloadLinks = screen.getAllByRole("link", { name: "下载资料" });

      expect(previewLinks).toHaveLength(1);
      expect(previewLinks[0]?.getAttribute("href")).toBe(
        `/knowledge-preview/knowledge-1?fileName=outlook-guide.pdf&mimeType=application%2Fpdf&version=${recentKnowledgeDate}&downloadAllowed=true`
      );
      expect(previewLinks[0]?.getAttribute("target")).toBe("_blank");
      expect(downloadLinks).toHaveLength(1);
      expect(downloadLinks[0]?.getAttribute("href")).toBe(
        "/knowledge-download/knowledge-1"
      );
      expect(downloadLinks[0]?.hasAttribute("download")).toBeTruthy();
    });

    it("opens an attachment embedded in a notice in the Intranet viewer", async () => {
      render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={[
            {
              id: "notice-1",
              title: "Illustrative FS",
              department: "qm",
              type: "template",
              kind: "NOTICE",
              owner: "Jony Ma",
              updatedAt: "2026-08-12",
              body: {
                type: "doc",
                content: [
                  {
                    type: "knowledgeAttachment",
                    attrs: {
                      attachmentId: "attachment-1",
                      fileKind: "PDF",
                      fileName: "illustrative.pdf",
                      fileSize: "4.9 MB",
                      previewUrl:
                        "/knowledge-attachment-preview/attachment-1?fileName=illustrative.pdf&mimeType=application%2Fpdf&version=v1",
                    },
                  },
                ],
              },
            },
          ]}
          systems={systems}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "预览资料" }));
      const attachment = await screen.findByRole("link", {
        name: /illustrative\.pdf/,
      });
      expect(attachment.getAttribute("href")).toContain(
        "/knowledge-attachment-preview/attachment-1"
      );
      expect(attachment.getAttribute("target")).toBe("_blank");
      expect(attachment.hasAttribute("download")).toBeFalsy();
    });

    it("offers edit, archive, and permanent delete controls to knowledge managers", () => {
      render(
        <IntranetHomeClient
          canManageKnowledge
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      expect(screen.getByRole("button", { name: "编辑" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "管理条目" }));
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByRole("button", { name: "归档到回收站" })
      ).toBeTruthy();
      expect(
        within(dialog).getByRole("button", { name: "从系统删除" })
      ).toBeTruthy();
    });

    it("loads archived items into the recycle bin and returns home", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => [
          {
            ...knowledgeItems[0],
            id: "archived-1",
            status: "ARCHIVED",
            title: "Archived guide",
          },
        ],
      });
      vi.stubGlobal("fetch", fetchMock);
      render(
        <IntranetHomeClient
          canManageKnowledge
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "回收站" }));

      await expect(screen.findByText("Archived guide")).resolves.toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/knowledge-documents\/archived$/),
        expect.objectContaining({ credentials: "include" })
      );
      expect(screen.getByRole("button", { name: "返回主页" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "回收站" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "返回主页" }));
      expect(screen.getByRole("tab", { name: "最近更新" })).toBeTruthy();
      expect(screen.queryByText("Archived guide")).toBeNull();
    });

    it("shows a retry action when the recycle bin cannot load", async () => {
      const archiveFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Unavailable"))
        .mockResolvedValue({
          ok: true,
          json: () => [
            {
              ...knowledgeItems[0],
              id: "recovered-archive",
              title: "Recovered archive",
              status: "ARCHIVED",
            },
          ],
        });
      const fetchMock = vi.fn((input: string) =>
        input.endsWith("/knowledge-documents/archived")
          ? archiveFetch()
          : Promise.resolve({ ok: true, json: () => ({ projects: [] }) })
      );
      vi.stubGlobal("fetch", fetchMock);
      render(
        <IntranetHomeClient
          canManageKnowledge
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: "回收站" }));
      const errorAlert = await screen.findByRole("alert");
      expect(errorAlert.textContent).toContain("暂时无法加载");
      expect(
        screen.queryByText(intranetDictionaries.zhCN.knowledge.noResults)
      ).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "重试" }));
      await expect(
        screen.findByText("Recovered archive")
      ).resolves.toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows a global upload entry to permitted managers", () => {
      const { rerender } = render(
        <IntranetHomeClient
          canManageKnowledge={false}
          copy={intranetDictionaries.zhCN}
          knowledgeItems={knowledgeItems}
          systems={systems}
        />
      );

      expect(screen.queryByRole("button", { name: "上传资料" })).toBeNull();

      rerender(
        <ProjectWingThemeProvider>
          <IntranetHomeClient
            canManageKnowledge
            copy={intranetDictionaries.zhCN}
            knowledgeItems={knowledgeItems}
            systems={systems}
          />
        </ProjectWingThemeProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "上传资料" }));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeTruthy();
      expect(within(dialog).getAllByRole("combobox")).toHaveLength(4);
      expect(
        within(dialog).getByLabelText("资料文件").getAttribute("type")
      ).toBe("file");
      expect(
        (
          within(dialog).getByRole("button", {
            name: "上传",
          }) as HTMLButtonElement
        ).disabled
      ).toBeTruthy();

      expect(within(dialog).queryByText("所属 Section")).toBeNull();
    });
  });
});
