// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfirmationWorkflowTracker } from "./confirmation-workflow-tracker";

describe("ConfirmationWorkflowTracker", () => {
  it("shows the latest return actor and time while waiting for a new response", () => {
    render(
      <ConfirmationWorkflowTracker
        ariaLabel="Confirmation workflow"
        actorLabel="Registered by"
        locale="en-US"
        timeLabel="Time"
        waitingLabel="Waiting"
        titles={{
          created: "Created",
          frozen: "Frozen",
          sent: "Sent",
          followUp: "Response follow-up",
          manualReview: "Manual review",
          completed: "Completed",
        }}
        milestones={[
          {
            key: "followUp",
            complete: false,
            active: true,
            actor: "Leo Li",
            at: "2026-08-24T13:15:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Waiting")).toBeVisible();
    expect(screen.getByText(/Registered by：Leo Li/)).toBeVisible();
    expect(screen.getByText(/Time：Aug 24, 2026/)).toBeVisible();
  });
});
