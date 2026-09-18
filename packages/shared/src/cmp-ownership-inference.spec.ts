import { describe, expect, it } from "vitest";

import { inferCmpOwnership } from "./cmp-ownership-inference.js";

const entities = [
  { id: "target", kind: "COMPANY" as const },
  { id: "holding", kind: "COMPANY" as const },
  { id: "second", kind: "COMPANY" as const },
  { id: "person", kind: "PERSON" as const },
];

describe(inferCmpOwnership, () => {
  it("returns exact confirmed ownership for a complete cap table", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities,
      observations: [
        { ownerId: "person", investeeId: "target", percentage: 100 },
      ],
      asOf: "2026-08-21",
    });

    expect(result).toMatchObject({
      status: "OK",
      confirmedPercentage: 100,
      unconfirmedPercentage: 0,
      isComplete: true,
      candidates: [
        {
          personId: "person",
          ownershipPercentage: 100,
          status: "CONFIRMED",
        },
      ],
    });
  });

  it("absorbs an unrecorded remainder without inflating a known person's ownership", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities,
      observations: [
        { ownerId: "person", investeeId: "target", percentage: 20 },
      ],
      asOf: "2026-08-21",
    });

    expect(result).toMatchObject({
      status: "INSUFFICIENT_EVIDENCE",
      confirmedPercentage: 20,
      unconfirmedPercentage: 80,
      isComplete: false,
      candidates: [
        {
          personId: "person",
          ownershipPercentage: 20,
          status: "EXCLUDED",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/unknown[_-]?sink/i);
  });

  it("aggregates exact direct and indirect ownership across multiple paths", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities,
      observations: [
        { ownerId: "person", investeeId: "target", percentage: 10 },
        { ownerId: "person", investeeId: "holding", percentage: 60 },
        { ownerId: "holding", investeeId: "target", percentage: 50 },
      ],
      asOf: "2026-08-21",
    });

    expect(result.candidates[0]).toMatchObject({
      ownershipPercentage: 40,
      status: "CONFIRMED",
    });
    expect(result).toMatchObject({
      confirmedPercentage: 40,
      unconfirmedPercentage: 60,
    });
  });

  it("propagates missing upstream ownership into the unconfirmed total", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities,
      observations: [
        { ownerId: "holding", investeeId: "target", percentage: 60 },
        { ownerId: "person", investeeId: "holding", percentage: 25 },
      ],
      asOf: "2026-08-21",
    });

    expect(result.candidates[0]).toMatchObject({ ownershipPercentage: 15 });
    expect(result).toMatchObject({
      confirmedPercentage: 15,
      unconfirmedPercentage: 85,
    });
  });

  it("conserves all ownership mass across several known people and missing layers", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities: [...entities, { id: "second-person", kind: "PERSON" as const }],
      observations: [
        { ownerId: "person", investeeId: "target", percentage: 40 },
        { ownerId: "holding", investeeId: "target", percentage: 30 },
        {
          ownerId: "second-person",
          investeeId: "holding",
          percentage: 50,
        },
      ],
      asOf: "2026-08-21",
    });

    expect(result.candidates).toStrictEqual([
      expect.objectContaining({ personId: "person", ownershipPercentage: 40 }),
      expect.objectContaining({
        personId: "second-person",
        ownershipPercentage: 15,
      }),
    ]);
    expect(result.confirmedPercentage + result.unconfirmedPercentage).toBe(100);
  });

  it("solves cross-shareholding cycles that have absorbing exits", () => {
    const result = inferCmpOwnership({
      targetEntityId: "holding",
      entities,
      observations: [
        { ownerId: "person", investeeId: "holding", percentage: 50 },
        { ownerId: "second", investeeId: "holding", percentage: 50 },
        { ownerId: "holding", investeeId: "second", percentage: 50 },
      ],
      asOf: "2026-08-21",
    });

    expect(result.candidates[0]).toMatchObject({
      personId: "person",
      ownershipPercentage: 66.666667,
      status: "CONFIRMED",
    });
    expect(result.unconfirmedPercentage).toBe(33.333333);
  });

  it("absorbs a closed 100% organisation cycle instead of reporting a conflict", () => {
    const result = inferCmpOwnership({
      targetEntityId: "holding",
      entities,
      observations: [
        { ownerId: "second", investeeId: "holding", percentage: 100 },
        { ownerId: "holding", investeeId: "second", percentage: 100 },
      ],
      asOf: "2026-08-21",
    });

    expect(result).toMatchObject({
      status: "INSUFFICIENT_EVIDENCE",
      candidates: [],
      confirmedPercentage: 0,
      unconfirmedPercentage: 100,
      isComplete: false,
      issues: [],
    });
  });

  it("propagates a closed upstream cycle into the target's unconfirmed ownership", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities,
      observations: [
        { ownerId: "holding", investeeId: "target", percentage: 30 },
        { ownerId: "person", investeeId: "target", percentage: 70 },
        { ownerId: "second", investeeId: "holding", percentage: 100 },
        { ownerId: "holding", investeeId: "second", percentage: 100 },
      ],
      asOf: "2026-08-21",
    });

    expect(result).toMatchObject({
      confirmedPercentage: 70,
      unconfirmedPercentage: 30,
      candidates: [
        expect.objectContaining({
          personId: "person",
          ownershipPercentage: 70,
        }),
      ],
    });
  });

  it("rejects cap tables whose recorded percentages exceed 100%", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities,
      observations: [
        { ownerId: "person", investeeId: "target", percentage: 60 },
        { ownerId: "holding", investeeId: "target", percentage: 50 },
      ],
      asOf: "2026-08-21",
    });

    expect(result.status).toBe("DATA_CONFLICT");
    expect(result.coverage[0]).toMatchObject({ recordedPercentage: 110 });
  });

  it("absorbs a known owner relationship whose percentage is missing", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities,
      observations: [
        { ownerId: "person", investeeId: "target", percentage: null },
      ],
      asOf: "2026-08-21",
    });

    expect(result).toMatchObject({
      candidates: [],
      confirmedPercentage: 0,
      unconfirmedPercentage: 100,
    });
  });

  it("rejects overlapping observations for the same ownership fact", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities,
      observations: [
        {
          id: "first",
          ownerId: "person",
          investeeId: "target",
          percentage: 20,
        },
        {
          id: "second",
          ownerId: "person",
          investeeId: "target",
          percentage: 30,
        },
      ],
      asOf: "2026-08-21",
    });

    expect(result.status).toBe("DATA_CONFLICT");
    expect(result.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OVERLAPPING_OBSERVATIONS" }),
      ])
    );
  });

  it("rejects ownership that points to a natural person", () => {
    const result = inferCmpOwnership({
      targetEntityId: "target",
      entities,
      observations: [
        { ownerId: "holding", investeeId: "person", percentage: 25 },
      ],
      asOf: "2026-08-21",
    });

    expect(result.status).toBe("DATA_CONFLICT");
    expect(result.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_OWNERSHIP_TARGET" }),
      ])
    );
  });
});
