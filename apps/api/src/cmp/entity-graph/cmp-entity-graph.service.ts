import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CmpEntityKind } from "@prisma/client";
import {
  CmpClientGraphSchema,
  CmpCompanyIdentityMatchResponseSchema,
  CmpEntityRelationshipsResponseSchema,
  CmpGroupRelationshipsResponseSchema,
  CmpRelatedEntitiesResponseSchema,
  classifyCmpRelationshipConflict,
  isCmpRelationshipEndpointCompatible,
} from "@project-wing/shared/cmp-entity-graph";
import type {
  CmpEntityRelationshipDraft,
  CmpGroupRelationshipDraft,
  CmpRelatedEntityDraft,
  CmpRelationshipCompatibilityRecord,
  CreateCmpEntityRelationshipInput,
  CreateCmpGroupRelationshipInput,
  CreateCmpRelatedEntityInput,
  UpdateCmpEntityRelationshipInput,
  UpdateCmpGroupRelationshipInput,
  UpdateCmpRelatedEntityInput,
} from "@project-wing/shared/cmp-entity-graph";
import {
  CmpEntityMapClientCandidatesSchema,
  CmpEntityMapSchema,
} from "@project-wing/shared/cmp-entity-maps";
import type {
  AttachCmpEntityMapDraftInput,
  BindCmpEntityMapNodeClientInput,
  CmpEntityMapClientCandidateQuery,
  CreateCmpEntityMapEdgeInput,
  CreateCmpEntityMapInput,
  CreateCmpEntityMapNodeInput,
  UpdateCmpEntityMapEdgeInput,
  UpdateCmpEntityMapNodeInput,
} from "@project-wing/shared/cmp-entity-maps";

import { AuditLogsService } from "../../audit-logs/audit-logs.service";
import type { RequestUser } from "../../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../../common/api-error";
import { PrismaService } from "../../prisma/prisma.service";

