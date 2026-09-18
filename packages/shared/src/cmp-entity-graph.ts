import { z } from "zod";

export const CmpEntityKindSchema = z.enum([
  "COMPANY",
  "PERSON",
  "TRUST",
  "PARTNERSHIP",
  "OTHER_ORGANISATION",
]);

export const CmpClientEntityRoleSchema = z.enum(["ROOT", "RELATED"]);

export const CmpEntityStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "DISSOLVED",
  "DECEASED",
  "UNKNOWN",
]);

export const CmpCompanyTypeSchema = z.enum(["PRIVATE", "LISTED", "OTHER"]);

export const CmpEntityRelationshipTypeSchema = z.enum([
  "OWNS",
  "DIRECTOR_OF",
  "BENEFICIAL_OWNER_OF",
  "COMPANY_SECRETARY_OF",
  "MANAGES",
  "OTHER",
]);

export const CmpGroupRelationshipTypeSchema = z.enum([
  "ASSOCIATE",
  "JOINT_VENTURE",
]);

export const CmpGroupRelationshipMethodSchema = z.enum(["OWNERSHIP", "OTHER"]);

export type CmpRelationshipCompatibilityRecord = {
  id?: string;
  fromEntityId: string;
  toEntityId: string;
  type: z.infer<typeof CmpEntityRelationshipTypeSchema>;
  ownershipPercentage?: number | null;
  effectiveFrom?: string | Date | null;
  effectiveTo?: string | Date | null;
};

export type CmpRelationshipConflictKind =
  | "DUPLICATE"
  | "CONFLICTING_PERCENTAGES";

function relationshipDateValue(
  value: string | Date | null | undefined,
  fallback: number
) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function sameRelationshipPair(
  left: CmpRelationshipCompatibilityRecord,
  right: CmpRelationshipCompatibilityRecord
) {
  if (left.type !== right.type) {
    return false;
  }
  const forward =
    left.fromEntityId === right.fromEntityId &&
    left.toEntityId === right.toEntityId;
  if (forward) {
    return true;
  }
  return false;
}

export function classifyCmpRelationshipConflict(
  left: CmpRelationshipCompatibilityRecord,
  right: CmpRelationshipCompatibilityRecord
): CmpRelationshipConflictKind | null {
  if (!sameRelationshipPair(left, right)) {
    return null;
  }
  const leftStart = relationshipDateValue(
    left.effectiveFrom,
    Number.NEGATIVE_INFINITY
  );
  const leftEnd = relationshipDateValue(
    left.effectiveTo,
    Number.POSITIVE_INFINITY
  );
  const rightStart = relationshipDateValue(
    right.effectiveFrom,
    Number.NEGATIVE_INFINITY
  );
  const rightEnd = relationshipDateValue(
    right.effectiveTo,
    Number.POSITIVE_INFINITY
  );
  if (leftStart > rightEnd || rightStart > leftEnd) {
    return null;
  }
  return left.ownershipPercentage !== right.ownershipPercentage
    ? "CONFLICTING_PERCENTAGES"
    : "DUPLICATE";
}

const CmpDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CmpClientGraphQuerySchema = z.object({
  asOf: CmpDateSchema.optional(),
});

export const CmpClientGraphNodeSchema = z.object({
  id: z.string(),
  kind: CmpEntityKindSchema,
  displayName: z.string(),
  nameZh: z.string().nullable(),
  nameEn: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  status: CmpEntityStatusSchema,
  role: CmpClientEntityRoleSchema,
  isRoot: z.boolean(),
  clientIds: z.array(z.string()),
});

export const CmpClientGraphEdgeSchema = z.object({
  id: z.string(),
  fromEntityId: z.string(),
  toEntityId: z.string(),
  type: CmpEntityRelationshipTypeSchema,
  ownershipPercentage: z.number().nullable(),
  effectiveFrom: z.string().datetime().nullable(),
  effectiveTo: z.string().datetime().nullable(),
  remarks: z.string().nullable(),
  sourceDocument: z.string().nullable(),
});

export const CmpGroupRelationshipParticipantSchema = z.object({
  entityId: z.string(),
  method: CmpGroupRelationshipMethodSchema,
  ownershipPercentage: z.number().nullable(),
  otherDescription: z.string().nullable(),
});

