import { MarkerType } from "@xyflow/react";
import type { Edge, Node, XYPosition } from "@xyflow/react";

export type MapEntityKind = "company" | "person";
export type MapRelationshipType =
  | "owns"
  | "directorOf"
  | "associateOf"
  | "jointVentureWith";

export type MapEntityData = {
  displayName: string;
  kind: MapEntityKind;
  isClient: boolean;
  companyNumber?: string;
  jurisdiction?: string;
  incomplete?: boolean;
  engagementCount?: number;
  clientId?: string;
  clientCode?: string;
  clientStatus?: string;
  pendingAcceptanceId?: string;
  pendingClientCode?: string;
};

export type MapEdgeData = {
  relationshipType: MapRelationshipType;
  ownershipPercent?: number;
};

export type EntityNode = Node<MapEntityData, "entity">;
export type RelationshipEdge = Edge<MapEdgeData>;

export type EntityMap = {
  id: string;
  name: string;
  description: string;
  nodes: EntityNode[];
  edges: RelationshipEdge[];
};

export type MapSelection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

export function createEntityNode(
  id: string,
  data: MapEntityData,
  position: XYPosition
): EntityNode {
  return { id, type: "entity", position, data };
}

export function createDraftEntityNode(
  input: { kind: MapEntityKind; displayName: string },
  existingCount: number
) {
  const offset = existingCount * 24;
  return createEntityNode(
    crypto.randomUUID(),
    { ...input, isClient: false, incomplete: true },
    { x: 180 + offset, y: 150 + offset }
  );
}

export function createRelationshipEdge(input: {
  id: string;
  source: string;
  target: string;
  label: string;
  relationshipType: MapRelationshipType;
  ownershipPercent?: number;
}): RelationshipEdge {
  return {
    id: input.id,
    source: input.source,
    target: input.target,
    label: input.label,
    data: {
      relationshipType: input.relationshipType,
      ownershipPercent: input.ownershipPercent,
    },
    markerEnd: { type: MarkerType.ArrowClosed },
  };
}
