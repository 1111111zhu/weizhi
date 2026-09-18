import { render, screen } from "@testing-library/react";
// @vitest-environment happy-dom
import { createElement, createRef } from "react";
import { describe, expect, it } from "vitest";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

describe("shadcn-style ui primitives", () => {
  it("forwards refs for generated form and card primitives", () => {
    const inputRef = createRef<HTMLInputElement>();
    const cardRef = createRef<HTMLDivElement>();

    render(
      createElement(
        "div",
        null,
        createElement(Input, { ref: inputRef, "aria-label": "Name" }),
        createElement(
          NativeSelect,
          { "aria-label": "Role" },
          createElement("option", null, "Partner")
        ),
        createElement(Card, { ref: cardRef }, "Panel")
      )
    );

    expect(inputRef.current).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText("Role")).toHaveAttribute(
      "data-slot",
      "native-select"
    );
    expect(cardRef.current).toBeInstanceOf(HTMLDivElement);
  });
});
