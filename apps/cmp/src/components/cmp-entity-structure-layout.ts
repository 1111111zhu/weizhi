import type { CmpClientGraph } from "@project-wing/shared/cmp-entity-graph";

export type EntityStructurePoint = { x: number; y: number };

export type EntityStructurePlacement = {
  positions: Map<string, EntityStructurePoint>;
  cyclicNodeIds: Set<string>;
  cyclicEdgeIds: Set<string>;
};

const COMPONENT_GAP = 104;
const LAYER_GAP = 132;
const NODE_HEIGHT = 96;
const NODE_WIDTH = 224;
const SUBGRAPH_GAP = 168;
const HIERARCHY_TYPES = new Set(["OWNS", "BENEFICIAL_OWNER_OF"]);
const GROUP_RELATIONSHIP_TYPES = new Set(["ASSOCIATE", "JOINT_VENTURE"]);

type GraphEdge =
  | Pick<
      CmpClientGraph["edges"][number],
      "id" | "fromEntityId" | "toEntityId" | "type"
    >
  | {
      id: string;
      fromEntityId: string;
      toEntityId: string;
      type: "ASSOCIATE" | "JOINT_VENTURE";
    };

type ComponentGeometry = {
  width: number;
  height: number;
  nodePositions: Map<string, EntityStructurePoint>;
};

type WeakComponentLayout = EntityStructurePlacement & {
  nodeIds: string[];
  width: number;
  height: number;
};

/**
 * Produces a deterministic, cycle-safe layered layout for the client entity graph.
 * Ownership SCCs are collapsed before ranking and expanded inside one layer.
 */
export function calculateEntityStructurePlacement(
  graph: CmpClientGraph
): EntityStructurePlacement {
  const nodeOrder = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const nodeIds = new Set(nodeOrder.keys());
  const hierarchyEdges = graph.edges.filter(
    (edge) =>
      HIERARCHY_TYPES.has(edge.type) &&
      nodeIds.has(edge.fromEntityId) &&
      nodeIds.has(edge.toEntityId)
  );
  const groupRelationshipEdges: GraphEdge[] = graph.groupRelationships
    .flatMap((relationship) =>
      relationship.participants.map((participant) => ({
        id: `${relationship.id}:${participant.entityId}`,
        fromEntityId: participant.entityId,
        toEntityId: relationship.targetEntityId,
        type: relationship.type,
      }))
    )
    .filter(
      (edge) =>
        GROUP_RELATIONSHIP_TYPES.has(edge.type) &&
        nodeIds.has(edge.fromEntityId) &&
        nodeIds.has(edge.toEntityId)
    );
  const visibleEdges = [...hierarchyEdges, ...groupRelationshipEdges];
  const weakComponents = findWeakComponents(
    [...nodeIds],
    visibleEdges,
    nodeOrder
  ).sort((left, right) => {
    const leftHasRoot = graph.client.rootEntityId
      ? left.includes(graph.client.rootEntityId)
      : false;
    const rightHasRoot = graph.client.rootEntityId
      ? right.includes(graph.client.rootEntityId)
      : false;
    return (
      Number(rightHasRoot) - Number(leftHasRoot) ||
      right.length - left.length ||
      componentBaseOrder(left, nodeOrder) - componentBaseOrder(right, nodeOrder)
    );
  });
  const layouts = weakComponents.map((component) =>
    layoutWeakComponent({
      nodeIds: component,
      hierarchyEdges: hierarchyEdges.filter(
        (edge) =>
          component.includes(edge.fromEntityId) &&
          component.includes(edge.toEntityId)
      ),
      groupRelationshipEdges: groupRelationshipEdges.filter(
        (edge) =>
          component.includes(edge.fromEntityId) &&
          component.includes(edge.toEntityId)
      ),
      nodeOrder,
    })
  );
  const positions = new Map<string, EntityStructurePoint>();
  const cyclicNodeIds = new Set<string>();
  const cyclicEdgeIds = new Set<string>();
  if (layouts.length === 0) {
    return { positions, cyclicNodeIds, cyclicEdgeIds };
  }

  const [primary] = layouts;
  if (!primary) {
    return { positions, cyclicNodeIds, cyclicEdgeIds };
  }
  placeWeakComponent(
    primary,
    { x: 0, y: 0 },
    positions,
    cyclicNodeIds,
    cyclicEdgeIds
  );

  let columnX = primary.width + SUBGRAPH_GAP;
  let columnWidth = 0;
  let columnY = 0;
  for (const layout of layouts.slice(1)) {
    if (columnY > 0 && columnY + layout.height > primary.height) {
      columnX += columnWidth + SUBGRAPH_GAP;
      columnY = 0;
      columnWidth = 0;
    }
    placeWeakComponent(
      layout,
      { x: columnX, y: columnY },
      positions,
      cyclicNodeIds,
      cyclicEdgeIds
    );
    columnY += layout.height + SUBGRAPH_GAP;
    columnWidth = Math.max(columnWidth, layout.width);
  }

  return { positions, cyclicNodeIds, cyclicEdgeIds };
}

