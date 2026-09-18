// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api/client";
import { ConfirmationResponsePreview } from "./confirmation-response-preview";

vi.mock("@/components/extend/pdf-viewer", () => ({
  PDFViewer: ({
    fileName,
    src,
    className,
  }: {
    fileName: string;
    src: string;
    className: string;
  }) => <div aria-label={fileName} data-src={src} className={className} />,
}));

vi.mock("../../api/client", () => ({
  api: { projectConfirmationResponseArtifact: vi.fn() },
}));

describe("lint test setup", () => {
  afterEach(cleanup);

  describe(ConfirmationResponsePreview, () => {
    it("renders fetched PDFs in the application viewer instead of a blocked browser frame", async () => {
      vi.mocked(api.projectConfirmationResponseArtifact).mockResolvedValue(
        new Blob(["%PDF-1.4"], { type: "application/pdf" })
      );
      vi.stubGlobal("URL", {
        ...URL,
        createObjectURL: vi.fn(() => "blob:response"),
        revokeObjectURL: vi.fn(),
      });

      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <ConfirmationResponsePreview
            artifact={{
              id: "artifact-1",
              responseId: "response-1",
              sequence: 1,
              fileName: "response.pdf",
              mimeType: "application/pdf",
              fileSize: 10,
              sha256: "sha",
              uploadedBy: "user-1",
              capturedAt: "2026-07-05T08:00:00.000Z",
              createdAt: "2026-07-05T08:00:00.000Z",
            }}
            projectId="project-1"
            confirmationId="confirmation-1"
            responseId="response-1"
            copy={{
              loadError: "Unable to load",
              loading: "Loading",
              retry: "Retry",
            }}
          />
        </QueryClientProvider>
      );

      const iframe = await screen.findByLabelText("response.pdf");
      expect(document.querySelector("iframe")).toBeNull();
      expect(iframe).toHaveAttribute("data-src", "blob:response");
      expect(iframe.className).toContain("h-full");
      expect(iframe.className).toContain("w-full");
      expect(iframe.parentElement?.className).toContain("min-h-0");
      expect(iframe.parentElement?.className).toContain("flex-1");
      expect(iframe.parentElement?.className).toContain("min-w-0");
    });
  });
});
