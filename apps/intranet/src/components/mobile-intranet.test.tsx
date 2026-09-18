import { ProjectWingThemeProvider, themeCookieNames } from "@project-wing/ui";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntranetHomeClient } from "@/app/page-client";
import { intranetDictionaries } from "@/i18n/dictionaries";
import * as knowledgeApi from "@/lib/knowledge-api";
import type { KnowledgeItem } from "@/lib/knowledge-catalog";
import { buildSystemLinks } from "@/lib/system-links";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
const copy = intranetDictionaries.enUS;
const items: KnowledgeItem[] = [
  {
    id: "audit-guide",
    title: "Audit evidence guide",
    department: "qm",
    secondaryCategory: "technical",
    tertiaryCategory: "audit",
    type: "guide",
    owner: "Alex",
    updatedAt: "2026-09-01",
    fileName: "guide.pdf",
    mimeType: "application/pdf",
  },
  {
    id: "unfiled",
    title: "General QM reference",
    department: "qm",
    type: "guide",
    owner: "Sam",
    updatedAt: "2026-09-01",
    previewAllowed: false,
  },
  {
    id: "it-doc",
    title: "Security guide",
    department: "it",
    secondaryCategory: "security",
    type: "guide",
    owner: "Alex",
    updatedAt: "2026-09-01",
  },
];
function renderHome(canManageKnowledge = false, knowledgeItems = items) {
  return render(
    <ProjectWingThemeProvider>
      <IntranetHomeClient
        locale="en-US"
        copy={copy}
        systems={buildSystemLinks({ locale: "en-US" })}
        knowledgeItems={knowledgeItems}
        canManageKnowledge={canManageKnowledge}
      />
    </ProjectWingThemeProvider>
  );
}