function layoutWeakComponent({
  nodeIds,
  hierarchyEdges,
  groupRelationshipEdges,
  nodeOrder,
}: {
  nodeIds: string[];
  hierarchyEdges: GraphEdge[];
  groupRelationshipEdges: GraphEdge[];
  nodeOrder: Map<string, number>;
}): WeakComponentLayout {
  const stronglyConnected = findStronglyConnectedComponents(
    nodeIds,
    hierarchyEdges,
    nodeOrder
  );
  const componentByNode = new Map<string, number>();
  stronglyConnected.forEach((component, index) =>
    component.forEach((nodeId) => componentByNode.set(nodeId, index))
  );
  const componentOrder = new Map(
    stronglyConnected.map((component, index) => [
      index,
      componentBaseOrder(component, nodeOrder),
    ])
  );
  const cyclicComponents = new Set<number>();
  stronglyConnected.forEach((component, index) => {
    if (
      component.length > 1 ||
      hierarchyEdges.some(
        (edge) =>
          edge.fromEntityId === edge.toEntityId &&
          componentByNode.get(edge.fromEntityId) === index
      )
    ) {
      cyclicComponents.add(index);
    }
  });

  const outgoing = new Map<number, Set<number>>();
  const incoming = new Map<number, Set<number>>();
  const peerNeighbours = new Map<number, Set<number>>();
  const cyclicEdgeIds = new Set<string>();
  for (const edge of hierarchyEdges) {
    const from = componentByNode.get(edge.fromEntityId);
    const to = componentByNode.get(edge.toEntityId);
    if (from === undefined || to === undefined) {
      continue;
    }
    if (from === to) {
      if (cyclicComponents.has(from)) {
        cyclicEdgeIds.add(edge.id);
      }
      continue;
    }
    addToSet(outgoing, from, to);
    addToSet(incoming, to, from);
  }
  for (const edge of groupRelationshipEdges) {
    const from = componentByNode.get(edge.fromEntityId);
    const to = componentByNode.get(edge.toEntityId);
    if (from === undefined || to === undefined || from === to) {
      continue;
    }
    addToSet(peerNeighbours, from, to);
    addToSet(peerNeighbours, to, from);
  }

  const topological = topologicalOrder(
    stronglyConnected.length,
    outgoing,
    incoming,
    componentOrder
  );
  const rank = Array.from({ length: stronglyConnected.length }, () => 0);
  for (const component of topological) {
    for (const target of outgoing.get(component) ?? []) {
      rank[target] = Math.max(rank[target] ?? 0, (rank[component] ?? 0) + 1);
    }
  }
  alignHierarchyFreePeers(rank, outgoing, incoming, peerNeighbours);
  applyDirectedGroupRelationshipRanks(
    rank,
    hierarchyEdges,
    groupRelationshipEdges,
    componentByNode,
    componentOrder
  );
  compressRanks(rank);

  const orderByRank = new Map<number, number[]>();
  rank.forEach((value, component) =>
    orderByRank.set(value, [...(orderByRank.get(value) ?? []), component])
  );
  for (const layer of orderByRank.values()) {
    layer.sort(
      (left, right) =>
        (componentOrder.get(left) ?? 0) - (componentOrder.get(right) ?? 0)
    );
  }
  minimiseCrossings({
    orderByRank,
    rank,
    incoming,
    outgoing,
    peerNeighbours,
    componentOrder,
  });

  const geometry = new Map<number, ComponentGeometry>();
  stronglyConnected.forEach((component, index) =>
    geometry.set(
      index,
      componentGeometry(component, cyclicComponents.has(index), nodeOrder)
    )
  );
  const ranks = [...orderByRank.keys()].sort((left, right) => left - right);
  const layerSizes = new Map(
    ranks.map((layer) => {
      const components = orderByRank.get(layer) ?? [];
      return [
        layer,
        {
          width:
            components.reduce(
              (sum, component) => sum + (geometry.get(component)?.width ?? 0),
              0
            ) +
            Math.max(0, components.length - 1) * COMPONENT_GAP,
          height: Math.max(
            NODE_HEIGHT,
            ...components.map(
              (component) => geometry.get(component)?.height ?? NODE_HEIGHT
            )
          ),
        },
      ] as const;
    })
  );
  const width = Math.max(
    NODE_WIDTH,
    ...[...layerSizes.values()].map((size) => size.width)
  );
  const positions = new Map<string, EntityStructurePoint>();
  let layerY = 0;
  for (const layer of ranks) {
    const size = layerSizes.get(layer);
    if (!size) {
      continue;
    }
    let componentX = (width - size.width) / 2;
    for (const component of orderByRank.get(layer) ?? []) {
      const box = geometry.get(component);
      if (!box) {
        continue;
      }
      const boxY = layerY + (size.height - box.height) / 2;
      for (const [nodeId, point] of box.nodePositions) {
        positions.set(nodeId, {
          x: componentX + point.x,
          y: boxY + point.y,
        });
      }
      componentX += box.width + COMPONENT_GAP;
    }
    layerY += size.height + LAYER_GAP;
  }

  return {
    nodeIds,
    positions,
    cyclicNodeIds: new Set(
      stronglyConnected.flatMap((component, index) =>
        cyclicComponents.has(index) ? component : []
      )
    ),
    cyclicEdgeIds,
    width,
    height: Math.max(NODE_HEIGHT, layerY - LAYER_GAP),
  };
}

