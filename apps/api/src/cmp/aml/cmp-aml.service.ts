import { createHash, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CmpAmlLatestResponseSchema,
  CmpClientAcceptanceDraftPayloadSchema,
  CmpEntityRelationshipDraftSchema,
  CmpGroupRelationshipDraftSchema,
  CmpRelatedEntityDraftSchema,
} from "@project-wing/shared";
import type {
  CmpAmlHitReviewInput,
  CmpAmlReviewStatus,
  CmpAmlRunInput,
  CmpAmlScreeningStatus,
  CmpAmlSubjectRole,
} from "@project-wing/shared";
import type {
  CmpEntityRelationshipDraft,
  CmpGroupRelationshipDraft,
  CmpRelatedEntityDraft,
} from "@project-wing/shared/cmp-entity-graph";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditLogsService } from "../../audit-logs/audit-logs.service";
import type { RequestUser } from "../../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../../common/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { DiditAmlClient, DiditAmlError } from "./didit-aml.client";
import type {
  DiditAmlHit,
  DiditAmlRequest,
  DiditAmlResponse,
} from "./didit-aml.client";

const REVIEW_ROLES = new Set([
  "SUPER_ADMIN",
  "PARTNER",
  "PRINCIPAL",
  "MANAGER",
]);
const AML_RELATIONSHIP_ROLES = {
  BENEFICIAL_OWNER_OF: "BENEFICIAL_OWNER",
  DIRECTOR_OF: "DIRECTOR",
} as const satisfies Record<string, CmpAmlSubjectRole>;
const AML_ROLE_ORDER: CmpAmlSubjectRole[] = [
  "CLIENT",
  "GROUP_COMPANY",
  "OWNER",
  "BENEFICIAL_OWNER",
  "DIRECTOR",
  "CONTROLLER",
];

const AML_BATCH_INCLUDE =
  Prisma.validator<Prisma.CmpAmlScreeningBatchInclude>()({
    triggeredBy: { select: { id: true, name: true } },
    subjects: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        hits: {
          orderBy: [{ riskScore: "desc" }, { createdAt: "asc" }],
          include: { reviewedBy: { select: { id: true, name: true } } },
        },
      },
    },
  });

type AmlBatchWithRelations = Prisma.CmpAmlScreeningBatchGetPayload<{
  include: typeof AML_BATCH_INCLUDE;
}>;

export type AmlSubjectCandidate = {
  subjectKey: string;
  entityType: "PERSON" | "COMPANY";
  roles: CmpAmlSubjectRole[];
  displayName: string;
  complete: boolean;
  request: Omit<
    DiditAmlRequest,
    | "include_adverse_media"
    | "include_ongoing_monitoring"
    | "save_api_request"
    | "vendor_data"
    | "metadata"
  >;
};

