import { createHash } from "node:crypto";
import { createReadStream, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";

export const RETRY_ATTEMPTS = 8;
export const MAX_RETRY_DELAY_SECONDS = 30;
export const OSS_TIMEOUT_MS = 300_000;
export const UPLOAD_THREADS = 1;
export const SEMANTIC_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
export const DEFAULT_MINIMUM_SELF_UPDATE_VERSION = "0.2.10";
export const DEFAULT_WINDOWS_SIGNATURE_POLICY = "optional";
const PART_SIZE = 16 * 1024 * 1024;

export function fail(message) {
  throw new Error(message);
}

export function requiredEnvironment(name, environment = process.env) {
  const value = environment[name]?.trim();
  if (!value) {
    fail(`Required environment variable is missing: ${name}`);
  }
  return value;
}

export async function sha256File(file) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) {
    digest.update(chunk);
  }
  return digest.digest("hex");
}

export function objectKey(prefix, name) {
  return prefix ? `${prefix}/${name}` : name;
}

export function semanticVersionKey(value) {
  const match = SEMANTIC_VERSION_PATTERN.exec(value.trim());
  if (!match) {
    fail(`Invalid Desktop Agent version: ${value}`);
  }
  return match.slice(1).map(Number);
}

export function releaseVersionEnvironment(
  name,
  defaultValue,
  environment = process.env
) {
  const value = (environment[name] ?? defaultValue).trim();
  semanticVersionKey(value);
  return value;
}

export function windowsSignaturePolicy(environment = process.env) {
  const value = (
    environment.DESKTOP_AGENT_WINDOWS_SIGNATURE_POLICY ??
    DEFAULT_WINDOWS_SIGNATURE_POLICY
  )
    .trim()
    .toLowerCase();
  if (!["optional", "required"].includes(value)) {
    fail("Invalid Desktop Agent Windows signature policy");
  }
  return value;
}

function isRequestError(error, seen = new Set()) {
  if (!error || seen.has(error)) {
    return false;
  }
  seen.add(error);
  const transientNames = [
    "RequestError",
    "NetworkingError",
    "ConnectionTimeoutError",
    "ResponseTimeoutError",
    "ConnectionError",
  ];
  const transientCodes = [
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
  ];
  const message = String(error.message ?? "").toLowerCase();
  return (
    transientNames.includes(error.name) ||
    transientCodes.includes(error.code) ||
    message.includes("socket hang up") ||
    message.includes("hostunreachable") ||
    isRequestError(error.cause, seen)
  );
}

export async function retryOssOperation(
  operation,
  description,
  sleep = defaultSleep,
  attempts = RETRY_ATTEMPTS
) {
  const sleepFunction = sleep ?? defaultSleep;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      if (!isRequestError(error) || attempt === attempts) {
        throw error;
      }
      const delay = Math.min(2 ** (attempt - 1), MAX_RETRY_DELAY_SECONDS);
      console.log(
        `${description} network failure (${error.message}); retrying in ${delay}s (${attempt}/${attempts - 1}).`
      );
      await sleepFunction(delay * 1000);
    }
  }
}

async function defaultSleep(milliseconds) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function checkpointFile(key, environment = process.env) {
  const home = environment.HOME || environment.USERPROFILE || ".";
  return path.join(
    home,
    ".cache",
    "projectwing-oss-checkpoints",
    `${createHash("sha256").update(key).digest("hex")}.json`
  );
}

