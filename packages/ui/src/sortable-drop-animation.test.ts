import type { DropAnimationFunction } from "@dnd-kit/core";
import { describe, expect, it, vi } from "vitest";
// @vitest-environment happy-dom

import { animateSpatialDrop } from "./sortable-drop-animation";

describe("spatial sortable drop animation", () => {
  it("snaps the overlay to the target slot instead of the source slot", async () => {
    const targetNode = document.createElement("div");
    const overlayNode = document.createElement("div");
    vi.spyOn(targetNode, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ height: 144, width: 144, x: 460, y: 360 })
    );
    vi.spyOn(overlayNode, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ height: 144, width: 144, x: 400, y: 300 })
    );
    let finishAnimation = () => {};
    const finished = new Promise<void>((resolve) => {
      finishAnimation = resolve;
    });
    const animate = vi.fn(() => ({ finished }));
    Object.defineProperty(overlayNode, "animate", { value: animate });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });

    const animation = animateSpatialDrop(
      {
        dragOverlay: { node: overlayNode },
        droppableContainers: new Map([
          ["slot-4", { node: { current: targetNode } }],
        ]),
        transform: { scaleX: 1, scaleY: 1, x: 300, y: 100 },
      } as unknown as Parameters<DropAnimationFunction>[0],
      "slot-4"
    );

    expect(animate).toHaveBeenCalledWith(
      [
        { transform: "translate3d(300px, 100px, 0) scaleX(1) scaleY(1)" },
        { transform: "translate3d(360px, 160px, 0) scaleX(1) scaleY(1)" },
      ],
      expect.objectContaining({ duration: 180, fill: "forwards" })
    );

    finishAnimation();
    await animation;
  });
});
