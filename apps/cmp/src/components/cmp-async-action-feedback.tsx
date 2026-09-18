"use client";

import { Skeleton } from "@project-wing/ui";
import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type CmpAsyncActionFeedbackOptions = {
  pendingLabel: string;
  successLabel: string;
  actionKey?: string;
};

export type CmpAsyncActionFeedbackState = {
  actionKey: string;
  phase: "pending" | "success";
  label: string;
};

const PENDING_DELAY_MS = 250;
const SUCCESS_DURATION_MS = 800;

export function useCmpAsyncActionFeedback() {
  const [feedbacks, setFeedbacks] = useState<CmpAsyncActionFeedbackState[]>([]);
  const [activeRunKeys, setActiveRunKeys] = useState<string[]>([]);
  const mountedRef = useRef(true);
  const activeRunsRef = useRef(new Map<string, Promise<unknown>>());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    <T,>(
      options: CmpAsyncActionFeedbackOptions,
      operation: () => Promise<T>
    ): Promise<T> => {
      const actionKey = options.actionKey ?? "default";
      const activeRun = activeRunsRef.current.get(actionKey);
      if (activeRun) {
        return activeRun as Promise<T>;
      }

      let feedbackVisible = false;
      let rejectRun: (reason?: unknown) => void = () => {};
      let resolveRun: (value: T | PromiseLike<T>) => void = () => {};
      const pendingRun = new Promise<T>((resolve, reject) => {
        resolveRun = resolve;
        rejectRun = reject;
      });
      activeRunsRef.current.set(actionKey, pendingRun);
      setActiveRunKeys((keys) =>
        keys.includes(actionKey) ? keys : [...keys, actionKey]
      );

      void (async () => {
        const pendingTimer = window.setTimeout(() => {
          if (!mountedRef.current) {
            return;
          }
          feedbackVisible = true;
          setFeedbacks((current) =>
            upsertFeedback(current, {
              actionKey,
              phase: "pending",
              label: options.pendingLabel,
            })
          );
        }, PENDING_DELAY_MS);

        try {
          const result = await operation();
          window.clearTimeout(pendingTimer);
          if (feedbackVisible && mountedRef.current) {
            setFeedbacks((current) =>
              upsertFeedback(current, {
                actionKey,
                phase: "success",
                label: options.successLabel,
              })
            );
            await delay(SUCCESS_DURATION_MS);
          }
          if (mountedRef.current) {
            setFeedbacks((current) =>
              current.filter((feedback) => feedback.actionKey !== actionKey)
            );
          }
          resolveRun(result);
        } catch (error) {
          window.clearTimeout(pendingTimer);
          if (mountedRef.current) {
            setFeedbacks((current) =>
              current.filter((feedback) => feedback.actionKey !== actionKey)
            );
          }
          rejectRun(error);
        } finally {
          if (activeRunsRef.current.get(actionKey) === pendingRun) {
            activeRunsRef.current.delete(actionKey);
          }
          if (mountedRef.current) {
            setActiveRunKeys((keys) => keys.filter((key) => key !== actionKey));
          }
        }
      })();

      return pendingRun;
    },
    []
  );
  const feedback =
    feedbacks.find((candidate) => candidate.actionKey === "default") ??
    feedbacks.at(-1) ??
    null;
  const feedbackFor = useCallback(
    (actionKey: string) =>
      feedbacks.find((candidate) => candidate.actionKey === actionKey) ?? null,
    [feedbacks]
  );
  const isRunningFor = useCallback(
    (actionKey: string) => activeRunKeys.includes(actionKey),
    [activeRunKeys]
  );

  return {
    feedback,
    feedbacks,
    feedbackFor,
    isRunning: activeRunKeys.length > 0,
    isRunningFor,
    run,
  };
}

export function CmpAsyncActionFeedback({
  feedback,
  presentation = "local",
}: {
  feedback: CmpAsyncActionFeedbackState | CmpAsyncActionFeedbackState[] | null;
  presentation?: "local" | "screen" | "workspace";
}) {
  const feedbackItems = Array.isArray(feedback)
    ? feedback
    : feedback
      ? [feedback]
      : [];
  if (feedbackItems.length === 0) {
    return null;
  }
  return (
    <output
      className="cmp-async-action-feedback"
      data-presentation={presentation}
      aria-live="assertive"
    >
      {feedbackItems.map((item) => (
        <div
          className={`cmp-async-action-feedback-card is-${item.phase}`}
          key={item.actionKey}
        >
          <span className="cmp-async-action-feedback-icon" aria-hidden="true">
            {item.phase === "success" ? (
              <Check />
            ) : (
              <Skeleton className="size-4 rounded-full" />
            )}
          </span>
          <p>{item.label}</p>
        </div>
      ))}
    </output>
  );
}

function delay(duration: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function upsertFeedback(
  current: CmpAsyncActionFeedbackState[],
  feedback: CmpAsyncActionFeedbackState
) {
  const index = current.findIndex(
    (candidate) => candidate.actionKey === feedback.actionKey
  );
  if (index === -1) {
    return [...current, feedback];
  }
  const next = [...current];
  next[index] = feedback;
  return next;
}
