import { cleanup, fireEvent, render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { useState } from "react";
import { describe, afterEach, expect, it } from "vitest";

import { ConfirmationResponseFilePicker } from "./confirmation-response-file-picker";

describe("confirmation behavior", () => {
  afterEach(cleanup);

  it("keeps multiple batches, ignores reselected files and removes only the chosen file", () => {
    function Form() {
      const [files, setFiles] = useState<File[]>([]);
      return (
        <ConfirmationResponseFilePicker
          id="files"
          label="Response files"
          help="Multiple files"
          accept=".pdf"
          locale="en-US"
          files={files}
          onChange={setFiles}
        />
      );
    }
    render(<Form />);
    const a = new File(["a"], "a.pdf", { lastModified: 1 });
    const b = new File(["b"], "b.pdf", { lastModified: 2 });
    const c = new File(["c"], "c.pdf", { lastModified: 3 });
    const input = screen.getByLabelText("Response files");
    expect(input).toHaveAttribute("multiple");
    fireEvent.change(input, { target: { files: [a, b] } });
    fireEvent.change(input, { target: { files: [b, c] } });
    expect(screen.getByText("3 selected")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Remove b.pdf" }));
    expect(screen.getByText("2 selected")).toBeVisible();
    expect(screen.getByText("a.pdf")).toBeVisible();
    expect(screen.getByText("c.pdf")).toBeVisible();
    expect(screen.queryByText("b.pdf")).not.toBeInTheDocument();
  });
});
