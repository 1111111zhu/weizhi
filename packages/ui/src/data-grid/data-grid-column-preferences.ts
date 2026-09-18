import type { VisibilityState } from "@tanstack/react-table";

/** Responsive visibility is a default, never a veto of a user's explicit choice. */
export function getResponsiveColumnVisibility(
  preferences: VisibilityState,
  defaultHiddenColumnIds: readonly string[]
): VisibilityState {
  return {
    ...Object.fromEntries(defaultHiddenColumnIds.map((id) => [id, false])),
    ...preferences,
  };
}
