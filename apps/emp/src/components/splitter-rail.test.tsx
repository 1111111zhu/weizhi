import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment happy-dom

import { SplitterRail } from "./splitter-rail";

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
  });

  describe(SplitterRail, () => {
    it("keeps a collapsed rail transparent without changing its control role", () => {
      render(
        <SplitterRail
          expanded={false}
          hitAreaTestId="splitter-hit-area"
          label="Resize navigation sidebar"
          onToggle={vi.fn()}
        />
      );

      const rail = screen.getByRole("separator", {
        name: "Resize navigation sidebar",
      });
      const grip = rail.querySelector('[data-slot="splitter-rail-grip"]');

      expect(rail).toHaveAttribute("data-state", "collapsed");
      expect(rail).toHaveClass("w-3", "bg-transparent");
      expect(rail).not.toHaveClass(
        "hover:bg-muted/60",
        "data-[state=collapsed]:bg-primary/10",
        "data-[state=collapsed]:border-primary/35"
      );
      expect(grip).toHaveClass("group-data-[state=collapsed]:bg-primary/80");
      expect(screen.getByTestId("splitter-hit-area")).toHaveClass("inset-x-0");
    });

    it("keeps the shared rail footprint flush even when a page supplies horizontal margin", () => {
      render(
        <SplitterRail
          className="mx-1.5 text-muted-foreground"
          expanded
          label="Resize navigation sidebar"
          onToggle={vi.fn()}
        />
      );

      const rail = screen.getByRole("separator", {
        name: "Resize navigation sidebar",
      });

      expect(rail).not.toHaveClass("mx-1.5");
    });

    it("uses the full rail and enlarged hit area as one accessible control", () => {
      const onToggle = vi.fn();

      render(
        <SplitterRail
          expanded
          hitAreaTestId="splitter-hit-area"
          label="Resize navigation sidebar"
          max={260}
          min={184}
          onToggle={onToggle}
          value={200}
        />
      );

      const rail = screen.getByRole("separator", {
        name: "Resize navigation sidebar",
      });
      expect(rail).toHaveAttribute("aria-orientation", "vertical");
      expect(rail).toHaveAttribute("aria-expanded", "true");
      expect(rail).toHaveAttribute("aria-valuemin", "184");
      expect(rail).toHaveAttribute("aria-valuemax", "260");
      expect(rail).toHaveAttribute("aria-valuenow", "200");
      expect(rail).toHaveClass(
        "h-full",
        "cursor-pointer",
        "bg-transparent",
        "active:cursor-col-resize"
      );
      expect(rail).not.toHaveClass(
        "border-border",
        "bg-muted/40",
        "hover:bg-muted/60",
        "data-[resize-state=dragging]:bg-primary/10"
      );
      expect(rail).toHaveClass("data-[separator=active]:cursor-col-resize");

      expect(screen.getByTestId("splitter-hit-area")).toHaveClass(
        "absolute",
        "inset-y-0",
        "-inset-x-3",
        "cursor-pointer",
        "active:cursor-col-resize"
      );
      expect(screen.getByTestId("splitter-hit-area")).not.toHaveClass(
        "group-data-[separator=active]:cursor-col-resize"
      );

      fireEvent.click(rail);
      fireEvent.click(screen.getByTestId("splitter-hit-area"));
      expect(onToggle).toHaveBeenCalledTimes(2);
    });

    it("captures a drag and cleans up on cancel and blur without toggling", () => {
      const onDrag = vi.fn();
      const onDragCancel = vi.fn();
      const onToggle = vi.fn();

      render(
        <SplitterRail
          expanded
          label="Resize navigation sidebar"
          onDrag={onDrag}
          onDragCancel={onDragCancel}
          onToggle={onToggle}
        />
      );

      const rail = screen.getByRole("separator", {
        name: "Resize navigation sidebar",
      });
      const setPointerCapture = vi.fn();
      const releasePointerCapture = vi.fn();
      Object.defineProperties(rail, {
        hasPointerCapture: { configurable: true, value: () => true },
        releasePointerCapture: {
          configurable: true,
          value: releasePointerCapture,
        },
        setPointerCapture: {
          configurable: true,
          value: setPointerCapture,
        },
      });

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 1,
      });
      fireEvent.pointerMove(window, { clientX: 140, pointerId: 2 });
      fireEvent.pointerUp(window, { pointerId: 2 });
      expect(onDrag).not.toHaveBeenCalled();
      expect(onDragCancel).not.toHaveBeenCalled();

      fireEvent.pointerMove(window, { clientX: 140, pointerId: 1 });
      expect(onDrag).toHaveBeenCalledWith(40);
      fireEvent.pointerCancel(window, { pointerId: 1 });

      expect(setPointerCapture).toHaveBeenCalledWith(1);
      expect(releasePointerCapture).toHaveBeenCalledWith(1);
      expect(onDragCancel).toHaveBeenCalledOnce();

      fireEvent.click(rail);
      expect(onToggle).not.toHaveBeenCalled();

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 2,
      });
      fireEvent.pointerMove(window, { clientX: 140, pointerId: 2 });
      fireEvent.blur(window);

      expect(onDragCancel).toHaveBeenCalledTimes(2);
      expect(releasePointerCapture).toHaveBeenCalledWith(2);
    });

    it("notifies the owner only when a drag ends normally", () => {
      const onDragEnd = vi.fn();
      const onDragCancel = vi.fn();

      render(
        <SplitterRail
          expanded
          label="Resize navigation sidebar"
          onDrag={vi.fn()}
          onDragCancel={onDragCancel}
          onDragEnd={onDragEnd}
          onToggle={vi.fn()}
        />
      );

      const rail = screen.getByRole("separator", {
        name: "Resize navigation sidebar",
      });
      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 8,
      });
      fireEvent.pointerMove(window, { clientX: 140, pointerId: 8 });
      fireEvent.pointerUp(window, { pointerId: 8 });

      expect(onDragEnd).toHaveBeenCalledOnce();
      expect(onDragCancel).not.toHaveBeenCalled();

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 9,
      });
      fireEvent.pointerMove(window, { clientX: 140, pointerId: 9 });
      fireEvent.pointerCancel(window, { pointerId: 9 });

      expect(onDragEnd).toHaveBeenCalledOnce();
      expect(onDragCancel).toHaveBeenCalledOnce();
    });

    it("passes signed horizontal deltas to the resize owner", () => {
      const onDrag = vi.fn();

      render(
        <SplitterRail
          expanded
          label="Resize navigation sidebar"
          onDrag={onDrag}
          onToggle={vi.fn()}
        />
      );

      const rail = screen.getByRole("separator", {
        name: "Resize navigation sidebar",
      });
      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 3,
      });
      fireEvent.pointerMove(window, { clientX: 60, pointerId: 3 });
      fireEvent.pointerUp(window, { pointerId: 3 });

      expect(onDrag).toHaveBeenCalledWith(-40);
    });

    it("supports a horizontal separator with signed vertical deltas", () => {
      const onDrag = vi.fn();

      render(
        <SplitterRail
          expanded
          orientation="horizontal"
          hitAreaTestId="horizontal-hit-area"
          label="Resize review notes panel"
          onDrag={onDrag}
          onToggle={vi.fn()}
        />
      );

      const rail = screen.getByRole("separator", {
        name: "Resize review notes panel",
      });
      expect(rail).toHaveAttribute("aria-orientation", "horizontal");
      expect(rail).toHaveClass("h-3", "w-full", "active:cursor-row-resize");
      expect(screen.getByTestId("horizontal-hit-area")).toHaveClass(
        "inset-x-0",
        "-inset-y-3",
        "active:cursor-row-resize"
      );
      expect(
        rail.querySelector('[data-slot="splitter-rail-grip"]')
      ).toHaveClass("h-1", "w-12");

      fireEvent.pointerDown(rail, {
        button: 0,
        clientY: 160,
        pointerId: 13,
      });
      fireEvent.pointerMove(window, { clientY: 120, pointerId: 13 });
      fireEvent.pointerUp(window, { pointerId: 13 });

      expect(onDrag).toHaveBeenCalledWith(-40);
    });

    it("shows the drag affordance only after a real pointer drag and resets it on every end path", () => {
      render(
        <SplitterRail
          expanded
          label="Resize navigation sidebar"
          onDrag={vi.fn()}
          onToggle={vi.fn()}
        />
      );

      const rail = screen.getByRole("separator", {
        name: "Resize navigation sidebar",
      });
      const grip = rail.querySelector('[data-slot="splitter-rail-grip"]');

      expect(rail).toHaveAttribute("data-resize-state", "idle");
      expect(grip).not.toBeNull();
      expect(grip).toHaveClass(
        "bg-muted-foreground/35",
        "group-hover:bg-primary",
        "group-data-[resize-state=dragging]:bg-primary"
      );

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 4,
      });
      expect(rail).toHaveAttribute("data-resize-state", "idle");

      fireEvent.pointerMove(window, { clientX: 102, pointerId: 4 });
      expect(rail).toHaveAttribute("data-resize-state", "idle");

      fireEvent.pointerMove(window, { clientX: 110, pointerId: 4 });
      expect(rail).toHaveAttribute("data-resize-state", "dragging");

      fireEvent.pointerUp(window, { pointerId: 4 });
      expect(rail).toHaveAttribute("data-resize-state", "idle");

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 5,
      });
      fireEvent.pointerMove(window, { clientX: 110, pointerId: 5 });
      fireEvent.pointerCancel(window, { pointerId: 5 });
      expect(rail).toHaveAttribute("data-resize-state", "idle");

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 6,
      });
      fireEvent.pointerMove(window, { clientX: 110, pointerId: 6 });
      fireEvent.lostPointerCapture(rail, { pointerId: 6 });
      expect(rail).toHaveAttribute("data-resize-state", "idle");

      fireEvent.pointerDown(rail, {
        button: 0,
        clientX: 100,
        pointerId: 7,
      });
      fireEvent.pointerMove(window, { clientX: 110, pointerId: 7 });
      fireEvent.blur(window);
      expect(rail).toHaveAttribute("data-resize-state", "idle");
    });

    it("declares zero as the collapsed value without changing the expanded range", () => {
      const { rerender } = render(
        <SplitterRail
          expanded={false}
          label="Resize navigation sidebar"
          max={260}
          min={184}
          onToggle={vi.fn()}
          value={200}
        />
      );
      const rail = screen.getByRole("separator", {
        name: "Resize navigation sidebar",
      });
      expect(rail).toHaveAttribute("aria-valuemin", "0");
      expect(rail).toHaveAttribute("aria-valuemax", "260");
      expect(rail).toHaveAttribute("aria-valuenow", "0");

      rerender(
        <SplitterRail
          expanded
          label="Resize navigation sidebar"
          max={260}
          min={184}
          onToggle={vi.fn()}
          value={200}
        />
      );

      expect(rail).toHaveAttribute("aria-valuemin", "184");
      expect(rail).toHaveAttribute("aria-valuemax", "260");
      expect(rail).toHaveAttribute("aria-valuenow", "200");
    });
  });
});
