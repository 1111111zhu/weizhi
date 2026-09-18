"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getConfirmationLogisticsDeliveryVersion } from "@project-wing/shared/confirmation-logistics";
import { api } from "../../api/client";
import type { ProjectConfirmation } from "../../api/client";

export type LogisticsUnreadEntry = {
  projectId: string;
  confirmationId: string;
  type: string;
  version: string;
};
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const EMPTY: LogisticsUnreadEntry[] = [];

export function useConfirmationLogisticsUnread() {
  const me = useQuery({
    queryKey: ["me"],
    enabled: typeof api.me === "function",
    queryFn: () => (typeof api.me === "function" ? api.me() : Promise.resolve(null)),
  });
  const userId = me.data?.id;
  const query = useQuery({
    queryKey: ["confirmationLogisticsUnread", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<LogisticsUnreadEntry[]> => {
      const response = await fetch(`${API_BASE_URL}/confirmations/logistics-unread`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load logistics updates");
      return response.json();
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  return { entries: query.data ?? EMPTY, userId };
}

export function LogisticsUnreadDot({ projectId, confirmationId, confirmationIds }: {
  projectId?: string;
  confirmationId?: string;
  confirmationIds?: string[];
}) {
  const { entries } = useConfirmationLogisticsUnread();
  const unread = entries.some(entry =>
    (!projectId || entry.projectId === projectId) &&
    (!confirmationId || entry.confirmationId === confirmationId) &&
    (!confirmationIds || confirmationIds.includes(entry.confirmationId))
  );
  return unread ? <span aria-hidden="true" data-testid="logistics-unread-dot"
    className="inline-block size-1.5 shrink-0 rounded-full bg-red-500" /> : null;
}

export function ConfirmationLogisticsReadMarker({ confirmation }: { confirmation: ProjectConfirmation }) {
  const { entries, userId } = useConfirmationLogisticsUnread();
  const queryClient = useQueryClient();
  const visibleVersion = getConfirmationLogisticsDeliveryVersion(confirmation);
  const unread = entries.find(entry => entry.confirmationId === confirmation.id);
  const attempted = useRef<string | null>(null);
  const markRead = useMutation({
    mutationFn: async (version: string) => {
      const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(confirmation.projectId)}/confirmations/${encodeURIComponent(confirmation.id)}/logistics-read`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (!response.ok) throw new Error("Unable to acknowledge logistics update");
      const result = await response.json() as { acknowledged: boolean };
      return result.acknowledged ? version : null;
    },
    retry: 1,
    onSuccess: (version) => {
      if (version) {
        queryClient.setQueryData<LogisticsUnreadEntry[]>(["confirmationLogisticsUnread", userId],
          current => current?.filter(entry => entry.confirmationId !== confirmation.id || entry.version !== version));
      }
      void queryClient.invalidateQueries({ queryKey: ["confirmationLogisticsUnread", userId] });
    },
  });
  const mutate = markRead.mutate;
  useEffect(() => {
    const acknowledge = () => {
      if (document.visibilityState === "hidden" || !userId || !unread || unread.version !== visibleVersion) return;
      const key = `${userId}:${confirmation.id}:${visibleVersion}`;
      if (attempted.current === key) return;
      attempted.current = key;
      mutate(unread.version);
    };
    acknowledge();
    document.addEventListener("visibilitychange", acknowledge);
    return () => document.removeEventListener("visibilitychange", acknowledge);
  }, [confirmation.id, mutate, unread?.version, userId, visibleVersion]);
  return null;
}