@Injectable()
export class CmpAmlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly didit: DiditAmlClient
  ) {}

  async latest(acceptanceId: string, user: RequestUser) {
    const acceptance = await this.getAcceptance(acceptanceId);
    assertCanAccessAcceptance(acceptance, user);
    const diditStatus = await resolveDiditStatus(this.didit);
    const availableSubjects = buildAmlSubjects(acceptance.clientPayload);
    const batch = await this.prisma.cmpAmlScreeningBatch.findFirst({
      where: { acceptanceRequestId: acceptanceId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: AML_BATCH_INCLUDE,
    });
    const batchSubjects = batch
      ? selectCurrentBatchSubjects(availableSubjects, batch.subjects)
      : { subjects: legacyAmlSubjects(availableSubjects), hasMissing: false };
    const currentInputFingerprint = batchSubjects.hasMissing
      ? null
      : fingerprintAmlSubjects(batchSubjects.subjects);
    return CmpAmlLatestResponseSchema.parse({
      enabled: diditStatus.enabled,
      configured: diditStatus.configured,
      canReviewHits: REVIEW_ROLES.has(user.globalRole),
      currentInputFingerprint,
      isStale: Boolean(
        batch &&
        (batchSubjects.hasMissing ||
          batch.requestFingerprint !== currentInputFingerprint)
      ),
      availableSubjects: availableSubjects.map(serializeCandidate),
      batch: batch ? serializeBatch(batch) : null,
    });
  }

  async run(
    acceptanceId: string,
    input: CmpAmlRunInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const acceptance = await this.getAcceptance(acceptanceId);
    assertCanAccessAcceptance(acceptance, user);
    if (acceptance.type !== "CLIENT" && acceptance.type !== "CLIENT_CHANGE") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "AML screening is available only for Client acceptance requests"
      );
    }

    const availableSubjects = buildAmlSubjects(acceptance.clientPayload);
    const subjects = input.subjectKeys
      ? selectRequestedSubjects(availableSubjects, input.subjectKeys)
      : legacyAmlSubjects(availableSubjects);
    if (subjects.length === 0) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Select at least one AML subject before screening"
      );
    }
    const requestFingerprint = fingerprintAmlSubjects(subjects);
    const forceRun = input.force === true;
    const dedupeKey = forceRun
      ? `${acceptanceId}:${requestFingerprint}:${randomUUID()}`
      : `${acceptanceId}:${requestFingerprint}`;

    let batchId: string;
    let completedOutcomes: CmpAmlScreeningStatus[] = [];
    const existing = forceRun
      ? null
      : await this.findBatchByDedupeKey(dedupeKey);
    if (existing) {
      if (existing.status !== "RUNNING") {
        return this.latest(acceptanceId, user);
      }
      if (
        Date.now() - existing.updatedAt.getTime() <
        runningRecoveryDelayMs()
      ) {
        return this.latest(acceptanceId, user);
      }
      const lease = await this.prisma.cmpAmlScreeningBatch.updateMany({
        where: {
          id: existing.id,
          status: "RUNNING",
          updatedAt: existing.updatedAt,
        },
        data: { updatedAt: new Date() },
      });
      if (lease.count !== 1) {
        return this.latest(acceptanceId, user);
      }
      batchId = existing.id;
      completedOutcomes = existing.subjects.map((subject) => subject.status);
    } else {
      try {
        const batch = await this.prisma.cmpAmlScreeningBatch.create({
          data: {
            acceptanceRequestId: acceptanceId,
            clientId: acceptance.targetClientId,
            requestFingerprint,
            dedupeKey,
            forceRun,
            subjectCount: subjects.length,
            triggeredById: user.id,
          },
          select: { id: true },
        });
        batchId = batch.id;
      } catch (error) {
        if (
          !forceRun &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return this.latest(acceptanceId, user);
        }
        throw error;
      }
    }

    const completedSubjectKeys = new Set(
      existing?.subjects.map((subject) => subject.subjectKey)
    );
    const outcomes = [
      ...completedOutcomes,
      ...(await Promise.all(
        subjects
          .filter((subject) => !completedSubjectKeys.has(subject.subjectKey))
          .map((subject) =>
            this.screenSubject({
              acceptanceId,
              batchId,
              dedupeKey,
              subject,
            })
          )
      )),
    ];
    const errorCount = outcomes.filter((outcome) => outcome === "ERROR").length;
    const attentionCount = outcomes.filter(
      (outcome) => outcome === "IN_REVIEW" || outcome === "DECLINED"
    ).length;
    const status =
      errorCount === 0
        ? "COMPLETED"
        : errorCount === outcomes.length
          ? "FAILED"
          : "PARTIAL_FAILED";
    await this.prisma.cmpAmlScreeningBatch.update({
      where: { id: batchId },
      data: {
        status,
        attentionCount,
        errorCount,
        completedAt: new Date(),
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_AML_SCREENING_COMPLETED",
      targetType: "CMP_AML_SCREENING_BATCH",
      targetId: batchId,
      description: `Completed AML screening for ${subjects.length} subjects: ${attentionCount} attention, ${errorCount} errors`,
      source,
    });
    return this.latest(acceptanceId, user);
  }

  async reviewHit(
    screeningId: string,
    hitId: string,
    input: CmpAmlHitReviewInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    if (!REVIEW_ROLES.has(user.globalRole)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Manager or above is required to review AML hits"
      );
    }
    const hit = await this.prisma.cmpAmlHit.findUnique({
      where: { id: hitId },
      include: {
        screening: {
          include: { batch: true },
        },
      },
    });
    if (!hit || hit.screeningId !== screeningId) {
      throw new ApiNotFoundException("NOT_FOUND", "AML hit was not found");
    }
    const acceptance = await this.getAcceptance(
      hit.screening.batch.acceptanceRequestId
    );
    assertCanAccessAcceptance(acceptance, user);
    if (!hit.screening.diditRequestId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "This AML result cannot be reviewed at Didit"
      );
    }

    await this.didit.updateHitStatus(
      hit.screening.diditRequestId,
      hit.diditHitId,
      toDiditReviewStatus(input.reviewStatus)
    );
    const updated = await this.prisma.cmpAmlHit.update({
      where: { id: hit.id },
      data: {
        reviewStatus: input.reviewStatus,
        reviewComment: input.comment?.trim() || null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: { reviewedBy: { select: { id: true, name: true } } },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_AML_HIT_REVIEWED",
      targetType: "CMP_AML_HIT",
      targetId: hit.id,
      description: `Updated AML hit review status to ${input.reviewStatus}`,
      source,
    });
    return serializeHit(updated);
  }

  async deleteRemoteSessionsForAcceptance(
    acceptanceId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const subjects = await this.prisma.cmpAmlScreeningSubject.findMany({
      where: {
        batch: { acceptanceRequestId: acceptanceId },
        diditRequestId: { not: null },
      },
      select: { diditRequestId: true },
    });
    const sessionIds = [
      ...new Set(
        subjects
          .map((subject) => subject.diditRequestId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (sessionIds.length === 0) {
      return;
    }
    const diditStatus = await resolveDiditStatus(this.didit);
    if (!diditStatus.configured) {
      await this.auditRemoteCleanup(
        acceptanceId,
        user,
        sessionIds.length,
        sessionIds.length,
        source
      );
      return;
    }
    const results = await Promise.allSettled(
      sessionIds.map((sessionId) => this.didit.deleteSession(sessionId))
    );
    const failed = results.filter(
      (result) => result.status === "rejected"
    ).length;
    await this.auditRemoteCleanup(
      acceptanceId,
      user,
      sessionIds.length,
      failed,
      source
    );
  }

  private async screenSubject({
    acceptanceId,
    batchId,
    dedupeKey,
    subject,
  }: {
    acceptanceId: string;
    batchId: string;
    dedupeKey: string;
    subject: AmlSubjectCandidate;
  }) {
    const startedAt = new Date();
    const idempotencyKey = `pw-aml-${sha256(
      `${dedupeKey}:${subject.subjectKey}`
    ).slice(0, 48)}`;
    if (!subject.complete) {
      await this.createErrorSubject({
        batchId,
        subject,
        idempotencyKey,
        startedAt,
        code: "AML_SUBJECT_INCOMPLETE",
        message: "A legal name is required before this subject can be screened",
      });
      return "ERROR" as const;
    }
    const diditStatus = await resolveDiditStatus(this.didit);
    if (!diditStatus.configured) {
      await this.createErrorSubject({
        batchId,
        subject,
        idempotencyKey,
        startedAt,
        code: diditStatus.enabled ? "DIDIT_NOT_CONFIGURED" : "DIDIT_DISABLED",
        message: diditStatus.enabled
          ? "Didit AML API key is not configured"
          : "Didit AML screening is disabled",
      });
      return "ERROR" as const;
    }

    const request: DiditAmlRequest = {
      ...subject.request,
      include_adverse_media: false,
      include_ongoing_monitoring: false,
      save_api_request: true,
      vendor_data: acceptanceId,
      metadata: {
        project_wing_acceptance_id: acceptanceId,
        project_wing_batch_id: batchId,
        project_wing_subject_key: subject.subjectKey,
      },
    };
    try {
      const response = await this.didit.screen(request, idempotencyKey);
      const status = fromDiditStatus(response.aml.status);
      const completedAt = new Date();
      await this.prisma.cmpAmlScreeningSubject.create({
        data: {
          batchId,
          subjectKey: subject.subjectKey,
          entityType: subject.entityType,
          rolesJson: jsonValue(subject.roles),
          displayName: subject.displayName,
          inputJson: jsonValue(request),
          idempotencyKey,
          diditRequestId: response.request_id,
          status,
          score: response.aml.score,
          totalHits: response.aml.total_hits,
          warningsJson: jsonValue(normalizeWarnings(response.aml.warnings)),
          providerResponseJson: jsonValue(response),
          startedAt,
          completedAt,
          hits: {
            create: response.aml.hits.map((hit, index) => ({
              diditHitId: diditHitId(hit, response, index),
              reviewStatus: fromDiditReviewStatus(hit.review_status),
              matchScore: numberOrNull(hit.match_score),
              riskScore: numberOrNull(hit.risk_score),
              detailsJson: jsonValue(hit),
            })),
          },
        },
      });
      return status;
    } catch (error) {
      const normalized = normalizeDiditError(error);
      await this.createErrorSubject({
        batchId,
        subject,
        idempotencyKey,
        startedAt,
        code: normalized.code,
        message: normalized.message,
        request,
      });
      return "ERROR" as const;
    }
  }

  private createErrorSubject({
    batchId,
    subject,
    idempotencyKey,
    startedAt,
    code,
    message,
    request,
  }: {
    batchId: string;
    subject: AmlSubjectCandidate;
    idempotencyKey: string;
    startedAt: Date;
    code: string;
    message: string;
    request?: DiditAmlRequest;
  }) {
    return this.prisma.cmpAmlScreeningSubject.create({
      data: {
        batchId,
        subjectKey: subject.subjectKey,
        entityType: subject.entityType,
        rolesJson: jsonValue(subject.roles),
        displayName: subject.displayName,
        inputJson: jsonValue(request ?? subject.request),
        idempotencyKey,
        status: "ERROR",
        totalHits: 0,
        warningsJson: jsonValue([]),
        errorCode: code,
        errorMessage: message,
        startedAt,
        completedAt: new Date(),
      },
    });
  }

  private getAcceptance(id: string) {
    return this.prisma.cmpAcceptanceRequest
      .findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          clientPayload: true,
          targetClientId: true,
          submittedById: true,
          micApproverId: true,
          picApproverId: true,
          itApproverId: true,
          draftAssigneeId: true,
        },
      })
      .then((acceptance) => {
        if (!acceptance) {
          throw new ApiNotFoundException(
            "NOT_FOUND",
            "Acceptance request was not found"
          );
        }
        return acceptance;
      });
  }

  private findBatchByDedupeKey(dedupeKey: string) {
    return this.prisma.cmpAmlScreeningBatch.findUnique({
      where: { dedupeKey },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        subjects: { select: { subjectKey: true, status: true } },
      },
    });
  }

  private auditRemoteCleanup(
    acceptanceId: string,
    user: RequestUser,
    total: number,
    failed: number,
    source?: AuditLogSource
  ) {
    return this.auditLogs.log({
      actorId: user.id,
      action:
        failed === 0
          ? "CMP_AML_REMOTE_SESSIONS_DELETED"
          : "CMP_AML_REMOTE_SESSION_DELETE_FAILED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: acceptanceId,
      description: `Didit AML session cleanup: ${total - failed} deleted, ${failed} failed`,
      source,
    });
  }
}

