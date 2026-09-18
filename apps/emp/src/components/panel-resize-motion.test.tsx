// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PanelProps } from "react-resizable-panels";
import { ResizablePanel } from "./ui/resizable";

const panel = vi.hoisted(() => ({ resize: undefined as PanelProps["onResize"] }));
vi.mock("react-resizable-panels", () => ({
  Panel: ({ onResize }: PanelProps) => {
    panel.resize = onResize;
    return <div id="motion-panel" />;
  },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("does not remember near-zero animation frames as the next expanded size", () => {
  vi.useFakeTimers();
  const onResize = vi.fn();
  render(<ResizablePanel onResize={onResize} />);
  let running = true;
  Object.defineProperty(document.getElementById("motion-panel"), "getAnimations", {
    value: () => running ? [{ playState: "running", transitionProperty: "flex-grow" }] : [],
  });
  act(() => {
    panel.resize?.({ inPixels: 208, asPercentage: 20 }, "motion-panel", undefined);
    panel.resize?.({ inPixels: 2, asPercentage: 0.2 }, "motion-panel", undefined);
    vi.advanceTimersByTime(32);
  });
  expect(onResize).not.toHaveBeenCalled();
  act(() => {
    panel.resize?.({ inPixels: 0, asPercentage: 0 }, "motion-panel", undefined);
    running = false;
    vi.advanceTimersByTime(32);
  });
  expect(onResize).toHaveBeenCalledExactlyOnceWith({ inPixels: 0, asPercentage: 0 }, "motion-panel", undefined);
});

it("reports drag measurements immediately when no transition is running", () => {
  const onResize = vi.fn();
  render(<ResizablePanel onResize={onResize} />);
  act(() => panel.resize?.({ inPixels: 240, asPercentage: 24 }, "motion-panel", undefined));
  expect(onResize).toHaveBeenCalledExactlyOnceWith({ inPixels: 240, asPercentage: 24 }, "motion-panel", undefined);
});
