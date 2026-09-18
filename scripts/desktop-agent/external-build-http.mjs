const transientStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);
const transientErrorCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);
const defaultTimeoutMilliseconds = 30_000;

export async function fetchWithRetry(url, options, settings = {}) {
  const {
    attempts = 5,
    fetchImpl = fetch,
    label = "request",
    log = console.warn,
    retryStatusCodes = transientStatusCodes,
    sleep = delay,
    timeoutMilliseconds = defaultTimeoutMilliseconds,
  } = settings;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(
        url,
        requestOptions(options, timeoutMilliseconds)
      );
      if (
        !isTransientResponse(response, retryStatusCodes) ||
        attempt === attempts
      ) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (!isTransientError(error) || attempt === attempts) {
        throw error;
      }
      lastError = error;
    }
    const milliseconds = retryDelay(attempt);
    log(
      `${label} transient failure (${lastError.message}); retrying in ${Math.ceil(milliseconds / 1000)}s (${attempt}/${attempts - 1}).`
    );
    await sleep(milliseconds);
  }
  throw lastError;
}

export async function formatHttpFailure(response, label, redactions = []) {
  let responseBody = "";
  try {
    const rawBody = await response.text();
    responseBody = rawBody.trim().replaceAll(/\s+/g, " ");
  } catch {
    // Preserve the status when a provider closes the response body early.
  }
  for (const value of redactions.filter((item) => item?.length >= 4)) {
    responseBody = responseBody.replaceAll(value, "***");
  }
  const detail = responseBody ? `: ${responseBody.slice(0, 10 ** 3)}` : ".";
  return `${label} failed with HTTP ${response.status}${detail}`;
}

function isTransientResponse(response, retryStatusCodes) {
  return retryStatusCodes instanceof Set
    ? retryStatusCodes.has(response.status)
    : retryStatusCodes.includes(response.status);
}

function isTransientError(error) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return true;
  }
  if (
    error instanceof TypeError &&
    /fetch failed|terminated/i.test(error.message)
  ) {
    return true;
  }
  for (let current = error; current; current = current.cause) {
    if (transientErrorCodes.has(current.code)) {
      return true;
    }
  }
  return false;
}

function requestOptions(options, timeoutMilliseconds) {
  const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds);
  if (!options.signal) {
    return { ...options, signal: timeoutSignal };
  }
  return {
    ...options,
    signal: AbortSignal.any([options.signal, timeoutSignal]),
  };
}

function retryDelay(attempt) {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
