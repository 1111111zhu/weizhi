import { DesktopAgentDownloadsController } from "./downloads.controller";

const storage = {
  getDownloadObject: vi.fn(),
  getObjectBuffer: vi.fn(),
};

describe(DesktopAgentDownloadsController, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OSS_PREFIX;
    delete process.env.DESKTOP_AGENT_OSS_PREFIX;
    delete process.env.DESKTOP_AGENT_WINDOWS_OSS_PREFIX;
    delete process.env.DESKTOP_AGENT_MACOS_OSS_PREFIX;
    delete process.env.DESKTOP_AGENT_PUBLIC_API_BASE_URL;
    delete process.env.FRONTEND_URL;
  });

  it("redirects macOS installer downloads through a signed storage URL", async () => {
    storage.getDownloadObject.mockReturnValue({
      fileName: "desktop-agent-macos-arm64.pkg",
      mimeType: "application/vnd.apple.installer+xml",
      redirectUrl: "https://oss.example/macos-signed",
    });
    const controller = await createController();
    const response = createResponse();

    controller.downloadMacOSLatest(response as never);

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "desktop-agent/macos/desktop-agent-macos-arm64.pkg",
      "desktop-agent-macos-arm64.pkg",
      "application/vnd.apple.installer+xml"
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      "https://oss.example/macos-signed"
    );
  });

  it("supports a dedicated macOS OSS prefix", async () => {
    process.env.DESKTOP_AGENT_MACOS_OSS_PREFIX =
      "/desktop-agent/releases/macos/";
    storage.getDownloadObject.mockReturnValue({
      fileName: "desktop-agent-macos-arm64.pkg",
      mimeType: "application/vnd.apple.installer+xml",
      redirectUrl: "https://oss.example/macos-signed",
    });
    const controller = await createController();

    controller.downloadMacOSLatest(createResponse() as never);

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "desktop-agent/releases/macos/desktop-agent-macos-arm64.pkg",
      "desktop-agent-macos-arm64.pkg",
      "application/vnd.apple.installer+xml"
    );
  });

  it("redirects Windows installer downloads through a signed storage URL", async () => {
    storage.getDownloadObject.mockReturnValue({
      fileName: "desktop-agent-win-x64.exe",
      mimeType: "application/octet-stream",
      redirectUrl: "https://oss.example/signed",
    });
    const controller = await createController();
    const response = createResponse();

    controller.downloadWindowsLatest(response as never);

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "desktop-agent/windows/desktop-agent-win-x64.exe",
      "desktop-agent-win-x64.exe",
      "application/octet-stream"
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      "https://oss.example/signed"
    );
    expect(response.download).not.toHaveBeenCalled();
  });

  it("returns a validated Windows release manifest with the API download URL", async () => {
    storage.getObjectBuffer.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          version: "0.2.1",
          platform: "windows",
          architecture: "x64",
          installerFileName: "desktop-agent-win-x64-0.2.1.exe",
          sha256: "a".repeat(64),
          fileSize: 123_456,
          publishedAt: "2026-07-27T12:00:00.000Z",
          minimumSupportedVersion: "0.2.0",
          minimumSelfUpdateVersion: "0.1.10",
          signaturePolicy: "optional",
        })
      )
    );
    const controller = await createController();
    const manifest = await controller.getWindowsManifest({
      protocol: "https",
      originalUrl: "/api/downloads/desktop-agent/windows/manifest",
      get: (name: string) => (name === "host" ? "emp.wzcpa.hk" : undefined),
    } as never);

    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "desktop-agent/windows/latest.json"
    );
    expect(manifest).toMatchObject({
      version: "0.2.1",
      downloadUrl:
        "https://emp.wzcpa.hk/api/downloads/desktop-agent/windows/releases/0.2.1",
      fileSize: 123_456,
      signaturePolicy: "optional",
    });
  });

  it("uses the public forwarded origin for the manifest download URL", async () => {
    storage.getObjectBuffer.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          version: "0.2.7",
          platform: "windows",
          architecture: "x64",
          installerFileName: "desktop-agent-win-x64-0.2.7.exe",
          sha256: "b".repeat(64),
          fileSize: 154_445_312,
          publishedAt: "2026-07-28T08:19:59.419Z",
          minimumSupportedVersion: "0.1.23",
          minimumSelfUpdateVersion: "0.1.10",
        })
      )
    );
    const controller = await createController();
    const manifest = await controller.getWindowsManifest({
      protocol: "http",
      originalUrl: "/downloads/desktop-agent/windows/manifest",
      get: (name: string) =>
        ({
          host: "api:3000",
          "x-forwarded-host": "emp.superfx.cn, reverse-proxy",
          "x-forwarded-proto": "https, http",
          "x-forwarded-prefix": "/api",
        })[name],
    } as never);

    expect(manifest.downloadUrl).toBe(
      "https://emp.superfx.cn/api/downloads/desktop-agent/windows/releases/0.2.7"
    );
  });

  it("uses the configured frontend URL when proxy headers contain an internal host", async () => {
    process.env.FRONTEND_URL = "https://emp.superfx.cn";
    storage.getObjectBuffer.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          version: "0.2.7",
          platform: "windows",
          architecture: "x64",
          installerFileName: "desktop-agent-win-x64-0.2.7.exe",
          sha256: "c".repeat(64),
          fileSize: 154_445_312,
          publishedAt: "2026-07-28T08:19:59.419Z",
          minimumSupportedVersion: "0.1.23",
          minimumSelfUpdateVersion: "0.1.10",
        })
      )
    );
    const controller = await createController();
    const manifest = await controller.getWindowsManifest({
      protocol: "http",
      originalUrl: "/downloads/desktop-agent/windows/manifest",
      get: (name: string) =>
        ({
          host: "api:3000",
          "x-forwarded-host": "api:3000",
          "x-forwarded-prefix": "/api",
        })[name],
    } as never);

    expect(manifest.downloadUrl).toBe(
      "https://emp.superfx.cn/api/downloads/desktop-agent/windows/releases/0.2.7"
    );
  });

  it("downloads the immutable Windows installer selected by the manifest", async () => {
    storage.getDownloadObject.mockReturnValue({
      fileName: "desktop-agent-win-x64-0.2.1.exe",
      mimeType: "application/octet-stream",
      redirectUrl: "https://oss.example/versioned-signed",
    });
    const controller = await createController();
    const response = createResponse();

    controller.downloadWindowsRelease("0.2.1", response as never);

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "desktop-agent/windows/releases/v0.2.1/desktop-agent-win-x64-0.2.1.exe",
      "desktop-agent-win-x64-0.2.1.exe",
      "application/octet-stream"
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      "https://oss.example/versioned-signed"
    );
  });

  it("rejects unsafe Windows release versions", async () => {
    const controller = await createController();

    expect(() =>
      controller.downloadWindowsRelease("../latest", createResponse() as never)
    ).toThrow("Desktop Agent release version is invalid");
    expect(storage.getDownloadObject).not.toHaveBeenCalled();
  });

  it("fails safely when the Windows release manifest is unavailable", async () => {
    storage.getObjectBuffer.mockRejectedValue(new Error("missing"));
    const controller = await createController();

    await expect(
      controller.getWindowsManifest({
        protocol: "https",
        originalUrl: "/api/downloads/desktop-agent/windows/manifest",
        get: () => "emp.wzcpa.hk",
      } as never)
    ).rejects.toThrow("Desktop Agent release manifest is unavailable");
  });

  it("uses the configured OSS prefix without allowing path traversal", async () => {
    process.env.OSS_PREFIX = "/desktop-agent/releases/";
    storage.getDownloadObject.mockReturnValue({
      fileName: "desktop-agent-win-x64.exe",
      mimeType: "application/octet-stream",
      redirectUrl: "https://oss.example/signed",
    });
    const controller = await createController();

    controller.downloadWindowsLatest(createResponse() as never);

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "desktop-agent/releases/desktop-agent-win-x64.exe",
      "desktop-agent-win-x64.exe",
      "application/octet-stream"
    );
  });

  it("rejects unsafe configured OSS prefixes", async () => {
    process.env.DESKTOP_AGENT_OSS_PREFIX = "../working-papers";
    const controller = await createController();

    expect(() =>
      controller.downloadWindowsLatest(createResponse() as never)
    ).toThrow("Desktop Agent OSS prefix is unsafe");
    expect(storage.getDownloadObject).not.toHaveBeenCalled();
  });
});

function createController() {
  return new DesktopAgentDownloadsController(storage as never);
}

function createResponse() {
  return {
    redirect: vi.fn(),
    type: vi.fn(),
    download: vi.fn(),
  };
}
