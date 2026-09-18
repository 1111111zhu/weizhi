// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkflowNode } from "../api/client";
import { WorkbenchDirectory } from "./workbench-directory";

function node(
  id: string,
  level: number,
  children: WorkflowNode[] = []
): WorkflowNode {
  return {
    id,
    code: id,
    title: id,
    level,
    nodeType: "FOLDER",
    workingPapers: [],
    children,
  };
}
const leaf = node("A1-1000", 3);
const group = node("A1", 2, [leaf, node("A1-2000", 3)]);
const nodes = [node("Planning", 1, [group]), node("Reporting", 1)];
type Props = Parameters<typeof WorkbenchDirectory>[0];
function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    mobileLocale: "en-US",
    workflow: nodes,
    selectedNodeId: leaf.id,
    addNodeTarget: null,
    setSelectedNodeId: vi.fn(),
    openAddNode: vi.fn(),
    closeAddNode: vi.fn(),
    createNode: vi.fn(),
    createNodePending: false,
    renameNode: vi.fn(),
    deleteNode: vi.fn(),
    ...overrides,
  };
  function Harness() {
    const [target, setTarget] = useState<WorkflowNode | null>(null);
    return (
      <WorkbenchDirectory
        {...props}
        addNodeTarget={target}
        openAddNode={(value) => {
          props.openAddNode(value);
          setTarget(value);
        }}
        closeAddNode={() => {
          props.closeAddNode();
          setTarget(null);
        }}
        createNode={(value) => {
          props.createNode(value);
          setTarget(null);
        }}
      />
    );
  }
  const rendered = render(<Harness />);
  return { props, ...rendered };
}
async function actions(label: string) {
  const displayLabel = label.replaceAll("-", " - ");
  fireEvent.click(
    screen.getByRole("button", { name: `Directory actions: ${displayLabel}` })
  );
  return await screen.findByRole("dialog", { name: displayLabel });
}
describe("mobile workbench directory management", () => {
  afterEach(cleanup);

  it("opens at the selected folder's parent, displays siblings without nesting, and browses up", () => {
    const { props } = setup();
    expect(screen.queryByRole("tree")).toBeNull();
    expect(
      screen.getByRole("button", { name: /A1 - 1000 Current directory/ })
    ).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("button", { name: "A1 - 2000" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reporting" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Up one level" }));
    expect(
      screen.getByRole("button", { name: /A1 2 subdirectories/ })
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "All directories" }));
    fireEvent.click(screen.getByRole("button", { name: "Reporting" }));
    expect(props.setSelectedNodeId).toHaveBeenCalledExactlyOnceWith(
      "Reporting"
    );
  });

  it("finds a deep folder by code and keeps its ancestor context", () => {
    const { props } = setup({ selectedNodeId: null });
    fireEvent.click(
      screen.getByRole("button", { name: "Search directory names or codes" })
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "A1-1000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "A1 - 1000 Planning / A1" })
    );
    expect(props.setSelectedNodeId).toHaveBeenCalledWith(leaf.id);
  });

  it("does not create on outside taps or cancellation and submits only explicit creation", () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "New directory" }));
    expect(screen.getByLabelText("Directory name")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Reference code"), {
      target: { value: "A1-3000" },
    });
    fireEvent.change(screen.getByLabelText("Directory name"), {
      target: { value: "New folder" },
    });
    fireEvent.pointerDown(document.body);
    expect(props.createNode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.createNode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "New directory" }));
    fireEvent.change(screen.getByLabelText("Reference code"), {
      target: { value: "A1-3000" },
    });
    fireEvent.change(screen.getByLabelText("Directory name"), {
      target: { value: "New folder" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create directory" }));
    expect(props.createNode).toHaveBeenCalledExactlyOnceWith({
      code: "A1-3000",
      title: "New folder",
    });
    expect(props.openAddNode).toHaveBeenCalledWith(group);
  });

  it("retains the existing rename form and delete callback behind touch actions", async () => {
    const { props } = setup();
    const menu = await actions(leaf.id);
    fireEvent.click(
      within(menu).getByRole("button", { name: "Rename workpaper" })
    );
    const rename = await screen.findByRole("dialog", {
      name: "Rename workpaper",
    });
    fireEvent.change(within(rename).getByLabelText("Directory name"), {
      target: { value: "Renamed" },
    });
    fireEvent.click(
      within(rename).getByRole("button", { name: "Rename workpaper" })
    );
    expect(props.renameNode).toHaveBeenCalledWith(leaf, {
      code: "A1-1000",
      title: "Renamed",
    });
    const next = await actions(leaf.id);
    fireEvent.click(
      within(next).getByRole("button", { name: "Delete workpaper" })
    );
    await waitFor(() =>
      expect(props.deleteNode).toHaveBeenCalledExactlyOnceWith(leaf)
    );
  });

  it("keeps copy/paste wired to the existing clipboard and rejects pasting into the source", async () => {
    const onCopyNodeToNode = vi.fn();
    setup({ selectedNodeId: null, onCopyNodeToNode });
    const menu = await actions("Reporting");
    fireEvent.click(within(menu).getByRole("button", { name: "Copy" }));
    await screen.findByText("Copied: Reporting");
    const same = await actions("Reporting");
    expect(within(same).getByRole("button", { name: "Paste" })).toBeDisabled();
    fireEvent.click(within(same).getByRole("button", { name: "Close" }));
    const target = await actions("Planning");
    fireEvent.click(within(target).getByRole("button", { name: "Paste" }));
    await waitFor(() =>
      expect(onCopyNodeToNode).toHaveBeenCalledWith(
        { nodeId: "Reporting", code: "Reporting", title: "Reporting" },
        nodes[0]
      )
    );
  });

  it("does not expose mutation actions in a read-only directory", async () => {
    const onExportNode = vi.fn();
    const { props } = setup({ readOnly: true, onExportNode });
    expect(screen.queryByRole("button", { name: "New directory" })).toBeNull();
    const menu = await actions(leaf.id);
    expect(
      within(menu).queryByRole("button", {
        name: /Rename|Delete|Copy|Cut|Paste|Add/,
      })
    ).toBeNull();
    fireEvent.click(
      within(menu).getByRole("button", { name: "Export folder" })
    );
    await waitFor(() =>
      expect(onExportNode).toHaveBeenCalledWith(leaf, "CURRENT")
    );
    expect(props.deleteNode).not.toHaveBeenCalled();
  });
});
