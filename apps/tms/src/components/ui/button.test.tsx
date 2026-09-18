// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, buttonVariants } from "./button";

describe("TMS button hover surfaces", () => {
  afterEach(cleanup);

  it("keeps secondary hover semantic in dark mode", () => {
    const classes = buttonVariants({ variant: "secondary" });
    const onClick = vi.fn();
    const onPointerEnter = vi.fn();
    render(
      <Button
        variant="secondary"
        onClick={onClick}
        onPointerEnter={onPointerEnter}
      >
        Continue
      </Button>
    );
    const control = screen.getByRole("button", { name: "Continue" });
    fireEvent.pointerEnter(control);
    expect(onPointerEnter).toHaveBeenCalledOnce();
    control.focus();
    expect(control).toHaveFocus();
    fireEvent.click(control);
    expect(onClick).toHaveBeenCalledOnce();

    expect(classes).toContain(
      "hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]"
    );
    expect(classes).not.toContain("hover:bg-slate-200");
  });
});
