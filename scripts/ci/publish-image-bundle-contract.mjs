function nextArgument(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { images: [], prefix: "ci-images" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--image") {
      args.images.push(nextArgument(argv, index, argument));
      index += 1;
    } else if (
      [
        "--bundle",
        "--commit",
        "--systems",
        "--prefix",
        "--output",
        "--uncompressed-size",
      ].includes(argument)
    ) {
      args[argument.slice(2).replaceAll("-", "_")] = nextArgument(
        argv,
        index,
        argument
      );
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  for (const name of [
    "bundle",
    "commit",
    "systems",
    "output",
    "uncompressed_size",
  ]) {
    if (!args[name]) {
      throw new Error(
        `Missing required argument: --${name.replaceAll("_", "-")}`
      );
    }
  }
  if (args.images.length === 0) {
    throw new Error("Missing required argument: --image");
  }
  return args;
}

export function createManifest(args, bundleKey, bundleSha256, bundleSize) {
  const uncompressedSize = Number(args.uncompressed_size);
  if (!Number.isSafeInteger(uncompressedSize) || uncompressedSize <= 0) {
    throw new Error("--uncompressed-size must be a positive integer");
  }
  return {
    schemaVersion: 2,
    commit: args.commit,
    createdAt: new Date().toISOString(),
    systems: args.systems.split(",").filter(Boolean),
    images: args.images,
    bundle: {
      key: bundleKey,
      sha256: bundleSha256,
      size: bundleSize,
      uncompressedSize,
    },
  };
}
