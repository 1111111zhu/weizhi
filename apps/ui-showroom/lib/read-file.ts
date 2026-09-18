import { promises as fs } from "node:fs";
import path from "node:path";

export const readExampleFile = (relativePath: string) => {
  const absolutePath = path.join(process.cwd(), "examples", relativePath);
  return fs.readFile(absolutePath, "utf-8");
};

export const readRegistryFile = (relativePath: string) => {
  const absolutePath = path.join(process.cwd(), "registry", relativePath);
  return fs.readFile(absolutePath, "utf-8");
};
