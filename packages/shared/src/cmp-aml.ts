import { z } from "zod";

export const CmpAmlConfigurationStatusSchema = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
  source: z.enum(["DATABASE", "ENVIRONMENT"]).nullable(),
  updatedAt: z.string().datetime().nullable(),
  updatedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
});
export type CmpAmlConfigurationStatus = z.infer<
  typeof CmpAmlConfigurationStatusSchema
>;

export const CmpAmlConfigurationInputSchema = z.object({
  apiKey: z.string().trim().min(1).max(4096),
});
export type CmpAmlConfigurationInput = z.infer<
  typeof CmpAmlConfigurationInputSchema
>;

export const CmpAmlBatchStatusSchema = z.enum([
  "RUNNING",
  "COMPLETED",
  "PARTIAL_FAILED",
  "FAILED",
]);
export type CmpAmlBatchStatus = z.infer<typeof CmpAmlBatchStatusSchema>;

export const CmpAmlScreeningStatusSchema = z.enum([
  "APPROVED",
  "IN_REVIEW",
  "DECLINED",
  "ERROR",
]);
export type CmpAmlScreeningStatus = z.infer<typeof CmpAmlScreeningStatusSchema>;

export const CmpAmlEntityTypeSchema = z.enum(["PERSON", "COMPANY"]);
export type CmpAmlEntityType = z.infer<typeof CmpAmlEntityTypeSchema>;

export const CmpAmlSubjectRoleSchema = z.enum([
  "CLIENT",
  "GROUP_COMPANY",
  "OWNER",
  "BENEFICIAL_OWNER",
  "DIRECTOR",
  "CONTROLLER",
]);
export type CmpAmlSubjectRole = z.infer<typeof CmpAmlSubjectRoleSchema>;

export const CmpAmlReviewStatusSchema = z.enum([
  "UNREVIEWED",
  "CONFIRMED_MATCH",
  "FALSE_POSITIVE",
  "INCONCLUSIVE",
]);
export type CmpAmlReviewStatus = z.infer<typeof CmpAmlReviewStatusSchema>;

export const CmpAmlRunInputSchema = z.object({
  force: z.boolean().optional().default(false),
  subjectKeys: z.array(z.string().trim().min(1)).min(1).optional(),
});
export type CmpAmlRunInput = z.infer<typeof CmpAmlRunInputSchema>;

export const CmpAmlHitReviewInputSchema = z.object({
  reviewStatus: CmpAmlReviewStatusSchema,
  comment: z.string().trim().max(1000).optional(),
});
export type CmpAmlHitReviewInput = z.infer<typeof CmpAmlHitReviewInputSchema>;

export const CmpAmlReviewerSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const CmpAmlHitSchema = z.object({
  id: z.string(),
  diditHitId: z.string(),
  reviewStatus: CmpAmlReviewStatusSchema,
  matchScore: z.number().nullable(),
  riskScore: z.number().nullable(),
  details: z.record(z.string(), z.unknown()),
  reviewedBy: CmpAmlReviewerSchema.nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reviewComment: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type CmpAmlHit = z.infer<typeof CmpAmlHitSchema>;

export const CmpAmlScreeningSubjectSchema = z.object({
  id: z.string(),
  subjectKey: z.string(),
  entityType: CmpAmlEntityTypeSchema,
  roles: z.array(CmpAmlSubjectRoleSchema),
  displayName: z.string(),
  status: CmpAmlScreeningStatusSchema,
  score: z.number().nullable(),
  totalHits: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  diditRequestId: z.string().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  hits: z.array(CmpAmlHitSchema),
});
export type CmpAmlScreeningSubject = z.infer<
  typeof CmpAmlScreeningSubjectSchema
>;

export const CmpAmlCandidateSchema = z.object({
  subjectKey: z.string(),
  entityType: CmpAmlEntityTypeSchema,
  roles: z.array(CmpAmlSubjectRoleSchema),
  displayName: z.string(),
  ready: z.boolean(),
  warnings: z.array(z.string()),
});
export type CmpAmlCandidate = z.infer<typeof CmpAmlCandidateSchema>;

export const CmpAmlScreeningBatchSchema = z.object({
  id: z.string(),
  acceptanceRequestId: z.string(),
  clientId: z.string().nullable(),
  requestFingerprint: z.string(),
  forceRun: z.boolean(),
  status: CmpAmlBatchStatusSchema,
  subjectCount: z.number().int().nonnegative(),
  attentionCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  triggeredBy: CmpAmlReviewerSchema,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  subjects: z.array(CmpAmlScreeningSubjectSchema),
});
export type CmpAmlScreeningBatch = z.infer<typeof CmpAmlScreeningBatchSchema>;

export const CmpAmlLatestResponseSchema = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
  canReviewHits: z.boolean(),
  currentInputFingerprint: z.string().nullable(),
  isStale: z.boolean(),
  availableSubjects: z.array(CmpAmlCandidateSchema),
  batch: CmpAmlScreeningBatchSchema.nullable(),
});
export type CmpAmlLatestResponse = z.infer<typeof CmpAmlLatestResponseSchema>;

export const CmpAmlSummarySchema = z.object({
  status: z.enum(["NOT_RUN", "CLEAR", "ATTENTION", "ERROR"]),
  subjectCount: z.number().int().nonnegative(),
  attentionCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  lastScreenedAt: z.string().datetime().nullable(),
});
export type CmpAmlSummary = z.infer<typeof CmpAmlSummarySchema>;
