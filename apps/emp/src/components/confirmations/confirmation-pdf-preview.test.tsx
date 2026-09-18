// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "../../i18n/dictionaries";
import { ConfirmationPdfPreview } from "./confirmation-pdf-preview";

const { previewConfirmationDispatchPdf } = vi.hoisted(() => ({
  previewConfirmationDispatchPdf: vi.fn(),
}));

vi.mock("../../api/client", () => ({
  api: { previewConfirmationDispatchPdf },
}));

describe(ConfirmationPdfPreview, () => {
  beforeEach(() => {
    previewConfirmationDispatchPdf.mockResolvedValue(
      new Blob(["%PDF-1.4"], { type: "application/pdf" })
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:confirmation-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads the frozen officer PDF into an embedded preview", async () => {
    const dictionary = await getDictionary("en-US");
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ConfirmationPdfPreview
          confirmationId="confirmation-1"
          copy={dictionary.confirmationCenter.dispatchQueue}
          fileLabel="Example bank"
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    );

    const frame = await screen.findByLabelText(
      "Confirmation preview: Example bank"
    );
    expect(frame).toHaveAttribute("src", "blob:confirmation-preview");
    expect(previewConfirmationDispatchPdf).toHaveBeenCalledWith(
      "confirmation-1"
    );
    await waitFor(() =>
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    );
  });
});