type Db = Prisma.TransactionClient | PrismaService;
const MAP_EDITOR_ROLES = new Set(["SUPER_ADMIN", "MANAGER", "PARTNER"]);
const EDITABLE_DRAFT_STATUSES = new Set(["DRAFT", "RETURNED", "STAFF_EDITING"]);
@Injectable()
export class CmpEntityGraphService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs?: AuditLogsService
  ) {}

  async findCompanyIdentityMatch(input: {
    identifierType: string;
    identifierValue: string;
  }) {
    const entity = await findCompanyByIdentity(this.prisma, input);
    if (!entity) {
      return CmpCompanyIdentityMatchResponseSchema.parse({ match: null });
    }
    const scopes = await this.prisma.cmpClientEntityScope.findMany({
      where: { entityId: entity.id },
      select: {
        clientId: true,
        role: true,
      },
    });
    const clients =
      scopes.length > 0
        ? await this.prisma.cmpClient.findMany({
            where: { id: { in: scopes.map((scope) => scope.clientId) } },
            select: {
              id: true,
              clientCode: true,
              nameEn: true,
              nameZh: true,
            },
            orderBy: { clientCode: "asc" },
          })
        : [];
    const roleByClientId = new Map(
      scopes.map((scope) => [scope.clientId, scope.role])
    );
    return CmpCompanyIdentityMatchResponseSchema.parse({
      match: {
        entity: formatEntity(entity, "RELATED"),
        clients: clients.map((client) => ({
          ...client,
          role: roleByClientId.get(client.id) ?? "RELATED",
        })),
      },
    });
  }

  async listMaps() {
    const maps = await this.prisma.cmpEntityMap.findMany({
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      include: mapInclude,
    });
    return {
      maps: await Promise.all(maps.map((map) => formatMap(this.prisma, map))),
    };
  }

  async getMap(id: string) {
    return formatMap(this.prisma, await this.requireMap(id));
  }

  async findClientCandidates(input: CmpEntityMapClientCandidateQuery) {
    const clients = await this.prisma.cmpClient.findMany({
      where: {
        clientCode: { contains: input.q, mode: "insensitive" },
      },
      orderBy: { clientCode: "asc" },
      take: 10,
      select: {
        id: true,
        clientCode: true,
        nameZh: true,
        nameEn: true,
        companyNumber: true,
        status: true,
      },
    });
    if (clients.length === 0) {
      return { candidates: [] };
    }

    const rootScopes = await this.prisma.cmpClientEntityScope.findMany({
      where: {
        clientId: { in: clients.map((client) => client.id) },
        role: "ROOT",
      },
      select: { clientId: true, entityId: true },
    });
    const nodes =
      rootScopes.length > 0
        ? await this.prisma.cmpEntityMapNode.findMany({
            where: {
              entityId: { in: rootScopes.map((scope) => scope.entityId) },
            },
            select: {
              id: true,
              entityId: true,
              map: { select: { id: true, name: true } },
            },
          })
        : [];
    const nodeByEntity = new Map(nodes.map((node) => [node.entityId, node]));
    const scopeByClientId = new Map(
      rootScopes.map((scope) => [scope.clientId, scope])
    );

    return CmpEntityMapClientCandidatesSchema.parse({
      candidates: clients.map((client) => {
        const node = nodeByEntity.get(
          scopeByClientId.get(client.id)?.entityId ?? ""
        );
        return {
          ...client,
          boundMap: node
            ? { id: node.map.id, name: node.map.name, nodeId: node.id }
            : null,
        };
      }),
    });
  }

  async createMap(input: CreateCmpEntityMapInput, user: RequestUser) {
    await this.assertCanCreateMap(user, input.acceptanceId);
    const map = await this.prisma.cmpEntityMap.create({
      data: {
        name: input.name,
        description: normalize(input.description),
        createdById: user.id,
        updatedById: user.id,
      },
      include: mapInclude,
    });
    await this.audit(
      user,
      "CMP_ENTITY_MAP_CREATED",
      "CMP_ENTITY_MAP",
      map.id,
      `Created map ${map.name}`
    );
    return formatMap(this.prisma, map);
  }

  async createNode(
    mapId: string,
    input: CreateCmpEntityMapNodeInput,
    user: RequestUser
  ) {
    await this.assertCanEditMap(mapId, user);
    const map = await this.prisma.$transaction(async (tx) => {
      const entity = await tx.cmpEntity.create({
        data: {
          kind: input.kind as CmpEntityKind,
          displayName: input.displayName,
          registrationNumber: normalize(input.companyNumber),
          jurisdiction: normalize(input.jurisdiction),
        },
      });
      await tx.cmpEntityMapNode.create({
        data: {
          mapId,
          entityId: entity.id,
          positionX: input.positionX,
          positionY: input.positionY,
          displayNameOverride: input.displayName,
          companyNumberOverride: normalize(input.companyNumber),
          jurisdictionOverride: normalize(input.jurisdiction),
        },
      });
      return touchMap(tx, mapId, user.id);
    });
    await this.audit(
      user,
      "CMP_ENTITY_MAP_NODE_CREATED",
      "CMP_ENTITY_MAP",
      mapId,
      `Added entity to map ${mapId}`
    );
    return formatMap(this.prisma, map);
  }

  async updateNode(
    mapId: string,
    nodeId: string,
    input: UpdateCmpEntityMapNodeInput,
    user: RequestUser
  ) {
    await this.assertCanEditMap(mapId, user);
    const map = await this.prisma.$transaction(async (tx) => {
      const node = await tx.cmpEntityMapNode.findFirst({
        where: { id: nodeId, mapId },
      });
      if (!node) {
        throw new ApiNotFoundException("NOT_FOUND", "Map node was not found");
      }
      await tx.cmpEntityMapNode.update({
        where: { id: nodeId },
        data: {
          ...(input.positionX === undefined
            ? {}
            : { positionX: input.positionX }),
          ...(input.positionY === undefined
            ? {}
            : { positionY: input.positionY }),
          ...(input.displayName === undefined
            ? {}
            : { displayNameOverride: input.displayName }),
          ...(input.companyNumber === undefined
            ? {}
            : { companyNumberOverride: normalize(input.companyNumber) }),
          ...(input.jurisdiction === undefined
            ? {}
            : { jurisdictionOverride: normalize(input.jurisdiction) }),
        },
      });
      return touchMap(tx, mapId, user.id);
    });
    await this.audit(
      user,
      "CMP_ENTITY_MAP_NODE_UPDATED",
      "CMP_ENTITY_MAP_NODE",
      nodeId,
      "Updated map node"
    );
    return formatMap(this.prisma, map);
  }

  async createEdge(
    mapId: string,
    input: CreateCmpEntityMapEdgeInput,
    user: RequestUser
  ) {
    await this.assertCanEditMap(mapId, user);
    const map = await this.prisma.$transaction(async (tx) => {
      const nodes = await tx.cmpEntityMapNode.findMany({
        where: { mapId, id: { in: [input.fromNodeId, input.toNodeId] } },
      });
      if (nodes.length !== 2 || input.fromNodeId === input.toNodeId) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "Select two different nodes from this map"
        );
      }
      const byId = new Map(nodes.map((node) => [node.id, node]));
      await tx.cmpEntityRelationship.create({
        data: {
          legacyMapId: mapId,
          fromEntityId: assertPresentValue(byId.get(input.fromNodeId)).entityId,
          toEntityId: assertPresentValue(byId.get(input.toNodeId)).entityId,
          type: input.type,
          ownershipPercentage: input.ownershipPercentage,
          remarks: normalize(input.remarks),
          createdById: user.id,
        },
      });
      return touchMap(tx, mapId, user.id);
    });
    await this.audit(
      user,
      "CMP_ENTITY_MAP_EDGE_CREATED",
      "CMP_ENTITY_MAP",
      mapId,
      "Added map relationship"
    );
    return formatMap(this.prisma, map);
  }

  async updateEdge(
    mapId: string,
    edgeId: string,
    input: UpdateCmpEntityMapEdgeInput,
    user: RequestUser
  ) {
    await this.assertCanEditMap(mapId, user);
    const map = await this.prisma.$transaction(async (tx) => {
      const edge = await tx.cmpEntityRelationship.findFirst({
        where: { id: edgeId, legacyMapId: mapId },
      });
      if (!edge) {
        throw new ApiNotFoundException(
          "NOT_FOUND",
          "Map relationship was not found"
        );
      }
      await tx.cmpEntityRelationship.update({
        where: { id: edgeId },
        data: {
          ...(input.type === undefined ? {} : { type: input.type }),
          ...(input.ownershipPercentage === undefined
            ? {}
            : { ownershipPercentage: input.ownershipPercentage }),
          ...(input.remarks === undefined
            ? {}
            : { remarks: normalize(input.remarks) }),
        },
      });
      return touchMap(tx, mapId, user.id);
    });
    await this.audit(
      user,
      "CMP_ENTITY_MAP_EDGE_UPDATED",
      "CMP_ENTITY_MAP_EDGE",
      edgeId,
      "Updated map relationship"
    );
    return formatMap(this.prisma, map);
  }

  async attachDraft(
    mapId: string,
    input: AttachCmpEntityMapDraftInput,
    user: RequestUser
  ) {
    await this.assertCanEditAcceptance(input.acceptanceId, user);
    const map = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.cmpEntityMapNode.findUnique({
        where: { pendingAcceptanceId: input.acceptanceId },
      });
      if (existing && existing.mapId !== mapId) {
        throw new ApiConflictException(
          "CONFLICT_RISK",
          "This Client draft is already attached to another map"
        );
      }
      if (existing) {
        await tx.cmpEntityMapNode.update({
          where: { id: existing.id },
          data: {
            pendingClientCode: input.clientCode,
            displayNameOverride: input.displayName,
            companyNumberOverride: normalize(input.companyNumber),
            jurisdictionOverride: normalize(input.jurisdiction),
          },
        });
        return touchMap(tx, mapId, user.id);
      }
      const entity = await tx.cmpEntity.create({
        data: {
          kind: "COMPANY",
          displayName: input.displayName,
          registrationNumber: normalize(input.companyNumber),
          jurisdiction: normalize(input.jurisdiction),
        },
      });
      await tx.cmpEntityMapNode.create({
        data: {
          mapId,
          entityId: entity.id,
          positionX: input.positionX ?? 220,
          positionY: input.positionY ?? 180,
          displayNameOverride: input.displayName,
          companyNumberOverride: normalize(input.companyNumber),
          jurisdictionOverride: normalize(input.jurisdiction),
          pendingAcceptanceId: input.acceptanceId,
          pendingClientCode: input.clientCode,
        },
      });
      return touchMap(tx, mapId, user.id);
    });
    await this.audit(
      user,
      "CMP_ENTITY_MAP_DRAFT_ATTACHED",
      "CMP_ENTITY_MAP",
      mapId,
      `Attached Client Acceptance ${input.acceptanceId}`
    );
    return formatMap(this.prisma, map);
  }

  async bindNodeClient(
    mapId: string,
    nodeId: string,
    input: BindCmpEntityMapNodeClientInput,
    user: RequestUser
  ) {
    await this.assertCanEditMap(mapId, user);
    const map = await this.prisma.$transaction(async (tx) => {
      await Promise.resolve();
      return bindNodeToClient(tx, mapId, nodeId, input.clientCode, user.id);
    });
    await this.audit(
      user,
      "CMP_ENTITY_MAP_CLIENT_BOUND",
      "CMP_ENTITY_MAP_NODE",
      nodeId,
      `Bound Client Code ${input.clientCode}`
    );
    return formatMap(this.prisma, map);
  }

  async getClientGraph(clientId: string, asOf?: string) {
    const client = await this.prisma.cmpClient.findUnique({
      where: { id: clientId },
      select: { id: true, clientCode: true },
    });
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
    const snapshotAt = parseSnapshotDate(asOf);
    const scopes = await this.prisma.cmpClientEntityScope.findMany({
      where: { clientId },
      include: {
        entity: { include: { companyProfile: true, personProfile: true } },
      },
      orderBy: [{ role: "asc" }, { entityId: "asc" }],
    });
    const entityIds = scopes.map((scope) => scope.entityId);
    const rootEntityId =
      scopes.find((scope) => scope.role === "ROOT")?.entityId ?? null;
    const [clientRoots, relationships, groupRelationships] =
      entityIds.length > 0
        ? await Promise.all([
            this.prisma.cmpClientEntityScope.findMany({
              where: { entityId: { in: entityIds }, role: "ROOT" },
              select: { clientId: true, entityId: true },
            }),
            this.prisma.cmpEntityRelationship.findMany({
              where: {
                fromEntityId: { in: entityIds },
                toEntityId: { in: entityIds },
                AND: [
                  {
                    OR: [
                      { effectiveFrom: null },
                      { effectiveFrom: { lte: snapshotAt } },
                    ],
                  },
                  {
                    OR: [
                      { effectiveTo: null },
                      { effectiveTo: { gt: snapshotAt } },
                    ],
                  },
                ],
              },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            }),
            this.prisma.cmpGroupRelationship.findMany({
              where: {
                targetEntityId: { in: entityIds },
                participants: {
                  some: {},
                  every: { entityId: { in: entityIds } },
                },
                AND: [
                  {
                    OR: [
                      { effectiveFrom: null },
                      { effectiveFrom: { lte: snapshotAt } },
                    ],
                  },
                  {
                    OR: [
                      { effectiveTo: null },
                      { effectiveTo: { gt: snapshotAt } },
                    ],
                  },
                ],
              },
              include: { participants: { orderBy: { entityId: "asc" } } },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            }),
          ])
        : [[], [], []];
    const clientIdsByEntity = new Map<string, string[]>();
    for (const root of clientRoots) {
      clientIdsByEntity.set(root.entityId, [
        ...(clientIdsByEntity.get(root.entityId) ?? []),
        root.clientId,
      ]);
    }
    return CmpClientGraphSchema.parse({
      client: { id: client.id, clientCode: client.clientCode, rootEntityId },
      asOf: snapshotAt.toISOString().slice(0, 10),
      nodes: scopes.map((scope) => ({
        id: scope.entity.id,
        kind: scope.entity.kind,
        displayName: scope.entity.displayName,
        nameZh: scope.entity.nameZh,
        nameEn: scope.entity.nameEn,
        jurisdiction: scope.entity.jurisdiction,
        registrationNumber: scope.entity.registrationNumber,
        status: scope.entity.status,
        role: scope.role,
        isRoot: scope.entityId === rootEntityId,
        clientIds: clientIdsByEntity.get(scope.entityId) ?? [],
      })),
      edges: relationships.map((relationship) => ({
        id: relationship.id,
        fromEntityId: relationship.fromEntityId,
        toEntityId: relationship.toEntityId,
        type: relationship.type,
        ownershipPercentage:
          relationship.ownershipPercentage === null
            ? null
            : Number(relationship.ownershipPercentage),
        effectiveFrom: relationship.effectiveFrom?.toISOString() ?? null,
        effectiveTo: relationship.effectiveTo?.toISOString() ?? null,
        remarks: relationship.remarks,
        sourceDocument: relationship.sourceDocument,
      })),
      groupRelationships: groupRelationships.map(formatGroupRelationship),
    });
  }

  async listClientEntities(clientId: string) {
    await this.requireClient(clientId);
    const scopes = await this.prisma.cmpClientEntityScope.findMany({
      where: { clientId },
      include: {
        entity: { include: { companyProfile: true, personProfile: true } },
      },
      orderBy: [{ role: "asc" }, { entity: { displayName: "asc" } }],
    });
    return CmpRelatedEntitiesResponseSchema.parse({
      rootEntityId:
        scopes.find((scope) => scope.role === "ROOT")?.entityId ?? null,
      entities: scopes.map(formatScopedEntity),
    });
  }

  async createClientEntity(
    clientId: string,
    input: CreateCmpRelatedEntityInput,
    user: RequestUser
  ) {
    this.assertCanMaintainMasterData(user);
    await this.requireClient(clientId);
    const entity = await this.prisma
      .$transaction(async (tx) => {
        const matched = await findFirmEntity(tx, input);
        const existing = matched
          ? await resolveCompanyIdentityMatch(tx, matched, input)
          : null;
        const master =
          existing ??
          (await tx.cmpEntity.create({
            data: {
              kind: input.kind as CmpEntityKind,
              displayName: input.displayName,
              companyCode: normalize(input.companyCode ?? undefined),
              nameZh: normalize(input.nameZh ?? undefined),
              nameEn: normalize(input.nameEn ?? undefined),
              jurisdiction: normalize(input.jurisdiction ?? undefined),
              registrationNumber: normalize(
                input.companyProfile?.identifierValue ??
                  input.registrationNumber ??
                  undefined
              ),
              incorporationDate: parseOptionalDate(
                input.companyProfile?.incorporationDate
              ),
              dateOfBirth: parseOptionalDate(input.personProfile?.dateOfBirth),
              nationality: normalize(
                input.personProfile?.nationality ?? undefined
              ),
              status: input.status,
              ...(input.companyProfile
                ? {
                    companyProfile: {
                      create: companyProfileData(input.companyProfile),
                    },
                  }
                : {}),
              ...(input.personProfile
                ? {
                    personProfile: {
                      create: personProfileData(input.personProfile),
                    },
                  }
                : {}),
            },
            include: { companyProfile: true, personProfile: true },
          }));
        const scope = await tx.cmpClientEntityScope.upsert({
          where: { clientId_entityId: { clientId, entityId: master.id } },
          update: {},
          create: { clientId, entityId: master.id, role: "RELATED" },
          include: {
            entity: {
              include: { companyProfile: true, personProfile: true },
            },
          },
        });
        return formatScopedEntity(scope);
      })
      .catch(async (error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          input.companyProfile
        ) {
          const matched = await findCompanyByIdentity(
            this.prisma,
            input.companyProfile
          );
          if (matched) {
            throwCompanyIdentityConflict(matched);
          }
        }
        throw error;
      });
    await this.audit(
      user,
      "CMP_RELATED_ENTITY_LINKED",
      "CMP_ENTITY",
      entity.id,
      `Linked firm entity to client ${clientId}`
    );
    return { entity };
  }

  async updateClientEntity(
    clientId: string,
    entityId: string,
    input: UpdateCmpRelatedEntityInput,
    user: RequestUser
  ) {
    this.assertCanMaintainMasterData(user);
    const scope = await this.requireScope(clientId, entityId);
    if (scope.role === "ROOT") {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "The client root subject is maintained from client master data"
      );
    }
    const current = await this.prisma.cmpEntity.findUnique({
      where: { id: entityId },
      select: { kind: true },
    });
    if (!current) {
      throw new ApiNotFoundException("NOT_FOUND", "Firm entity was not found");
    }
    if (input.kind && input.kind !== current.kind) {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "A firm entity kind cannot be changed after creation"
      );
    }
    if (
      (current.kind === "COMPANY" && input.personProfile) ||
      (current.kind === "PERSON" && input.companyProfile)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The profile does not match the firm entity kind"
      );
    }
    if (
      (current.kind === "COMPANY" &&
        (input.status === "DECEASED" || input.status === "UNKNOWN")) ||
      (current.kind === "PERSON" && input.status === "DISSOLVED")
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The status does not match the firm entity kind"
      );
    }
    const entity = await this.prisma.cmpEntity.update({
      where: { id: entityId },
      data: {
        ...(input.kind === undefined
          ? {}
          : { kind: input.kind as CmpEntityKind }),
        ...(input.displayName === undefined
          ? {}
          : { displayName: input.displayName }),
        ...(input.companyCode === undefined
          ? {}
          : { companyCode: normalize(input.companyCode ?? undefined) }),
        ...(input.nameZh === undefined
          ? {}
          : { nameZh: normalize(input.nameZh ?? undefined) }),
        ...(input.nameEn === undefined
          ? {}
          : { nameEn: normalize(input.nameEn ?? undefined) }),
        ...(input.jurisdiction === undefined
          ? {}
          : { jurisdiction: normalize(input.jurisdiction ?? undefined) }),
        ...(input.registrationNumber === undefined
          ? {}
          : {
              registrationNumber: normalize(
                input.registrationNumber ?? undefined
              ),
            }),
        ...(input.companyProfile === undefined || input.companyProfile === null
          ? {}
          : {
              registrationNumber: input.companyProfile.identifierValue,
              incorporationDate: parseOptionalDate(
                input.companyProfile.incorporationDate
              ),
              companyProfile: {
                upsert: {
                  create: companyProfileData(input.companyProfile),
                  update: companyProfileData(input.companyProfile),
                },
              },
            }),
        ...(input.personProfile === undefined || input.personProfile === null
          ? {}
          : {
              dateOfBirth: parseOptionalDate(input.personProfile.dateOfBirth),
              nationality: normalize(
                input.personProfile.nationality ?? undefined
              ),
              personProfile: {
                upsert: {
                  create: personProfileData(input.personProfile),
                  update: personProfileData(input.personProfile),
                },
              },
            }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
      include: { companyProfile: true, personProfile: true },
    });
    await this.audit(
      user,
      "CMP_RELATED_ENTITY_UPDATED",
      "CMP_ENTITY",
      entityId,
      "Updated firm-level entity master data"
    );
    return { entity: formatEntity(entity, scope.role) };
  }

  async removeClientEntity(
    clientId: string,
    entityId: string,
    user: RequestUser
  ) {
    this.assertCanMaintainMasterData(user);
    const scope = await this.requireScope(clientId, entityId);
    if (scope.role === "ROOT") {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "The client root subject cannot be removed"
      );
    }
    const scopedIds = await this.clientEntityIds(clientId);
    const relationship = await this.prisma.cmpEntityRelationship.findFirst({
      where: {
        OR: [
          { fromEntityId: entityId, toEntityId: { in: scopedIds } },
          { toEntityId: entityId, fromEntityId: { in: scopedIds } },
        ],
      },
      select: { id: true },
    });
    const groupRelationship = await this.prisma.cmpGroupRelationship.findFirst({
      where: {
        OR: [
          { targetEntityId: entityId },
          { participants: { some: { entityId } } },
        ],
      },
      select: { id: true },
    });
    if (relationship || groupRelationship) {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "Remove this subject's relationships before unlinking it"
      );
    }
    await this.prisma.cmpClientEntityScope.delete({
      where: { clientId_entityId: { clientId, entityId } },
    });
    return { removed: true };
  }

  async listClientRelationships(clientId: string) {
    const entityIds = await this.clientEntityIds(clientId);
    const relationships = await this.prisma.cmpEntityRelationship.findMany({
      where: {
        fromEntityId: { in: entityIds },
        toEntityId: { in: entityIds },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return CmpEntityRelationshipsResponseSchema.parse({
      relationships: relationships.map(formatRelationship),
    });
  }

  async createClientRelationship(
    clientId: string,
    input: CreateCmpEntityRelationshipInput,
    user: RequestUser
  ) {
    this.assertCanMaintainMasterData(user);
    await this.assertEntitiesInClientScope(clientId, [
      input.fromEntityId,
      input.toEntityId,
    ]);
    await this.assertRelationshipEndpoints({
      fromEntityId: input.fromEntityId,
      toEntityId: input.toEntityId,
      type: input.type,
    });
    const effectiveFrom = parseOptionalDate(input.effectiveFrom);
    const effectiveTo = parseOptionalDate(input.effectiveTo);
    await assertRelationshipCompatibility(this.prisma, {
      fromEntityId: input.fromEntityId,
      toEntityId: input.toEntityId,
      type: input.type,
      ownershipPercentage: input.ownershipPercentage,
      effectiveFrom,
      effectiveTo,
    });
    const relationship = await this.prisma.cmpEntityRelationship.create({
      data: {
        fromEntityId: input.fromEntityId,
        toEntityId: input.toEntityId,
        type: input.type,
        ownershipPercentage: input.ownershipPercentage,
        effectiveFrom,
        effectiveTo,
        sourceDocument: normalize(input.sourceDocument ?? undefined),
        remarks: normalize(input.remarks ?? undefined),
        createdById: user.id,
      },
    });
    return { relationship: formatRelationship(relationship) };
  }

  async updateClientRelationship(
    clientId: string,
    relationshipId: string,
    input: UpdateCmpEntityRelationshipInput,
    user: RequestUser
  ) {
    this.assertCanMaintainMasterData(user);
    const current = await this.requireClientRelationship(
      clientId,
      relationshipId
    );
    const candidate = {
      id: current.id,
      fromEntityId: current.fromEntityId,
      toEntityId: current.toEntityId,
      type: input.type ?? current.type,
      ownershipPercentage:
        input.ownershipPercentage === undefined
          ? current.ownershipPercentage === null
            ? null
            : Number(current.ownershipPercentage)
          : input.ownershipPercentage,
      effectiveFrom:
        input.effectiveFrom === undefined
          ? current.effectiveFrom
          : parseOptionalDate(input.effectiveFrom),
      effectiveTo:
        input.effectiveTo === undefined
          ? current.effectiveTo
          : parseOptionalDate(input.effectiveTo),
    } satisfies CmpRelationshipCompatibilityRecord;
    await this.assertRelationshipEndpoints(candidate);
    await assertRelationshipCompatibility(
      this.prisma,
      candidate,
      relationshipId
    );
    const relationship = await this.prisma.cmpEntityRelationship.update({
      where: { id: relationshipId },
      data: {
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.ownershipPercentage === undefined
          ? {}
          : { ownershipPercentage: input.ownershipPercentage }),
        ...(input.effectiveFrom === undefined
          ? {}
          : { effectiveFrom: parseOptionalDate(input.effectiveFrom) }),
        ...(input.effectiveTo === undefined
          ? {}
          : { effectiveTo: parseOptionalDate(input.effectiveTo) }),
        ...(input.sourceDocument === undefined
          ? {}
          : {
              sourceDocument: normalize(input.sourceDocument ?? undefined),
            }),
        ...(input.remarks === undefined
          ? {}
          : { remarks: normalize(input.remarks ?? undefined) }),
      },
    });
    return { relationship: formatRelationship(relationship) };
  }

  async removeClientRelationship(
    clientId: string,
    relationshipId: string,
    user: RequestUser
  ) {
    this.assertCanMaintainMasterData(user);
    await this.requireClientRelationship(clientId, relationshipId);
    await this.prisma.cmpEntityRelationship.delete({
      where: { id: relationshipId },
    });
    return { removed: true };
  }

  async listClientGroupRelationships(clientId: string) {
    const entityIds = await this.clientEntityIds(clientId);
    const relationships = await this.prisma.cmpGroupRelationship.findMany({
      where: {
        targetEntityId: { in: entityIds },
        participants: {
          some: {},
          every: { entityId: { in: entityIds } },
        },
      },
      include: { participants: { orderBy: { entityId: "asc" } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return CmpGroupRelationshipsResponseSchema.parse({
      relationships: relationships.map(formatGroupRelationship),
    });
  }

  async createClientGroupRelationship(
    clientId: string,
    input: CreateCmpGroupRelationshipInput,
    user: RequestUser
  ) {
    this.assertCanMaintainMasterData(user);
    await this.assertGroupRelationshipInput(clientId, input);
    const relationship = await this.prisma.cmpGroupRelationship.create({
      data: {
        targetEntityId: input.targetEntityId,
        type: input.type,
        effectiveFrom: parseOptionalDate(input.effectiveFrom),
        effectiveTo: parseOptionalDate(input.effectiveTo),
        sourceDocument: normalize(input.sourceDocument ?? undefined),
        remarks: normalize(input.remarks ?? undefined),
        createdById: user.id,
        participants: {
          create: input.participants.map((participant) => ({
            entityId: participant.entityId,
            method: participant.method,
            ownershipPercentage:
              participant.method === "OWNERSHIP"
                ? participant.ownershipPercentage
                : null,
            otherDescription:
              participant.method === "OTHER"
                ? normalize(participant.otherDescription ?? undefined)
                : null,
          })),
        },
      },
      include: { participants: { orderBy: { entityId: "asc" } } },
    });
    return { relationship: formatGroupRelationship(relationship) };
  }

  async updateClientGroupRelationship(
    clientId: string,
    relationshipId: string,
    input: UpdateCmpGroupRelationshipInput,
    user: RequestUser
  ) {
    this.assertCanMaintainMasterData(user);
    const current = await this.requireClientGroupRelationship(
      clientId,
      relationshipId
    );
    const candidate = {
      targetEntityId: input.targetEntityId ?? current.targetEntityId,
      type: input.type ?? current.type,
      participants:
        input.participants ??
        current.participants.map((participant) => ({
          entityId: participant.entityId,
          method: participant.method,
          ownershipPercentage:
            participant.ownershipPercentage === null
              ? null
              : Number(participant.ownershipPercentage),
          otherDescription: participant.otherDescription,
        })),
      effectiveFrom:
        input.effectiveFrom === undefined
          ? (current.effectiveFrom?.toISOString().slice(0, 10) ?? null)
          : input.effectiveFrom,
      effectiveTo:
        input.effectiveTo === undefined
          ? (current.effectiveTo?.toISOString().slice(0, 10) ?? null)
          : input.effectiveTo,
      sourceDocument:
        input.sourceDocument === undefined
          ? current.sourceDocument
          : input.sourceDocument,
      remarks: input.remarks === undefined ? current.remarks : input.remarks,
    };
    await this.assertGroupRelationshipInput(clientId, candidate);
    const relationship = await this.prisma.$transaction(async (tx) => {
      if (input.participants) {
        await tx.cmpGroupRelationshipParticipant.deleteMany({
          where: { relationshipId },
        });
      }
      return tx.cmpGroupRelationship.update({
        where: { id: relationshipId },
        data: {
          targetEntityId: candidate.targetEntityId,
          type: candidate.type,
          effectiveFrom: parseOptionalDate(candidate.effectiveFrom),
          effectiveTo: parseOptionalDate(candidate.effectiveTo),
          sourceDocument: normalize(candidate.sourceDocument ?? undefined),
          remarks: normalize(candidate.remarks ?? undefined),
          ...(input.participants
            ? {
                participants: {
                  create: candidate.participants.map((participant) => ({
                    entityId: participant.entityId,
                    method: participant.method,
                    ownershipPercentage:
                      participant.method === "OWNERSHIP"
                        ? participant.ownershipPercentage
                        : null,
                    otherDescription:
                      participant.method === "OTHER"
                        ? normalize(participant.otherDescription ?? undefined)
                        : null,
                  })),
                },
              }
            : {}),
        },
        include: { participants: { orderBy: { entityId: "asc" } } },
      });
    });
    return { relationship: formatGroupRelationship(relationship) };
  }

  async removeClientGroupRelationship(
    clientId: string,
    relationshipId: string,
    user: RequestUser
  ) {
    this.assertCanMaintainMasterData(user);
    await this.requireClientGroupRelationship(clientId, relationshipId);
    await this.prisma.cmpGroupRelationship.delete({
      where: { id: relationshipId },
    });
    return { removed: true };
  }

  private assertCanMaintainMasterData(user: RequestUser) {
    if (!MAP_EDITOR_ROLES.has(user.globalRole)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only CMP master-data maintainers can edit related parties"
      );
    }
  }

  private async requireClient(clientId: string) {
    const client = await this.prisma.cmpClient.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
    return client;
  }

  private async requireScope(clientId: string, entityId: string) {
    const scope = await this.prisma.cmpClientEntityScope.findUnique({
      where: { clientId_entityId: { clientId, entityId } },
    });
    if (!scope) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Related party was not found for this client"
      );
    }
    return scope;
  }

  private async clientEntityIds(clientId: string) {
    await this.requireClient(clientId);
    const scopes = await this.prisma.cmpClientEntityScope.findMany({
      where: { clientId },
      select: { entityId: true },
    });
    return scopes.map((scope) => scope.entityId);
  }

  private async assertEntitiesInClientScope(
    clientId: string,
    entityIds: string[]
  ) {
    const uniqueIds = [...new Set(entityIds)];
    const count = await this.prisma.cmpClientEntityScope.count({
      where: { clientId, entityId: { in: uniqueIds } },
    });
    if (count !== uniqueIds.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Both subjects must be visible in this client"
      );
    }
  }

  private async assertRelationshipEndpoints(relationship: {
    fromEntityId: string;
    toEntityId: string;
    type: CmpRelationshipCompatibilityRecord["type"];
  }) {
    const entities = await this.prisma.cmpEntity.findMany({
      where: {
        id: { in: [relationship.fromEntityId, relationship.toEntityId] },
      },
      select: { id: true, kind: true },
    });
    const kindById = new Map(
      entities.map((entity) => [entity.id, entity.kind])
    );
    const fromKind = kindById.get(relationship.fromEntityId);
    const toKind = kindById.get(relationship.toEntityId);
    if (
      !fromKind ||
      !toKind ||
      !isCmpRelationshipEndpointCompatible(relationship.type, fromKind, toKind)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The selected subjects are not valid for this relationship type"
      );
    }
  }

  private async requireClientRelationship(
    clientId: string,
    relationshipId: string
  ) {
    const entityIds = await this.clientEntityIds(clientId);
    const relationship = await this.prisma.cmpEntityRelationship.findFirst({
      where: {
        id: relationshipId,
        fromEntityId: { in: entityIds },
        toEntityId: { in: entityIds },
      },
    });
    if (!relationship) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Subject relationship was not found for this client"
      );
    }
    return relationship;
  }

  private async requireClientGroupRelationship(
    clientId: string,
    relationshipId: string
  ) {
    const entityIds = await this.clientEntityIds(clientId);
    const relationship = await this.prisma.cmpGroupRelationship.findFirst({
      where: {
        id: relationshipId,
        targetEntityId: { in: entityIds },
        participants: {
          some: {},
          every: { entityId: { in: entityIds } },
        },
      },
      include: { participants: { orderBy: { entityId: "asc" } } },
    });
    if (!relationship) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Group relationship was not found for this client"
      );
    }
    return relationship;
  }

  private async assertGroupRelationshipInput(
    clientId: string,
    input: {
      targetEntityId: string;
      participants: Array<{
        entityId: string;
        method: "OWNERSHIP" | "OTHER";
        ownershipPercentage?: number | null;
        otherDescription?: string | null;
      }>;
    }
  ) {
    const participantIds = input.participants.map(
      (participant) => participant.entityId
    );
    if (participantIds.length === 0) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "At least one group relationship participant is required"
      );
    }
    if (new Set(participantIds).size !== participantIds.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Each group relationship participant must be unique"
      );
    }
    if (participantIds.includes(input.targetEntityId)) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The target cannot be a group relationship participant"
      );
    }
    await this.assertEntitiesInClientScope(clientId, [
      input.targetEntityId,
      ...participantIds,
    ]);
    const entities = await this.prisma.cmpEntity.findMany({
      where: { id: { in: [input.targetEntityId, ...participantIds] } },
      select: { id: true, kind: true },
    });
    if (
      entities.length !== participantIds.length + 1 ||
      entities.some((entity) => entity.kind !== "COMPANY")
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Group relationship targets and participants must be companies"
      );
    }
    for (const participant of input.participants) {
      if (participant.method === "OTHER") {
        if (!normalize(participant.otherDescription ?? undefined)) {
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "A description is required for an other relationship method"
          );
        }
        if (
          participant.ownershipPercentage !== null &&
          participant.ownershipPercentage !== undefined
        ) {
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "Other relationship methods cannot have an ownership percentage"
          );
        }
      }
    }
  }

  private async requireMap(id: string) {
    const map = await this.prisma.cmpEntityMap.findUnique({
      where: { id },
      include: mapInclude,
    });
    if (!map) {
      throw new ApiNotFoundException("NOT_FOUND", "Map was not found");
    }
    return map;
  }
  private async assertCanCreateMap(user: RequestUser, acceptanceId?: string) {
    await Promise.resolve();
    if (MAP_EDITOR_ROLES.has(user.globalRole)) {
      return;
    }
    if (acceptanceId) {
      return this.assertCanEditAcceptance(acceptanceId, user);
    }
    throw new ApiForbiddenException(
      "FORBIDDEN",
      "Only CMP map maintainers can create a map"
    );
  }
  private async assertCanEditMap(mapId: string, user: RequestUser) {
    if (MAP_EDITOR_ROLES.has(user.globalRole)) {
      return;
    }
    const node = await this.prisma.cmpEntityMapNode.findFirst({
      where: { mapId, pendingAcceptanceId: { not: null } },
      select: { pendingAcceptanceId: true },
    });
    if (node?.pendingAcceptanceId) {
      return this.assertCanEditAcceptance(node.pendingAcceptanceId, user);
    }
    throw new ApiForbiddenException("FORBIDDEN", "You cannot edit this map");
  }
  private async assertCanEditAcceptance(id: string, user: RequestUser) {
    if (MAP_EDITOR_ROLES.has(user.globalRole)) {
      return;
    }
    const request = await this.prisma.cmpAcceptanceRequest.findUnique({
      where: { id },
      select: { draftAssigneeId: true, submittedById: true, status: true },
    });
    if (!request) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Acceptance request was not found"
      );
    }
    if (
      EDITABLE_DRAFT_STATUSES.has(request.status) &&
      (request.draftAssigneeId === user.id || request.submittedById === user.id)
    ) {
      return;
    }
    throw new ApiForbiddenException(
      "FORBIDDEN",
      "Only the assigned Client draft Staff member can edit this map"
    );
  }
  private audit(
    user: RequestUser,
    action: string,
    targetType: string,
    targetId: string,
    description: string
  ) {
    return this.auditLogs?.log({
      actorId: user.id,
      action,
      targetType,
      targetId,
      description,
    });
  }
}