function applyDirectedGroupRelationshipRanks(
  rank: number[],
  hierarchyEdges: GraphEdge[],
  groupRelationshipEdges: GraphEdge[],
  componentByNode: Map<string, number>,
  componentOrder: Map<number, number>
) {
  const directionalEdges = [...hierarchyEdges, ...groupRelationshipEdges]
    .map((edge) => ({
      from: componentByNode.get(edge.fromEntityId),
      to: componentByNode.get(edge.toEntityId),
    }))
    .filter(
      (edge): edge is { from: number; to: number } =>
        edge.from !== undefined && edge.to !== undefined && edge.from !== edge.to
    )
    .sort(
      (left, right) =>
        (componentOrder.get(left.from) ?? 0) -
          (componentOrder.get(right.from) ?? 0) ||
        (componentOrder.get(left.to) ?? 0) - (componentOrder.get(right.to) ?? 0)
    );

  // Group relationships are directional for presentation (participant → target),
  // but they are deliberately excluded from ownership-cycle detection. A bounded
  // relaxation keeps the layout safe even if cross-linked group records exist.
  for (let pass = 0; pass < rank.length; pass += 1) {
    let changed = false;
    for (const edge of directionalEdges) {
      const nextRank = (rank[edge.from] ?? 0) + 1;
      if ((rank[edge.to] ?? 0) >= nextRank) {
        continue;
      }
      rank[edge.to] = nextRank;
      changed = true;
    }
    if (!changed) {
      return;
    }
  }
}

function findWeakComponents(
  nodeIds: string[],
  edges: GraphEdge[],
  nodeOrder: Map<string, number>
) {
  const neighbours = new Map<string, Set<string>>();
  for (const edge of edges) {
    addToSet(neighbours, edge.fromEntityId, edge.toEntityId);
    addToSet(neighbours, edge.toEntityId, edge.fromEntityId);
  }
  const seen = new Set<string>();
  const result: string[][] = [];
  for (const start of nodeIds) {
    if (seen.has(start)) {
      continue;
    }
    const component: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) {
        continue;
      }
      component.push(node);
      for (const neighbour of neighbours.get(node) ?? []) {
        if (seen.has(neighbour)) {
          continue;
        }
        seen.add(neighbour);
        stack.push(neighbour);
      }
    }
    component.sort(
      (left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0)
    );
    result.push(component);
  }
  return result;
}

