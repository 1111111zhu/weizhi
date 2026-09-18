#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const DOTNET_PROJECTS = [
  {
    directory: "apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime",
    project: "ProjectWing.DesktopAgent.Runtime.csproj",
  },
  {
    directory: "apps/desktop-agent/manager/ProjectWing.AgentManager",
    project: "ProjectWing.AgentManager.csproj",
  },
  {
    directory: "apps/desktop-agent/watcher/ProjectWing.ExcelWatcher",
    project: "ProjectWing.ExcelWatcher.csproj",
  },
];

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

export function resolveDotnetFormatTargets(
  paths,
  rootDirectory = process.cwd()
) {
  const targets = new Map();

  for (const rawPath of paths) {
    if (!rawPath.endsWith(".cs")) {
      continue;
    }

    const filePath = normalizePath(
      path.relative(rootDirectory, path.resolve(rawPath))
    );
    const project = DOTNET_PROJECTS.find(({ directory }) =>
      filePath.startsWith(`${directory}/`)
    );

    if (!project) {
      continue;
    }

    const files = targets.get(project.directory) ?? [];
    files.push(filePath.slice(project.directory.length + 1));
    targets.set(project.directory, files);
  }

  return DOTNET_PROJECTS.flatMap((project) => {
    const files = targets.get(project.directory);
    return files ? [{ ...project, files }] : [];
  });
}

function runDotnetFormat({ directory, project, files }, check) {
  const args = ["format", project, "whitespace", "--no-restore"];
  if (check) {
    args.push("--verify-no-changes");
  }
  args.push("--include", ...files);

  const result = spawnSync("dotnet", args, {
    cwd: directory,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main(argumentsList) {
  const check = argumentsList.includes("--check");
  const all = argumentsList.includes("--all");
  const files = argumentsList.filter((argument) => !argument.startsWith("--"));
  const targets = all
    ? DOTNET_PROJECTS.map((project) => ({ ...project, files: ["."] }))
    : resolveDotnetFormatTargets(files);

  for (const target of targets) {
    runDotnetFormat(target, check);
  }
}

if (process.argv[1] === import.meta.filename) {
  main(process.argv.slice(2));
}