const mapInclude = {
  nodes: { include: { entity: true }, orderBy: { createdAt: "asc" } },
  edges: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CmpEntityMapInclude;
async function formatMap(
  db: Db,
  map: Prisma.CmpEntityMapGetPayload<{ include: typeof mapInclude }>
) {
  const nodeByEntity = new Map(map.nodes.map((node) => [node.entityId, node]));
  const rootScopes = await db.cmpClientEntityScope.findMany({
    where: {
      entityId: { in: map.nodes.map((node) => node.entityId) },
      role: "ROOT",
    },
    select: { entityId: true, clientId: true },
  });
  const clients =
    rootScopes.length > 0
      ? await db.cmpClient.findMany({
          where: { id: { in: rootScopes.map((scope) => scope.clientId) } },
          select: { id: true, clientCode: true, status: true },
        })
      : [];
  const clientByEntity = new Map(
    rootScopes.map((scope) => [
      scope.entityId,
      clients.find((client) => client.id === scope.clientId),
    ])
  );
  return CmpEntityMapSchema.parse({
    id: map.id,
    name: map.name,
    description: map.description,
    version: map.version,
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
    nodes: map.nodes.map((node) => {
      const client = clientByEntity.get(node.entityId);
      return {
        id: node.id,
        entityId: node.entityId,
        kind: node.entity.kind,
        displayName: node.displayNameOverride ?? node.entity.displayName,
        companyNumber:
          node.companyNumberOverride ?? node.entity.registrationNumber,
        jurisdiction: node.jurisdictionOverride ?? node.entity.jurisdiction,
        positionX: node.positionX,
        positionY: node.positionY,
        clientId: client?.id ?? null,
        clientCode: client?.clientCode ?? null,
        clientStatus: client?.status ?? null,
        pendingAcceptanceId: node.pendingAcceptanceId,
        pendingClientCode: node.pendingClientCode,
      };
    }),
    edges: map.edges.flatMap((edge) => {
      const from = nodeByEntity.get(edge.fromEntityId);
      const to = nodeByEntity.get(edge.toEntityId);
      return from && to
        ? [
            {
              id: edge.id,
              fromNodeId: from.id,
              toNodeId: to.id,
              type: edge.type,
              ownershipPercentage:
                edge.ownershipPercentage === null
                  ? null
                  : Number(edge.ownershipPercentage),
              remarks: edge.remarks,
            },
          ]
        : [];
    }),
  });
}
async function touchMap(db: Db, mapId: string, userId: string) {
  await Promise.resolve();
  return db.cmpEntityMap.update({
    where: { id: mapId },
    data: { version: { increment: 1 }, updatedById: userId },
    include: mapInclude,
  });
}
function normalize(value?: string) {
  const result = value?.trim();
  return result || null;
}

function canonicalCompanyIdentifierType(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "CR_NUMBER") {
    return "COMPANY_REGISTRATION_NUMBER";
  }
  if (normalized === "BR_NUMBER") {
    return "BUSINESS_REGISTRATION_NUMBER";
  }
  return normalized;
}
function parseSnapshotDate(asOf?: string) {
  const value = asOf ? `${asOf}T23:59:59.999Z` : new Date().toISOString();
  const snapshotAt = new Date(value);
  if (Number.isNaN(snapshotAt.getTime())) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Graph snapshot date is invalid"
    );
  }
  return snapshotAt;
}

function parseOptionalDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function companyProfileData(
  profile: NonNullable<CreateCmpRelatedEntityInput["companyProfile"]>
) {
  return {
    identifierType: canonicalCompanyIdentifierType(profile.identifierType),
    identifierValue: profile.identifierValue,
    incorporationDate: assertPresentValue(
      parseOptionalDate(profile.incorporationDate)
    ),
    companyType: profile.companyType,
    industryClassification: normalize(
      profile.industryClassification ?? undefined
    ),
    registeredAddress: profile.registeredAddress,
    principalBusinessAddress: normalize(
      profile.principalBusinessAddress ?? undefined
    ),
  };
}

function personProfileData(
  profile: NonNullable<CreateCmpRelatedEntityInput["personProfile"]>
) {
  return {
    dateOfBirth: parseOptionalDate(profile.dateOfBirth),
    identifierType: normalize(profile.identifierType ?? undefined),
    identifierValue: normalize(profile.identifierValue ?? undefined),
    nationality: normalize(profile.nationality ?? undefined),
    residenceJurisdiction: normalize(
      profile.residenceJurisdiction ?? undefined
    ),
    correspondenceAddress: normalize(
      profile.correspondenceAddress ?? undefined
    ),
  };
}

type EntityWithProfiles = Prisma.CmpEntityGetPayload<{
  include: { companyProfile: true; personProfile: true };
}>;