function findStronglyConnectedComponents(
  nodeIds: string[],
  edges: GraphEdge[],
  nodeOrder: Map<string, number>
) {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.fromEntityId, [
      ...(outgoing.get(edge.fromEntityId) ?? []),
      edge.toEntityId,
    ]);
  }
  for (const neighbours of outgoing.values()) {
    neighbours.sort(
      (left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0)
    );
  }

  let nextIndex = 0;
  const indexByNode = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const stack: string[] = [];
  const inStack = new Set<string>();
  const components: string[][] = [];
  const visit = (nodeId: string) => {
    indexByNode.set(nodeId, nextIndex);
    lowLink.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    inStack.add(nodeId);
    for (const target of outgoing.get(nodeId) ?? []) {
      if (!indexByNode.has(target)) {
        visit(target);
        lowLink.set(
          nodeId,
          Math.min(lowLink.get(nodeId) ?? 0, lowLink.get(target) ?? 0)
        );
      } else if (inStack.has(target)) {
        lowLink.set(
          nodeId,
          Math.min(lowLink.get(nodeId) ?? 0, indexByNode.get(target) ?? 0)
        );
      }
    }
    if (lowLink.get(nodeId) !== indexByNode.get(nodeId)) {
      return;
    }
    const component: string[] = [];
    while (stack.length > 0) {
      const member = stack.pop();
      if (member === undefined) {
        break;
      }
      inStack.delete(member);
      component.push(member);
      if (member === nodeId) {
        break;
      }
    }
    component.sort(
      (left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0)
    );
    components.push(component);
  };
  for (const nodeId of nodeIds) {
    if (!indexByNode.has(nodeId)) {
      visit(nodeId);
    }
  }
  return components.sort(
    (left, right) =>
      componentBaseOrder(left, nodeOrder) - componentBaseOrder(right, nodeOrder)
  );
}

function topologicalOrder(
  componentCount: number,
  outgoing: Map<number, Set<number>>,
  incoming: Map<number, Set<number>>,
  componentOrder: Map<number, number>
) {
  const indegree = Array.from(
    { length: componentCount },
    (_, index) => incoming.get(index)?.size ?? 0
  );
  const ready = indegree
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value === 0)
    .map(({ index }) => index)
    .sort(
      (left, right) =>
        (componentOrder.get(left) ?? 0) - (componentOrder.get(right) ?? 0)
    );
  const result: number[] = [];
  while (ready.length > 0) {
    const component = ready.shift();
    if (component === undefined) {
      continue;
    }
    result.push(component);
    for (const target of outgoing.get(component) ?? []) {
      indegree[target] = (indegree[target] ?? 0) - 1;
      if (indegree[target] === 0) {
        ready.push(target);
        ready.sort(
          (left, right) =>
            (componentOrder.get(left) ?? 0) - (componentOrder.get(right) ?? 0)
        );
      }
    }
  }
  return result;
}

