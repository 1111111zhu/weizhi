// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { ProjectFileTypeIcon } from "./project-file-type-icon";

describe(ProjectFileTypeIcon, () => {
  it("uses the dedicated SmartForm icon contract for .sf files", () => {
    const view = render(<ProjectFileTypeIcon fileName="Audit Programme.sf" />);

    expect(screen.getByTestId("smart-form-file-icon")).toBeInTheDocument();
    expect(view.container.querySelector("img")).toBeNull();
  });
});
