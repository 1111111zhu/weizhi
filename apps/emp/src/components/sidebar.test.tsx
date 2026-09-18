import { cleanup, fireEvent, render, screen } from "@testing-library/react";
// @vitest-environment happy-dom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "./sidebar";

describe("lint test setup", () => {
  afterEach(cleanup);

  describe("shadcn-style Sidebar", () => {
    it("exposes composable sidebar slots", () => {
      const { container } = render(
        createElement(
          SidebarProvider,
          null,
          createElement(
            Sidebar,
            null,
            createElement(SidebarHeader, null, "Header"),
            createElement(
              SidebarContent,
              null,
              createElement(
                SidebarMenu,
                null,
                createElement(
                  SidebarMenuItem,
                  null,
                  createElement(
                    SidebarMenuButton,
                    { isActive: true },
                    "Planning"
                  )
                )
              )
            )
          )
        )
      );

      expect(container.querySelector('[data-slot="sidebar"]')).toBeTruthy();
      expect(
        container.querySelector('[data-slot="sidebar-content"]')
      ).toBeTruthy();
    });

    it("keeps provider state controllable through the rail", () => {
      const onOpenChange = vi.fn();

      render(
        createElement(
          SidebarProvider,
          { defaultOpen: true, onOpenChange },
          createElement(SidebarRail, {
            "aria-label": "Toggle sidebar",
            "data-testid": "sidebar-rail",
          })
        )
      );

      const rail = screen.getByRole("separator", { name: "Toggle sidebar" });
      expect(rail).toHaveAttribute("data-slot", "splitter-rail");
      expect(rail).toHaveAttribute("aria-expanded", "true");
      expect(rail).toHaveClass(
        "data-[resize-state=dragging]:cursor-col-resize"
      );
      expect(rail).toHaveClass("active:cursor-col-resize");
      expect(screen.getByTestId("sidebar-rail-hit-area")).toHaveClass(
        "absolute",
        "inset-y-0",
        "-inset-x-3",
        "cursor-pointer"
      );

      fireEvent.click(rail);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("keeps provider state controllable through the trigger", () => {
      const onOpenChange = vi.fn();

      render(
        createElement(
          SidebarProvider,
          { defaultOpen: true, onOpenChange },
          createElement(SidebarTrigger, { "aria-label": "Toggle sidebar" })
        )
      );

      fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
