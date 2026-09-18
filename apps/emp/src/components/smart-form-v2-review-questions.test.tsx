import { cleanup, render, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSmartFormV2ReviewTargetFocus } from "./smart-form-v2-review-questions";

const expandAll = vi.fn();
const target = { nodeId: "same-sheet", rowId: "same-row", label: "Record" };
function Harness({ selected = true }: { selected?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useSmartFormV2ReviewTargetFocus({
    rootRef,
    target: selected ? target : null,
    expandAll,
  });
  return (
    <div ref={rootRef}>
      <div
        data-testid="desktop"
        data-smart-form-node-id="same-sheet"
        data-smart-form-row-id="same-row"
      />
      <div
        data-testid="mobile"
        data-smart-form-node-id="same-sheet"
        data-smart-form-row-id="same-row"
      />
    </div>
  );
}

describe("responsive review target", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("highlights the visible representation instead of its hidden desktop twin", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
      function visibleRects(this: HTMLElement) {
        return {
          length: this.dataset.testid === "mobile" ? 1 : 0,
        } as DOMRectList;
      }
    );
    const { getByTestId, rerender } = render(<Harness />);
    await waitFor(() =>
      expect(getByTestId("mobile")).toHaveClass("smart-form-v2-review-target")
    );
    expect(getByTestId("desktop")).not.toHaveClass(
      "smart-form-v2-review-target"
    );
    rerender(<Harness selected={false} />);
    expect(getByTestId("mobile")).not.toHaveClass(
      "smart-form-v2-review-target"
    );
    expect(expandAll).toHaveBeenCalledOnce();
  });
});
