import type { CmpClientGraph } from "@project-wing/shared/cmp-entity-graph";
import { describe, expect, it } from "vitest";

import { calculateEntityStructurePlacement } from "./cmp-entity-structure-layout";

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

describe(calculateEntityStructurePlacement, () => {
  it("terminates and expands a reciprocal ownership cycle on one layer", () => {
    const graph = createGraph(
      [node("client", true), node("holding")],
      [owns("client", "holding", 40), owns("holding", "client", 60)]
    );
    const result = calculateEntityStructurePlacement(graph);
    const client = result.positions.get("client");
    const holding = result.positions.get("holding");

    expect(client).toBeDefined();
    expect(holding).toBeDefined();
    expect(client?.y).toBe(holding?.y);
    expect(client?.x).not.toBe(holding?.x);
    expect([...result.cyclicNodeIds].sort()).toStrictEqual([
      "client",
      "holding",
    ]);
    expect(result.cyclicEdgeIds.size).toBe(2);
  });

  it("lays out a complex graph without overlaps and preserves hierarchy direction", () => {
    const graph = complexGraph();
    const result = calculateEntityStructurePlacement(graph);
    const positions = [...result.positions.entries()];

    expect(positions).toHaveLength(graph.nodes.length);
    expect(
      positions.every(
        ([, point]) => Number.isFinite(point.x) && Number.isFinite(point.y)
      )
    ).toBeTruthy();
    expect(hasNodeOverlap(positions)).toBeFalsy();

    for (const edge of graph.edges.filter((item) => item.type === "OWNS")) {
      if (result.cyclicEdgeIds.has(edge.id)) {
        continue;
      }
      expect(
        expectPresent(result.positions.get(edge.fromEntityId)).y
      ).toBeLessThan(expectPresent(result.positions.get(edge.toEntityId)).y);
    }

    expect(
      expectPresent(result.positions.get("joint-venture")).y
    ).toBeLessThan(expectPresent(result.positions.get("mid-holdings")).y);
    expect(expectPresent(result.positions.get("isolated")).x).toBeGreaterThan(
      Math.max(
        ...graph.nodes
          .filter((item) => item.id !== "isolated")
          .map((item) => expectPresent(result.positions.get(item.id)).x)
      )
    );
    expect([...result.cyclicNodeIds].sort()).toStrictEqual([
      "cycle-a",
      "cycle-b",
      "cycle-c",
    ]);
  });

  it("is deterministic when relationship records arrive in a different order", () => {
    const graph = complexGraph();
    const reversed = { ...graph, edges: [...graph.edges].toReversed() };

    expect(
      serialisePositions(calculateEntityStructurePlacement(graph))
    ).toStrictEqual(
      serialisePositions(calculateEntityStructurePlacement(reversed))
    );
  });

  it("keeps the primary graph stable when an unrelated party is added", () => {
    const base = complexGraph(false);
    const extended = complexGraph(true);
    const basePositions = calculateEntityStructurePlacement(base).positions;
    const extendedPositions =
      calculateEntityStructurePlacement(extended).positions;

    for (const baseNode of base.nodes) {
      expect(extendedPositions.get(baseNode.id)).toStrictEqual(
        basePositions.get(baseNode.id)
      );
    }
  });

  it("places every group-relationship participant above its shared target", () => {
    const graph = createGraph(
      [node("client", true), node("associate-a"), node("associate-b")],
      [],
      [
        groupRelationshipWithParticipants("client", "ASSOCIATE", [
          ["associate-a", 35],
          ["associate-b", 65],
        ]),
      ]
    );
    const result = calculateEntityStructurePlacement(graph);
    const clientY = expectPresent(result.positions.get("client")).y;

    expect(expectPresent(result.positions.get("associate-a")).y).toBeLessThan(
      clientY
    );
    expect(expectPresent(result.positions.get("associate-b")).y).toBeLessThan(
      clientY
    );
  });
});

