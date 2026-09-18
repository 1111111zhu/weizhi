export type WorkbenchPane =
  | "files"
  | "directory"
  | "preview"
  | "notes"
  | "tasks";

export function compactWorkbenchLayout(
  pane: WorkbenchPane,
  tasksOpen: boolean
) {
  const active =
    pane === "directory"
      ? "project-directory"
      : pane === "preview"
        ? "project-file-preview"
        : pane === "tasks" && tasksOpen
          ? "project-team-work-items"
          : "project-review";
  return {
    horizontal: Object.fromEntries(
      [
        "project-directory",
        "project-review",
        "project-file-preview",
        "project-team-work-items",
      ].map((id) => [id, id === active ? 100 : 0])
    ),
    vertical: {
      "project-files-workspace": pane === "notes" ? 0 : 100,
      "project-file-review-notes": pane === "notes" ? 100 : 0,
    },
  };
}

/** Optional task panels can be opened/closed while a compact view is active. */
export function reconcileWorkbenchLayout(
  saved: Record<string, number>,
  current: Record<string, number>
) {
  const entries = Object.keys(current).map(
    (id) => [id, saved[id] ?? current[id]] as const
  );
  const total = entries.reduce((sum, [, size]) => sum + size, 0);
  return Object.fromEntries(
    entries.map(([id, size]) => [
      id,
      total > 0 ? (size * 100) / total : 100 / entries.length,
    ])
  );
}
