import pathModule from "node:path";

import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import { DesktopAgentReleaseManifestSchema } from "@project-wing/shared";
import type { Request, Response } from "express";

import {
  ApiBadRequestException,
  ApiServiceUnavailableException,
} from "../common/api-error";
import { StorageService } from "../storage/storage.service";
import type { DownloadObject } from "../storage/storage.service";

const DEFAULT_MACOS_OSS_PREFIX = "desktop-agent/macos";
const DEFAULT_WINDOWS_OSS_PREFIX = "desktop-agent/windows";
const MACOS_INSTALLER_FILE_NAME = "desktop-agent-macos-arm64.pkg";
const MACOS_INSTALLER_MIME_TYPE = "application/vnd.apple.installer+xml";
const WINDOWS_INSTALLER_FILE_NAME = "desktop-agent-win-x64.exe";
const WINDOWS_INSTALLER_MIME_TYPE = "application/octet-stream";
const WINDOWS_MANIFEST_FILE_NAME = "latest.json";

@Controller("downloads/desktop-agent")
export class DesktopAgentDownloadsController {
  constructor(private readonly storage: StorageService) {}

  @Get("windows/latest")
  downloadWindowsLatest(@Res() response: Response) {
    const file = this.storage.getDownloadObject(
      getInstallerObjectKey("windows", WINDOWS_INSTALLER_FILE_NAME),
      WINDOWS_INSTALLER_FILE_NAME,
      WINDOWS_INSTALLER_MIME_TYPE
    );
    return sendDownloadObject(response, file);
  }

  @Get("windows/manifest")
  async getWindowsManifest(@Req() request: Request) {
    try {
      const body = await this.storage.getObjectBuffer(
        getInstallerObjectKey("windows", WINDOWS_MANIFEST_FILE_NAME)
      );
      const stored = JSON.parse(body.toString("utf-8")) as Record<
        string,
        unknown
      >;
      const version = readReleaseVersion(stored.version);
      const installerFileName = readVersionedInstallerFileName(
        stored.installerFileName,
        version
      );
      const downloadUrl = getPublicRequestUrl(
        request,
        request.originalUrl.replace(
          /\/manifest(?:\?.*)?$/,
          `/releases/${encodeURIComponent(version)}`
        )
      );
      return DesktopAgentReleaseManifestSchema.parse({
        ...stored,
        version,
        installerFileName,
        downloadUrl,
      });
    } catch {
      throw new ApiServiceUnavailableException(
        "DESKTOP_AGENT_RELEASE_UNAVAILABLE",
        "Desktop Agent release manifest is unavailable"
      );
    }
  }

  @Get("windows/releases/:version")
  downloadWindowsRelease(
    @Param("version") rawVersion: string,
    @Res() response: Response
  ) {
    const version = readReleaseVersion(rawVersion);
    const fileName = getVersionedWindowsInstallerFileName(version);
    const file = this.storage.getDownloadObject(
      getInstallerObjectKey("windows", `releases/v${version}/${fileName}`),
      fileName,
      WINDOWS_INSTALLER_MIME_TYPE
    );
    return sendDownloadObject(response, file);
  }

  @Get("windows/updates/:fileName")
  downloadWindowsUpdate(
    @Param("fileName") rawFileName: string,
    @Res() response: Response
  ) {
    const fileName = readVelopackUpdateFileName(rawFileName);
    const file = this.storage.getDownloadObject(
      getInstallerObjectKey("windows", `updates/${fileName}`),
      fileName,
      getVelopackAssetMimeType(fileName)
    );
    return sendDownloadObject(response, file);
  }

  @Get("macos/latest")
  downloadMacOSLatest(@Res() response: Response) {
    const file = this.storage.getDownloadObject(
      getInstallerObjectKey("macos", MACOS_INSTALLER_FILE_NAME),
      MACOS_INSTALLER_FILE_NAME,
      MACOS_INSTALLER_MIME_TYPE
    );
    return sendDownloadObject(response, file);
  }
}

function getPublicRequestOrigin(request: Request) {
  const protocol =
    readForwardedHeader(request.get("x-forwarded-proto")) ?? request.protocol;
  const host =
    readForwardedHeader(request.get("x-forwarded-host")) ?? request.get("host");
  if (!host) {
    throw new Error("Desktop Agent manifest request host is unavailable");
  }
  return `${protocol}://${host}`;
}