export const CmpGroupRelationshipSchema = z.object({
  id: z.string(),
  targetEntityId: z.string(),
  type: CmpGroupRelationshipTypeSchema,
  effectiveFrom: z.string().datetime().nullable(),
  effectiveTo: z.string().datetime().nullable(),
  sourceDocument: z.string().nullable(),
  remarks: z.string().nullable(),
  participants: z.array(CmpGroupRelationshipParticipantSchema).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CmpGroupRelationshipsResponseSchema = z.object({
  relationships: z.array(CmpGroupRelationshipSchema),
});

export const CmpClientGraphSchema = z.object({
  client: z.object({
    id: z.string(),
    clientCode: z.string(),
    rootEntityId: z.string().nullable(),
  }),
  asOf: CmpDateSchema,
  nodes: z.array(CmpClientGraphNodeSchema),
  edges: z.array(CmpClientGraphEdgeSchema),
  groupRelationships: z.array(CmpGroupRelationshipSchema).default([]),
});

const OptionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();
const OptionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable();
const OptionalPercentage = z.number().min(0).max(100).optional().nullable();

export const CmpCompanyProfileSchema = z.object({
  identifierType: z.string().trim().min(1).max(100),
  identifierValue: z.string().trim().min(1).max(200),
  incorporationDate: OptionalDate,
  companyType: CmpCompanyTypeSchema,
  industryClassification: OptionalText(200),
  registeredAddress: OptionalText(2000),
  principalBusinessAddress: OptionalText(2000),
});

export const CmpPersonProfileSchema = z.object({
  dateOfBirth: OptionalDate,
  identifierType: OptionalText(100),
  identifierValue: OptionalText(200),
  nationality: OptionalText(200),
  residenceJurisdiction: OptionalText(200),
  correspondenceAddress: OptionalText(2000),
});

export const CmpRelatedEntitySchema = z.object({
  id: z.string(),
  role: CmpClientEntityRoleSchema,
  kind: CmpEntityKindSchema,
  displayName: z.string(),
  // Old entity-graph responses pre-date the independent Company Code field.
  // Keep those records readable until every runtime has been upgraded.
  companyCode: z.string().nullable().optional(),
  nameZh: z.string().nullable(),
  nameEn: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  status: CmpEntityStatusSchema,
  companyProfile: CmpCompanyProfileSchema.nullable(),
  personProfile: CmpPersonProfileSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CmpRelatedEntitiesResponseSchema = z.object({
  rootEntityId: z.string().nullable(),
  entities: z.array(CmpRelatedEntitySchema),
});

export const CmpCompanyIdentityResolutionActionSchema = z.enum([
  "LINK_EXISTING",
  "UPDATE_EXISTING",
]);

export const CmpCompanyIdentityResolutionSchema = z.object({
  action: CmpCompanyIdentityResolutionActionSchema,
  entityId: z.string().trim().min(1),
  expectedUpdatedAt: z.string().datetime(),
});

export const CmpCompanyIdentityMatchQuerySchema = z.object({
  identifierType: z.string().trim().min(1).max(100),
  identifierValue: z.string().trim().min(1).max(200),
});

export const CmpCompanyIdentityMatchSchema = z.object({
  entity: CmpRelatedEntitySchema,
  clients: z.array(
    z.object({
      id: z.string(),
      clientCode: z.string(),
      nameEn: z.string().nullable(),
      nameZh: z.string(),
      role: CmpClientEntityRoleSchema,
    })
  ),
});

export const CmpCompanyIdentityMatchResponseSchema = z.object({
  match: CmpCompanyIdentityMatchSchema.nullable(),
});

const CmpRelatedEntityInputFields = z.object({
  kind: CmpEntityKindSchema,
  displayName: z.string().trim().min(1).max(200),
  companyCode: OptionalText(100),
  nameZh: OptionalText(200),
  nameEn: OptionalText(200),
  jurisdiction: OptionalText(200),
  registrationNumber: OptionalText(200),
  status: CmpEntityStatusSchema.default("ACTIVE"),
  companyProfile: CmpCompanyProfileSchema.optional().nullable(),
  personProfile: CmpPersonProfileSchema.optional().nullable(),
  companyIdentityResolution: CmpCompanyIdentityResolutionSchema.optional(),
});

export const CreateCmpRelatedEntitySchema =
  CmpRelatedEntityInputFields.superRefine((value, context) => {
    if (value.kind === "COMPANY" && value.personProfile) {
      context.addIssue({
        code: "custom",
        path: ["personProfile"],
        message: "A company cannot have a person profile",
      });
    }
    if (value.kind === "PERSON" && value.companyProfile) {
      context.addIssue({
        code: "custom",
        path: ["companyProfile"],
        message: "An individual cannot have a company profile",
      });
    }
    if (
      value.kind === "COMPANY" &&
      (value.status === "DECEASED" || value.status === "UNKNOWN")
    ) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "The company status is invalid",
      });
    }
    if (value.kind === "PERSON" && value.status === "DISSOLVED") {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "The individual status is invalid",
      });
    }
  });

