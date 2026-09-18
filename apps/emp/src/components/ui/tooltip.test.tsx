// @vitest-environment jsdom

import {
  Tooltip as SharedTooltip,
  TooltipContent as SharedTooltipContent,
  TooltipTrigger as SharedTooltipTrigger,
} from "@project-wing/ui";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

afterEach(cleanup);

function expectLightTooltip(content: HTMLElement) {
  expect(content).toHaveClass(
    "border",
    "border-border",
    "bg-popover",
    "text-popover-foreground"
  );
  expect(content).not.toHaveClass("bg-foreground", "text-background");
  expect(content.lastElementChild).toHaveClass(
    "border-border",
    "bg-popover",
    "fill-popover"
  );
}

function LocalTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip open>
      <TooltipTrigger render={<button type="button">Trigger</button>} />
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

function SharedTooltipSurface({ children }: { children: ReactNode }) {
  return (
    <SharedTooltip open>
      <SharedTooltipTrigger
        render={<button type="button">Shared trigger</button>}
      />
      <SharedTooltipContent>{children}</SharedTooltipContent>
    </SharedTooltip>
  );
}

describe("Tooltip theme", () => {
  it("uses the light themed surface in EMP", async () => {
    render(<LocalTooltip>EMP tooltip</LocalTooltip>);

    expectLightTooltip(await screen.findByText("EMP tooltip"));
  });

  it("uses the light themed surface in the shared UI package", async () => {
    render(<SharedTooltipSurface>Shared tooltip</SharedTooltipSurface>);

    expectLightTooltip(await screen.findByText("Shared tooltip"));
  });
});
