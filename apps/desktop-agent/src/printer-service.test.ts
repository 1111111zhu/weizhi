import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesktopAgentError } from "./errors.js";
import { printConfirmationDocuments } from "./printer-service.js";

const { join } = pathModule;

const roots: string[] = [];

describe("printer-service", () => {
  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
    );
  });

  async function makeRoot() {
    const root = await mkdtemp(join(tmpdir(), "project-wing-print-"));
    roots.push(root);
    return root;
  }

  describe(printConfirmationDocuments, () => {
    it("downloads frozen PDFs and submits them to the selected printer", async () => {
      const fetchFile = vi
        .fn()
        .mockResolvedValue(
          new Response(Buffer.from("%PDF-1.7 confirmation"), { status: 200 })
        );
      const printFile = vi.fn().mockResolvedValue();
      const result = await printConfirmationDocuments(
        {
          printerName: "Office Printer",
          authorization: "Bearer test-token",
          documents: [
            {
              id: "confirmation-1",
              fileName: "AUD-2026-0001-confirmation.pdf",
              downloadUrl:
                "https://api.example.test/confirmations/print-documents/confirmation-1.pdf",
            },
          ],
        },
        {
          allowedDownloadOrigins: ["https://api.example.test"],
          cacheRoot: await makeRoot(),
          fetchFile,
          listPrinters: async () => {
            await Promise.resolve();
            return [
              { name: "Office Printer", isDefault: true, isOffline: false },
            ];
          },
          printFile,
          randomUUID: () => "print-job-1",
        }
      );

      expect(fetchFile).toHaveBeenCalledWith(
        "https://api.example.test/confirmations/print-documents/confirmation-1.pdf",
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(printFile).toHaveBeenCalledWith(
        expect.stringContaining("AUD-2026-0001-confirmation-"),
        "Office Printer"
      );
      expect(result).toStrictEqual({
        ok: true,
        printerName: "Office Printer",
        printed: [
          {
            id: "confirmation-1",
            fileName: expect.stringMatching(
              /^AUD-2026-0001-confirmation-[a-f0-9]{8}\.pdf$/
            ),
          },
        ],
      });
    });

    it("rejects an offline printer before downloading documents", async () => {
      await expect(
        printConfirmationDocuments(
          {
            printerName: "Offline Printer",
            documents: [
              {
                id: "confirmation-1",
                fileName: "confirmation.pdf",
                downloadUrl: "https://api.example.test/confirmation.pdf",
              },
            ],
          },
          {
            allowedDownloadOrigins: ["https://api.example.test"],
            cacheRoot: await makeRoot(),
            listPrinters: async () => {
              await Promise.resolve();
              return [
                { name: "Offline Printer", isDefault: false, isOffline: true },
              ];
            },
          }
        )
      ).rejects.toMatchObject<Partial<DesktopAgentError>>({
        code: "PRINTER_OFFLINE",
      });
    });
  });
});