export const UpdateCmpRelatedEntitySchema =
  CmpRelatedEntityInputFields.partial().refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be updated"
  );

export const CmpEntityRelationshipSchema = z.object({
  id: z.string(),
  fromEntityId: z.string(),
  toEntityId: z.string(),
  type: CmpEntityRelationshipTypeSchema,
  ownershipPercentage: z.number().nullable(),
  effectiveFrom: z.string().datetime().nullable(),
  effectiveTo: z.string().datetime().nullable(),
  sourceDocument: z.string().nullable(),
  remarks: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CmpEntityRelationshipsResponseSchema = z.object({
  relationships: z.array(CmpEntityRelationshipSchema),
});

const CmpEntityRelationshipInputFields = z.object({
  fromEntityId: z.string().min(1),
  toEntityId: z.string().min(1),
  type: CmpEntityRelationshipTypeSchema,
  ownershipPercentage: OptionalPercentage,
  effectiveFrom: OptionalDate,
  effectiveTo: OptionalDate,
  sourceDocument: OptionalText(1000),
  remarks: OptionalText(2000),
});

export const CreateCmpEntityRelationshipSchema =
  CmpEntityRelationshipInputFields.refine(
    (value) => value.fromEntityId !== value.toEntityId,
    {
      message: "A subject cannot relate to itself",
      path: ["toEntityId"],
    }
  );

export const UpdateCmpEntityRelationshipSchema =
  CmpEntityRelationshipInputFields.omit({
    fromEntityId: true,
    toEntityId: true,
  })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field must be updated",
    });

const CmpGroupRelationshipParticipantInputFields = z.object({
  entityId: z.string().min(1),
  method: CmpGroupRelationshipMethodSchema,
  ownershipPercentage: OptionalPercentage,
  otherDescription: OptionalText(2000),
});

export const CmpGroupRelationshipParticipantInputSchema =
  CmpGroupRelationshipParticipantInputFields.superRefine((value, context) => {
    if (value.method === "OTHER" && !value.otherDescription) {
      context.addIssue({
        code: "custom",
        path: ["otherDescription"],
        message: "A description is required for an other relationship method",
      });
    }
    if (
      value.method === "OTHER" &&
      value.ownershipPercentage !== null &&
      value.ownershipPercentage !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["ownershipPercentage"],
        message:
          "Other relationship methods cannot have an ownership percentage",
      });
    }
  });

const CmpGroupRelationshipInputFields = z.object({
  targetEntityId: z.string().min(1),
  type: CmpGroupRelationshipTypeSchema,
  participants: z.array(CmpGroupRelationshipParticipantInputSchema).min(1),
  effectiveFrom: OptionalDate,
  effectiveTo: OptionalDate,
  sourceDocument: OptionalText(1000),
  remarks: OptionalText(2000),
});

function groupRelationshipParticipantsAreUnique(
  participants: Array<{ entityId: string }>,
  context: z.RefinementCtx
) {
  const duplicateIndex = participants.findIndex(
    (participant, index) =>
      participants.findIndex(
        (candidate) => candidate.entityId === participant.entityId
      ) !== index
  );
  if (duplicateIndex >= 0) {
    context.addIssue({
      code: "custom",
      path: ["participants", duplicateIndex, "entityId"],
      message: "Each participant can appear only once",
    });
  }
}

export const CreateCmpGroupRelationshipSchema =
  CmpGroupRelationshipInputFields.superRefine((value, context) => {
    groupRelationshipParticipantsAreUnique(value.participants, context);
    if (
      value.participants.some(
        (participant) => participant.entityId === value.targetEntityId
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "The target cannot be a relationship participant",
      });
    }
  });

export const UpdateCmpGroupRelationshipSchema =
  CmpGroupRelationshipInputFields.partial().superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one field must be updated",
      });
    }
    if (value.participants) {
      groupRelationshipParticipantsAreUnique(value.participants, context);
    }
  });

