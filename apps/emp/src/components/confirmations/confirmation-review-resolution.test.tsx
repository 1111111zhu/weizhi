import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import { ConfirmationReviewResolution } from "./confirmation-review-resolution";

describe("lint test setup", () => {
  afterEach(cleanup);

  const copy = {
    title: "Review response",
    description: "Confirm whether the response matches the request.",
    pending: "Pending review",
    matched: "Response matches",
    mismatched: "Response does not match",
    confirmMatched: "Confirm and complete",
    chooseAction: "Next action",
    redispatch: "Redispatch",
    alternativeProcedure: "Alternative procedure",
    notes: "Notes",
    notesPlaceholder: "Add a note",
    submit: "Confirm",
    completeAlternative: "Complete alternative procedure",
    undoReview: "Undo review conclusion",
  };

  describe(ConfirmationReviewResolution, () => {
    it("keeps both editable review decisions visible before a choice", () => {
      render(
        <ConfirmationReviewResolution
          status="RESPONSE_RECEIVED"
          differenceStatus={null}
          canEdit
          copy={copy}
          onReview={vi.fn()}
          onCompleteAlternativeProcedure={vi.fn()}
        />
      );

      const matched = screen.getByRole("button", { name: "Response matches" });
      const mismatched = screen.getByRole("button", {
        name: "Response does not match",
      });

      expect(matched).toBeVisible();
      expect(mismatched).toBeVisible();
    });

    it("submits a matched review without an action", () => {
      const onReview = vi.fn();
      render(
        <ConfirmationReviewResolution
          status="RESPONSE_RECEIVED"
          differenceStatus={null}
          canEdit
          copy={copy}
          onReview={onReview}
          onCompleteAlternativeProcedure={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Response matches" }));

      expect(onReview).toHaveBeenCalledWith({ result: "MATCHED" });
    });

    it("opens mismatch handling in a compact popover", () => {
      render(
        <ConfirmationReviewResolution
          status="RESPONSE_RECEIVED"
          differenceStatus={null}
          canEdit
          copy={copy}
          onReview={vi.fn()}
          onCompleteAlternativeProcedure={vi.fn()}
        />
      );

      const mismatched = screen.getByRole("button", {
        name: "Response does not match",
      });
      fireEvent.click(mismatched);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(mismatched).toHaveClass(
        "border-border",
        "bg-card",
        "text-foreground"
      );
      expect(mismatched).not.toHaveClass(
        "border-destructive/30",
        "text-destructive"
      );
    });

    it("makes the selected resolution action visibly distinct", () => {
      render(
        <ConfirmationReviewResolution
          status="RESPONSE_RECEIVED"
          differenceStatus={null}
          canEdit
          copy={copy}
          onReview={vi.fn()}
          onCompleteAlternativeProcedure={vi.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Response does not match" })
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Alternative procedure" })
      );

      const redispatch = screen.getByRole("button", { name: "Redispatch" });
      const alternative = screen.getByRole("button", {
        name: "Alternative procedure",
      });

      expect(alternative).toHaveAttribute("aria-pressed", "true");
      expect(alternative).toHaveClass(
        "border-primary/60",
        "bg-primary/10",
        "text-primary",
        "ring-1",
        "ring-primary/20"
      );
      expect(redispatch).toHaveAttribute("aria-pressed", "false");
      expect(redispatch).toHaveClass(
        "hover:border-primary/40",
        "hover:bg-primary/5",
        "hover:text-primary"
      );
    });

    it("focuses the notes field for direct editing", () => {
      render(
        <ConfirmationReviewResolution
          status="RESPONSE_RECEIVED"
          differenceStatus={null}
          canEdit
          copy={copy}
          onReview={vi.fn()}
          onCompleteAlternativeProcedure={vi.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Response does not match" })
      );

      expect(screen.getByLabelText("Notes")).toHaveFocus();
    });

    it("requires a resolution choice and notes for a mismatched review", () => {
      const onReview = vi.fn();
      render(
        <ConfirmationReviewResolution
          status="RESPONSE_RECEIVED"
          differenceStatus={null}
          canEdit
          copy={copy}
          onReview={onReview}
          onCompleteAlternativeProcedure={vi.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Response does not match" })
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Alternative procedure" })
      );
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "Use the bank statement" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

      expect(onReview).toHaveBeenCalledWith({
        result: "MISMATCHED",
        action: "ALTERNATIVE_PROCEDURE",
        notes: "Use the bank statement",
      });
    });

    it("offers completion when alternative procedure is pending", () => {
      const onComplete = vi.fn();
      render(
        <ConfirmationReviewResolution
          status="RESPONSE_RECEIVED"
          differenceStatus="PENDING_FOLLOW_UP"
          canEdit
          copy={copy}
          onReview={vi.fn()}
          onCompleteAlternativeProcedure={onComplete}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Complete alternative procedure" })
      );
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it("offers a rollback after a review conclusion was recorded", () => {
      const onUndo = vi.fn();
      render(
        <ConfirmationReviewResolution
          status="CLOSED"
          differenceStatus="MATCHED"
          canEdit
          canUndo
          copy={copy}
          onReview={vi.fn()}
          onCompleteAlternativeProcedure={vi.fn()}
          onUndo={onUndo}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Undo review conclusion" })
      );

      expect(onUndo).toHaveBeenCalledOnce();
    });
  });
});
