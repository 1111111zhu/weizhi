import type { CmpClient } from "@project-wing/shared";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api/client";
import { CmpI18nProvider } from "@/i18n/client";

import { CmpClientSearchDocumentsSheet } from "./cmp-client-search-documents-sheet";

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

const client = {
  id: "client-hbr",
  clientCode: "C-HBR-010",
  nameEn: "Harbour Retail Limited",
  nameZh: "海港零售有限公司",
} as CmpClient;
const documents = [
  {
    id: "search-document-1",
    clientId: client.id,
    category: "AML_SEARCH" as const,
    fileName: "company-registry.pdf",
    fileSize: 2048,
    mimeType: "application/pdf",
    createdAt: "2026-08-21T08:30:00.000Z",
    uploadedBy: { id: "user-1", name: "Amy Chan" },
  },
];

describe(CmpClientSearchDocumentsSheet, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders AML and company-search documents with sortable, filterable DataGrid columns", async () => {
    vi.spyOn(api, "cmpClientSearchDocuments").mockResolvedValue({ documents });

    render(
      <CmpI18nProvider initialLocale="en-US">
        <CmpClientSearchDocumentsSheet
          client={client}
          canEdit
          onOpenChange={vi.fn()}
        />
      </CmpI18nProvider>
    );

    const grid = await screen.findByTestId(
      "cmp-client-search-documents-data-grid"
    );
    expect(
      screen.getByRole("heading", { name: expectPresent(client.nameEn) })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(`${client.nameEn}: ${documents.length}`)
    ).toBeInTheDocument();
    expect(screen.queryByText(client.clientCode)).not.toBeInTheDocument();
    expect(
      screen.queryByText("PDF, Word, Excel, or PowerPoint · up to 50 MB")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload AML Search materials" })
    ).toHaveClass("bg-secondary");
    expect(within(grid).getByText("company-registry.pdf")).toBeInTheDocument();
    expect(within(grid).getByText("Amy Chan")).toBeInTheDocument();
    expect(within(grid).getByText("2.0 KB")).toBeInTheDocument();

    for (const column of ["File name", "Uploaded by", "Uploaded at", "Size"]) {
      expect(
        within(grid).getByRole("button", { name: column })
      ).toHaveAttribute("aria-haspopup", "menu");
    }

    fireEvent.click(screen.getByRole("tab", { name: "Company" }));
    await waitFor(() =>
      expect(api.cmpClientSearchDocuments).toHaveBeenLastCalledWith(
        client.id,
        "COMPANY_SEARCH"
      )
    );
  });

  it("keeps the DataGrid structure for the empty state", async () => {
    vi.spyOn(api, "cmpClientSearchDocuments").mockResolvedValue({
      documents: [],
    });

    render(
      <CmpI18nProvider initialLocale="en-US">
        <CmpClientSearchDocumentsSheet
          client={client}
          canEdit={false}
          onOpenChange={vi.fn()}
        />
      </CmpI18nProvider>
    );

    const grid = await screen.findByTestId(
      "cmp-client-search-documents-data-grid"
    );
    expect(
      within(grid).getByText("No search materials uploaded yet.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText(`${client.nameEn}: 0`)).toBeInTheDocument();
    expect(
      within(grid).getByRole("button", { name: "File name" })
    ).toBeInTheDocument();
  });
});
