import "@testing-library/jest-dom/vitest";
import { act } from "@testing-library/react";

const nativeQueueMicrotask = globalThis.queueMicrotask.bind(globalThis);
globalThis.queueMicrotask = (callback) => {
  nativeQueueMicrotask(() => {
    act(callback);
  });
};

const nativeSetTimeout = globalThis.setTimeout.bind(globalThis) as unknown as (
  handler: () => void,
  timeout?: number
) => number;
const nativeClearTimeout = globalThis.clearTimeout.bind(
  globalThis
) as unknown as (frameId: number) => void;
globalThis.setTimeout = ((
  handler: TimerHandler,
  timeout?: number,
  ...arguments_: unknown[]
) =>
  nativeSetTimeout(() => {
    if (typeof handler === "function") {
      act(() => handler(...arguments_));
    }
  }, timeout)) as typeof setTimeout;

globalThis.requestAnimationFrame = (callback) =>
  nativeSetTimeout(() => {
    act(() => callback(0));
  }, 0);
globalThis.cancelAnimationFrame = (frameId) => {
  nativeClearTimeout(frameId);
};
window.setTimeout = globalThis.setTimeout;
window.clearTimeout = globalThis.clearTimeout;
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame;

if (document.fonts) {
  Object.defineProperty(document.fonts, "ready", {
    configurable: true,
    value: new Promise<FontFaceSet>(() => {}),
  });
}

class TestObserver implements ResizeObserver, MutationObserver {
  observe(
    _target: Element | Node,
    _options?: ResizeObserverOptions | MutationObserverInit
  ) {}
  unobserve() {}
  disconnect() {}
  takeRecords(): MutationRecord[] {
    return [];
  }
}

globalThis.ResizeObserver = TestObserver;
globalThis.MutationObserver =
  TestObserver as unknown as typeof MutationObserver;

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}
