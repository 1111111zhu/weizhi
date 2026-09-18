#!/usr/bin/env node
import { spawn } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export function createObfuscarConfiguration({
  inputAssembly,
  inputPath,
  outputPath,
}) {
  return `<?xml version="1.0" encoding="utf-8"?>
<Obfuscator>
  <Var name="InPath" value="${escapeXml(inputPath)}" />
  <Var name="OutPath" value="${escapeXml(outputPath)}" />
  <Var name="KeepPublicApi" value="true" />
  <Var name="HidePrivateApi" value="true" />
  <Var name="RenameProperties" value="false" />
  <Var name="RenameEvents" value="false" />
  <Var name="HideStrings" value="true" />
  <Module file="${escapeXml(inputAssembly)}" />
</Obfuscator>
`;
}

async function main(argumentsList) {
  const inputDirectory = readArgument(argumentsList, "--input");
  const assemblyName = readArgument(argumentsList, "--assembly");
  if (!inputDirectory || !assemblyName) {
    throw new Error(
      "Usage: obfuscate-dotnet-publish.mjs --input <publish-directory> --assembly <assembly.dll>"
    );
  }

  const inputPath = path.resolve(inputDirectory);
  const outputPath = path.join(inputPath, ".project-wing-obfuscated");
  const configPath = path.join(outputPath, "obfuscar.generated.xml");
  const inputAssembly = path.join(inputPath, assemblyName);
  const outputAssembly = path.join(outputPath, assemblyName);

  await rm(outputPath, { force: true, recursive: true });
  await mkdir(outputPath, { recursive: true });
  await writeFile(
    configPath,
    createObfuscarConfiguration({ inputAssembly, inputPath, outputPath }),
    "utf-8"
  );
  await run(process.env.PROJECT_WING_DESKTOP_DOTNET?.trim() || "dotnet", [
    "tool",
    "run",
    "obfuscar.console",
    configPath,
  ]);
  await cp(outputAssembly, inputAssembly, { force: true });
  await rm(outputPath, { force: true, recursive: true });
}

function readArgument(argumentsList, name) {
  const index = argumentsList.indexOf(name);
  return index === -1 ? undefined : argumentsList[index + 1];
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function run(command, commandArguments) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArguments, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`${command} failed with ${signal ?? `exit code ${code}`}`)
      );
    });
  });
}

if (process.argv[1] === import.meta.filename) {
  await main(process.argv.slice(2));
}
