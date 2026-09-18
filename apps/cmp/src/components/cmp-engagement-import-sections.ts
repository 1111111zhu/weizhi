export const ENGAGEMENT_IMPORT_SECTIONS = [
  "business",
  "reports",
  "risk",
  "people",
  "commercial",
  "notes",
] as const;

export type EngagementImportSection =
  (typeof ENGAGEMENT_IMPORT_SECTIONS)[number];

export const DEFAULT_ENGAGEMENT_IMPORT_SECTIONS = [
  ...ENGAGEMENT_IMPORT_SECTIONS,
] as EngagementImportSection[];

const IMPORT_SECTION_SET = new Set<string>(ENGAGEMENT_IMPORT_SECTIONS);

/**
 * Absent is the legacy copy-forward URL and means copy everything.  `none`
 * deliberately represents a user who chose a source but cleared every group.
 */
export function parseEngagementImportSections(
  value?: string
): EngagementImportSection[] {
  if (value === undefined) {
    return [...DEFAULT_ENGAGEMENT_IMPORT_SECTIONS];
  }
  if (!value || value === "none") {
    return [];
  }
  return [
    ...new Set(
      value
        .split(",")
        .filter((section): section is EngagementImportSection =>
          IMPORT_SECTION_SET.has(section)
        )
    ),
  ];
}

export function serializeEngagementImportSections(
  sections: readonly EngagementImportSection[]
) {
  const selected = new Set(sections);
  const normalized = ENGAGEMENT_IMPORT_SECTIONS.filter((section) =>
    selected.has(section)
  );
  return normalized.length ? normalized.join(",") : "none";
}

export function includesEngagementImportSection(
  sections: readonly EngagementImportSection[],
  section: EngagementImportSection
) {
  return sections.includes(section);
}
