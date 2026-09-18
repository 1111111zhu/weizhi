import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CmpAsyncActionFeedback,
  useCmpAsyncActionFeedback,
} from "./cmp-async-action-feedback";

describe("cmp async action feedback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows pending feedback only after the delay, then confirms success", async () => {
    vi.useFakeTimers();
    let resolveOperation: (() => void) | undefined;
    render(
      <FeedbackHarness
        operation={() =>
          new Promise<void>((resolve) => {
            resolveOperation = resolve;
          })
        }
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.queryByText("Saving request...")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByText("Saving request...")).toBeInTheDocument();

    await act(async () => {
      resolveOperation?.();
      await Promise.resolve();
    });
    expect(screen.getByText("Request saved")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(screen.queryByText("Request saved")).toBeNull();
  });

  it("does not flash feedback for an immediate operation", async () => {
    const operation = vi.fn(async () => {});
    render(<FeedbackHarness operation={operation} />);

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(operation).toHaveBeenCalledOnce();
    expect(screen.queryByText("Saving request...")).toBeNull();
    expect(screen.queryByText("Request saved")).toBeNull();
  });

  it("clears pending feedback when an action fails", async () => {
    vi.useFakeTimers();
    let rejectOperation: ((error: Error) => void) | undefined;
    render(
      <FeedbackHarness
        operation={() =>
          new Promise<void>((_resolve, reject) => {
            rejectOperation = reject;
          })
        }
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByText("Saving request...")).toBeInTheDocument();

    await act(async () => {
      rejectOperation?.(new Error("Request failed"));
      await Promise.resolve();
    });
    expect(screen.queryByText("Saving request...")).toBeNull();
    expect(screen.queryByText("Request saved")).toBeNull();
  });

  it("reuses the active operation when triggered twice before rerender", async () => {
    let resolveOperation: (() => void) | undefined;
    const operation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveOperation = resolve;
        })
    );
    render(<FeedbackHarness operation={operation} />);

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(operation).toHaveBeenCalledOnce();
    await act(async () => {
      resolveOperation?.();
      await Promise.resolve();
    });
  });

  it("keeps independent feedback for concurrent action keys", async () => {
    vi.useFakeTimers();
    let resolveFirst: (() => void) | undefined;
    let resolveSecond: (() => void) | undefined;
    const first = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        })
    );
    const second = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSecond = resolve;
        })
    );
    render(<ConcurrentFeedbackHarness first={first} second={second} />);

    fireEvent.click(screen.getByRole("button", { name: "Run first" }));
    fireEvent.click(screen.getByRole("button", { name: "Run second" }));
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByText("Saving first...")).toBeInTheDocument();
    expect(screen.getByText("Saving second...")).toBeInTheDocument();

    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
    });
    expect(screen.getByText("First saved")).toBeInTheDocument();
    expect(screen.getByText("Saving second...")).toBeInTheDocument();
    expect(screen.getByText("First saved").closest("div")).toHaveClass(
      "is-success"
    );
    expect(screen.getByText("Saving second...").closest("div")).toHaveClass(
      "is-pending"
    );

    await act(async () => {
      resolveSecond?.();
      await Promise.resolve();
    });
    expect(screen.getByText("Second saved")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

function FeedbackHarness({ operation }: { operation: () => Promise<void> }) {
  const feedback = useCmpAsyncActionFeedback();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const result = feedback.run(
            {
              pendingLabel: "Saving request...",
              successLabel: "Request saved",
            },
            operation
          );
          void result.catch(() => {});
        }}
      >
        Run
      </button>
      <CmpAsyncActionFeedback feedback={feedback.feedback} />
    </div>
  );
}

function ConcurrentFeedbackHarness({
  first,
  second,
}: {
  first: () => Promise<void>;
  second: () => Promise<void>;
}) {
  const feedback = useCmpAsyncActionFeedback();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void feedback
            .run(
              {
                actionKey: "first",
                pendingLabel: "Saving first...",
                successLabel: "First saved",
              },
              first
            )
            .catch(() => {});
        }}
      >
        Run first
      </button>
      <button
        type="button"
        onClick={() => {
          void feedback
            .run(
              {
                actionKey: "second",
                pendingLabel: "Saving second...",
                successLabel: "Second saved",
              },
              second
            )
            .catch(() => {});
        }}
      >
        Run second
      </button>
      <CmpAsyncActionFeedback feedback={feedback.feedbacks} />
    </div>
  );
}