function formatEntity(entity: EntityWithProfiles, role: "ROOT" | "RELATED") {
  return {
    id: entity.id,
    role,
    kind: entity.kind,
    displayName: entity.displayName,
    companyCode: entity.companyCode,
    nameZh: entity.nameZh,
    nameEn: entity.nameEn,
    jurisdiction: entity.jurisdiction,
    registrationNumber: entity.registrationNumber,
    status: entity.status,
    companyProfile: entity.companyProfile
      ? {
          identifierType: entity.companyProfile.identifierType,
          identifierValue: entity.companyProfile.identifierValue,
          incorporationDate:
            entity.companyProfile.incorporationDate
              ?.toISOString()
              .slice(0, 10) ?? null,
          companyType: entity.companyProfile.companyType,
          industryClassification: entity.companyProfile.industryClassification,
          registeredAddress: entity.companyProfile.registeredAddress,
          principalBusinessAddress:
            entity.companyProfile.principalBusinessAddress,
        }
      : null,
    personProfile: entity.personProfile
      ? {
          dateOfBirth:
            entity.personProfile.dateOfBirth?.toISOString().slice(0, 10) ??
            null,
          identifierType: entity.personProfile.identifierType,
          identifierValue: entity.personProfile.identifierValue,
          nationality: entity.personProfile.nationality,
          residenceJurisdiction: entity.personProfile.residenceJurisdiction,
          correspondenceAddress: entity.personProfile.correspondenceAddress,
        }
      : null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function formatScopedEntity(scope: {
  role: "ROOT" | "RELATED";
  entity: EntityWithProfiles;
}) {
  return formatEntity(scope.entity, scope.role);
}

function relationshipCompatibilityRecord(relationship: {
  id?: string;
  fromEntityId: string;
  toEntityId: string;
  type: CmpRelationshipCompatibilityRecord["type"];
  ownershipPercentage: Prisma.Decimal | number | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
}): CmpRelationshipCompatibilityRecord {
  return {
    id: relationship.id,
    fromEntityId: relationship.fromEntityId,
    toEntityId: relationship.toEntityId,
    type: relationship.type,
    ownershipPercentage:
      relationship.ownershipPercentage === null
        ? null
        : Number(relationship.ownershipPercentage),
    effectiveFrom: relationship.effectiveFrom,
    effectiveTo: relationship.effectiveTo,
  };
}

async function assertRelationshipCompatibility(
  db: Db,
  candidate: CmpRelationshipCompatibilityRecord,
  excludeId?: string
) {
  const existing = await db.cmpEntityRelationship.findMany({
    where: {
      type: candidate.type,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      fromEntityId: candidate.fromEntityId,
      toEntityId: candidate.toEntityId,
    },
  });
  for (const relationship of existing) {
    const conflict = classifyCmpRelationshipConflict(
      candidate,
      relationshipCompatibilityRecord(relationship)
    );
    if (!conflict) {
      continue;
    }
    throw new ApiConflictException(
      "CONFLICT_RISK",
      conflict === "CONFLICTING_PERCENTAGES"
        ? "An overlapping relationship of this type has conflicting ownership percentages"
        : "An overlapping relationship of this type already exists"
    );
  }

  if (candidate.type !== "OWNS") {
    return;
  }

  const relatedOwnerships = await db.cmpEntityRelationship.findMany({
    where: {
      type: "OWNS",
      toEntityId: candidate.toEntityId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  const ownershipRecords = [
    candidate,
    ...relatedOwnerships.map(relationshipCompatibilityRecord),
  ];
  const checkpoints = ownershipIntervalCheckpoints(ownershipRecords);
  for (const checkpoint of checkpoints) {
    const active = ownershipRecords.filter((record) =>
      relationshipActiveAt(record, checkpoint)
    );
    const knownPercentage = active.reduce(
      (sum, record) => sum + (record.ownershipPercentage ?? 0),
      0
    );
    if (knownPercentage > 100 + 1e-8) {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "Active ownership percentages for the investee cannot exceed 100%"
      );
    }
    if (
      knownPercentage >= 100 - 1e-8 &&
      active.some((record) => record.ownershipPercentage === null)
    ) {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "An unspecified ownership relationship cannot overlap a fully allocated cap table"
      );
    }
  }
}

function ownershipIntervalCheckpoints(
  records: CmpRelationshipCompatibilityRecord[]
) {
  const finiteStarts = records.flatMap((record) =>
    record.effectiveFrom ? [relationshipDateTime(record.effectiveFrom)] : []
  );
  const hasOpenStart = records.some((record) => !record.effectiveFrom);
  return [
    ...(hasOpenStart ? [Number.NEGATIVE_INFINITY] : []),
    ...[...new Set(finiteStarts)].sort((left, right) => left - right),
  ];
}

function relationshipActiveAt(
  relationship: CmpRelationshipCompatibilityRecord,
  checkpoint: number
) {
  const from = relationship.effectiveFrom
    ? relationshipDateTime(relationship.effectiveFrom)
    : Number.NEGATIVE_INFINITY;
  const to = relationship.effectiveTo
    ? relationshipDateTime(relationship.effectiveTo)
    : Number.POSITIVE_INFINITY;
  return from <= checkpoint && checkpoint <= to;
}

function relationshipDateTime(value: string | Date) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function formatRelationship(
  relationship: Prisma.CmpEntityRelationshipGetPayload<Record<string, never>>
) {
  return {
    id: relationship.id,
    fromEntityId: relationship.fromEntityId,
    toEntityId: relationship.toEntityId,
    type: relationship.type,
    ownershipPercentage:
      relationship.ownershipPercentage === null
        ? null
        : Number(relationship.ownershipPercentage),
    effectiveFrom: relationship.effectiveFrom?.toISOString() ?? null,
    effectiveTo: relationship.effectiveTo?.toISOString() ?? null,
    sourceDocument: relationship.sourceDocument,
    remarks: relationship.remarks,
    createdAt: relationship.createdAt.toISOString(),
    updatedAt: relationship.updatedAt.toISOString(),
  };
}

function formatGroupRelationship(
  relationship: Prisma.CmpGroupRelationshipGetPayload<{
    include: { participants: true };
  }>
) {
  return {
    id: relationship.id,
    targetEntityId: relationship.targetEntityId,
    type: relationship.type,
    effectiveFrom: relationship.effectiveFrom?.toISOString() ?? null,
    effectiveTo: relationship.effectiveTo?.toISOString() ?? null,
    sourceDocument: relationship.sourceDocument,
    remarks: relationship.remarks,
    participants: relationship.participants.map((participant) => ({
      entityId: participant.entityId,
      method: participant.method,
      ownershipPercentage:
        participant.ownershipPercentage === null
          ? null
          : Number(participant.ownershipPercentage),
      otherDescription: participant.otherDescription,
    })),
    createdAt: relationship.createdAt.toISOString(),
    updatedAt: relationship.updatedAt.toISOString(),
  };
}

async function findFirmEntity(
  tx: Prisma.TransactionClient,
  input: CreateCmpRelatedEntityInput
) {
  const registrationNumber = normalize(
    input.companyProfile?.identifierValue ??
      input.registrationNumber ??
      undefined
  );
  const jurisdiction = normalize(input.jurisdiction ?? undefined);
  if (input.companyProfile) {
    const profiled = await findCompanyByIdentity(tx, input.companyProfile);
    if (profiled) {
      return profiled;
    }
  }
  // Person identity resolution is intentionally deferred. Never silently
  // Merge people from identity fields until the dedicated policy exists.
  if (input.kind === "PERSON") {
    return null;
  }
  if (!registrationNumber || !jurisdiction) {
    return null;
  }
  return tx.cmpEntity.findFirst({
    where: {
      kind: input.kind as CmpEntityKind,
      registrationNumber: {
        equals: registrationNumber,
        mode: "insensitive",
      },
      jurisdiction: { equals: jurisdiction, mode: "insensitive" },
    },
    include: { companyProfile: true, personProfile: true },
  });
}

async function findCompanyByIdentity(
  tx: Db,
  input: { identifierType: string; identifierValue: string }
) {
  const identifierType = canonicalCompanyIdentifierType(input.identifierType);
  const profiled = await tx.cmpEntity.findFirst({
    where: {
      kind: "COMPANY",
      companyProfile: {
        is: {
          identifierType: {
            equals: identifierType,
            mode: "insensitive",
          },
          identifierValue: {
            equals: input.identifierValue.trim(),
            mode: "insensitive",
          },
        },
      },
    },
    include: { companyProfile: true, personProfile: true },
  });
  if (profiled) {
    return profiled;
  }
  return tx.cmpEntity.findFirst({
    where: {
      kind: "COMPANY",
      registrationNumber: {
        equals: input.identifierValue.trim(),
        mode: "insensitive",
      },
      companyProfile: null,
    },
    include: { companyProfile: true, personProfile: true },
  });
}

async function resolveCompanyIdentityMatch(
  tx: Prisma.TransactionClient,
  matched: EntityWithProfiles,
  input: CreateCmpRelatedEntityInput
) {
  await Promise.resolve();
  const resolution = input.companyIdentityResolution;
  if (!resolution) {
    throwCompanyIdentityConflict(matched);
  }
  if (resolution.entityId !== matched.id) {
    throw new ApiConflictException(
      "ENTITY_IDENTITY_CONFLICT",
      "The matching company changed. Review the latest company record."
    );
  }
  if (resolution.expectedUpdatedAt !== matched.updatedAt.toISOString()) {
    throw new ApiConflictException(
      "ENTITY_IDENTITY_CONFLICT",
      "The matching company was updated. Review the latest company record."
    );
  }
  if (resolution.action === "LINK_EXISTING") {
    if (!matched.companyProfile && input.companyProfile) {
      return tx.cmpEntity.update({
        where: { id: matched.id },
        data: {
          registrationNumber: input.companyProfile.identifierValue,
          companyProfile: { create: companyProfileData(input.companyProfile) },
        },
        include: { companyProfile: true, personProfile: true },
      });
    }
    return matched;
  }
  return tx.cmpEntity.update({
    where: { id: matched.id },
    data: {
      displayName: input.displayName,
      companyCode: normalize(input.companyCode ?? undefined),
      nameZh: normalize(input.nameZh ?? undefined),
      nameEn: normalize(input.nameEn ?? undefined),
      jurisdiction: normalize(input.jurisdiction ?? undefined),
      registrationNumber: normalize(
        input.companyProfile?.identifierValue ??
          input.registrationNumber ??
          undefined
      ),
      incorporationDate: parseOptionalDate(
        input.companyProfile?.incorporationDate
      ),
      status: input.status,
      ...(input.companyProfile
        ? {
            companyProfile: {
              upsert: {
                create: companyProfileData(input.companyProfile),
                update: companyProfileData(input.companyProfile),
              },
            },
          }
        : {}),
    },
    include: { companyProfile: true, personProfile: true },
  });
}

function throwCompanyIdentityConflict(entity: EntityWithProfiles): never {
  throw new ApiConflictException(
    "ENTITY_IDENTITY_CONFLICT",
    "A company with this identifier already exists.",
    {
      entityId: entity.id,
      entityUpdatedAt: entity.updatedAt.toISOString(),
    }
  );
}

type ProfileBearingEntityInput = Pick<
  CreateCmpRelatedEntityInput,
  "companyProfile" | "personProfile"
>;

async function enrichLegacyEntityProfile(
  tx: Prisma.TransactionClient,
  entity: EntityWithProfiles,
  input: ProfileBearingEntityInput
) {
  await Promise.resolve();
  if (input.companyProfile && !entity.companyProfile) {
    return tx.cmpEntity.update({
      where: { id: entity.id },
      data: {
        registrationNumber: input.companyProfile.identifierValue,
        incorporationDate: parseOptionalDate(
          input.companyProfile.incorporationDate
        ),
        companyProfile: {
          create: companyProfileData(input.companyProfile),
        },
      },
      include: { companyProfile: true, personProfile: true },
    });
  }
  if (input.personProfile && !entity.personProfile) {
    return tx.cmpEntity.update({
      where: { id: entity.id },
      data: {
        dateOfBirth: parseOptionalDate(input.personProfile.dateOfBirth),
        nationality: normalize(input.personProfile.nationality ?? undefined),
        personProfile: { create: personProfileData(input.personProfile) },
      },
      include: { companyProfile: true, personProfile: true },
    });
  }
  return entity;
}

async function bindNodeToClient(
  tx: Prisma.TransactionClient,
  mapId: string,
  nodeId: string,
  rawCode: string,
  userId: string
) {
  const node = await tx.cmpEntityMapNode.findFirst({
    where: { id: nodeId, mapId },
    include: { entity: true },
  });
  if (!node) {
    throw new ApiNotFoundException("NOT_FOUND", "Map node was not found");
  }
  const client = await tx.cmpClient.findFirst({
    where: { clientCode: { equals: rawCode.trim(), mode: "insensitive" } },
    select: { id: true, clientCode: true },
  });
  if (!client) {
    throw new ApiNotFoundException(
      "NOT_FOUND",
      "No formal Client matches this Client Code"
    );
  }
  const root = await tx.cmpClientEntityScope.findFirst({
    where: { clientId: client.id, role: "ROOT" },
    select: { entityId: true },
  });
  if (!root) {
    throw new ApiConflictException(
      "CONFLICT_RISK",
      "The selected Client does not have a root entity"
    );
  }
  const existingNode = await tx.cmpEntityMapNode.findFirst({
    where: { entityId: root.entityId },
    select: { id: true, mapId: true },
  });
  if (existingNode && existingNode.id !== nodeId) {
    throw new ApiConflictException(
      "CONFLICT_RISK",
      `Client is already bound in map ${existingNode.mapId}`
    );
  }
  if (node.entityId !== root.entityId) {
    const edges = await tx.cmpEntityRelationship.findMany({
      where: {
        legacyMapId: mapId,
        OR: [{ fromEntityId: node.entityId }, { toEntityId: node.entityId }],
      },
      select: { id: true, fromEntityId: true, toEntityId: true },
    });
    for (const edge of edges) {
      await tx.cmpEntityRelationship.update({
        where: { id: edge.id },
        data: {
          fromEntityId:
            edge.fromEntityId === node.entityId
              ? root.entityId
              : edge.fromEntityId,
          toEntityId:
            edge.toEntityId === node.entityId ? root.entityId : edge.toEntityId,
        },
      });
    }
    await tx.cmpEntityMapNode.update({
      where: { id: node.id },
      data: {
        entityId: root.entityId,
        displayNameOverride:
          node.displayNameOverride ?? node.entity.displayName,
        companyNumberOverride:
          node.companyNumberOverride ?? node.entity.registrationNumber,
        jurisdictionOverride:
          node.jurisdictionOverride ?? node.entity.jurisdiction,
        pendingAcceptanceId: null,
        pendingClientCode: null,
      },
    });
    await tx.cmpEntity.delete({ where: { id: node.entityId } }).catch(() => {});
  }
  return touchMap(tx, mapId, userId);
}

export async function materializeCmpEntityMapDraft(
  tx: Prisma.TransactionClient,
  acceptanceId: string,
  clientId: string,
  actorId: string
) {
  // Keep the existing acceptance transaction compatible with older focused
  // Test doubles that predate Entity Maps. Production Prisma clients always
  // Expose this delegate after the accompanying migration is applied.
  if (!tx.cmpEntityMapNode) {
    return;
  }
  const node = await tx.cmpEntityMapNode.findUnique({
    where: { pendingAcceptanceId: acceptanceId },
    include: { entity: true },
  });
  if (!node) {
    return;
  }
  const client = await tx.cmpClient.findUnique({
    where: { id: clientId },
    select: { clientCode: true },
  });
  if (!client) {
    return;
  }
  await bindNodeToClient(tx, node.mapId, node.id, client.clientCode, actorId);
}

export async function materializeCmpRelatedPartyDraft(
  tx: Prisma.TransactionClient,
  clientId: string,
  actorId: string,
  entities: CmpRelatedEntityDraft[],
  relationships: CmpEntityRelationshipDraft[],
  groupRelationships: CmpGroupRelationshipDraft[] = [],
  removedGroupRelationshipIds: string[] = []
) {
  if (
    entities.length === 0 &&
    relationships.length === 0 &&
    groupRelationships.length === 0 &&
    removedGroupRelationshipIds.length === 0
  ) {
    return;
  }
  const root = await tx.cmpClientEntityScope.findFirst({
    where: { clientId, role: "ROOT" },
    select: { entityId: true },
  });
  if (!root) {
    throw new ApiConflictException(
      "CONFLICT_RISK",
      "Client root subject was not materialized"
    );
  }

  const entityIdByDraftKey = new Map<string, string>();
  for (const draft of entities) {
    let entity = draft.existingEntityId
      ? await tx.cmpEntity.findUnique({
          where: { id: draft.existingEntityId },
          include: { companyProfile: true, personProfile: true },
        })
      : null;
    if (draft.existingEntityId && !entity) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        `Firm entity ${draft.existingEntityId} was not found`
      );
    }
    if (entity && draft.kind === "COMPANY" && draft.companyIdentityResolution) {
      entity = await resolveCompanyIdentityMatch(tx, entity, draft);
    }
    if (!entity) {
      const matched = await findFirmEntity(tx, draft);
      if (matched) {
        entity =
          draft.kind === "COMPANY"
            ? await resolveCompanyIdentityMatch(tx, matched, draft)
            : await enrichLegacyEntityProfile(tx, matched, draft);
      }
    }
    entity ??= await tx.cmpEntity.create({
      data: {
        kind: draft.kind as CmpEntityKind,
        displayName: draft.displayName,
        companyCode: normalize(draft.companyCode ?? undefined),
        nameZh: normalize(draft.nameZh ?? undefined),
        nameEn: normalize(draft.nameEn ?? undefined),
        jurisdiction: normalize(draft.jurisdiction ?? undefined),
        registrationNumber: normalize(
          draft.companyProfile?.identifierValue ??
            draft.registrationNumber ??
            undefined
        ),
        incorporationDate: parseOptionalDate(
          draft.companyProfile?.incorporationDate
        ),
        dateOfBirth: parseOptionalDate(draft.personProfile?.dateOfBirth),
        nationality: normalize(draft.personProfile?.nationality ?? undefined),
        status: draft.status,
        ...(draft.companyProfile
          ? {
              companyProfile: {
                create: companyProfileData(draft.companyProfile),
              },
            }
          : {}),
        ...(draft.personProfile
          ? {
              personProfile: { create: personProfileData(draft.personProfile) },
            }
          : {}),
      },
      include: { companyProfile: true, personProfile: true },
    });
    await tx.cmpClientEntityScope.upsert({
      where: { clientId_entityId: { clientId, entityId: entity.id } },
      update: {},
      create: { clientId, entityId: entity.id, role: "RELATED" },
    });
    entityIdByDraftKey.set(draft.draftKey, entity.id);
  }

  const resolveRef = (ref: CmpEntityRelationshipDraft["fromRef"]) => {
    if (ref.type === "ROOT") {
      return root.entityId;
    }
    if (ref.type === "EXISTING") {
      return ref.entityId;
    }
    const resolved = entityIdByDraftKey.get(ref.draftKey);
    if (!resolved) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `Related party reference ${ref.draftKey} is invalid`
      );
    }
    return resolved;
  };

  const existingGroupRelationshipIds = groupRelationships.flatMap((draft) =>
    draft.existingRelationshipId ? [draft.existingRelationshipId] : []
  );
  if (
    new Set(existingGroupRelationshipIds).size !==
      existingGroupRelationshipIds.length ||
    new Set(removedGroupRelationshipIds).size !==
      removedGroupRelationshipIds.length ||
    removedGroupRelationshipIds.some((id) =>
      existingGroupRelationshipIds.includes(id)
    )
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Group relationship changes contain duplicate or conflicting identifiers"
    );
  }

  const requireEditableGroupRelationship = async (relationshipId: string) => {
    const relationship = await tx.cmpGroupRelationship.findUnique({
      where: { id: relationshipId },
      include: { participants: true },
    });
    if (!relationship) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Group relationship was not found"
      );
    }
    await assertDraftGroupRelationship(tx, clientId, {
      targetEntityId: relationship.targetEntityId,
      participants: relationship.participants.map((participant) => ({
        entityId: participant.entityId,
        method: participant.method,
        ownershipPercentage:
          participant.ownershipPercentage === null
            ? null
            : Number(participant.ownershipPercentage),
        otherDescription: participant.otherDescription,
      })),
    });
    return relationship;
  };

  for (const relationshipId of removedGroupRelationshipIds) {
    await requireEditableGroupRelationship(relationshipId);
    await tx.cmpGroupRelationship.delete({ where: { id: relationshipId } });
  }

  for (const draft of relationships) {
    const fromEntityId = resolveRef(draft.fromRef);
    const toEntityId = resolveRef(draft.toRef);
    if (fromEntityId === toEntityId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A subject cannot relate to itself"
      );
    }
    const scoped = await tx.cmpClientEntityScope.count({
      where: {
        clientId,
        entityId: { in: [fromEntityId, toEntityId] },
      },
    });
    if (scoped !== 2) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Both relationship subjects must be visible in this client"
      );
    }
    const endpointEntities = await tx.cmpEntity.findMany({
      where: { id: { in: [fromEntityId, toEntityId] } },
      select: { id: true, kind: true },
    });
    const endpointKindById = new Map(
      endpointEntities.map((entity) => [entity.id, entity.kind])
    );
    const fromKind = endpointKindById.get(fromEntityId);
    const toKind = endpointKindById.get(toEntityId);
    if (
      !fromKind ||
      !toKind ||
      !isCmpRelationshipEndpointCompatible(draft.type, fromKind, toKind)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The selected subjects are not valid for this relationship type"
      );
    }
    const effectiveFrom = parseOptionalDate(draft.effectiveFrom);
    const effectiveTo = parseOptionalDate(draft.effectiveTo);
    const duplicate = await tx.cmpEntityRelationship.findFirst({
      where: {
        fromEntityId,
        toEntityId,
        type: draft.type,
        effectiveFrom,
        effectiveTo,
      },
      select: {
        id: true,
        fromEntityId: true,
        toEntityId: true,
        type: true,
        ownershipPercentage: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });
    if (duplicate) {
      const conflict = classifyCmpRelationshipConflict(
        {
          fromEntityId,
          toEntityId,
          type: draft.type,
          ownershipPercentage: draft.ownershipPercentage,
          effectiveFrom,
          effectiveTo,
        },
        relationshipCompatibilityRecord(duplicate)
      );
      if (conflict === "DUPLICATE") {
        continue;
      }
    }
    await assertRelationshipCompatibility(tx, {
      fromEntityId,
      toEntityId,
      type: draft.type,
      ownershipPercentage: draft.ownershipPercentage,
      effectiveFrom,
      effectiveTo,
    });
    await tx.cmpEntityRelationship.create({
      data: {
        fromEntityId,
        toEntityId,
        type: draft.type,
        ownershipPercentage: draft.ownershipPercentage,
        effectiveFrom,
        effectiveTo,
        sourceDocument: normalize(draft.sourceDocument ?? undefined),
        remarks: normalize(draft.remarks ?? undefined),
        createdById: actorId,
      },
    });
  }

  for (const draft of groupRelationships) {
    const targetEntityId = resolveRef(draft.targetRef);
    const participants = draft.participants.map((participant) => ({
      entityId: resolveRef(participant.entityRef),
      method: participant.method,
      ownershipPercentage: participant.ownershipPercentage,
      otherDescription: participant.otherDescription,
    }));
    await assertDraftGroupRelationship(tx, clientId, {
      targetEntityId,
      participants,
    });
    const effectiveFrom = parseOptionalDate(draft.effectiveFrom);
    const effectiveTo = parseOptionalDate(draft.effectiveTo);
    const sourceDocument = normalize(draft.sourceDocument ?? undefined);
    const remarks = normalize(draft.remarks ?? undefined);
    if (draft.existingRelationshipId) {
      await requireEditableGroupRelationship(draft.existingRelationshipId);
      await tx.cmpGroupRelationshipParticipant.deleteMany({
        where: { relationshipId: draft.existingRelationshipId },
      });
      await tx.cmpGroupRelationship.update({
        where: { id: draft.existingRelationshipId },
        data: {
          targetEntityId,
          type: draft.type,
          effectiveFrom,
          effectiveTo,
          sourceDocument,
          remarks,
          participants: {
            create: participants.map((participant) => ({
              entityId: participant.entityId,
              method: participant.method,
              ownershipPercentage:
                participant.method === "OWNERSHIP"
                  ? participant.ownershipPercentage
                  : null,
              otherDescription:
                participant.method === "OTHER"
                  ? normalize(participant.otherDescription ?? undefined)
                  : null,
            })),
          },
        },
      });
      continue;
    }
    const existing = await tx.cmpGroupRelationship.findMany({
      where: {
        targetEntityId,
        type: draft.type,
        effectiveFrom,
        effectiveTo,
      },
      select: {
        sourceDocument: true,
        remarks: true,
        participants: {
          select: {
            entityId: true,
            method: true,
            ownershipPercentage: true,
            otherDescription: true,
          },
        },
      },
    });
    if (
      existing.some((relationship) =>
        groupRelationshipMatchesDraft(
          relationship,
          participants,
          sourceDocument,
          remarks
        )
      )
    ) {
      continue;
    }
    await tx.cmpGroupRelationship.create({
      data: {
        targetEntityId,
        type: draft.type,
        effectiveFrom,
        effectiveTo,
        sourceDocument,
        remarks,
        createdById: actorId,
        participants: {
          create: participants.map((participant) => ({
            entityId: participant.entityId,
            method: participant.method,
            ownershipPercentage:
              participant.method === "OWNERSHIP"
                ? participant.ownershipPercentage
                : null,
            otherDescription:
              participant.method === "OTHER"
                ? normalize(participant.otherDescription ?? undefined)
                : null,
          })),
        },
      },
    });
  }
}

