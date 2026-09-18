// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import "./emp-surface-motion.css";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Sheet, SheetContent, SheetTrigger } from "./sheet";

describe("EMP surface motion contracts", () => {
  afterEach(cleanup);

  it("uses Base UI lifecycle classes for anchored surfaces and preserves dismissal focus", async () => {
    const user = userEvent.setup();

    render(
      <Popover>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent side="right">Popover content</PopoverContent>
      </Popover>
    );

    const trigger = screen.getByRole("button", { name: "Open popover" });
    await user.click(trigger);

    const content = await screen.findByText("Popover content");
    expect(content.closest("[data-slot=popover-content]")).toHaveClass(
      "emp-surface-motion-anchored"
    );
    expect(content.closest("[data-slot=popover-content]")).toHaveAttribute(
      "data-side",
      "right"
    );

    await user.keyboard("{Escape}");
    expect(content.closest("[data-slot=popover-content]")).toHaveAttribute(
      "data-ending-style"
    );
    await waitFor(() => {
      expect(screen.queryByText("Popover content")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("keeps nested dialogs dismissible one layer at a time and marks each popup", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open outer</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Outer dialog</DialogTitle>
          <Dialog>
            <DialogTrigger>Open inner</DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogTitle>Inner dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    );

    const outerTrigger = screen.getByRole("button", { name: "Open outer" });
    await user.click(outerTrigger);
    expect(screen.getByRole("dialog", { name: "Outer dialog" })).toHaveClass(
      "emp-surface-motion-dialog"
    );

    await user.click(screen.getByRole("button", { name: "Open inner" }));
    expect(screen.getByRole("dialog", { name: "Inner dialog" })).toHaveClass(
      "emp-surface-motion-dialog"
    );

    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("dialog", { name: "Inner dialog" })
    ).toHaveAttribute("data-ending-style");
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Inner dialog" })
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("dialog", { name: "Outer dialog" })
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Outer dialog" })
      ).not.toBeInTheDocument();
      expect(outerTrigger).toHaveFocus();
    });
  });

  it("keeps menu selection, select selection, and sheet dismissal behavior intact", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onValueChange = vi.fn();

    render(
      <>
        <DropdownMenu>
          <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onSelect}>Menu item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Select onValueChange={onValueChange}>
          <SelectTrigger aria-label="Choose value">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chosen">Chosen</SelectItem>
          </SelectContent>
        </Select>
        <Sheet>
          <SheetTrigger>Open sheet</SheetTrigger>
          <SheetContent>Sheet content</SheetContent>
        </Sheet>
      </>
    );

    const menuTrigger = screen.getByRole("button", { name: "Open menu" });
    await user.click(menuTrigger);
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("emp-surface-motion-menu");
    await user.click(screen.getByRole("menuitem", { name: "Menu item" }));
    expect(onSelect).toHaveBeenCalledOnce();
    await waitFor(() => expect(menuTrigger).toHaveFocus());

    await user.click(screen.getByRole("combobox", { name: "Choose value" }));
    const option = await screen.findByRole("option", { name: "Chosen" });
    expect(option.closest("[data-slot=select-content]")).toHaveClass(
      "emp-surface-motion-menu"
    );
    await user.click(option);
    expect(onValueChange).toHaveBeenCalledWith("chosen", expect.anything());

    const sheetTrigger = screen.getByRole("button", { name: "Open sheet" });
    await user.click(sheetTrigger);
    expect(
      screen.getByText("Sheet content").closest("[data-slot=sheet-content]")
    ).toHaveClass("emp-surface-motion-sheet");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByText("Sheet content")).not.toBeInTheDocument();
      expect(sheetTrigger).toHaveFocus();
    });
  });

  it("defines the shared lifecycle tokens and reduced motion opacity contract", () => {
    const css = readFileSync(
      path.resolve(process.cwd(), "src/components/ui/emp-surface-motion.css"),
      "utf-8"
    );

    expect(css).toContain("--emp-motion-enter: 260ms");
    expect(css).toContain("--emp-motion-exit: 180ms");
    expect(css).toContain("--emp-motion-menu-enter: 220ms");
    expect(css).toContain("--emp-motion-ease: cubic-bezier(0.16, 1, 0.3, 1)");
    expect(css).toContain("[data-starting-style]");
    expect(css).toContain("[data-ending-style]");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/transition-property:\s*opacity/);
  });
});
