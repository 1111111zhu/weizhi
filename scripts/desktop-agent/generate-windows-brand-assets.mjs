import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { pathToFileURL } from "node:url";

const { join, resolve } = nodePath;

const repoRoot = resolve(import.meta.dirname, "..", "..");
const edgePath = [
  process.env.PROJECT_WING_EDGE_PATH,
  process.env.ProgramFiles &&
    join(
      process.env.ProgramFiles,
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe"
    ),
  process.env["ProgramFiles(x86)"] &&
    join(
      process.env["ProgramFiles(x86)"],
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe"
    ),
  process.env.LOCALAPPDATA &&
    join(
      process.env.LOCALAPPDATA,
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe"
    ),
].find((candidate) => candidate && existsSync(candidate));
if (!edgePath) {
  throw new Error(
    "Microsoft Edge was not found. Set PROJECT_WING_EDGE_PATH to generate Windows brand assets."
  );
}
const sourcePath = join(
  repoRoot,
  "apps",
  "emp",
  "public",
  "brand",
  "icon-white-green.svg"
);
const sourceBytes = readFileSync(sourcePath);
const sourceSvg = sourceBytes.toString("base64");
const tempRoot = mkdtempSync(join(tmpdir(), "projectwing-weizhi-icons-"));

function renderLogo(width, height, logoSize, outputPath) {
  const htmlPath = join(tempRoot, `render-${width}x${height}-${logoSize}.html`);
  const profilePath = join(tempRoot, `edge-${width}x${height}-${logoSize}`);
  const left = Math.floor((width - logoSize) / 2);
  const top = Math.floor((height - logoSize) / 2);
  writeFileSync(
    htmlPath,
    `<!doctype html><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff}img{position:absolute;left:${left}px;top:${top}px;width:${logoSize}px;height:${logoSize}px}</style><img src="data:image/svg+xml;base64,${sourceSvg}">`
  );
  const result = spawnSync(
    edgePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      `--user-data-dir=${profilePath}`,
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { encoding: "utf-8" }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || `Edge failed to render ${outputPath}`);
  }
}

function writeIco(outputPath, framePaths, sizes) {
  const frames = framePaths.map((framePath) => readFileSync(framePath));
  const headerSize = 6 + frames.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let dataOffset = headerSize;
  frames.forEach((frame, index) => {
    const size = sizes[index];
    const entryOffset = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entryOffset);
    header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(frame.length, entryOffset + 8);
    header.writeUInt32LE(dataOffset, entryOffset + 12);
    dataOffset += frame.length;
  });
  writeFileSync(outputPath, Buffer.concat([header, ...frames]));
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function normalizedSourceSha256(source) {
  return createHash("sha256")
    .update(source.toString("utf-8").replaceAll("\r\n", "\n"), "utf-8")
    .digest("hex");
}

try {
  const frameSizes = [16, 24, 32, 48, 64, 128, 256];
  const framePaths = frameSizes.map((size) => {
    const outputPath = join(tempRoot, `icon-${size}.png`);
    renderLogo(size, size, Math.max(12, Math.floor(size * 0.82)), outputPath);
    return outputPath;
  });
  const packageImages = join(
    repoRoot,
    "apps",
    "desktop-agent-windows",
    "windows",
    "ProjectWingDesktopAgent.Package",
    "Images"
  );
  const packageAssets = [
    [50, 50, 41, "StoreLogo.png"],
    [24, 24, 20, "Square44x44Logo.targetsize-24_altform-unplated.png"],
    [88, 88, 72, "Square44x44Logo.scale-200.png"],
    [300, 300, 246, "Square150x150Logo.scale-200.png"],
    [48, 48, 39, "LockScreenLogo.scale-200.png"],
    [620, 300, 180, "Wide310x150Logo.scale-200.png"],
    [1240, 600, 270, "SplashScreen.scale-200.png"],
  ];
  for (const [width, height, logoSize, fileName] of packageAssets) {
    renderLogo(width, height, logoSize, join(packageImages, fileName));
  }

  const nativeAssets = join(
    repoRoot,
    "apps",
    "desktop-agent-windows",
    "windows",
    "ProjectWingDesktopAgent"
  );
  for (const fileName of ["small.ico", "ProjectWingDesktopAgent.ico"]) {
    writeIco(join(nativeAssets, fileName), framePaths, frameSizes);
  }

  const assetPaths = [
    ...packageAssets.map((packageAsset) =>
      join("ProjectWingDesktopAgent.Package", "Images", packageAsset[3])
    ),
    ...["small.ico", "ProjectWingDesktopAgent.ico"].map((fileName) =>
      join("ProjectWingDesktopAgent", fileName)
    ),
  ];
  const windowsRoot = join(
    repoRoot,
    "apps",
    "desktop-agent-windows",
    "windows"
  );
  writeFileSync(
    join(windowsRoot, "brand-assets.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        source: "apps/emp/public/brand/icon-white-green.svg",
        sourceSha256: normalizedSourceSha256(sourceBytes),
        assets: Object.fromEntries(
          assetPaths.map((assetPath) => [
            assetPath.replaceAll("\\", "/"),
            sha256(join(windowsRoot, assetPath)),
          ])
        ),
      },
      null,
      2
    )}\n`
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
