// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmpMobileReviewQuestionFooter } from "./emp-mobile-review-question-footer";

const copy = {
  referenceWorkpaper: "Reference workpaper",
  assignRespondent: "Assign respondent",
  unassigned: "Unassigned",
  addReviewNote: "Add review note",
  adding: "Adding...",
  noWorkpapersAvailable: "No workpapers available",
  close: "Close",
};
type Props = ComponentProps<typeof EmpMobileReviewQuestionFooter>;
function defaults(overrides: Partial<Props> = {}): Props {
  return {
    copy,
    papers: [
      {
        id: "paper-1",
        code: "A-REF",
        title: "Supporting evidence",
        path: "Audit / Cash",
      },
    ],
    selectedReferenceIds: [],
    respondents: [{ id: "user-alice", name: "Alice", role: "Reviewer" }],
    assignedToId: "",
    pending: false,
    submitDisabled: false,
    error: null,
    onToggleReference: vi.fn(),
    onAssign: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
}

describe("mobile new-Q footer", () => {
  afterEach(cleanup);

  it("selects references and a respondent without prematurely submitting", async () => {
    const onSubmit = vi.fn();
    const onAssign = vi.fn();
    const onToggleReference = vi.fn();
    function Harness() {
      const [assignedToId, setAssignedToId] = useState("");
      const [selectedReferenceIds, setSelectedReferenceIds] = useState<
        string[]
      >([]);
      return (
        <EmpMobileReviewQuestionFooter
          {...defaults({
            assignedToId,
            selectedReferenceIds,
            onSubmit,
            onAssign: (id) => {
              onAssign(id);
              setAssignedToId(id);
            },
            onToggleReference: (id) => {
              onToggleReference(id);
              setSelectedReferenceIds((ids) =>
                ids.includes(id)
                  ? ids.filter((value) => value !== id)
                  : [...ids, id]
              );
            },
          })}
        />
      );
    }
    render(<Harness />);
    await userEvent.click(
      screen.getByRole("button", { name: "Reference workpaper" })
    );
    const references = await screen.findByRole("dialog", {
      name: "Reference workpaper",
    });
    expect(references).toHaveClass("pw-mobile-sheet");
    await userEvent.click(
      within(references).getByRole("checkbox", { name: /A-REF/ })
    );
    expect(onToggleReference).toHaveBeenLastCalledWith("paper-1");
    await userEvent.click(
      within(references).getByRole("button", { name: "Close" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(
      screen.getByRole("button", { name: "Assign respondent: Unassigned" })
    );
    const people = await screen.findByRole("dialog", {
      name: "Assign respondent",
    });
    await userEvent.click(
      within(people).getByRole("button", { name: /Alice/ })
    );
    expect(onAssign).toHaveBeenLastCalledWith("user-alice");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      screen.getByRole("button", { name: "Assign respondent: Alice" })
    ).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Add review note" })
    );
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("respects validation, pending state and visible errors", () => {
    const props = defaults({
      submitDisabled: true,
      error: "Upload could not finish",
    });
    const { rerender } = render(<EmpMobileReviewQuestionFooter {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Upload could not finish"
    );
    expect(
      screen.getByRole("button", { name: "Add review note" })
    ).toBeDisabled();
    rerender(<EmpMobileReviewQuestionFooter {...props} pending />);
    expect(
      screen.getByRole("button", { name: "Reference workpaper" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Assign respondent: Unassigned" })
    ).toBeDisabled();
    expect(
      screen
        .getByTestId("emp-mobile-q-create-footer")
        .querySelector("[data-loading]")
    ).toBeDisabled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("supports empty references and explicitly unassigning a respondent", async () => {
    const props = defaults({ papers: [], assignedToId: "user-alice" });
    render(<EmpMobileReviewQuestionFooter {...props} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Reference workpaper" })
    );
    await expect(
      screen.findByText("No workpapers available")
    ).resolves.toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(
      screen.getByRole("button", { name: "Assign respondent: Alice" })
    );
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Assign respondent" })
      ).getByRole("button", { name: "Unassigned" })
    );
    expect(props.onAssign).toHaveBeenLastCalledWith("");
  });
});