export function buildAmlSubjects(value: Prisma.JsonValue | null) {
  const parsedPayload = CmpClientAcceptanceDraftPayloadSchema.safeParse(value);
  const payload = parsedPayload.success ? parsedPayload.data : {};
  const rootName = firstText(payload.nameEn, payload.nameZh);
  const rootDisplayName =
    rootName || firstText(payload.clientCode) || "Client company";
  const rootRequest = compactRequest({
    full_name: rootName,
    entity_type: "company",
    date_of_birth: exactDate(payload.incorporationYearMonth),
    nationality: normalizeCountryCode(payload.placeOfIncorporation),
    document_number: text(payload.companyNumber),
  });
  const subjects: AmlSubjectCandidate[] = [
    {
      subjectKey: "ROOT",
      entityType: "COMPANY",
      roles: ["CLIENT"],
      displayName: rootDisplayName,
      complete: Boolean(rootName),
      request: rootRequest,
    },
  ];

  const entitiesResult = CmpRelatedEntityDraftSchema.array().safeParse(
    payload.relatedEntities ?? []
  );
  const relationshipsResult =
    CmpEntityRelationshipDraftSchema.array().safeParse(
      payload.relatedRelationships ?? []
    );
  const groupRelationshipsResult =
    CmpGroupRelationshipDraftSchema.array().safeParse(
      payload.relatedGroupRelationships ?? []
    );
  if (
    !entitiesResult.success ||
    !relationshipsResult.success ||
    !groupRelationshipsResult.success
  ) {
    return subjects;
  }

  const entities = entitiesResult.data;
  const relationships = relationshipsResult.data.filter(isActiveRelationship);
  const groupRelationships = groupRelationshipsResult.data.filter(
    isActiveGroupRelationship
  );
  const entitiesByKey = new Map(
    entities.map((entity) => [entityReferenceKey(entity), entity])
  );
  const activeCompanyKeys = new Set(
    entities
      .filter(
        (entity) => entity.kind === "COMPANY" && entity.status === "ACTIVE"
      )
      .map(entityReferenceKey)
  );
  const companyGraph = new Map<string, Set<string>>([["ROOT", new Set()]]);
  for (const relationship of relationships) {
    if (relationship.type !== "OWNS") {
      continue;
    }
    const fromKey = relationshipReferenceKey(relationship.fromRef);
    const toKey = relationshipReferenceKey(relationship.toRef);
    const fromKind = resolveReferenceKind(relationship.fromRef, entities);
    const toKind = resolveReferenceKind(relationship.toRef, entities);
    if (
      fromKind !== "COMPANY" ||
      toKind !== "COMPANY" ||
      (fromKey !== "ROOT" && !activeCompanyKeys.has(fromKey)) ||
      (toKey !== "ROOT" && !activeCompanyKeys.has(toKey))
    ) {
      continue;
    }
    const fromEdges = companyGraph.get(fromKey) ?? new Set<string>();
    fromEdges.add(toKey);
    companyGraph.set(fromKey, fromEdges);
    const toEdges = companyGraph.get(toKey) ?? new Set<string>();
    toEdges.add(fromKey);
    companyGraph.set(toKey, toEdges);
  }
  for (const relationship of groupRelationships) {
    const targetKey = relationshipReferenceKey(relationship.targetRef);
    const targetKind = resolveReferenceKind(relationship.targetRef, entities);
    if (
      targetKind !== "COMPANY" ||
      (targetKey !== "ROOT" && !activeCompanyKeys.has(targetKey))
    ) {
      continue;
    }
    for (const participant of relationship.participants) {
      const participantKey = relationshipReferenceKey(participant.entityRef);
      const participantKind = resolveReferenceKind(
        participant.entityRef,
        entities
      );
      if (
        participantKind !== "COMPANY" ||
        (participantKey !== "ROOT" && !activeCompanyKeys.has(participantKey))
      ) {
        continue;
      }
      const participantEdges =
        companyGraph.get(participantKey) ?? new Set<string>();
      participantEdges.add(targetKey);
      companyGraph.set(participantKey, participantEdges);
      const targetEdges = companyGraph.get(targetKey) ?? new Set<string>();
      targetEdges.add(participantKey);
      companyGraph.set(targetKey, targetEdges);
    }
  }

  const connectedCompanyKeys = new Set<string>(["ROOT"]);
  const pendingCompanyKeys = ["ROOT"];
  while (pendingCompanyKeys.length > 0) {
    const current = pendingCompanyKeys.shift();
    if (!current) {
      continue;
    }
    for (const neighbour of companyGraph.get(current) ?? []) {
      if (!connectedCompanyKeys.has(neighbour)) {
        connectedCompanyKeys.add(neighbour);
        pendingCompanyKeys.push(neighbour);
      }
    }
  }

  const rolesByCompany = new Map<string, Set<CmpAmlSubjectRole>>([
    ["ROOT", new Set(["CLIENT"])],
  ]);
  for (const companyKey of connectedCompanyKeys) {
    if (companyKey !== "ROOT") {
      rolesByCompany.set(companyKey, new Set(["GROUP_COMPANY"]));
    }
  }
  const rolesByPerson = new Map<string, Set<CmpAmlSubjectRole>>();
  for (const relationship of relationships) {
    const fromKey = relationshipReferenceKey(relationship.fromRef);
    const toKey = relationshipReferenceKey(relationship.toRef);
    const fromKind = resolveReferenceKind(relationship.fromRef, entities);
    const toKind = resolveReferenceKind(relationship.toRef, entities);

    if (
      fromKind === "COMPANY" &&
      connectedCompanyKeys.has(fromKey) &&
      relationship.type === "OWNS"
    ) {
      const roles = rolesByCompany.get(fromKey);
      roles?.add("OWNER");
    }
    const role =
      AML_RELATIONSHIP_ROLES[
        relationship.type as keyof typeof AML_RELATIONSHIP_ROLES
      ];
    if (
      !role ||
      fromKind !== "PERSON" ||
      toKind !== "COMPANY" ||
      !connectedCompanyKeys.has(toKey)
    ) {
      continue;
    }
    const person = entitiesByKey.get(fromKey);
    if (person?.kind !== "PERSON" || person.status !== "ACTIVE") {
      continue;
    }
    const roles = rolesByPerson.get(fromKey) ?? new Set<CmpAmlSubjectRole>();
    roles.add(role);
    rolesByPerson.set(fromKey, roles);
  }

  for (const [companyKey, roles] of rolesByCompany) {
    if (companyKey === "ROOT") {
      const [rootSubject] = subjects;
      if (rootSubject) {
        rootSubject.roles = sortAmlRoles(roles);
      }
      continue;
    }
    const entity = entitiesByKey.get(companyKey);
    if (!entity || entity.kind !== "COMPANY") {
      continue;
    }
    const name = firstText(entity.nameEn, entity.nameZh);
    const profile = entity.companyProfile;
    subjects.push({
      subjectKey: `COMPANY:${companyKey}`,
      entityType: "COMPANY",
      roles: sortAmlRoles(roles),
      displayName: name || entity.displayName,
      complete: Boolean(name),
      request: compactRequest({
        full_name: name,
        entity_type: "company",
        date_of_birth: exactDate(profile?.incorporationDate),
        nationality: normalizeCountryCode(entity.jurisdiction),
        document_number:
          text(profile?.identifierValue) ?? text(entity.registrationNumber),
      }),
    });
  }

  for (const [personKey, roles] of rolesByPerson) {
    const entity = entitiesByKey.get(personKey);
    if (!entity) {
      continue;
    }
    const name = firstText(entity.nameEn, entity.nameZh);
    const profile = entity.personProfile;
    subjects.push({
      subjectKey: `PERSON:${personKey}`,
      entityType: "PERSON",
      roles: sortAmlRoles(roles),
      displayName: name || entity.displayName,
      complete: Boolean(name),
      request: compactRequest({
        full_name: name,
        entity_type: "person",
        date_of_birth: exactDate(profile?.dateOfBirth),
        nationality: normalizeCountryCode(profile?.nationality),
        document_number: text(profile?.identifierValue),
      }),
    });
  }
  return subjects.sort(compareAmlSubjects);
}

