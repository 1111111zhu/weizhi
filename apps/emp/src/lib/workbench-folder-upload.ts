import {
  formatNumberWithoutDigitFour,
  normalizeCodeWithoutDigitFour,
} from "@project-wing/shared";

import type { WorkflowNode } from "../api/client";

export type FolderUploadGroup = {
  folderName: string;
  files: File[];
};

export function groupFolderUploadFiles(files: File[]): FolderUploadGroup[] {
  const groups = new Map<string, File[]>();

  for (const file of files) {
    const segments = file.webkitRelativePath
      .replaceAll("\\", "/")
      .split("/")
      .filter(Boolean);
    if (segments.length < 3) {
      continue;
    }

    const [, folderName] = segments;
    const group = groups.get(folderName);
    if (group) {
      group.push(file);
    } else {
      groups.set(folderName, [file]);
    }
  }

  return Array.from(groups, ([folderName, groupedFiles]) => ({
    folderName,
    files: groupedFiles,
  }));
}

export function buildNextWorkflowFolderCode(
  parent: Pick<WorkflowNode, "code" | "children">
) {
  const numericParent = parseHierarchicalNumericCode(parent.code);
  if (numericParent) {
    const nextSibling =
      Math.max(
        0,
        ...(parent.children ?? [])
          .map((child) => parseHierarchicalNumericCode(child.code))
          .filter((path): path is number[] => Boolean(path))
          .filter((path) => samePath(path.slice(0, -1), numericParent))
          .map((path) => path.at(-1) ?? 0)
      ) + 1;
    return formatHierarchicalNumericCode([...numericParent, nextSibling]);
  }
  const children = parent.children ?? [];
  const phasePrefix = normalizeCodeWithoutDigitFour(parent.code).match(
    /^[A-Z]+$/
  )?.[0];
  const childPrefix = children
    .map((child) =>
      normalizeCodeWithoutDigitFour(child.code).match(/^([A-Za-z]+)\s*\d+$/)
    )
    .find(Boolean)?.[1];
  const prefix = phasePrefix ?? childPrefix ?? "A";
  const existingNumbers = children
    .map((child) =>
      normalizeCodeWithoutDigitFour(child.code).match(/^([A-Za-z]+)\s*(\d+)$/)
    )
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .filter((match) => match[1] === prefix)
    .map((match) => Number(match[2]));
  const nextValue =
    existingNumbers.length > 0
      ? Math.max(...existingNumbers) + 1
      : children.length + 1;

  return `${prefix}${formatNumberWithoutDigitFour(nextValue, 1)}`;
}

export function buildNextRootWorkflowFolderCode(
  roots: Pick<WorkflowNode, "code">[]
) {
  const numericRoots = roots
    .map((node) => parseHierarchicalNumericCode(node.code))
    .filter((path): path is number[] => Boolean(path))
    .filter((path) => path.length === 1)
    .map((path) => path[0] ?? 0);
  if (numericRoots.length > 0 || roots.length === 0) {
    return formatHierarchicalNumericCode([Math.max(0, ...numericRoots) + 1]);
  }
  return "A";
}

export function parseHierarchicalNumericCode(code: string): number[] | null {
  const trimmed = code.trim();
  if (/^\d{1,4}$/.test(trimmed)) {
    const parts = [...trimmed].map(Number);
    while (parts.length > 1 && parts.at(-1) === 0) {
      parts.pop();
    }
    return parts.length > 0 && parts.every((part) => part > 0 && part <= 9)
      ? parts
      : null;
  }
  if (!/^\d+(?:-\d+)+$/.test(trimmed)) {
    return null;
  }
  const parts = trimmed.split("-");
  while (parts.length > 1 && /^0+$/.test(parts.at(-1) ?? "")) {
    parts.pop();
  }
  const path = parts.map(Number);
  return path.length > 0 && path.every((part) => part > 0) ? path : null;
}

export function formatHierarchicalNumericCode(path: number[]) {
  if (path.length <= 4 && path.every((part) => part >= 1 && part <= 9)) {
    return `${path.join("")}${"0".repeat(4 - path.length)}`;
  }
  const code = path.join("-");
  return path.length < 4 ? `${code}-${"0".repeat(4 - path.length)}` : code;
}

function samePath(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((part, index) => part === right[index])
  );
}
