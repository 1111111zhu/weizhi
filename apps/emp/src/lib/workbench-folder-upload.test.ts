import { describe, expect, it } from "vitest";

import type { WorkflowNode } from "../api/client";
import {
  buildNextRootWorkflowFolderCode,
  buildNextWorkflowFolderCode,
  formatHierarchicalNumericCode,
  groupFolderUploadFiles,
  parseHierarchicalNumericCode,
} from "./workbench-folder-upload";

function directoryFile(relativePath: string, name: string) {
  const file = new File([name], name, { type: "text/plain" });
  Object.defineProperty(file, "webkitRelativePath", {
    configurable: true,
    value: relativePath,
  });
  return file;
}

describe("workbench-folder-upload", () => {
  it("groups files by the direct child folder and skips root files", () => {
    const bankFile = directoryFile("Upload/Bank/bank.xlsx", "bank.xlsx");
    const nestedBankFile = directoryFile(
      "Upload/Bank/Archive/old.xlsx",
      "old.xlsx"
    );
    const payrollFile = directoryFile(
      "Upload/Payroll/payroll.xlsx",
      "payroll.xlsx"
    );
    const rootFile = directoryFile("Upload/readme.txt", "readme.txt");

    expect(
      groupFolderUploadFiles([bankFile, nestedBankFile, payrollFile, rootFile])
    ).toStrictEqual([
      { folderName: "Bank", files: [bankFile, nestedBankFile] },
      { folderName: "Payroll", files: [payrollFile] },
    ]);
  });

  it("continues the existing phase child numbering", () => {
    const parent: Pick<WorkflowNode, "code" | "children"> = {
      code: "Planning",
      children: [
        { code: "A01" } as WorkflowNode,
        { code: "A02" } as WorkflowNode,
      ],
    };

    expect(buildNextWorkflowFolderCode(parent)).toBe("A3");
  });

  it("skips the digit four using the shared numbering rule", () => {
    const parent: Pick<WorkflowNode, "code" | "children"> = {
      code: "A",
      children: [{ code: "A03" } as WorkflowNode],
    };

    expect(buildNextWorkflowFolderCode(parent)).toBe("A5");
  });

  it("uses four digits first and expands only the overflowing level", () => {
    const parent: Pick<WorkflowNode, "code" | "children"> = {
      code: "1000",
      children: Array.from({ length: 9 }, (_, index) => ({
        code: `1${index + 1}00`,
      })) as WorkflowNode[],
    };

    expect(buildNextRootWorkflowFolderCode([])).toBe("1000");
    expect(buildNextWorkflowFolderCode(parent)).toBe("1-10-00");
    expect(
      buildNextWorkflowFolderCode({
        code: "1-10-00",
        children: Array.from({ length: 9 }, (_, index) => ({
          code: `1-10-${index + 1}-0`,
        })) as WorkflowNode[],
      })
    ).toBe("1-10-10-0");
    expect(parseHierarchicalNumericCode("1-10-00")).toStrictEqual([1, 10]);
    expect(parseHierarchicalNumericCode("1-10-10-0")).toStrictEqual([
      1, 10, 10,
    ]);
    expect(formatHierarchicalNumericCode([1, 10, 10, 1, 1])).toBe(
      "1-10-10-1-1"
    );
  });
});