export function fingerprintAmlSubjects(subjects: AmlSubjectCandidate[]) {
  return sha256(
    stableStringify(
      [...subjects]
        .sort(compareAmlSubjects)
        .map(({ subjectKey, entityType, roles, request }) => ({
          subjectKey,
          entityType,
          roles: sortAmlRoles(roles),
          request,
          include_adverse_media: false,
          include_ongoing_monitoring: false,
          save_api_request: true,
        }))
    )
  );
}

function selectCurrentBatchSubjects(
  availableSubjects: AmlSubjectCandidate[],
  batchSubjects: { subjectKey: string }[]
) {
  const availableByKey = new Map(
    availableSubjects.map((subject) => [subject.subjectKey, subject])
  );
  const selectedKeys = new Set(
    batchSubjects.map((subject) => subject.subjectKey)
  );
  const subjects = [...selectedKeys]
    .map((subjectKey) => availableByKey.get(subjectKey))
    .filter((subject): subject is AmlSubjectCandidate => Boolean(subject));
  return {
    subjects,
    hasMissing: subjects.length !== selectedKeys.size,
  };
}

function legacyAmlSubjects(availableSubjects: AmlSubjectCandidate[]) {
  return availableSubjects.filter(
    (subject) =>
      subject.subjectKey === "ROOT" || subject.entityType === "PERSON"
  );
}

