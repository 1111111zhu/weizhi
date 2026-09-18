#!/usr/bin/env node
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";

export const CHUNK_SIZE = 4 * 1024 * 1024;
export const MAX_ATTEMPTS = 12;
export const PARALLEL_DOWNLOADS = 8;
export function parseArgs(argumentsList) {
  const values = {
    registryUrl: "https://ghcr.io",
    tokenUrl: "https://ghcr.io/token",
  };
  let selection;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--all") {
      if (selection) {
        fail("--expected-name and --all are mutually exclusive");
      }
      selection = "all";
      values.all = true;
      continue;
    }
    const name = {
      "--repository": "repository",
      "--tag": "tag",
      "--expected-name": "expectedName",
      "--output": "output",
      "--registry-url": "registryUrl",
      "--token-url": "tokenUrl",
    }[argument];
    if (!name) {
      fail(`Unknown argument: ${argument}`);
    }
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Argument requires a value: ${argument}`);
    }
    if (name === "expectedName") {
      if (selection) {
        fail("--expected-name and --all are mutually exclusive");
      }
      selection = "expectedName";
    }
    values[name] = value;
    index += 1;
  }
  for (const name of ["repository", "tag", "output"]) {
    if (!values[name]) {
      fail(
        `Argument is required: --${name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
      );
    }
  }
  if (!selection) {
    fail("Exactly one of --expected-name or --all is required");
  }
  return values;
}
export function requiredEnvironment(name, environment = process.env) {
  const value = environment[name]?.trim();
  if (!value) {
    fail(`Required environment variable is missing: ${name}`);
  }
  return value;
}
async function fetchResponse(url, options = {}, timeoutMs = 30_000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response;
}
const fetchJson = async (url, options) => {
  const response = await fetchResponse(url, options);
  return response.json();
};
export async function bearerToken(args, environment = process.env) {
  const username = requiredEnvironment("GHCR_USERNAME", environment);
  const password = requiredEnvironment("GHCR_TOKEN", environment);
  const basic = Buffer.from(`${username}:${password}`).toString("base64");
  const query = new URLSearchParams({
    service: "ghcr.io",
    scope: `repository:${args.repository}:pull`,
  });
  const payload = await fetchJson(`${args.tokenUrl}?${query}`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  const token = payload.token ?? payload.access_token;
  if (!token) {
    fail("GHCR token response is missing token");
  }
  return token;
}
export async function fetchLayers(args, token) {
  const tag = encodeURIComponent(args.tag);
  const payload = await fetchJson(
    `${args.registryUrl}/v2/${args.repository}/manifests/${tag}`,
    {
      headers: {
        Accept: "application/vnd.oci.image.manifest.v1+json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return payload.layers ?? [];
}
export async function fetchLayer(args, token) {
  const layers = await fetchLayers(args, token);
  const layer = layers.find(
    (candidate) =>
      candidate.annotations?.["org.opencontainers.image.title"] ===
      args.expectedName
  );
  if (!layer) {
    fail(`Installer layer not found in ${args.tag}: ${args.expectedName}`);
  }
  return layer;
}
export function chunkPath(chunkRoot, offset) {
  return path.join(chunkRoot, `${String(offset).padStart(12, "0")}.chunk`);
}
async function fileSize(file) {
  try {
    const fileStats = await fs.stat(file);
    return fileStats.size;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
export async function downloadChunk(blobUrl, token, offset, end, target) {
  const expectedSize = end - offset + 1;
  let failures = 0;
  while (failures < MAX_ATTEMPTS) {
    if ((await fileSize(target)) === expectedSize) {
      return;
    }
    await fs.unlink(target).catch((error) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
    try {
      const response = await fetchResponse(
        blobUrl,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Range: `bytes=${offset}-${end}`,
          },
        },
        90_000
      );
      if (response.status !== 206) {
        throw new Error(
          `Registry ignored byte range ${offset}-${end}: HTTP ${response.status}`
        );
      }
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length !== expectedSize) {
        throw new Error(`Short byte range ${offset}-${end}`);
      }
      await fs.writeFile(target, body);
    } catch (error) {
      failures += 1;
      console.error(
        `GHCR range ${offset}-${end} interrupted (failure ${failures}/${MAX_ATTEMPTS}): ${error.message}`
      );
      if (failures === MAX_ATTEMPTS) {
        throw error;
      }
      const delay = Math.min(failures * 2, 20) * 1000;
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
      continue;
    }
    console.log(`GHCR range complete: ${offset}-${end}`);
  }
}
export async function migratePartial(partial, chunkRoot) {
  await fs.mkdir(chunkRoot, { recursive: true });
  if ((await fileSize(partial)) === null) {
    return;
  }
  const source = await fs.open(partial, "r");
  try {
    const buffer = Buffer.allocUnsafe(CHUNK_SIZE);
    let offset = 0;
    while (true) {
      const { bytesRead } = await source.read(buffer, 0, CHUNK_SIZE, null);
      if (bytesRead !== CHUNK_SIZE) {
        break;
      }
      await fs.writeFile(
        chunkPath(chunkRoot, offset),
        buffer.subarray(0, bytesRead)
      );
      offset += bytesRead;
    }
  } finally {
    await source.close();
  }
  await fs.unlink(partial);
}
async function runWithConcurrency(items, concurrency, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next];
        next += 1;
        await worker(item);
      }
    })
  );
}
export async function downloadBlob(args, token, layer, partial) {
  const expectedSize = Number(layer.size);
  const blobUrl = `${args.registryUrl}/v2/${args.repository}/blobs/${layer.digest}`;
  const chunkRoot = `${partial}.chunks`;
  await migratePartial(partial, chunkRoot);
  const ranges = [];
  for (let offset = 0; offset < expectedSize; offset += CHUNK_SIZE) {
    ranges.push({
      offset,
      end: Math.min(offset + CHUNK_SIZE, expectedSize) - 1,
    });
  }
  await runWithConcurrency(ranges, PARALLEL_DOWNLOADS, ({ offset, end }) =>
    downloadChunk(blobUrl, token, offset, end, chunkPath(chunkRoot, offset))
  );
  const output = await fs.open(partial, "w");
  try {
    for (const { offset } of ranges) {
      const source = await fs.open(chunkPath(chunkRoot, offset), "r");
      try {
        const buffer = Buffer.allocUnsafe(CHUNK_SIZE);
        while (true) {
          const { bytesRead } = await source.read(buffer, 0, CHUNK_SIZE, null);
          if (!bytesRead) {
            break;
          }
          await output.write(buffer.subarray(0, bytesRead));
        }
      } finally {
        await source.close();
      }
    }
  } finally {
    await output.close();
  }
  return chunkRoot;
}
export async function sha256File(file) {
  const digest = createHash("sha256");
  const source = await fs.open(file, "r");
  try {
    const buffer = Buffer.allocUnsafe(CHUNK_SIZE);
    while (true) {
      const { bytesRead } = await source.read(buffer, 0, CHUNK_SIZE, null);
      if (!bytesRead) {
        break;
      }
      digest.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await source.close();
  }
  return `sha256:${digest.digest("hex")}`;
}
export async function removeChunks(chunkRoot) {
  const names = await fs.readdir(chunkRoot).catch((error) => {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  await Promise.all(names.map((name) => fs.unlink(path.join(chunkRoot, name))));
  await fs.rmdir(chunkRoot);
}
export async function hasCachedTarget(target, layer) {
  if ((await fileSize(target)) !== Number(layer.size)) {
    await fs.unlink(target).catch((error) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
    return false;
  }
  if ((await sha256File(target)) !== layer.digest) {
    await fs.unlink(target);
    return false;
  }
  console.log(`Using cached GHCR asset: ${path.basename(target)}`);
  return true;
}
export async function downloadLayer(args, token, name, layer) {
  const target = path.join(args.output, name);
  const partial = `${target}.part`;
  console.log(JSON.stringify({ name, size: layer.size, digest: layer.digest }));
  if (await hasCachedTarget(target, layer)) {
    return;
  }
  const chunkRoot = await downloadBlob(args, token, layer, partial);
  const actualDigest = await sha256File(partial);
  if (actualDigest !== layer.digest) {
    await fs.unlink(partial).catch(() => {});
    await removeChunks(chunkRoot);
    fail(`GHCR asset checksum mismatch: ${actualDigest} != ${layer.digest}`);
  }
  await fs.rename(partial, target);
  await removeChunks(chunkRoot);
}
export async function main(
  argumentsList = process.argv.slice(2),
  environment = process.env
) {
  const args = parseArgs(argumentsList);
  args.output = path.resolve(args.output);
  await fs.mkdir(args.output, { recursive: true });
  const token = await bearerToken(args, environment);
  const layers = args.all
    ? await fetchLayers(args, token)
    : [await fetchLayer(args, token)];
  for (const layer of layers) {
    const name = layer.annotations?.["org.opencontainers.image.title"];
    if (!name) {
      fail("GHCR asset layer is missing a file name annotation");
    }
    await downloadLayer(args, token, name, layer);
  }
}
const fail = (message) => {
  throw new Error(message);
};
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
