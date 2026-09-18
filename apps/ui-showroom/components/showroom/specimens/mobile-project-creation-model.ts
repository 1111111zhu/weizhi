export type MobileCreationStage = "source" | "business" | "setup" | "review";
export function parseMobileCreationStage(hash: string): MobileCreationStage {
  const value = hash.replace(/^#/, "");
  return value === "business" || value === "setup" || value === "review"
    ? value
    : "source";
}
export const mobileCreationHash = (stage: MobileCreationStage) => `#${stage}`;
export function pushMobileCreationStage(
  trail: { entries: string[]; index: number },
  stage: MobileCreationStage
) {
  const hash = mobileCreationHash(stage);
  if (trail.entries[trail.index] === hash) {
    return trail;
  }
  const entries = [...trail.entries.slice(0, trail.index + 1), hash];
  return { entries, index: entries.length - 1 };
}
export const projectCreationBusinesses = [
  { value: "orchid", label: "Orchid Technology Limited", code: "ORC-2026-AUD" },
  { value: "harbour", label: "Harbour Retail Limited", code: "HBR-2026-ACC" },
];
export function filterProjectCreationBusinesses(query: string) {
  const search = query.trim().toLowerCase();
  return projectCreationBusinesses.filter((item) =>
    `${item.label} ${item.code}`.toLowerCase().includes(search)
  );
}
