import { DesktopAgentDownloadsController } from "./downloads.controller";

const storage = {
  getDownloadObject: vi.fn(),
  getObjectBuffer: vi.fn(),
};

describe("DesktopAgentDownloadsController Windows update feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OSS_PREFIX;
    delete process.env.DESKTOP_AGENT_OSS_PREFIX;
    delete process.env.DESKTOP_AGENT_WINDOWS_OSS_PREFIX;
  });

  it("redirects the VeloPack release index through a signed OSS URL", () => {
    storage.getDownloadObject.mockReturnValue({
      fileName: "releases.win.json",
      mimeType: "application/json",
      redirectUrl: "https://oss.example/releases-index-signed",
    });
    const controller = createController();
    const response = createResponse();

    controller.downloadWindowsUpdate("releases.win.json", response as never);

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "desktop-agent/windows/updates/releases.win.json",
      "releases.win.json",
      "application/json"
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      "https://oss.example/releases-index-signed"
    );
  });

  it("redirects immutable VeloPack packages through the update directory", () => {
    const packageName =
      "com.superfx.projectwing.desktop-agent-0.3.0-full.nupkg";
    storage.getDownloadObject.mockReturnValue({
      fileName: packageName,
      mimeType: "application/octet-stream",
      redirectUrl: "https://oss.example/package-signed",
    });
    const controller = createController();

    controller.downloadWindowsUpdate(packageName, createResponse() as never);

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      `desktop-agent/windows/updates/${packageName}`,
      packageName,
      "application/octet-stream"
    );
  });

  it.each([
    "../latest.json",
    "latest.json",
    "com.superfx.projectwing.desktop-agent-0.3.0-full.nupkg.exe",
  ])("rejects a non-VeloPack update asset: %s", (fileName) => {
    const controller = createController();

    expect(() =>
      controller.downloadWindowsUpdate(fileName, createResponse() as never)
    ).toThrow("Desktop Agent update asset name is invalid");
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
