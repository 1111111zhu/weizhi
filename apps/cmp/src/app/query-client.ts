import {
  getProjectWingErrorPresentation,
  isProjectWingAbortError,
  projectWingToast as sonnerToast,
} from "@project-wing/ui";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

function showGlobalError(error: unknown) {
  if (isProjectWingAbortError(error)) {
    return;
  }
  const presentation = getProjectWingErrorPresentation(error);
  sonnerToast.error(presentation.title, {
    description: presentation.description,
    duration: 5000,
    id: `cmp-request-error:${presentation.requestId ?? presentation.code ?? "unknown"}`,
  });
}

export function createCmpQueryClient() {
  const queryCache = new QueryCache({
    onError: (error, query) => {
      if (query.queryKey[0] === "me") {
        return;
      }
      showGlobalError(error);
    },
  });
  const mutationCache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) {
        return;
      }
      showGlobalError(error);
    },
  });

  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}