function selectRequestedSubjects(
  availableSubjects: AmlSubjectCandidate[],
  subjectKeys: string[]
) {
  const availableByKey = new Map(
    availableSubjects.map((subject) => [subject.subjectKey, subject])
  );
  const selectedKeys = [...new Set(subjectKeys)].sort();
  const selected = selectedKeys.map((subjectKey) =>
    availableByKey.get(subjectKey)
  );
  if (selected.some((subject) => !subject)) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Selected AML subjects are no longer available. Refresh the AML subject list and try again"
    );
  }
  return selected as AmlSubjectCandidate[];
}

function serializeCandidate(subject: AmlSubjectCandidate) {
  return {
    subjectKey: subject.subjectKey,
    entityType: subject.entityType,
    roles: subject.roles,
    displayName: subject.displayName,
    ready: subject.complete,
    warnings: subject.complete
      ? []
      : ["A legal name is required before this subject can be screened"],
  };
}

function compareAmlSubjects(
  left: AmlSubjectCandidate,
  right: AmlSubjectCandidate
) {
  const rank = (subject: AmlSubjectCandidate) =>
    subject.subjectKey === "ROOT"
      ? 0
      : subject.entityType === "COMPANY"
        ? 1
        : 2;
  return (
    rank(left) - rank(right) ||
    left.displayName.localeCompare(right.displayName) ||
    left.subjectKey.localeCompare(right.subjectKey)
  );
}

