import { render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { ScrollArea } from "./ui/scroll-area";

// @vitest-environment jsdom

vi.mock("@base-ui/react/scroll-area", async () => {
  const ReactModule = await import("react");

  const Root = ({ children, ...props }: { children?: React.ReactNode }) =>
    ReactModule.createElement("div", props, children);
  Root.displayName = "Root";
  const Viewport = ReactModule.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) =>
    ReactModule.createElement("div", { ...props, ref }, children)
  );
  Viewport.displayName = "Viewport";
  const Scrollbar = ({ children, ...props }: { children?: React.ReactNode }) =>
    ReactModule.createElement("div", props, children);
  Scrollbar.displayName = "Scrollbar";
  const Thumb = (props: Record<string, unknown>) =>
    ReactModule.createElement("div", props);
  Thumb.displayName = "Thumb";
  const Corner = (props: Record<string, unknown>) =>
    ReactModule.createElement("div", props);
  Corner.displayName = "Corner";

  return {
    ScrollArea: { Root, Viewport, Scrollbar, Thumb, Corner },
  };
});

describe("pDF viewer scroll area", () => {
  it("keeps the viewport ref attached across page navigation rerenders", () => {
    const refEvents: (HTMLDivElement | null)[] = [];

    function Harness({ revision }: { revision: number }) {
      const viewportRef = React.useCallback((node: HTMLDivElement | null) => {
        refEvents.push(node);
      }, []);

      return (
        <ScrollArea viewportRef={viewportRef}>
          <div data-revision={revision}>PDF page</div>
        </ScrollArea>
      );
    }

    const { container, rerender } = render(<Harness revision={1} />);
    const [attachedViewport] = refEvents;

    for (const revision of [2, 3, 4, 3]) {
      rerender(<Harness revision={revision} />);

      expect(
        container.querySelector<HTMLElement>("[data-revision]")?.dataset
          .revision
      ).toBe(String(revision));
    }

    expect(attachedViewport).toBeInstanceOf(HTMLDivElement);
    expect(refEvents).toStrictEqual([attachedViewport]);
  });

  it("does not re-enter a stateful callback ref when the owner rerenders", () => {
    function Harness() {
      const [, setRevision] = React.useState(0);

      return (
        <>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Open dropdown
          </button>
          <ScrollArea
            viewportRef={(node) => {
              if (node) {
                setRevision((value) => value + 1);
              }
            }}
          >
            <div>PDF page</div>
          </ScrollArea>
        </>
      );
    }

    const { getByRole } = render(<Harness />);

    expect(() =>
      getByRole("button", { name: "Open dropdown" }).click()
    ).not.toThrow("Maximum update depth exceeded");
  });

  it("can keep a high-contrast scrollbar visible for PDF navigation", () => {
    const { container } = render(
      <ScrollArea scrollbarAlwaysVisible scrollbarGutter>
        <div>Long PDF</div>
      </ScrollArea>
    );
    const vertical = container.querySelector(
      '[data-slot="scroll-area-scrollbar"][orientation="vertical"]'
    );
    expect(vertical).toHaveClass(
      "opacity-100!",
      "data-[orientation=vertical]:w-2.5",
      "bg-slate-200/80"
    );
    expect(
      vertical?.querySelector('[data-slot="scroll-area-thumb"]')
    ).toHaveClass("bg-slate-500/75");
  });
});
