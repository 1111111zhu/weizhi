import { Archive } from "libarchive.js";

const ARCHIVE_WORKER_URL = "/libarchive.js/worker-bundle.js";

let archiveInitialized = false;

export type ArchivePreviewEntry = {
  path: string;
  name: string;
  size: number;
  lastModified: number;
};

type ArchiveFileLike = {
  name: string;
  size: number;
  lastModified: number;
  extract: () => Promise<File>;
};

function ensureArchiveWorker() {
  if (archiveInitialized) {
    return;
  }
  Archive.init({ workerUrl: ARCHIVE_WORKER_URL });
  archiveInitialized = true;
}

function isArchiveFile(value: unknown): value is ArchiveFileLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "extract" in value
  );
}

export async function openArchivePreview(blob: Blob, fileName: string) {
  ensureArchiveWorker();
  const archive = await Archive.open(new File([blob], fileName));
  const files = await archive.getFilesArray();
  const entries = files.flatMap(({ file, path }) => {
    if (!isArchiveFile(file)) {
      return [];
    }
    return [
      {
        path: `${path}${file.name}`,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
      },
    ];
  });

  return {
    entries,
    encrypted: await archive.hasEncryptedData(),
    extract: (path: string) => {
      const file = files.find(
        (item) =>
          isArchiveFile(item.file) && `${item.path}${item.file.name}` === path
      );
      return file && isArchiveFile(file.file)
        ? file.file.extract()
        : Promise.reject(new Error("Archive entry not found"));
    },
    close: () => archive.close(),
  };
}
