"use client";

import type { CmpClientGraph } from "@project-wing/shared/cmp-entity-graph";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
} from "@xyflow/react";
import type { Edge, Node, NodeProps } from "@xyflow/react";
import { Building2, CircleUserRound } from "lucide-react";

import { useCmpI18n } from "@/i18n/client";
import type { CmpDictionary } from "@/i18n/client";

import { relationshipTypeLabel } from "./client-relationship-semantics";
import { calculateEntityStructurePlacement } from "./cmp-entity-structure-layout";

type VisualRelationship =
  | (CmpClientGraph["edges"][number] & {
      otherDescription?: null;
    })
  | {
      id: string;
      fromEntityId: string;
      toEntityId: string;
      type: "ASSOCIATE" | "JOINT_VENTURE";
      method: "OWNERSHIP" | "OTHER";
      ownershipPercentage: number | null;
      otherDescription: string | null;
    };

type GraphNodeData = {
  name: string;
  kind: CmpClientGraph["nodes"][number]["kind"];
  jurisdiction: string | null;
  status: CmpClientGraph["nodes"][number]["status"];
  isRoot: boolean;
  rootLabel: string;
  cycleLabel: string;
  isCyclic: boolean;
};

type RelatedPartyNode = Node<GraphNodeData, "related-party">;

const nodeTypes = { "related-party": RelatedPartyGraphNode };