function complexGraph(includeIsolated = true): CmpClientGraph {
  const nodes = [
    node("client", true),
    node("person-a", false, "PERSON"),
    node("person-b", false, "PERSON"),
    node("holdings-a"),
    node("holdings-b"),
    node("mid-holdings"),
    node("cycle-a"),
    node("cycle-b"),
    node("cycle-c"),
    node("joint-venture"),
    ...(includeIsolated ? [node("isolated")] : []),
  ];
  return createGraph(
    nodes,
    [
      owns("person-a", "holdings-a", 80),
      owns("person-b", "holdings-b", 70),
      owns("holdings-a", "mid-holdings", 55),
      owns("holdings-b", "mid-holdings", 45),
      owns("mid-holdings", "client", 65),
      owns("cycle-a", "cycle-b", 40),
      owns("cycle-b", "cycle-c", 35),
      owns("cycle-c", "cycle-a", 25),
      owns("cycle-a", "mid-holdings", 10),
    ],
    [groupRelationship("joint-venture", "mid-holdings", "JOINT_VENTURE")]
  );
}

function createGraph(
  nodes: CmpClientGraph["nodes"],
  edges: CmpClientGraph["edges"],
  groupRelationships: CmpClientGraph["groupRelationships"] = []
): CmpClientGraph {
  return {
    client: {
      id: "client-record",
      clientCode: "C-001",
      rootEntityId: "client",
    },
    asOf: "2026-08-21",
    nodes,
    edges,
    groupRelationships,
  };
}

function node(
  id: string,
  isRoot = false,
  kind: CmpClientGraph["nodes"][number]["kind"] = "COMPANY"
): CmpClientGraph["nodes"][number] {
  return {
    id,
    kind,
    displayName: id,
    nameZh: null,
    nameEn: id,
    jurisdiction: kind === "PERSON" ? null : "Hong Kong",
    registrationNumber: null,
    status: "ACTIVE",
    role: isRoot ? "ROOT" : "RELATED",
    isRoot,
    clientIds: ["client-record"],
  };
}

let relationshipSequence = 0;

function owns(
  fromEntityId: string,
  toEntityId: string,
  ownershipPercentage: number
) {
  return relationship(fromEntityId, toEntityId, "OWNS", ownershipPercentage);
}

function relationship(
  fromEntityId: string,
  toEntityId: string,
  type: CmpClientGraph["edges"][number]["type"],
  ownershipPercentage: number | null = null
): CmpClientGraph["edges"][number] {
  relationshipSequence += 1;
  return {
    id: `relationship-${relationshipSequence}`,
    fromEntityId,
    toEntityId,
    type,
    ownershipPercentage,
    effectiveFrom: null,
    effectiveTo: null,
    remarks: null,
    sourceDocument: null,
  };
}

function groupRelationship(
  entityId: string,
  targetEntityId: string,
  type: "ASSOCIATE" | "JOINT_VENTURE"
): CmpClientGraph["groupRelationships"][number] {
  relationshipSequence += 1;
  return {
    id: `group-relationship-${relationshipSequence}`,
    targetEntityId,
    type,
    effectiveFrom: null,
    effectiveTo: null,
    sourceDocument: null,
    remarks: null,
    participants: [
      {
        entityId,
        method: "OWNERSHIP",
        ownershipPercentage: null,
        otherDescription: null,
      },
    ],
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };
}

function groupRelationshipWithParticipants(
  targetEntityId: string,
  type: "ASSOCIATE" | "JOINT_VENTURE",
  participants: [string, number][]
): CmpClientGraph["groupRelationships"][number] {
  relationshipSequence += 1;
  return {
    id: `group-relationship-${relationshipSequence}`,
    targetEntityId,
    type,
    effectiveFrom: null,
    effectiveTo: null,
    sourceDocument: null,
    remarks: null,
    participants: participants.map(([entityId, ownershipPercentage]) => ({
      entityId,
      method: "OWNERSHIP",
      ownershipPercentage,
      otherDescription: null,
    })),
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };
}

function serialisePositions(
  result: ReturnType<typeof calculateEntityStructurePlacement>
) {
  return [...result.positions.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
}

function hasNodeOverlap(positions: [string, { x: number; y: number }][]) {
  const height = 96;
  const width = 224;
  return positions.some(([, left], index) =>
    positions.slice(index + 1).some(([, right]) => {
      const horizontal = left.x < right.x + width && left.x + width > right.x;
      const vertical = left.y < right.y + height && left.y + height > right.y;
      return horizontal && vertical;
    })
  );
}
