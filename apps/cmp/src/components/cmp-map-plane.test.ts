import type { CmpClientGraph } from "@project-wing/shared/cmp-entity-graph";
import { describe, expect, it } from "vitest";

import { layoutClientGraph } from "./cmp-map-plane";

describe(layoutClientGraph, () => {
  it("places a direct owner above the client subject", () => {
    const graph: CmpClientGraph = {
      client: {
        id: "client-1",
        clientCode: "C-001",
        rootEntityId: "client-entity",
      },
      asOf: "2026-08-09",
      nodes: [
        node("client-entity", "Client Limited", true),
        node("owner-entity", "Owner Holdings", false),
      ],
      edges: [
        {
          id: "relationship-1",
          fromEntityId: "owner-entity",
          toEntityId: "client-entity",
          type: "OWNS",
          ownershipPercentage: 100,
          effectiveFrom: null,
          effectiveTo: null,
          remarks: null,
          sourceDocument: null,
        },
      ],
      groupRelationships: [],
    };
    const result = layoutClientGraph(graph, true);
    const owner = result.nodes.find((item) => item.id === "owner-entity");
    const client = result.nodes.find((item) => item.id === "client-entity");

    expect(owner?.position.y).toBeLessThan(client?.position.y ?? 0);
  });
});

function node(
  id: string,
  displayName: string,
  isRoot: boolean
): CmpClientGraph["nodes"][number] {
  return {
    id,
    kind: "COMPANY",
    displayName,
    nameZh: null,
    nameEn: displayName,
    jurisdiction: "Hong Kong",
    registrationNumber: null,
    status: "ACTIVE",
    role: isRoot ? "ROOT" : "RELATED",
    isRoot,
    clientIds: ["client-1"],
  };
}
