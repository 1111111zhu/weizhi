import { ExpandableActionBar } from "@project-wing/ui";
// @vitest-environment happy-dom
import type { ExpandableActionBarItem } from "@project-wing/ui";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Copy, Send } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

const items: ExpandableActionBarItem[] = [
  { id: "send", label: "Send", icon: <Send /> },
  { id: "copy", label: "Copy", icon: <Copy /> },
];

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe(ExpandableActionBar, () => {
    it("ignores layout mouseleave and collapses only after real pointer movement outside", () => {
      vi.useFakeTimers();
      render(<ExpandableActionBar items={items} collapseDelay={90} />);

      const actionBar = screen.getByTestId("expandable-action-bar");
      vi.spyOn(actionBar, "getBoundingClientRect").mockReturnValue({
        bottom: 40,
        height: 40,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      expect(actionBar).toHaveAttribute("data-expanded", "false");

      fireEvent.mouseEnter(actionBar, { clientX: 50, clientY: 20 });
      expect(actionBar).toHaveAttribute("data-expanded", "true");

      fireEvent.mouseLeave(actionBar, { clientX: 140, clientY: 20 });
      act(() => vi.advanceTimersByTime(90));
      expect(actionBar).toHaveAttribute("data-expanded", "true");

      fireEvent.pointerMove(window, { clientX: 140, clientY: 20 });
      act(() => vi.advanceTimersByTime(90));
      expect(actionBar).toHaveAttribute("data-expanded", "false");
    });

    it("collapses when the pointer leaves the browser viewport", () => {
      vi.useFakeTimers();
      render(<ExpandableActionBar items={items} collapseDelay={90} />);

      const actionBar = screen.getByTestId("expandable-action-bar");
      fireEvent.mouseEnter(actionBar, { clientX: 50, clientY: 20 });
      expect(actionBar).toHaveAttribute("data-expanded", "true");

      fireEvent.pointerOut(window, { relatedTarget: null });
      act(() => vi.advanceTimersByTime(90));

      expect(actionBar).toHaveAttribute("data-expanded", "false");
    });

    it("expands for keyboard focus and invokes the selected action", () => {
      const onAction = vi.fn();
      render(<ExpandableActionBar items={items} onAction={onAction} />);

      const send = screen.getByRole("button", { name: "Send" });
      fireEvent.focus(send);
      expect(screen.getByTestId("expandable-action-bar")).toHaveAttribute(
        "data-expanded",
        "true"
      );

      fireEvent.click(send);
      expect(onAction).toHaveBeenCalledWith(items[0]);
    });

    it("keeps a left click on the native button path without pointer capture", () => {
      const onItemClick = vi.fn();
      const onAction = vi.fn();
      const clickItems = [{ ...items[0], onClick: onItemClick }, items[1]];
      render(<ExpandableActionBar items={clickItems} onAction={onAction} />);

      const actionBar = screen.getByTestId("expandable-action-bar");
      const send = screen.getByRole("button", { name: "Send" });
      const rootCapture = vi.fn();
      const itemCapture = vi.fn();
      vi.spyOn(actionBar, "getBoundingClientRect").mockReturnValue({
        bottom: 40,
        height: 40,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      Object.assign(actionBar, { setPointerCapture: rootCapture });
      Object.assign(send, {
        hasPointerCapture: vi.fn(() => false),
        releasePointerCapture: vi.fn(),
        setPointerCapture: itemCapture,
      });

      fireEvent.pointerDown(send, { clientX: 50, clientY: 20, pointerId: 9 });
      fireEvent.pointerUp(send, { clientX: 50, clientY: 20, pointerId: 9 });
      fireEvent.click(send);

      expect(itemCapture).not.toHaveBeenCalled();
      expect(rootCapture).not.toHaveBeenCalled();
      expect(onItemClick).toHaveBeenCalledOnce();
      expect(onAction).toHaveBeenCalledWith(clickItems[0]);
    });

    it("stays expanded after an in-region click until the pointer leaves", () => {
      vi.useFakeTimers();
      render(<ExpandableActionBar items={items} collapseDelay={90} />);

      const actionBar = screen.getByTestId("expandable-action-bar");
      const send = screen.getByRole("button", { name: "Send" });
      vi.spyOn(actionBar, "getBoundingClientRect").mockReturnValue({
        bottom: 40,
        height: 40,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      fireEvent.mouseEnter(actionBar, { clientX: 50, clientY: 20 });
      fireEvent.click(send);

      fireEvent.mouseLeave(actionBar, { clientX: 50, clientY: 20 });
      act(() => vi.advanceTimersByTime(90));

      expect(actionBar).toHaveAttribute("data-expanded", "true");

      fireEvent.pointerMove(window, { clientX: 140, clientY: 20 });
      act(() => vi.advanceTimersByTime(90));
      expect(actionBar).toHaveAttribute("data-expanded", "false");
    });

    it("ignores a stationary leave caused by click layout and waits for real pointer movement", () => {
      vi.useFakeTimers();
      render(<ExpandableActionBar items={items} collapseDelay={90} />);

      const actionBar = screen.getByTestId("expandable-action-bar");
      const send = screen.getByRole("button", { name: "Send" });
      let rect = {
        bottom: 40,
        height: 40,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
      vi.spyOn(actionBar, "getBoundingClientRect").mockImplementation(
        () => rect
      );
      Object.assign(actionBar, {
        hasPointerCapture: vi.fn(() => true),
        releasePointerCapture: vi.fn(),
        setPointerCapture: vi.fn(),
      });

      fireEvent.mouseEnter(actionBar, { clientX: 50, clientY: 20 });
      fireEvent.pointerDown(send, {
        clientX: 50,
        clientY: 20,
        pointerId: 7,
      });
      fireEvent.pointerUp(actionBar, {
        clientX: 50,
        clientY: 20,
        pointerId: 7,
      });
      fireEvent.click(send);

      rect = {
        ...rect,
        left: 60,
        right: 160,
        x: 60,
      } as DOMRect;
      fireEvent.mouseLeave(actionBar, { clientX: 50, clientY: 20 });
      act(() => vi.advanceTimersByTime(90));
      expect(actionBar).toHaveAttribute("data-expanded", "true");

      fireEvent.pointerMove(window, { clientX: 170, clientY: 20 });
      act(() => vi.advanceTimersByTime(90));
      expect(actionBar).toHaveAttribute("data-expanded", "false");
    });

    it("keeps the active highlight separate from the icon and label slots", () => {
      render(
        <ExpandableActionBar
          items={items.map((item) => ({ ...item, active: item.id === "send" }))}
        />
      );

      const send = screen.getByRole("button", { name: "Send" });

      expect(
        send.querySelector('[data-slot="expandable-action-bar-highlight"]')
      ).toBeInTheDocument();
      expect(
        send.querySelector('[data-slot="expandable-action-bar-icon"]')
      ).toBeInTheDocument();
      expect(
        send.querySelector('[data-slot="expandable-action-bar-label"]')
      ).toBeInTheDocument();
    });
  });
});
