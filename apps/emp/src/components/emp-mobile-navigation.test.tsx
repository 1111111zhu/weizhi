// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DesktopFolder,
  DesktopProjectPlacement,
  WorkflowNode,
} from "@/api/client";

import {
  EmpMobileDirectory,
  resolveMobileDirectory,
} from "./emp-mobile-directory";
import { EmpMobileProjects } from "./emp-mobile-projects";

const folders: DesktopFolder[] = [
  {
    id: "folder",
    ownerId: "me",
    name: "Audits",
    isDefault: true,
    sortOrder: 0,
  },
];
const placements = [
  {
    id: "placement",
    folderId: "folder",
    projectId: "project",
    project: { id: "project", name: "Orchid", projectCode: "AUD-01" },
  },
] as DesktopProjectPlacement[];
function fixture(folderId: string | null) {
  return {
    folders,
    placements,
    folderId,
    folderLabel: (folder: DesktopFolder) => folder.name,
    projectLabel: (item: DesktopProjectPlacement) => item.project.name,
    query: "",
    showSearch: false,
    onQueryChange: vi.fn(),
    onFolder: vi.fn(),
    projectHref: (id: string) => `/engagement/${id}`,
    onProject: vi.fn(),
    loading: false,
    error: false,
    onRetry: vi.fn(),
    locale: "en-US",
  };
}
function node(id: string, children?: WorkflowNode[]): WorkflowNode {
  return {
    id,
    code: id,
    title: id,
    level: 1,
    nodeType: "FOLDER",
    workingPapers: [],
    children,
  };
}

describe("actual EMP mobile navigation", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("starts with folders and does not leak the automatically selected desktop project's list", () => {
    const props = fixture(null);
    render(<EmpMobileProjects {...props} />);
    expect(screen.queryByText("Orchid")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: /Audits/ }));
    expect(props.onFolder).toHaveBeenCalledExactlyOnceWith("folder");
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("opens only projects belonging to the entered folder using the real callback", () => {
    const props = fixture("folder");
    render(<EmpMobileProjects {...props} />);
    fireEvent.click(screen.getByRole("link", { name: /Orchid/ }));
    expect(props.onProject).toHaveBeenCalledExactlyOnceWith("project");
    expect(screen.queryByText("Audits")).toBeNull();
  });

  it("drills one directory level at a time and opens the selected leaf", () => {
    const onOpen = vi.fn();
    render(
      <EmpMobileDirectory
        nodes={[node("A", [node("A1")]), node("B")]}
        onOpen={onOpen}
        management={<p>Management</p>}
        locale="en-US"
        loading={false}
      />
    );
    expect(screen.queryByText("A1")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "A" }));
    expect(screen.queryByRole("link", { name: "B" })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "A1" }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith("A1");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("link", { name: "B" })).toBeInTheDocument();
  });

  it("falls back safely when a directory is removed while browsing", () => {
    const nodes = [node("A")];
    expect(resolveMobileDirectory(nodes, ["removed"])).toStrictEqual({
      children: nodes,
      current: undefined,
    });
  });
});