export const CmpDraftEntityReferenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ROOT") }),
  z.object({ type: z.literal("DRAFT"), draftKey: z.string().min(1) }),
  z.object({ type: z.literal("EXISTING"), entityId: z.string().min(1) }),
]);

const CmpRelatedEntityDraftFields = z.object({
  draftKey: z.string().min(1),
  existingEntityId: z.string().min(1).optional().nullable(),
  kind: CmpEntityKindSchema,
  displayName: z.string().trim().min(1).max(200),
  companyCode: OptionalText(100),
  nameZh: OptionalText(200),
  nameEn: OptionalText(200),
  jurisdiction: OptionalText(200),
  registrationNumber: OptionalText(200),
  status: CmpEntityStatusSchema.default("ACTIVE"),
  companyProfile: CmpCompanyProfileSchema.optional().nullable(),
  personProfile: CmpPersonProfileSchema.optional().nullable(),
  companyIdentityResolution: CmpCompanyIdentityResolutionSchema.optional(),
});

export const CmpRelatedEntityDraftSchema =
  CmpRelatedEntityDraftFields.superRefine((value, context) => {
    if (value.kind === "COMPANY" && value.personProfile) {
      context.addIssue({
        code: "custom",
        path: ["personProfile"],
        message: "A company cannot have a person profile",
      });
    }
    if (value.kind === "PERSON" && value.companyProfile) {
      context.addIssue({
        code: "custom",
        path: ["companyProfile"],
        message: "An individual cannot have a company profile",
      });
    }
    if (
      value.kind === "COMPANY" &&
      (value.status === "DECEASED" || value.status === "UNKNOWN")
    ) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "The company status is invalid",
      });
    }
    if (value.kind === "PERSON" && value.status === "DISSOLVED") {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "The individual status is invalid",
      });
    }
  });

export const CmpEntityRelationshipDraftSchema = z.object({
  draftKey: z.string().min(1),
  fromRef: CmpDraftEntityReferenceSchema,
  toRef: CmpDraftEntityReferenceSchema,
  type: CmpEntityRelationshipTypeSchema,
  ownershipPercentage: OptionalPercentage,
  effectiveFrom: OptionalDate,
  effectiveTo: OptionalDate,
  sourceDocument: OptionalText(1000),
  remarks: OptionalText(2000),
});

const CmpGroupRelationshipParticipantDraftFields = z.object({
  entityRef: CmpDraftEntityReferenceSchema,
  method: CmpGroupRelationshipMethodSchema,
  ownershipPercentage: OptionalPercentage,
  otherDescription: OptionalText(2000),
});

export const CmpGroupRelationshipParticipantDraftSchema =
  CmpGroupRelationshipParticipantDraftFields.superRefine((value, context) => {
    if (value.method === "OTHER" && !value.otherDescription) {
      context.addIssue({
        code: "custom",
        path: ["otherDescription"],
        message: "A description is required for an other relationship method",
      });
    }
    if (
      value.method === "OTHER" &&
      value.ownershipPercentage !== null &&
      value.ownershipPercentage !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["ownershipPercentage"],
        message:
          "Other relationship methods cannot have an ownership percentage",
      });
    }
  });

function draftReferenceKey(
  value: z.infer<typeof CmpDraftEntityReferenceSchema>
) {
  return value.type === "ROOT"
    ? "ROOT"
    : value.type === "DRAFT"
      ? `DRAFT:${value.draftKey}`
      : `EXISTING:${value.entityId}`;
}

export const CmpGroupRelationshipDraftSchema = z
  .object({
    draftKey: z.string().min(1),
    existingRelationshipId: z.string().min(1).optional().nullable(),
    targetRef: CmpDraftEntityReferenceSchema,
    type: CmpGroupRelationshipTypeSchema,
    participants: z.array(CmpGroupRelationshipParticipantDraftSchema).min(1),
    effectiveFrom: OptionalDate,
    effectiveTo: OptionalDate,
    sourceDocument: OptionalText(1000),
    remarks: OptionalText(2000),
  })
  .superRefine((value, context) => {
    const targetKey = draftReferenceKey(value.targetRef);
    const participantKeys = value.participants.map((participant) =>
      draftReferenceKey(participant.entityRef)
    );
    const duplicateIndex = participantKeys.findIndex(
      (key, index) => participantKeys.indexOf(key) !== index
    );
    if (duplicateIndex >= 0) {
      context.addIssue({
        code: "custom",
        path: ["participants", duplicateIndex, "entityRef"],
        message: "Each participant can appear only once",
      });
    }
    if (participantKeys.includes(targetKey)) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "The target cannot be a relationship participant",
      });
    }
  });

