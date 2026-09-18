import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { Mutation, Query } from "@tanstack/react-query";

import {
  isAbortError,
  isNetworkError,
  showErrorToast,
} from "../lib/error-toast";
import { installPreviewQueryCacheBudget } from "../lib/preview-query-cache";

const ERROR_TOAST_WINDOW_MS = 3500;
const NON_ACTIONABLE_QUERY_ERROR_CODES = new Set([
  "INTERNAL_SERVER_ERROR",
  "REQUEST_FAILED",
]);
const recentErrorToasts = new Map<string, number>();

export function createEmpQueryClient() {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => notifyQueryError(error, query),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        notifyMutationError(error, mutation),
    }),
  });
  installPreviewQueryCacheBudget(queryClient);
  return queryClient;
}

function notifyQueryError(error: unknown, query: Query<unknown, unknown>) {
  const errorCode = readErrorCode(error);
  if (
    isAbortError(error) ||
    isNetworkError(error) ||
    query.meta?.suppressGlobalErrorToast ||
    (errorCode !== null && NON_ACTIONABLE_QUERY_ERROR_CODES.has(errorCode))
  ) {
    return;
  }
  if (query.queryKey[0] === "me" && errorCode === "UNAUTHORIZED") {
    return;
  }
  notifyOnce(error, `query:${query.queryHash}`);
}

function notifyMutationError(
  error: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>
) {
  if (
    isAbortError(error) ||
    mutation.options.meta?.suppressGlobalErrorToast ||
    mutation.options.onError
  ) {
    return;
  }
  notifyOnce(
    error,
    `mutation:${String(mutation.options.mutationKey ?? "anonymous")}`
  );
}

function notifyOnce(error: unknown, key: string) {
  const now = Date.now();
  const lastShownAt = recentErrorToasts.get(key) ?? 0;
  if (now - lastShownAt < ERROR_TOAST_WINDOW_MS) {
    return;
  }
  recentErrorToasts.set(key, now);
  for (const [entryKey, timestamp] of recentErrorToasts) {
    if (now - timestamp >= ERROR_TOAST_WINDOW_MS) {
      recentErrorToasts.delete(entryKey);
    }
  }
  showErrorToast(error);
}

function readErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : null;
}
