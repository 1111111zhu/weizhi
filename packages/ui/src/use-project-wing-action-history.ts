"use client";

import { useCallback, useEffect, useState } from "react";

export type ProjectWingActionHistoryEntry = {
  id: string;
};

export function useProjectWingActionHistory<
  Entry extends ProjectWingActionHistoryEntry,
>({ current, storageKey }: { current: Entry; storageKey?: string }) {
  const [history, setHistory] = useState<Entry[]>([]);
  const commitHistory = useCallback(
    (nextHistory: Entry[]) => {
      if (storageKey && typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey, JSON.stringify(nextHistory));
        return;
      }
      setHistory(nextHistory);
    },
    [storageKey]
  );

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    const storedHistory = readStoredHistory<Entry>(storageKey);
    if (storedHistory.length > 0) {
      setHistory(storedHistory);
    }
  }, [storageKey]);

  const navigateTo = useCallback(
    (destination: Entry, navigate: (entry: Entry) => void) => {
      if (destination.id === current.id) {
        return;
      }
      commitHistory([...history, current]);
      navigate(destination);
    },
    [commitHistory, current, history]
  );
  const returnToPrevious = useCallback(
    (navigate: (entry: Entry) => void) => {
      const destination = history.at(-1);
      if (!destination) {
        return;
      }
      commitHistory(history.slice(0, -1));
      navigate(destination);
    },
    [commitHistory, history]
  );

  return {
    canReturn: history.length > 0,
    navigateTo,
    returnTarget: history.at(-1),
    returnToPrevious,
  };
}

function readStoredHistory<Entry extends ProjectWingActionHistoryEntry>(
  storageKey: string
) {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const value = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(isHistoryEntry) as Entry[];
  } catch {
    return [];
  }
}

function isHistoryEntry(
  value: unknown
): value is ProjectWingActionHistoryEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  );
}
