import { z } from "zod";

import {
  CmpEntityKindSchema,
  CmpEntityRelationshipTypeSchema,
} from "./cmp-entity-graph.js";

const CmpMapId = z.string().trim().min(1);

export const CmpEntityMapClientCandidateQuerySchema = z.object({
  q: z.string().trim().min(2).max(50),
});
export type CmpEntityMapClientCandidateQuery = z.infer<
  typeof CmpEntityMapClientCandidateQuerySchema
>;

export const CmpEntityMapClientCandidateSchema = z.object({
  id: z.string(),
  clientCode: z.string(),
  nameZh: z.string(),
  nameEn: z.string().nullable(),
  companyNumber: z.string().nullable(),
  status: z.string(),
  boundMap: z
    .object({
      id: z.string(),
      name: z.string(),
      nodeId: z.string(),
    })
    .nullable(),
});
export type CmpEntityMapClientCandidate = z.infer<
  typeof CmpEntityMapClientCandidateSchema
>;

export const CmpEntityMapClientCandidatesSchema = z.object({
  candidates: z.array(CmpEntityMapClientCandidateSchema),
});
export type CmpEntityMapClientCandidates = z.infer<
  typeof CmpEntityMapClientCandidatesSchema
>;

export const CmpEntityMapNodeSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  kind: CmpEntityKindSchema,
  displayName: z.string(),
  companyNumber: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  positionX: z.number(),
  positionY: z.number(),
  clientId: z.string().nullable(),
  clientCode: z.string().nullable(),
  clientStatus: z.string().nullable(),
  pendingAcceptanceId: z.string().nullable(),
  pendingClientCode: z.string().nullable(),
});

export const CmpEntityMapEdgeSchema = z.object({
  id: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string(),
  type: CmpEntityRelationshipTypeSchema,
  ownershipPercentage: z.number().nullable(),
  remarks: z.string().nullable(),
});

export const CmpEntityMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number().int(),
  nodes: z.array(CmpEntityMapNodeSchema),
  edges: z.array(CmpEntityMapEdgeSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CmpEntityMap = z.infer<typeof CmpEntityMapSchema>;

export const CreateCmpEntityMapSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  acceptanceId: z.string().trim().min(1).optional(),
});
export type CreateCmpEntityMapInput = z.infer<typeof CreateCmpEntityMapSchema>;

export const CreateCmpEntityMapNodeSchema = z.object({
  kind: CmpEntityKindSchema,
  displayName: z.string().trim().min(1).max(300),
  companyNumber: z.string().trim().max(100).optional(),
  jurisdiction: z.string().trim().max(100).optional(),
  positionX: z.number().finite(),
  positionY: z.number().finite(),
});
export type CreateCmpEntityMapNodeInput = z.infer<
  typeof CreateCmpEntityMapNodeSchema
>;

export const UpdateCmpEntityMapNodeSchema =
  CreateCmpEntityMapNodeSchema.partial();
export type UpdateCmpEntityMapNodeInput = z.infer<
  typeof UpdateCmpEntityMapNodeSchema
>;

export const CreateCmpEntityMapEdgeSchema = z.object({
  fromNodeId: z.string().trim().min(1),
  toNodeId: z.string().trim().min(1),
  type: CmpEntityRelationshipTypeSchema,
  ownershipPercentage: z.number().min(0).max(100).optional(),
  remarks: z.string().trim().max(2000).optional(),
});
export type CreateCmpEntityMapEdgeInput = z.infer<
  typeof CreateCmpEntityMapEdgeSchema
>;

export const UpdateCmpEntityMapEdgeSchema = CreateCmpEntityMapEdgeSchema.omit({
  fromNodeId: true,
  toNodeId: true,
}).partial();
export type UpdateCmpEntityMapEdgeInput = z.infer<
  typeof UpdateCmpEntityMapEdgeSchema
>;

export const BindCmpEntityMapNodeClientSchema = z.object({
  clientCode: z.string().trim().min(1).max(50),
});
export type BindCmpEntityMapNodeClientInput = z.infer<
  typeof BindCmpEntityMapNodeClientSchema
>;

export const AttachCmpEntityMapDraftSchema = z.object({
  acceptanceId: z.string().trim().min(1),
  clientCode: z.string().trim().min(1).max(50),
  displayName: z.string().trim().min(1).max(300),
  companyNumber: z.string().trim().max(100).optional(),
  jurisdiction: z.string().trim().max(100).optional(),
  positionX: z.number().finite().optional(),
  positionY: z.number().finite().optional(),
});
export type AttachCmpEntityMapDraftInput = z.infer<
  typeof AttachCmpEntityMapDraftSchema
>;

export const CmpEntityMapReferenceSchema = z.object({
  choice: z.enum(["YES", "NO"]).nullable().optional(),
  mapId: CmpMapId.optional(),
  nodeId: z.string().trim().optional(),
});
export type CmpEntityMapReference = z.infer<typeof CmpEntityMapReferenceSchema>;