export type CmpEntityKind = z.infer<typeof CmpEntityKindSchema>;
export type CmpClientEntityRole = z.infer<typeof CmpClientEntityRoleSchema>;
export type CmpEntityStatus = z.infer<typeof CmpEntityStatusSchema>;
export type CmpCompanyType = z.infer<typeof CmpCompanyTypeSchema>;
export type CmpCompanyIdentityResolution = z.infer<
  typeof CmpCompanyIdentityResolutionSchema
>;
export type CmpCompanyIdentityMatch = z.infer<
  typeof CmpCompanyIdentityMatchSchema
>;
export type CmpCompanyIdentityMatchResponse = z.infer<
  typeof CmpCompanyIdentityMatchResponseSchema
>;
export type CmpCompanyProfile = z.infer<typeof CmpCompanyProfileSchema>;
export type CmpPersonProfile = z.infer<typeof CmpPersonProfileSchema>;
export type CmpEntityRelationshipType = z.infer<
  typeof CmpEntityRelationshipTypeSchema
>;
export type CmpGroupRelationshipType = z.infer<
  typeof CmpGroupRelationshipTypeSchema
>;
export type CmpGroupRelationshipMethod = z.infer<
  typeof CmpGroupRelationshipMethodSchema
>;
export type CmpClientGraphQuery = z.infer<typeof CmpClientGraphQuerySchema>;
export type CmpClientGraphNode = z.infer<typeof CmpClientGraphNodeSchema>;
export type CmpClientGraphEdge = z.infer<typeof CmpClientGraphEdgeSchema>;
export type CmpClientGraph = z.infer<typeof CmpClientGraphSchema>;
export type CmpGroupRelationship = z.infer<typeof CmpGroupRelationshipSchema>;
export type CmpGroupRelationshipsResponse = z.infer<
  typeof CmpGroupRelationshipsResponseSchema
>;
export type CmpRelatedEntity = z.infer<typeof CmpRelatedEntitySchema>;
export type CmpRelatedEntitiesResponse = z.infer<
  typeof CmpRelatedEntitiesResponseSchema
>;
export type CreateCmpRelatedEntityInput = z.infer<
  typeof CreateCmpRelatedEntitySchema
>;
export type UpdateCmpRelatedEntityInput = z.infer<
  typeof UpdateCmpRelatedEntitySchema
>;
export type CmpEntityRelationship = z.infer<typeof CmpEntityRelationshipSchema>;
export type CmpEntityRelationshipsResponse = z.infer<
  typeof CmpEntityRelationshipsResponseSchema
>;
export type CreateCmpEntityRelationshipInput = z.infer<
  typeof CreateCmpEntityRelationshipSchema
>;
export type UpdateCmpEntityRelationshipInput = z.infer<
  typeof UpdateCmpEntityRelationshipSchema
>;
export type CreateCmpGroupRelationshipInput = z.infer<
  typeof CreateCmpGroupRelationshipSchema
>;
export type UpdateCmpGroupRelationshipInput = z.infer<
  typeof UpdateCmpGroupRelationshipSchema
>;
export type CmpRelatedEntityDraft = z.infer<typeof CmpRelatedEntityDraftSchema>;
export type CmpEntityRelationshipDraft = z.infer<
  typeof CmpEntityRelationshipDraftSchema
>;
export type CmpGroupRelationshipDraft = z.infer<
  typeof CmpGroupRelationshipDraftSchema
>;

export function isCmpRelationshipEndpointCompatible(
  type: CmpEntityRelationshipType,
  fromKind: CmpEntityKind,
  toKind: CmpEntityKind
) {
  switch (type) {
    case "DIRECTOR_OF":
    case "BENEFICIAL_OWNER_OF": {
      return fromKind === "PERSON" && toKind === "COMPANY";
    }
    case "COMPANY_SECRETARY_OF":
    case "MANAGES":
    case "OTHER": {
      return fromKind === "PERSON" && toKind === "COMPANY";
    }
    case "OWNS": {
      return (
        (fromKind === "COMPANY" || fromKind === "PERSON") &&
        toKind === "COMPANY"
      );
    }

    default: {
      break;
    }
  }
}
