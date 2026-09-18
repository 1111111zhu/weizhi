import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CmpI18nProvider } from "../i18n/client";
import { FormReviewDialog, FormWizardStepper } from "./cmp-form-controls";

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

describe(FormWizardStepper, () => {
  it("shows completion and warnings only for steps before the current step", () => {
    render(
      <CmpI18nProvider>
        <FormWizardStepper
          activeStepId="relationships"
          ariaLabel="Client form sections"
          steps={[
            { id: "basic", label: "Basic Information", status: "complete" },
            {
              id: "registration",
              label: "Registration",
              status: "incomplete",
              missingCount: 2,
            },
            {
              id: "relationships",
              label: "Relationships",
              status: "incomplete",
              missingCount: 1,
            },
            {
              id: "responsible",
              label: "Responsible Persons",
              status: "incomplete",
              missingCount: 1,
            },
            {
              id: "review",
              label: "Preview",
              status: "incomplete",
              missingCount: 4,
            },
          ]}
          onStepChange={vi.fn()}
        />
      </CmpI18nProvider>
    );

    const navigation = screen.getByRole("navigation", {
      name: "Client form sections",
    });
    const tabs = screen.getAllByRole("tab");
    const _completedIndicator = expectPresent(tabs[0]).querySelector(
      '[data-slot="stepper-indicator"]'
    );

    expect(
      expectPresent(tabs[0]).querySelector(".lucide-check")
    ).toBeInTheDocument();
    expect(
      expectPresent(tabs[1]).querySelector(".lucide-circle-alert")
    ).toBeInTheDocument();
    expect(
      navigation.querySelectorAll('[data-slot="stepper-title"]')
    ).toSatisfy((titles: NodeListOf<Element>) =>
      [...titles].every((title) =>
        title.classList.contains("whitespace-nowrap")
      )
    );
  });
});

describe(FormReviewDialog, () => {
  it("keeps the review dialog open while a submission is running", () => {
    const onOpenChange = vi.fn();
    render(
      <CmpI18nProvider>
        <FormReviewDialog
          open
          title="Review request"
          sections={[]}
          isBusy
          submitLabel="Submit"
          onOpenChange={onOpenChange}
          onSubmit={vi.fn()}
        />
      </CmpI18nProvider>
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close Review" })).toBeDisabled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
