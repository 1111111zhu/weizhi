import { CmpAcceptanceChangeSummarySchema } from "@project-wing/shared";
import type { CmpAcceptanceChangeSummary } from "@project-wing/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export async function getCmpAcceptanceChanges(
  requestId: string
): Promise<CmpAcceptanceChangeSummary> {
  if (process.env.NEXT_PUBLIC_API_MODE === "mock") {
    return {
      status: "BASELINE_UNAVAILABLE",
      changedFieldCount: 0,
      baselineCapturedAt: null,
      staleMasterData: false,
      groups: [],
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/cmp/acceptance/${requestId}/changes`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw new Error(getSafeErrorMessage(response.status));
  }
  return CmpAcceptanceChangeSummarySchema.parse(await response.json());
}

function getSafeErrorMessage(status: number) {
  if (status === 404) {
    return "The requested changes could not be found.";
  }
  if (status >= 500) {
    return "The server is unavailable. Please try again later.";
  }
  return "The changes could not be loaded. Please try again.";
}
