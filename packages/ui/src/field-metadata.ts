/** Shared by ordinary fields and the guided-form presentation. */
export function joinFieldDescriptionIds(
  ...ids: (string | null | undefined)[]
): string | undefined {
  const values = ids.flatMap(
    (value) => value?.split(/\s+/).filter(Boolean) ?? []
  );
  return [...new Set(values)].join(" ") || undefined;
}
