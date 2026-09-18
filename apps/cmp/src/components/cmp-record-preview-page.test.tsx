import type { CmpRecordPreviewDocument } from "@project-wing/shared/cmp-record-preview";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api/client";
import { CmpI18nProvider } from "@/i18n/client";

import { CmpRecordPreviewPage } from "./cmp-record-preview-page";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/components/cmp-toast", () => ({
  useCmpToast: () => ({ toast: mocks.toast }),
}));

const document: CmpRecordPreviewDocument = {
  kind: "CLIENT",
  recordId: "client-1",
  code: "C001",
  title: "Example Limited",
  status: "Active",
  updatedAt: "2026-08-08T12:00:00.000Z",
  sections: [
    {
      id: "basic",
      title: "Basic information",
      fields: [
        { id: "clientCode", label: "Client Code", value: "C001" },
        { id: "email", label: "Email", value: "—" },
      ],
    },
    {
      id: "registration",
      title: "Registration / regulation",
      fields: [
        { id: "place", label: "Place of Incorporation", value: "Hong Kong" },
      ],
    },
    {
      id: "relationships",
      title: "Group relationship / client source",
      fields: [{ id: "source", label: "Referred By", value: "—" }],
    },
    {
      id: "responsible-and-services",
      title: "Responsible persons / expected services",
      fields: [{ id: "pic", label: "PIC", value: "Partner A" }],
    },
  ],
};
const engagementDocument: CmpRecordPreviewDocument = {
  ...document,
  kind: "ENGAGEMENT",
  recordId: "engagement-1",
  code: "E001",
  title: "E001",
};

function renderPreview(kind: "CLIENT" | "ENGAGEMENT" = "CLIENT") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <CmpI18nProvider initialLocale="en-US">
      <QueryClientProvider client={queryClient}>
        <CmpRecordPreviewPage
          kind={kind}
          recordId={kind === "CLIENT" ? "client-1" : "engagement-1"}
        />
      </QueryClientProvider>
    </CmpI18nProvider>
  );
}

describe(CmpRecordPreviewPage, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.replace.mockReset();
    mocks.toast.mockReset();
  });

  it("renders the complete four-section document without the CMP application shell", async () => {
    vi.spyOn(api, "me").mockResolvedValue({
      id: "partner-1",
      email: "partner@example.com",
      name: "Partner",
      globalRole: "PARTNER",
    });
    vi.spyOn(api, "cmpClientPreview").mockResolvedValue(document);

    renderPreview();

    await expect(
      screen.findByRole("heading", { name: "Example Limited" })
    ).resolves.toBeInTheDocument();
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent)
    ).toStrictEqual(document.sections.map((section) => section.title));
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Back to Clients" })
    ).toHaveAttribute("href", "/en-US/clients");
    expect(screen.queryByText("CMP navigation")).not.toBeInTheDocument();
  });

  it("uses the authenticated export endpoint and prevents a duplicate export", async () => {
    vi.spyOn(api, "me").mockResolvedValue({
      id: "partner-1",
      email: "partner@example.com",
      name: "Partner",
      globalRole: "PARTNER",
    });
    vi.spyOn(api, "cmpClientPreview").mockResolvedValue(document);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Blob(["pdf"]), {
        status: 200,
        headers: {
          "content-disposition":
            'attachment; filename="C001-client-profile.pdf"',
        },
      })
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview-pdf");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue();

    renderPreview();
    const exportButton = await screen.findByRole("button", {
      name: "Export PDF",
    });
    fireEvent.click(exportButton);
    fireEvent.click(exportButton);

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/cmp/clients/client-1/export.pdf?locale=en-US",
        { credentials: "include" }
      )
    );
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Your PDF download is ready.",
      variant: "success",
    });
  });

  it("redirects unauthenticated users to login with the original preview address", async () => {
    vi.spyOn(api, "me").mockResolvedValue(null);
    const previewRequest = vi.spyOn(api, "cmpClientPreview");

    renderPreview();

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        expect.stringMatching(/^\/en-US\/login\?redirect=/)
      )
    );
    expect(previewRequest).not.toHaveBeenCalled();
  });

  it("does not expose the budget workbook before the Engagement has been archived", async () => {
    vi.spyOn(api, "me").mockResolvedValue({
      id: "partner-1",
      email: "partner@example.com",
      name: "Partner",
      globalRole: "PARTNER",
    });
    vi.spyOn(api, "cmpEngagementPreview").mockResolvedValue(engagementDocument);
    vi.spyOn(api, "cmpEngagement").mockResolvedValue({
      id: "engagement-1",
      status: "ACTIVE",
      picUserId: "partner-1",
    } as never);
    renderPreview("ENGAGEMENT");
    await screen.findAllByText("E001");
    expect(screen.queryByRole("button", { name: "Export Budget Workbook" })).not.toBeInTheDocument();
  });
});