function sortAmlRoles(roles: Iterable<CmpAmlSubjectRole>) {
  return [...roles].sort(
    (left, right) =>
      AML_ROLE_ORDER.indexOf(left) - AML_ROLE_ORDER.indexOf(right)
  );
}

export function normalizeCountryCode(value: unknown) {
  const normalized = text(value)?.toUpperCase().replaceAll(/[._-]/g, " ");
  if (!normalized) {
    return;
  }
  if (/^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }
  return COUNTRY_CODE_BY_NAME[normalized];
}

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  "HONG KONG": "HK",
  "HONG KONG SAR": "HK",
  CHINA: "CN",
  "CHINESE MAINLAND": "CN",
  "MAINLAND CHINA": "CN",
  "UNITED KINGDOM": "GB",
  UK: "GB",
  "UNITED STATES": "US",
  USA: "US",
  SINGAPORE: "SG",
  MALAYSIA: "MY",
  AUSTRALIA: "AU",
  CANADA: "CA",
  TAIWAN: "TW",
  MACAU: "MO",
  "MACAU SAR": "MO",
  "BRITISH VIRGIN ISLANDS": "VG",
  BVI: "VG",
  "CAYMAN ISLANDS": "KY",
};

function resolveReferenceKind(
  reference:
    | CmpEntityRelationshipDraft["fromRef"]
    | CmpEntityRelationshipDraft["toRef"]
    | CmpGroupRelationshipDraft["targetRef"]
    | CmpGroupRelationshipDraft["participants"][number]["entityRef"],
  entities: CmpRelatedEntityDraft[]
) {
  if (reference.type === "ROOT") {
    return "COMPANY" as const;
  }
  const key = relationshipReferenceKey(reference);
  return entities.find((entity) => entityReferenceKey(entity) === key)?.kind;
}