function getPublicRequestUrl(request: Request, path: string) {
  const configuredApiBaseUrl = getConfiguredPublicApiBaseUrl();
  if (configuredApiBaseUrl) {
    const baseUrl = new URL(configuredApiBaseUrl);
    const basePath = baseUrl.pathname.replaceAll(/\/+$/g, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const pathWithoutDuplicateBase =
      basePath && normalizedPath.startsWith(`${basePath}/`)
        ? normalizedPath.slice(basePath.length)
        : normalizedPath;
    return new URL(
      `${basePath}${pathWithoutDuplicateBase}`,
      baseUrl.origin
    ).toString();
  }

  const forwardedPrefix = readForwardedHeader(
    request.get("x-forwarded-prefix")
  )?.replaceAll(/\/+$/g, "");
  const publicPath =
    forwardedPrefix && !path.startsWith(`${forwardedPrefix}/`)
      ? `${forwardedPrefix}${path.startsWith("/") ? "" : "/"}${path}`
      : path;
  return new URL(publicPath, `${getPublicRequestOrigin(request)}/`).toString();
}

function getConfiguredPublicApiBaseUrl() {
  const explicit = process.env.DESKTOP_AGENT_PUBLIC_API_BASE_URL?.trim();
  if (explicit) {
    return validatePublicApiBaseUrl(explicit);
  }

  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (!frontendUrl) {
    return;
  }
  const frontend = validatePublicApiBaseUrl(frontendUrl);
  return new URL("/api/", `${frontend}/`).toString();
}

function validatePublicApiBaseUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Desktop Agent public API base URL is invalid");
  }
  return url.toString();
}

function readForwardedHeader(value: string | undefined) {
  return value?.split(",", 1)[0]?.trim() || undefined;
}

function getInstallerObjectKey(
  platform: "windows" | "macos",
  fileName: string
) {
  const prefix = normalizeDesktopAgentOssPrefix(
    resolveDesktopAgentOssPrefix(platform)
  );
  return prefix ? `${prefix}/${fileName}` : fileName;
}

function resolveDesktopAgentOssPrefix(platform: "windows" | "macos") {
  if (platform === "macos") {
    return (
      process.env.DESKTOP_AGENT_MACOS_OSS_PREFIX ?? DEFAULT_MACOS_OSS_PREFIX
    );
  }
  return (
    process.env.DESKTOP_AGENT_WINDOWS_OSS_PREFIX ??
    process.env.DESKTOP_AGENT_OSS_PREFIX ??
    process.env.OSS_PREFIX ??
    DEFAULT_WINDOWS_OSS_PREFIX
  );
}

function normalizeDesktopAgentOssPrefix(prefix: string) {
  const normalized = prefix.trim().replaceAll(/^\/+|\/+$/g, "");
  if (!normalized) {
    return "";
  }
  if (
    normalized.includes("\\") ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    pathModule.posix.normalize(normalized) !== normalized
  ) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Desktop Agent OSS prefix is unsafe"
    );
  }
  return normalized;
}

function readReleaseVersion(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)
  ) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Desktop Agent release version is invalid"
    );
  }
  return value;
}

function getVersionedWindowsInstallerFileName(version: string) {
  return `desktop-agent-win-x64-${version}.exe`;
}

function readVersionedInstallerFileName(value: unknown, version: string) {
  const expected = getVersionedWindowsInstallerFileName(version);
  if (value !== undefined && value !== expected) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Desktop Agent release installer name is invalid"
    );
  }
  return expected;
}

function readVelopackUpdateFileName(value: string) {
  const fixedNames = new Set([
    "RELEASES",
    "assets.win.json",
    "releases.win.json",
    "com.superfx.projectwing.desktop-agent-win-Setup.exe",
    "com.superfx.projectwing.desktop-agent-win-Portable.zip",
  ]);
  const packagePattern =
    /^com\.superfx\.projectwing\.desktop-agent-\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?-(?:full|delta)\.nupkg$/;
  if (!fixedNames.has(value) && !packagePattern.test(value)) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Desktop Agent update asset name is invalid"
    );
  }
  return value;
}

function getVelopackAssetMimeType(fileName: string) {
  return fileName.endsWith(".json")
    ? "application/json"
    : "application/octet-stream";
}

function sendDownloadObject(response: Response, file: DownloadObject) {
  if (file.redirectUrl) {
    return response.redirect(302, file.redirectUrl);
  }
  if (!file.absolutePath) {
    throw new ApiBadRequestException("BAD_REQUEST", "文件下载地址无效");
  }
  response.type(file.mimeType);
  return response.download(file.absolutePath, file.fileName);
}