function groupRelationshipMatchesDraft(
  relationship: {
    sourceDocument: string | null;
    remarks: string | null;
    participants: Array<{
      entityId: string;
      method: "OWNERSHIP" | "OTHER";
      ownershipPercentage: unknown;
      otherDescription: string | null;
    }>;
  },
  participants: Array<{
    entityId: string;
    method: "OWNERSHIP" | "OTHER";
    ownershipPercentage?: number | null;
    otherDescription?: string | null;
  }>,
  sourceDocument: string | null | undefined,
  remarks: string | null | undefined
) {
  if (
    relationship.sourceDocument !== (sourceDocument ?? null) ||
    relationship.remarks !== (remarks ?? null) ||
    relationship.participants.length !== participants.length
  ) {
    return false;
  }

  const draftParticipantKeys = participants
    .map(
      (participant) =>
        `${participant.entityId}:${participant.method}:${participant.method === "OWNERSHIP" ? (participant.ownershipPercentage ?? "") : ""}:${participant.method === "OTHER" ? (normalize(participant.otherDescription ?? undefined) ?? "") : ""}`
    )
    .sort();
  const existingParticipantKeys = relationship.participants
    .map(
      (participant) =>
        `${participant.entityId}:${participant.method}:${participant.method === "OWNERSHIP" ? String(participant.ownershipPercentage ?? "") : ""}:${participant.method === "OTHER" ? (participant.otherDescription ?? "") : ""}`
    )
    .sort();
  return draftParticipantKeys.every(
    (participant, index) => participant === existingParticipantKeys[index]
  );
}

