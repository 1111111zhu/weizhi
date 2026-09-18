import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const projectName = "ProjectWingDesktopAgent";

await scaffoldWindows();
await scaffoldMacOS();

async function scaffoldWindows() {
  const appRoot = path.join(repositoryRoot, "apps/desktop-agent-windows");
  await assertDirectoryMissing(path.join(appRoot, "windows"));
  const requireFromApp = createRequire(path.join(appRoot, "package.json"));
  const packagePath = requireFromApp.resolve(
    "react-native-windows/package.json"
  );
  const requireFromRnw = createRequire(packagePath);
  const templateRoot = path.join(
    path.dirname(packagePath),
    "templates/cpp-app"
  );
  const files = await listFiles(templateRoot);
  for (const source of files) {
    const relativePath = path.relative(templateRoot, source);
    if (["metro.config.js", "template.config.js"].includes(relativePath)) {
      continue;
    }
    await copyWindowsFile(appRoot, source, relativePath, requireFromRnw);
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

async function copyWindowsFile(appRoot, source, relativePath, requireFromRnw) {
  const renamedPath = relativePath
    .replaceAll("MyApp", projectName)
    .replace("NuGet_Config", "NuGet.config")
    .replace("_gitignore", ".gitignore");
  const destination = path.join(appRoot, renamedPath);
  await mkdir(path.dirname(destination), { recursive: true });
  const extension = path.extname(source);
  if ([".ico", ".png", ".rc"].includes(extension)) {
    await copyFile(source, destination);
    return;
  }
  const cliPath = requireFromRnw.resolve("@react-native-windows/cli");
  const requireFromCli = createRequire(cliPath);
  const mustache = requireFromCli("mustache");
  const contents = mustache.render(
    await readFile(source, "utf-8"),
    windowsReplacements()
  );
  await writeFile(destination, contents, "utf-8");
}

function windowsReplacements() {
  const packageGuid = "{D2846632-6DCD-4CD1-9CE5-4ED830BB0AA6}";
  const projectGuid = "{5D91B105-C70A-4BE3-A63D-106534DE339D}";
  return {
    name: projectName,
    namespace: "ProjectWing.DesktopAgent",
    namespaceCpp: "ProjectWing::DesktopAgent",
    rnwVersion: "0.84.0",
    rnwPathFromProjectRoot: "node_modules\\react-native-windows",
    mainComponentName: projectName,
    projectGuidLower: projectGuid.toLowerCase(),
    projectGuidUpper: projectGuid,
    packageGuidLower: packageGuid.toLowerCase(),
    packageGuidUpper: packageGuid,
    currentUser: "ProjectWing",
    devMode: false,
    useNuGets: true,
    addReactNativePublicAdoFeed: true,
    cppNugetPackages: [],
    autolinkPropertiesForProps: "",
    autolinkProjectReferencesForTargets: "",
    autolinkCppIncludes: "",
    autolinkCppPackageProviders:
      "\n    UNREFERENCED_PARAMETER(packageProviders);",
  };
}

async function scaffoldMacOS() {
  const appRoot = path.join(repositoryRoot, "apps/desktop-agent-macos");
  const requireFromApp = createRequire(path.join(appRoot, "package.json"));
  const packagePath = requireFromApp.resolve("react-native-macos/package.json");
  const packageRoot = path.dirname(packagePath);
  const generator = requireFromApp(
    path.join(packageRoot, "local-cli/generator-macos")
  );
  const templates = path.join(
    packageRoot,
    "local-cli/generator-macos/templates"
  );
  await assertDirectoryMissing(path.join(appRoot, "macos"));
  generator.copyProjectTemplateAndReplace(templates, appRoot, projectName, {
    overwrite: true,
  });
}

async function assertDirectoryMissing(directory) {
  try {
    const directoryStats = await stat(directory);
    if (directoryStats.isDirectory()) {
      throw new Error(`Native host already exists: ${directory}`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}
