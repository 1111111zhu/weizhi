import { readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import nodePath from "node:path";

const { join, resolve } = nodePath;

const scriptDirectory = import.meta.dirname;
const repositoryRoot = resolve(scriptDirectory, "../..");
const sourcePath = resolve(
  process.argv[2] ??
    join(repositoryRoot, "apps/emp/public/brand/icon-white-green.svg")
);
const projectDirectory = resolve(
  process.argv[3] ??
    join(
      repositoryRoot,
      "apps/desktop-agent-windows/windows/ProjectWingDesktopAgent"
    )
);
const pnpmDirectory = join(repositoryRoot, "node_modules/.pnpm");
const packageEntries = await readdir(pnpmDirectory);
const sharpPackage = packageEntries.find((name) => /^sharp@[^_]+$/.test(name));
if (!sharpPackage) {
  throw new Error(
    "The workspace sharp package is required to generate the icon."
  );
}

const require = createRequire(import.meta.url);
const sharp = require(join(pnpmDirectory, sharpPackage, "node_modules/sharp"));
const svg = await readFile(sourcePath);
const sizes = [256, 64, 48, 32, 16];
const frames = await Promise.all(
  sizes.map((size) =>
    sharp(svg, { density: 384 })
      .resize(size, size, { fit: "contain" })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer()
  )
);
const icon = createIcon(frames, sizes);
await Promise.all(
  ["ProjectWingDesktopAgent.ico", "small.ico"].map((fileName) =>
    writeFile(join(projectDirectory, fileName), icon)
  )
);

console.log(`Generated Project Wing brand icons from ${sourcePath}`);

function createIcon(images, imageSizes) {
  const directorySize = 6 + images.length * 16;
  const output = Buffer.alloc(
    directorySize + images.reduce((sum, image) => sum + image.length, 0)
  );
  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(1, 2);
  output.writeUInt16LE(images.length, 4);

  let imageOffset = directorySize;
  images.forEach((image, index) => {
    const entryOffset = 6 + index * 16;
    const size = imageSizes[index];
    output.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    output.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    output.writeUInt8(0, entryOffset + 2);
    output.writeUInt8(0, entryOffset + 3);
    output.writeUInt16LE(1, entryOffset + 4);
    output.writeUInt16LE(32, entryOffset + 6);
    output.writeUInt32LE(image.length, entryOffset + 8);
    output.writeUInt32LE(imageOffset, entryOffset + 12);
    image.copy(output, imageOffset);
    imageOffset += image.length;
  });
  return output;
}
