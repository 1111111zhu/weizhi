import { readFile } from "node:fs/promises";
import path from "node:path";

type InlineEmailAsset = {
  cid: string;
  content: Buffer;
  contentDisposition: "inline";
  contentType: "image/png";
  filename: string;
};

const assetDefinitions = [
  {
    cid: "project-wing-brand",
    filename: "project-wing-email-mark.png",
  },
  {
    cid: "project-wing-verification-shield",
    filename: "project-wing-verification-shield.png",
  },
  {
    cid: "project-wing-verification-footer",
    filename: "project-wing-verification-footer.png",
  },
] as const;

const contentCache = new Map<string, Promise<Buffer>>();

export function resolveSystemEmailInlineAssets(html: string) {
  const selected = assetDefinitions.filter(({ cid }) =>
    html.includes(`cid:${cid}`)
  );
  return Promise.all(
    selected.map(async ({ cid, filename }): Promise<InlineEmailAsset> => ({
      cid,
      content: await readAsset(filename),
      contentDisposition: "inline",
      contentType: "image/png",
      filename,
    }))
  );
}

function readAsset(filename: string) {
  const cached = contentCache.get(filename);
  if (cached) {
    return cached;
  }
  const pending = readAssetFromKnownRoot(filename);
  contentCache.set(filename, pending);
  return pending;
}

async function readAssetFromKnownRoot(filename: string) {
  const roots = [
    path.join(process.cwd(), "apps/api/dist/mail/assets"),
    path.join(process.cwd(), "dist/mail/assets"),
    path.join(process.cwd(), "apps/api/src/mail/assets"),
    path.join(process.cwd(), "src/mail/assets"),
  ];
  let lastError: unknown;
  for (const root of roots) {
    try {
      return await readFile(path.join(root, filename));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
