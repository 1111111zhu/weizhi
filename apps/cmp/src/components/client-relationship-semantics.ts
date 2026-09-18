import type {
  CmpEntityKind,
  CmpEntityRelationshipDraft,
} from "@project-wing/shared";

import type { CmpDictionary } from "@/i18n/client";

export type DraftRelationshipCategory = "ownership" | "management" | "other";

export const DRAFT_RELATIONSHIP_TYPES = {
  ownership: ["OWNS"],
  management: [
    "DIRECTOR_OF",
    "BENEFICIAL_OWNER_OF",
    "COMPANY_SECRETARY_OF",
    "MANAGES",
  ],
  other: ["OTHER"],
} as const satisfies Record<
  DraftRelationshipCategory,
  readonly CmpEntityRelationshipDraft["type"][]
>;

export const ALL_DRAFT_RELATIONSHIP_TYPES = [
  ...DRAFT_RELATIONSHIP_TYPES.ownership,
  ...DRAFT_RELATIONSHIP_TYPES.management,
  ...DRAFT_RELATIONSHIP_TYPES.other,
] as const;

export function relationshipTypesForSourceKind(
  kind: CmpEntityKind
): readonly CmpEntityRelationshipDraft["type"][] {
  if (kind === "COMPANY") {
    return DRAFT_RELATIONSHIP_TYPES.ownership;
  }
  if (kind === "PERSON") {
    return ALL_DRAFT_RELATIONSHIP_TYPES;
  }
  return [] as const;
}

type WorkspaceCopy = CmpDictionary["workspace"];

export function relationshipTypeLabel(
  type: CmpEntityRelationshipDraft["type"],
  copy: WorkspaceCopy
) {
  return {
    OWNS: copy.clientFormRelationOwns,
    DIRECTOR_OF: copy.clientFormRelationDirectorOf,
    BENEFICIAL_OWNER_OF: copy.clientFormRelationBeneficialOwnerOf,
    COMPANY_SECRETARY_OF: copy.clientFormRelationCompanySecretaryOf,
    MANAGES: copy.clientFormRelationManages,
    OTHER: copy.clientFormRelationOther,
  }[type];
}

export function relationshipRoleLabels(
  type: CmpEntityRelationshipDraft["type"],
  copy: WorkspaceCopy
) {
  return (
    {
      OWNS: [copy.clientFormShareholder, copy.clientFormInvesteeCompany],
      DIRECTOR_OF: [copy.clientFormDirector, copy.clientFormAppointedCompany],
      BENEFICIAL_OWNER_OF: [
        copy.clientFormRelationBeneficialOwnerOf,
        copy.clientFormInvesteeCompany,
      ],
      COMPANY_SECRETARY_OF: [
        copy.clientFormCompanySecretary,
        copy.clientFormServedCompany,
      ],
      MANAGES: [copy.clientFormManager, copy.clientFormManagedEntity],
      OTHER: [copy.clientFormRelatedParty, copy.clientFormRelatedEntity],
    } satisfies Record<
      CmpEntityRelationshipDraft["type"],
      readonly [string, string]
    >
  )[type];
}

export function relationshipSupportsInterestDetails(
  type: CmpEntityRelationshipDraft["type"]
) {
  return type === "OWNS";
}

export function relationshipCategoryTitle(
  category: DraftRelationshipCategory,
  copy: WorkspaceCopy
) {
  return category === "ownership"
    ? copy.clientFormOwnershipRelationships
    : category === "management"
      ? copy.clientFormManagementRelationships
      : copy.clientFormOtherRelationships;
}
