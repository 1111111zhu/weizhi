import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./client";

let fetchMock: ReturnType<typeof vi.fn>;

describe("lint test setup", () => {
  beforeEach(() => {
    fetchMock = vi.fn(() =>
      Promise.resolve(
        Response.json({
          ok: true,
          mode: "MASTER",
          sessionId: "zip-session-1",
          attachmentId: "attachment-1",
          projectId: "project-1",
          lockSessionId: "lock-session-1",
          fileName: "archive.zip",
          version: 1,
          state: "OPEN",
          dirty: false,
          entries: [],
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("zip master api client", () => {
    it("calls zip master lifecycle endpoints", async () => {
      await api.openZipMaster("project-1", "attachment-1");
      await api.readZip("project-1", "attachment-1");
      await api.downloadZipEntryReadOnly(
        "project-1",
        "attachment-1",
        "support folder/evidence.pdf"
      );
      await api.openZipEntryMaster(
        "project-1",
        "zip-session-1",
        "support folder/evidence.xlsx"
      );
      await api.downloadZipSessionEntry(
        "project-1",
        "zip-session-1",
        "support folder/evidence.xlsx"
      );
      await api.closeZipMaster("project-1", "zip-session-1");
      await api.discardZipMaster("project-1", "zip-session-1");

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/zip-master/open",
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/zip/read",
        expect.not.objectContaining({ method: expect.any(String) })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/zip/entries/download?path=support+folder%2Fevidence.pdf",
        expect.not.objectContaining({ method: expect.any(String) })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        "http://localhost:3000/engagement/project-1/workflow/zip-master-sessions/zip-session-1/entries/master/open",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ entryPath: "support folder/evidence.xlsx" }),
        })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        5,
        "http://localhost:3000/engagement/project-1/workflow/zip-master-sessions/zip-session-1/entries/download?path=support+folder%2Fevidence.xlsx",
        expect.not.objectContaining({ method: expect.any(String) })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        6,
        "http://localhost:3000/engagement/project-1/workflow/zip-master-sessions/zip-session-1/close",
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        7,
        "http://localhost:3000/engagement/project-1/workflow/zip-master-sessions/zip-session-1/discard",
        expect.objectContaining({ method: "POST" })
      );
    }, 15_000);

    it("uploads zip master file operations as multipart form data", async () => {
      const file = new File(["support"], "support.txt", { type: "text/plain" });

      await api.addZipMasterOperation(
        "project-1",
        "zip-session-1",
        { type: "ADD_FILE", entryPath: "support.txt" },
        file
      );

      const [, init] = fetchMock.mock.calls[0] ?? [];
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/engagement/project-1/workflow/zip-master-sessions/zip-session-1/operations",
        expect.any(Object)
      );
      expect(init?.method).toBe("POST");
      expect(init?.headers).not.toHaveProperty("Content-Type");
      expect(init?.body).toBeInstanceOf(FormData);
      const body = init?.body as FormData;
      expect(JSON.parse(String(body.get("operation")))).toStrictEqual({
        type: "ADD_FILE",
        entryPath: "support.txt",
      });
      expect(body.get("file")).toBe(file);
    });

    it("rejects file operations without a file before sending a request", async () => {
      const addOperation = api.addZipMasterOperation as (
        projectId: string,
        sessionId: string,
        operation: unknown
      ) => Promise<unknown>;

      await expect(
        addOperation("project-1", "zip-session-1", {
          type: "ADD_FILE",
          entryPath: "support.txt",
        })
      ).rejects.toThrow("Zip file operations require a file");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
