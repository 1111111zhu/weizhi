import { CmpAcceptanceChangeSummarySchema } from "@project-wing/shared";
import type {
  CmpAcceptanceChangeSummary,
  CmpAcceptanceChangeValue,
  CmpAcceptanceRequestType,
} from "@project-wing/shared";

type Payload = Record<string, unknown>;

type FieldDefinition = {
  field: string;
  compareField?: string;
  displayField?: string;
  lookupPrefix?: "client" | "group" | "user";
  numeric?: boolean;
};

type SectionDefinition = {
  section: string;
  fields: (string | FieldDefinition)[];
};

const CLIENT_SECTIONS: SectionDefinition[] = [
  {
    section: "basicInformation",
    fields: [
      "clientCode",
      "companyCode",
      "companyNumber",
      "companyIdentifierType",
      "nameEn",
      "nameZh",
      "status",
      "address",
      "registeredAddress",
      "principalBusinessAddress",
      "principalAddressSameAsRegistered",
      "additionalAddresses",
      "contacts",
      "website",
      "yearEndMonth",
      "reportingGaap",
      "referredBy",
      "remarks",
    ],
  },
  {
    section: "incorporation",
    fields: [
      "placeOfIncorporation",
      "incorporationYearMonth",
      "hsicSectionCode",
      "industryOtherDescription",
    ],
  },
  {
    section: "listingAndRegulation",
    fields: [
      "listedOrPrivate",
      "stockExchangeOrListingPlace",
      "stockCode",
      "marketSegment",
      "regulatedEntities",
      "regulatedBy",
    ],
  },
  {
    section: "groupRelationship",
    fields: [
      "groupMode",
      {
        field: "group",
        compareField: "groupId",
        displayField: "groupName",
        lookupPrefix: "group",
      },
      "groupStructure",
      "isSubsidiary",
      "parentClientCode",
      "parentHoldingCompanyName",
      "hasSubsidiariesOrAssociates",
      "subsidiariesOrAssociates",
    ],
  },
  {
    section: "responsiblePersons",
    fields: [
      {
        field: "clientPartnerPic",
        compareField: "clientPartnerPicId",
        displayField: "clientPartnerPic",
        lookupPrefix: "user",
      },
      {
        field: "clientManagerMic",
        compareField: "clientManagerMicId",
        displayField: "clientManagerMic",
        lookupPrefix: "user",
      },
      {
        field: "alternativePartnerSecondMic",
        compareField: "alternativePartnerSecondMicId",
        displayField: "alternativePartnerSecondMic",
        lookupPrefix: "user",
      },
    ],
  },
  {
    section: "engagementAndService",
    fields: ["expectedJobOrEngagementType", "serviceLines"],
  },
];
const ENGAGEMENT_SECTIONS: SectionDefinition[] = [
  {
    section: "engagementInformation",
    fields: [
      {
        field: "client",
        compareField: "clientId",
        lookupPrefix: "client",
      },
      "engagementCode",
      "serviceType",
      "yearEndDate",
      "reportDate",
      "approvalReferenceNumber",
      "engagementDate",
      "status",
      "remarks",
    ],
  },
  {
    section: "commercialPlanning",
    fields: [
      { field: "budgetedHours", numeric: true },
      { field: "agreedFee", numeric: true },
      { field: "recoveryRate", numeric: true },
      "feePlanningLines",
      "feeCurrency",
    ],
  },
  {
    section: "riskClassificationAndResponsiblePersons",
    fields: [
      "amlRiskClassification",
      "engagementRiskClassification",
      {
        field: "pic",
        compareField: "picUserId",
        displayField: "pic",
        lookupPrefix: "user",
      },
      {
        field: "mic",
        compareField: "micUserId",
        displayField: "mic",
        lookupPrefix: "user",
      },
      {
        field: "eqReviewer",
        compareField: "eqReviewerUserId",
        displayField: "eqReviewer",
        lookupPrefix: "user",
      },
    ],
  },
  {
    section: "reportsAndDeliverables",
    fields: ["deliverables"],
  },
];

