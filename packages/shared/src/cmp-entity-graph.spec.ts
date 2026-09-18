import { describe, expect, it } from "vitest";

import {
  CmpClientGraphQuerySchema,
  CmpClientGraphSchema,
  CreateCmpEntityRelationshipSchema,
  CreateCmpGroupRelationshipSchema,
  classifyCmpRelationshipConflict,
  isCmpRelationshipEndpointCompatible,
} from "./cmp-entity-graph.js";

describe("cMP entity graph contracts", () => {
  it("accepts a client-centric graph snapshot", () => {
    expect(
      CmpClientGraphSchema.parse({
        client: {
          id: "client-1",
          clientCode: "H031",
          rootEntityId: "entity-1",
        },
        asOf: "2026-08-04",
        nodes: [
          {
            id: "entity-1",
            kind: "COMPANY",
            displayName: "Hwa Hin Limited",
            nameZh: null,
            nameEn: "Hwa Hin Limited",
            jurisdiction: "Hong Kong",
            registrationNumber: "1234567",
            status: "ACTIVE",
            role: "ROOT",
            isRoot: true,
            clientIds: ["client-1"],
          },
        ],
        edges: [],
      })
    ).toMatchObject({ asOf: "2026-08-04" });
  });

  it("rejects a non-date snapshot query", () => {
    expect(
      CmpClientGraphQuerySchema.safeParse({ asOf: "04/08/2026" }).success
    ).toBeFalsy();
  });

  it("allows different relationship types between the same subjects", () => {
    expect(
      classifyCmpRelationshipConflict(
        {
          fromEntityId: "person-1",
          toEntityId: "company-1",
          type: "OWNS",
          ownershipPercentage: 30,
        },
        {
          fromEntityId: "person-1",
          toEntityId: "company-1",
          type: "MANAGES",
        }
      )
    ).toBeNull();
  });

  it("rejects overlapping ownership records with different percentages", () => {
    expect(
      classifyCmpRelationshipConflict(
        {
          fromEntityId: "person-1",
          toEntityId: "company-1",
          type: "OWNS",
          ownershipPercentage: 30,
          effectiveFrom: "2026-01-01",
        },
        {
          fromEntityId: "person-1",
          toEntityId: "company-1",
          type: "OWNS",
          ownershipPercentage: 40,
          effectiveFrom: "2026-06-01",
        }
      )
    ).toBe("CONFLICTING_PERCENTAGES");
  });

  it("allows historical ownership records with non-overlapping periods", () => {
    expect(
      classifyCmpRelationshipConflict(
        {
          fromEntityId: "person-1",
          toEntityId: "company-1",
          type: "OWNS",
          ownershipPercentage: 30,
          effectiveTo: "2025-12-31",
        },
        {
          fromEntityId: "person-1",
          toEntityId: "company-1",
          type: "OWNS",
          ownershipPercentage: 40,
          effectiveFrom: "2026-01-01",
        }
      )
    ).toBeNull();
  });

  it("validates multi-party associate and joint venture inputs", () => {
    expect(
      CreateCmpGroupRelationshipSchema.parse({
        targetEntityId: "company-target",
        type: "JOINT_VENTURE",
        participants: [
          { entityId: "company-a", method: "OWNERSHIP" },
          {
            entityId: "company-b",
            method: "OTHER",
            otherDescription: "Contractual arrangement",
          },
        ],
      })
    ).toMatchObject({ type: "JOINT_VENTURE" });
    expect(
      CreateCmpGroupRelationshipSchema.safeParse({
        targetEntityId: "company-target",
        type: "ASSOCIATE",
        participants: [
          {
            entityId: "company-target",
            method: "OWNERSHIP",
          },
        ],
      }).success
    ).toBeFalsy();
    expect(
      CreateCmpGroupRelationshipSchema.safeParse({
        targetEntityId: "company-target",
        type: "ASSOCIATE",
        participants: [
          {
            entityId: "company-a",
            method: "OTHER",
            ownershipPercentage: 10,
          },
        ],
      }).success
    ).toBeFalsy();
  });

  it("allows new direct relationships only with a company as the target", () => {
    expect(
      isCmpRelationshipEndpointCompatible("OWNS", "PERSON", "COMPANY")
    ).toBeTruthy();
    expect(
      isCmpRelationshipEndpointCompatible("OWNS", "COMPANY", "PERSON")
    ).toBeFalsy();
    expect(
      isCmpRelationshipEndpointCompatible("OWNS", "COMPANY", "TRUST")
    ).toBeFalsy();
    expect(
      isCmpRelationshipEndpointCompatible(
        "DIRECTOR_OF",
        "PERSON",
        "PARTNERSHIP"
      )
    ).toBeFalsy();
  });

  it("rejects a direct self-relationship before it reaches the API", () => {
    expect(
      CreateCmpEntityRelationshipSchema.safeParse({
        fromEntityId: "company-current-client",
        toEntityId: "company-current-client",
        type: "OWNS",
      }).success
    ).toBeFalsy();
  });
});
