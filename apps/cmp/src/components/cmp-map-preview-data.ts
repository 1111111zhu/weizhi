import type { CmpDictionary } from "@/i18n/client";

import { createEntityNode, createRelationshipEdge } from "./cmp-map-types";
import type { EntityMap } from "./cmp-map-types";

type MapCopy = CmpDictionary["mapPlane"];

export function createInitialMaps(copy: MapCopy): EntityMap[] {
  return [
    {
      id: "orchid-map",
      name: copy.orchidMap,
      description: copy.orchidDescription,
      nodes: [
        createEntityNode(
          "orchid-holdings",
          {
            displayName: copy.orchidHoldings,
            kind: "company",
            isClient: false,
            companyNumber: "2891047",
            jurisdiction: copy.britishVirginIslands,
          },
          { x: 310, y: 180 }
        ),
        createEntityNode(
          "marcus-chan",
          {
            displayName: copy.marcusChan,
            kind: "person",
            isClient: false,
            jurisdiction: copy.hongKong,
          },
          { x: 40, y: 10 }
        ),
        createEntityNode(
          "elaine-wong",
          {
            displayName: copy.elaineWong,
            kind: "person",
            isClient: false,
            jurisdiction: copy.hongKong,
          },
          { x: 580, y: 10 }
        ),
        createEntityNode(
          "orchid-asia",
          {
            displayName: copy.orchidAsia,
            kind: "company",
            isClient: false,
            companyNumber: "3059812",
            jurisdiction: copy.hongKong,
          },
          { x: 310, y: 350 }
        ),
        createEntityNode(
          "cedar-capital",
          {
            displayName: copy.cedarCapital,
            kind: "company",
            isClient: false,
            jurisdiction: copy.caymanIslands,
            incomplete: true,
          },
          { x: 40, y: 350 }
        ),
        createEntityNode(
          "blue-harbor",
          {
            displayName: copy.blueHarbor,
            kind: "company",
            isClient: false,
            jurisdiction: copy.singapore,
          },
          { x: 580, y: 350 }
        ),
        createEntityNode(
          "orchid-trading",
          {
            displayName: copy.orchidTrading,
            kind: "company",
            isClient: true,
            companyNumber: "3185521",
            jurisdiction: copy.hongKong,
            engagementCount: 2,
          },
          { x: 40, y: 540 }
        ),
        createEntityNode(
          "orchid-digital",
          {
            displayName: copy.orchidDigital,
            kind: "company",
            isClient: false,
            jurisdiction: copy.singapore,
            incomplete: true,
          },
          { x: 580, y: 540 }
        ),
        createEntityNode(
          "pearl-retail",
          {
            displayName: copy.pearlRetail,
            kind: "company",
            isClient: false,
            jurisdiction: copy.hongKong,
            incomplete: true,
          },
          { x: 310, y: 720 }
        ),
      ],
      edges: [
        createRelationshipEdge({
          id: "marcus-holding",
          source: "marcus-chan",
          target: "orchid-holdings",
          label: `${copy.owns} · 55%`,
          relationshipType: "owns",
          ownershipPercent: 55,
        }),
        createRelationshipEdge({
          id: "elaine-holding",
          source: "elaine-wong",
          target: "orchid-holdings",
          label: `${copy.owns} · 45%`,
          relationshipType: "owns",
          ownershipPercent: 45,
        }),
        createRelationshipEdge({
          id: "marcus-director",
          source: "marcus-chan",
          target: "orchid-asia",
          label: copy.directorOf,
          relationshipType: "directorOf",
        }),
        createRelationshipEdge({
          id: "holding-asia",
          source: "orchid-holdings",
          target: "orchid-asia",
          label: `${copy.owns} · 100%`,
          relationshipType: "owns",
          ownershipPercent: 100,
        }),
        createRelationshipEdge({
          id: "asia-trading",
          source: "orchid-asia",
          target: "orchid-trading",
          label: `${copy.owns} · 75%`,
          relationshipType: "owns",
          ownershipPercent: 75,
        }),
        createRelationshipEdge({
          id: "cedar-trading",
          source: "cedar-capital",
          target: "orchid-trading",
          label: `${copy.owns} · 25%`,
          relationshipType: "owns",
          ownershipPercent: 25,
        }),
        createRelationshipEdge({
          id: "asia-digital",
          source: "orchid-asia",
          target: "orchid-digital",
          label: `${copy.owns} · 60%`,
          relationshipType: "owns",
          ownershipPercent: 60,
        }),
        createRelationshipEdge({
          id: "blue-digital",
          source: "blue-harbor",
          target: "orchid-digital",
          label: `${copy.owns} · 40%`,
          relationshipType: "owns",
          ownershipPercent: 40,
        }),
        createRelationshipEdge({
          id: "trading-pearl",
          source: "orchid-trading",
          target: "pearl-retail",
          label: `${copy.associateOf} · 30%`,
          relationshipType: "associateOf",
          ownershipPercent: 30,
        }),
        createRelationshipEdge({
          id: "digital-pearl",
          source: "orchid-digital",
          target: "pearl-retail",
          label: copy.jointVentureWith,
          relationshipType: "jointVentureWith",
        }),
      ],
    },
    {
      id: "northstar-map",
      name: copy.northstarMap,
      description: copy.northstarDescription,
      nodes: [
        createEntityNode(
          "northstar",
          {
            displayName: copy.northstar,
            kind: "company",
            isClient: true,
            companyNumber: "3018402",
            jurisdiction: copy.hongKong,
            engagementCount: 1,
          },
          { x: 320, y: 210 }
        ),
      ],
      edges: [],
    },
  ];
}

export function getRelationshipLabels(copy: MapCopy) {
  return {
    owns: copy.owns,
    directorOf: copy.directorOf,
    associateOf: copy.associateOf,
    jointVentureWith: copy.jointVentureWith,
  } as const;
}