function entityReferenceKey(entity: CmpRelatedEntityDraft) {
  return entity.existingEntityId
    ? `EXISTING:${entity.existingEntityId}`
    : `DRAFT:${entity.draftKey}`;
}

function relationshipReferenceKey(
  reference:
    | CmpEntityRelationshipDraft["fromRef"]
    | CmpEntityRelationshipDraft["toRef"]
    | CmpGroupRelationshipDraft["targetRef"]
    | CmpGroupRelationshipDraft["participants"][number]["entityRef"]
) {
  if (reference.type === "ROOT") {
    return "ROOT";
  }
  return reference.type === "EXISTING"
    ? `EXISTING:${reference.entityId}`
    : `DRAFT:${reference.draftKey}`;
}

function isActiveRelationship(relationship: CmpEntityRelationshipDraft) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    (!relationship.effectiveFrom || relationship.effectiveFrom <= today) &&
    (!relationship.effectiveTo || relationship.effectiveTo >= today)
  );
}

function isActiveGroupRelationship(relationship: CmpGroupRelationshipDraft) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    (!relationship.effectiveFrom || relationship.effectiveFrom <= today) &&
    (!relationship.effectiveTo || relationship.effectiveTo >= today)
  );
}

function compactRequest(input: {
  full_name?: string;
  entity_type: "person" | "company";
  date_of_birth?: string;
  nationality?: string;
  document_number?: string;
}) {
  return Object.fromEntries(
    Object.entries(input).filter(([, item]) => item !== undefined)
  ) as AmlSubjectCandidate["request"];
}

function exactDate(value: unknown) {
  const normalized = text(value);
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : undefined;
}

