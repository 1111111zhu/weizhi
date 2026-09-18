export function isMockApiMode(value?: string) {
  return (value ?? "").toLowerCase() === "mock";
}

export function getApiMode() {
  return process.env.NEXT_PUBLIC_API_MODE;
}

export function isRemoteVisualizationMode(
  apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
  nodeEnv = process.env.NODE_ENV
) {
  return nodeEnv === "development" && apiBaseUrl === "http://localhost:3010";
}
