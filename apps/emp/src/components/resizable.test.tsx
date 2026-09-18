import { render, screen } from "@testing-library/react";
// @vitest-environment happy-dom
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

describe(ResizableHandle, () => {
  it("keeps horizontal split handles vertical", () => {
    render(
      createElement(
        ResizablePanelGroup,
        { orientation: "horizontal" },
        createElement(ResizablePanel, null, "Left"),
        createElement(ResizableHandle, {
          "aria-label": "Resize panels",
          withHandle: true,
        }),
        createElement(ResizablePanel, null, "Right")
      )
    );

    const handle = screen.getByRole("separator", { name: "Resize panels" });

    expect(handle).toHaveAttribute("data-slot", "resizable-handle");
    expect(handle).not.toHaveClass(
      "cursor-col-resize",
      "hover:bg-muted/60",
      "data-[resize-state=dragging]:bg-primary/10",
      "data-[separator=active]:bg-primary/10"
    );
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
  });

  it("uses the horizontal hit area and row cursor for vertical panel groups", () => {
    render(
      createElement(
        ResizablePanelGroup,
        { orientation: "vertical" },
        createElement(ResizablePanel, null, "Top"),
        createElement(ResizableHandle, {
          "aria-label": "Resize rows",
          withHandle: true,
        }),
        createElement(ResizablePanel, null, "Bottom")
      )
    );

    const handle = screen.getByRole("separator", { name: "Resize rows" });
    expect(handle).toHaveAttribute("aria-orientation", "horizontal");
  });
});