function firstText(...values: unknown[]) {
  return values.map(text).find(Boolean);
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonValue(value: unknown) {
  return structuredClone(value) as Prisma.InputJsonValue;
}

function fromDiditStatus(status: DiditAmlResponse["aml"]["status"]) {
  return status === "Approved"
    ? ("APPROVED" as const)
    : status === "In Review"
      ? ("IN_REVIEW" as const)
      : ("DECLINED" as const);
}

function fromDiditReviewStatus(value: unknown): CmpAmlReviewStatus {
  if (value === "Confirmed Match") {
    return "CONFIRMED_MATCH";
  }
  if (value === "False Positive") {
    return "FALSE_POSITIVE";
  }
  if (value === "Inconclusive") {
    return "INCONCLUSIVE";
  }
  return "UNREVIEWED";
}

function toDiditReviewStatus(value: CmpAmlReviewStatus) {
  return {
    UNREVIEWED: "Unreviewed",
    CONFIRMED_MATCH: "Confirmed Match",
    FALSE_POSITIVE: "False Positive",
    INCONCLUSIVE: "Inconclusive",
  }[value];
}

function diditHitId(
  hit: DiditAmlHit,
  response: DiditAmlResponse,
  index: number
) {
  return typeof hit.id === "string" && hit.id
    ? hit.id
    : `${response.request_id}:${index}`;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeWarnings(warnings: unknown[]) {
  return warnings.map((warning) =>
    typeof warning === "string" ? warning : stableStringify(warning)
  );
}

function normalizeDiditError(error: unknown) {
  return error instanceof DiditAmlError
    ? error
    : new DiditAmlError(
        "DIDIT_UNKNOWN_ERROR",
        "Didit AML screening could not be completed"
      );
}

async function resolveDiditStatus(didit: DiditAmlClient) {
  const client = didit as DiditAmlClient & {
    getStatus?: () => Promise<{ enabled: boolean; configured: boolean }>;
  };
  if (client.getStatus) {
    return client.getStatus();
  }
  return { enabled: didit.enabled, configured: didit.configured };
}

function runningRecoveryDelayMs() {
  const configuredTimeout = Number(process.env.PROJECT_WING_DIDIT_TIMEOUT_MS);
  const timeout =
    Number.isFinite(configuredTimeout) && configuredTimeout >= 1000
      ? configuredTimeout
      : 30_000;
  return timeout * 2 + 1000;
}

function assertCanAccessAcceptance(
  acceptance: {
    submittedById?: string;
    micApproverId?: string;
    picApproverId?: string | null;
    itApproverId?: string | null;
    draftAssigneeId?: string | null;
    acceptanceRequestId?: string;
  },
  user: RequestUser
) {
  if (user.globalRole === "SUPER_ADMIN") {
    return;
  }
  if (
    [
      acceptance.submittedById,
      acceptance.micApproverId,
      acceptance.picApproverId,
      acceptance.itApproverId,
      acceptance.draftAssigneeId,
    ].includes(user.id)
  ) {
    return;
  }
  throw new ApiForbiddenException(
    "FORBIDDEN",
    "You do not have access to this AML screening"
  );
}

export function deriveAmlAttentionCount(batch: {
  attentionCount: number;
  subjects?: {
    status: CmpAmlScreeningStatus;
    hits: { reviewStatus: CmpAmlReviewStatus }[];
  }[];
}) {
  if (!batch.subjects) {
    return batch.attentionCount;
  }
  const derived = batch.subjects.filter(
    (subject) =>
      subject.status === "IN_REVIEW" ||
      subject.status === "DECLINED" ||
      subject.hits.some((hit) => hit.reviewStatus === "CONFIRMED_MATCH")
  ).length;
  return Math.max(batch.attentionCount, derived);
}

function serializeBatch(batch: AmlBatchWithRelations) {
  return {
    id: batch.id,
    acceptanceRequestId: batch.acceptanceRequestId,
    clientId: batch.clientId,
    requestFingerprint: batch.requestFingerprint,
    forceRun: batch.forceRun,
    status: batch.status,
    subjectCount: batch.subjectCount,
    attentionCount: deriveAmlAttentionCount(batch),
    errorCount: batch.errorCount,
    triggeredBy: batch.triggeredBy,
    createdAt: batch.createdAt.toISOString(),
    completedAt: batch.completedAt?.toISOString() ?? null,
    subjects: batch.subjects.map((subject) => ({
      id: subject.id,
      subjectKey: subject.subjectKey,
      entityType: subject.entityType,
      roles: Array.isArray(subject.rolesJson) ? subject.rolesJson : [],
      displayName: subject.displayName,
      status: subject.status,
      score: subject.score,
      totalHits: subject.totalHits,
      warnings: Array.isArray(subject.warningsJson) ? subject.warningsJson : [],
      errorCode: subject.errorCode,
      errorMessage: subject.errorMessage,
      diditRequestId: subject.diditRequestId,
      startedAt: subject.startedAt.toISOString(),
      completedAt: subject.completedAt.toISOString(),
      hits: subject.hits.map(serializeHit),
    })),
  };
}

function serializeHit(hit: {
  id: string;
  diditHitId: string;
  reviewStatus: CmpAmlReviewStatus;
  matchScore: number | null;
  riskScore: number | null;
  detailsJson: Prisma.JsonValue;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  createdAt: Date;
}) {
  return {
    id: hit.id,
    diditHitId: hit.diditHitId,
    reviewStatus: hit.reviewStatus,
    matchScore: hit.matchScore,
    riskScore: hit.riskScore,
    details:
      hit.detailsJson &&
      typeof hit.detailsJson === "object" &&
      !Array.isArray(hit.detailsJson)
        ? hit.detailsJson
        : {},
    reviewedBy: hit.reviewedBy,
    reviewedAt: hit.reviewedAt?.toISOString() ?? null,
    reviewComment: hit.reviewComment,
    createdAt: hit.createdAt.toISOString(),
  };
}