export function buildAcceptanceChangeSummary(input: {
  type: CmpAcceptanceRequestType;
  baseline: unknown;
  proposed: unknown;
  baselineCapturedAt: Date | null;
  staleMasterData: boolean;
  displayLookup?: ReadonlyMap<string, string>;
}): CmpAcceptanceChangeSummary {
  if (!isPayload(input.baseline)) {
    return CmpAcceptanceChangeSummarySchema.parse({
      status: "BASELINE_UNAVAILABLE",
      changedFieldCount: 0,
      baselineCapturedAt: null,
      staleMasterData: false,
      groups: [],
    });
  }

  const { baseline } = input;
  const proposed = isPayload(input.proposed) ? input.proposed : {};
  const sections =
    input.type === "CLIENT_CHANGE" ? CLIENT_SECTIONS : ENGAGEMENT_SECTIONS;
  const groups = sections
    .map((section) => ({
      section: section.section,
      changes: section.fields.flatMap((definition) => {
        const field =
          typeof definition === "string"
            ? ({ field: definition } satisfies FieldDefinition)
            : definition;
        if (field.field === "deliverables") {
          return buildDeliverableChanges(
            baseline[field.compareField ?? field.field],
            proposed[field.compareField ?? field.field]
          );
        }
        const compareKey = field.compareField ?? field.field;
        const beforeComparable = comparableValue(
          baseline,
          field,
          compareKey,
          input.displayLookup
        );
        const afterComparable = comparableValue(
          proposed,
          field,
          compareKey,
          input.displayLookup
        );
        if (valuesEqual(beforeComparable, afterComparable)) {
          return [];
        }

        const before = resolveDisplayValue(
          baseline,
          field,
          beforeComparable,
          input.displayLookup
        );
        const after = resolveDisplayValue(
          proposed,
          field,
          afterComparable,
          input.displayLookup
        );
        return [
          {
            field: field.field,
            kind: isEmptyValue(before)
              ? "ADDED"
              : isEmptyValue(after)
                ? "REMOVED"
                : "MODIFIED",
            before,
            after,
          },
        ];
      }),
    }))
    .filter((section) => section.changes.length > 0);

  return CmpAcceptanceChangeSummarySchema.parse({
    status: "AVAILABLE",
    changedFieldCount: groups.reduce(
      (total, section) => total + section.changes.length,
      0
    ),
    baselineCapturedAt: input.baselineCapturedAt?.toISOString() ?? null,
    staleMasterData: input.staleMasterData,
    groups,
  });
}

function comparableValue(
  payload: Payload,
  definition: FieldDefinition,
  compareKey: string,
  lookup?: ReadonlyMap<string, string>
) {
  if (definition.field === "groupStructure") {
    return normalizeGroupStructureValue(payload[compareKey], lookup);
  }
  const primary = normalizeValue(payload[compareKey]);
  const comparable =
    !isEmptyValue(primary) || !definition.displayField
      ? primary
      : normalizeValue(payload[definition.displayField]);
  return definition.numeric ? normalizeNumericValue(comparable) : comparable;
}

function buildDeliverableChanges(before: unknown, after: unknown) {
  const beforeItems = normalizeDeliverables(valueOrEmpty(before));
  const afterItems = normalizeDeliverables(valueOrEmpty(after));
  const beforeByIdentity = new Map(
    beforeItems.map((item) => [deliverableIdentity(item), item])
  );
  const afterByIdentity = new Map(
    afterItems.map((item) => [deliverableIdentity(item), item])
  );
  const identities = [
    ...new Set([...beforeByIdentity.keys(), ...afterByIdentity.keys()]),
  ].sort((left, right) => left.localeCompare(right));

  return identities.flatMap((identity) => {
    const beforeItem = beforeByIdentity.get(identity);
    const afterItem = afterByIdentity.get(identity);
    const beforeValue = deliverableDisplayValue(beforeItem);
    const afterValue = deliverableDisplayValue(afterItem);
    if (valuesEqual(beforeValue, afterValue)) {
      return [];
    }
    return [
      {
        field: `deliverables.${identity}`,
        kind: beforeItem ? (afterItem ? "MODIFIED" : "REMOVED") : "ADDED",
        before: beforeValue,
        after: afterValue,
      },
    ];
  });
}

