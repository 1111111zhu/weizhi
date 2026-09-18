import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResizableReviewPanel } from "./resizable-review-panel";

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

describe(ResizableReviewPanel, () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses the homepage rail and toggles from a click", () => {
    render(
      <ResizableReviewPanel storageKey="review">
        <div>详情</div>
      </ResizableReviewPanel>
    );

    const panel = screen.getByTestId("resizable-review-panel");
    expect(panel).toHaveStyle({ height: "176px" });
    expect(screen.getByText("详情")).toBeVisible();
    expect(screen.getByTestId("resizable-review-panel-rail-slot")).toHaveClass(
      "shrink-0",
      "py-1"
    );
    const separator = screen.getByTestId("resizable-review-panel-handle");
    expect(separator).toHaveAttribute("data-timesheet-resize-handle");
    expect(separator).toHaveClass(
      "h-2",
      "cursor-pointer",
      "touch-none",
      "select-none",
      "active:cursor-row-resize",
      "items-center",
      "justify-center"
    );
    expect(separator).not.toHaveClass(
      "border",
      "rounded-md",
      "bg-muted/40",
      "hover:bg-muted",
      "active:bg-primary/10"
    );
    expect(screen.getByTestId("resizable-review-panel-hit-area")).toHaveClass(
      "absolute",
      "inset-x-0",
      "-inset-y-3",
      "cursor-pointer",
      "active:cursor-row-resize"
    );

    fireEvent.click(separator);

    expect(panel).toHaveStyle({ height: "16px" });
    expect(separator).toHaveAttribute("data-state", "collapsed");
    expect(separator).not.toHaveClass(
      "data-[state=collapsed]:border-primary/35",
      "data-[state=collapsed]:bg-primary/10"
    );
    expect(separator.querySelector('[data-slot="resizable-grip"]')).toHaveClass(
      "group-data-[state=collapsed]:bg-primary/80"
    );
    expect(screen.queryByText("详情")).toBeNull();

    fireEvent.click(separator);

    expect(panel).toHaveStyle({ height: "176px" });
    expect(screen.getByText("详情")).toBeVisible();
  });

  it("loads a valid per-user layout preference", () => {
    window.localStorage.setItem(
      "review",
      JSON.stringify({ height: 340, collapsed: true })
    );

    render(
      <ResizableReviewPanel storageKey="review">
        <div>详情</div>
      </ResizableReviewPanel>
    );

    expect(screen.getByTestId("resizable-review-panel")).toHaveStyle({
      height: "16px",
    });
    expect(screen.queryByText("详情")).toBeNull();

    fireEvent.click(screen.getByTestId("resizable-review-panel-handle"));

    expect(screen.getByTestId("resizable-review-panel")).toHaveStyle({
      height: "336px",
    });
  });

  it("toggles from the expanded hit area instead of requiring the visible rail", () => {
    render(
      <ResizableReviewPanel storageKey="review">
        <div>详情</div>
      </ResizableReviewPanel>
    );

    const panel = screen.getByTestId("resizable-review-panel");
    const hitArea = screen.getByTestId("resizable-review-panel-hit-area");

    fireEvent.click(hitArea);
    expect(panel).toHaveStyle({ height: "16px" });

    fireEvent.click(hitArea);
    expect(panel).toHaveStyle({ height: "176px" });
  });

  it("does not read the stored layout during the server render", () => {
    window.localStorage.setItem(
      "review",
      JSON.stringify({ height: 280, collapsed: true })
    );
    const getItem = vi.spyOn(window.localStorage, "getItem");

    try {
      const html = renderToString(
        <ResizableReviewPanel storageKey="review">
          <div>详情</div>
        </ResizableReviewPanel>
      );

      expect(getItem).not.toHaveBeenCalled();
      expect(html).toContain('style="height:176px"');
    } finally {
      getItem.mockRestore();
    }
  });

  it("coalesces vertical drag paints and commits the final height on release", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(
      <ResizableReviewPanel storageKey="review">
        <div>详情</div>
      </ResizableReviewPanel>
    );

    const panel = screen.getByTestId("resizable-review-panel");
    const separator = screen.getByRole("button", {
      name: "调整复核看板高度",
    });
    fireEvent.pointerDown(separator, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 80, pointerId: 1 });

    expect(frames).toHaveLength(1);
    expect(panel).toHaveStyle({ height: "176px" });

    expectPresent(frames.shift())(0);
    expect(panel).toHaveStyle({ height: "296px" });

    fireEvent.pointerUp(window, { clientY: 80, pointerId: 1 });
    expect(panel).toHaveStyle({ height: "296px" });
    expect(
      JSON.parse(window.localStorage.getItem("review") ?? "{}")
    ).toStrictEqual({
      height: 280,
      collapsed: false,
    });
  });

  it("clamps vertical dragging to the configured bounds", () => {
    render(
      <ResizableReviewPanel storageKey="review" minHeight={160} maxHeight={400}>
        <div>详情</div>
      </ResizableReviewPanel>
    );

    const panel = screen.getByTestId("resizable-review-panel");
    const separator = screen.getByRole("button", {
      name: "调整复核看板高度",
    });

    fireEvent.pointerDown(separator, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: -100, pointerId: 1 });
    expect(panel).toHaveStyle({ height: "416px" });

    fireEvent.pointerMove(window, { clientY: 500, pointerId: 1 });
    expect(panel).toHaveStyle({ height: "32px" });
    expect(separator).toHaveAttribute("data-state", "expanded");
    fireEvent.pointerUp(window, { clientY: 500, pointerId: 1 });
    expect(separator).toHaveAttribute("data-state", "collapsed");

    expect(
      JSON.parse(window.localStorage.getItem("review") ?? "{}")
    ).toStrictEqual({
      height: 400,
      collapsed: true,
    });
  });

  it("respects the six-row maximum within the available column", () => {
    render(
      <div data-testid="review-host" data-resizable-review-container>
        <ResizableReviewPanel storageKey="review">
          <div>详情</div>
        </ResizableReviewPanel>
      </div>
    );

    const host = screen.getByTestId("review-host");
    Object.defineProperty(host, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 600,
        height: 600,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
      }),
    });

    const panel = screen.getByTestId("resizable-review-panel");
    const separator = screen.getByRole("button", {
      name: "调整复核看板高度",
    });
    fireEvent.pointerDown(separator, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: -200, pointerId: 1 });

    expect(panel).toHaveStyle({ height: "336px" });
    fireEvent.pointerUp(window, { clientY: -200, pointerId: 1 });
  });

  it("collapses when dragged down past the minimum detail height", () => {
    render(
      <ResizableReviewPanel storageKey="review">
        <div>详情</div>
      </ResizableReviewPanel>
    );

    const panel = screen.getByTestId("resizable-review-panel");
    const separator = screen.getByRole("button", {
      name: "调整复核看板高度",
    });

    fireEvent.pointerDown(separator, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 600, pointerId: 1 });
    expect(panel).toHaveStyle({ height: "32px" });
    expect(separator).toHaveAttribute("data-state", "expanded");
    fireEvent.pointerUp(window, { clientY: 600, pointerId: 1 });
    expect(separator).toHaveAttribute("data-state", "collapsed");
  });

  it("keeps the review panel open until the drag reaches the collapse threshold", () => {
    render(
      <ResizableReviewPanel storageKey="review">
        <div>详情</div>
      </ResizableReviewPanel>
    );

    const panel = screen.getByTestId("resizable-review-panel");
    const separator = screen.getByRole("button", {
      name: "调整复核看板高度",
    });

    fireEvent.pointerDown(separator, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(window, { clientY: 300, pointerId: 1 });

    expect(panel).toHaveStyle({ height: "176px" });
    expect(separator).toHaveAttribute("data-state", "expanded");
  });

  it("captures the pointer for a drag that leaves the narrow rail", () => {
    render(
      <ResizableReviewPanel storageKey="review">
        <div>详情</div>
      </ResizableReviewPanel>
    );

    const separator = screen.getByRole("button", {
      name: "调整复核看板高度",
    });
    let capturedPointerId: number | undefined;
    let releasedPointerId: number | undefined;
    separator.setPointerCapture = (pointerId) => {
      capturedPointerId = pointerId;
    };
    separator.hasPointerCapture = () => true;
    separator.releasePointerCapture = (pointerId) => {
      releasedPointerId = pointerId;
    };

    fireEvent.pointerDown(separator, { clientY: 200, pointerId: 7 });
    expect(capturedPointerId).toBe(7);

    fireEvent.pointerUp(window, { clientY: 600, pointerId: 7 });
    expect(releasedPointerId).toBe(7);
  });

  it("shrinks when the expanded hit area is dragged downward", () => {
    render(
      <ResizableReviewPanel storageKey="review">
        <div>详情</div>
      </ResizableReviewPanel>
    );

    const panel = screen.getByTestId("resizable-review-panel");
    const hitArea = screen.getByTestId("resizable-review-panel-hit-area");

    fireEvent.pointerDown(hitArea, { clientY: 200, pointerId: 3 });
    fireEvent.pointerMove(window, { clientY: 600, pointerId: 3 });
    expect(screen.getByTestId("resizable-review-panel-handle")).toHaveAttribute(
      "data-state",
      "expanded"
    );
    fireEvent.pointerUp(window, { clientY: 600, pointerId: 3 });

    expect(panel).toHaveStyle({ height: "16px" });
    expect(screen.getByTestId("resizable-review-panel-handle")).toHaveAttribute(
      "data-state",
      "collapsed"
    );
  });

  it("can be dragged up from the collapsed state before expanding", () => {
    window.localStorage.setItem(
      "review",
      JSON.stringify({ height: 280, collapsed: true })
    );

    render(
      <ResizableReviewPanel storageKey="review">
        <div>详情</div>
      </ResizableReviewPanel>
    );

    const panel = screen.getByTestId("resizable-review-panel");
    const separator = screen.getByRole("button", {
      name: "调整复核看板高度",
    });

    fireEvent.pointerDown(separator, { clientY: 600, pointerId: 4 });
    fireEvent.pointerMove(window, { clientY: 500, pointerId: 4 });
    expect(panel).toHaveStyle({ height: "132px" });
    expect(separator).toHaveAttribute("data-state", "expanded");

    fireEvent.pointerUp(window, { clientY: 500, pointerId: 4 });
    expect(panel).toHaveStyle({ height: "176px" });
    expect(screen.getByText("详情")).toBeVisible();
  });
});
