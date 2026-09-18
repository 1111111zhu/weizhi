// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, buttonVariants } from "./button";

describe("EMP button hover surfaces", () => {
  afterEach(cleanup);

  it.each(["ghost", "outline"] as const)(
    "keeps %s hover distinct from its card surface",
    async (variant) => {
      const classes = buttonVariants({ variant });
      const onClick = vi.fn();
      const onPointerEnter = vi.fn();
      render(
        <Button
          variant={variant}
          onClick={onClick}
          onPointerEnter={onPointerEnter}
        >
          Continue
        </Button>
      );
      const control = screen.getByRole("button", { name: "Continue" });
      await userEvent.hover(control);
      expect(onPointerEnter).toHaveBeenCalledOnce();
      await userEvent.tab();
      expect(control).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      expect(onClick).toHaveBeenCalledOnce();

      expect(classes).toContain(
        "hover:bg-[color-mix(in_oklab,var(--card),var(--foreground)_5%)]"
      );
      expect(classes).not.toContain("hover:bg-muted");
    }
  );

  it("keeps expanded and disabled state hooks on ghost buttons", async () => {
    const classes = buttonVariants({ variant: "ghost" });
    const onClick = vi.fn();
    render(
      <Button variant="ghost" disabled aria-expanded="true" onClick={onClick}>
        Continue
      </Button>
    );
    const control = screen.getByRole("button", { name: "Continue" });
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(control);
    expect(onClick).toHaveBeenCalledTimes(0);

    expect(classes).toContain("aria-expanded:bg-muted");
    expect(classes).toContain("disabled:pointer-events-none");
    expect(classes).toContain("disabled:opacity-50");
  });
});
