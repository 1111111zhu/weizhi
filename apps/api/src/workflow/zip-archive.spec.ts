import JSZip from "jszip";

import {
  buildZipEntryTree,
  readZipEntryFile,
  readZipEntryFileWithOperations,
  rebuildZipWithOperations,
  validateZipEntryPath,
} from "./zip-archive";

async function zipBuffer(zip: JSZip) {
  await Promise.resolve();
  return zip.generateAsync({ type: "nodebuffer" });
}

describe(validateZipEntryPath, () => {
  it("normalizes safe zip paths", () => {
    expect(validateZipEntryPath(" audit//evidence/report.txt ")).toBe(
      "audit/evidence/report.txt"
    );
    expect(validateZipEntryPath("audit/evidence/")).toBe("audit/evidence/");
  });

  it.each([
    "",
    " ",
    "/secret.txt",
    "C:/secret.txt",
    String.raw`C:\secret.txt`,
    String.raw`audit\evidence.txt`,
    "..",
    "../secret.txt",
    "audit/../secret.txt",
    "audit/evidence/..",
    "audit/\0secret.txt",
  ])("rejects unsafe zip path %p", (entryPath) => {
    expect(() => validateZipEntryPath(entryPath)).toThrow("Unsafe zip path");
  });
});

describe(buildZipEntryTree, () => {
  it("builds a deterministic folder-first tree from zip entries", async () => {
    const zip = new JSZip();
    const auditFolderDate = new Date("2026-06-19T08:00:00.000Z");
    const evidenceFolderDate = new Date("2026-06-19T08:30:00.000Z");
    const zEmptyFolderDate = new Date("2026-06-19T09:00:00.000Z");
    const rootDate = new Date("2026-06-20T10:00:00.000Z");
    const reportDate = new Date("2026-06-21T11:30:00.000Z");
    const evidenceDate = new Date("2026-06-22T12:45:00.000Z");
    const alphaDate = new Date("2026-06-23T09:15:00.000Z");
    const evidenceBDate = new Date("2026-06-24T14:20:00.000Z");
    zip.file("Audit/", null, { dir: true, date: auditFolderDate });
    zip.file("Audit/Evidence/", null, {
      dir: true,
      date: evidenceFolderDate,
    });
    zip.file("z-empty/", null, { dir: true, date: zEmptyFolderDate });
    zip.file("root.txt", "root", { date: rootDate });
    zip.file("Audit/report.txt", "report", { date: reportDate });
    zip.file("Audit/alpha.txt", "alpha", { date: alphaDate });
    zip.file("Audit/Evidence/b.txt", "b", { date: evidenceBDate });
    zip.file("Audit/Evidence/a.txt", "a", { date: evidenceDate });

    const tree = await buildZipEntryTree(await zipBuffer(zip));

    expect(tree).toStrictEqual([
      {
        name: "Audit",
        path: "Audit/",
        modifiedAt: auditFolderDate.toISOString(),
        type: "folder",
        children: [
          {
            name: "Evidence",
            path: "Audit/Evidence/",
            modifiedAt: evidenceFolderDate.toISOString(),
            type: "folder",
            children: [
              {
                name: "a.txt",
                path: "Audit/Evidence/a.txt",
                modifiedAt: evidenceDate.toISOString(),
                size: 1,
                type: "file",
              },
              {
                name: "b.txt",
                path: "Audit/Evidence/b.txt",
                modifiedAt: evidenceBDate.toISOString(),
                size: 1,
                type: "file",
              },
            ],
          },
          {
            name: "alpha.txt",
            path: "Audit/alpha.txt",
            modifiedAt: alphaDate.toISOString(),
            size: 5,
            type: "file",
          },
          {
            name: "report.txt",
            path: "Audit/report.txt",
            modifiedAt: reportDate.toISOString(),
            size: 6,
            type: "file",
          },
        ],
      },
      {
        name: "z-empty",
        path: "z-empty/",
        modifiedAt: zEmptyFolderDate.toISOString(),
        type: "folder",
        children: [],
      },
      {
        name: "root.txt",
        path: "root.txt",
        modifiedAt: rootDate.toISOString(),
        size: 4,
        type: "file",
      },
    ]);
  });
});