export function CmpEntityStructureGraph({
  graph,
  zh,
  className = "h-full",
}: {
  graph: CmpClientGraph;
  zh: boolean;
  className?: string;
}) {
  const copy = useCmpI18n().dictionary.workspace;
  const flow = layoutClientGraph(graph, zh, copy);

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-muted/20 ${className}`}
    >
      {graph.nodes.length > 0 ? (
        <ReactFlow<RelatedPartyNode, Edge>
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.22 }}
          minZoom={0.25}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {zh
            ? "此客户暂时没有相关主体。"
            : "This client has no related parties yet."}
        </div>
      )}
    </div>
  );
}

function RelatedPartyGraphNode({
  data,
  selected,
}: NodeProps<RelatedPartyNode>) {
  const Icon = data.kind === "COMPANY" ? Building2 : CircleUserRound;
  return (
    <article
      className={`min-h-24 w-56 rounded-2xl border bg-card p-4 shadow-sm ${
        selected ? "border-primary ring-4 ring-primary/10" : "border-border"
      }`}
    >
      <Handle
        id="hierarchy-target"
        type="target"
        position={Position.Top}
        className="!opacity-0"
      />
      <Handle
        id="peer-target"
        type="target"
        position={Position.Left}
        className="!opacity-0"
      />
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <strong className="truncate text-sm" title={data.name}>
              {data.name}
            </strong>
            {data.isRoot ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {data.rootLabel}
              </span>
            ) : null}
            {data.isCyclic ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {data.cycleLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {entityKindText(data.kind, data.rootLabel === "客户主体")}
            {data.jurisdiction ? ` · ${data.jurisdiction}` : ""}
          </p>
        </div>
      </div>
      <Handle
        id="hierarchy-source"
        type="source"
        position={Position.Bottom}
        className="!opacity-0"
      />
      <Handle
        id="peer-source"
        type="source"
        position={Position.Right}
        className="!opacity-0"
      />
      <Handle
        id="cycle-left-source"
        type="source"
        position={Position.Left}
        className="!top-[68%] !opacity-0"
      />
      <Handle
        id="cycle-left-target"
        type="target"
        position={Position.Left}
        className="!top-[32%] !opacity-0"
      />
      <Handle
        id="cycle-right-source"
        type="source"
        position={Position.Right}
        className="!top-[32%] !opacity-0"
      />
      <Handle
        id="cycle-right-target"
        type="target"
        position={Position.Right}
        className="!top-[68%] !opacity-0"
      />
    </article>
  );
}

export function layoutClientGraph(
  graph: CmpClientGraph,
  zh: boolean,
  copy?: CmpDictionary["workspace"]
) {
  const hierarchyEdges: VisualRelationship[] = graph.edges.filter((edge) =>
    ["OWNS", "BENEFICIAL_OWNER_OF"].includes(edge.type)
  );
  const peerEdges: VisualRelationship[] = graph.groupRelationships.flatMap(
    (relationship) =>
      relationship.participants.map((participant) => ({
        id: `${relationship.id}:${participant.entityId}`,
        fromEntityId: participant.entityId,
        toEntityId: relationship.targetEntityId,
        type: relationship.type,
        method: participant.method,
        ownershipPercentage: participant.ownershipPercentage,
        otherDescription: participant.otherDescription,
      }))
  );
  const placement = calculateEntityStructurePlacement(graph);
  const nodes: RelatedPartyNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: "related-party",
    position: placement.positions.get(node.id) ?? { x: 0, y: 0 },
    data: {
      name: node.displayName,
      kind: node.kind,
      jurisdiction: node.jurisdiction,
      status: node.status,
      isRoot: node.isRoot,
      rootLabel: zh ? "客户主体" : "Client",
      cycleLabel: zh ? "循环持股" : "Ownership cycle",
      isCyclic: placement.cyclicNodeIds.has(node.id),
    },
  }));
  const visibleEdges = [...hierarchyEdges, ...peerEdges];
  const edges: Edge[] = visibleEdges.map((edge) => {
    const groupRelationship = isGroupRelationshipEdge(edge);
    const cyclic = placement.cyclicEdgeIds.has(edge.id);
    const sourceX = placement.positions.get(edge.fromEntityId)?.x ?? 0;
    const targetX = placement.positions.get(edge.toEntityId)?.x ?? 0;
    const cycleRunsRight = sourceX <= targetX;
    const details = groupRelationship
      ? [groupParticipantLabel(edge, zh)]
      : [
          edge.ownershipPercentage === null
            ? null
            : copy
              ? `${copy.clientFormOwnershipPercentage.replace(" %", "")} ${edge.ownershipPercentage}%`
              : `${edge.ownershipPercentage}%`,
        ].filter(Boolean);
    return {
      id: edge.id,
      source: edge.fromEntityId,
      target: edge.toEntityId,
      sourceHandle: cyclic
        ? cycleRunsRight
          ? "cycle-right-source"
          : "cycle-left-source"
        : "hierarchy-source",
      targetHandle: cyclic
        ? cycleRunsRight
          ? "cycle-left-target"
          : "cycle-right-target"
        : "hierarchy-target",
      label: [
        groupRelationship
          ? relationshipLabel(edge.type, zh)
          : copy
            ? relationshipTypeLabel(edge.type, copy)
            : relationshipLabel(edge.type, zh),
        ...details,
      ].join(" · "),
      markerEnd: { type: MarkerType.ArrowClosed },
      style: cyclic
        ? { strokeWidth: 2 }
        : groupRelationship
          ? { strokeDasharray: "6 4" }
          : undefined,
      type: cyclic ? "default" : "smoothstep",
    };
  });
  return { nodes, edges };
}

function isGroupRelationshipEdge(
  edge: VisualRelationship
): edge is Extract<VisualRelationship, { type: "ASSOCIATE" | "JOINT_VENTURE" }> {
  return edge.type === "ASSOCIATE" || edge.type === "JOINT_VENTURE";
}

function groupParticipantLabel(
  edge: Extract<VisualRelationship, { type: "ASSOCIATE" | "JOINT_VENTURE" }>,
  zh: boolean
) {
  if (edge.method === "OTHER") {
    return edge.otherDescription
      ? zh
        ? `其他：${edge.otherDescription}`
        : `Other: ${edge.otherDescription}`
      : zh
        ? "其他"
        : "Other";
  }
  if (edge.ownershipPercentage === null) {
    return zh ? "持有" : "Holds";
  }
  return zh
    ? `持有 ${edge.ownershipPercentage}%`
    : `Holds ${edge.ownershipPercentage}%`;
}

function entityKindText(kind: GraphNodeData["kind"], zh: boolean) {
  const labels = {
    COMPANY: zh ? "公司" : "Company",
    PERSON: zh ? "个人" : "Individual",
    TRUST: zh ? "信托" : "Trust",
    PARTNERSHIP: zh ? "合伙" : "Partnership",
    OTHER_ORGANISATION: zh ? "其他组织" : "Other organisation",
  };
  return labels[kind];
}

function relationshipLabel(
  type: CmpClientGraph["edges"][number]["type"] | "ASSOCIATE" | "JOINT_VENTURE",
  zh: boolean
) {
  const labels = {
    OWNS: zh ? "持有" : "Owns",
    DIRECTOR_OF: zh ? "担任董事" : "Director of",
    BENEFICIAL_OWNER_OF: zh ? "最终实益拥有人" : "Beneficial owner of",
    COMPANY_SECRETARY_OF: zh ? "担任公司秘书" : "Company secretary of",
    MANAGES: zh ? "管理" : "Manages",
    ASSOCIATE: zh ? "联营" : "Associate",
    JOINT_VENTURE: zh ? "合营" : "Joint venture",
    OTHER: zh ? "其他" : "Other",
  };
  return labels[type];
}