function alignHierarchyFreePeers(
  rank: number[],
  outgoing: Map<number, Set<number>>,
  incoming: Map<number, Set<number>>,
  peerNeighbours: Map<number, Set<number>>
) {
  const hierarchyDegree = rank.map(
    (_, component) =>
      (outgoing.get(component)?.size ?? 0) +
      (incoming.get(component)?.size ?? 0)
  );
  for (const _pass of rank) {
    let changed = false;
    for (const [component, neighbours] of peerNeighbours) {
      if ((hierarchyDegree[component] ?? 0) > 0) {
        continue;
      }
      const anchored = [...neighbours].filter(
        (neighbour) => (hierarchyDegree[neighbour] ?? 0) > 0
      );
      if (anchored.length === 0) {
        continue;
      }
      const next = Math.round(
        anchored.reduce((sum, neighbour) => sum + (rank[neighbour] ?? 0), 0) /
          anchored.length
      );
      if (rank[component] !== next) {
        rank[component] = next;
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
}

function compressRanks(rank: number[]) {
  const values = [...new Set(rank)].sort((left, right) => left - right);
  const compressed = new Map(values.map((value, index) => [value, index]));
  rank.forEach((value, index) => {
    rank[index] = compressed.get(value) ?? 0;
  });
}

function minimiseCrossings({
  orderByRank,
  rank,
  incoming,
  outgoing,
  peerNeighbours,
  componentOrder,
}: {
  orderByRank: Map<number, number[]>;
  rank: number[];
  incoming: Map<number, Set<number>>;
  outgoing: Map<number, Set<number>>;
  peerNeighbours: Map<number, Set<number>>;
  componentOrder: Map<number, number>;
}) {
  const ranks = [...orderByRank.keys()].sort((left, right) => left - right);
  for (let pass = 0; pass < 4; pass += 1) {
    for (const layer of ranks.slice(1)) {
      reorderLayer(
        orderByRank.get(layer) ?? [],
        incoming,
        peerNeighbours,
        orderByRank,
        rank,
        componentOrder
      );
    }
    for (const layer of ranks.toReversed().slice(1)) {
      reorderLayer(
        orderByRank.get(layer) ?? [],
        outgoing,
        peerNeighbours,
        orderByRank,
        rank,
        componentOrder
      );
    }
  }
}

function reorderLayer(
  layer: number[],
  directionalNeighbours: Map<number, Set<number>>,
  peerNeighbours: Map<number, Set<number>>,
  orderByRank: Map<number, number[]>,
  rank: number[],
  componentOrder: Map<number, number>
) {
  if (layer.length < 2) {
    return;
  }
  const currentOrder = new Map(
    layer.map((component, index) => [component, index])
  );
  const position = new Map<number, number>();
  for (const [layerRank, components] of orderByRank) {
    const divisor = Math.max(1, components.length - 1);
    components.forEach((component, index) =>
      position.set(component, index / divisor + layerRank * 0.000001)
    );
  }
  const score = (component: number) => {
    const neighbours = [
      ...(directionalNeighbours.get(component) ?? []),
      ...(peerNeighbours.get(component) ?? []),
    ].filter((neighbour) => rank[neighbour] !== undefined);
    if (neighbours.length === 0) {
      return null;
    }
    return (
      neighbours.reduce(
        (sum, neighbour) => sum + (position.get(neighbour) ?? 0),
        0
      ) / neighbours.length
    );
  };
  layer.sort((left, right) => {
    const leftScore = score(left);
    const rightScore = score(right);
    if (leftScore !== null && rightScore !== null && leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    if (leftScore !== null && rightScore === null) {
      return -1;
    }
    if (rightScore !== null && leftScore === null) {
      return 1;
    }
    return (
      (currentOrder.get(left) ?? 0) - (currentOrder.get(right) ?? 0) ||
      (componentOrder.get(left) ?? 0) - (componentOrder.get(right) ?? 0)
    );
  });
}

function componentGeometry(
  nodeIds: string[],
  cyclic: boolean,
  nodeOrder: Map<string, number>
): ComponentGeometry {
  const ordered = [...nodeIds].sort(
    (left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0)
  );
  if (ordered.length === 0) {
    return {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      nodePositions: new Map(),
    };
  }
  if (!cyclic || ordered.length === 1) {
    return {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      nodePositions: new Map([[ordered[0], { x: 0, y: 0 }]]),
    };
  }
  if (ordered.length === 2) {
    const gap = 72;
    const [first, second] = ordered;
    if (!first || !second) {
      return {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        nodePositions: new Map(),
      };
    }
    return {
      width: NODE_WIDTH * 2 + gap,
      height: NODE_HEIGHT,
      nodePositions: new Map([
        [first, { x: 0, y: 0 }],
        [second, { x: NODE_WIDTH + gap, y: 0 }],
      ]),
    };
  }

  const radiusX = Math.max(210, ordered.length * 62);
  const radiusY = Math.max(126, ordered.length * 34);
  const width = radiusX * 2 + NODE_WIDTH;
  const height = radiusY * 2 + NODE_HEIGHT;
  const centerX = width / 2;
  const centerY = height / 2;
  return {
    width,
    height,
    nodePositions: new Map(
      ordered.map((nodeId, index) => {
        const angle = -Math.PI / 2 + (index / ordered.length) * Math.PI * 2;
        return [
          nodeId,
          {
            x: centerX + Math.cos(angle) * radiusX - NODE_WIDTH / 2,
            y: centerY + Math.sin(angle) * radiusY - NODE_HEIGHT / 2,
          },
        ];
      })
    ),
  };
}

function placeWeakComponent(
  layout: WeakComponentLayout,
  offset: EntityStructurePoint,
  positions: Map<string, EntityStructurePoint>,
  cyclicNodeIds: Set<string>,
  cyclicEdgeIds: Set<string>
) {
  for (const [nodeId, point] of layout.positions) {
    positions.set(nodeId, { x: point.x + offset.x, y: point.y + offset.y });
  }
  layout.cyclicNodeIds.forEach((nodeId) => cyclicNodeIds.add(nodeId));
  layout.cyclicEdgeIds.forEach((edgeId) => cyclicEdgeIds.add(edgeId));
}

function componentBaseOrder(
  component: string[],
  nodeOrder: Map<string, number>
) {
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    ...component.map(
      (nodeId) => nodeOrder.get(nodeId) ?? Number.MAX_SAFE_INTEGER
    )
  );
}

function addToSet<Key>(map: Map<Key, Set<Key>>, key: Key, value: Key) {
  const values = map.get(key) ?? new Set<Key>();
  values.add(value);
  map.set(key, values);
}