describe(readZipEntryFile, () => {
  it("reads a zip file entry by normalized path", async () => {
    const zip = new JSZip();
    const modifiedAt = new Date("2026-06-25T08:30:00.000Z");
    zip.file("audit/evidence/report.txt", "report", { date: modifiedAt });

    const entry = await readZipEntryFile(
      await zipBuffer(zip),
      " audit//evidence/report.txt "
    );

    expect(entry).toStrictEqual({
      path: "audit/evidence/report.txt",
      name: "report.txt",
      modifiedAt: modifiedAt.toISOString(),
      size: 6,
      content: Buffer.from("report"),
    });
  });

  it("rejects unsafe file entry paths before reading", async () => {
    const zip = new JSZip();
    zip.file("safe.txt", "safe");

    await expect(
      readZipEntryFile(await zipBuffer(zip), "../secret.txt")
    ).rejects.toThrow("Unsafe zip path");
  });

  it("rejects folders and missing entries when reading", async () => {
    const zip = new JSZip();
    zip.file("folder/child.txt", "child");

    await expect(
      readZipEntryFile(await zipBuffer(zip), "folder/")
    ).rejects.toThrow("Zip entry does not exist");
    await expect(
      readZipEntryFile(await zipBuffer(zip), "missing.txt")
    ).rejects.toThrow("Zip entry does not exist");
  });
});

describe(readZipEntryFileWithOperations, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads an operated entry without rebuilding the whole archive", async () => {
    const zip = new JSZip();
    zip.file("source.txt", "source");
    zip.file("folder/child.txt", "child");
    zip.file("replace.txt", "old");
    zip.file("delete.txt", "delete");
    const base = await zipBuffer(zip);
    const generate = vi
      .spyOn(JSZip.prototype, "generateAsync")
      .mockRejectedValue(new Error("should not rebuild"));
    const operations = [
      {
        type: "COPY_ENTRY",
        entryPath: "folder/",
        targetPath: "copied/",
      },
      {
        type: "MOVE_ENTRY",
        entryPath: "source.txt",
        targetPath: "moved/source.txt",
      },
      {
        type: "REPLACE_FILE",
        entryPath: "replace.txt",
        content: Buffer.from("new"),
      },
      {
        type: "ADD_FILE",
        entryPath: "added.txt",
        content: Buffer.from("added"),
      },
      { type: "DELETE_ENTRY", entryPath: "delete.txt" },
    ] satisfies Parameters<typeof readZipEntryFileWithOperations>[1];
    const entry = await readZipEntryFileWithOperations(
      base,
      operations,
      "copied/child.txt"
    );

    expect(entry).toStrictEqual({
      path: "copied/child.txt",
      name: "child.txt",
      modifiedAt: new Date(Date.UTC(1980, 0, 1, 0, 0, 0)).toISOString(),
      size: 5,
      content: Buffer.from("child"),
    });
    await expect(
      readZipEntryFileWithOperations(base, operations, "moved/source.txt")
    ).resolves.toMatchObject({ content: Buffer.from("source") });
    await expect(
      readZipEntryFileWithOperations(base, operations, "replace.txt")
    ).resolves.toMatchObject({ content: Buffer.from("new") });
    await expect(
      readZipEntryFileWithOperations(base, operations, "added.txt")
    ).resolves.toMatchObject({ content: Buffer.from("added") });
    await expect(
      readZipEntryFileWithOperations(base, operations, "delete.txt")
    ).rejects.toThrow("Zip entry does not exist");
    expect(generate).not.toHaveBeenCalled();
  });
});