async function assertDraftGroupRelationship(
  tx: Prisma.TransactionClient,
  clientId: string,
  input: {
    targetEntityId: string;
    participants: Array<{
      entityId: string;
      method: "OWNERSHIP" | "OTHER";
      ownershipPercentage?: number | null;
      otherDescription?: string | null;
    }>;
  }
) {
  const participantIds = input.participants.map(
    (participant) => participant.entityId
  );
  if (
    participantIds.length === 0 ||
    new Set(participantIds).size !== participantIds.length ||
    participantIds.includes(input.targetEntityId)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Group relationship participants are invalid"
    );
  }
  const scoped = await tx.cmpClientEntityScope.count({
    where: {
      clientId,
      entityId: { in: [input.targetEntityId, ...participantIds] },
    },
  });
  if (scoped !== participantIds.length + 1) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "All group relationship subjects must be visible in this client"
    );
  }
  const entities = await tx.cmpEntity.findMany({
    where: { id: { in: [input.targetEntityId, ...participantIds] } },
    select: { kind: true },
  });
  if (
    entities.length !== participantIds.length + 1 ||
    entities.some((entity) => entity.kind !== "COMPANY")
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Group relationship targets and participants must be companies"
    );
  }
  for (const participant of input.participants) {
    if (
      participant.method === "OTHER" &&
      (!normalize(participant.otherDescription ?? undefined) ||
        (participant.ownershipPercentage !== null &&
          participant.ownershipPercentage !== undefined))
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Other relationship methods require a description and no ownership percentage"
      );
    }
  }
}