type ComparableDeliverable = {
  key: string;
  category: string;
  code: string;
  description: string | null;
};

function valueOrEmpty(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeDeliverables(value: unknown): ComparableDeliverable[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isPayload)
    .map((item) => ({
      key: scalarString(item.key) ?? "",
      category: scalarString(item.category) ?? "",
      code: scalarString(item.code) ?? "",
      description: scalarString(item.description),
    }))
    .filter((item) => Boolean(item.key && item.code));
}

function deliverableIdentity(item: ComparableDeliverable) {
  return item.code === "CUSTOM" ? `CUSTOM:${item.key}` : item.code;
}

function deliverableDisplayValue(item: ComparableDeliverable | undefined) {
  if (!item) {
    return null;
  }
  return item.description || true;
}

function normalizeGroupStructureValue(
  value: unknown,
  lookup?: ReadonlyMap<string, string>
): CmpAcceptanceChangeValue {
  if (!isPayload(value)) {
    return [];
  }
  const primaryGroupId = scalarString(value.primaryGroupId);
  const records: Record<string, string | number | boolean | null>[] = [
    {
      primaryGroup:
        (primaryGroupId && lookup?.get(`group:${primaryGroupId}`)) ??
        primaryGroupId ??
        null,
      ultimateParentAction:
        scalarString(value.ultimateParentAction) ?? "UNCHANGED",
    },
  ];
  if (!Array.isArray(value.relationships)) {
    return records;
  }
  for (const item of value.relationships) {
    if (!isPayload(item)) {
      continue;
    }
    const counterpartClientId = scalarString(item.counterpartClientId);
    records.push({
      action: scalarString(item.action),
      relationshipType: scalarString(item.type),
      relationshipDirection: scalarString(item.direction),
      relatedClient:
        (counterpartClientId && lookup?.get(`client:${counterpartClientId}`)) ??
        counterpartClientId ??
        null,
      ownershipPercentage:
        typeof item.ownershipPercentage === "number"
          ? item.ownershipPercentage
          : scalarString(item.ownershipPercentage),
      effectiveFrom: scalarString(item.effectiveFrom),
      effectiveTo: scalarString(item.effectiveTo),
      remarks: scalarString(item.remarks),
    });
  }
  return records;
}

function scalarString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeNumericValue(
  value: CmpAcceptanceChangeValue
): CmpAcceptanceChangeValue {
  if (typeof value !== "number" && typeof value !== "string") {
    return value;
  }
  const source = String(value).trim();
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(source);
  if (!match) {
    return value;
  }
  const integer = (match[2] ?? "0").replace(/^0+(?=\d)/, "");
  const fraction = (match[3] ?? match[4] ?? "").replace(/0+$/, "");
  const isZero = integer === "0" && fraction.length === 0;
  const sign = isZero || match[1] !== "-" ? "" : "-";
  return `${sign}${integer}${fraction ? `.${fraction}` : ""}`;
}

function resolveDisplayValue(
  payload: Payload,
  definition: FieldDefinition,
  comparable: CmpAcceptanceChangeValue,
  lookup?: ReadonlyMap<string, string>
): CmpAcceptanceChangeValue {
  const displayValue = definition.displayField
    ? normalizeValue(payload[definition.displayField])
    : comparable;
  if (!definition.lookupPrefix || isEmptyValue(comparable)) {
    return displayValue;
  }
  const key = `${definition.lookupPrefix}:${String(comparable)}`;
  return lookup?.get(key) ?? displayValue;
}

function isPayload(value: unknown): value is Payload {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeValue(value: unknown): CmpAcceptanceChangeValue {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!isPayload(item)) {
        return { value: String(item) };
      }
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nestedValue]) => [key, normalizeScalar(nestedValue)])
      );
    });
  }
  return String(value);
}

function normalizeScalar(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}

function valuesEqual(
  left: CmpAcceptanceChangeValue,
  right: CmpAcceptanceChangeValue
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isEmptyValue(value: CmpAcceptanceChangeValue) {
  return (
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
