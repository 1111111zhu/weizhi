import { getDesktopAgentFetchTimeoutMs } from "./config.js";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function fetchWithDesktopAgentTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit = {},
  timeoutMs = getDesktopAgentFetchTimeoutMs()
) {
  const signal = withTimeoutSignal(init.signal, timeoutMs);
  return fetchImpl(url, {
    ...init,
    ...(signal ? { signal } : {}),
  });
}

function withTimeoutSignal(
  callerSignal: AbortSignal | null | undefined,
  timeoutMs: number
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return callerSignal ?? undefined;
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!callerSignal) {
    return timeoutSignal;
  }

  const abortSignalWithAny = AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  if (abortSignalWithAny.any) {
    return abortSignalWithAny.any([callerSignal, timeoutSignal]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (callerSignal.aborted || timeoutSignal.aborted) {
    abort();
  } else {
    callerSignal.addEventListener("abort", abort, { once: true });
    timeoutSignal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}
