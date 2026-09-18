import path from "node:path";

import { readExampleFile, readRegistryFile } from "@/lib/read-file";

const readOptional = async (
  reader: (relativePath: string) => Promise<string>,
  relativePath: string
): Promise<string | null> => {
  try {
    return await reader(relativePath);
  } catch {
    return null;
  }
};

const normalizeSourcePath = (relativePath: string): string | null => {
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  if (path.posix.isAbsolute(normalized) || normalized.startsWith("../")) {
    return null;
  }
  return normalized;
};

export const readOptionalFromRoot = (
  relativePath: string
): Promise<string | null> => {
  const normalized = normalizeSourcePath(relativePath);
  if (normalized?.startsWith("registry/")) {
    return readOptional(readRegistryFile, normalized.slice("registry/".length));
  }
  if (normalized?.startsWith("examples/")) {
    return readOptional(readExampleFile, normalized.slice("examples/".length));
  }
  return Promise.resolve(null);
};

export const getRegistryUiSourceCandidates = ({ name }: { name: string }) => [
  path.join("registry", "new-york", `${name}.tsx`),
];

export const getDemoSource = (name: string): Promise<string | null> =>
  readOptional(readExampleFile, `${name}.tsx`);

export const getRegistrySource = async (
  name: string
): Promise<string | null> => {
  const candidates = getRegistryUiSourceCandidates({ name });

  for (const candidate of candidates) {
    const code = await readOptional(
      readRegistryFile,
      candidate.slice("registry/".length)
    );
    if (code) {
      return code;
    }
  }

  return null;
};
