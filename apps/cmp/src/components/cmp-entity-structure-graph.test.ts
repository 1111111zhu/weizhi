import type { CmpClientGraph } from "@project-wing/shared/cmp-entity-graph";
import { describe, expect, it } from "vitest";

import { layoutClientGraph } from "./cmp-entity-structure-graph";

describe(layoutClientGraph, () => {
  it("renders one directed, labelled edge per group participant", () => {
    const graph: CmpClientGraph = {
      client: { id: "client-1", clientCode: "C-001", rootEntityId: "root" },
      asOf: "2026-09-03",
      nodes: [
        node("root", "Current client", true),
        node("company-a", "Company A", false),
        node("company-b", "Company B", false),
      ],
      edges: [],
      groupRelationships: [
        {
          id: "associate-1",
          targetEntityId: "root",
          type: "ASSOCIATE",
          effectiveFrom: null,
          effectiveTo: null,
          sourceDocument: null,
          remarks: null,
          participants: [
            {
              entityId: "company-a",
              method: "OWNERSHIP",
              ownershipPercentage: 35,
              otherDescription: null,
            },
            {
              entityId: "company-b",
              method: "OWNERSHIP",
              ownershipPercentage: 65,
              otherDescription: null,
            },
          ],
          createdAt: "2026-09-03T00:00:00.000Z",
          updatedAt: "2026-09-03T00:00:00.000Z",
        },
      ],
    };

    const result = layoutClientGraph(graph, true);
    const edges = result.edges.filter((edge) => edge.id.startsWith("associate-1"));
    const root = result.nodes.find((node) => node.id === "root");
    const companyA = result.nodes.find((node) => node.id === "company-a");
    const companyB = result.nodes.find((node) => node.id === "company-b");

    expect(edges).toHaveLength(2);
    expect(edges.map((edge) => edge.label)).toEqual([
      "联营 · 持有 35%",
      "联营 · 持有 65%",
    ]);
    expect(edges.every((edge) => edge.markerEnd)).toBeTruthy();
    expect(companyA?.position.y).toBeLessThan(root?.position.y ?? 0);
    expect(companyB?.position.y).toBeLessThan(root?.position.y ?? 0);
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