export async function ensureCmpClientRootEntity(
  tx: Prisma.TransactionClient,
  clientId: string,
  input: {
    clientCode: string;
    companyIdentifierType?: string;
    companyNumber?: string;
    nameEn?: string;
    nameZh?: string;
    placeOfIncorporation?: string;
    dateOfIncorporation?: string;
    listedOrPrivate?: string;
    industryOtherDescription?: string;
    registeredAddress?: string;
    address?: string;
    principalBusinessAddress?: string;
    companyIdentityResolution?: {
      action: "LINK_EXISTING" | "UPDATE_EXISTING";
      entityId: string;
      expectedUpdatedAt: string;
    };
  }
) {
  const identifierType = canonicalCompanyIdentifierType(
    input.companyIdentifierType ?? "COMPANY_REGISTRATION_NUMBER"
  );
  const identifierValue = normalize(input.companyNumber ?? undefined);
  const currentRoot = await tx.cmpClientEntityScope.findFirst({
    where: { clientId, role: "ROOT" },
    include: {
      entity: { include: { companyProfile: true, personProfile: true } },
    },
  });
  const matched = identifierValue
    ? await findCompanyByIdentity(tx, { identifierType, identifierValue })
    : null;
  const matchedIsCurrentRoot = matched?.id === currentRoot?.entityId;
  let shouldUpdateEntity = !matched || matchedIsCurrentRoot;
  if (matched && !matchedIsCurrentRoot) {
    const resolution = input.companyIdentityResolution;
    if (!resolution) {
      throwCompanyIdentityConflict(matched);
    }
    if (
      resolution.entityId !== matched.id ||
      resolution.expectedUpdatedAt !== matched.updatedAt.toISOString()
    ) {
      throw new ApiConflictException(
        "ENTITY_IDENTITY_CONFLICT",
        "The matching company changed. Review the latest company record."
      );
    }
    shouldUpdateEntity = resolution.action === "UPDATE_EXISTING";
  }

  let entity = matched;
  if (!entity && currentRoot) {
    const sharedByOtherClients = await tx.cmpClientEntityScope.count({
      where: {
        entityId: currentRoot.entityId,
        clientId: { not: clientId },
      },
    });
    if (!sharedByOtherClients) {
      ({ entity } = currentRoot);
    }
  }

  const displayName =
    normalize(input.nameEn ?? undefined) ??
    normalize(input.nameZh ?? undefined) ??
    input.clientCode;
  const jurisdiction = normalize(input.placeOfIncorporation ?? undefined);
  const incorporationDate = parseOptionalDate(input.dateOfIncorporation);
  const registeredAddress = normalize(
    input.registeredAddress ?? input.address ?? undefined
  );
  const profileData = identifierValue
    ? {
        identifierType,
        identifierValue,
        incorporationDate,
        companyType:
          input.listedOrPrivate === "LISTED"
            ? ("LISTED" as const)
            : input.listedOrPrivate === "PRIVATE"
              ? ("PRIVATE" as const)
              : ("OTHER" as const),
        industryClassification: normalize(input.industryOtherDescription),
        registeredAddress,
        principalBusinessAddress: normalize(
          input.principalBusinessAddress ?? undefined
        ),
      }
    : null;

  if (entity && !shouldUpdateEntity && !entity.companyProfile && profileData) {
    entity = await tx.cmpEntity.update({
      where: { id: entity.id },
      data: {
        registrationNumber: identifierValue,
        companyProfile: { create: profileData },
      },
      include: { companyProfile: true, personProfile: true },
    });
  } else if (entity && shouldUpdateEntity) {
    entity = await tx.cmpEntity.update({
      where: { id: entity.id },
      data: {
        displayName,
        nameZh: normalize(input.nameZh ?? undefined),
        nameEn: normalize(input.nameEn ?? undefined),
        jurisdiction,
        registrationNumber: identifierValue,
        incorporationDate,
        ...(profileData
          ? {
              companyProfile: {
                upsert: { create: profileData, update: profileData },
              },
            }
          : {}),
      },
      include: { companyProfile: true, personProfile: true },
    });
  } else if (!entity) {
    try {
      entity = await tx.cmpEntity.create({
        data: {
          kind: "COMPANY",
          displayName,
          nameZh: normalize(input.nameZh ?? undefined),
          nameEn: normalize(input.nameEn ?? undefined),
          jurisdiction,
          registrationNumber: identifierValue,
          incorporationDate,
          ...(profileData ? { companyProfile: { create: profileData } } : {}),
        },
        include: { companyProfile: true, personProfile: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        profileData
      ) {
        const concurrentMatch = await findCompanyByIdentity(tx, profileData);
        if (concurrentMatch) {
          throwCompanyIdentityConflict(concurrentMatch);
        }
      }
      throw error;
    }
  }
  if (!entity) {
    throw new ApiConflictException(
      "CONFLICT_RISK",
      "Unable to materialize the client company entity"
    );
  }

  await tx.cmpClientEntityScope.updateMany({
    where: { clientId, role: "ROOT", entityId: { not: entity.id } },
    data: { role: "RELATED" },
  });
  await tx.cmpClientEntityScope.upsert({
    where: { clientId_entityId: { clientId, entityId: entity.id } },
    update: { role: "ROOT" },
    create: { clientId, entityId: entity.id, role: "ROOT" },
  });
  return entity;
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
