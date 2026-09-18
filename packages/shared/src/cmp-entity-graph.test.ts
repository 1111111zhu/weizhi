import { describe, expect, it } from "vitest";

import {
  CmpClientAcceptanceDraftPayloadSchema,
  CmpRelatedEntityDraftSchema,
  CreateCmpEntityRelationshipSchema,
  UpdateCmpAcceptanceRequestSchema,
} from "./index.js";

describe("cMP related-party contracts", () => {
  it("accepts firm entity and direct relationship drafts", () => {
    const result = CmpClientAcceptanceDraftPayloadSchema.safeParse({
      relatedEntities: [
        {
          draftKey: "holding",
          kind: "COMPANY",
          displayName: "ABC Holdings Ltd",
          jurisdiction: "Cayman Islands",
          registrationNumber: "CR-123",
          status: "ACTIVE",
        },
      ],
      relatedRelationships: [
        {
          draftKey: "owns-client",
          fromRef: { type: "DRAFT", draftKey: "holding" },
          toRef: { type: "ROOT" },
          type: "OWNS",
          ownershipPercentage: 100,
        },
      ],
    });

    expect(result.success).toBeTruthy();
  });

  it("accepts specialised company and person profiles without exposing profile fields on the other kind", () => {
    const result = CmpClientAcceptanceDraftPayloadSchema.safeParse({
      relatedEntities: [
        {
          draftKey: "holding",
          kind: "COMPANY",
          displayName: "ABC Holdings Ltd",
          nameEn: "ABC Holdings Ltd",
          jurisdiction: "Cayman Islands",
          status: "DISSOLVED",
          companyProfile: {
            identifierType: "COMPANY_REGISTRATION_NUMBER",
            identifierValue: "CR-123",
            incorporationDate: "2020-01-02",
            companyType: "PRIVATE",
            registeredAddress: "George Town, Cayman Islands",
          },
          personProfile: null,
        },
        {
          draftKey: "owner",
          kind: "PERSON",
          displayName: "Alex Chan",
          nameZh: "陳大文",
          nameEn: "Alex Chan",
          status: "UNKNOWN",
          companyProfile: null,
          personProfile: {
            dateOfBirth: "1980-05-01",
            identifierType: "PASSPORT",
            identifierValue: "P123456",
            nationality: "Hong Kong",
          },
        },
      ],
      relatedRelationships: [],
    });

    expect(result.success).toBeTruthy();
  });

  it("normalizes empty acceptance targets while preserving related-party drafts", () => {
    const result = UpdateCmpAcceptanceRequestSchema.safeParse({
      targetClientId: "",
      targetEngagementId: null,
      clientPayload: {
        relatedEntities: [
          {
            draftKey: "holding",
            kind: "COMPANY",
            displayName: "ABC Holdings Ltd",
            companyProfile: {
              identifierType: "COMPANY_REGISTRATION_NUMBER",
              identifierValue: "CR-123",
            },
          },
        ],
        relatedRelationships: [],
      },
    });

    expect(result.success).toBeTruthy();
    if (!result.success) {
      return;
    }
    expect(result.data.targetClientId).toBeUndefined();
    expect(result.data.targetEngagementId).toBeUndefined();
    expect(result.data.clientPayload?.relatedEntities).toHaveLength(1);
  });

  it("rejects self relationships and invalid percentages", () => {
    expect(
      CreateCmpEntityRelationshipSchema.safeParse({
        fromEntityId: "entity-1",
        toEntityId: "entity-1",
        type: "OWNS",
        ownershipPercentage: 101,
      }).success
    ).toBeFalsy();
  });

  it("rejects profile and lifecycle states that do not match the party kind", () => {
    expect(
      CmpRelatedEntityDraftSchema.safeParse({
        draftKey: "company",
        kind: "COMPANY",
        displayName: "ABC Limited",
        status: "DECEASED",
      }).success
    ).toBeFalsy();
    expect(
      CmpRelatedEntityDraftSchema.safeParse({
        draftKey: "person",
        kind: "PERSON",
        displayName: "Alex Chan",
        status: "ACTIVE",
        companyProfile: {
          identifierType: "CR_NUMBER",
          identifierValue: "123",
          incorporationDate: "2020-01-01",
          companyType: "PRIVATE",
          registeredAddress: "Hong Kong",
        },
      }).success
    ).toBeFalsy();
  });
});