describe(rebuildZipWithOperations, () => {
  it("rebuilds a zip by applying file and folder operations", async () => {
    const zip = new JSZip();
    zip.file("keep.txt", "keep");
    zip.file("replace.txt", "old");
    zip.file("delete-me.txt", "delete");
    zip.file("delete-folder/child.txt", "delete child");
    zip.file("old-file.txt", "rename file");
    zip.file("old-folder/child.txt", "rename child");
    zip.file("move-file.txt", "move file");
    zip.file("move-folder/child.txt", "move child");

    const rebuilt = await JSZip.loadAsync(
      await rebuildZipWithOperations(await zipBuffer(zip), [
        { type: "DELETE_ENTRY", entryPath: "delete-me.txt" },
        { type: "DELETE_ENTRY", entryPath: "delete-folder/" },
        {
          type: "RENAME_ENTRY",
          entryPath: "old-file.txt",
          targetPath: "renamed-file.txt",
        },
        {
          type: "RENAME_ENTRY",
          entryPath: "old-folder/",
          targetPath: "renamed-folder/",
        },
        {
          type: "MOVE_ENTRY",
          entryPath: "move-file.txt",
          targetPath: "target/move-file.txt",
        },
        {
          type: "MOVE_ENTRY",
          entryPath: "move-folder/",
          targetPath: "target/move-folder/",
        },
        { type: "CREATE_FOLDER", entryPath: "empty/new-folder/" },
        {
          type: "ADD_FILE",
          entryPath: "target/added.txt",
          fileName: "added.txt",
          fileSize: 5,
          mimeType: "text/plain",
          content: Buffer.from("added"),
        },
        {
          type: "REPLACE_FILE",
          entryPath: "replace.txt",
          content: Buffer.from("new"),
        },
      ])
    );

    await expect(rebuilt.file("keep.txt")?.async("string")).resolves.toBe(
      "keep"
    );
    await expect(rebuilt.file("replace.txt")?.async("string")).resolves.toBe(
      "new"
    );
    expect(rebuilt.file("delete-me.txt")).toBeNull();
    expect(rebuilt.file("delete-folder/child.txt")).toBeNull();
    expect(rebuilt.file("old-file.txt")).toBeNull();
    await expect(
      rebuilt.file("renamed-file.txt")?.async("string")
    ).resolves.toBe("rename file");
    expect(rebuilt.file("old-folder/child.txt")).toBeNull();
    await expect(
      rebuilt.file("renamed-folder/child.txt")?.async("string")
    ).resolves.toBe("rename child");
    expect(rebuilt.file("move-file.txt")).toBeNull();
    await expect(
      rebuilt.file("target/move-file.txt")?.async("string")
    ).resolves.toBe("move file");
    expect(rebuilt.file("move-folder/child.txt")).toBeNull();
    await expect(
      rebuilt.file("target/move-folder/child.txt")?.async("string")
    ).resolves.toBe("move child");
    expect(rebuilt.files["empty/new-folder/"]?.dir).toBeTruthy();
    await expect(
      rebuilt.file("target/added.txt")?.async("string")
    ).resolves.toBe("added");
  });

  it("copies file and folder entries without changing the source", async () => {
    const zip = new JSZip();
    zip.file("source.txt", "source");
    zip.file("source-folder/child.txt", "child");
    zip.file("source-folder/nested/grandchild.txt", "grandchild");

    const rebuilt = await JSZip.loadAsync(
      await rebuildZipWithOperations(await zipBuffer(zip), [
        {
          type: "COPY_ENTRY",
          entryPath: "source.txt",
          targetPath: "copy/source.txt",
        },
        {
          type: "COPY_ENTRY",
          entryPath: "source-folder/",
          targetPath: "copy/source-folder/",
        },
      ])
    );

    await expect(rebuilt.file("source.txt")?.async("string")).resolves.toBe(
      "source"
    );
    await expect(
      rebuilt.file("copy/source.txt")?.async("string")
    ).resolves.toBe("source");
    await expect(
      rebuilt.file("source-folder/child.txt")?.async("string")
    ).resolves.toBe("child");
    await expect(
      rebuilt.file("copy/source-folder/child.txt")?.async("string")
    ).resolves.toBe("child");
    await expect(
      rebuilt.file("copy/source-folder/nested/grandchild.txt")?.async("string")
    ).resolves.toBe("grandchild");
  });

  it("rejects unsafe operation paths before rebuilding", async () => {
    const zip = new JSZip();
    zip.file("safe.txt", "safe");

    await expect(
      rebuildZipWithOperations(await zipBuffer(zip), [
        {
          type: "ADD_FILE",
          entryPath: "safe/../secret.txt",
          content: Buffer.from("secret"),
        },
      ])
    ).rejects.toThrow("Unsafe zip path");
  });

  it("rejects unsafe base archive entries before rebuilding", async () => {
    const zip = new JSZip();
    zip.file("../secret.txt", "secret");

    await expect(
      rebuildZipWithOperations(await zipBuffer(zip), [])
    ).rejects.toThrow("Unsafe zip path");
  });

  it("rejects base archives with file and folder name collisions", async () => {
    const zip = new JSZip();
    zip.file("dup", "file");
    zip.file("dup/child.txt", "child");
    const base = await zipBuffer(zip);

    await expect(buildZipEntryTree(base)).rejects.toThrow(
      "Zip entry already exists"
    );
    await expect(rebuildZipWithOperations(base, [])).rejects.toThrow(
      "Zip entry already exists"
    );
  });

  it("keeps an entry when rename target is the same path", async () => {
    const zip = new JSZip();
    zip.file("same.txt", "same");

    const rebuilt = await JSZip.loadAsync(
      await rebuildZipWithOperations(await zipBuffer(zip), [
        {
          type: "RENAME_ENTRY",
          entryPath: "same.txt",
          targetPath: "same.txt",
        },
      ])
    );

    await expect(rebuilt.file("same.txt")?.async("string")).resolves.toBe(
      "same"
    );
  });

  it("rejects operations that would overwrite existing entries", async () => {
    const zip = new JSZip();
    zip.file("existing.txt", "existing");
    zip.file("source.txt", "source");

    await expect(
      rebuildZipWithOperations(await zipBuffer(zip), [
        {
          type: "ADD_FILE",
          entryPath: "existing.txt",
          content: Buffer.from("new"),
        },
      ])
    ).rejects.toThrow("Zip entry already exists");

    await expect(
      rebuildZipWithOperations(await zipBuffer(zip), [
        {
          type: "MOVE_ENTRY",
          entryPath: "source.txt",
          targetPath: "existing.txt",
        },
      ])
    ).rejects.toThrow("Zip entry already exists");

    const folderCollisionZip = new JSZip();
    folderCollisionZip.file("existing-folder-name", "file");
    folderCollisionZip.file("source-folder/child.txt", "child");

    await expect(
      rebuildZipWithOperations(await zipBuffer(folderCollisionZip), [
        {
          type: "MOVE_ENTRY",
          entryPath: "source-folder/",
          targetPath: "existing-folder-name/",
        },
      ])
    ).rejects.toThrow("Zip entry already exists");

    await expect(
      rebuildZipWithOperations(await zipBuffer(folderCollisionZip), [
        { type: "CREATE_FOLDER", entryPath: "source-folder/" },
      ])
    ).rejects.toThrow("Zip entry already exists");
  });

  it("rejects operations whose source entry does not exist", async () => {
    const zip = new JSZip();
    zip.file("safe.txt", "safe");

    await expect(
      rebuildZipWithOperations(await zipBuffer(zip), [
        { type: "DELETE_ENTRY", entryPath: "missing.txt" },
      ])
    ).rejects.toThrow("Zip entry does not exist");

    await expect(
      rebuildZipWithOperations(await zipBuffer(zip), [
        {
          type: "RENAME_ENTRY",
          entryPath: "missing.txt",
          targetPath: "renamed.txt",
        },
      ])
    ).rejects.toThrow("Zip entry does not exist");
  });

  it("produces deterministic rebuilt zip bytes for identical inputs", async () => {
    const zip = new JSZip();
    zip.file("base.txt", "base");
    const base = await zipBuffer(zip);
    const operations = [
      {
        type: "ADD_FILE" as const,
        entryPath: "new.txt",
        content: Buffer.from("new"),
      },
      { type: "CREATE_FOLDER" as const, entryPath: "empty/" },
    ];
    const first = await rebuildZipWithOperations(base, operations);
    const second = await rebuildZipWithOperations(base, operations);
    const rebuilt = await JSZip.loadAsync(first);

    expect(second.equals(first)).toBeTruthy();
    expect(rebuilt.file("new.txt")?.date.toISOString()).toBe(
      "1980-01-01T00:00:00.000Z"
    );
    expect(rebuilt.files["empty/"]?.date.toISOString()).toBe(
      "1980-01-01T00:00:00.000Z"
    );
  });
});
