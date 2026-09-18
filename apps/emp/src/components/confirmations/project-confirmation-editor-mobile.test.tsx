// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfirmationsCopy as copy } from "@/i18n/dictionaries";

import { ProjectConfirmationEditor } from "./project-confirmation-editor";

const derivedValues = {
  balanceSheetDate: "2026-12-31",
  clientCode: "C-001",
  clientName: "Client",
  confirmationCode: "YH-001",
  contactEmail: "",
  contactName: "",
  fiscalYear: "2026",
  picName: "PIC",
  projectCode: "AUD-001",
  projectName: "Audit",
};
function setup(readOnly = false) {
  const custom = vi.fn();
  const upload = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <ProjectConfirmationEditor
        copy={copy}
        locale="en-US"
        derivedValues={derivedValues}
        draftPayload={null}
        templateCode={null}
        confirmationType="BANK"
        readOnly={readOnly}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onTemplateSelect={vi.fn()}
        onCustomTemplateSelect={custom}
        onUploadDocument={upload}
      />
    </QueryClientProvider>
  );
  return { ...result, client, custom, upload };
}
describe("mobile confirmation editor toolbar", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("767"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("uses a bottom sheet for choosing a template and keeps custom upload available", async () => {
    const result = setup();
    fireEvent.click(screen.getByRole("button", { name: copy.draftTemplate }));
    const sheet = await screen.findByRole("dialog", {
      name: copy.draftTemplate,
    });
    fireEvent.click(
      within(sheet).getByRole("option", { name: copy.localUpload })
    );
    expect(result.custom).toHaveBeenCalledOnce();
    result.client.clear();
  });

  it("moves secondary actions into a sheet without bypassing read-only state", async () => {
    const result = setup(true);
    expect(
      screen.getByRole("button", { name: copy.draftTemplate })
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", {
        name: copy.newConfirmationDialog.uploadDocument,
      })
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmation actions" })
    );
    const sheet = await screen.findByRole("dialog", {
      name: "Confirmation actions",
    });
    expect(
      within(sheet).getByRole("button", {
        name: copy.newConfirmationDialog.uploadDocument,
      })
    ).toBeDisabled();
    expect(result.upload).not.toHaveBeenCalled();
    result.client.clear();
  });
});