describe("actual Intranet mobile workspace", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/en-US");
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 767.98px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ projects: [], accounts: [] }),
      })
    );
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    // oxlint-disable-next-line unicorn/no-document-cookie -- Reset persisted theme cookies in Happy DOM, which has no Cookie Store API.
    document.cookie = `${themeCookieNames.flavor}=; path=/; max-age=0`;
    // oxlint-disable-next-line unicorn/no-document-cookie -- Keep this test's font preference isolated from later cases.
    document.cookie = `${themeCookieNames.fontSize}=; path=/; max-age=0`;
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
  });

  it("starts with four applications, without knowledge filters or a large empty state", async () => {
    renderHome(true, []);
    const mobile = await screen.findByTestId("intranet-mobile-workspace");
    const nav = within(mobile).getByRole("navigation", {
      name: copy.mobile.applications,
    });
    expect(within(nav).getAllByRole("link")).toHaveLength(3);
    expect(within(nav).getByText("Projects", { exact: true })).toBeTruthy();
    expect(
      within(nav).queryByText("Engagement Management Platform", { exact: true })
    ).toBeNull();
    expect(
      within(nav).getByRole("link", { name: "EMP" }).getAttribute("href")
    ).toBe("http://localhost:3001/en-US/engagement");
    expect(
      within(nav).getByRole("button", { name: copy.knowledge.title })
    ).toBeTruthy();
    expect(within(mobile).queryByRole("tablist")).toBeNull();
    expect(
      within(mobile).queryByRole("button", {
        name: copy.knowledge.upload.action,
      })
    ).toBeNull();
    expect(
      within(mobile).queryByText(copy.knowledge.navigation.recycleBin)
    ).toBeNull();
    expect(within(mobile).queryByRole("searchbox")).toBeNull();
    expect(within(mobile).queryByText("No items")).toBeNull();
    fireEvent.click(
      within(nav).getByRole("button", { name: copy.knowledge.title })
    );
    await screen.findByRole("button", { name: "QM" });
    fireEvent.click(screen.getByRole("button", { name: copy.mobile.back }));
    await screen.findByRole("navigation", { name: copy.mobile.applications });
    expect(within(mobile).queryByRole("searchbox")).toBeNull();
  });

  it("navigates department, second and third levels and restores the route on reload", async () => {
    renderHome();
    fireEvent.click(
      await screen.findByRole("button", { name: copy.knowledge.title })
    );
    fireEvent.click(screen.getByRole("button", { name: "QM" }));
    expect(
      screen.queryByRole("link", { name: "Audit evidence guide" })
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Technical" }));
    expect(screen.getByRole("button", { name: "Accounting" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Audit" }));
    await expect(
      screen.findByRole("link", { name: "Audit evidence guide" })
    ).resolves.toBeTruthy();
    expect(screen.queryByText("General QM reference")).toBeNull();
    expect(window.location.hash).toContain("subcategory=audit");
    cleanup();
    renderHome();
    await expect(
      screen.findByRole("link", { name: "Audit evidence guide" })
    ).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: copy.mobile.back }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Accounting" })).toBeTruthy()
    );
  });

  it("keeps unfiled content reachable and searches only the selected scope", async () => {
    window.history.replaceState(null, "", "/en-US#knowledge?department=qm");
    renderHome();
    fireEvent.click(
      await screen.findByRole("button", { name: copy.mobile.browseAll })
    );
    expect(screen.getByText("General QM reference")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Audit evidence guide" })
    ).toBeTruthy();
    const search = screen.getByRole("searchbox", {
      name: copy.mobile.searchHere,
    });
    fireEvent.change(search, { target: { value: "General" } });
    expect(
      screen.queryByRole("link", { name: "Audit evidence guide" })
    ).toBeNull();
    expect(screen.getByText("General QM reference")).toBeTruthy();
    expect(screen.queryByText("Security guide")).toBeNull();
  });

  it("keeps management actions inside knowledge and opens the existing publish form", async () => {
    renderHome(true);
    fireEvent.click(
      await screen.findByRole("button", { name: copy.knowledge.title })
    );
    fireEvent.click(screen.getByRole("button", { name: copy.mobile.more }));
    const menu = await screen.findByRole("dialog", { name: copy.mobile.more });
    expect(
      within(menu).getByRole("button", {
        name: copy.knowledge.navigation.recycleBin,
      })
    ).toBeTruthy();
    fireEvent.click(
      within(menu).getByRole("button", { name: copy.knowledge.upload.action })
    );
    await expect(
      screen.findByRole("dialog", { name: copy.knowledge.upload.title })
    ).resolves.toBeTruthy();
    expect(screen.queryByRole("dialog", { name: copy.mobile.more })).toBeNull();
  });

  it("does not load archives or show publishing for a read-only deep link", async () => {
    const archive = vi
      .spyOn(knowledgeApi, "getArchivedKnowledgeDocuments")
      .mockResolvedValue([]);
    window.history.replaceState(null, "", "/en-US#recycle");
    renderHome(false);
    await screen.findByTestId("intranet-mobile-workspace");
    fireEvent.click(screen.getByRole("button", { name: copy.mobile.more }));
    const menu = await screen.findByRole("dialog", { name: copy.mobile.more });
    expect(
      within(menu).queryByRole("button", { name: copy.knowledge.upload.action })
    ).toBeNull();
    expect(
      within(menu).queryByRole("button", {
        name: copy.knowledge.navigation.recycleBin,
      })
    ).toBeNull();
    expect(archive).not.toHaveBeenCalled();
  });

  it("shows only actual published recent notices on the workspace", async () => {
    const notice: KnowledgeItem = {
      ...items[0],
      id: "notice",
      title: "New policy",
      kind: "NOTICE",
      status: "PUBLISHED",
      updatedAt: new Date().toISOString(),
    };
    renderHome(false, [
      notice,
      { ...notice, id: "draft", title: "Draft policy", status: "DRAFT" },
    ]);
    const mobile = await screen.findByTestId("intranet-mobile-workspace");
    expect(
      within(mobile).getByRole("heading", { name: copy.mobile.recentNotices })
    ).toBeTruthy();
    expect(
      within(mobile).getByRole("button", { name: "New policy" })
    ).toBeTruthy();
    expect(within(mobile).queryByText("Draft policy")).toBeNull();
    expect(
      within(mobile)
        .getByRole("button", { name: "New policy" })
        .querySelector("time")
        ?.getAttribute("datetime")
    ).toBe(notice.updatedAt);
    fireEvent.click(within(mobile).getByRole("button", { name: "New policy" }));
    expect(screen.queryByText("Draft policy")).toBeNull();
  });

  it("loads the recycle bin once and supports an explicit retry", async () => {
    const archive = vi
      .spyOn(knowledgeApi, "getArchivedKnowledgeDocuments")
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce([]);
    renderHome(true);
    fireEvent.click(
      await screen.findByRole("button", { name: copy.knowledge.title })
    );
    fireEvent.click(screen.getByRole("button", { name: copy.mobile.more }));
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: copy.mobile.more })
      ).getByRole("button", { name: copy.knowledge.navigation.recycleBin })
    );
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(archive).toHaveBeenCalledOnce();
    fireEvent.click(retry);
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /retry/i })).toBeNull()
    );
  });

  it("keeps mobile settings selectable and persists appearance and font size", async () => {
    renderHome();
    await screen.findByTestId("intranet-mobile-workspace");
    fireEvent.click(screen.getByRole("button", { name: copy.settings.title }));
    const settings = await screen.findByRole("dialog", {
      name: copy.settings.title,
    });
    expect(within(settings).getAllByRole("tablist")).toHaveLength(3);
    const night = within(settings).getByRole("tab", {
      name: copy.settings.night,
    });
    fireEvent.click(night);
    await waitFor(() => {
      expect(night.getAttribute("aria-selected")).toBe("true");
      expect(document.cookie).toContain(`${themeCookieNames.flavor}=mocha`);
    });
    const large = within(settings).getByRole("tab", {
      name: copy.settings.fontSizeOptions.lg,
    });
    fireEvent.click(large);
    await waitFor(() => {
      expect(large.getAttribute("aria-selected")).toBe("true");
      expect(document.cookie).toContain(`${themeCookieNames.fontSize}=lg`);
    });
    fireEvent.click(
      within(settings).getByRole("button", {
        name: copy.knowledge.notice.close,
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: copy.settings.title })
      ).toBeNull()
    );
  });
});