export async function resumableUpload(
  bucket,
  key,
  source,
  headers,
  description,
  progress,
  attempts = RETRY_ATTEMPTS
) {
  const checkpoint = checkpointFile(key);
  await fs.mkdir(path.dirname(checkpoint), { recursive: true });
  let savedCheckpoint;
  try {
    savedCheckpoint = JSON.parse(await fs.readFile(checkpoint, "utf-8"));
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) {
      throw error;
    }
  }
  await retryOssOperation(
    async () => {
      const options = {
        headers,
        parallel: UPLOAD_THREADS,
        partSize: PART_SIZE,
        progress: (percentage, nextCheckpoint) => {
          if (nextCheckpoint) {
            savedCheckpoint = nextCheckpoint;
            writeFileSync(checkpoint, JSON.stringify(nextCheckpoint));
          }
          progress?.(percentage);
        },
      };
      if (savedCheckpoint) {
        options.checkpoint = savedCheckpoint;
      }
      await bucket.multipartUpload(key, source.toString(), options);
      savedCheckpoint = undefined;
      await fs.unlink(checkpoint).catch((error) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      });
    },
    description,
    defaultSleep,
    attempts
  );
}

export async function uploadInstaller(
  bucket,
  installer,
  versionedKey,
  stableKey,
  stableName,
  sha256
) {
  const installerStats = await fs.stat(installer);
  const total = installerStats.size;
  let last = -10;
  await resumableUpload(
    bucket,
    versionedKey,
    installer,
    {
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `attachment; filename="${stableName}"`,
      "x-oss-meta-sha256": sha256,
    },
    "OSS upload",
    (fraction) => {
      const percent = Math.min(100, Math.floor(fraction * 100));
      if (percent < last + 10 && percent !== 100) {
        return;
      }
      last = percent;
      console.log(
        `OSS upload progress: ${percent}% (${Math.floor(total * fraction)}/${total} bytes)`
      );
    }
  );
  await retryOssOperation(
    () => bucket.copy(stableKey, versionedKey),
    "OSS stable object promotion"
  );
  await verifyRemoteObject(bucket, versionedKey, total, sha256);
  await verifyRemoteObject(bucket, stableKey, total, sha256);
}

export async function uploadReleaseAsset(bucket, asset, key, cacheControl) {
  const sha256 = await sha256File(asset);
  const assetStats = await fs.stat(asset);
  await resumableUpload(
    bucket,
    key,
    asset,
    { "Cache-Control": cacheControl, "x-oss-meta-sha256": sha256 },
    "OSS VeloPack asset upload"
  );
  await verifyRemoteObject(bucket, key, assetStats.size, sha256);
  return sha256;
}

export async function verifyRemoteObject(
  bucket,
  key,
  expectedSize,
  expectedSha256
) {
  const result = await bucket.head(key);
  const headers = result.res?.headers ?? result.headers ?? {};
  const actualSize = Number(
    headers["content-length"] ??
      headers["Content-Length"] ??
      result.contentLength ??
      0
  );
  if (actualSize !== expectedSize) {
    fail(
      `OSS object size mismatch for ${key}: expected ${expectedSize}, got ${actualSize}`
    );
  }
  const actualSha256 = String(
    headers["x-oss-meta-sha256"] ?? headers["X-Oss-Meta-Sha256"] ?? ""
  )
    .trim()
    .toLowerCase();
  if (actualSha256 !== expectedSha256.toLowerCase()) {
    fail(`OSS object SHA-256 metadata mismatch for ${key}`);
  }
}

export function ossClientOptions(environment = process.env) {
  const proxy =
    environment.OSS_PROXY?.trim() ||
    environment.ALL_PROXY?.trim() ||
    environment.HTTPS_PROXY?.trim() ||
    environment.HTTP_PROXY?.trim();
  return {
    region: environment.OSS_REGION?.trim() || undefined,
    endpoint: requiredEnvironment("OSS_ENDPOINT", environment),
    bucket: requiredEnvironment("OSS_BUCKET", environment),
    accessKeyId: requiredEnvironment("OSS_ACCESS_KEY_ID", environment),
    accessKeySecret: requiredEnvironment("OSS_ACCESS_KEY_SECRET", environment),
    secure: true,
    timeout: OSS_TIMEOUT_MS,
    enableProxy: Boolean(proxy),
    proxy,
  };
}

export async function createBucket(environment = process.env) {
  const { default: OSS } = await import("ali-oss");
  return new OSS(ossClientOptions(environment));
}
