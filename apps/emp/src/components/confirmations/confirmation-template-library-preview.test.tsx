// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ConfirmationTemplateDesign } from "../../api/client";
import { ConfirmationTemplateLibraryFieldOverlay } from "./confirmation-template-library-preview";

describe(ConfirmationTemplateLibraryFieldOverlay, () => {
  it("renders saved fillable fields on their matching template page", () => {
    const designSchema: ConfirmationTemplateDesign = {
      fields: [
        {
          height: 0.05,
          id: "page-one-client",
          kind: "TEXT",
          name: "Client name",
          options: [],
          page: 1,
          placeholder: "Enter client name",
          width: 0.3,
          x: 0.12,
          y: 0.18,
        },
        {
          height: 0.04,
          id: "page-two-reference",
          kind: "TEXT",
          name: "Reference",
          options: [],
          page: 2,
          placeholder: "Enter reference",
          width: 0.2,
          x: 0.6,
          y: 0.1,
        },
      ],
      version: 1,
    };

    render(
      <ConfirmationTemplateLibraryFieldOverlay
        designSchema={designSchema}
        pageNumber={1}
      />
    );

    const field = screen.getByTestId(
      "template-library-preview-field-page-one-client"
    );
    expect(field).toHaveAttribute("x", "0.12");
    expect(field).toHaveAttribute("y", "0.18");
    expect(field).toHaveAttribute("width", "0.3");
    expect(field).toHaveAttribute("height", "0.05");
    expect(screen.getByText("Enter client name")).toBeVisible();
    expect(
      screen.queryByTestId(
        "template-library-preview-field-page-two-reference"
      )
    ).toBeNull();
  });
});
