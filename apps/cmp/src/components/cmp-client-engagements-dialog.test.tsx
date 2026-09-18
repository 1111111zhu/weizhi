import type { CmpClient, CmpEngagement } from "@project-wing/shared";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { CmpClientEngagementsDialog } from "./cmp-client-engagements-dialog";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("../api/client", () => ({
  api: {
    cmpEngagements: vi.fn(),
  },
}));

vi.mock("../lib/open-cmp-record-preview-window", () => ({
  openCmpRecordPreviewWindow: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const client = {
  id: "client-1",
  clientCode: "C001",
  nameEn: "Huaqian Limited",
  nameZh: "华乾有限公司",
} as CmpClient;

const engagement = {
  id: "engagement-1",
  clientId: "client-1",
  client: {
    id: "client-1",
    clientCode: "C001",
    nameEn: "Huaqian Limited",
    nameZh: "华乾有限公司",
    status: "ACTIVE",
  },
  engagementCode: "C001-2026-AUD",
  serviceType: "ANNUAL_AUDIT",
  pic: "PIC Partner",
  status: "ACTIVE",
} as CmpEngagement;

describe(CmpClientEngagementsDialog, () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(api.cmpEngagements).mockResolvedValue({
      engagements: [engagement],
    });
  });

  it("creates a blank Engagement or copies the selected source Engagement", async () => {
    render(
      <CmpClientEngagementsDialog client={client} onOpenChange={vi.fn()} />
    );

    const createButton = await screen.findByRole("button", {
      name: "New engagement",
    });
    expect(createButton).toBeEnabled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Use C001-2026-AUD as the source engagement",
      })
    );

    await waitFor(() =>
      expect(
        screen.getByText("New engagement will copy C001-2026-AUD.")
      ).toBeInTheDocument()
    );
    expect(createButton).toBeEnabled();
  });

  it("lets the user choose which source groups to import", async () => {
    render(
      <CmpClientEngagementsDialog client={client} onOpenChange={vi.fn()} />
    );

    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Use C001-2026-AUD as the source engagement",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "New engagement" }));

    const importDialog = await screen.findByRole("dialog", {
      name: "Choose information to import",
    });
    expect(
      within(importDialog).getByRole("checkbox", {
        name: /^Commercial planning/,
      })
    ).toBeChecked();

    fireEvent.click(
      within(importDialog).getByRole("button", { name: "Clear all" })
    );
    fireEvent.click(
      within(importDialog).getByRole("button", { name: "Import and create" })
    );

    expect(push).toHaveBeenCalledWith(
      expect.stringContaining(
        "sourceEngagementId=engagement-1&importSections=none"
      )
    );
  });
});
