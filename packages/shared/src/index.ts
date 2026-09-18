import { z } from "zod";

import { BetterAuthClientError } from "./auth-client-error.js";
import type {
  CmpCompanyIdentityResolution,
  CmpEntityRelationshipDraftSchema,
  CmpGroupRelationshipDraftSchema,
  CmpRelatedEntityDraftSchema,
} from "./cmp-entity-graph.js";
import { CmpCompanyIdentityResolutionSchema } from "./cmp-entity-graph.js";
import { DESKTOP_AGENT_MASTER_OPEN_SUPPORTED_EXTENSIONS } from "./desktop.js";
import { EmailOtpClientError } from "./email-otp-client-error.js";
import type { EmailOtpClientErrorCode } from "./email-otp-client-error.js";
import {
  SmartFormV2DefinitionSchema,
  SmartFormV2ResponseSchema,
} from "./smart-form-v2.js";

export {
  CmpAmlConfigurationInputSchema,
  CmpAmlConfigurationStatusSchema,
  CmpAmlBatchStatusSchema,
  CmpAmlCandidateSchema,
  CmpAmlEntityTypeSchema,
  CmpAmlHitReviewInputSchema,
  CmpAmlHitSchema,
  CmpAmlLatestResponseSchema,
  CmpAmlReviewStatusSchema,
  CmpAmlRunInputSchema,
  CmpAmlScreeningBatchSchema,
  CmpAmlScreeningStatusSchema,
  CmpAmlScreeningSubjectSchema,
  CmpAmlSubjectRoleSchema,
  CmpAmlSummarySchema,
  type CmpAmlBatchStatus,
  type CmpAmlConfigurationInput,
  type CmpAmlConfigurationStatus,
  type CmpAmlCandidate,
  type CmpAmlEntityType,
  type CmpAmlHit,
  type CmpAmlHitReviewInput,
  type CmpAmlLatestResponse,
  type CmpAmlReviewStatus,
  type CmpAmlRunInput,
  type CmpAmlScreeningBatch,
  type CmpAmlScreeningStatus,
  type CmpAmlScreeningSubject,
  type CmpAmlSubjectRole,
  type CmpAmlSummary,
} from "./cmp-aml.js";

export {
  BetterAuthClientError,
  EmailOtpClientError,
  type EmailOtpClientErrorCode,
} from "./auth-client-errors.js";

export {
  CMP_HONG_KONG_PUBLIC_HOLIDAYS,
  getCmpHongKongWorkdaySummary,
  type CmpHongKongWorkdaySummary,
} from "./cmp-hong-kong-holidays.js";

export {
  DESKTOP_AGENT_MASTER_OPEN_SUPPORTED_EXTENSIONS,
  DESKTOP_AGENT_OPEN_SUPPORTED_EXTENSIONS,
  DESKTOP_AGENT_READ_ONLY_OPEN_SUPPORTED_EXTENSIONS,
  DesktopAgentCheckInRequestSchema,
  DesktopAgentCheckInResponseSchema,
  DesktopAgentCloseDetectionSourceSchema,
  DesktopAgentClosedRequestSchema,
  DesktopAgentDeviceAuthStatusResponseSchema,
  DesktopAgentErrorResponseSchema,
  DesktopAgentHealthDiagnosticsSchema,
  DesktopAgentHealthResponseSchema,
  DesktopAgentLaunchAbortReleaseRequestSchema,
  DesktopAgentLaunchFailedReasonSchema,
  DesktopAgentLaunchFailedRequestSchema,
  DesktopAgentModeSchema,
  DesktopAgentOpenObservationSourceSchema,
  DesktopAgentOpenObservedRequestSchema,
  DesktopAgentOpenRequestSchema,
  DesktopAgentOpenResponseSchema,
  DesktopAgentPendingReleaseReasonSchema,
  DesktopAgentPrintDocumentSchema,
  DesktopAgentPrinterSchema,
  DesktopAgentPrintersResponseSchema,
  DesktopAgentPrintRequestSchema,
  DesktopAgentPrintResponseSchema,
  DesktopAgentRecentSessionSchema,
  DesktopAgentReleaseManifestSchema,
  DesktopAgentReleaseRequestSchema,
  DesktopAgentReleaseResponseSchema,
  DesktopAgentSessionContentStateSchema,
  DesktopAgentSessionLifecycleStateSchema,
  DesktopAgentSessionSchema,
  DesktopAgentSessionsResponseSchema,
  DesktopAgentSessionStatusSchema,
  DesktopAgentStartDevicePairSchema,
  DesktopAgentUpdateErrorCodeSchema,
  DesktopAgentUpdateRequestSchema,
  DesktopAgentUpdateResponseSchema,
  DesktopAgentUpdateStatusResponseSchema,
  DesktopAgentUpdateStatusSchema,
  DesktopAgentWindowsSignaturePolicySchema,
  DesktopRuntimeAgentStateSchema,
  DesktopRuntimeRestoreStateSchema,
  DesktopRuntimeUpdateStateSchema,
  DesktopUploadGrantSchema,
  getDesktopAgentCompatibilityStatus,
  isDesktopAgentOpenSupportedFileName,
  PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
} from "./desktop.js";
export type {
  DesktopAgentCheckInRequest,
  DesktopAgentCheckInResponse,
  DesktopAgentCloseDetectionSource,
  DesktopAgentClosedRequest,
  DesktopAgentDeviceAuthStatusResponse,
  DesktopAgentErrorResponse,
  DesktopAgentHealthDiagnostics,
  DesktopAgentHealthResponse,
  DesktopAgentLaunchAbortReleaseRequest,
  DesktopAgentLaunchFailedReason,
  DesktopAgentLaunchFailedRequest,
  DesktopAgentMode,
  DesktopAgentOpenObservationSource,
  DesktopAgentOpenObservedRequest,
  DesktopAgentOpenRequest,
  DesktopAgentOpenResponse,
  DesktopAgentPendingReleaseReason,
  DesktopAgentPrintDocument,
  DesktopAgentPrinter,
  DesktopAgentPrintersResponse,
  DesktopAgentPrintRequest,
  DesktopAgentPrintResponse,
  DesktopAgentRecentSession,
  DesktopAgentReleaseManifest,
  DesktopAgentReleaseRequest,
  DesktopAgentReleaseResponse,
  DesktopAgentSession,
  DesktopAgentSessionContentState,
  DesktopAgentSessionLifecycleState,
  DesktopAgentSessionsResponse,
  DesktopAgentSessionStatus,
  DesktopAgentStartDevicePair,
  DesktopAgentUpdateErrorCode,
  DesktopAgentUpdateRequest,
  DesktopAgentUpdateResponse,
  DesktopAgentUpdateStatus,
  DesktopAgentUpdateStatusResponse,
  DesktopAgentWindowsSignaturePolicy,
  DesktopRuntimeAgentState,
  DesktopRuntimeRestoreState,
  DesktopRuntimeUpdateState,
  DesktopUploadGrant,
} from "./desktop.js";
export {
  ConfirmationInformationLibraryBankCodeSchema,
  ConfirmationInformationLibraryCreateInputSchema,
  ConfirmationInformationLibraryEntrySchema,
  ConfirmationInformationLibraryUpdateInputSchema,
} from "./confirmation-information-library.js";
export type {
  ConfirmationInformationLibraryCreateInput,
  ConfirmationInformationLibraryEntry,
  ConfirmationInformationLibraryUpdateInput,
} from "./confirmation-information-library.js";
export {
  CONFIRMATION_TEMPLATE_FONT_FAMILIES,
  DEFAULT_CONFIRMATION_TEMPLATE_HIGHLIGHT_COLOR,
  CONFIRMATION_TEMPLATE_FONT_SIZES,
  DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
} from "./confirmation-template-design.js";
export type {
  ConfirmationTemplateFontFamily,
  ConfirmationTemplateFontSize,
  ConfirmationTemplateLayoutText,
  ConfirmationTemplateTextStyle,
} from "./confirmation-template-design.js";
export {
  classifyCmpRelationshipConflict,
  CmpClientEntityRoleSchema,
  CmpClientGraphEdgeSchema,
  CmpClientGraphNodeSchema,
  CmpClientGraphQuerySchema,
  CmpClientGraphSchema,
  CmpCompanyIdentityMatchQuerySchema,
  CmpCompanyIdentityMatchResponseSchema,
  CmpCompanyIdentityMatchSchema,
  CmpCompanyIdentityResolutionActionSchema,
  CmpCompanyIdentityResolutionSchema,
  CmpCompanyProfileSchema,
  CmpCompanyTypeSchema,
  CmpDraftEntityReferenceSchema,
  CmpEntityKindSchema,
  CmpEntityRelationshipDraftSchema,
  CmpEntityRelationshipSchema,
  CmpEntityRelationshipsResponseSchema,
  CmpEntityRelationshipTypeSchema,
  CmpGroupRelationshipDraftSchema,
  CmpGroupRelationshipMethodSchema,
  CmpGroupRelationshipParticipantInputSchema,
  CmpGroupRelationshipParticipantSchema,
  CmpGroupRelationshipSchema,
  CmpGroupRelationshipsResponseSchema,
  CmpGroupRelationshipTypeSchema,
  CmpEntityStatusSchema,
  CmpPersonProfileSchema,
  CmpRelatedEntitiesResponseSchema,
  CmpRelatedEntityDraftSchema,
  CmpRelatedEntitySchema,
  CreateCmpEntityRelationshipSchema,
  CreateCmpGroupRelationshipSchema,
  CreateCmpRelatedEntitySchema,
  isCmpRelationshipEndpointCompatible,
  UpdateCmpEntityRelationshipSchema,
  UpdateCmpGroupRelationshipSchema,
  UpdateCmpRelatedEntitySchema,
} from "./cmp-entity-graph.js";
export type {
  CmpClientEntityRole,
  CmpClientGraph,
  CmpClientGraphEdge,
  CmpClientGraphNode,
  CmpClientGraphQuery,
  CmpCompanyIdentityMatch,
  CmpCompanyIdentityMatchResponse,
  CmpCompanyIdentityResolution,
  CmpCompanyProfile,
  CmpCompanyType,
  CmpEntityKind,
  CmpEntityRelationship,
  CmpEntityRelationshipDraft,
  CmpEntityRelationshipsResponse,
  CmpEntityRelationshipType,
  CmpGroupRelationship,
  CmpGroupRelationshipDraft,
  CmpGroupRelationshipMethod,
  CmpGroupRelationshipsResponse,
  CmpGroupRelationshipType,
  CmpEntityStatus,
  CmpPersonProfile,
  CmpRelatedEntitiesResponse,
  CmpRelatedEntity,
  CmpRelatedEntityDraft,
  CmpRelationshipCompatibilityRecord,
  CmpRelationshipConflictKind,
  CreateCmpEntityRelationshipInput,
  CreateCmpGroupRelationshipInput,
  CreateCmpRelatedEntityInput,
  UpdateCmpEntityRelationshipInput,
  UpdateCmpGroupRelationshipInput,
  UpdateCmpRelatedEntityInput,
} from "./cmp-entity-graph.js";
export { inferCmpOwnership } from "./cmp-ownership-inference.js";
export type {
  CmpOwnershipCandidateStatus,
  CmpOwnershipCompanyCoverage,
  CmpOwnershipEntity,
  CmpOwnershipInferenceCandidate,
  CmpOwnershipInferenceInput,
  CmpOwnershipInferenceIssue,
  CmpOwnershipInferenceResult,
  CmpOwnershipObservation,
} from "./cmp-ownership-inference.js";
export {
  buildApplicationHomePath,
  buildLocalizedLoginPath,
  resolveSafeNextPath,
} from "./auth-navigation.js";
export type { AuthApplication, AuthLocale } from "./auth-navigation.js";
export { readLoginFormValues } from "./login-form.js";
export type { LoginFormValues } from "./login-form.js";
export {
  SmartFormV2AttachmentFieldDefinitionSchema,
  SmartFormV2AttachmentReferenceSchema,
  SmartFormV2AttachmentValueSchema,
  SmartFormV2ChoiceFieldDefinitionSchema,
  SmartFormV2ChoiceOptionSchema,
  SmartFormV2ChoiceValueSchema,
  SmartFormV2ComponentInstanceNodeSchema,
  SmartFormV2BranchComparisonSchema,
  SmartFormV2BranchQuestionSchema,
  SmartFormV2ConditionalArmSchema,
  SmartFormV2ConditionalNodeSchema,
  SmartFormV2ConditionalOtherwiseArmSchema,
  SmartFormV2ComponentLockSchema,
  SmartFormV2ContentNodeSchema,
  SmartFormV2DateFieldDefinitionSchema,
  SmartFormV2DateTokenSchema,
  SmartFormV2DateValueSchema,
  SmartFormV2DecimalSchema,
  SmartFormV2DefinitionSchema,
  SmartFormV2EntityTypeSchema,
  SmartFormV2ExpressionSchema,
  SmartFormV2FieldAnswerSchema,
  SmartFormV2FieldDefinitionSchema,
  SmartFormV2FieldNodeSchema,
  SmartFormV2FieldTemplateSchema,
  SmartFormV2FieldValueSchema,
  SmartFormV2FixedSheetRowSchema,
  SmartFormV2FixedSheetRowsSchema,
  SmartFormV2GroupNodeSchema,
  SmartFormV2I18nConfigSchema,
  SmartFormV2IdSchema,
  SmartFormV2LocaleTagSchema,
  SmartFormV2LocalizedFieldValueSchema,
  SmartFormV2LocalizedRichTextSchema,
  SmartFormV2NodePresentationSchema,
  SmartFormV2NodeSchema,
  SmartFormV2NumberFieldDefinitionSchema,
  SmartFormV2NumberingRuleSchema,
  SmartFormV2NumberValueSchema,
  SmartFormV2ReferenceFieldDefinitionSchema,
  SmartFormV2ReferenceTargetTypeSchema,
  SmartFormV2ReferenceValueSchema,
  SmartFormV2RepeatableSheetRowsSchema,
  SmartFormV2ResponseSchema,
  SmartFormV2RichTextBlockSchema,
  SmartFormV2RichTextBlockTypeSchema,
  SmartFormV2RichTextDocumentSchema,
  SmartFormV2RichTextFieldDefinitionSchema,
  SmartFormV2RichTextInlineSchema,
  SmartFormV2RichTextMarkSchema,
  SmartFormV2RichTextMarkTypeSchema,
  SmartFormV2RichTextProfileSchema,
  SmartFormV2RichTextValueSchema,
  SmartFormV2SectionNodeSchema,
  SmartFormV2SheetAnswerRowSchema,
  SmartFormV2SheetAnswerSchema,
  SmartFormV2SheetCellOverrideSchema,
  SmartFormV2SheetCellTemplateSchema,
  SmartFormV2SheetColumnNodeSchema,
  SmartFormV2SheetNodeSchema,
  SmartFormV2SheetPresentationSchema,
  SmartFormV2StructuredReferenceSchema,
  SmartFormV2TextFieldDefinitionSchema,
  SmartFormV2TextValueSchema,
  SmartFormV2ValidationRuleSchema,
} from "./smart-form-v2.js";
export type {
  SmartFormV2ChoiceOption,
  SmartFormV2ColumnId,
  SmartFormV2ComponentId,
  SmartFormV2ComponentInstanceNode,
  SmartFormV2BranchComparison,
  SmartFormV2BranchQuestion,
  SmartFormV2BranchQuestionFieldDefinition,
  SmartFormV2ConditionalArm,
  SmartFormV2ComponentLock,
  SmartFormV2ContentNode,
  SmartFormV2ConditionalNode,
  SmartFormV2ConditionalOtherwiseArm,
  SmartFormV2Definition,
  SmartFormV2EntityType,
  SmartFormV2Expression,
  SmartFormV2FieldAnswer,
  SmartFormV2FieldDefinition,
  SmartFormV2FieldId,
  SmartFormV2FieldNode,
  SmartFormV2FieldTemplate,
  SmartFormV2FieldValue,
  SmartFormV2FixedSheetRow,
  SmartFormV2GroupNode,
  SmartFormV2I18nConfig,
  SmartFormV2LocaleTag,
  SmartFormV2LocalizedRichText,
  SmartFormV2Node,
  SmartFormV2NodeId,
  SmartFormV2NodePresentation,
  SmartFormV2NumberingRule,
  SmartFormV2OptionId,
  SmartFormV2Response,
  SmartFormV2RichTextBlock,
  SmartFormV2RichTextDocument,
  SmartFormV2RichTextInline,
  SmartFormV2RichTextMark,
  SmartFormV2RichTextProfile,
  SmartFormV2RowId,
  SmartFormV2RowInstanceId,
  SmartFormV2SectionNode,
  SmartFormV2SheetCellOverride,
  SmartFormV2SheetCellTemplate,
  SmartFormV2SheetColumnGroup,
  SmartFormV2SheetColumnNode,
  SmartFormV2SheetId,
  SmartFormV2SheetLeafColumn,
  SmartFormV2SheetNode,
  SmartFormV2SheetPresentation,
  SmartFormV2ValidationRule,
} from "./smart-form-v2.js";
export {
  compileSmartFormV2Definition,
  defineSmartFormV2Component,
  SmartFormV2ComponentRegistry,
} from "./smart-form-v2-compiler.js";
export type {
  SmartFormV2CompiledDefinition,
  SmartFormV2CompileError,
  SmartFormV2CompileErrorCode,
  SmartFormV2ComponentCompileInput,
  SmartFormV2ComponentDefinition,
  SmartFormV2CoreConditionalNode,
  SmartFormV2CoreGroupNode,
  SmartFormV2CoreNode,
  SmartFormV2CoreSectionNode,
} from "./smart-form-v2-compiler.js";
export {
  AUDIT_PROCEDURE_SHEET_COMPONENT_DIGEST,
  AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
  AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION,
  AuditProcedureSheetComponent,
  AuditProcedureSheetPropsSchema,
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
} from "./smart-form-v2-components.js";
export type {
  AuditProcedureSheetProps,
  AuditProcedureSheetRow,
} from "./smart-form-v2-components.js";
export {
  DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_REFERENCE_OPTIONS,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
  CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE,
  CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
} from "./smart-form-v2-fixtures.js";
export {
  isSmartFormV2ExpressionTrue,
  resolveSmartFormV2ConditionalBranch,
  smartFormV2FieldIssueKey,
  smartFormV2SheetCellIssueKey,
  validateSmartFormV2Response,
} from "./smart-form-v2-validation.js";
export type {
  SmartFormV2ResponseValidationIssue,
  SmartFormV2ResponseValidationResult,
  SmartFormV2ConditionalBranch,
} from "./smart-form-v2-validation.js";

export const EMAIL_SIGN_IN_OTP_LENGTH = 6;
export const EMAIL_SIGN_IN_OTP_RESEND_SECONDS = 60;
export const EMAIL_SIGN_IN_OTP_MOCK_CODE = "123456";

export type BetterAuthFetch = (
  url: string,
  init: {
    body?: string;
    credentials: "include";
    headers?: Record<string, string>;
    method: "POST";
  }
) => Promise<{
  json?: () => Promise<unknown>;
  ok: boolean;
  status?: number;
}>;

export async function signInWithBetterAuth(
  input: {
    baseURL: string;
    email: string;
    password: string;
    rememberMe?: boolean;
  },
  fetcher: BetterAuthFetch = browserFetch
) {
  const response = await fetcher(
    `${normalizeBetterAuthBaseURL(input.baseURL)}/auth/sign-in/email`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        rememberMe: input.rememberMe ?? false,
      }),
    }
  );
  if (!response.ok) {
    throw new BetterAuthClientError(
      await resolveBetterAuthError(response),
      response.status
    );
  }
}

export async function requestEmailSignInOtp(
  input: { baseURL: string; email: string },
  fetcher: BetterAuthFetch = browserFetch
) {
  const response = await fetcher(
    `${normalizeBetterAuthBaseURL(input.baseURL)}/auth/email-otp/send-verification-otp`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email, type: "sign-in" }),
    }
  );
  if (!response.ok) {
    throw new EmailOtpClientError(
      response.status === 429 ? "OTP_RATE_LIMITED" : "OTP_UNAVAILABLE",
      response.status
    );
  }
}

export async function signInWithEmailOtp(
  input: { baseURL: string; email: string; otp: string },
  fetcher: BetterAuthFetch = browserFetch
) {
  const response = await fetcher(
    `${normalizeBetterAuthBaseURL(input.baseURL)}/auth/sign-in/email-otp`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email, otp: input.otp }),
    }
  );
  if (!response.ok) {
    const message = await resolveBetterAuthError(response);
    throw new EmailOtpClientError(
      resolveEmailOtpErrorCode(message, response.status),
      response.status
    );
  }
}

export async function requestEmailPasswordResetOtp(
  input: { baseURL: string; email: string },
  fetcher: BetterAuthFetch = browserFetch
) {
  const response = await fetcher(
    `${normalizeBetterAuthBaseURL(input.baseURL)}/auth/email-otp/request-password-reset`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email }),
    }
  );
  if (!response.ok) {
    throw new EmailOtpClientError(
      response.status === 429 ? "OTP_RATE_LIMITED" : "OTP_UNAVAILABLE",
      response.status
    );
  }
}

export async function verifyEmailPasswordResetOtp(
  input: { baseURL: string; email: string; otp: string },
  fetcher: BetterAuthFetch = browserFetch
) {
  const response = await fetcher(
    `${normalizeBetterAuthBaseURL(input.baseURL)}/auth/email-otp/check-verification-otp`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        otp: input.otp,
        type: "forget-password",
      }),
    }
  );
  if (!response.ok) {
    const message = await resolveBetterAuthError(response);
    throw new EmailOtpClientError(
      resolveEmailOtpErrorCode(message, response.status),
      response.status
    );
  }
}

export async function resetPasswordWithEmailOtp(
  input: {
    baseURL: string;
    email: string;
    otp: string;
    password: string;
  },
  fetcher: BetterAuthFetch = browserFetch
) {
  const response = await fetcher(
    `${normalizeBetterAuthBaseURL(input.baseURL)}/auth/email-otp/reset-password`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        otp: input.otp,
        password: input.password,
      }),
    }
  );
  if (!response.ok) {
    const message = await resolveBetterAuthError(response);
    throw new EmailOtpClientError(
      resolveEmailOtpErrorCode(message, response.status),
      response.status
    );
  }
}

export async function signOutWithBetterAuth(
  baseURL: string,
  fetcher: BetterAuthFetch = browserFetch
) {
  const response = await fetcher(
    `${normalizeBetterAuthBaseURL(baseURL)}/auth/sign-out`,
    {
      method: "POST",
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new BetterAuthClientError(
      await resolveBetterAuthError(response),
      response.status
    );
  }
}

export function resolveProjectWingIntranetUrl(
  input: {
    hostname?: string | null;
    domainSuffix?: string | null;
  } = {}
) {
  const hostname = input.hostname?.trim().toLowerCase();
  const domainSuffix = input.domainSuffix?.trim().toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    (!hostname && !domainSuffix)
  ) {
    return "http://localhost:3007/";
  }

  if (hostname?.endsWith(".wzcpa.hk") || domainSuffix === "wzcpa.hk") {
    return "https://intranet.wzcpa.hk/";
  }
  return "https://intranet.superfx.cn/";
}

function browserFetch(url: string, init: Parameters<BetterAuthFetch>[1]) {
  return globalThis.fetch(url, init);
}

function normalizeBetterAuthBaseURL(baseURL: string) {
  return baseURL.replace(/\/+$/, "");
}

async function resolveBetterAuthError(response: {
  json?: () => Promise<unknown>;
  status?: number;
}) {
  try {
    const body = await response.json?.();
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return body.message;
    }
  } catch {
    // Fall back to a stable client-side error message.
  }
  return response.status
    ? `Authentication request failed (${response.status})`
    : "Authentication request failed";
}

function resolveEmailOtpErrorCode(
  message: string,
  status?: number
): EmailOtpClientErrorCode {
  if (status === 429) {
    return "OTP_RATE_LIMITED";
  }
  const normalized = message.trim().toLowerCase();
  if (normalized.includes("expired")) {
    return "OTP_EXPIRED";
  }
  if (normalized.includes("too many attempts")) {
    return "OTP_TOO_MANY_ATTEMPTS";
  }
  return "OTP_INVALID";
}

export function formatNumberWithoutDigitFour(
  value: number,
  minLength: number,
  step = 1
) {
  const increment = Math.max(1, Math.floor(step));
  const nextValue = nextNumberWithoutDigitFour(
    Math.max(0, Math.floor(value)),
    increment
  );
  return String(nextValue).padStart(minLength, "0");
}

export function normalizeCodeWithoutDigitFour(code: string) {
  return code.replaceAll(/\d+/g, (digits) => {
    if (!digits.includes("4")) {
      return digits;
    }
    return formatNumberWithoutDigitFour(
      Number(digits),
      digits.length,
      inferNumberingStep(digits)
    );
  });
}

export function normalizeCodeSequenceWithoutDigitFour(
  codes: readonly string[]
) {
  const nextValueBySeries = new Map<string, number>();
  return codes.map((code) => {
    const normalizedCode = normalizeCodeWithoutDigitFour(code);
    const segment = parseLastNumericSegment(normalizedCode);
    if (!segment) {
      return normalizedCode;
    }

    const step = inferCodeSequenceStep(segment.prefix, segment.digits);
    const seriesKey = [
      segment.prefix,
      segment.suffix,
      segment.digits.length,
      step,
    ].join("\0");
    const minimumValue = nextValueBySeries.get(seriesKey) ?? 0;
    const nextValue = Math.max(Number(segment.digits), minimumValue);
    const nextDigits = formatNumberWithoutDigitFour(
      nextValue,
      segment.digits.length,
      step
    );
    nextValueBySeries.set(seriesKey, Number(nextDigits) + step);
    return `${segment.prefix}${nextDigits}${segment.suffix}`;
  });
}

function parseLastNumericSegment(code: string) {
  const match = code.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) {
    return null;
  }
  return {
    prefix: match[1] ?? "",
    digits: match[2] ?? "",
    suffix: match[3] ?? "",
  };
}

function inferCodeSequenceStep(prefix: string, digits: string) {
  if (!prefix.endsWith("-")) {
    return 1;
  }
  return inferNumberingStep(digits);
}

function inferNumberingStep(digits: string) {
  const trailingZeros = digits.match(/0+$/)?.[0].length ?? 0;
  return 10 ** trailingZeros;
}

function nextNumberWithoutDigitFour(value: number, step: number) {
  if (!String(value).includes("4")) {
    return value;
  }
  if (step === 1) {
    return nextIntegerWithoutDigitFour(value);
  }

  const powerOfTenExponent = getPowerOfTenExponent(step);
  if (powerOfTenExponent !== null) {
    const base = 10 ** powerOfTenExponent;
    const lower = value % base;
    if (!String(lower).includes("4")) {
      return (
        nextIntegerWithoutDigitFour(Math.floor(value / base)) * base + lower
      );
    }
  }

  let nextValue = value;
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    if (!String(nextValue).includes("4")) {
      return nextValue;
    }
    nextValue += step;
  }
  return nextIntegerWithoutDigitFour(nextValue);
}

function nextIntegerWithoutDigitFour(value: number) {
  const digits = [...String(value)];
  const firstFourIndex = digits.indexOf("4");
  if (firstFourIndex === -1) {
    return value;
  }
  digits[firstFourIndex] = "5";
  for (let index = firstFourIndex + 1; index < digits.length; index += 1) {
    digits[index] = "0";
  }
  return Number(digits.join(""));
}

function getPowerOfTenExponent(value: number) {
  if (value < 1) {
    return null;
  }
  const exponent = Math.log10(value);
  return Number.isInteger(exponent) ? exponent : null;
}

export const GlobalRoleSchema = z.enum([
  "SUPER_ADMIN",
  "HR",
  "CONFIRMATION_OFFICER",
  "PARTNER",
  "PRINCIPAL",
  "MANAGER",
  "SENIOR",
  "STAFF",
  "ASSISTANT",
  "EQCR",
  "TAX_EXPERT",
]);
export type GlobalRole = z.infer<typeof GlobalRoleSchema>;
export const GLOBAL_ROLES = GlobalRoleSchema.options;
/** Database compatibility only; new users cannot select this retired role. */
export type LegacyGlobalRole = "SENIOR_MANAGER";
export type GlobalRoleInput = GlobalRole | LegacyGlobalRole;

export const CONFIRMATION_TEMPLATE_MANAGER_GLOBAL_ROLES = [
  "SUPER_ADMIN",
] as const satisfies readonly GlobalRole[];

export function canGlobalRoleManageConfirmationTemplates(
  globalRole: GlobalRoleInput
) {
  return CONFIRMATION_TEMPLATE_MANAGER_GLOBAL_ROLES.some(
    (role) => role === normalizeGlobalRole(globalRole)
  );
}

function normalizeGlobalRole(globalRole: GlobalRoleInput): GlobalRole {
  return globalRole === "SENIOR_MANAGER" ? "MANAGER" : globalRole;
}

export const GLOBAL_ROLE_HOURLY_RATES: Partial<Record<GlobalRole, number>> = {
  PARTNER: 4500,
  MANAGER: 1800,
  SENIOR: 900,
  STAFF: 600,
  TAX_EXPERT: 1800,
};

export function getStandardHourlyRate(globalRole: GlobalRoleInput) {
  return GLOBAL_ROLE_HOURLY_RATES[normalizeGlobalRole(globalRole)];
}

export const UserStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const ProjectRoleSchema = z.enum([
  "PARTNER",
  "REVIEWER",
  "PREPARER",
  "EQCR",
  "TAX_REVIEWER",
]);
export type ProjectRole = z.infer<typeof ProjectRoleSchema>;

export const INBOX_CONTENT_KEYS = [
  "PROJECT_INVITATION",
  "WORKING_PAPER_PREPARED",
  "WORKING_PAPER_REVIEWED",
  "REVIEW_QUESTION_ASSIGNED",
  "REVIEW_QUESTION_REPLIED",
  "REVIEW_QUESTION_FOLLOW_UP",
  "REVIEW_QUESTION_REOPENED",
  "ATTACHMENT_CONFLICT",
  "PROJECT_ARCHIVE_COMPLETED",
  "PROJECT_ARCHIVE_REVIEW_REQUESTED",
  "PROJECT_ARCHIVE_REVIEW_RETURNED",
  "PROJECT_ARCHIVE_DEADLINE_REMINDER",
  "TMS_TIMESHEET_RETURNED",
  "CMP_ENGAGEMENT_APPROVED",
  "CMP_ACCEPTANCE_SUBMITTED",
  "CMP_ACCEPTANCE_APPROVAL_REQUESTED",
  "CMP_ACCEPTANCE_DRAFT_ASSIGNED",
  "CMP_ACCEPTANCE_DRAFT_RECALLED",
  "CMP_ACCEPTANCE_DRAFT_COMPLETED",
  "CMP_ACCEPTANCE_STEP_ADVANCED",
  "CMP_ACCEPTANCE_NEXT_APPROVER",
  "CMP_ACCEPTANCE_APPROVED",
  "CMP_ACCEPTANCE_RETURNED",
] as const;

export const InboxContentKeySchema = z.enum(INBOX_CONTENT_KEYS);
export type InboxContentKey = z.infer<typeof InboxContentKeySchema>;
export type InboxContentParameter = string | number | boolean | null;
export type InboxContentParamsByKey = {
  PROJECT_INVITATION: {
    actor: string;
    projectCode: string;
    projectName: string;
    role: ProjectRole;
  };
  WORKING_PAPER_PREPARED: InboxWorkingPaperParams;
  WORKING_PAPER_REVIEWED: InboxWorkingPaperParams;
  REVIEW_QUESTION_ASSIGNED: InboxReviewQuestionParams;
  REVIEW_QUESTION_REPLIED: InboxReviewQuestionParams;
  REVIEW_QUESTION_FOLLOW_UP: InboxReviewQuestionParams;
  REVIEW_QUESTION_REOPENED: InboxReviewQuestionParams;
  ATTACHMENT_CONFLICT: { fileName: string; candidateVersionId: string };
  PROJECT_ARCHIVE_COMPLETED: {
    projectCode: string;
    projectName: string;
    packageFileName: string;
  };
  PROJECT_ARCHIVE_REVIEW_REQUESTED: InboxProjectParams;
  PROJECT_ARCHIVE_REVIEW_RETURNED: InboxProjectParams;
  PROJECT_ARCHIVE_DEADLINE_REMINDER: InboxProjectParams & {
    deadline: string;
    days: number;
  };
  TMS_TIMESHEET_RETURNED: {
    year: number;
    month: number;
    half: "FIRST_HALF" | "SECOND_HALF";
    reason?: string | null;
  };
  CMP_ENGAGEMENT_APPROVED: { engagementCode: string };
  CMP_ACCEPTANCE_SUBMITTED: InboxCmpAcceptanceParams;
  CMP_ACCEPTANCE_APPROVAL_REQUESTED: InboxCmpAcceptanceActorParams & {
    step: InboxCmpApprovalStep;
  };
  CMP_ACCEPTANCE_DRAFT_ASSIGNED: InboxCmpAcceptanceActorParams;
  CMP_ACCEPTANCE_DRAFT_RECALLED: InboxCmpAcceptanceActorParams;
  CMP_ACCEPTANCE_DRAFT_COMPLETED: Pick<
    InboxCmpAcceptanceActorParams,
    "requestNo" | "actor" | "subject"
  > & { nextReviewer: "REQUESTER" | "MIC" };
  CMP_ACCEPTANCE_STEP_ADVANCED: Pick<
    InboxCmpAcceptanceActorParams,
    "requestNo" | "actor" | "subject"
  > & {
    completedStep: InboxCmpApprovalStep;
    nextStep: InboxCmpApprovalStep;
  };
  CMP_ACCEPTANCE_NEXT_APPROVER: InboxCmpAcceptanceActorParams & {
    completedStep: InboxCmpApprovalStep;
  };
  CMP_ACCEPTANCE_APPROVED: InboxCmpAcceptanceActorParams;
  CMP_ACCEPTANCE_RETURNED: InboxCmpAcceptanceActorParams & {
    reason?: string | null;
  };
};

type InboxWorkingPaperParams = {
  actor: string;
  paperCode: string;
  paperTitle: string;
};
type InboxReviewQuestionParams = InboxWorkingPaperParams & {
  question: string;
};
type InboxProjectParams = { projectCode: string; projectName: string };
type InboxCmpAcceptanceType =
  | "CLIENT"
  | "CLIENT_CHANGE"
  | "ENGAGEMENT"
  | "ENGAGEMENT_CHANGE";
type InboxCmpApprovalStep = "MIC" | "PIC" | "IT";
type InboxCmpAcceptanceParams = {
  requestNo: string;
  acceptanceType: InboxCmpAcceptanceType;
  subject: string;
};
type InboxCmpAcceptanceActorParams = InboxCmpAcceptanceParams & {
  actor: string;
};

export type InboxContentParams<Key extends InboxContentKey = InboxContentKey> =
  InboxContentParamsByKey[Key];
export type InboxStructuredContent = {
  [Key in InboxContentKey]: {
    contentKey: Key;
    contentParams: InboxContentParamsByKey[Key];
  };
}[InboxContentKey];

export const WorkItemDomainSchema = z.enum([
  "EMP",
  "PROJECT",
  "CMP",
  "TMS",
  "OPS",
]);
export type WorkItemDomain = z.infer<typeof WorkItemDomainSchema>;

export const WorkItemViewSchema = z.enum(["PERSONAL", "TEAM", "OPS"]);
export type WorkItemView = z.infer<typeof WorkItemViewSchema>;

export const WorkItemStateSchema = z.enum(["OPEN", "WAITING", "BLOCKED"]);
export type WorkItemState = z.infer<typeof WorkItemStateSchema>;

export const WorkItemSeveritySchema = z.enum([
  "ACTION_REQUIRED",
  "WARNING",
  "BLOCKER",
]);
export type WorkItemSeverity = z.infer<typeof WorkItemSeveritySchema>;

export const WorkItemPrioritySchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);
export type WorkItemPriority = z.infer<typeof WorkItemPrioritySchema>;

export const IMPLEMENTED_WORK_ITEM_RULE_IDS = [
  "EMP-001",
  "EMP-002",
  "EMP-003",
  "EMP-004",
  "EMP-005",
  "EMP-006",
  "EMP-007",
  "EMP-008",
  "EMP-009",
  "EMP-010",
  "EMP-011",
  "EMP-012",
  "PRJ-001",
  "PRJ-002",
  "PRJ-003",
  "PRJ-004",
  "PRJ-005",
  "PRJ-008",
  "PRJ-009",
  "PRJ-010",
  "PRJ-015",
  "PRJ-016",
  "CMP-001",
  "CMP-002",
  "CMP-003",
  "CMP-004",
  "CMP-005",
  "CMP-006",
  "CMP-007",
  "CMP-008",
  "CMP-009",
  "CMP-010",
  "CMP-011",
  "CMP-012",
  "CMP-013",
  "CMP-014",
  "CMP-015",
  "CMP-017",
  "TMS-001",
  "TMS-004",
  "TMS-005",
  "TMS-006",
  "TMS-007",
  "TMS-008",
  "TMS-009",
  "OPS-001",
  "OPS-002",
  "OPS-003",
  "OPS-004",
  "OPS-005",
] as const;

export const NON_WORK_ITEM_RULE_IDS = [
  "PRJ-006",
  "PRJ-007",
  "PRJ-011",
  "PRJ-012",
  "PRJ-013",
  "PRJ-014",
  "CMP-016",
  "TMS-002",
  "TMS-003",
  "TMS-010",
] as const;

export const WorkItemRuleIdSchema = z.enum(IMPLEMENTED_WORK_ITEM_RULE_IDS);
export type WorkItemRuleId = z.infer<typeof WorkItemRuleIdSchema>;

export const WorkItemActionTargetSchema = z.object({
  app: WorkItemDomainSchema,
  resourceType: z.string().trim().min(1).max(80),
  resourceId: z.string().trim().min(1).nullable(),
  params: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()])
    )
    .default({}),
});
export type WorkItemActionTarget = z.infer<typeof WorkItemActionTargetSchema>;

const WorkItemPersonSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email().nullable(),
});

export const WorkItemSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  domain: WorkItemDomainSchema,
  view: WorkItemViewSchema,
  category: z.string().min(1),
  state: WorkItemStateSchema,
  severity: WorkItemSeveritySchema,
  priority: WorkItemPrioritySchema,
  title: z.string(),
  description: z.string(),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  project: z
    .object({ id: z.string(), projectCode: z.string(), name: z.string() })
    .nullable(),
  reference: z.string().nullable(),
  objectLabel: z.string().nullable(),
  responsibleLabel: z.string(),
  assignedTo: WorkItemPersonSchema.nullable(),
  createdBy: WorkItemPersonSchema.nullable(),
  dueAt: z.string().datetime().nullable(),
  openedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  actionTarget: WorkItemActionTargetSchema,
});
export type WorkItem = z.infer<typeof WorkItemSchema>;

export const WorkItemCategorySummarySchema = z.object({
  category: z.string().min(1),
  label: z.string(),
  total: z.number().int().nonnegative(),
  blockers: z.number().int().nonnegative(),
  earliestOpenedAt: z.string().datetime().nullable(),
});
export type WorkItemCategorySummary = z.infer<
  typeof WorkItemCategorySummarySchema
>;

export const WorkItemListResponseSchema = z.object({
  items: z.array(WorkItemSchema),
  categories: z.array(WorkItemCategorySummarySchema),
  counts: z.object({
    total: z.number().int().nonnegative(),
    EMP: z.number().int().nonnegative(),
    PROJECT: z.number().int().nonnegative(),
    CMP: z.number().int().nonnegative(),
    TMS: z.number().int().nonnegative(),
    OPS: z.number().int().nonnegative(),
  }),
});
export type WorkItemListResponse = z.infer<typeof WorkItemListResponseSchema>;

export type WorkItemSentenceTemplate = Record<"zh-CN" | "en-US", string>;
export type WorkItemSentenceParameters = Record<string, string | number>;

export function renderWorkItemSentence(
  locale: "zh-CN" | "en-US",
  template: WorkItemSentenceTemplate,
  parameters: WorkItemSentenceParameters
) {
  return template[locale].replaceAll(
    /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g,
    (_, key) => {
      const value = parameters[key];
      if (value === undefined) {
        throw new Error(`Missing work-item sentence parameter: ${key}`);
      }
      return String(value);
    }
  );
}

export const InChargeRoleSchema = z.enum([
  "PARTNER_IN_CHARGE",
  "MANAGER_IN_CHARGE",
]);
export type InChargeRole = z.infer<typeof InChargeRoleSchema>;

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  PARTNER: "Partner",
  REVIEWER: "Reviewer",
  PREPARER: "Preparer",
  EQCR: "Engagement Quality Reviewer",
  TAX_REVIEWER: "Expert",
};

export const IN_CHARGE_ROLE_LABELS: Record<InChargeRole, string> = {
  PARTNER_IN_CHARGE: "Partner in Charge",
  MANAGER_IN_CHARGE: "Manager in Charge",
};

export type GlobalRoleMetadata = {
  label: string;
  description: string;
  projectParticipation: string;
};

export const GLOBAL_ROLE_METADATA: Record<GlobalRole, GlobalRoleMetadata> = {
  SUPER_ADMIN: {
    label: "System administrator",
    description: "维护系统账号、角色权限和基础配置，不默认参与审计项目执行。",
    projectParticipation:
      "不可作为项目成员邀请；需要参与项目时应另建业务职级账号。",
  },
  HR: {
    label: "Human resources",
    description: "负责全员工时完整性和合理性检查，不参与项目审批。",
    projectParticipation: "不可作为项目成员邀请；通过 TMS 总览检查全员工时。",
  },
  CONFIRMATION_OFFICER: {
    label: "Confirmation officer",
    description:
      "负责全局函证收发、登记和跟进，不进入具体审计项目工作台执行底稿工作。",
    projectParticipation:
      "不可作为项目成员邀请；通过全局函证中心处理函证行政流程。",
  },
  PARTNER: {
    label: "Partner",
    description: "项目最高业务负责人，负责项目管理、成员邀请和关键复核。",
    projectParticipation: "可在项目内承担 Partner 职责。",
  },
  PRINCIPAL: {
    label: "Principal",
    description:
      "Senior engagement leader who can coordinate teams and maintain project membership without being the project Partner.",
    projectParticipation:
      "Can participate as a general project member; project-level prepare and review signoffs are recorded per file.",
  },
  MANAGER: {
    label: "Manager",
    description: "负责项目执行管理和复核协调，可组织团队完成审计工作。",
    projectParticipation:
      "可在项目内作为一般项目成员参与；具体 Prepare / Review 签核按文件记录。",
  },
  SENIOR: {
    label: "Senior",
    description: "负责执行和部分复核工作，可维护目录、底稿和补充资料占位。",
    projectParticipation:
      "可在项目内作为一般项目成员参与；具体 Prepare / Review 签核按文件记录。",
  },
  STAFF: {
    label: "Staff",
    description: "负责基础执行工作，可在授权范围内维护底稿和补充资料占位。",
    projectParticipation:
      "可在项目内作为一般项目成员参与；具体 Prepare / Review 签核按文件记录。",
  },
  ASSISTANT: {
    label: "Assistant",
    description:
      "Entry-level engagement team member who can support project execution under supervision.",
    projectParticipation:
      "Can participate as a general project member; project-level prepare and review signoffs are recorded per file.",
  },
  EQCR: {
    label: "EQR",
    description:
      "Engagement quality control reviewer who can participate in EQCR review work.",
    projectParticipation:
      "Can participate as EQCR with project-level review responsibilities.",
  },
  TAX_EXPERT: {
    label: "N/A",
    description:
      "Tax specialist who can read project content and perform tax review work without file editing or member management permissions.",
    projectParticipation:
      "Can participate as Expert with read-only project access and review actions.",
  },
};

const ASSIGNABLE_PROJECT_ROLES_BY_GLOBAL_ROLE: Record<
  GlobalRole,
  readonly ProjectRole[]
> = {
  SUPER_ADMIN: [],
  HR: [],
  CONFIRMATION_OFFICER: [],
  PARTNER: ["PARTNER", "EQCR"],
  PRINCIPAL: ["PARTNER", "REVIEWER"],
  MANAGER: ["REVIEWER"],
  SENIOR: ["REVIEWER"],
  STAFF: ["PREPARER"],
  ASSISTANT: ["PREPARER"],
  EQCR: ["EQCR"],
  TAX_EXPERT: ["TAX_REVIEWER"],
};

export function canGlobalRoleManageProjectMembers(globalRole: GlobalRoleInput) {
  const normalizedRole = normalizeGlobalRole(globalRole);
  return (
    normalizedRole === "PARTNER" ||
    normalizedRole === "PRINCIPAL" ||
    normalizedRole === "MANAGER"
  );
}

export const PROJECT_PERMISSION_ACTIONS = [
  "restoreProject",
  "reviewSignoff",
  "legacyPreparer",
  "legacyReviewer",
  "legacyEqcr",
  "legacyPartner",
  "legacyTaxReviewer",
  "deleteProject",
  "archiveProject",
  "inviteProjectMembers",
  "removeProjectMembers",
  "updateProjectInfo",
  "modifyIndex",
  "signPreparer",
  "viewTemporaryFiles",
  "viewNotifications",
  "viewRecycleBin",
  "uploadWorkingPapers",
  "useLibrary",
] as const;
export type ProjectPermissionAction =
  (typeof PROJECT_PERMISSION_ACTIONS)[number];

/** Compatibility adapters share the same eligibility/action engine as new callers. */
export const LEGACY_PROJECT_ROLE_ACTIONS: Record<
  ProjectRole,
  ProjectPermissionAction
> = {
  PREPARER: "legacyPreparer",
  REVIEWER: "legacyReviewer",
  TAX_REVIEWER: "legacyTaxReviewer",
  EQCR: "legacyEqcr",
  PARTNER: "legacyPartner",
};
const LEGACY_PROJECT_ACTION_ROLES: Partial<
  Record<ProjectPermissionAction, ProjectRole>
> = {
  legacyPreparer: "PREPARER",
  legacyReviewer: "REVIEWER",
  legacyEqcr: "EQCR",
  legacyPartner: "PARTNER",
  legacyTaxReviewer: "TAX_REVIEWER",
};
const LEGACY_PROJECT_ROLE_CAPABILITIES: Record<
  ProjectRole,
  readonly ProjectRole[]
> = {
  PREPARER: ["PREPARER"],
  REVIEWER: ["PREPARER", "REVIEWER"],
  TAX_REVIEWER: ["REVIEWER"],
  EQCR: ["PREPARER", "REVIEWER", "EQCR"],
  PARTNER: ["PREPARER", "REVIEWER", "EQCR", "PARTNER"],
};

export type ProjectPermissionSubject = {
  authorizationSuspended?: boolean;
  globalRole: GlobalRoleInput;
  projectRole: ProjectRole;
  inChargeRole?: InChargeRole | null;
};

/** An old membership/leadership grant cannot outlive the user's current eligibility. */
export function isProjectPermissionSubjectConsistent(
  subject: ProjectPermissionSubject | null | undefined
): subject is ProjectPermissionSubject {
  if (!subject || subject.authorizationSuspended) {
    return false;
  }
  const grade = normalizeGlobalRole(subject.globalRole);
  if (
    !ASSIGNABLE_PROJECT_ROLES_BY_GLOBAL_ROLE[grade]?.includes(
      subject.projectRole
    )
  ) {
    return false;
  }
  if (!subject.inChargeRole) {
    return true;
  }
  if (!isInChargeRoleAssignableToGlobalRole(grade, subject.inChargeRole)) {
    return false;
  }
  return subject.inChargeRole === "PARTNER_IN_CHARGE"
    ? subject.projectRole === "PARTNER"
    : subject.projectRole === "REVIEWER";
}

export type DeniedProjectPermissionTreatment = "disabled" | "hidden";

export function canManageProjectLeadership(
  subject: ProjectPermissionSubject | null | undefined
) {
  return (
    isProjectPermissionSubjectConsistent(subject) &&
    subject.inChargeRole === "PARTNER_IN_CHARGE"
  );
}

const HIDDEN_DENIED_PROJECT_ACTIONS = new Set<ProjectPermissionAction>([
  "viewTemporaryFiles",
  "viewNotifications",
  "viewRecycleBin",
  "uploadWorkingPapers",
  "useLibrary",
]);
const PARTNER_RESTRICTED_PROJECT_ACTIONS = new Set<ProjectPermissionAction>([
  "deleteProject",
]);
const STAFF_RESTRICTED_PROJECT_ACTIONS = new Set<ProjectPermissionAction>([
  "deleteProject",
  "removeProjectMembers",
  "updateProjectInfo",
]);
const ASSISTANT_RESTRICTED_PROJECT_ACTIONS = new Set<ProjectPermissionAction>([
  "deleteProject",
  "archiveProject",
  "removeProjectMembers",
  "updateProjectInfo",
]);

export function canGlobalRoleCreateProject(globalRole: GlobalRoleInput) {
  const normalizedRole = normalizeGlobalRole(globalRole);
  return (
    normalizedRole !== "SUPER_ADMIN" &&
    normalizedRole !== "HR" &&
    normalizedRole !== "CONFIRMATION_OFFICER" &&
    normalizedRole !== "TAX_EXPERT"
  );
}

export function getDeniedProjectPermissionTreatment(
  action: ProjectPermissionAction
): DeniedProjectPermissionTreatment {
  return HIDDEN_DENIED_PROJECT_ACTIONS.has(action) ? "hidden" : "disabled";
}

export function canProjectMemberPerformAction(
  subject: ProjectPermissionSubject | null | undefined,
  action: ProjectPermissionAction
) {
  if (subject && normalizeGlobalRole(subject.globalRole) === "SUPER_ADMIN") {
    return true;
  }
  if (!isProjectPermissionSubjectConsistent(subject)) {
    return false;
  }
  const globalRole = normalizeGlobalRole(subject.globalRole);
  if (action === "reviewSignoff") {
    return true;
  }
  const legacyMinimum = LEGACY_PROJECT_ACTION_ROLES[action];
  if (legacyMinimum) {
    return LEGACY_PROJECT_ROLE_CAPABILITIES[subject.projectRole].includes(
      legacyMinimum
    );
  }
  if (subject.inChargeRole === "PARTNER_IN_CHARGE") {
    return true;
  }
  if (
    subject.projectRole === "EQCR" ||
    subject.projectRole === "TAX_REVIEWER"
  ) {
    return false;
  }
  if (subject.projectRole === "PARTNER") {
    return !PARTNER_RESTRICTED_PROJECT_ACTIONS.has(action);
  }
  if (globalRole === "ASSISTANT") {
    return !ASSISTANT_RESTRICTED_PROJECT_ACTIONS.has(action);
  }
  if (globalRole === "STAFF") {
    return !STAFF_RESTRICTED_PROJECT_ACTIONS.has(action);
  }
  if (
    globalRole === "PRINCIPAL" ||
    globalRole === "MANAGER" ||
    globalRole === "SENIOR"
  ) {
    return action !== "deleteProject";
  }
  return false;
}

export function getAssignableProjectRolesForGlobalRole(
  globalRole: GlobalRoleInput
): ProjectRole[] {
  return [
    ...ASSIGNABLE_PROJECT_ROLES_BY_GLOBAL_ROLE[normalizeGlobalRole(globalRole)],
  ];
}

export function getAssignableProjectRoleLabelsForGlobalRole(
  globalRole: GlobalRoleInput
): string[] {
  const normalizedRole = normalizeGlobalRole(globalRole);
  if (
    normalizedRole === "PRINCIPAL" ||
    normalizedRole === "MANAGER" ||
    normalizedRole === "SENIOR" ||
    normalizedRole === "STAFF" ||
    normalizedRole === "ASSISTANT"
  ) {
    return [GLOBAL_ROLE_METADATA[normalizedRole].label];
  }
  return getAssignableProjectRolesForGlobalRole(normalizedRole).map(
    (role) => PROJECT_ROLE_LABELS[role]
  );
}

export function isProjectRoleAssignableToGlobalRole(
  globalRole: GlobalRoleInput,
  projectRole: ProjectRole
) {
  return getAssignableProjectRolesForGlobalRole(globalRole).includes(
    projectRole
  );
}

export function getInChargeRoleForGlobalRole(
  globalRole: GlobalRoleInput
): InChargeRole | null {
  const normalizedRole = normalizeGlobalRole(globalRole);
  if (normalizedRole === "PARTNER" || normalizedRole === "PRINCIPAL") {
    return "PARTNER_IN_CHARGE";
  }
  if (normalizedRole === "MANAGER") {
    return "MANAGER_IN_CHARGE";
  }
  return null;
}

export function isInChargeRoleAssignableToGlobalRole(
  globalRole: GlobalRoleInput,
  inChargeRole: InChargeRole
) {
  return getInChargeRoleForGlobalRole(globalRole) === inChargeRole;
}

export function getProjectInvitationEligibility(user: {
  globalRole: GlobalRoleInput;
  status?: UserStatus;
}) {
  const assignableProjectRoles = getAssignableProjectRolesForGlobalRole(
    user.globalRole
  );
  if (user.status === "DISABLED") {
    return {
      canReceiveInvitation: false,
      assignableProjectRoles,
      reason: "User account is disabled",
    };
  }
  if (assignableProjectRoles.length === 0) {
    return {
      canReceiveInvitation: false,
      assignableProjectRoles,
      reason: "Global role cannot receive project invitations",
    };
  }
  return {
    canReceiveInvitation: true,
    assignableProjectRoles,
    reason: null,
  };
}

export const ProjectLanguageSchema = z.enum(["zh-CN", "en-US"]);
export type ProjectLanguage = z.infer<typeof ProjectLanguageSchema>;

export const ProjectStatusSchema = z.enum([
  "ACTIVE",
  "PENDING_FINAL_CHECK",
  "ARCHIVED",
  "DELETED",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ConfirmationTypeSchema = z.enum([
  "BANK",
  "BALANCE",
  "RELATED_PARTY",
  "LAWYER",
  "INVENTORY",
  "INTERMEDIARY",
  "OTHER",
  "UNCLASSIFIED",
]);
export type ConfirmationType = z.infer<typeof ConfirmationTypeSchema>;

export const ConfirmationStatusSchema = z.enum([
  "DRAFT",
  "PREPARED",
  "AWAITING_RESPONSE",
  "RESPONSE_RECEIVED",
  "CLOSED",
  "VOIDED",
]);
export type ConfirmationStatus = z.infer<typeof ConfirmationStatusSchema>;

export const ConfirmationResponseStatusSchema = z.enum([
  "NOT_RECEIVED",
  "RECEIVED",
  "UNIDENTIFIED",
  "ASSIGNED",
]);
export type ConfirmationResponseStatus = z.infer<
  typeof ConfirmationResponseStatusSchema
>;

export const ConfirmationResponseLibraryRoutingStatusSchema = z.enum([
  "UNASSIGNED_PROJECT",
  "PENDING_MATCH",
  "MATCHED",
  "NO_SOURCE_REQUEST",
]);
export type ConfirmationResponseLibraryRoutingStatus = z.infer<
  typeof ConfirmationResponseLibraryRoutingStatusSchema
>;

export const RouteConfirmationResponseLibraryFileSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("UNASSIGN_PROJECT") }).strict(),
    z
      .object({
        action: z.literal("PENDING_MATCH"),
        projectId: z.string().trim().min(1),
        provisionalType: ConfirmationTypeSchema.nullable().optional(),
      })
      .strict(),
    z
      .object({
        action: z.literal("NO_SOURCE_REQUEST"),
        projectId: z.string().trim().min(1),
        provisionalType: ConfirmationTypeSchema.nullable().optional(),
      })
      .strict(),
    z
      .object({
        action: z.literal("MATCH_CONFIRMATION"),
        projectId: z.string().trim().min(1),
        confirmationId: z.string().trim().min(1),
      })
      .strict(),
  ]
);
export type RouteConfirmationResponseLibraryFileInput = z.infer<
  typeof RouteConfirmationResponseLibraryFileSchema
>;

export const ConfirmationTeamConfirmStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "REJECTED",
]);
export type ConfirmationTeamConfirmStatus = z.infer<
  typeof ConfirmationTeamConfirmStatusSchema
>;

export const ConfirmationDifferenceStatusSchema = z.enum([
  "MATCHED",
  "EXCEPTION",
  "PENDING_FOLLOW_UP",
  "NO_RESPONSE",
]);
export type ConfirmationDifferenceStatus = z.infer<
  typeof ConfirmationDifferenceStatusSchema
>;

export const ConfirmationResponseReviewResultSchema = z.enum([
  "MATCHED",
  "MISMATCHED",
]);
export type ConfirmationResponseReviewResult = z.infer<
  typeof ConfirmationResponseReviewResultSchema
>;

export const ConfirmationResponseReviewActionSchema = z.enum([
  "REDISPATCH",
  "ALTERNATIVE_PROCEDURE",
]);
export type ConfirmationResponseReviewAction = z.infer<
  typeof ConfirmationResponseReviewActionSchema
>;

export const ReviewProjectConfirmationResponseSchema = z
  .object({
    result: ConfirmationResponseReviewResultSchema,
    action: ConfirmationResponseReviewActionSchema.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.result === "MATCHED" && input.action) {
      context.addIssue({
        code: "custom",
        path: ["action"],
        message: "A matched response cannot have a resolution action",
      });
    }
    if (input.result === "MISMATCHED" && !input.action) {
      context.addIssue({
        code: "custom",
        path: ["action"],
        message: "A mismatched response requires a resolution action",
      });
    }
  });
export type ReviewProjectConfirmationResponseInput = z.infer<
  typeof ReviewProjectConfirmationResponseSchema
>;
export const ConfirmationFollowUpEventTypeSchema = z.enum([
  "CONFIRMATION_CREATED",
  "CONFIRMATION_FROZEN",
  "CONFIRMATION_UNFROZEN",
  "COUNTERPARTY_RECEIVED",
  "COUNTERPARTY_SENT_RESPONSE",
  "REDISPATCH_REQUESTED",
  "RESPONSE_RECEIVED",
  "RESPONSE_WITHDRAWN",
  "PROGRAM_COMPLETED",
  "REVIEW_RECORDED",
  "REVIEW_RETRACTED",
  "IMPORT_WITHDRAWN",
  "IMPORT_TARGET_CHANGED",
]);
export type ConfirmationFollowUpEventType = z.infer<
  typeof ConfirmationFollowUpEventTypeSchema
>;

export const ConfirmationReturnShipmentSchema = z.object({
  trackingNumber: z.string().trim().min(1).max(255),
  courierName: z.string().nullable().optional(),
  trackingCarrierCode: z.number().nullable().optional(),
  trackingCarrierName: z.string().nullable().optional(),
  trackingRegisteredAt: z.string().nullable().optional(),
  trackingStatus: z.string().nullable().optional(),
  trackingDescription: z.string().nullable().optional(),
  trackingLocation: z.string().nullable().optional(),
  trackingLastEventAt: z.string().nullable().optional(),
  trackingUpdatedAt: z.string().nullable().optional(),
  trackingStoppedAt: z.string().nullable().optional(),
  trackingError: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  trackingEvents: z
    .array(
      z.object({
        at: z.string().nullable().optional(),
        description: z.string(),
        location: z.string().nullable().optional(),
        stage: z.string().nullable().optional(),
        substatus: z.string().nullable().optional(),
      })
    )
    .optional(),
});
export type ConfirmationReturnShipment = z.infer<
  typeof ConfirmationReturnShipmentSchema
>;

export const CreateProjectConfirmationFollowUpEventSchema = z
  .object({
    eventType: z.enum(["COUNTERPARTY_RECEIVED", "COUNTERPARTY_SENT_RESPONSE"]),
    notes: z.string().trim().max(2000).optional(),
    trackingNumber: z.string().trim().max(255).optional(),
    courierName: z.string().trim().max(255).optional(),
    trackingCarrierCode: z.number().int().positive().optional(),
    trackingQueryParameters: z
      .record(
        z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
        z.string().trim().max(255)
      )
      .optional(),
  })
  .strict();
export type CreateProjectConfirmationFollowUpEventInput = z.infer<
  typeof CreateProjectConfirmationFollowUpEventSchema
>;

export const ConfirmationDispatchMethodSchema = z.enum([
  "COURIER",
  "POST",
  "EMAIL",
  "PLATFORM",
  "BANK_PORTAL",
  "HAND_DELIVERY",
  "OTHER",
]);
export type ConfirmationDispatchMethod = z.infer<
  typeof ConfirmationDispatchMethodSchema
>;

export const ConfirmationArtifactDispositionSchema = z.enum([
  "ACTIVE",
  "INVALIDATED",
  "RETURNED",
]);
export type ConfirmationArtifactDisposition = z.infer<
  typeof ConfirmationArtifactDispositionSchema
>;

export const ConfirmationDispatchBatchStatusSchema = z.enum([
  "QUEUED",
  "EXECUTING",
  "COMPLETED",
  "PARTIAL_FAILURE",
  "FAILED",
  "CANCELLED",
]);
export type ConfirmationDispatchBatchStatus = z.infer<
  typeof ConfirmationDispatchBatchStatusSchema
>;

export const ConfirmationDispatchBatchItemStatusSchema = z.enum([
  "QUEUED",
  "CLAIMED",
  "SENT",
  "FAILED",
  "RETURNED",
]);
export type ConfirmationDispatchBatchItemStatus = z.infer<
  typeof ConfirmationDispatchBatchItemStatusSchema
>;

export const ConfirmationDispatchExecutionStatusSchema = z.enum([
  "QUEUED",
  "STARTED",
  "SENT",
  "DELIVERED",
  "FAILED",
]);
export type ConfirmationDispatchExecutionStatus = z.infer<
  typeof ConfirmationDispatchExecutionStatusSchema
>;

export const ConfirmationDispatchEventTypeSchema = z.enum([
  "CREATED",
  "QUEUED",
  "CLAIMED",
  "RETURNED",
  "STARTED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "DISPATCHED",
  "RECEIVED",
  "VOIDED",
]);
export type ConfirmationDispatchEventType = z.infer<
  typeof ConfirmationDispatchEventTypeSchema
>;

export const ConfirmationPhysicalPackageStatusSchema = z.enum([
  "CREATED",
  "IN_CUSTODY",
  "DISPATCHED",
  "DELIVERED",
  "RECEIVED",
  "VOIDED",
  "REPLACED",
]);
export type ConfirmationPhysicalPackageStatus = z.infer<
  typeof ConfirmationPhysicalPackageStatusSchema
>;

export const ConfirmationResponseChannelSchema = z.enum([
  "PAPER",
  "EMAIL",
  "PORTAL",
  "ELECTRONIC",
  "OTHER",
]);
export type ConfirmationResponseChannel = z.infer<
  typeof ConfirmationResponseChannelSchema
>;
export const ConfirmationResponseInputChannelSchema = z.enum([
  "PAPER",
  "ELECTRONIC",
  "OTHER",
]);
export type ConfirmationResponseInputChannel = z.infer<
  typeof ConfirmationResponseInputChannelSchema
>;

export const ConfirmationResponseMatchMethodSchema = z.enum([
  "SCAN_TOKEN",
  "PACKAGE_CODE",
  "MANUAL",
]);
export type ConfirmationResponseMatchMethod = z.infer<
  typeof ConfirmationResponseMatchMethodSchema
>;

export const ConfirmationResponseRoutingStatusSchema = z.enum([
  "PENDING",
  "ROUTED",
  "CONCLUDED",
]);
export type ConfirmationResponseRoutingStatus = z.infer<
  typeof ConfirmationResponseRoutingStatusSchema
>;

export const ConfirmationIntakeExceptionReasonSchema = z.enum([
  "UNKNOWN_SCAN_TOKEN",
  "INVALID_PACKAGE_CODE",
  "DUPLICATE_RESPONSE",
  "UNMATCHED_RESPONSE",
  "DAMAGED_RESPONSE",
  "OTHER",
]);
export type ConfirmationIntakeExceptionReason = z.infer<
  typeof ConfirmationIntakeExceptionReasonSchema
>;

export const ConfirmationIntakeExceptionStatusSchema = z.enum([
  "OPEN",
  "RESOLVED",
  "DISMISSED",
]);
export type ConfirmationIntakeExceptionStatus = z.infer<
  typeof ConfirmationIntakeExceptionStatusSchema
>;

export const ConfirmationBuiltinTemplateCodeSchema = z.enum([
  "PRC_BANK_TEMPLATE_1",
  "PRC_BANK_TEMPLATE_2",
  "SHINEWING_ENG_BANK",
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
]);
export type ConfirmationBuiltinTemplateCode = z.infer<
  typeof ConfirmationBuiltinTemplateCodeSchema
>;

export type ConfirmationCustomTemplateCode = `CTPL-${string}`;
const CONFIRMATION_CUSTOM_TEMPLATE_CODE_PATTERN =
  /^CTPL-(?:[A-Z0-9]{12}|(?:BANK|BALANCE|RELATED_PARTY|LAWYER|INVENTORY|INTERMEDIARY|OTHER|UNCLASSIFIED)-\d{4}-\d{6})$/;
export const ConfirmationCustomTemplateCodeSchema =
  z.custom<ConfirmationCustomTemplateCode>(
    (value) =>
      typeof value === "string" &&
      CONFIRMATION_CUSTOM_TEMPLATE_CODE_PATTERN.test(value)
  );

export function isConfirmationCustomTemplateCode(
  value: unknown
): value is ConfirmationCustomTemplateCode {
  return (
    typeof value === "string" &&
    ConfirmationCustomTemplateCodeSchema.safeParse(value).success
  );
}

export const ConfirmationDraftTemplateCodeSchema = z.union([
  ConfirmationBuiltinTemplateCodeSchema,
  ConfirmationCustomTemplateCodeSchema,
]);
export type ConfirmationDraftTemplateCode = z.infer<
  typeof ConfirmationDraftTemplateCodeSchema
>;

export const ConfirmationDraftPatchSourceSchema = z.enum([
  "MANUAL",
  "CMP",
  "LEDGER",
  "BANK_MASTER",
  "OCR",
  "AI",
  "IMPORT",
]);
export type ConfirmationDraftPatchSource = z.infer<
  typeof ConfirmationDraftPatchSourceSchema
>;

export const PaperTypeSchema = z.enum(["WORKING_PAPER", "SUPPLEMENT"]);
export type PaperType = z.infer<typeof PaperTypeSchema>;

export const WorkingPaperBucketSchema = z.enum([
  "CURRENT",
  "PRIOR",
  "TEMPORARY",
]);
export type WorkingPaperBucket = z.infer<typeof WorkingPaperBucketSchema>;

export const ProjectTemplateStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);
export type ProjectTemplateStatus = z.infer<typeof ProjectTemplateStatusSchema>;

export const WORKING_PAPER_BUCKET_LABELS: Record<WorkingPaperBucket, string> = {
  CURRENT: "当前底稿",
  PRIOR: "前期底稿",
  TEMPORARY: "临时资料",
};

export const WORKING_PAPER_BUCKET_DESCRIPTIONS: Record<
  WorkingPaperBucket,
  string
> = {
  CURRENT: "本期正在编制、复核和签署的文件。",
  PRIOR: "去年或前期项目留下来的参考文件。",
  TEMPORARY: "与该科目相关、临时存放或待整理的资料。",
};

export const WorkingPaperSignoffTypeSchema = z.enum(["PREPARER", "REVIEWER"]);
export type WorkingPaperSignoffType = z.infer<
  typeof WorkingPaperSignoffTypeSchema
>;

export const RevokeWorkingPaperSignoffSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type RevokeWorkingPaperSignoffInput = z.infer<
  typeof RevokeWorkingPaperSignoffSchema
>;

export const ReviewQuestionStatusSchema = z.enum([
  "OPEN",
  "REPLIED",
  "CLEARED",
]);
export type ReviewQuestionStatus = z.infer<typeof ReviewQuestionStatusSchema>;

export const WorkingPaperQuestionMessageTypeSchema = z.enum([
  "QUESTION",
  "REPLY",
  "FOLLOW_UP",
  "REOPEN",
]);
export type WorkingPaperQuestionMessageType = z.infer<
  typeof WorkingPaperQuestionMessageTypeSchema
>;

export const REVIEW_QUESTION_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
] as const;
export const REVIEW_QUESTION_IMAGE_MAX_SIZE_BYTES = 25 * 1024 * 1024;
export const REVIEW_QUESTION_IMAGE_MAX_PER_MESSAGE = 4;

export const AttachmentFileKindSchema = z.enum([
  "SPREADSHEET",
  "SUPPORTING",
  "SMART_FORM",
]);
export type AttachmentFileKind = z.infer<typeof AttachmentFileKindSchema>;

export const AttachmentPlaceholderTypeSchema = z.enum([
  "GENERIC",
  "WORD",
  "SPREADSHEET",
  "PRESENTATION",
  "PDF",
  "IMAGE",
  "ZIP",
  "TEXT",
]);
export type AttachmentPlaceholderType = z.infer<
  typeof AttachmentPlaceholderTypeSchema
>;

export const ATTACHMENT_PLACEHOLDER_TYPES: Record<
  AttachmentPlaceholderType,
  { extension: string; mimeType: string; accept: string }
> = {
  GENERIC: {
    extension: "",
    mimeType: "application/octet-stream",
    accept: "*/*",
  },
  WORD: {
    extension: ".docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    accept: ".doc,.docx",
  },
  SPREADSHEET: {
    extension: ".xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    accept: ".xls,.xlsx,.xlsm,.csv",
  },
  PRESENTATION: {
    extension: ".pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    accept: ".ppt,.pptx",
  },
  PDF: { extension: ".pdf", mimeType: "application/pdf", accept: ".pdf" },
  IMAGE: {
    extension: ".png",
    mimeType: "image/png",
    accept: ".png,.jpg,.jpeg,.webp,.gif",
  },
  ZIP: { extension: ".zip", mimeType: "application/zip", accept: ".zip" },
  TEXT: { extension: ".txt", mimeType: "text/plain", accept: ".txt" },
};

export function getAttachmentPlaceholderTypeForFile(
  fileName: string,
  mimeType?: string | null
): AttachmentPlaceholderType | null {
  const extension =
    fileName
      .trim()
      .toLowerCase()
      .match(/\.[^.]+$/)?.[0] ?? "";
  const byExtension: Record<string, AttachmentPlaceholderType> = {
    ".doc": "WORD",
    ".docx": "WORD",
    ".xls": "SPREADSHEET",
    ".xlsx": "SPREADSHEET",
    ".xlsm": "SPREADSHEET",
    ".csv": "SPREADSHEET",
    ".ppt": "PRESENTATION",
    ".pptx": "PRESENTATION",
    ".pdf": "PDF",
    ".png": "IMAGE",
    ".jpg": "IMAGE",
    ".jpeg": "IMAGE",
    ".webp": "IMAGE",
    ".gif": "IMAGE",
    ".zip": "ZIP",
    ".txt": "TEXT",
  };
  const extensionType = byExtension[extension] ?? null;
  if (!extensionType) {
    return null;
  }

  const normalizedMime = mimeType?.trim().toLowerCase();
  if (!normalizedMime || normalizedMime === "application/octet-stream") {
    return extensionType;
  }
  const mimeTypeFamily = normalizedMime.startsWith("image/")
    ? "IMAGE"
    : normalizedMime.includes("word") || normalizedMime === "application/msword"
      ? "WORD"
      : normalizedMime.includes("spreadsheet") ||
          normalizedMime.includes("excel") ||
          normalizedMime === "text/csv"
        ? "SPREADSHEET"
        : normalizedMime.includes("presentation") ||
            normalizedMime.includes("powerpoint")
          ? "PRESENTATION"
          : normalizedMime === "application/pdf"
            ? "PDF"
            : normalizedMime === "application/zip" ||
                normalizedMime === "application/x-zip-compressed"
              ? "ZIP"
              : normalizedMime === "text/plain"
                ? "TEXT"
                : null;
  return mimeTypeFamily === extensionType ? extensionType : null;
}

export function getAttachmentPlaceholderReplacementName(
  placeholderName: string,
  replacementFileName: string
) {
  const replacementExtension =
    replacementFileName
      .trim()
      .toLowerCase()
      .match(/\.[^.]+$/)?.[0] ?? "";
  const baseName = placeholderName.replace(/\.[^.]+$/, "").trim();
  return `${baseName || "Placeholder"}${replacementExtension}`;
}

export const CreateAttachmentPlaceholderSchema = z.object({
  name: z.string().trim().min(1, "Placeholder name is required").max(255),
  placeholderType: AttachmentPlaceholderTypeSchema.default("GENERIC"),
});
export type CreateAttachmentPlaceholderInput = z.infer<
  typeof CreateAttachmentPlaceholderSchema
>;

export const ATTACHMENT_FILE_KIND_LABELS: Record<AttachmentFileKind, string> = {
  SPREADSHEET: "Spreadsheet",
  SUPPORTING: "Supporting evidence",
  SMART_FORM: "Smart Form",
};

export const ZIP_MASTER_SUPPORTED_EXTENSIONS = [".zip"] as const;

export const SMART_FORM_FILE_EXTENSION = ".sf" as const;
export const SMART_FORM_MIME_TYPE =
  "application/vnd.project-wing.smart-form+json";
export const SMART_FORM_MASTER_SUPPORTED_EXTENSIONS = [
  SMART_FORM_FILE_EXTENSION,
] as const;

export const PROJECT_WING_MASTER_SUPPORTED_EXTENSIONS = [
  ...DESKTOP_AGENT_MASTER_OPEN_SUPPORTED_EXTENSIONS,
  ...ZIP_MASTER_SUPPORTED_EXTENSIONS,
  ...SMART_FORM_MASTER_SUPPORTED_EXTENSIONS,
] as const;

export function isZipMasterSupportedFileName(fileName: string) {
  return hasSupportedExtension(fileName, ZIP_MASTER_SUPPORTED_EXTENSIONS);
}

export function isSmartFormSupportedFileName(fileName: string) {
  return hasSupportedExtension(
    fileName,
    SMART_FORM_MASTER_SUPPORTED_EXTENSIONS
  );
}

export function isProjectWingMasterSupportedFileName(fileName: string) {
  return hasSupportedExtension(
    fileName,
    PROJECT_WING_MASTER_SUPPORTED_EXTENSIONS
  );
}

function hasSupportedExtension(
  fileName: string,
  supportedExtensions: readonly string[]
) {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex <= 0) {
    return false;
  }
  return supportedExtensions.includes(normalized.slice(dotIndex));
}

export const AttachmentWorkDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Work date must use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));
export type AttachmentWorkDateInput = z.infer<typeof AttachmentWorkDateSchema>;

export const UploadAttachmentSchema = z.object({
  fileKind: AttachmentFileKindSchema.optional(),
  workDate: AttachmentWorkDateSchema,
});
export type UploadAttachmentInput = z.infer<typeof UploadAttachmentSchema>;

export const RequestAttachmentUploadUrlSchema = UploadAttachmentSchema.extend({
  fileName: z.string().trim().min(1, "File name is required").max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().trim().min(1).max(255),
});
export type RequestAttachmentUploadUrlInput = z.infer<
  typeof RequestAttachmentUploadUrlSchema
>;

export const ConfirmAttachmentUploadSchema =
  RequestAttachmentUploadUrlSchema.extend({
    objectKey: z.string().trim().min(1, "Object key is required"),
  });
export type ConfirmAttachmentUploadInput = z.infer<
  typeof ConfirmAttachmentUploadSchema
>;

export const UploadAttachmentVersionSchema = z.object({
  workDate: AttachmentWorkDateSchema,
});
export type UploadAttachmentVersionInput = z.infer<
  typeof UploadAttachmentVersionSchema
>;

export const RequestAttachmentVersionUploadUrlSchema =
  UploadAttachmentVersionSchema.extend({
    fileName: z.string().trim().min(1, "File name is required").max(255),
    fileSize: z.number().int().positive(),
    mimeType: z.string().trim().min(1).max(255),
  });
export type RequestAttachmentVersionUploadUrlInput = z.infer<
  typeof RequestAttachmentVersionUploadUrlSchema
>;

export const ConfirmAttachmentVersionUploadSchema =
  RequestAttachmentVersionUploadUrlSchema.extend({
    objectKey: z.string().trim().min(1, "Object key is required"),
  });
export type ConfirmAttachmentVersionUploadInput = z.infer<
  typeof ConfirmAttachmentVersionUploadSchema
>;

export const RestoreAttachmentSchema = z.object({
  workingPaperId: z.string().trim().optional().or(z.literal("")),
  workflowNodeId: z.string().trim().optional().or(z.literal("")),
});
export type RestoreAttachmentInput = z.infer<typeof RestoreAttachmentSchema>;

export const ResolveAttachmentConflictSchema = z.object({
  resolution: z.enum(["KEEP_SERVER", "USE_CANDIDATE", "REVERT_TO_BASE"]),
});
export type ResolveAttachmentConflictInput = z.infer<
  typeof ResolveAttachmentConflictSchema
>;

export const CreateProjectInvitationSchema = z.object({
  recipientUserId: z.string().trim().min(1, "Recipient is required"),
  invitedRole: ProjectRoleSchema,
  expiresInDays: z.number().int().min(1).max(30).default(7),
});
export type CreateProjectInvitationInput = z.infer<
  typeof CreateProjectInvitationSchema
>;

export const ProjectIndustryCodeSchema = z.enum([
  "FINANCIAL_SERVICES",
  "REAL_ESTATE_CONSTRUCTION",
  "MANUFACTURING",
  "CONSUMER_RETAIL",
  "TRADING_DISTRIBUTION",
  "TECH_MEDIA_TELECOM",
  "HEALTHCARE_LIFE_SCIENCES",
  "ENERGY_RESOURCES_UTILITIES",
  "TRANSPORT_LOGISTICS",
  "HOSPITALITY_LEISURE",
  "PROFESSIONAL_SERVICES",
  "PUBLIC_NON_PROFIT",
  "OTHER",
]);
export type ProjectIndustryCode = z.infer<typeof ProjectIndustryCodeSchema>;

export const AuditAreaCodeSchema = z.enum([
  "GENERAL_OTHER",
  "CASH",
  "REVENUE_RECEIVABLES",
  "INVENTORY",
  "PPE",
  "INTANGIBLES",
  "INVESTMENTS_FINANCIAL_INSTRUMENTS",
  "PURCHASES_PAYABLES_EXPENSES",
  "PAYROLL",
  "TAXATION",
  "EQUITY",
  "PROVISIONS_CONTINGENCIES",
  "GROUP_CONSOLIDATION",
  "RELATED_PARTIES",
  "GOING_CONCERN",
  "FINANCIAL_STATEMENTS_DISCLOSURES",
  "IT_SYSTEMS_CONTROLS",
]);
export type AuditAreaCode = z.infer<typeof AuditAreaCodeSchema>;

export const PROJECT_INDUSTRY_CODES = ProjectIndustryCodeSchema.options;
export const AUDIT_AREA_CODES = AuditAreaCodeSchema.options;

export const CreateProjectSchema = z
  .object({
    folderId: z.string().trim().min(1, "Desktop folder is required").optional(),
    name: z.string().trim().min(1, "Project name is required"),
    projectCode: z.string().trim().max(80).optional().or(z.literal("")),
    cmpClientId: z.string().trim().optional().or(z.literal("")),
    cmpEngagementId: z.string().trim().optional().or(z.literal("")),
    language: ProjectLanguageSchema,
    frameworkTemplateId: z.string().trim().optional().or(z.literal("")),
    applicableAccountingStandard: z
      .string()
      .trim()
      .max(300)
      .optional()
      .or(z.literal("")),
    projectPicUserId: z.string().trim().optional().or(z.literal("")),
    projectMicUserId: z.string().trim().optional().or(z.literal("")),
    projectPicUserIds: z.array(z.string().trim().min(1)).optional(),
    projectMicUserIds: z.array(z.string().trim().min(1)).optional(),
    projectTemplateId: z.string().trim().optional().or(z.literal("")),
    industryCode: ProjectIndustryCodeSchema.optional(),
    industrySourceText: z.string().trim().max(300).optional().or(z.literal("")),
    auditAreaCodes: z.array(AuditAreaCodeSchema).max(17).optional(),
    yearEndDate: z.string().min(1, "Year end date is required"),
    reportDate: z.string().min(1, "Report date is required"),
    archiveDeadline: z.string().min(1, "Archive deadline is required"),
    reportingDate: z.string().min(1, "Reporting date is required").optional(),
    ownerId: z.string().optional(),
    rollForwardFromProjectId: z.string().trim().optional().or(z.literal("")),
    inheritMembers: z.boolean().optional(),
    notes: z.string().optional(),
    archivePassword: z.string().max(100).optional(),
    invitations: z.array(CreateProjectInvitationSchema).max(20).optional(),
  })
  .superRefine((value, context) => {
    if (
      !value.applicableAccountingStandard?.trim() &&
      !value.frameworkTemplateId?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicableAccountingStandard"],
        message: "Applicable accounting standard is required",
      });
    }
  });
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  projectCode: z.string().trim().min(1, "Project code is required").max(80),
  yearEndDate: z.string().min(1, "Year end date is required"),
  reportDate: z.string().min(1, "Report date is required"),
  archiveDeadline: z.string().min(1, "Archive deadline is required"),
  reportingDate: z.string().min(1, "Reporting date is required").optional(),
  notes: z.string().optional(),
  archivePassword: z.string().max(100).optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const LinkProjectEngagementSchema = z.object({
  cmpClientId: z.string().trim().min(1),
  cmpEngagementId: z.string().trim().min(1),
});
export type LinkProjectEngagementInput = z.infer<
  typeof LinkProjectEngagementSchema
>;

const OptionalTrimmedStringSchema = (max = 255) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const ConfirmationAttachmentPreviewabilitySchema = z.enum([
  "INLINE",
  "DOWNLOAD_ONLY",
  "UNSUPPORTED",
]);
export type ConfirmationAttachmentPreviewability = z.infer<
  typeof ConfirmationAttachmentPreviewabilitySchema
>;

const OptionalNullableAttachmentStringSchema = (max = 255) =>
  z.string().trim().max(max).nullable().optional();

export const ConfirmationAttachmentContractSchema = z
  .object({
    originalFileName: OptionalNullableAttachmentStringSchema(255),
    originalMimeType: OptionalNullableAttachmentStringSchema(255),
    previewability:
      ConfirmationAttachmentPreviewabilitySchema.nullable().optional(),
    downloadUrl: OptionalNullableAttachmentStringSchema(2048),
    previewUrl: OptionalNullableAttachmentStringSchema(2048),
  })
  .strict();
export type ConfirmationAttachmentContract = z.infer<
  typeof ConfirmationAttachmentContractSchema
>;
export const CreateProjectConfirmationResponseSchema = z
  .object({
    responseChannel: ConfirmationResponseInputChannelSchema.default("PAPER"),
    receivedAt: z.string().datetime(),
    responseReference: OptionalTrimmedStringSchema(255),
    notes: OptionalTrimmedStringSchema(2000),
  })
  .strict();
export type CreateProjectConfirmationResponseInput = z.infer<
  typeof CreateProjectConfirmationResponseSchema
>;

const ConfirmationDraftLineSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

export const ConfirmationDraftPayloadSchema = z
  .object({
    clientName: OptionalTrimmedStringSchema(),
    clientCode: OptionalTrimmedStringSchema(80),
    fiscalYear: OptionalTrimmedStringSchema(40),
    balanceSheetDate: OptionalTrimmedStringSchema(40),
    contactName: OptionalTrimmedStringSchema(120),
    salutation: OptionalTrimmedStringSchema(120).optional(),
    contactEmail: OptionalTrimmedStringSchema(),
    customerName: OptionalTrimmedStringSchema(),
    projectName: OptionalTrimmedStringSchema(),
    projectCode: OptionalTrimmedStringSchema(80),
    picName: OptionalTrimmedStringSchema(120),
    auditorName: OptionalTrimmedStringSchema(),
    auditorAddress: OptionalTrimmedStringSchema(500),
    recipientName: OptionalTrimmedStringSchema(),
    recipientAddress: OptionalTrimmedStringSchema(500),
    yearEndDate: OptionalTrimmedStringSchema(80),
    accountNumber: OptionalTrimmedStringSchema(160),
    micName: OptionalTrimmedStringSchema(120),
    micEmail: OptionalTrimmedStringSchema(),
    micNameAndInitial: OptionalTrimmedStringSchema(120),
    reportDate: OptionalTrimmedStringSchema(40),
    officeDate: OptionalTrimmedStringSchema(80),
    referenceCode: OptionalTrimmedStringSchema(120),
    bankName: OptionalTrimmedStringSchema(),
    bankBranch: OptionalTrimmedStringSchema(),
    confirmationInformationLibraryEntryId: OptionalTrimmedStringSchema(191),
    counterpartyAddress: OptionalTrimmedStringSchema(500),
    counterpartyAttention: OptionalTrimmedStringSchema(500),
    counterpartyContact: OptionalTrimmedStringSchema(),
    counterpartyPhone: OptionalTrimmedStringSchema(120),
    counterpartyEmail: OptionalTrimmedStringSchema(),
    replyAddress: OptionalTrimmedStringSchema(500),
    replyContact: OptionalTrimmedStringSchema(),
    replyPhone: OptionalTrimmedStringSchema(120),
    replyFax: OptionalTrimmedStringSchema(120),
    replyPostalCode: OptionalTrimmedStringSchema(40),
    replyEmail: OptionalTrimmedStringSchema(),
    receivingSupplement: OptionalTrimmedStringSchema(500),
    authorizationAccount: OptionalTrimmedStringSchema(),
    companySignatureDate: OptionalTrimmedStringSchema(40),
    companyHandlerName: OptionalTrimmedStringSchema(120),
    companyHandlerTitle: OptionalTrimmedStringSchema(120),
    companyHandlerPhone: OptionalTrimmedStringSchema(120),
    draftNotes: OptionalTrimmedStringSchema(2000),
    sections: z
      .object({
        deposits: z.array(ConfirmationDraftLineSchema).optional(),
        loans: z.array(ConfirmationDraftLineSchema).optional(),
        closedAccounts: z.array(ConfirmationDraftLineSchema).optional(),
        guarantees: z.array(ConfirmationDraftLineSchema).optional(),
        bills: z.array(ConfirmationDraftLineSchema).optional(),
        lettersOfCredit: z.array(ConfirmationDraftLineSchema).optional(),
        derivatives: z.array(ConfirmationDraftLineSchema).optional(),
        custodyItems: z.array(ConfirmationDraftLineSchema).optional(),
        wealthProducts: z.array(ConfirmationDraftLineSchema).optional(),
        otherItems: z.array(ConfirmationDraftLineSchema).optional(),
      })
      .optional(),
  })
  .passthrough();
export type ConfirmationDraftPayload = z.infer<
  typeof ConfirmationDraftPayloadSchema
>;

export const UpdateProjectConfirmationDraftSchema = z.object({
  draftTemplateCode: ConfirmationDraftTemplateCodeSchema,
  draftPayload: ConfirmationDraftPayloadSchema,
  patchSource: ConfirmationDraftPatchSourceSchema.optional().default("MANUAL"),
});
export type UpdateProjectConfirmationDraftInput = z.infer<
  typeof UpdateProjectConfirmationDraftSchema
>;

export const CreateProjectConfirmationSchema = z
  .object({
    type: ConfirmationTypeSchema.optional(),
    draftTemplateCode: ConfirmationDraftTemplateCodeSchema.optional(),
    draftPayload: ConfirmationDraftPayloadSchema.optional(),
  })
  .strict()
  .refine((input) => input.type || input.draftTemplateCode, {
    message: "Confirmation type is required",
  });
export type CreateProjectConfirmationInput = z.infer<
  typeof CreateProjectConfirmationSchema
>;

export const UpdateProjectConfirmationSchema = z
  .object({
    type: ConfirmationTypeSchema.optional(),
    displayName: z.string().trim().min(1).max(160).optional(),
    plannedSendDate: OptionalTrimmedStringSchema(40),
    reportDeadline: OptionalTrimmedStringSchema(40),
    teamConfirmStatus: ConfirmationTeamConfirmStatusSchema.optional(),
    teamConfirmedByName: OptionalTrimmedStringSchema(),
    teamConfirmedAt: OptionalTrimmedStringSchema(40),
    notes: OptionalTrimmedStringSchema(2000),
  })
  .strict()
  .refine(
    (input) =>
      input.type !== undefined ||
      input.displayName !== undefined ||
      input.plannedSendDate !== undefined ||
      input.reportDeadline !== undefined ||
      input.teamConfirmStatus !== undefined ||
      input.teamConfirmedByName !== undefined ||
      input.teamConfirmedAt !== undefined ||
      input.notes !== undefined,
    "At least one confirmation field is required"
  );
export type UpdateProjectConfirmationInput = z.infer<
  typeof UpdateProjectConfirmationSchema
>;

export const CreateProjectConfirmationDispatchSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    method: ConfirmationDispatchMethodSchema,
    sentAt: z.string().trim().min(1, "Dispatch date is required").max(40),
    senderName: OptionalTrimmedStringSchema(),
    applicantName: OptionalTrimmedStringSchema(),
    recipientName: OptionalTrimmedStringSchema(),
    recipientContact: OptionalTrimmedStringSchema(),
    recipientPhone: OptionalTrimmedStringSchema(),
    courierName: OptionalTrimmedStringSchema(),
    trackingNumber: OptionalTrimmedStringSchema(),
    trackingCarrierCode: z.number().int().positive().optional(),
    trackingQueryParameters: z
      .record(
        z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
        z.string().trim().min(1).max(255)
      )
      .optional(),
    dispatchReference: OptionalTrimmedStringSchema(),
    followUpDate: OptionalTrimmedStringSchema(40),
    attachmentName: OptionalTrimmedStringSchema(255),
    notes: OptionalTrimmedStringSchema(2000),
    emailSubject: OptionalTrimmedStringSchema(255),
    emailBody: OptionalTrimmedStringSchema(5000),
    isRedispatch: z.boolean().optional(),
  })
  .superRefine((input, context) => {
    if (input.method === "EMAIL") {
      if (!z.email().safeParse(input.recipientContact).success) {
        context.addIssue({
          code: "custom",
          message: "Valid recipient email is required",
          path: ["recipientContact"],
        });
      }
      if (!input.emailSubject) {
        context.addIssue({
          code: "custom",
          message: "Email subject is required",
          path: ["emailSubject"],
        });
      }
      if (!input.emailBody) {
        context.addIssue({
          code: "custom",
          message: "Email body is required",
          path: ["emailBody"],
        });
      }
    }
  });
export type CreateProjectConfirmationDispatchInput = z.infer<
  typeof CreateProjectConfirmationDispatchSchema
>;

export const CorrectProjectConfirmationTrackingSchema = z
  .object({
    trackingNumber: z.string().trim().min(1).max(255),
    trackingCarrierCode: z.number().int().positive().optional(),
    trackingQueryParameters: z
      .record(
        z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
        z.string().trim().min(1).max(255)
      )
      .optional(),
    courierName: OptionalTrimmedStringSchema(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type CorrectProjectConfirmationTrackingInput = z.infer<
  typeof CorrectProjectConfirmationTrackingSchema
>;

export const PrepareProjectConfirmationDispatchSchema = z
  .object({
    method: ConfirmationDispatchMethodSchema.optional(),
    senderName: OptionalTrimmedStringSchema(),
    applicantName: OptionalTrimmedStringSchema(),
    recipientName: OptionalTrimmedStringSchema(),
    recipientContact: OptionalTrimmedStringSchema(),
    recipientPhone: OptionalTrimmedStringSchema(),
    courierName: OptionalTrimmedStringSchema(),
    trackingNumber: OptionalTrimmedStringSchema(),
    trackingCarrierCode: z.number().int().positive().optional(),
    dispatchReference: OptionalTrimmedStringSchema(),
    followUpDate: OptionalTrimmedStringSchema(40),
    attachmentName: OptionalTrimmedStringSchema(255),
    notes: OptionalTrimmedStringSchema(2000),
    markReady: z.boolean().optional().default(false),
  })
  .refine((input) => !input.markReady || input.method !== undefined, {
    message: "Dispatch method is required when marking ready",
    path: ["method"],
  });
export type PrepareProjectConfirmationDispatchInput = z.infer<
  typeof PrepareProjectConfirmationDispatchSchema
>;

export const SubmitProjectConfirmationSchema = z
  .object({
    expectedDraftUpdatedAt: z.string().datetime(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type SubmitProjectConfirmationInput = z.infer<
  typeof SubmitProjectConfirmationSchema
>;

export const WithdrawProjectConfirmationSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    reason: OptionalTrimmedStringSchema(2000),
  })
  .strict();
export type WithdrawProjectConfirmationInput = z.infer<
  typeof WithdrawProjectConfirmationSchema
>;

export const ConfirmationDispatchQueueQuerySchema = z.object({
  stage: z.enum(["AWAITING_CLAIM", "PENDING_DISPATCH", "SENT"]).optional(),
  channelIntent: ConfirmationDispatchMethodSchema.optional(),
  templateCode: ConfirmationDraftTemplateCodeSchema.optional(),
  type: ConfirmationTypeSchema.optional(),
  plannedSendFrom: z.string().datetime().optional(),
  plannedSendTo: z.string().datetime().optional(),
  projectId: z.string().min(1).optional(),
  picUserId: z.string().min(1).optional(),
  claimOwnerId: z.string().min(1).optional(),
  queueStatus: z.enum(["UNCLAIMED", "CLAIMED", "RETURNED"]).optional(),
  validationStatus: z.enum(["READY", "NEEDS_REVISION"]).optional(),
});
export type ConfirmationDispatchQueueQuery = z.infer<
  typeof ConfirmationDispatchQueueQuerySchema
>;

export const ClaimConfirmationDispatchQueueSchema = z
  .object({
    artifactId: z.string().min(1),
    expectedQueuedAt: z.string().datetime(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type ClaimConfirmationDispatchQueueInput = z.infer<
  typeof ClaimConfirmationDispatchQueueSchema
>;

export const ReleaseConfirmationDispatchQueueSchema = z
  .object({
    artifactId: z.string().min(1),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type ReleaseConfirmationDispatchQueueInput = z.infer<
  typeof ReleaseConfirmationDispatchQueueSchema
>;

export const ReturnConfirmationDispatchQueueSchema = z
  .object({
    artifactId: z.string().min(1),
    idempotencyKey: z.string().uuid(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export type ReturnConfirmationDispatchQueueInput = z.infer<
  typeof ReturnConfirmationDispatchQueueSchema
>;

export const CreateConfirmationDispatchBatchSchema = z.object({
  method: z.enum(["COURIER", "EMAIL", "POST", "HAND_DELIVERY", "OTHER"]),
  idempotencyKey: z.string().uuid(),
  items: z
    .array(
      z.object({
        confirmationId: z.string().min(1),
        artifactId: z.string().min(1),
      })
    )
    .min(1)
    .max(100),
});
export type CreateConfirmationDispatchBatchInput = z.infer<
  typeof CreateConfirmationDispatchBatchSchema
>;

export const ExecuteConfirmationDispatchBatchSchema = z.object({
  idempotencyKey: z.string().uuid(),
  courierMode: z.enum(["ORDER", "PICKUP"]).optional(),
});
export type ExecuteConfirmationDispatchBatchInput = z.infer<
  typeof ExecuteConfirmationDispatchBatchSchema
>;

export const CompleteMockCourierDeliverySchema = z
  .object({
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type CompleteMockCourierDeliveryInput = z.infer<
  typeof CompleteMockCourierDeliverySchema
>;

export const RecordConfirmationPackageEventSchema = z.object({
  idempotencyKey: z.string().uuid(),
  eventType: ConfirmationDispatchEventTypeSchema,
});
export type RecordConfirmationPackageEventInput = z.infer<
  typeof RecordConfirmationPackageEventSchema
>;

export const ReceivePaperResponseSchema = z.object({
  idempotencyKey: z.string().uuid(),
  pageCount: z.number().int().positive(),
  conditionNotes: z.string().trim().max(2000).optional(),
  storageLocation: z.string().trim().min(1).max(255),
});
export type ReceivePaperResponseInput = z.infer<
  typeof ReceivePaperResponseSchema
>;

export const ResolveConfirmationIntakeExceptionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  resolutionReason: z.string().trim().min(1).max(2000),
});
export type ResolveConfirmationIntakeExceptionInput = z.infer<
  typeof ResolveConfirmationIntakeExceptionSchema
>;

export const ConcludeConfirmationResponseSchema = z.object({
  idempotencyKey: z.string().uuid(),
  conclusion: ConfirmationDifferenceStatusSchema,
});
export type ConcludeConfirmationResponseInput = z.infer<
  typeof ConcludeConfirmationResponseSchema
>;

const ConfirmationEmpImportStringSchema = z.string().trim().min(1).max(255);

export const ConfirmationEmpImportModeSchema = z.enum([
  "FLAT",
  "GROUPED",
  "ZIP",
]);
export type ConfirmationEmpImportMode = z.infer<
  typeof ConfirmationEmpImportModeSchema
>;

export const ConfirmationEmpImportItemStatusSchema = z.enum([
  "ELIGIBLE",
  "IMPORTED",
  "BLOCKED",
]);
export type ConfirmationEmpImportItemStatus = z.infer<
  typeof ConfirmationEmpImportItemStatusSchema
>;

export const ConfirmationEmpImportJobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "PARTIAL_FAILURE",
  "FAILED",
  "WITHDRAWN",
]);
export type ConfirmationEmpImportJobStatus = z.infer<
  typeof ConfirmationEmpImportJobStatusSchema
>;

export const ConfirmationEmpImportJobItemStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "WITHDRAWN",
]);
export type ConfirmationEmpImportJobItemStatus = z.infer<
  typeof ConfirmationEmpImportJobItemStatusSchema
>;

export const ConfirmationEmpImportSourceRoleSchema = z.enum([
  "OUTGOING",
  "RESPONSE_ARTIFACT",
]);
export type ConfirmationEmpImportSourceRole = z.infer<
  typeof ConfirmationEmpImportSourceRoleSchema
>;

export const ConfirmationEmpImportPreviewQuerySchema = z
  .object({
    activeLinkKeys: z.preprocess(
      (value) => (typeof value === "string" ? [value] : value),
      z.array(z.string()).optional()
    ),
    mode: ConfirmationEmpImportModeSchema,
    targetDirectoryId: ConfirmationEmpImportStringSchema.optional(),
    confirmationId: ConfirmationEmpImportStringSchema.optional(),
    confirmationIds: z.preprocess(
      (value) => (typeof value === "string" ? [value] : value),
      ConfirmationEmpImportStringSchema.array()
        .min(1)
        .transform((values) => [...new Set(values)])
        .optional()
    ),
  })
  .strict();
export type ConfirmationEmpImportPreviewQuery = z.infer<
  typeof ConfirmationEmpImportPreviewQuerySchema
>;

export const ConfirmationEmpImportSourceProposalSchema = z
  .object({
    sourceConfirmationId: ConfirmationEmpImportStringSchema.optional(),
    empCode: ConfirmationEmpImportStringSchema,
    businessName: ConfirmationEmpImportStringSchema,
  })
  .strict();
export type ConfirmationEmpImportSourceProposal = z.infer<
  typeof ConfirmationEmpImportSourceProposalSchema
>;

export const ConfirmationEmpImportDirectorySchema = z
  .object({
    id: ConfirmationEmpImportStringSchema,
    code: ConfirmationEmpImportStringSchema,
    title: ConfirmationEmpImportStringSchema,
    path: ConfirmationEmpImportStringSchema,
    level: z.number().int().nonnegative(),
    canAcceptWorkflow: z.boolean(),
  })
  .strict();
export type ConfirmationEmpImportDirectory = z.infer<
  typeof ConfirmationEmpImportDirectorySchema
>;

export const ConfirmationEmpImportDirectorySelectionSchema = z
  .object({
    mode: ConfirmationEmpImportModeSchema,
    directory: ConfirmationEmpImportDirectorySchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (!input.directory.canAcceptWorkflow) {
      context.addIssue({
        code: "custom",
        path: ["directory"],
        message: `${input.mode} imports require a writable workflow directory`,
      });
    }
  });
export type ConfirmationEmpImportDirectorySelection = z.infer<
  typeof ConfirmationEmpImportDirectorySelectionSchema
>;

export function isConfirmationEmpImportDirectoryAllowed(
  mode: ConfirmationEmpImportMode,
  directory: ConfirmationEmpImportDirectory
) {
  return ConfirmationEmpImportDirectorySelectionSchema.safeParse({
    mode,
    directory,
  }).success;
}

export const ConfirmationEmpImportEligibleProjectSchema = z
  .object({
    id: ConfirmationEmpImportStringSchema,
    code: ConfirmationEmpImportStringSchema,
    name: ConfirmationEmpImportStringSchema,
  })
  .strict();
export type ConfirmationEmpImportEligibleProject = z.infer<
  typeof ConfirmationEmpImportEligibleProjectSchema
>;

export const ConfirmationEmpImportEligibleProjectsResponseSchema = z
  .object({
    projects: z.array(ConfirmationEmpImportEligibleProjectSchema),
  })
  .strict();
export type ConfirmationEmpImportEligibleProjectsResponse = z.infer<
  typeof ConfirmationEmpImportEligibleProjectsResponseSchema
>;

export const ConfirmationEmpImportSignoffPreviewSchema = z
  .object({
    preparerName: ConfirmationEmpImportStringSchema.nullable().optional(),
    reviewerName: ConfirmationEmpImportStringSchema.nullable().optional(),
    manual: z.boolean(),
  })
  .strict();
export type ConfirmationEmpImportSignoffPreview = z.infer<
  typeof ConfirmationEmpImportSignoffPreviewSchema
>;

export const ConfirmationEmpImportContainerSchema = z
  .object({
    code: ConfirmationEmpImportStringSchema,
    name: ConfirmationEmpImportStringSchema,
  })
  .strict();
export type ConfirmationEmpImportContainer = z.infer<
  typeof ConfirmationEmpImportContainerSchema
>;

export const ConfirmationEmpImportPreviewItemSchema = z
  .object({
    id: ConfirmationEmpImportStringSchema,
    sourceConfirmationId: ConfirmationEmpImportStringSchema.optional(),
    confirmationId: ConfirmationEmpImportStringSchema,
    confirmationCode: ConfirmationEmpImportStringSchema.nullable(),
    counterparty: ConfirmationEmpImportStringSchema,
    role: ConfirmationEmpImportSourceRoleSchema,
    sourceFileName: ConfirmationEmpImportStringSchema,
    sourceFileSize: z.number().int().nonnegative(),
    sourceProposal: ConfirmationEmpImportSourceProposalSchema,
    status: ConfirmationEmpImportItemStatusSchema,
    existingLocation: ConfirmationEmpImportStringSchema.nullable().optional(),
    existingCode: ConfirmationEmpImportStringSchema.nullable().optional(),
    existingJobId: ConfirmationEmpImportStringSchema.optional(),
    existingItemId: ConfirmationEmpImportStringSchema.optional(),
    reimportTargetDirectoryId: z.string().optional(),
    existingMode: ConfirmationEmpImportModeSchema.optional(),
    targetState: z
      .enum(["AVAILABLE", "RECYCLED", "MISSING", "CHANGED", "UNVERIFIED"])
      .optional(),
    signoff: ConfirmationEmpImportSignoffPreviewSchema,
    zipEntryName: ConfirmationEmpImportStringSchema.nullable().optional(),
    blockingIssues: z.array(ConfirmationEmpImportStringSchema),
  })
  .strict();
export type ConfirmationEmpImportPreviewItem = z.infer<
  typeof ConfirmationEmpImportPreviewItemSchema
>;

export const ConfirmationEmpImportPreviewResponseSchema = z
  .object({
    projectId: ConfirmationEmpImportStringSchema,
    mode: ConfirmationEmpImportModeSchema,
    targetDirectoryId: ConfirmationEmpImportStringSchema.nullable(),
    targetDirectories: z.array(ConfirmationEmpImportDirectorySchema),
    batchDirectory: ConfirmationEmpImportContainerSchema.nullable().optional(),
    zipWorkingPaper: ConfirmationEmpImportContainerSchema.nullable().optional(),
    counts: z
      .object({
        eligible: z.number().int().nonnegative(),
        imported: z.number().int().nonnegative(),
        blocked: z.number().int().nonnegative(),
      })
      .strict(),
    items: z.array(ConfirmationEmpImportPreviewItemSchema),
    zipEntries: z.array(ConfirmationEmpImportStringSchema),
    blockers: z.array(ConfirmationEmpImportStringSchema),
    fingerprint: ConfirmationEmpImportStringSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.mode === "GROUPED" && !input.batchDirectory) {
      context.addIssue({
        code: "custom",
        path: ["batchDirectory"],
        message: "GROUPED preview requires a batch directory",
      });
    }
    if (input.mode === "ZIP" && !input.zipWorkingPaper) {
      context.addIssue({
        code: "custom",
        path: ["zipWorkingPaper"],
        message: "ZIP preview requires one working paper",
      });
    }
    if (
      input.mode === "FLAT" &&
      (input.batchDirectory || input.zipWorkingPaper)
    ) {
      context.addIssue({
        code: "custom",
        path: ["mode"],
        message: "FLAT preview cannot contain a batch directory or ZIP paper",
      });
    }
  });
export type ConfirmationEmpImportPreviewResponse = z.infer<
  typeof ConfirmationEmpImportPreviewResponseSchema
>;

export const ConfirmationEmpImportCreateItemSchema = z
  .object({
    id: ConfirmationEmpImportStringSchema,
    sourceConfirmationId: ConfirmationEmpImportStringSchema.optional(),
    empCode: ConfirmationEmpImportStringSchema,
    businessName: ConfirmationEmpImportStringSchema,
  })
  .strict();
export type ConfirmationEmpImportCreateItem = z.infer<
  typeof ConfirmationEmpImportCreateItemSchema
>;

export const CreateConfirmationEmpImportJobSchema = z
  .object({
    mode: ConfirmationEmpImportModeSchema,
    targetDirectoryId: ConfirmationEmpImportStringSchema,
    previewFingerprint: ConfirmationEmpImportStringSchema,
    batchDirectory: ConfirmationEmpImportContainerSchema.optional(),
    zipWorkingPaper: ConfirmationEmpImportContainerSchema.optional(),
    items: z.array(ConfirmationEmpImportCreateItemSchema).min(1),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.mode === "GROUPED" && !input.batchDirectory) {
      context.addIssue({
        code: "custom",
        path: ["batchDirectory"],
        message: "GROUPED import requires a batch directory",
      });
    }
    if (input.mode === "ZIP" && !input.zipWorkingPaper) {
      context.addIssue({
        code: "custom",
        path: ["zipWorkingPaper"],
        message: "ZIP import requires one working paper",
      });
    }
    if (
      input.mode === "FLAT" &&
      (input.batchDirectory || input.zipWorkingPaper)
    ) {
      context.addIssue({
        code: "custom",
        path: ["mode"],
        message: "FLAT import cannot contain a batch directory or ZIP paper",
      });
    }
  });
export type CreateConfirmationEmpImportJobInput = z.infer<
  typeof CreateConfirmationEmpImportJobSchema
>;

export const ConfirmationEmpImportJobItemSchema = z
  .object({
    id: ConfirmationEmpImportStringSchema,
    sourceConfirmationId: ConfirmationEmpImportStringSchema.optional(),
    confirmationId: ConfirmationEmpImportStringSchema,
    sourceFileName: ConfirmationEmpImportStringSchema,
    status: ConfirmationEmpImportJobItemStatusSchema,
    targetLocation: ConfirmationEmpImportStringSchema.nullable().optional(),
    targetCode: ConfirmationEmpImportStringSchema.nullable().optional(),
    errorMessage: ConfirmationEmpImportStringSchema.nullable().optional(),
    retryable: z.boolean(),
  })
  .strict();
export type ConfirmationEmpImportJobItem = z.infer<
  typeof ConfirmationEmpImportJobItemSchema
>;

export const ConfirmationEmpImportJobSchema = z
  .object({
    id: ConfirmationEmpImportStringSchema,
    projectId: ConfirmationEmpImportStringSchema,
    mode: ConfirmationEmpImportModeSchema,
    status: ConfirmationEmpImportJobStatusSchema,
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    retryable: z.boolean(),
    previewFingerprint: ConfirmationEmpImportStringSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    withdrawnAt: z.string().datetime().nullable().optional(),
    items: z.array(ConfirmationEmpImportJobItemSchema),
  })
  .strict();
export type ConfirmationEmpImportJob = z.infer<
  typeof ConfirmationEmpImportJobSchema
>;

export const RetryConfirmationEmpImportSchema = z.object({}).strict();
export type RetryConfirmationEmpImportInput = z.infer<
  typeof RetryConfirmationEmpImportSchema
>;

const WithdrawConfirmationEmpImportSourceSchema = z
  .object({
    mode: z.enum(["FLAT", "GROUPED"]),
    scope: z.literal("SOURCE_CONFIRMATION"),
    sourceConfirmationId: ConfirmationEmpImportStringSchema,
    force: z.boolean().optional(),
  })
  .strict();

const WithdrawConfirmationEmpImportJobSchema = z
  .object({
    mode: ConfirmationEmpImportModeSchema,
    scope: z.literal("JOB"),
    force: z.boolean().optional(),
  })
  .strict();

const WithdrawConfirmationEmpImportItemSchema = z
  .object({
    mode: ConfirmationEmpImportModeSchema,
    scope: z.literal("ITEM"),
    itemId: ConfirmationEmpImportStringSchema,
    force: z.boolean().optional(),
  })
  .strict();

export const WithdrawConfirmationEmpImportSchema = z.union([
  WithdrawConfirmationEmpImportSourceSchema,
  WithdrawConfirmationEmpImportJobSchema,
  WithdrawConfirmationEmpImportItemSchema,
]);
export type WithdrawConfirmationEmpImportInput = z.infer<
  typeof WithdrawConfirmationEmpImportSchema
>;

export const RestoreConfirmationEmpImportSchema = z.union([
  WithdrawConfirmationEmpImportSourceSchema,
  WithdrawConfirmationEmpImportJobSchema,
]);
export type RestoreConfirmationEmpImportInput = z.infer<
  typeof RestoreConfirmationEmpImportSchema
>;
export const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required"),
  clientName: z.string().trim().min(1, "Client name is required"),
  description: z.string().optional(),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = CreateWorkspaceSchema;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

const StaffNoSchema = z
  .string()
  .trim()
  .max(40)
  .transform((value) => value || null);
const HourlyRateSchema = z.number().nonnegative().multipleOf(0.01);

export const CreateUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().trim().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  globalRole: GlobalRoleSchema,
  staffNo: StaffNoSchema.nullable().optional(),
  hourlyRate: HourlyRateSchema.nullable().optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z
  .object({
    projectAuthorizationImpactToken: z.string().length(64).optional(),
    globalRole: GlobalRoleSchema.optional(),
    status: UserStatusSchema.optional(),
    staffNo: StaffNoSchema.nullable().optional(),
    hourlyRate: HourlyRateSchema.nullable().optional(),
  })
  .refine(
    (input) =>
      input.globalRole !== undefined ||
      input.status !== undefined ||
      input.staffNo !== undefined ||
      input.hourlyRate !== undefined,
    "At least one user field is required"
  );
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ProjectAuthorizationImpact = {
  token: string;
  projects: {
    memberId: string;
    projectId: string;
    projectCode: string;
    projectName: string;
  }[];
};

export const UserPreferredLocaleSchema = z.enum(["zh-CN", "en-US"]);
export type UserPreferredLocale = z.infer<typeof UserPreferredLocaleSchema>;

export const CmpCurrencyOrderSchema = z
  .array(
    z.enum([
      "HKD",
      "CNY",
      "USD",
      "EUR",
      "GBP",
      "JPY",
      "SGD",
      "AUD",
      "CAD",
      "MYR",
      "VND",
      "THB",
    ])
  )
  .max(12)
  .refine(
    (currencies) => new Set(currencies).size === currencies.length,
    "Currencies cannot be repeated"
  );
export type CmpCurrencyOrder = z.infer<typeof CmpCurrencyOrderSchema>;

export const UpdateUserPreferencesSchema = z
  .object({
    preferredLocale: UserPreferredLocaleSchema.optional(),
    cmpCurrencyOrder: CmpCurrencyOrderSchema.optional(),
  })
  .refine(
    (input) =>
      input.preferredLocale !== undefined ||
      input.cmpCurrencyOrder !== undefined,
    "At least one preference is required"
  );
export type UpdateUserPreferencesInput = z.infer<
  typeof UpdateUserPreferencesSchema
>;

export const UserListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().or(z.literal("")),
  globalRole: GlobalRoleSchema.optional().or(z.literal("")),
  status: UserStatusSchema.optional().or(z.literal("")),
});
export type UserListQueryInput = z.infer<typeof UserListQuerySchema>;

export const ProjectInviteeDirectoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional().or(z.literal("")),
  browseAll: z.coerce.boolean().optional().default(false),
  globalRole: GlobalRoleSchema.optional().or(z.literal("")),
  excludeUserIds: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) =>
      value
        ? [
            ...new Set(
              value
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean)
            ),
          ]
        : []
    ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type ProjectInviteeDirectoryQueryInput = {
  q?: string;
  browseAll?: boolean;
  globalRole?: GlobalRole | "";
  excludeUserIds?: string[];
  page?: number;
  pageSize?: number;
};

export const ProjectInviteeDirectoryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  globalRole: GlobalRoleSchema,
  status: UserStatusSchema,
});
export type ProjectInviteeDirectoryEntry = z.infer<
  typeof ProjectInviteeDirectoryEntrySchema
>;

export const ProjectInviteeDirectoryResponseSchema = z.object({
  users: z.array(ProjectInviteeDirectoryEntrySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type ProjectInviteeDirectoryResponse = z.infer<
  typeof ProjectInviteeDirectoryResponseSchema
>;

export const CreateInvitationSchema = z.object({
  recipientUserId: z.string().trim().min(1).optional().or(z.literal("")),
  recipientEmail: z
    .string()
    .trim()
    .email("Valid email is required")
    .optional()
    .or(z.literal("")),
  invitedRole: ProjectRoleSchema,
  expiresInDays: z.number().int().min(1).max(30).default(7),
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

export const ConnectUserMailSchema = z.object({
  clientPassword: z.string().min(1, "Client password is required").max(512),
});
export type ConnectUserMailInput = z.infer<typeof ConnectUserMailSchema>;

export const ConnectTracking17TrackSchema = z
  .object({
    apiKey: z.string().trim().min(1, "API key is required").max(512),
  })
  .strict();
export type ConnectTracking17TrackInput = z.infer<
  typeof ConnectTracking17TrackSchema
>;

export const AcceptInvitationSchema = z.object({});
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;

export const UpdateProjectMemberRoleSchema = z.object({
  projectRole: ProjectRoleSchema,
});
export type UpdateProjectMemberRoleInput = z.infer<
  typeof UpdateProjectMemberRoleSchema
>;

export const UpdateProjectMemberInChargeRoleSchema = z.object({
  inChargeRole: InChargeRoleSchema.nullable(),
});
export const RecoverProjectPicSchema = z
  .object({
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export type RecoverProjectPicInput = z.infer<typeof RecoverProjectPicSchema>;
export const CreatePicRecoveryInvitationSchema = RecoverProjectPicSchema.extend(
  {
    recipientUserId: z.string().trim().min(1),
  }
);
export type CreatePicRecoveryInvitationInput = z.infer<
  typeof CreatePicRecoveryInvitationSchema
>;
export const ReauthorizeProjectMemberSchema = z
  .object({
    projectRole: ProjectRoleSchema,
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export type ReauthorizeProjectMemberInput = z.infer<
  typeof ReauthorizeProjectMemberSchema
>;
export type UpdateProjectMemberInChargeRoleInput = z.infer<
  typeof UpdateProjectMemberInChargeRoleSchema
>;

export const MoveProjectPlacementSchema = z.object({
  folderId: z.string().trim().min(1, "Folder is required"),
});
export type MoveProjectPlacementInput = z.infer<
  typeof MoveProjectPlacementSchema
>;

export const CreateDesktopFolderSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required").max(80),
});
export type CreateDesktopFolderInput = z.infer<
  typeof CreateDesktopFolderSchema
>;

export const UpdateDesktopFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine(
    (input) => input.name !== undefined || input.sortOrder !== undefined,
    "At least one folder field is required"
  );
export type UpdateDesktopFolderInput = z.infer<
  typeof UpdateDesktopFolderSchema
>;

export const UpdateDesktopProjectPlacementSchema = z
  .object({
    folderId: z.string().trim().min(1).optional(),
    desktopX: z.number().int().min(0).max(10_000).optional(),
    desktopY: z.number().int().min(0).max(10_000).optional(),
    sortOrder: z.number().int().min(0).optional(),
    lastOpened: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.folderId !== undefined ||
      input.desktopX !== undefined ||
      input.desktopY !== undefined ||
      input.sortOrder !== undefined ||
      input.lastOpened !== undefined,
    "At least one placement field is required"
  );
export type UpdateDesktopProjectPlacementInput = z.infer<
  typeof UpdateDesktopProjectPlacementSchema
>;

export const ReorderDesktopProjectPlacementsSchema = z.object({
  placements: z
    .array(
      z.object({
        projectId: z.string().trim().min(1),
        desktopX: z.number().int().min(0).max(10_000),
        desktopY: z.number().int().min(0).max(10_000),
        sortOrder: z.number().int().min(0),
      })
    )
    .min(1)
    .max(500),
});
export type ReorderDesktopProjectPlacementsInput = z.infer<
  typeof ReorderDesktopProjectPlacementsSchema
>;

export const CreateWorkflowNodeSchema = z.object({
  parentId: z
    .string()
    .trim()
    .min(1, "Parent node is required")
    .nullable()
    .optional()
    .or(z.literal("")),
  code: z.string().trim().min(1, "Code is required"),
  title: z.string().trim().min(1, "Title is required"),
});
export type CreateWorkflowNodeInput = z.infer<typeof CreateWorkflowNodeSchema>;

export const WorkflowNodeInsertPositionSchema = z.object({
  targetNodeId: z.string().trim().min(1, "Target node is required"),
  placement: z.enum(["BEFORE", "AFTER"]),
});
export type WorkflowNodeInsertPositionInput = z.infer<
  typeof WorkflowNodeInsertPositionSchema
>;

export const UpdateWorkflowNodeSchema = z
  .object({
    code: z.string().trim().min(1, "Code is required").optional(),
    title: z.string().trim().min(1, "Title is required").optional(),
    parentId: z
      .string()
      .trim()
      .min(1, "Parent node is required")
      .nullable()
      .optional()
      .or(z.literal("")),
    insert: WorkflowNodeInsertPositionSchema.optional(),
  })
  .refine(
    (input) =>
      input.code !== undefined ||
      input.title !== undefined ||
      "parentId" in input ||
      input.insert !== undefined,
    "At least one workflow node field is required"
  )
  .refine(
    (input) =>
      (input.code === undefined && input.title === undefined) ||
      (input.code !== undefined && input.title !== undefined),
    "Code and title must be updated together"
  );
export type UpdateWorkflowNodeInput = z.infer<typeof UpdateWorkflowNodeSchema>;

export const CreateWorkingPaperSchema = z.object({
  workflowNodeId: z.string().min(1),
  code: z.string().trim().min(1),
  title: z.string().trim().min(1),
  paperType: PaperTypeSchema,
  bucket: WorkingPaperBucketSchema.default("CURRENT"),
});
export type CreateWorkingPaperInput = z.infer<typeof CreateWorkingPaperSchema>;

export const ProjectFileExportJobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "DOWNLOADED",
  "EXPIRED",
]);
export type ProjectFileExportJobStatus = z.infer<
  typeof ProjectFileExportJobStatusSchema
>;

export const ProjectFileExportJobPhaseSchema = z.enum([
  "COLLECTING",
  "PACKAGING",
  "UPLOADING",
  "READY",
]);
export type ProjectFileExportJobPhase = z.infer<
  typeof ProjectFileExportJobPhaseSchema
>;

export const CreateProjectFileExportJobSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("ATTACHMENTS"),
    attachmentIds: z.array(z.string().trim().min(1)).min(1).max(5000),
  }),
  z.object({
    scope: z.literal("WORKFLOW_NODE"),
    workflowNodeId: z.string().trim().min(1),
    bucket: WorkingPaperBucketSchema,
  }),
]);
export type CreateProjectFileExportJobInput = z.infer<
  typeof CreateProjectFileExportJobSchema
>;

export const ProjectFileExportJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  scope: z.enum(["ATTACHMENTS", "WORKFLOW_NODE"]),
  bucket: WorkingPaperBucketSchema,
  workflowNodeId: z.string().nullable(),
  status: ProjectFileExportJobStatusSchema,
  currentPhase: ProjectFileExportJobPhaseSchema,
  completedFiles: z.number().int().nonnegative(),
  totalFiles: z.number().int().nonnegative(),
  totalSourceBytes: z.number().nonnegative(),
  errorMessage: z.string().nullable(),
  outputFileName: z.string().nullable(),
  outputFileSize: z.number().nonnegative().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
});
export type ProjectFileExportJob = z.infer<typeof ProjectFileExportJobSchema>;

export const ProjectTemplateListQuerySchema = z.object({
  language: ProjectLanguageSchema.optional().or(z.literal("")),
  frameworkTemplateId: z.string().trim().max(120).optional().or(z.literal("")),
  q: z.string().trim().max(100).optional().or(z.literal("")),
});
export type ProjectTemplateListQueryInput = z.infer<
  typeof ProjectTemplateListQuerySchema
>;

export const CreateProjectTemplateSchema = z.object({
  code: z.string().trim().min(1, "Template code is required").max(80),
  name: z.string().trim().min(1, "Template name is required").max(255),
  language: ProjectLanguageSchema.default("zh-CN"),
  frameworkTemplateId: z
    .string()
    .trim()
    .min(1, "Applicable standard is required"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  status: ProjectTemplateStatusSchema.default("DRAFT"),
});
export type CreateProjectTemplateInput = z.infer<
  typeof CreateProjectTemplateSchema
>;

export const ImportProjectTemplateZipSchema = CreateProjectTemplateSchema.pick({
  code: true,
  name: true,
  language: true,
  frameworkTemplateId: true,
});
export type ImportProjectTemplateZipInput = z.infer<
  typeof ImportProjectTemplateZipSchema
>;

export const UpdateProjectTemplateSchema = z
  .object({
    code: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    language: ProjectLanguageSchema.optional(),
    frameworkTemplateId: z.string().trim().min(1).optional(),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    status: ProjectTemplateStatusSchema.optional(),
  })
  .refine(
    (input) =>
      input.code !== undefined ||
      input.name !== undefined ||
      input.language !== undefined ||
      input.frameworkTemplateId !== undefined ||
      input.description !== undefined ||
      input.status !== undefined,
    "At least one project template field is required"
  );
export type UpdateProjectTemplateInput = z.infer<
  typeof UpdateProjectTemplateSchema
>;

export const CreateProjectTemplateNodeSchema = z.object({
  parentId: z.string().trim().optional().or(z.literal("")),
  code: z.string().trim().min(1, "Folder code is required").max(80),
  title: z.string().trim().min(1, "Folder title is required").max(255),
  auditAreaCode: AuditAreaCodeSchema.optional().nullable(),
});
export type CreateProjectTemplateNodeInput = z.infer<
  typeof CreateProjectTemplateNodeSchema
>;

export const UpdateProjectTemplateNodeSchema = z
  .object({
    code: z.string().trim().min(1).max(80).optional(),
    title: z.string().trim().min(1).max(255).optional(),
    auditAreaCode: AuditAreaCodeSchema.optional().nullable(),
  })
  .refine(
    (input) =>
      input.code !== undefined ||
      input.title !== undefined ||
      input.auditAreaCode !== undefined,
    "At least one folder field is required"
  );
export type UpdateProjectTemplateNodeInput = z.infer<
  typeof UpdateProjectTemplateNodeSchema
>;

export const ProjectTemplateFileInputSchema = z.object({
  code: z.string().trim().max(80).optional().or(z.literal("")),
  title: z.string().trim().max(255).optional().or(z.literal("")),
});
export type ProjectTemplateFileInput = z.infer<
  typeof ProjectTemplateFileInputSchema
>;

export const ProjectTemplateItemTypeSchema = z.enum(["FILE", "SMART_FORM"]);
export type ProjectTemplateItemType = z.infer<
  typeof ProjectTemplateItemTypeSchema
>;

export const UpdateProjectTemplateItemCodeSchema = z.object({
  sequence: z.number().int().positive(),
});
export type UpdateProjectTemplateItemCodeInput = z.infer<
  typeof UpdateProjectTemplateItemCodeSchema
>;

export const ReorderProjectTemplateItemsSchema = z.object({
  items: z
    .array(
      z.object({
        type: ProjectTemplateItemTypeSchema,
        id: z.string().trim().min(1),
      })
    )
    .min(1)
    .max(1000)
    .refine(
      (items) =>
        new Set(items.map((item) => `${item.type}:${item.id}`)).size ===
        items.length,
      "Project template item references must be unique"
    ),
});
export type ReorderProjectTemplateItemsInput = z.infer<
  typeof ReorderProjectTemplateItemsSchema
>;

export const CreateProjectTemplatePlaceholderSchema = z.object({
  code: z.string().trim().min(1, "Reference code is required").max(80),
  title: z.string().trim().min(1, "Leave-blank name is required").max(255),
  placeholderType: AttachmentPlaceholderTypeSchema.default("GENERIC"),
});
export type CreateProjectTemplatePlaceholderInput = z.infer<
  typeof CreateProjectTemplatePlaceholderSchema
>;

export const CreateProjectTemplateSmartFormSchema = z.object({
  smartFormTemplateVersionId: z.string().trim().min(1),
  code: z.string().trim().max(80).optional().or(z.literal("")),
  title: z.string().trim().max(255).optional().or(z.literal("")),
});
export type CreateProjectTemplateSmartFormInput = z.infer<
  typeof CreateProjectTemplateSmartFormSchema
>;

export const RequestProjectTemplateFileUploadUrlSchema =
  ProjectTemplateFileInputSchema.extend({
    fileName: z.string().trim().min(1, "File name is required").max(255),
    fileSize: z.number().int().positive(),
    mimeType: z.string().trim().min(1).max(255),
  });
export type RequestProjectTemplateFileUploadUrlInput = z.infer<
  typeof RequestProjectTemplateFileUploadUrlSchema
>;

export const ConfirmProjectTemplateFileUploadSchema =
  RequestProjectTemplateFileUploadUrlSchema.extend({
    objectKey: z.string().trim().min(1, "Object key is required"),
  });
export type ConfirmProjectTemplateFileUploadInput = z.infer<
  typeof ConfirmProjectTemplateFileUploadSchema
>;

export const ApplyProjectTemplateSchema = z
  .object({
    workflowNodeId: z.string().trim().min(1, "Target folder is required"),
    bucket: WorkingPaperBucketSchema.optional(),
    selectedTemplateFileIds: z
      .array(z.string().trim().min(1))
      .max(200)
      .optional(),
    selectedSmartFormReferenceIds: z
      .array(z.string().trim().min(1))
      .max(200)
      .optional(),
    referenceCodeOverrides: z
      .array(
        z.object({
          itemId: z.string().trim().min(1),
          code: z.string().trim().min(1).max(100),
        })
      )
      .max(200)
      .optional(),
  })
  .refine(
    (input) =>
      (input.selectedTemplateFileIds?.length ?? 0) +
        (input.selectedSmartFormReferenceIds?.length ?? 0) >
      0,
    "Select at least one template file or Smart Form"
  );
export type ApplyProjectTemplateInput = z.infer<
  typeof ApplyProjectTemplateSchema
>;

export const UpdateWorkingPaperSchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
  })
  .refine(
    (input) => input.code !== undefined || input.title !== undefined,
    "At least one working paper field is required"
  );
export type UpdateWorkingPaperInput = z.infer<typeof UpdateWorkingPaperSchema>;

export const UpdateWorkingPaperAssigneesSchema = z.object({
  preparerId: z.string().trim().optional().or(z.literal("")),
  reviewerId: z.string().trim().optional().or(z.literal("")),
});
export type UpdateWorkingPaperAssigneesInput = z.infer<
  typeof UpdateWorkingPaperAssigneesSchema
>;

export const RenameAttachmentSchema = z.object({
  originalName: z.string().trim().min(1, "File name is required").max(255),
});
export type RenameAttachmentInput = z.infer<typeof RenameAttachmentSchema>;

export const UpdateAttachmentIdentitySchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
  })
  .refine(
    (input) => input.code !== undefined || input.title !== undefined,
    "At least one file identity field is required"
  );
export type UpdateAttachmentIdentityInput = z.infer<
  typeof UpdateAttachmentIdentitySchema
>;

export const ReorderWorkingPaperAttachmentsSchema = z.object({
  workflowNodeId: z.string().trim().min(1),
  bucket: WorkingPaperBucketSchema,
  attachmentIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(1000)
    .refine(
      (attachmentIds) => new Set(attachmentIds).size === attachmentIds.length,
      "Attachment IDs must be unique"
    ),
});
export type ReorderWorkingPaperAttachmentsInput = z.infer<
  typeof ReorderWorkingPaperAttachmentsSchema
>;

export const RelocateAttachmentSchema = z
  .object({
    workingPaperId: z.string().trim().optional().or(z.literal("")),
    workflowNodeId: z.string().trim().optional().or(z.literal("")),
    bucket: WorkingPaperBucketSchema.optional(),
  })
  .superRefine((input, ctx) => {
    const hasWorkingPaperTarget = Boolean(input.workingPaperId?.trim());
    const hasWorkflowNodeTarget = Boolean(input.workflowNodeId?.trim());
    if (hasWorkingPaperTarget) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target must be a project folder",
        path: ["workingPaperId"],
      });
    }
    if (!hasWorkflowNodeTarget) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target folder is required",
        path: ["workflowNodeId"],
      });
    }
    if (!input.bucket) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target bucket is required",
        path: ["bucket"],
      });
    }
  });
export type RelocateAttachmentInput = z.infer<typeof RelocateAttachmentSchema>;

export const ReturnWorkingPaperSchema = z.object({
  reviewNote: z.string().trim().min(1).max(1000),
});
export type ReturnWorkingPaperInput = z.infer<typeof ReturnWorkingPaperSchema>;

const ReviewQuestionImageMimeTypeSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      (REVIEW_QUESTION_IMAGE_MIME_TYPES as readonly string[]).includes(
        value.toLowerCase()
      ),
    "This attachment type is not supported"
  );

export const RequestReviewQuestionImageUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required").max(255),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(
      REVIEW_QUESTION_IMAGE_MAX_SIZE_BYTES,
      "Attachment must be 25 MB or smaller"
    ),
  mimeType: ReviewQuestionImageMimeTypeSchema,
});
export type RequestReviewQuestionImageUploadUrlInput = z.infer<
  typeof RequestReviewQuestionImageUploadUrlSchema
>;

export const ConfirmReviewQuestionImageSchema =
  RequestReviewQuestionImageUploadUrlSchema.extend({
    objectKey: z.string().trim().min(1, "Object key is required"),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  });
export type ConfirmReviewQuestionImageInput = z.infer<
  typeof ConfirmReviewQuestionImageSchema
>;

export const CreateWorkingPaperQuestionSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
    assignedToId: z.string().trim().optional(),
    smartFormNodeId: z.string().trim().min(1).max(160).optional(),
    smartFormRowId: z.string().trim().min(1).max(160).optional(),
    smartFormTargetLabel: z.string().trim().min(1).max(1000).optional(),
    referencedWorkingPaperIds: z
      .array(z.string().trim().min(1))
      .max(20)
      .optional(),
  })
  .superRefine((input, context) => {
    if (
      (input.smartFormRowId || input.smartFormTargetLabel) &&
      !input.smartFormNodeId
    ) {
      context.addIssue({
        code: "custom",
        message: "A SmartForm review target requires a SmartForm node target",
        path: [
          input.smartFormRowId ? "smartFormRowId" : "smartFormTargetLabel",
        ],
      });
    }
  });
export type CreateWorkingPaperQuestionInput = z.infer<
  typeof CreateWorkingPaperQuestionSchema
>;

export const ReplyWorkingPaperQuestionSchema = z
  .object({
    replyBody: z.string().trim().max(2000).optional().or(z.literal("")),
    images: z
      .array(ConfirmReviewQuestionImageSchema)
      .max(REVIEW_QUESTION_IMAGE_MAX_PER_MESSAGE)
      .optional(),
    referencedWorkingPaperIds: z
      .array(z.string().trim().min(1))
      .max(20)
      .optional(),
  })
  .refine(
    (input) =>
      Boolean(input.replyBody?.trim()) ||
      Boolean(input.images?.length) ||
      Boolean(input.referencedWorkingPaperIds?.length),
    "Message requires text, an attachment, or a workpaper reference"
  );
export type ReplyWorkingPaperQuestionInput = z.infer<
  typeof ReplyWorkingPaperQuestionSchema
>;

export const AttachWorkingPaperQuestionMessageSchema = z
  .object({
    images: z
      .array(ConfirmReviewQuestionImageSchema)
      .max(REVIEW_QUESTION_IMAGE_MAX_PER_MESSAGE)
      .optional(),
  })
  .refine((input) => Boolean(input.images?.length), "Attachment is required");
export type AttachWorkingPaperQuestionMessageInput = z.infer<
  typeof AttachWorkingPaperQuestionMessageSchema
>;

export const FollowUpWorkingPaperQuestionSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type FollowUpWorkingPaperQuestionInput = z.infer<
  typeof FollowUpWorkingPaperQuestionSchema
>;

export type ApiErrorBody = {
  code: string;
  message: string;
  requestId: string;
};

export type ZipMasterFileEntry = {
  path: string;
  name: string;
  type: "file";
  size: number;
  modifiedAt?: string;
};

export type ZipMasterFolderEntry = {
  path: string;
  name: string;
  type: "folder";
  modifiedAt?: string;
  children?: ZipMasterEntry[];
};

export type ZipMasterEntry = ZipMasterFileEntry | ZipMasterFolderEntry;

const ZipMasterEntryBaseSchema = {
  path: z.string().min(1),
  name: z.string().min(1),
};

export const ZipMasterEntrySchema: z.ZodType<ZipMasterEntry> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z
      .object({
        ...ZipMasterEntryBaseSchema,
        type: z.literal("file"),
        size: z.number().int().nonnegative(),
        modifiedAt: z.string().datetime().optional(),
      })
      .strict(),
    z
      .object({
        ...ZipMasterEntryBaseSchema,
        type: z.literal("folder"),
        modifiedAt: z.string().datetime().optional(),
        children: z.array(ZipMasterEntrySchema).optional(),
      })
      .strict(),
  ])
);

export const ZipMasterSessionStateSchema = z.enum([
  "OPEN",
  "DIRTY",
  "CLOSING_WAITING_ENTRIES",
  "CHECKING_IN",
  "RELEASING",
  "CHECKIN_FAILED",
  "RELEASE_FAILED",
  "RECOVERABLE",
  "CLOSED",
  "LOCK_REVOKED",
  "BASE_VERSION_CONFLICT",
  "DRAFT_EXPIRED",
]);
export type ZipMasterSessionState = z.infer<typeof ZipMasterSessionStateSchema>;

const ZipMasterEntryPathSchema = z.string().min(1);
const ZipMasterFileOperationFields = {
  entryPath: ZipMasterEntryPathSchema,
  objectKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
};

export const ZipMasterOperationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ADD_FILE"),
      ...ZipMasterFileOperationFields,
    })
    .strict(),
  z
    .object({
      type: z.literal("REPLACE_FILE"),
      ...ZipMasterFileOperationFields,
    })
    .strict(),
  z
    .object({
      type: z.literal("DELETE_ENTRY"),
      entryPath: ZipMasterEntryPathSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("RENAME_ENTRY"),
      entryPath: ZipMasterEntryPathSchema,
      targetPath: ZipMasterEntryPathSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("MOVE_ENTRY"),
      entryPath: ZipMasterEntryPathSchema,
      targetPath: ZipMasterEntryPathSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("COPY_ENTRY"),
      entryPath: ZipMasterEntryPathSchema,
      targetPath: ZipMasterEntryPathSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("CREATE_FOLDER"),
      entryPath: ZipMasterEntryPathSchema,
    })
    .strict(),
]);
export type ZipMasterOperation = z.infer<typeof ZipMasterOperationSchema>;

const SmartFormLocaleSchema = z.enum(["zh-CN", "en-US"]);
export type SmartFormLocale = z.infer<typeof SmartFormLocaleSchema>;

export const SmartFormPackageSchema = z
  .object({
    packageType: z.literal("PROJECT_WING_SMART_FORM"),
    formatVersion: z.literal(2),
    template: z
      .object({
        id: z.string().trim().min(1).max(120),
        versionId: z.string().trim().min(1).max(120),
        code: z.string().trim().min(1).max(120),
        title: z.string().trim().min(1).max(500),
        publishedAt: z.string().datetime(),
        language: SmartFormLocaleSchema.optional(),
      })
      .strict(),
    definition: SmartFormV2DefinitionSchema,
    response: SmartFormV2ResponseSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type SmartFormPackage = z.infer<typeof SmartFormPackageSchema>;

export const CreateSmartFormTemplateSchema = z
  .object({
    code: z.string().trim().min(1, "Template code is required").max(80),
    name: z.string().trim().min(1, "Template name is required").max(255),
    frameworkTemplateId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .nullable()
      .or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    definition: SmartFormV2DefinitionSchema,
  })
  .strict();
export type CreateSmartFormTemplateInput = z.infer<
  typeof CreateSmartFormTemplateSchema
>;

export const UpdateSmartFormTemplateSchema = z
  .object({
    code: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    frameworkTemplateId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .nullable()
      .or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    definition: SmartFormV2DefinitionSchema.optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  })
  .refine(
    (input) =>
      input.code !== undefined ||
      input.name !== undefined ||
      input.frameworkTemplateId !== undefined ||
      input.description !== undefined ||
      input.definition !== undefined ||
      input.status !== undefined,
    "At least one Smart Form template field is required"
  );
export type UpdateSmartFormTemplateInput = z.infer<
  typeof UpdateSmartFormTemplateSchema
>;

export const SmartFormTemplateListQuerySchema = z
  .object({
    frameworkTemplateId: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal("")),
    q: z.string().trim().max(100).optional().or(z.literal("")),
  })
  .strict();
export type SmartFormTemplateListQueryInput = z.infer<
  typeof SmartFormTemplateListQuerySchema
>;

export const CreateProjectSmartFormSchema = z.object({
  smartFormTemplateVersionId: z.string().trim().min(1),
  code: z.string().trim().max(80).optional().or(z.literal("")),
  title: z.string().trim().max(255).optional().or(z.literal("")),
  language: SmartFormLocaleSchema.optional(),
});
export type CreateProjectSmartFormInput = z.infer<
  typeof CreateProjectSmartFormSchema
>;

export const SaveSmartFormPackageSchema = z.object({
  lockSessionId: z.string().trim().min(1),
  package: SmartFormPackageSchema,
});
export type SaveSmartFormPackageInput = z.infer<
  typeof SaveSmartFormPackageSchema
>;

// CMP dashboard
export const CmpDashboardChangeItemSchema = z.object({
  id: z.string(),
  type: z.enum(["engagement", "client", "approval", "draft"]),
  title: z.string(),
  subtitle: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type CmpDashboardChangeItem = z.infer<
  typeof CmpDashboardChangeItemSchema
>;

export const CmpDashboardSummarySchema = z.object({
  draftsAssignedToMe: z.number().int().min(0),
  approvalsAssignedToMe: z.number().int().min(0),
  returnedRequests: z.number().int().min(0),
  myClients: z.number().int().min(0),
  myEngagements: z.number().int().min(0),
  recentChanges: z.array(CmpDashboardChangeItemSchema),
  recentApprovals: z.array(CmpDashboardChangeItemSchema),
});
export type CmpDashboardSummary = z.infer<typeof CmpDashboardSummarySchema>;

// CMP client groups
const CmpClientGroupStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const CmpClientRelationshipTypeEnum = z.enum([
  "SUBSIDIARY",
  "ASSOCIATE",
  "JOINT_VENTURE",
]);
export type CmpClientRelationshipType = z.infer<
  typeof CmpClientRelationshipTypeEnum
>;

export const CmpClientSummarySchema = z.object({
  id: z.string(),
  clientCode: z.string(),
  nameZh: z.string().nullable(),
  nameEn: z.string().nullable(),
  groupId: z.string().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "RESIGNED"]),
});
export type CmpClientSummary = z.infer<typeof CmpClientSummarySchema>;

const CmpClientGroupBase = z.object({
  groupCode: z.string().trim().min(1).max(50),
  nameZh: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().max(200).optional(),
});

export const CreateCmpClientGroupSchema = CmpClientGroupBase;
export type CreateCmpClientGroupInput = z.infer<
  typeof CreateCmpClientGroupSchema
>;

export const UpdateCmpClientGroupSchema = z.object({
  groupCode: CmpClientGroupBase.shape.groupCode.optional(),
  nameZh: CmpClientGroupBase.shape.nameZh.optional(),
  nameEn: z.string().trim().max(200).optional(),
  status: CmpClientGroupStatusEnum.optional(),
});
export type UpdateCmpClientGroupInput = z.infer<
  typeof UpdateCmpClientGroupSchema
>;

export const CmpClientGroupSchema = z.object({
  id: z.string(),
  groupCode: z.string(),
  nameZh: z.string().nullable(),
  nameEn: z.string().nullable(),
  status: CmpClientGroupStatusEnum,
  clientCount: z.number().int().min(0),
  ultimateParentClientId: z.string().nullable().optional(),
  ultimateParent: CmpClientSummarySchema.nullable().optional(),
  createdById: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CmpClientGroup = z.infer<typeof CmpClientGroupSchema>;

export const CmpClientGroupsResponseSchema = z.object({
  groups: z.array(CmpClientGroupSchema),
});
export type CmpClientGroupsResponse = z.infer<
  typeof CmpClientGroupsResponseSchema
>;

// CMP clients
const CmpClientStatusEnum = z.enum(["ACTIVE", "INACTIVE", "RESIGNED"]);
const CmpNewClientStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);
const CmpOptionalText = (max: number) => z.string().trim().max(max).optional();
const CmpOptionalDate = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || isValidIsoDate(value),
    "Expected a real calendar date in YYYY-MM-DD format"
  )
  .optional();

export const CmpClientRelationshipDirectionEnum = z.enum([
  "FROM_CLIENT",
  "TO_CLIENT",
]);
export type CmpClientRelationshipDirection = z.infer<
  typeof CmpClientRelationshipDirectionEnum
>;

export const CmpClientUltimateParentActionEnum = z.enum([
  "UNCHANGED",
  "SET_CURRENT",
  "CLEAR",
]);
export type CmpClientUltimateParentAction = z.infer<
  typeof CmpClientUltimateParentActionEnum
>;

export const CmpClientRelationshipProposalSchema = z.object({
  action: z.enum(["UPSERT", "END"]),
  relationshipId: z.string().trim().optional(),
  groupId: z.string().trim().optional(),
  type: CmpClientRelationshipTypeEnum.optional(),
  direction: CmpClientRelationshipDirectionEnum.optional(),
  counterpartClientId: z.string().trim().optional(),
  ownershipPercentage: z.number().min(0).max(100).optional(),
  effectiveFrom: CmpOptionalDate,
  effectiveTo: CmpOptionalDate,
  remarks: CmpOptionalText(2000),
});
export type CmpClientRelationshipProposal = z.infer<
  typeof CmpClientRelationshipProposalSchema
>;

export const CmpClientGroupStructureProposalSchema = z.object({
  primaryGroupId: z.string().trim().nullable().optional(),
  ultimateParentAction: CmpClientUltimateParentActionEnum.optional(),
  relationships: z
    .array(CmpClientRelationshipProposalSchema)
    .max(100)
    .optional(),
});
export type CmpClientGroupStructureProposal = z.infer<
  typeof CmpClientGroupStructureProposalSchema
>;

export const RETIRED_CMP_CLIENT_FIELDS = [
  "prcOperationStatus",
  "prcOperationDetails",
  "hasPrcOperation",
  "booksAndRecordsInPrcStatus",
  "booksAndRecordsLocation",
  "booksAndRecordsInPrc",
  "prcArchiveStatus",
  "hasPrcArchive",
  "ultimateShareholdingAvailable",
  "shareholdingByPrcEnterprise",
  "shareholdingByPrcIndividual",
  "shareholdingByHkMacaoTaiwanInvestors",
  "otherInvestors",
  "otherInvestorsDetails",
  "shareholdingRemark",
  "shareholdingEffectiveDate",
  "shareholdingChangeDetails",
  "prcEstablishments",
  "mofBaseVersion",
] as const;

export function findRetiredCmpClientFields(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  const record = value as Record<string, unknown>;
  return RETIRED_CMP_CLIENT_FIELDS.filter((field) => field in record);
}

export const CMP_HSIC_SECTION_OPTIONS = [
  { code: "A", en: "Agriculture, forestry and fishing", zh: "农、林、渔业" },
  { code: "B", en: "Mining and quarrying", zh: "采矿及采石业" },
  { code: "C", en: "Manufacturing", zh: "制造业" },
  {
    code: "D",
    en: "Electricity, gas, steam and air-conditioning supply",
    zh: "电力、燃气、蒸汽及空调供应",
  },
  {
    code: "E",
    en: "Water supply; sewerage, waste management and remediation",
    zh: "供水、污水处理、废物管理及修复活动",
  },
  { code: "F", en: "Construction", zh: "建造业" },
  {
    code: "G",
    en: "Import/export, wholesale and retail trades",
    zh: "进出口、批发及零售业",
  },
  {
    code: "H",
    en: "Transportation, storage, postal and courier services",
    zh: "运输、仓储、邮政及速递服务业",
  },
  {
    code: "I",
    en: "Accommodation and food service activities",
    zh: "住宿及膳食服务活动",
  },
  { code: "J", en: "Information and communications", zh: "信息及通讯业" },
  { code: "K", en: "Financing and insurance", zh: "金融及保险业" },
  { code: "L", en: "Real estate", zh: "地产业" },
  {
    code: "M",
    en: "Professional, scientific and technical activities",
    zh: "专业、科学及技术活动",
  },
  {
    code: "N",
    en: "Administrative and support service activities",
    zh: "行政及支援服务活动",
  },
  { code: "O", en: "Public administration", zh: "公共行政" },
  { code: "P", en: "Education", zh: "教育" },
  {
    code: "Q",
    en: "Human health and social work activities",
    zh: "人类保健及社会工作活动",
  },
  {
    code: "R",
    en: "Arts, entertainment and recreation",
    zh: "艺术、娱乐及康乐活动",
  },
  { code: "S", en: "Other service activities", zh: "其他服务活动" },
  {
    code: "T",
    en: "Activities of households as employers and for own use",
    zh: "作为雇主的住户活动及住户自用的未分类物品和服务生产活动",
  },
  {
    code: "U",
    en: "Activities of extraterritorial organisations and bodies",
    zh: "国际组织及机构活动",
  },
] as const;

export const CmpHsicSectionCodeSchema = z.enum([
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "OTHER",
]);
export type CmpHsicSectionCode = z.infer<typeof CmpHsicSectionCodeSchema>;

export const CmpCompanyIdentifierTypeSchema = z.enum([
  "COMPANY_REGISTRATION_NUMBER",
  "BUSINESS_REGISTRATION_NUMBER",
  "LEI",
  "OTHER",
]);
export type CmpCompanyIdentifierType = z.infer<
  typeof CmpCompanyIdentifierTypeSchema
>;

export const CmpClientAddressTypeSchema = z.enum([
  "REGISTERED",
  "PRINCIPAL",
  "OTHER",
]);
export type CmpClientAddressType = z.infer<typeof CmpClientAddressTypeSchema>;

export const CmpClientAdditionalAddressInputSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().max(120),
  address: z.string().trim().max(2000),
  sortOrder: z.number().int().min(0).optional(),
});
export type CmpClientAdditionalAddressInput = z.infer<
  typeof CmpClientAdditionalAddressInputSchema
>;

export const CmpClientAddressSchema = z.object({
  id: z.string(),
  type: CmpClientAddressTypeSchema,
  label: z.string().nullable(),
  address: z.string(),
  sortOrder: z.number().int(),
});
export type CmpClientAddress = z.infer<typeof CmpClientAddressSchema>;

export const CmpClientContactInputSchema = z.object({
  id: z.string().trim().optional(),
  name: CmpOptionalText(200),
  position: CmpOptionalText(200),
  department: CmpOptionalText(200),
  officePhone: CmpOptionalText(100),
  mobile: CmpOptionalText(100),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  remarks: CmpOptionalText(2000),
  sortOrder: z.number().int().min(0).optional(),
});
export type CmpClientContactInput = z.infer<typeof CmpClientContactInputSchema>;

export const CmpClientContactSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  position: z.string().nullable(),
  department: z.string().nullable(),
  officePhone: z.string().nullable(),
  mobile: z.string().nullable(),
  email: z.string().nullable(),
  remarks: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type CmpClientContact = z.infer<typeof CmpClientContactSchema>;

const CmpClientBase = z
  .object({
    clientCode: z.string().trim().min(1).max(50),
    companyCode: CmpOptionalText(100),
    companyIdentifierType: CmpCompanyIdentifierTypeSchema.optional(),
    companyIdentityResolution: CmpCompanyIdentityResolutionSchema.optional(),
    companyNumber: CmpOptionalText(100),
    nameZh: CmpOptionalText(200),
    nameEn: CmpOptionalText(200),
    groupId: z.string().trim().optional(),
    groupMode: CmpOptionalText(50),
    groupName: CmpOptionalText(200),
    address: CmpOptionalText(1000),
    contactPerson: CmpOptionalText(200),
    telephone: CmpOptionalText(100),
    email: z.string().trim().email().max(320).optional().or(z.literal("")),
    website: CmpOptionalText(300),
    yearEndDate: CmpOptionalDate,
    yearEndMonth: z.number().int().min(1).max(12).optional(),
    hsicSectionCode: CmpHsicSectionCodeSchema.optional(),
    industryOtherDescription: CmpOptionalText(2000),
    reportingGaap: CmpOptionalText(500),
    contactPosition: CmpOptionalText(200),
    contactDepartment: CmpOptionalText(200),
    contactMobile: CmpOptionalText(100),
    contactRemarks: CmpOptionalText(2000),
    contacts: z.array(CmpClientContactInputSchema).max(50).optional(),
    registeredAddress: CmpOptionalText(2000),
    principalBusinessAddress: CmpOptionalText(2000),
    principalAddressSameAsRegistered: z.boolean().optional(),
    additionalAddresses: z
      .array(CmpClientAdditionalAddressInputSchema)
      .optional(),
    placeOfIncorporation: CmpOptionalText(200),
    incorporationYearMonth: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/)
      .optional()
      .or(z.literal("")),
    listedOrPrivate: CmpOptionalText(50),
    companyTypeOtherDescription: CmpOptionalText(1000),
    stockExchangeOrListingPlace: CmpOptionalText(200),
    stockCode: CmpOptionalText(50),
    marketSegment: CmpOptionalText(50),
    regulatedEntities: CmpOptionalText(500),
    regulatedBy: CmpOptionalText(500),
    isSubsidiary: z.boolean().optional(),
    parentClientCode: CmpOptionalText(100),
    parentHoldingCompanyName: CmpOptionalText(200),
    hasSubsidiariesOrAssociates: z.boolean().optional(),
    subsidiariesOrAssociates: CmpOptionalText(4000),
    referredBy: CmpOptionalText(200),
    clientPartnerPicId: z.string().trim().optional().or(z.literal("")),
    clientPartnerPic: CmpOptionalText(200),
    clientLeadingPartnerId: z.string().trim().optional().or(z.literal("")),
    clientLeadingPartner: CmpOptionalText(200),
    clientManagerMicId: z.string().trim().optional().or(z.literal("")),
    clientManagerMic: CmpOptionalText(200),
    alternativePartnerSecondMicId: z
      .string()
      .trim()
      .optional()
      .or(z.literal("")),
    alternativePartnerSecondMic: CmpOptionalText(200),
    expectedJobOrEngagementType: CmpOptionalText(200),
    serviceType: CmpOptionalText(50),
    serviceLines: CmpOptionalText(1000),
    taxServiceDetails: CmpOptionalText(1000),
    comSecServiceDetails: CmpOptionalText(1000),
    otherServiceDescription: CmpOptionalText(1000),
    approvalReferenceNumber: CmpOptionalText(100),
    approvalDate: CmpOptionalDate,
    remarks: CmpOptionalText(2000),
    preparedBy: CmpOptionalText(200),
    approvedBy: CmpOptionalText(200),
    micApproval: CmpOptionalText(200),
    picApproval: CmpOptionalText(200),
    itAdmin: CmpOptionalText(200),
    signOffDate: CmpOptionalDate,
  })
  .strict();

export const CreateCmpClientSchema = CmpClientBase.extend({
  status: CmpNewClientStatusEnum.optional(),
});
export type CreateCmpClientInput = z.infer<typeof CreateCmpClientSchema>;

export const UpdateCmpClientSchema = CmpClientBase.partial().extend({
  status: CmpClientStatusEnum.optional(),
});
export type UpdateCmpClientInput = z.infer<typeof UpdateCmpClientSchema>;

// A draft is a recoverable editing snapshot, not a valid Client record. Keep
// Its static shape for callers, while deliberately accepting incomplete and
// Temporarily malformed field values at the API boundary. Formal submission
// Is still validated by assertCompleteClientAcceptancePayload.
export type CmpClientAcceptanceDraftPayload = Partial<
  Omit<CreateCmpClientInput, "status">
> & {
  status?: z.infer<typeof CmpClientStatusEnum>;
  groupStructure?: CmpClientGroupStructureProposal;
  entityMap?: {
    choice?: "YES" | "NO" | null;
    mapId?: string;
    nodeId?: string;
  };
  relatedEntities?: z.infer<typeof CmpRelatedEntityDraftSchema>[];
  relatedRelationships?: z.infer<typeof CmpEntityRelationshipDraftSchema>[];
  relatedGroupRelationships?: z.infer<typeof CmpGroupRelationshipDraftSchema>[];
  removedGroupRelationshipIds?: string[];
  companyIdentityResolution?: CmpCompanyIdentityResolution;
};
const CmpClientAcceptanceDraftLooseShape = Object.fromEntries(
  Object.keys(CmpClientBase.shape).map((key) => [key, z.unknown().optional()])
) as Record<string, z.ZodOptional<z.ZodUnknown>>;

export const CmpClientAcceptanceDraftPayloadSchema = z
  .object({
    ...CmpClientAcceptanceDraftLooseShape,
    status: z.unknown().optional(),
    groupStructure: z.unknown().optional(),
    entityMap: z.unknown().optional(),
    relatedEntities: z.unknown().optional(),
    relatedRelationships: z.unknown().optional(),
    relatedGroupRelationships: z.unknown().optional(),
    removedGroupRelationshipIds: z.unknown().optional(),
    companyIdentityResolution: z.unknown().optional(),
  })
  .strict() as z.ZodType<CmpClientAcceptanceDraftPayload>;

export const CmpClientListQuerySchema = z.object({
  status: CmpClientStatusEnum.optional(),
  groupId: z.string().trim().optional(),
  q: z.string().trim().optional(),
});
export type CmpClientListQuery = z.infer<typeof CmpClientListQuerySchema>;

export const CmpClientGroupRefSchema = z.object({
  id: z.string(),
  groupCode: z.string(),
  nameZh: z.string().nullable(),
  nameEn: z.string().nullable(),
  status: CmpClientGroupStatusEnum,
});

export const CmpClientRelationshipSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  fromClientId: z.string(),
  toClientId: z.string(),
  type: CmpClientRelationshipTypeEnum,
  ownershipPercentage: z.number().nullable(),
  effectiveFrom: z.string().nullable(),
  effectiveTo: z.string().nullable(),
  remarks: z.string().nullable(),
  approvedViaRequestId: z.string().nullable(),
  fromClient: CmpClientSummarySchema,
  toClient: CmpClientSummarySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CmpClientRelationship = z.infer<typeof CmpClientRelationshipSchema>;

export type CmpClientSubsidiaryNode = {
  client: CmpClientSummary;
  relationship: CmpClientRelationship | null;
  children: CmpClientSubsidiaryNode[];
};

export const CmpClientSubsidiaryNodeSchema: z.ZodType<CmpClientSubsidiaryNode> =
  z.lazy(() =>
    z.object({
      client: CmpClientSummarySchema,
      relationship: CmpClientRelationshipSchema.nullable(),
      children: z.array(CmpClientSubsidiaryNodeSchema),
    })
  );

export const CmpClientGroupStructureWarningSchema = z.object({
  code: z.enum([
    "ULTIMATE_PARENT_NOT_ASSIGNED",
    "LEGACY_PARENT_UNRESOLVED",
    "LEGACY_RELATIONSHIP_NOTE",
  ]),
  message: z.string(),
  clientId: z.string().nullable(),
});

export const CmpClientGroupStructureSchema = z.object({
  group: CmpClientGroupSchema,
  ultimateParent: CmpClientSummarySchema.nullable(),
  subsidiaryTree: z.array(CmpClientSubsidiaryNodeSchema),
  associates: z.array(CmpClientRelationshipSchema),
  jointVentures: z.array(CmpClientRelationshipSchema),
  relationshipHistory: z.array(CmpClientRelationshipSchema),
  warnings: z.array(CmpClientGroupStructureWarningSchema),
});
export type CmpClientGroupStructure = z.infer<
  typeof CmpClientGroupStructureSchema
>;

export const CmpClientSchema = z.object({
  id: z.string(),
  clientCode: z.string(),
  // Older version snapshots pre-date the independent Company Code field.
  // Keep parsing them while all current API responses include the field.
  companyCode: z.string().nullable().optional(),
  companyIdentifierType: CmpCompanyIdentifierTypeSchema.optional(),
  companyNumber: z.string().nullable(),
  nameZh: z.string(),
  nameEn: z.string().nullable(),
  groupId: z.string().nullable(),
  group: CmpClientGroupRefSchema.nullable(),
  groupMode: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  isUltimateParentOfGroupId: z.string().nullable().optional(),
  relationships: z.array(CmpClientRelationshipSchema).optional(),
  address: z.string().nullable(),
  addresses: z.array(CmpClientAddressSchema).optional(),
  contactPerson: z.string().nullable(),
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  yearEndDate: z.string().nullable(),
  yearEndMonth: z.number().int().min(1).max(12).nullable().optional(),
  hsicSectionCode: CmpHsicSectionCodeSchema.nullable().optional(),
  industryOtherDescription: z.string().nullable().optional(),
  reportingGaap: z.string().nullable().optional(),
  contactPosition: z.string().nullable().optional(),
  contactDepartment: z.string().nullable().optional(),
  contactMobile: z.string().nullable().optional(),
  contactRemarks: z.string().nullable().optional(),
  contacts: z.array(CmpClientContactSchema).optional(),
  principalAddressSameAsRegistered: z.boolean().optional(),
  placeOfIncorporation: z.string().nullable(),
  incorporationYearMonth: z.string().nullable().optional(),
  listedOrPrivate: z.string().nullable(),
  companyTypeOtherDescription: z.string().nullable().optional(),
  stockExchangeOrListingPlace: z.string().nullable(),
  stockCode: z.string().nullable(),
  marketSegment: z.string().nullable(),
  regulatedEntities: z.string().nullable(),
  regulatedBy: z.string().nullable().optional(),
  isSubsidiary: z.boolean(),
  parentClientCode: z.string().nullable(),
  parentHoldingCompanyName: z.string().nullable().optional(),
  hasSubsidiariesOrAssociates: z.boolean().optional(),
  subsidiariesOrAssociates: z.string().nullable(),
  referredBy: z.string().nullable(),
  clientPartnerPicId: z.string().nullable().optional(),
  clientPartnerPic: z.string().nullable(),
  clientLeadingPartnerId: z.string().nullable().optional(),
  clientLeadingPartner: z.string().nullable().optional(),
  clientManagerMicId: z.string().nullable().optional(),
  clientManagerMic: z.string().nullable(),
  alternativePartnerSecondMicId: z.string().nullable().optional(),
  alternativePartnerSecondMic: z.string().nullable(),
  expectedJobOrEngagementType: z.string().nullable(),
  serviceType: z.string().nullable().optional(),
  serviceLines: z.string().nullable(),
  taxServiceDetails: z.string().nullable().optional(),
  comSecServiceDetails: z.string().nullable().optional(),
  otherServiceDescription: z.string().nullable().optional(),
  approvalReferenceNumber: z.string().nullable(),
  approvalDate: z.string().nullable(),
  remarks: z.string().nullable().optional(),
  preparedBy: z.string().nullable(),
  approvedBy: z.string().nullable(),
  micApproval: z.string().nullable(),
  picApproval: z.string().nullable(),
  itAdmin: z.string().nullable(),
  signOffDate: z.string().nullable(),
  status: CmpClientStatusEnum,
  createdById: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CmpClient = z.infer<typeof CmpClientSchema>;

export const CmpClientsResponseSchema = z.object({
  clients: z.array(CmpClientSchema),
});
export type CmpClientsResponse = z.infer<typeof CmpClientsResponseSchema>;

export const CmpClientVersionSourceTypeSchema = z.enum([
  "BASELINE",
  "CLIENT_ACCEPTANCE",
  "CLIENT_CHANGE",
]);
export type CmpClientVersionSourceType = z.infer<
  typeof CmpClientVersionSourceTypeSchema
>;

export const CmpClientVersionActorSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1),
});
export type CmpClientVersionActor = z.infer<typeof CmpClientVersionActorSchema>;

export const CmpClientVersionSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  versionNumber: z.number().int().positive(),
  sourceType: CmpClientVersionSourceTypeSchema,
  acceptanceRequestId: z.string().nullable(),
  acceptanceRequestNo: z.string().nullable(),
  changedBy: CmpClientVersionActorSchema,
  approvedBy: CmpClientVersionActorSchema.nullable(),
  approvedAt: z.string().nullable(),
  schemaVersion: z.number().int().positive(),
  changedFieldCount: z.number().int().nonnegative(),
  changedFields: z.array(z.string()),
  createdAt: z.string(),
});
export type CmpClientVersion = z.infer<typeof CmpClientVersionSchema>;

export const CmpClientVersionListQuerySchema = z.object({
  changedById: z.string().trim().min(1).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  field: z.string().trim().min(1).optional(),
  requestNo: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type CmpClientVersionListQuery = z.infer<
  typeof CmpClientVersionListQuerySchema
>;

export const CmpClientVersionsResponseSchema = z.object({
  client: CmpClientSchema,
  currentVersion: CmpClientVersionSchema.nullable(),
  versions: z.array(CmpClientVersionSchema),
  total: z.number().int().nonnegative(),
});
export type CmpClientVersionsResponse = z.infer<
  typeof CmpClientVersionsResponseSchema
>;

export const CmpClientVersionDetailSchema = CmpClientVersionSchema.extend({
  snapshot: CmpClientSchema,
});
export type CmpClientVersionDetail = z.infer<
  typeof CmpClientVersionDetailSchema
>;

// CMP engagements
export const CmpEngagementServiceTypeEnum = z.enum([
  "AUDIT",
  "TAX",
  "RISK",
  "ACCOUNTING",
  "COM_SEC",
  "OTHERS",
  "ANNUAL_AUDIT",
  "REVIEW",
  "SPECIAL_AUDIT_PRIVATE_CO",
]);
export type CmpEngagementServiceType = z.infer<
  typeof CmpEngagementServiceTypeEnum
>;

export const CmpEngagementStatusEnum = z.enum([
  "ACTIVE",
  "INACTIVE",
  "COMPLETED",
  "ARCHIVED",
]);
export type CmpEngagementStatus = z.infer<typeof CmpEngagementStatusEnum>;

export const CmpEngagementDeliverableCategoryEnum = z.enum([
  "ANNUAL_AUDIT",
  "OTHERS",
]);
export type CmpEngagementDeliverableCategory = z.infer<
  typeof CmpEngagementDeliverableCategoryEnum
>;

export const CmpEngagementDeliverableCodeEnum = z.enum([
  "AUDITORS_REPORT",
  "CUSTOM",
]);
export type CmpEngagementDeliverableCode = z.infer<
  typeof CmpEngagementDeliverableCodeEnum
>;

export const CmpEngagementDeliverableSchema = z
  .object({
    key: z.string().trim().min(1).max(120),
    category: CmpEngagementDeliverableCategoryEnum,
    code: CmpEngagementDeliverableCodeEnum,
    description: z.string().trim().max(500).optional(),
    sortOrder: z.number().int().min(0).max(999),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.code === "CUSTOM" && !value.description) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "A description is required for this deliverable",
      });
    }
  });
export type CmpEngagementDeliverable = z.infer<
  typeof CmpEngagementDeliverableSchema
>;

export const CmpEngagementDeliverablesSchema = z
  .array(CmpEngagementDeliverableSchema)
  .max(50)
  .superRefine((items, context) => {
    const keys = new Set<string>();
    const fixedCodes = new Set<string>();
    items.forEach((item, index) => {
      if (keys.has(item.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "key"],
          message: "Deliverable keys must be unique",
        });
      }
      keys.add(item.key);
      if (item.code !== "CUSTOM") {
        if (fixedCodes.has(item.code)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "code"],
            message: "A fixed deliverable can only be selected once",
          });
        }
        fixedCodes.add(item.code);
      }
    });
  });

export const CMP_ENGAGEMENT_DELIVERABLE_CATALOG = [
  ["ANNUAL_AUDIT", "AUDITORS_REPORT", "Auditor's report"],
] as const satisfies readonly (readonly [
  CmpEngagementDeliverableCategory,
  Exclude<CmpEngagementDeliverableCode, "CUSTOM">,
  string,
])[];

export const CMP_ENGAGEMENT_DELIVERABLE_LABELS: Record<
  CmpEngagementDeliverableCode,
  { en: string; zh: string }
> = {
  AUDITORS_REPORT: { en: "Auditor's report", zh: "审计师报告" },
  CUSTOM: { en: "Custom deliverable", zh: "自定义交付物" },
};

/** The only service types offered when creating or reselecting an engagement. */
export const CmpSelectableEngagementServiceTypeEnum = z.enum([
  "ANNUAL_AUDIT",
  "REVIEW",
  "SPECIAL_AUDIT_PRIVATE_CO",
  "OTHERS",
]);
export type CmpSelectableEngagementServiceType = z.infer<
  typeof CmpSelectableEngagementServiceTypeEnum
>;

/** Stable values used to classify the AML / terrorist financing risk of an engagement. */
export const CmpAmlRiskClassificationEnum = z.enum(["HIGH", "NOT_HIGH"]);
export type CmpAmlRiskClassification = z.infer<
  typeof CmpAmlRiskClassificationEnum
>;

/** Stable values used to determine the additional engagement reviewers required. */
export const CmpEngagementRiskClassificationEnum = z.enum([
  "NORMAL",
  "GREATER_THAN_NORMAL",
]);
export type CmpEngagementRiskClassification = z.infer<
  typeof CmpEngagementRiskClassificationEnum
>;

/** CMP-only charge-out assumptions for Engagement fee planning. */
export const CmpEngagementFeePlanGradeEnum = z.enum([
  "MANAGING_PARTNER",
  "PARTNER",
  "PRINCIPAL",
  "SENIOR_MANAGER",
  "MANAGER",
  "EQ_REVIEWER",
  "ASSISTANT_MANAGER",
  "SENIOR_ACCOUNTANT_II",
  "SENIOR_ACCOUNTANT_I",
  "STAFF_ACCOUNTANT_II",
  "STAFF_ACCOUNTANT_I",
  "TRAINEE",
  // Kept for records created before the budget-grade revision.
  "SENIOR",
  "STAFF",
  "ASSISTANT",
]);
export type CmpEngagementFeePlanGrade = z.infer<
  typeof CmpEngagementFeePlanGradeEnum
>;

export const CmpBudgetCurrencyEnum = z.enum([
  "HKD",
  "CNY",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "AUD",
  "CAD",
  "MYR",
  "VND",
  "THB",
]);
export type CmpBudgetCurrency = z.infer<typeof CmpBudgetCurrencyEnum>;

export const CMP_BUDGET_CURRENCIES = CmpBudgetCurrencyEnum.options;

export const CMP_BUDGET_CURRENCY_LABELS: Record<
  CmpBudgetCurrency,
  { en: string; zh: string; aliases: readonly string[] }
> = {
  HKD: { en: "Hong Kong dollar", zh: "港币", aliases: ["HK$", "港元"] },
  CNY: { en: "Chinese yuan", zh: "人民币", aliases: ["RMB", "CNH", "元"] },
  USD: { en: "US dollar", zh: "美元", aliases: ["US$"] },
  EUR: { en: "Euro", zh: "欧元", aliases: ["€"] },
  GBP: { en: "Pound sterling", zh: "英镑", aliases: ["£"] },
  JPY: { en: "Japanese yen", zh: "日元", aliases: ["¥", "JPY"] },
  SGD: { en: "Singapore dollar", zh: "新加坡元", aliases: ["S$"] },
  AUD: { en: "Australian dollar", zh: "澳元", aliases: ["A$"] },
  CAD: { en: "Canadian dollar", zh: "加拿大元", aliases: ["C$"] },
  MYR: { en: "Malaysian ringgit", zh: "马来西亚林吉特", aliases: ["RM"] },
  VND: { en: "Vietnamese dong", zh: "越南盾", aliases: ["₫"] },
  THB: { en: "Thai baht", zh: "泰铢", aliases: ["฿"] },
};

/**
 * Legacy budget-planning exchange rates in HKD per currency unit. They are
 * retained only for backwards-compatible local/mock data and historical
 * snapshots; live CMP exchange rates are refreshed through the HKMA provider.
 */
export const CMP_FIXED_BUDGET_EXCHANGE_RATE_SOURCE =
  "SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07";
export const CMP_FIXED_BUDGET_EXCHANGE_RATES = {
  CNY: {
    hkdPerUnit: "1.12268295",
    periodStart: "2025-08-01",
    periodEnd: "2026-07-31",
  },
  USD: {
    hkdPerUnit: "7.81175674",
    periodStart: "2025-08-01",
    periodEnd: "2026-07-31",
  },
  EUR: {
    hkdPerUnit: "8.48000000",
    periodStart: "2026-08-01",
    periodEnd: "2026-12-31",
  },
  GBP: {
    hkdPerUnit: "9.93000000",
    periodStart: "2026-08-01",
    periodEnd: "2026-12-31",
  },
  JPY: {
    hkdPerUnit: "0.05400000",
    periodStart: "2026-08-01",
    periodEnd: "2026-12-31",
  },
  SGD: {
    hkdPerUnit: "5.80000000",
    periodStart: "2026-08-01",
    periodEnd: "2026-12-31",
  },
  AUD: {
    hkdPerUnit: "5.07000000",
    periodStart: "2026-08-01",
    periodEnd: "2026-12-31",
  },
  CAD: {
    hkdPerUnit: "5.67000000",
    periodStart: "2026-08-01",
    periodEnd: "2026-12-31",
  },
  MYR: {
    hkdPerUnit: "1.84000000",
    periodStart: "2026-08-01",
    periodEnd: "2026-12-31",
  },
  VND: {
    hkdPerUnit: "0.00030000",
    periodStart: "2026-08-01",
    periodEnd: "2026-12-31",
  },
  THB: {
    hkdPerUnit: "0.24200000",
    periodStart: "2026-08-01",
    periodEnd: "2026-12-31",
  },
} as const satisfies Record<
  Exclude<CmpBudgetCurrency, "HKD">,
  { hkdPerUnit: string; periodStart: string; periodEnd: string }
>;

export function getCmpFixedBudgetExchangeRate(
  currency: CmpBudgetCurrency
): CmpBudgetExchangeRateSnapshot {
  if (currency === "HKD") {
    return {
      id: "HKD-1",
      currency,
      hkdPerUnit: "1.00000000",
      periodStart: null,
      periodEnd: null,
      fetchedAt: "2026-08-01T00:00:00.000Z",
      source: "SYSTEM",
      stale: false,
    };
  }
  const definition = CMP_FIXED_BUDGET_EXCHANGE_RATES[currency];
  return {
    id: `SYSTEM-FIXED-${currency}-AVERAGE`,
    currency,
    hkdPerUnit: definition.hkdPerUnit,
    periodStart: definition.periodStart,
    periodEnd: definition.periodEnd,
    fetchedAt: "2026-08-01T00:00:00.000Z",
    source: currency === "VND" ? "FALLBACK" : "LEGACY",
    stale: false,
  };
}

export const CmpBudgetExchangeRateSnapshotSchema = z
  .object({
    id: z.string(),
    currency: CmpBudgetCurrencyEnum,
    hkdPerUnit: z.string(),
    periodStart: z.string().nullable(),
    periodEnd: z.string().nullable(),
    fetchedAt: z.string(),
    source: z.enum(["SYSTEM", "FALLBACK", "LEGACY"]).optional(),
    stale: z.boolean(),
  })
  .strict();
export type CmpBudgetExchangeRateSnapshot = z.infer<
  typeof CmpBudgetExchangeRateSnapshotSchema
>;

export const CmpEngagementExchangeRateSourceEnum = z.enum(["SYSTEM", "MANUAL"]);
export type CmpEngagementExchangeRateSource = z.infer<
  typeof CmpEngagementExchangeRateSourceEnum
>;

export const CmpBudgetExchangeRatesResponseSchema = z
  .object({
    rates: z.array(CmpBudgetExchangeRateSnapshotSchema),
  })
  .strict();
export type CmpBudgetExchangeRatesResponse = z.infer<
  typeof CmpBudgetExchangeRatesResponseSchema
>;

export const UpdateCmpBudgetExchangeRateFallbackSchema = z
  .object({
    currency: CmpBudgetCurrencyEnum.exclude(["HKD"]),
    hkdPerUnit: z
      .string()
      .trim()
      .regex(
        /^\d+(?:\.\d{1,8})?$/,
        "Enter an exchange rate with at most 8 decimal places"
      )
      .refine(
        (value) => Number(value) > 0,
        "Exchange rate must be greater than 0"
      ),
  })
  .strict();
export type UpdateCmpBudgetExchangeRateFallbackInput = z.infer<
  typeof UpdateCmpBudgetExchangeRateFallbackSchema
>;

export const CmpExchangeRateProviderSchema = z.union([
  z.enum(["HKMA_DAILY", "LEGACY_FIXED"]),
  z.string().regex(/^MANUAL_FALLBACK_\d+$/, "Unknown exchange-rate provider"),
]);
export type CmpExchangeRateProvider = z.infer<
  typeof CmpExchangeRateProviderSchema
>;

export const CmpExchangeRateBatchSchema = z
  .object({
    id: z.string(),
    baseCurrency: z.literal("HKD"),
    provider: CmpExchangeRateProviderSchema,
    sourceDate: z.string(),
    sourceUrl: z.string(),
    fetchedAt: z.string(),
    refreshedBy: z
      .object({ id: z.string(), name: z.string() })
      .strict()
      .nullable(),
    stale: z.boolean(),
  })
  .strict();
export type CmpExchangeRateBatch = z.infer<typeof CmpExchangeRateBatchSchema>;

export const CmpSettingsExchangeRatesResponseSchema = z
  .object({
    batch: CmpExchangeRateBatchSchema,
    rates: z.array(CmpBudgetExchangeRateSnapshotSchema),
    canRefresh: z.boolean(),
    canMaintainFallback: z.boolean().optional(),
  })
  .strict();
export type CmpSettingsExchangeRatesResponse = z.infer<
  typeof CmpSettingsExchangeRatesResponseSchema
>;

export const CMP_ENGAGEMENT_FEE_PLAN_GRADE_RATES: Record<
  CmpEngagementFeePlanGrade,
  number
> = {
  MANAGING_PARTNER: 4500,
  PARTNER: 4200,
  PRINCIPAL: 3700,
  SENIOR_MANAGER: 3000,
  MANAGER: 2400,
  EQ_REVIEWER: 4200,
  ASSISTANT_MANAGER: 1800,
  SENIOR_ACCOUNTANT_II: 900,
  SENIOR_ACCOUNTANT_I: 500,
  STAFF_ACCOUNTANT_II: 400,
  STAFF_ACCOUNTANT_I: 280,
  TRAINEE: 0,
  // Legacy grades remain readable for existing fee-plan snapshots, but are
  // Not offered when a user adds a new budget line.
  SENIOR: 900,
  STAFF: 600,
  ASSISTANT: 400,
};

export const CMP_ENGAGEMENT_FEE_PLAN_ACTIVE_GRADES = [
  "MANAGING_PARTNER",
  "PARTNER",
  "PRINCIPAL",
  "SENIOR_MANAGER",
  "MANAGER",
  "EQ_REVIEWER",
  "ASSISTANT_MANAGER",
  "SENIOR_ACCOUNTANT_II",
  "SENIOR_ACCOUNTANT_I",
  "STAFF_ACCOUNTANT_II",
  "STAFF_ACCOUNTANT_I",
  "TRAINEE",
] as const satisfies readonly CmpEngagementFeePlanGrade[];

export const CMP_ENGAGEMENT_FEE_PLAN_SENIOR_COST_GRADES = [
  "MANAGING_PARTNER",
  "PARTNER",
  "PRINCIPAL",
  "SENIOR_MANAGER",
  "MANAGER",
  "EQ_REVIEWER",
  "ASSISTANT_MANAGER",
] as const satisfies readonly CmpEngagementFeePlanGrade[];

export type CmpEngagementBudgetValidationResult = {
  privateCostRule: {
    applicable: boolean;
    totalCostHkd: number;
    seniorCostRatio: number | null;
    passed: boolean;
  };
};

export function validateCmpEngagementBudget(input: {
  isPrivateClient: boolean;
  hkdPerUnit: number;
  lines: readonly {
    grade?: CmpEngagementFeePlanGrade | "";
    hourlyRate: number;
    budgetHours: number;
  }[];
}): CmpEngagementBudgetValidationResult {
  const hkdPerUnit = Number.isFinite(input.hkdPerUnit) ? input.hkdPerUnit : 0;
  const totals = input.lines.reduce(
    (summary, line) => {
      const amount =
        Math.max(0, line.hourlyRate) * Math.max(0, line.budgetHours);
      return {
        total: summary.total + amount,
        senior:
          summary.senior +
          (line.grade &&
          (
            CMP_ENGAGEMENT_FEE_PLAN_SENIOR_COST_GRADES as readonly CmpEngagementFeePlanGrade[]
          ).includes(line.grade)
            ? amount
            : 0),
      };
    },
    { total: 0, senior: 0 }
  );
  const totalCostHkd = totals.total * hkdPerUnit;
  const applicable = input.isPrivateClient && totalCostHkd > 10_000;
  const seniorCostRatio =
    totals.total > 0 ? totals.senior / totals.total : null;
  return {
    privateCostRule: {
      applicable,
      totalCostHkd,
      seniorCostRatio,
      passed:
        !applicable || (seniorCostRatio !== null && seniorCostRatio >= 0.3),
    },
  };
}

export const CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS: Record<
  CmpEngagementFeePlanGrade,
  { en: string; zh: string }
> = {
  MANAGING_PARTNER: { en: "Managing Partner", zh: "管理合伙人" },
  PARTNER: { en: "Partner", zh: "合伙人" },
  PRINCIPAL: { en: "Principal", zh: "总监" },
  SENIOR_MANAGER: { en: "Sr. Manager", zh: "高级经理" },
  MANAGER: { en: "Manager", zh: "经理" },
  EQ_REVIEWER: { en: "EQ Reviewer", zh: "质量复核人" },
  ASSISTANT_MANAGER: { en: "Assistant Manager", zh: "助理经理" },
  SENIOR_ACCOUNTANT_II: { en: "Senior Accountant II", zh: "高级会计师 II" },
  SENIOR_ACCOUNTANT_I: { en: "Senior Accountant I", zh: "高级会计师 I" },
  STAFF_ACCOUNTANT_II: { en: "Staff Accountant II", zh: "会计师 II" },
  STAFF_ACCOUNTANT_I: { en: "Staff Accountant I", zh: "会计师 I" },
  TRAINEE: { en: "Trainee", zh: "实习生" },
  SENIOR: { en: "Senior (legacy)", zh: "高级审计员（旧）" },
  STAFF: { en: "Staff (legacy)", zh: "审计员（旧）" },
  ASSISTANT: { en: "Assistant (legacy)", zh: "助理（旧）" },
};

function cmpNonNegativeDecimal(integerDigits: number) {
  return z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,2})?$`),
      `Enter a non-negative value with at most ${integerDigits} integer digits and 2 decimal places`
    );
}
const CmpRequiredHours = cmpNonNegativeDecimal(10).refine(
  (value) => Number(value) > 0,
  "Budgeted hours must be greater than 0"
);
const CmpRequiredMoney = cmpNonNegativeDecimal(16);
const CmpFeePlanHourlyRate = cmpNonNegativeDecimal(16);
export const CmpEngagementFeePlanAssignmentTypeEnum = z.enum(["STAFF", "TBC"]);
export type CmpEngagementFeePlanAssignmentType = z.infer<
  typeof CmpEngagementFeePlanAssignmentTypeEnum
>;

export const CmpEngagementFeePlanLineInputSchema = z
  .object({
    key: z.string().trim().min(1).max(120),
    grade: CmpEngagementFeePlanGradeEnum,
    assignmentType: CmpEngagementFeePlanAssignmentTypeEnum,
    staffUserId: z.string().trim().min(1).nullable().optional(),
    hourlyRate: CmpFeePlanHourlyRate,
    budgetHours: CmpRequiredHours,
    dateFrom: CmpOptionalDate,
    dateTo: CmpOptionalDate,
    sortOrder: z.number().int().min(0).max(999),
  })
  .superRefine((value, context) => {
    if (value.assignmentType === "STAFF" && !value.staffUserId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["staffUserId"],
        message: "Select a staff member for this budget line",
      });
    }
    if (value.assignmentType === "TBC" && value.staffUserId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["staffUserId"],
        message: "TBC budget lines cannot retain a staff member",
      });
    }
    if (Boolean(value.dateFrom) !== Boolean(value.dateTo)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [value.dateFrom ? "dateTo" : "dateFrom"],
        message: "Date From and Date To must be completed together",
      });
    }
    if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "Date To must be on or after Date From",
      });
    }
  })
  .strict();
export type CmpEngagementFeePlanLineInput = z.infer<
  typeof CmpEngagementFeePlanLineInputSchema
>;

function normalizeLegacyCmpEngagementFeePlanLines(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.flatMap((candidate, sourceIndex) => {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      return [candidate];
    }
    const line = candidate as Record<string, unknown>;
    if (line.assignmentType === "STAFF" || line.assignmentType === "TBC") {
      return [candidate];
    }

    const staffUserIds = Array.isArray(line.staffUserIds)
      ? line.staffUserIds.filter(
          (staffUserId): staffUserId is string =>
            typeof staffUserId === "string" && staffUserId.trim().length > 0
        )
      : [];
    const quantity = Number.isInteger(Number(line.quantity))
      ? Math.max(0, Number(line.quantity))
      : staffUserIds.length;
    const explicitTbc = Number.isInteger(Number(line.tbcQuantity))
      ? Math.max(0, Number(line.tbcQuantity))
      : 0;
    const missingAssignments = Math.max(
      0,
      quantity - staffUserIds.length - explicitTbc
    );
    const tbcCount = explicitTbc + missingAssignments;
    const normalHours = Number(line.hoursPerPerson ?? 0);
    const otHours = Number(line.otHoursPerPerson ?? 0);
    const budgetHours = (
      (Number.isFinite(normalHours) ? normalHours : 0) +
      (Number.isFinite(otHours) ? otHours : 0)
    ).toFixed(2);
    const baseKey =
      typeof line.key === "string" && line.key.trim()
        ? line.key.trim()
        : `legacy-fee-line-${sourceIndex}`;
    const baseSortOrder = Number.isInteger(Number(line.sortOrder))
      ? Math.max(0, Number(line.sortOrder))
      : sourceIndex;
    const common = {
      grade: line.grade,
      hourlyRate: line.hourlyRate,
      budgetHours,
      dateFrom: line.dateFrom,
      dateTo: line.dateTo,
    };

    return [
      ...staffUserIds.map((staffUserId, assignmentIndex) => ({
        ...common,
        key: `${baseKey}::staff::${assignmentIndex}`,
        assignmentType: "STAFF",
        staffUserId,
        sortOrder: baseSortOrder * 100 + assignmentIndex,
      })),
      ...Array.from({ length: tbcCount }, (_, tbcIndex) => ({
        ...common,
        key: `${baseKey}::tbc::${tbcIndex}`,
        assignmentType: "TBC",
        staffUserId: null,
        sortOrder: baseSortOrder * 100 + staffUserIds.length + tbcIndex,
      })),
    ];
  });
}

export const CmpEngagementFeePlanLinesInputSchema = z.preprocess(
  normalizeLegacyCmpEngagementFeePlanLines,
  z.array(CmpEngagementFeePlanLineInputSchema).max(50)
);

export const CmpAcceptanceEngagementFeePlanLineDraftSchema = z
  .object({
    key: z.string().trim().min(1).max(120),
    grade: CmpEngagementFeePlanGradeEnum.optional(),
    assignmentType: CmpEngagementFeePlanAssignmentTypeEnum.optional(),
    staffUserId: z.string().trim().min(1).nullable().optional(),
    hourlyRate: z.string().trim().optional(),
    budgetHours: z.string().trim().optional(),
    dateFrom: CmpOptionalDate,
    dateTo: CmpOptionalDate,
    sortOrder: z.number().int().min(0).max(999),
  })
  .strict();
export type CmpAcceptanceEngagementFeePlanLineDraft = z.infer<
  typeof CmpAcceptanceEngagementFeePlanLineDraftSchema
>;

export const CmpEngagementFeePlanLineSchema = z
  .object({
    id: z.string(),
    grade: CmpEngagementFeePlanGradeEnum,
    assignmentType: CmpEngagementFeePlanAssignmentTypeEnum,
    staff: z
      .object({ id: z.string(), name: z.string(), email: z.string() })
      .strict()
      .nullable(),
    hourlyRate: z.string(),
    budgetHours: z.string(),
    dateFrom: z.string().nullable().optional(),
    dateTo: z.string().nullable().optional(),
    lineTotal: z.string(),
    sortOrder: z.number().int().min(0).max(999),
  })
  .strict();
export type CmpEngagementFeePlanLine = z.infer<
  typeof CmpEngagementFeePlanLineSchema
>;

const CmpFeeNoteAmount = z.union([CmpRequiredMoney, z.literal("")]);
const CmpRequiredFeeNoteDate = z
  .string()
  .trim()
  .refine(isValidIsoDate, "Expected a real calendar date in YYYY-MM-DD format");

export const CmpEngagementFeeNoteCollectionStatusEnum = z.enum([
  "UNISSUED",
  "UNRECORDED",
  "OUTSTANDING",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
]);
export type CmpEngagementFeeNoteCollectionStatus = z.infer<
  typeof CmpEngagementFeeNoteCollectionStatusEnum
>;

export const CmpFeeNoteLocaleSchema = z.enum(["zh-CN", "en-US"]);
export type CmpFeeNoteLocale = z.infer<typeof CmpFeeNoteLocaleSchema>;

export const CmpFeeNoteLocalizedContentSchema = z
  .object({
    recipientName: z.string().trim().max(500),
    recipientAttention: z.string().trim().max(200),
    recipientSalutation: z.string().trim().max(500),
    recipientAddress: z.string().trim().max(2000),
    serviceDescription: z.string().trim().max(4000),
    lineItemDescriptions: z.record(
      z.string().trim().min(1).max(100),
      z.string().trim().max(500)
    ),
    signatoryName: z.string().trim().max(200),
    bankPayeeName: z.string().trim().max(300),
    bankName: z.string().trim().max(300),
    firmLegalName: z.string().trim().max(300),
    firmAddress: z.string().trim().max(2000),
  })
  .strict();
export type CmpFeeNoteLocalizedContent = z.infer<
  typeof CmpFeeNoteLocalizedContentSchema
>;

export const CmpFeeNoteLocalizedContentsSchema = z
  .object({
    "zh-CN": CmpFeeNoteLocalizedContentSchema,
    "en-US": CmpFeeNoteLocalizedContentSchema,
  })
  .strict();
export type CmpFeeNoteLocalizedContents = z.infer<
  typeof CmpFeeNoteLocalizedContentsSchema
>;

export const CmpEngagementFeeNoteLineItemSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    description: CmpOptionalText(500),
    amount: CmpFeeNoteAmount,
  })
  .strict();
export type CmpEngagementFeeNoteLineItem = z.infer<
  typeof CmpEngagementFeeNoteLineItemSchema
>;

export const CmpEngagementFeeNoteLineItemsSchema = z
  .array(CmpEngagementFeeNoteLineItemSchema)
  .max(50);

export const CmpEngagementFeeNoteUpdateSchema = z
  .object({
    periodNumber: z.number().int().min(1).max(999).optional(),
    plannedIssueDate: CmpOptionalDate,
    plannedAmount: CmpFeeNoteAmount.optional(),
    receivedAmount: CmpFeeNoteAmount.optional(),
    receivedDate: CmpOptionalDate,
    feeNoteNumber: CmpOptionalText(80),
    engagementReference: CmpOptionalText(200),
    issueDate: CmpOptionalDate,
    recipientName: CmpOptionalText(500),
    recipientAttention: CmpOptionalText(200),
    recipientSalutation: CmpOptionalText(500),
    recipientAddress: CmpOptionalText(2000),
    currency: CmpBudgetCurrencyEnum.optional(),
    serviceDescription: CmpOptionalText(4000),
    lineItems: CmpEngagementFeeNoteLineItemsSchema.optional(),
    amount: CmpFeeNoteAmount.optional(),
    disbursementAmount: CmpFeeNoteAmount.optional(),
    totalAmount: CmpFeeNoteAmount.optional(),
    issuerReference: CmpOptionalText(120),
    signatoryName: CmpOptionalText(200),
    bankPayeeName: CmpOptionalText(300),
    bankPayeeNameZh: CmpOptionalText(300),
    bankName: CmpOptionalText(300),
    hkdAccountNumber: CmpOptionalText(120),
    cnyAccountNumber: CmpOptionalText(120),
    usdAccountNumber: CmpOptionalText(120),
    swiftCode: CmpOptionalText(120),
    hkdSwiftCode: CmpOptionalText(120),
    cnySwiftCode: CmpOptionalText(120),
    usdSwiftCode: CmpOptionalText(120),
    firmLegalName: CmpOptionalText(300),
    firmAddress: CmpOptionalText(2000),
    firmPhone: CmpOptionalText(120),
    firmFax: CmpOptionalText(120),
    firmEmail: CmpOptionalText(320),
    firmWebsite: CmpOptionalText(320),
    localizedContent: CmpFeeNoteLocalizedContentsSchema.optional(),
  })
  .strict();
export type CmpEngagementFeeNoteUpdateInput = z.infer<
  typeof CmpEngagementFeeNoteUpdateSchema
>;

export const CreateCmpEngagementFeeNoteSchema =
  CmpEngagementFeeNoteUpdateSchema.extend({
    periodNumber: z.number().int().min(1).max(999),
    plannedIssueDate: CmpRequiredFeeNoteDate,
    plannedAmount: CmpRequiredMoney,
  }).strict();
export type CreateCmpEngagementFeeNoteInput = z.infer<
  typeof CreateCmpEngagementFeeNoteSchema
>;

export const CmpEngagementFeeNoteSchema = z
  .object({
    id: z.string().nullable(),
    engagementId: z.string(),
    periodNumber: z.number().int().min(1),
    plannedIssueDate: z.string(),
    plannedAmount: z.string(),
    receivedAmount: z.string(),
    receivedDate: z.string(),
    collectionStatus: CmpEngagementFeeNoteCollectionStatusEnum,
    outstandingAmount: z.string(),
    feeNoteNumber: z.string(),
    engagementReference: z.string(),
    issueDate: z.string(),
    recipientName: z.string(),
    recipientAttention: z.string(),
    recipientSalutation: z.string(),
    recipientAddress: z.string(),
    currency: CmpBudgetCurrencyEnum,
    serviceDescription: z.string(),
    lineItems: CmpEngagementFeeNoteLineItemsSchema,
    amount: z.string(),
    disbursementAmount: z.string(),
    totalAmount: z.string(),
    issuerReference: z.string(),
    signatoryName: z.string(),
    bankPayeeName: z.string(),
    bankPayeeNameZh: z.string(),
    bankName: z.string(),
    hkdAccountNumber: z.string(),
    cnyAccountNumber: z.string(),
    usdAccountNumber: z.string(),
    swiftCode: z.string(),
    hkdSwiftCode: z.string(),
    cnySwiftCode: z.string(),
    usdSwiftCode: z.string(),
    firmLegalName: z.string(),
    firmAddress: z.string(),
    firmPhone: z.string(),
    firmFax: z.string(),
    firmEmail: z.string(),
    firmWebsite: z.string(),
    localizedContent: CmpFeeNoteLocalizedContentsSchema,
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  })
  .strict();
export type CmpEngagementFeeNote = z.infer<typeof CmpEngagementFeeNoteSchema>;

export const CmpEngagementFeeNoteResponseSchema = z
  .object({
    note: CmpEngagementFeeNoteSchema,
    defaults: CmpEngagementFeeNoteSchema,
  })
  .strict();
export type CmpEngagementFeeNoteResponse = z.infer<
  typeof CmpEngagementFeeNoteResponseSchema
>;

export const CmpEngagementFeeNotesResponseSchema = z
  .object({
    notes: z.array(CmpEngagementFeeNoteSchema),
    updatedAt: z.string(),
  })
  .strict();
export type CmpEngagementFeeNotesResponse = z.infer<
  typeof CmpEngagementFeeNotesResponseSchema
>;

export const CmpEngagementFeeNoteExportQuerySchema = z
  .object({ locale: CmpFeeNoteLocaleSchema })
  .strict();
export type CmpEngagementFeeNoteExportQuery = z.infer<
  typeof CmpEngagementFeeNoteExportQuerySchema
>;

export const CmpBillingStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "SENT",
  "CLIENT_PAID",
  "RECONCILED",
]);
export type CmpBillingStatus = z.infer<typeof CmpBillingStatusSchema>;

export const CmpBillingArtifactTypeSchema = z.enum([
  "INVOICE",
  "CLIENT_PAYMENT_EVIDENCE",
  "FINANCE_RECEIPT",
]);
export type CmpBillingArtifactType = z.infer<
  typeof CmpBillingArtifactTypeSchema
>;

export const CmpBillingLineItemInputSchema = z
  .object({
    id: z.string().trim().min(1).max(100).optional(),
    descriptionZh: z.string().trim().max(500).default(""),
    descriptionEn: z.string().trim().max(500).default(""),
    amount: CmpRequiredMoney,
    sortOrder: z.number().int().min(0).max(999).optional(),
  })
  .strict();
export type CmpBillingLineItemInput = z.infer<
  typeof CmpBillingLineItemInputSchema
>;

export const CmpBillingLineItemsInputSchema = z
  .array(CmpBillingLineItemInputSchema)
  .min(1, "At least one billing line item is required")
  .max(50);
export type CmpBillingLineItemsInput = z.infer<
  typeof CmpBillingLineItemsInputSchema
>;

const CmpBillingRequiredDate = z
  .string()
  .trim()
  .refine(
    (value) => isValidIsoDate(value),
    "Expected a real calendar date in YYYY-MM-DD format"
  );

const CmpBillingDraftFields = z.object({
  issueDate: CmpOptionalDate,
  currency: CmpBudgetCurrencyEnum.optional(),
  lineItems: CmpBillingLineItemsInputSchema.optional(),
  clientSnapshot: z.record(z.string(), z.unknown()).optional(),
  firmSnapshot: z.record(z.string(), z.unknown()).optional(),
  localizedContent: CmpFeeNoteLocalizedContentsSchema.optional(),
});

export const CmpBillingImportSourceSchema = z.enum([
  "CMP",
  "FIRM_TEMPLATE",
  "BANK_TEMPLATE",
]);
export type CmpBillingImportSource = z.infer<
  typeof CmpBillingImportSourceSchema
>;

export const CmpBillingImportAuditSchema = z
  .object({
    sources: z.array(CmpBillingImportSourceSchema).min(1).max(3),
    fieldKeys: z.array(z.string().trim().min(1).max(80)).min(1).max(60),
    firmTemplateId: z.string().trim().min(1).max(100).optional(),
    bankTemplateId: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export type CmpBillingImportAudit = z.infer<typeof CmpBillingImportAuditSchema>;

export const CreateCmpBillingSchema = CmpBillingDraftFields.extend({
  engagementId: z.string().trim().min(1),
}).strict();
export type CreateCmpBillingInput = z.infer<typeof CreateCmpBillingSchema>;

export const UpdateCmpBillingSchema = CmpBillingDraftFields.extend({
  expectedVersion: z.number().int().min(1),
  importAudit: CmpBillingImportAuditSchema.optional(),
}).strict();
export type UpdateCmpBillingInput = z.infer<typeof UpdateCmpBillingSchema>;

export const CmpBillingExpectedVersionSchema = z
  .object({ expectedVersion: z.number().int().min(1) })
  .strict();
export type CmpBillingExpectedVersion = z.infer<
  typeof CmpBillingExpectedVersionSchema
>;

export const CmpBillingReturnSchema = CmpBillingExpectedVersionSchema.extend({
  reason: z.string().trim().min(1).max(2000),
}).strict();
export type CmpBillingReturnInput = z.infer<typeof CmpBillingReturnSchema>;

export const CmpBillingMarkSentSchema = CmpBillingExpectedVersionSchema.extend({
  method: z.string().trim().min(1).max(120),
  note: z.string().trim().max(2000).optional(),
}).strict();
export type CmpBillingMarkSentInput = z.infer<typeof CmpBillingMarkSentSchema>;

export const CmpBillingClientPaymentClaimSchema =
  CmpBillingExpectedVersionSchema.extend({
    amount: CmpRequiredMoney,
    currency: CmpBudgetCurrencyEnum,
    paidAt: CmpBillingRequiredDate,
    reference: z.string().trim().min(1).max(200),
    note: z.string().trim().max(2000).optional(),
  }).strict();
export type CmpBillingClientPaymentClaimInput = z.infer<
  typeof CmpBillingClientPaymentClaimSchema
>;

export const CmpBillingFinanceReceiptSchema =
  CmpBillingExpectedVersionSchema.extend({
    receiptDate: CmpBillingRequiredDate,
    bankReference: z.string().trim().min(1).max(200),
    amount: CmpRequiredMoney,
    currency: CmpBudgetCurrencyEnum,
    exchangeRateToBill: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,8})?$/)
      .optional(),
    internalNote: z.string().trim().max(2000).optional(),
  }).strict();
export type CmpBillingFinanceReceiptInput = z.infer<
  typeof CmpBillingFinanceReceiptSchema
>;

export const CmpBillingFinanceReceiptRateOriginSchema = z.enum([
  "UNIFIED_BATCH",
  "LEGACY_MANUAL",
]);
export type CmpBillingFinanceReceiptRateOrigin = z.infer<
  typeof CmpBillingFinanceReceiptRateOriginSchema
>;

export const CmpBillingReconcileSchema = CmpBillingExpectedVersionSchema.extend(
  {
    overrideReason: z.string().trim().min(1).max(2000).optional(),
  }
).strict();
export type CmpBillingReconcileInput = z.infer<
  typeof CmpBillingReconcileSchema
>;

export const CmpBillingInvoiceInputSchema =
  CmpBillingExpectedVersionSchema.extend({
    locale: CmpFeeNoteLocaleSchema,
    format: z.enum(["pdf", "docx"]).default("pdf"),
  }).strict();
export type CmpBillingInvoiceInput = z.input<
  typeof CmpBillingInvoiceInputSchema
>;

export const CmpBillingDefaultsResponseSchema = z
  .object({
    clientSnapshot: z.record(z.string(), z.unknown()),
    firmSnapshot: z.record(z.string(), z.unknown()),
    localizedContent: CmpFeeNoteLocalizedContentsSchema,
  })
  .strict();
export type CmpBillingDefaultsResponse = z.infer<
  typeof CmpBillingDefaultsResponseSchema
>;

export const CmpBillingTemplateStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type CmpBillingTemplateStatus = z.infer<
  typeof CmpBillingTemplateStatusSchema
>;

const CmpBillingTemplateText = z.string().trim().max(1000).default("");
const CmpBillingTemplateName = z
  .string()
  .trim()
  .min(1, "Template name is required")
  .max(120);

const CmpBillingFirmTemplateFieldsSchema = z.object({
  name: CmpBillingTemplateName,
  firmLegalNameZh: CmpBillingTemplateText,
  firmLegalNameEn: CmpBillingTemplateText,
  firmAddressZh: CmpBillingTemplateText,
  firmAddressEn: CmpBillingTemplateText,
  phone: CmpBillingTemplateText,
  email: CmpBillingTemplateText,
  website: CmpBillingTemplateText,
});

const CmpBillingBankTemplateFieldsSchema = z.object({
  name: CmpBillingTemplateName,
  bankPayeeNameZh: CmpBillingTemplateText,
  bankPayeeNameEn: CmpBillingTemplateText,
  bankNameZh: CmpBillingTemplateText,
  bankNameEn: CmpBillingTemplateText,
  hkdAccountNumber: CmpBillingTemplateText,
  hkdSwiftCode: CmpBillingTemplateText,
  cnyAccountNumber: CmpBillingTemplateText,
  cnySwiftCode: CmpBillingTemplateText,
  usdAccountNumber: CmpBillingTemplateText,
  usdSwiftCode: CmpBillingTemplateText,
});

export const CmpBillingFirmTemplateSchema =
  CmpBillingFirmTemplateFieldsSchema.extend({
    id: z.string(),
    version: z.number().int().min(1),
    status: CmpBillingTemplateStatusSchema,
    isDefault: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }).strict();
export type CmpBillingFirmTemplate = z.infer<
  typeof CmpBillingFirmTemplateSchema
>;

export const CmpBillingBankTemplateSchema =
  CmpBillingBankTemplateFieldsSchema.extend({
    id: z.string(),
    version: z.number().int().min(1),
    status: CmpBillingTemplateStatusSchema,
    isDefault: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }).strict();
export type CmpBillingBankTemplate = z.infer<
  typeof CmpBillingBankTemplateSchema
>;

export const CreateCmpBillingFirmTemplateSchema =
  CmpBillingFirmTemplateFieldsSchema.extend({
    isDefault: z.boolean().optional(),
  }).strict();
export type CreateCmpBillingFirmTemplateInput = z.infer<
  typeof CreateCmpBillingFirmTemplateSchema
>;

export const CreateCmpBillingBankTemplateSchema =
  CmpBillingBankTemplateFieldsSchema.extend({
    isDefault: z.boolean().optional(),
  }).strict();
export type CreateCmpBillingBankTemplateInput = z.infer<
  typeof CreateCmpBillingBankTemplateSchema
>;

const CmpBillingFirmTemplateUpdateFieldsSchema = z.object({
  name: CmpBillingTemplateName.optional(),
  firmLegalNameZh: z.string().trim().max(1000).optional(),
  firmLegalNameEn: z.string().trim().max(1000).optional(),
  firmAddressZh: z.string().trim().max(1000).optional(),
  firmAddressEn: z.string().trim().max(1000).optional(),
  phone: z.string().trim().max(1000).optional(),
  email: z.string().trim().max(1000).optional(),
  website: z.string().trim().max(1000).optional(),
});

const CmpBillingBankTemplateUpdateFieldsSchema = z.object({
  name: CmpBillingTemplateName.optional(),
  bankPayeeNameZh: z.string().trim().max(1000).optional(),
  bankPayeeNameEn: z.string().trim().max(1000).optional(),
  bankNameZh: z.string().trim().max(1000).optional(),
  bankNameEn: z.string().trim().max(1000).optional(),
  hkdAccountNumber: z.string().trim().max(1000).optional(),
  hkdSwiftCode: z.string().trim().max(1000).optional(),
  cnyAccountNumber: z.string().trim().max(1000).optional(),
  cnySwiftCode: z.string().trim().max(1000).optional(),
  usdAccountNumber: z.string().trim().max(1000).optional(),
  usdSwiftCode: z.string().trim().max(1000).optional(),
});

export const UpdateCmpBillingFirmTemplateSchema =
  CmpBillingFirmTemplateUpdateFieldsSchema.extend({
    expectedVersion: z.number().int().min(1),
    isDefault: z.boolean().optional(),
  })
    .strict()
    .refine(
      (value) => Object.keys(value).some((key) => key !== "expectedVersion"),
      "At least one template field is required"
    );
export type UpdateCmpBillingFirmTemplateInput = z.infer<
  typeof UpdateCmpBillingFirmTemplateSchema
>;

export const UpdateCmpBillingBankTemplateSchema =
  CmpBillingBankTemplateUpdateFieldsSchema.extend({
    expectedVersion: z.number().int().min(1),
    isDefault: z.boolean().optional(),
  })
    .strict()
    .refine(
      (value) => Object.keys(value).some((key) => key !== "expectedVersion"),
      "At least one template field is required"
    );
export type UpdateCmpBillingBankTemplateInput = z.infer<
  typeof UpdateCmpBillingBankTemplateSchema
>;

export const CmpBillingTemplateVersionSchema = z
  .object({ expectedVersion: z.number().int().min(1) })
  .strict();
export type CmpBillingTemplateVersionInput = z.infer<
  typeof CmpBillingTemplateVersionSchema
>;

export const CmpBillingTemplateListResponseSchema = z
  .object({
    canManage: z.boolean(),
    firmTemplates: z.array(CmpBillingFirmTemplateSchema),
    bankTemplates: z.array(CmpBillingBankTemplateSchema),
  })
  .strict();
export type CmpBillingTemplateListResponse = z.infer<
  typeof CmpBillingTemplateListResponseSchema
>;

export const CmpBillingImportFieldSchema = z
  .object({
    key: z.string(),
    section: z.enum(["CLIENT", "RECIPIENT", "ENGAGEMENT"]),
    source: z.string(),
    editable: z.boolean(),
    value: z.object({ zh: z.string(), en: z.string() }).strict(),
  })
  .strict();
export type CmpBillingImportField = z.infer<typeof CmpBillingImportFieldSchema>;

export const CmpBillingImportOptionsResponseSchema = z
  .object({
    defaults: CmpBillingDefaultsResponseSchema,
    cmpFields: z.array(CmpBillingImportFieldSchema),
    firmTemplates: z.array(CmpBillingFirmTemplateSchema),
    bankTemplates: z.array(CmpBillingBankTemplateSchema),
    canManageTemplates: z.boolean(),
  })
  .strict();
export type CmpBillingImportOptionsResponse = z.infer<
  typeof CmpBillingImportOptionsResponseSchema
>;

export const CmpBillingArtifactSchema = z
  .object({
    id: z.string(),
    type: CmpBillingArtifactTypeSchema,
    locale: CmpFeeNoteLocaleSchema.nullable(),
    version: z.number().int().nullable(),
    fileName: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int(),
    sha256: z.string(),
    financeReceiptId: z.string().nullable(),
    createdAt: z.string(),
    retentionUntil: z.string(),
    uploadedBy: z.object({ id: z.string(), name: z.string() }).strict(),
  })
  .strict();
export type CmpBillingArtifact = z.infer<typeof CmpBillingArtifactSchema>;

export const CmpBillingSchema = z
  .object({
    id: z.string(),
    engagementId: z.string(),
    engagementCode: z.string(),
    clientName: z.string(),
    billNumber: z.string(),
    legacyFeeNoteNumber: z.string().nullable(),
    status: CmpBillingStatusSchema,
    version: z.number().int(),
    issueDate: z.string(),
    currency: CmpBudgetCurrencyEnum,
    lineItems: z.array(
      z
        .object({
          id: z.string(),
          descriptionZh: z.string(),
          descriptionEn: z.string(),
          amount: z.string(),
          sortOrder: z.number().int(),
        })
        .strict()
    ),
    subtotalAmount: z.string(),
    totalAmount: z.string(),
    clientSnapshot: z.record(z.string(), z.unknown()),
    firmSnapshot: z.record(z.string(), z.unknown()),
    localizedContent: CmpFeeNoteLocalizedContentsSchema,
    clientClaim: z
      .object({
        amount: z.string(),
        currency: CmpBudgetCurrencyEnum,
        paidAt: z.string(),
        reference: z.string(),
        note: z.string(),
      })
      .nullable(),
    receiptTotalInBillCurrency: z.string(),
    remainingAmount: z.string(),
    sentAt: z.string().nullable(),
    returnReason: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    artifacts: z.array(CmpBillingArtifactSchema),
    financeReceipts: z.array(
      z
        .object({
          id: z.string(),
          receiptDate: z.string(),
          bankReference: z.string(),
          receiptAmount: z.string(),
          receiptCurrency: CmpBudgetCurrencyEnum,
          exchangeRateToBill: z.string(),
          exchangeRateBatchId: z.string().nullable(),
          exchangeRateSourceDate: z.string().nullable(),
          exchangeRateProvider: CmpExchangeRateProviderSchema.nullable(),
          exchangeRateOrigin: CmpBillingFinanceReceiptRateOriginSchema,
          billCurrencyAmount: z.string(),
          internalNote: z.string().nullable(),
          createdAt: z.string(),
        })
        .strict()
    ),
    capabilities: z
      .object({
        canEdit: z.boolean(),
        canDelete: z.boolean(),
        canSubmit: z.boolean(),
        canApprove: z.boolean(),
        canReturn: z.boolean(),
        canMarkSent: z.boolean(),
        canClaimClientPayment: z.boolean(),
        canAddFinanceReceipt: z.boolean(),
        canReconcile: z.boolean(),
        canGenerateInvoice: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type CmpBilling = z.infer<typeof CmpBillingSchema>;

export const CmpBillingListQuerySchema = z
  .object({
    queue: z.enum(["ALL", "PENDING_RECONCILIATION", "RECONCILED"]).optional(),
    engagementId: z.string().trim().min(1).optional(),
    query: z.string().trim().max(200).optional(),
  })
  .strict();
export type CmpBillingListQuery = z.infer<typeof CmpBillingListQuerySchema>;

export const CmpBillingRevenueSummarySchema = z
  .object({
    currency: CmpBudgetCurrencyEnum,
    approvedInvoiced: z.string(),
    clientClaimed: z.string(),
    actualReceived: z.string(),
    reconciledRevenue: z.string(),
    outstanding: z.string(),
  })
  .strict();
export type CmpBillingRevenueSummary = z.infer<
  typeof CmpBillingRevenueSummarySchema
>;

export const CmpBillingCollectionOverviewSchema = z
  .object({
    scope: z.enum(["ALL", "ENGAGEMENT"]),
    currency: CmpBudgetCurrencyEnum,
    agreedFee: z.string(),
    actualReceived: z.string(),
    outstanding: z.string(),
    receivedRate: z.string().nullable(),
    overReceived: z.string(),
    engagement: z
      .object({
        id: z.string(),
        engagementCode: z.string(),
        clientCode: z.string(),
        clientName: z.string(),
        serviceType: CmpEngagementServiceTypeEnum,
        status: CmpEngagementStatusEnum,
      })
      .strict()
      .nullable(),
  })
  .strict();
export type CmpBillingCollectionOverview = z.infer<
  typeof CmpBillingCollectionOverviewSchema
>;

export const CmpBillingListResponseSchema = z
  .object({
    billings: z.array(CmpBillingSchema),
    revenue: z.array(CmpBillingRevenueSummarySchema),
    collectionOverview: CmpBillingCollectionOverviewSchema,
  })
  .strict();
export type CmpBillingListResponse = z.infer<
  typeof CmpBillingListResponseSchema
>;

const CmpOptionalPercentage = z
  .union([
    z
      .string()
      .trim()
      .regex(
        /^\d{1,3}(?:\.\d{1,2})?$/,
        "Enter a percentage with at most 2 decimal places"
      ),
    z.literal(""),
  ])
  .optional();
const CmpEngagementFields = z.object({
  clientId: z.string().trim().min(1, "Client is required"),
  engagementCode: z.string().trim().min(1).max(80),
  serviceType: CmpEngagementServiceTypeEnum,
  otherServiceDescription: CmpOptionalText(1000),
  deliverables: CmpEngagementDeliverablesSchema.optional(),
  yearEndDate: CmpOptionalDate,
  reportDate: CmpOptionalDate,
  approvalReferenceNumber: CmpOptionalText(100),
  engagementDate: CmpOptionalDate,
  budgetedHours: CmpRequiredHours,
  agreedFee: CmpRequiredMoney,
  recoveryRate: CmpOptionalPercentage,
  feePlanningLines: CmpEngagementFeePlanLinesInputSchema.optional(),
  feeCurrency: CmpBudgetCurrencyEnum.default("HKD"),
  feeExchangeRateSnapshotId: CmpOptionalText(120),
  feeExchangeRateHkdPerUnit: z
    .union([
      z
        .string()
        .trim()
        .regex(
          /^\d+(?:\.\d{1,8})?$/,
          "Enter an exchange rate with at most 8 decimal places"
        )
        .refine(
          (value) => Number(value) > 0,
          "Exchange rate must be greater than 0"
        ),
      z.literal(""),
    ])
    .optional(),
  // Optional during the transition from the legacy snapshot-only payload.  New
  // clients send the value explicitly; server-side materialisation treats an
  // omitted value as SYSTEM.
  feeExchangeRateSource: CmpEngagementExchangeRateSourceEnum.optional(),
  amlRiskClassification: CmpAmlRiskClassificationEnum.default("NOT_HIGH"),
  engagementRiskClassification:
    CmpEngagementRiskClassificationEnum.default("NORMAL"),
  picUserId: z.string().trim().min(1, "PIC is required"),
  micUserId: z.string().trim().min(1, "MIC is required"),
  eqReviewerUserId: z.string().trim().min(1).optional(),
  pic: CmpOptionalText(200),
  mic: CmpOptionalText(200),
  eqReviewer: CmpOptionalText(200),
  status: CmpEngagementStatusEnum.optional(),
  remarks: CmpOptionalText(2000),
});

function validateEngagementResponsibleUsers(
  value: {
    picUserId?: string;
    micUserId?: string;
    eqReviewerUserId?: string;
    engagementRiskClassification?: CmpEngagementRiskClassification;
    serviceType?: CmpEngagementServiceType;
    otherServiceDescription?: string;
    feePlanningLines?: { staffUserId?: string | null }[];
    feeCurrency?: CmpBudgetCurrency;
    feeExchangeRateSnapshotId?: string;
    feeExchangeRateHkdPerUnit?: string;
    feeExchangeRateSource?: CmpEngagementExchangeRateSource;
  },
  context: z.RefinementCtx,
  enforceConditionalRequired = true
) {
  const people = [
    ["picUserId", value.picUserId],
    ["micUserId", value.micUserId],
    ["eqReviewerUserId", value.eqReviewerUserId],
  ] as const;
  for (const [field, userId] of people) {
    if (!userId) {
      continue;
    }
    if (
      people.some(
        ([otherField, otherUserId]) =>
          otherField !== field && otherUserId === userId
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: "PIC, MIC, and EQR must be different users",
      });
    }
  }
  if (
    value.engagementRiskClassification &&
    enforceConditionalRequired &&
    value.engagementRiskClassification !== "NORMAL" &&
    !value.eqReviewerUserId
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eqReviewerUserId"],
      message: "EQR is required for this engagement risk classification",
    });
  }
  if (value.serviceType === "OTHERS" && !value.otherServiceDescription) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["otherServiceDescription"],
      message: "Expected Job / Engagement Type is required for Others",
    });
  }
  const staffIds = value.feePlanningLines
    ?.map((line) => line.staffUserId)
    .filter((userId): userId is string => Boolean(userId));
  if (staffIds && new Set(staffIds).size !== staffIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["feePlanningLines"],
      message: "A staff member can only be selected once in a budget",
    });
  }
  if (
    value.feeCurrency &&
    value.feeCurrency !== "HKD" &&
    value.feeExchangeRateSource !== "MANUAL" &&
    !value.feeExchangeRateSnapshotId
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["feeExchangeRateSnapshotId"],
      message: "A system exchange-rate snapshot is required",
    });
  }
  if (
    value.feeCurrency &&
    value.feeCurrency !== "HKD" &&
    value.feeExchangeRateSource === "MANUAL" &&
    !value.feeExchangeRateHkdPerUnit
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["feeExchangeRateHkdPerUnit"],
      message: "A manual exchange rate is required",
    });
  }
}

export const CreateCmpEngagementSchema = CmpEngagementFields.extend({
  serviceType: CmpSelectableEngagementServiceTypeEnum,
})
  .strict()
  .superRefine(validateEngagementResponsibleUsers);
export type CreateCmpEngagementInput = z.infer<
  typeof CreateCmpEngagementSchema
>;

export const CmpAcceptanceEngagementDraftPayloadSchema =
  CmpEngagementFields.partial()
    .extend({
      clientId: z.string().trim().optional(),
      engagementCode: z.string().trim().max(80).optional(),
      budgetedHours: z.union([CmpRequiredHours, z.literal("")]).optional(),
      agreedFee: z.union([CmpRequiredMoney, z.literal("")]).optional(),
      recoveryRate: CmpOptionalPercentage,
      feePlanningLines: z
        .preprocess(
          normalizeLegacyCmpEngagementFeePlanLines,
          z.array(CmpAcceptanceEngagementFeePlanLineDraftSchema).max(50)
        )
        .optional(),
    })
    .strict()
    .superRefine((value, context) =>
      validateEngagementResponsibleUsers(value, context, false)
    );
export type CmpAcceptanceEngagementDraftPayload = z.infer<
  typeof CmpAcceptanceEngagementDraftPayloadSchema
>;
export const UpdateCmpEngagementSchema = CmpEngagementFields.partial()
  .strict()
  .superRefine(validateEngagementResponsibleUsers);
export type UpdateCmpEngagementInput = z.infer<
  typeof UpdateCmpEngagementSchema
>;

export const CmpEngagementListQuerySchema = z.object({
  clientId: z.string().trim().optional(),
  status: CmpEngagementStatusEnum.optional(),
  serviceType: CmpEngagementServiceTypeEnum.optional(),
  q: z.string().trim().optional(),
  availableForProject: z.preprocess((value) => {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return value;
  }, z.boolean().optional()),
});
export type CmpEngagementListQuery = z.infer<
  typeof CmpEngagementListQuerySchema
>;

export const ResolveCmpEngagementCodeQuerySchema = z.object({
  code: z.string().trim().min(1).max(80),
});
export type ResolveCmpEngagementCodeQuery = z.infer<
  typeof ResolveCmpEngagementCodeQuerySchema
>;

export const CmpEngagementClientRefSchema = z.object({
  id: z.string(),
  clientCode: z.string(),
  nameZh: z.string(),
  nameEn: z.string().nullable(),
  status: CmpClientStatusEnum,
});

export const CmpEngagementSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  client: CmpEngagementClientRefSchema,
  engagementCode: z.string(),
  serviceType: CmpEngagementServiceTypeEnum,
  otherServiceDescription: z.string().nullable().optional(),
  deliverables: CmpEngagementDeliverablesSchema.optional(),
  yearEndDate: z.string().nullable(),
  reportDate: z.string().nullable(),
  approvalReferenceNumber: z.string().nullable(),
  engagementDate: z.string().nullable(),
  budgetedHours: z.string(),
  agreedFee: z.string(),
  recoveryRate: z.string().nullable(),
  feePlanningLines: z.array(CmpEngagementFeePlanLineSchema).default([]),
  feeNotes: z.array(CmpEngagementFeeNoteSchema).default([]),
  feeCurrency: CmpBudgetCurrencyEnum,
  feeExchangeRateHkdPerUnit: z.string().nullable().optional(),
  feeExchangeRateSource: CmpEngagementExchangeRateSourceEnum.optional(),
  agreedFeeHkd: z.string().nullable().optional(),
  feeExchangeRateSnapshot:
    CmpBudgetExchangeRateSnapshotSchema.nullable().optional(),
  amlRiskClassification: CmpAmlRiskClassificationEnum.default("NOT_HIGH"),
  engagementRiskClassification:
    CmpEngagementRiskClassificationEnum.default("NORMAL"),
  picUserId: z.string().nullable(),
  micUserId: z.string().nullable(),
  eqReviewerUserId: z.string().nullable(),
  pic: z.string().nullable(),
  mic: z.string().nullable(),
  eqReviewer: z.string().nullable(),
  status: CmpEngagementStatusEnum,
  remarks: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  codeAliases: z.array(z.string()),
});
export type CmpEngagement = z.infer<typeof CmpEngagementSchema>;

export const CmpEngagementsResponseSchema = z.object({
  engagements: z.array(CmpEngagementSchema),
});
export type CmpEngagementsResponse = z.infer<
  typeof CmpEngagementsResponseSchema
>;

/** Complete formal payload used only by the CMP archive review workflow. */
export const CmpEngagementArchivePayloadSchema = CmpEngagementFields.omit({
  status: true,
})
  .strict()
  .superRefine(validateEngagementResponsibleUsers);
export type CmpEngagementArchivePayload = z.infer<
  typeof CmpEngagementArchivePayloadSchema
>;

export const CmpEngagementArchiveDraftSaveSchema = z
  .object({
    sourceUpdatedAt: z.string().datetime(),
    tmsFingerprint: z.string().trim().min(1).max(200),
    payload: CmpEngagementArchivePayloadSchema,
  })
  .strict();
export type CmpEngagementArchiveDraftSaveInput = z.infer<
  typeof CmpEngagementArchiveDraftSaveSchema
>;

export const CmpEngagementArchiveWorkflowStatusSchema = z.enum([
  "DRAFT",
  "PENDING_PIC",
  "RETURNED",
]);
export type CmpEngagementArchiveWorkflowStatus = z.infer<
  typeof CmpEngagementArchiveWorkflowStatusSchema
>;

export const CmpEngagementArchiveCheckCodeEnum = z.enum([
  "ENGAGEMENT_NOT_ELIGIBLE",
  "RESPONSIBLE_USERS_INVALID",
  "REPORT_DATE_INVALID",
  "UNRESOLVED_TBC",
  "DUPLICATE_BUDGET_PERSON",
  "UNASSIGNED_APPROVED_TMS_PERSON",
  "UNAPPROVED_TMS_TIME",
  "NO_DELIVERABLES",
  "ACTUAL_HOURS_OVER_BUDGET",
  "ACTUAL_COST_OVER_BUDGET",
  "ACTUAL_COST_OVER_FEE",
  "HISTORICAL_MEMBER",
  "RECOVERY_RATE_EXCEPTION",
]);
export type CmpEngagementArchiveCheckCode = z.infer<
  typeof CmpEngagementArchiveCheckCodeEnum
>;

export const CmpEngagementArchiveReadinessCheckSchema = z
  .object({
    code: CmpEngagementArchiveCheckCodeEnum,
    severity: z.enum(["BLOCKER", "WARNING"]),
    params: z.record(z.string(), z.string()),
  })
  .strict();
export type CmpEngagementArchiveReadinessCheck = z.infer<
  typeof CmpEngagementArchiveReadinessCheckSchema
>;

const CmpEngagementArchiveSourceSchema = z.object({
  sourceUpdatedAt: z.string().datetime(),
  tmsFingerprint: z.string().trim().min(1).max(200),
  overrideReason: z.string().trim().min(1).max(2000).optional(),
});

export const CmpEngagementArchiveSubmitSchema =
  CmpEngagementArchiveSourceSchema.strict();
export type CmpEngagementArchiveSubmitInput = z.infer<
  typeof CmpEngagementArchiveSubmitSchema
>;

export const CmpEngagementArchiveReturnSchema =
  CmpEngagementArchiveSourceSchema.extend({
    reason: z.string().trim().min(1).max(2000),
  }).strict();
export type CmpEngagementArchiveReturnInput = z.infer<
  typeof CmpEngagementArchiveReturnSchema
>;

const CmpEngagementArchiveHoursSchema = z.string();
export const CmpEngagementArchiveMemberCostSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    grade: CmpEngagementFeePlanGradeEnum,
    historical: z.boolean(),
    budgetNormal: CmpEngagementArchiveHoursSchema,
    budgetOt: CmpEngagementArchiveHoursSchema,
    actualNormal: CmpEngagementArchiveHoursSchema,
    actualOt: CmpEngagementArchiveHoursSchema,
    absent: CmpEngagementArchiveHoursSchema,
    hourlyRate: z.string(),
    budgetCost: z.string(),
    actualCost: z.string(),
    currency: CmpBudgetCurrencyEnum,
  })
  .strict();
export type CmpEngagementArchiveMemberCost = z.infer<
  typeof CmpEngagementArchiveMemberCostSchema
>;

export const CmpEngagementArchiveTotalsSchema = z
  .object({
    budgetCost: z.string(),
    actualCost: z.string(),
    currency: CmpBudgetCurrencyEnum,
  })
  .strict();
export type CmpEngagementArchiveTotals = z.infer<
  typeof CmpEngagementArchiveTotalsSchema
>;

export const CmpEngagementArchiveDraftSchema = z
  .object({
    id: z.string(),
    engagementId: z.string(),
    payload: CmpEngagementArchivePayloadSchema,
    sourceUpdatedAt: z.string(),
    tmsFingerprint: z.string(),
    editorUserId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    workflowStatus: CmpEngagementArchiveWorkflowStatusSchema,
    submittedById: z.string().nullable(),
    submittedAt: z.string().nullable(),
    returnedById: z.string().nullable(),
    returnedAt: z.string().nullable(),
    returnReason: z.string().nullable(),
    overrideReason: z.string().nullable(),
  })
  .strict();
export type CmpEngagementArchiveDraft = z.infer<
  typeof CmpEngagementArchiveDraftSchema
>;

export const CmpEngagementArchiveSnapshotSchema = z
  .object({
    id: z.string(),
    engagementId: z.string(),
    engagement: CmpEngagementSchema,
    archivedById: z.string(),
    archivedAt: z.string(),
    tmsFingerprint: z.string(),
    totals: CmpEngagementArchiveTotalsSchema,
    memberCosts: z.array(CmpEngagementArchiveMemberCostSchema),
    workflowVersion: z.number().int(),
    preparedById: z.string().nullable(),
    submittedAt: z.string().nullable(),
    approvedById: z.string().nullable(),
    approvalNote: z.string().nullable(),
    acknowledgedWarnings: z.array(CmpEngagementArchiveCheckCodeEnum),
  })
  .strict();
export type CmpEngagementArchiveSnapshot = z.infer<
  typeof CmpEngagementArchiveSnapshotSchema
>;

export const CmpEngagementArchiveReviewSchema = z
  .object({
    engagement: CmpEngagementSchema,
    draft: CmpEngagementArchiveDraftSchema.nullable(),
    tmsFingerprint: z.string(),
    memberCosts: z.array(CmpEngagementArchiveMemberCostSchema),
    totals: CmpEngagementArchiveTotalsSchema,
    warnings: z.array(z.string()),
    blockers: z.array(z.string()),
    canArchive: z.boolean(),
    readiness: z.array(CmpEngagementArchiveReadinessCheckSchema),
    workflow: z
      .object({
        status: CmpEngagementArchiveWorkflowStatusSchema,
        canEdit: z.boolean(),
        canSubmit: z.boolean(),
        canApprove: z.boolean(),
        canReturn: z.boolean(),
        overrideRequired: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type CmpEngagementArchiveReview = z.infer<
  typeof CmpEngagementArchiveReviewSchema
>;

export const CmpEngagementArchiveFinalizeSchema = z
  .object({
    draftId: z.string().trim().min(1),
    sourceUpdatedAt: z.string().datetime(),
    tmsFingerprint: z.string().trim().min(1).max(200),
    approvalNote: z.string().trim().max(2000).optional(),
    acknowledgedWarnings: z.array(CmpEngagementArchiveCheckCodeEnum),
    overrideReason: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export type CmpEngagementArchiveFinalizeInput = z.infer<
  typeof CmpEngagementArchiveFinalizeSchema
>;

export const CmpEngagementArchiveListItemSchema = z
  .object({
    id: z.string(),
    engagementId: z.string(),
    engagementCode: z.string(),
    clientName: z.string(),
    reportDate: z.string().nullable(),
    pic: z.string().nullable(),
    archivedAt: z.string(),
    totals: CmpEngagementArchiveTotalsSchema,
  })
  .strict();
export const CmpEngagementArchivesResponseSchema = z
  .object({ archives: z.array(CmpEngagementArchiveListItemSchema) })
  .strict();
export type CmpEngagementArchivesResponse = z.infer<
  typeof CmpEngagementArchivesResponseSchema
>;

export const TmsEngagementDirectoryQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
});
export type TmsEngagementDirectoryQuery = z.infer<
  typeof TmsEngagementDirectoryQuerySchema
>;

export const TmsEngagementTimesheetAccessReasonEnum = z.enum([
  "ALLOWED",
  "EMP_PROJECT_REQUIRED",
  "EMP_MEMBERSHIP_REQUIRED",
  "INDEPENDENCE_DECLARATION_REQUIRED",
]);
export type TmsEngagementTimesheetAccessReason = z.infer<
  typeof TmsEngagementTimesheetAccessReasonEnum
>;

export const TmsEngagementDirectoryItemSchema = z.object({
  id: z.string(),
  source: z.enum(["ENGAGEMENT", "UNLINKED_PROJECT"]).optional(),
  projectId: z.string().nullable().optional(),
  projectCode: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  engagementCode: z.string(),
  clientId: z.string(),
  clientCode: z.string(),
  clientName: z.string(),
  serviceType: CmpEngagementServiceTypeEnum,
  budgetedHours: z.string(),
  agreedFee: z.string(),
  recoveryRate: z.string().nullable(),
  feeCurrency: CmpBudgetCurrencyEnum,
  pic: z.string().nullable(),
  mic: z.string().nullable(),
  codeAliases: z.array(z.string()),
  timesheetAccess: z.object({
    allowed: z.boolean(),
    reason: TmsEngagementTimesheetAccessReasonEnum,
  }),
});
export type TmsEngagementDirectoryItem = z.infer<
  typeof TmsEngagementDirectoryItemSchema
>;

export const TmsEngagementDirectoryResponseSchema = z.object({
  engagements: z.array(TmsEngagementDirectoryItemSchema),
});
export type TmsEngagementDirectoryResponse = z.infer<
  typeof TmsEngagementDirectoryResponseSchema
>;

export const TmsProjectLinkStatusSchema = z.enum(["PENDING", "LINKED"]);
export type TmsProjectLinkStatus = z.infer<typeof TmsProjectLinkStatusSchema>;

export const TmsProjectLinkPeriodScopeSchema = z.enum([
  "all",
  "first",
  "second",
]);
export type TmsProjectLinkPeriodScope = z.infer<
  typeof TmsProjectLinkPeriodScopeSchema
>;

export const TmsProjectLinkSchema = z.object({
  id: z.string().min(1),
  rowId: z.string().min(1),
  ownerUserId: z.string().min(1),
  ownerName: z.string().min(1),
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  periodScope: TmsProjectLinkPeriodScopeSchema,
  tmsCode: z.string().min(1),
  label: z.string(),
  projectId: z.string().nullable(),
  projectCode: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  workType: z.enum(["Normal", "OT", "Absent"]).nullable().optional(),
  description: z.string().optional(),
  hoursByDate: z
    .record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.number().min(0).max(24))
    .optional(),
  periodTotal: z.number().nonnegative().optional(),
  status: TmsProjectLinkStatusSchema,
});
export type TmsProjectLink = z.infer<typeof TmsProjectLinkSchema>;

export const TmsProjectLinkQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  projectId: z.string().trim().min(1).optional(),
  status: TmsProjectLinkStatusSchema.optional(),
});
export type TmsProjectLinkQuery = z.infer<typeof TmsProjectLinkQuerySchema>;

export const TmsProjectLinkInputSchema = z.object({
  rowId: z.string().trim().min(1).max(120),
  projectId: z.string().trim().min(1),
});
export type TmsProjectLinkInput = z.infer<typeof TmsProjectLinkInputSchema>;

export const TmsProjectLinksResponseSchema = z.object({
  links: z.array(TmsProjectLinkSchema),
});
export type TmsProjectLinksResponse = z.infer<
  typeof TmsProjectLinksResponseSchema
>;

export const TmsTimesheetHalfSchema = z.enum(["FIRST_HALF", "SECOND_HALF"]);
export type TmsTimesheetHalf = z.infer<typeof TmsTimesheetHalfSchema>;

export const TMS_NORMAL_DAILY_HOURS_MAX = 8;
export const TMS_NORMAL_DAILY_HOURS_ERROR_MESSAGE =
  "Normal 工时每天不得超过 8 小时";

const TmsTimesheetRowPayloadSchema = z
  .object({
    id: z.string().min(1).max(120),
    periodScope: z.enum(["all", "first", "second"]),
    type: z.enum(["Chargeable", "Non-Chargeable", "Leave"]),
    workType: z.enum(["Normal", "OT", "Absent"]).optional(),
    details: z.string().min(1).max(80),
    description: z.string().max(500),
    hoursByDate: z.record(
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.number().min(0).max(24)
    ),
    periodTotal: z.number().nonnegative(),
    approvalOriginalHoursByDate: z
      .record(
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        z.number().min(0).max(24)
      )
      .optional(),
  })
  .passthrough();

export function buildTmsApprovalOtRowId(sourceRowId: string) {
  return `${sourceRowId.slice(0, 108)}-approval-ot`;
}

export const TmsTimesheetDraftRowSchema = TmsTimesheetRowPayloadSchema;

export const TmsTimesheetRowSchema = TmsTimesheetRowPayloadSchema.superRefine(
  (row, ctx) => {
    const allowedWorkTypes =
      row.type === "Chargeable"
        ? ["Normal", "OT", "Absent"]
        : row.type === "Non-Chargeable"
          ? ["Normal", "OT"]
          : ["Normal"];
    if (row.workType && !allowedWorkTypes.includes(row.workType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workType"],
        message: `workType ${row.workType} is not valid for ${row.type}`,
      });
    }

    const effectiveWorkType =
      row.type === "Leave"
        ? "Normal"
        : row.workType && allowedWorkTypes.includes(row.workType)
          ? row.workType
          : row.type === "Chargeable" &&
              (row.details === "Normal" ||
                row.details === "OT" ||
                row.details === "Absent")
            ? row.details
            : "Normal";
    if (effectiveWorkType !== "Normal") {
      return;
    }

    for (const [date, hours] of Object.entries(row.hoursByDate)) {
      if (hours > TMS_NORMAL_DAILY_HOURS_MAX) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hoursByDate", date],
          message: TMS_NORMAL_DAILY_HOURS_ERROR_MESSAGE,
        });
      }
    }
  }
);
export type TmsTimesheetRow = z.infer<typeof TmsTimesheetRowSchema>;

export const TmsApprovalStatusSchema = z.enum([
  "NOT_SUBMITTED",
  "SUBMITTED",
  "APPROVED",
  "RETURNED",
  "PENDING_CONFIRMATION",
]);
export type TmsApprovalStatus = z.infer<typeof TmsApprovalStatusSchema>;

export const TmsTimesheetPeriodStateSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]),
  revision: z.number().int().nonnegative(),
  editable: z.boolean(),
  approvalStatus: TmsApprovalStatusSchema.default("NOT_SUBMITTED"),
  linkStatus: z.enum(["LINKED", "PENDING_LINK"]).optional(),
});

export const TmsApprovalCellLockSchema = z.object({
  rowId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const TmsApprovalLockSchema = z.object({
  engagementId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  half: z.enum(["FIRST_HALF", "SECOND_HALF"]),
  status: TmsApprovalStatusSchema,
  lockAll: z.boolean(),
  lockedCells: z.array(TmsApprovalCellLockSchema),
  modifiedCells: z.array(TmsApprovalCellLockSchema).default([]),
  returnedCells: z.array(TmsApprovalCellLockSchema).default([]),
  returnReason: z.string().nullable().default(null),
});
export type TmsApprovalLock = z.infer<typeof TmsApprovalLockSchema>;

export const TmsTimesheetMonthSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  rows: z.array(TmsTimesheetDraftRowSchema),
  persistence: z.enum(["SERVER", "PREVIEW_MEMORY"]),
  periods: z.object({
    FIRST_HALF: TmsTimesheetPeriodStateSchema,
    SECOND_HALF: TmsTimesheetPeriodStateSchema,
  }),
  approvalLocks: z.array(TmsApprovalLockSchema).optional(),
});
export type TmsTimesheetMonth = z.infer<typeof TmsTimesheetMonthSchema>;

export const TmsOverviewPeriodSchema = z.enum(["all", "first", "second"]);
export type TmsOverviewPeriod = z.infer<typeof TmsOverviewPeriodSchema>;

export const TmsOverviewQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
  month: z.coerce.number().int().min(1).max(12),
  period: TmsOverviewPeriodSchema.default("all"),
});
export type TmsOverviewQuery = z.infer<typeof TmsOverviewQuerySchema>;

export const TmsOverviewDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isWorkday: z.boolean(),
  isHoliday: z.boolean(),
  normal: z.number().nonnegative(),
  ot: z.number().nonnegative(),
  leave: z.number().nonnegative(),
  total: z.number().nonnegative(),
  state: z.enum(["OK", "WARNING", "ERROR"]),
});
export type TmsOverviewDay = z.infer<typeof TmsOverviewDaySchema>;

export const TmsOverviewEmployeeSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  globalRole: z.string().min(1),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]),
  normal: z.number().nonnegative(),
  ot: z.number().nonnegative(),
  leave: z.number().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  daily: z.array(TmsOverviewDaySchema),
});
export type TmsOverviewEmployee = z.infer<typeof TmsOverviewEmployeeSchema>;

export const TmsOverviewResponseSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  period: TmsOverviewPeriodSchema,
  employees: z.array(TmsOverviewEmployeeSchema),
});
export type TmsOverviewResponse = z.infer<typeof TmsOverviewResponseSchema>;

export const TmsTimesheetQueryStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "RETURNED",
]);
export const TmsTimesheetActiveStatusSchema = z.enum([
  "ACTIVE",
  "OFF_LINE",
  "LEAVE",
]);
export const TmsTimesheetQueryModeSchema = z.enum(["DETAIL", "SUMMARY"]);
const TmsQueryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""));
const TmsQueryTextSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .or(z.literal(""));

export const TmsTimesheetQuerySchema = z
  .object({
    staffName: TmsQueryTextSchema,
    staffNo: TmsQueryTextSchema,
    jobCode: TmsQueryTextSchema,
    pic: TmsQueryTextSchema,
    mic: TmsQueryTextSchema,
    timesheetStatus: TmsTimesheetQueryStatusSchema.optional(),
    activeStatus: TmsTimesheetActiveStatusSchema.optional(),
    dateFrom: TmsQueryDateSchema,
    dateTo: TmsQueryDateSchema,
    mode: TmsTimesheetQueryModeSchema.default("DETAIL"),
    sortBy: z
      .enum(["JOB_CODE", "STAFF_NAME", "TIMESHEET_DATE", "CLIENT_NAME"])
      .default("JOB_CODE"),
    sortDirection: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(50),
  })
  .refine(
    (input) =>
      !input.dateFrom || !input.dateTo || input.dateFrom <= input.dateTo,
    {
      message: "dateFrom must not be after dateTo",
      path: ["dateTo"],
    }
  );
export type TmsTimesheetQueryInput = z.infer<typeof TmsTimesheetQuerySchema>;

const TmsTimesheetQueryRowBaseSchema = z.object({
  jobCode: z.string(),
  staffNo: z.string().nullable(),
  staffName: z.string(),
  rate: z.string().nullable(),
  normal: z.number().nonnegative(),
  ot: z.number().nonnegative(),
  absent: z.number().nonnegative(),
  total: z.string().nullable(),
  clientName: z.string(),
  netBudgetFee: z.string().nullable(),
  pic: z.string().nullable(),
  mic: z.string().nullable(),
  timesheetStatus: TmsTimesheetQueryStatusSchema,
  activeStatus: TmsTimesheetActiveStatusSchema,
});
export const TmsTimesheetQueryDetailRowSchema =
  TmsTimesheetQueryRowBaseSchema.extend({
    timesheetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
export const TmsTimesheetQuerySummaryRowSchema =
  TmsTimesheetQueryRowBaseSchema.extend({
    dateFrom: z.string().nullable(),
    dateTo: z.string().nullable(),
  });
export const TmsTimesheetQueryResponseSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("DETAIL"),
    rows: z.array(TmsTimesheetQueryDetailRowSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  }),
  z.object({
    mode: z.literal("SUMMARY"),
    rows: z.array(TmsTimesheetQuerySummaryRowSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  }),
]);
export type TmsTimesheetQueryDetailRow = z.infer<
  typeof TmsTimesheetQueryDetailRowSchema
>;
export type TmsTimesheetQuerySummaryRow = z.infer<
  typeof TmsTimesheetQuerySummaryRowSchema
>;
export type TmsTimesheetQueryResponse = z.infer<
  typeof TmsTimesheetQueryResponseSchema
>;

export const TmsSaveDraftInputSchema = z.object({
  rows: z.array(TmsTimesheetDraftRowSchema),
});
export type TmsSaveDraftInput = z.infer<typeof TmsSaveDraftInputSchema>;

export const TmsSubmitInputSchema = z.object({
  scope: z.enum(["FIRST_HALF", "SECOND_HALF", "ALL"]),
});
export type TmsSubmitInput = z.infer<typeof TmsSubmitInputSchema>;

export const TmsApproveInputSchema = z.object({
  expectedSubmittedRevision: z.number().int().positive(),
});
export type TmsApproveInput = z.infer<typeof TmsApproveInputSchema>;

export const TmsApprovalActionInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
  restoreStatus: z.enum(["SUBMITTED", "PENDING_CONFIRMATION"]).optional(),
});
export type TmsApprovalActionInput = z.infer<
  typeof TmsApprovalActionInputSchema
>;

export const TmsApprovalEditInputSchema = TmsApprovalActionInputSchema.extend({
  rows: z.array(TmsTimesheetRowSchema),
});
export type TmsApprovalEditInput = z.infer<typeof TmsApprovalEditInputSchema>;

export const TmsApprovalReturnInputSchema = TmsApprovalActionInputSchema.extend(
  {
    reason: z.string().trim().max(1000).optional(),
  }
);
export type TmsApprovalReturnInput = z.infer<
  typeof TmsApprovalReturnInputSchema
>;

export const TmsApprovalRecordSchema = z.object({
  id: z.string().min(1),
  ownerUserId: z.string().min(1),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  half: TmsTimesheetHalfSchema,
  engagementId: z.string().min(1),
  engagementCode: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  projectCode: z.string().min(1).nullable().optional(),
  projectName: z.string().min(1).nullable().optional(),
  clientCode: z.string().min(1),
  clientName: z.string().min(1),
  revision: z.number().int().positive(),
  status: TmsApprovalStatusSchema,
  submittedRows: z.array(TmsTimesheetRowSchema),
  submittedAt: z.string().datetime().nullable(),
  reviewedById: z.string().min(1).nullable(),
  reviewedAt: z.string().datetime().nullable(),
  returnReason: z.string().nullable(),
});
export type TmsApprovalRecord = z.infer<typeof TmsApprovalRecordSchema>;

export const TmsApprovalProjectSchema = z.object({
  engagementId: z.string().min(1),
  engagementCode: z.string().min(1),
  clientCode: z.string().min(1),
  clientName: z.string().min(1),
  pic: z.string().nullable(),
  mic: z.string().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED", "ARCHIVED"]),
  pendingCount: z.number().int().nonnegative(),
  returnedCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative().optional(),
});
export type TmsApprovalProject = z.infer<typeof TmsApprovalProjectSchema>;

export const TmsApprovalProjectsResponseSchema = z.object({
  projects: z.array(TmsApprovalProjectSchema),
});
export type TmsApprovalProjectsResponse = z.infer<
  typeof TmsApprovalProjectsResponseSchema
>;

export const TmsApprovalRecordsResponseSchema = z.object({
  records: z.array(TmsApprovalRecordSchema),
});
export type TmsApprovalRecordsResponse = z.infer<
  typeof TmsApprovalRecordsResponseSchema
>;

export const TmsEngagementSummaryRowSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  budgetNormal: z.number().nonnegative().nullable(),
  budgetOt: z.number().nonnegative().nullable(),
  finalNormal: z.number().nonnegative().nullable(),
  finalOt: z.number().nonnegative().nullable(),
  absent: z.number().nonnegative().nullable(),
  rate: z.number().nonnegative().nullable(),
  budgetCost: z.number().nonnegative().nullable(),
  actualCost: z.number().nonnegative().nullable(),
  diff: z.number().nullable(),
});
export type TmsEngagementSummaryRow = z.infer<
  typeof TmsEngagementSummaryRowSchema
>;

export const TmsEngagementSummarySectionSchema = z.object({
  rows: z.array(TmsEngagementSummaryRowSchema),
  total: TmsEngagementSummaryRowSchema,
});
export type TmsEngagementSummarySection = z.infer<
  typeof TmsEngagementSummarySectionSchema
>;

export const TmsEngagementSummaryPeriodSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  half: TmsTimesheetHalfSchema,
  revision: z.number().int().positive(),
  status: TmsApprovalStatusSchema,
  bucket: z.enum(["APPROVED", "DRAFT"]),
  normal: z.number().nonnegative(),
  ot: z.number().nonnegative(),
  absent: z.number().nonnegative(),
  total: z.number().nonnegative(),
});
export type TmsEngagementSummaryPeriod = z.infer<
  typeof TmsEngagementSummaryPeriodSchema
>;

export const TmsEngagementSummarySchema = z.object({
  approved: TmsEngagementSummarySectionSchema,
  draft: TmsEngagementSummarySectionSchema,
  periods: z.array(TmsEngagementSummaryPeriodSchema).optional(),
});
export type TmsEngagementSummary = z.infer<typeof TmsEngagementSummarySchema>;

export type CmpDemoClient = {
  clientCode: string;
  companyNumber: string;
  groupCode: string;
  groupNameEn: string;
  nameEn: string;
  contactPerson: string;
  email: string;
  hsicSectionCode: CmpHsicSectionCode;
  yearEndDate: string;
  placeOfIncorporation: string;
  listedOrPrivate: string;
  clientPartnerPic: string;
  clientManagerMic: string;
  serviceLines: string;
  approvalReferenceNumber: string;
  approvalDate: string;
  preparedBy: string;
  approvedBy: string;
};

export type CmpDemoEngagement = {
  clientCode: string;
  engagementCode: string;
  serviceType: CmpEngagementServiceType;
  yearEndDate: string;
  reportDate: string;
  approvalReferenceNumber: string;
  engagementDate: string;
  budgetedHours: string;
  agreedFee: string;
  recoveryRate: string;
  feeCurrency: CmpBudgetCurrency;
  pic: string;
  mic: string;
  remarks: string;
};

export type CmpDemoTmsEngagementDirectoryItem = {
  engagementCode: string;
  clientCode: string;
  clientName: string;
  pic: string;
  mic: string;
  codeAliases: string[];
};

export const CMP_DEMO_CLIENTS: readonly CmpDemoClient[] = [
  {
    clientCode: "C-WKS-001",
    companyNumber: "240377",
    groupCode: "G-WORKSHOP",
    groupNameEn: "Workshop Group",
    nameEn: "Workshop Company Limited",
    contactPerson: "Amy Chan",
    email: "amy@workshop.example",
    hsicSectionCode: "G",
    yearEndDate: "2026-10-31",
    placeOfIncorporation: "Hong Kong",
    listedOrPrivate: "PRIVATE",
    clientPartnerPic: "Jony Ma",
    clientManagerMic: "Leo Li",
    serviceLines: "Audit, Tax",
    approvalReferenceNumber: "NCA-240377",
    approvalDate: "2026-01-10",
    preparedBy: "King Su",
    approvedBy: "Leo Li",
  },
  {
    clientCode: "C-ORC-2026",
    companyNumber: "240378",
    groupCode: "G-ORCHID",
    groupNameEn: "Orchid Holdings",
    nameEn: "Orchid Technology Limited",
    contactPerson: "Ben Wong",
    email: "ben@orchid.example",
    hsicSectionCode: "J",
    yearEndDate: "2026-12-31",
    placeOfIncorporation: "Hong Kong",
    listedOrPrivate: "PRIVATE",
    clientPartnerPic: "Jony Ma",
    clientManagerMic: "Eden Chan",
    serviceLines: "Audit, Risk",
    approvalReferenceNumber: "NCA-240378",
    approvalDate: "2026-02-18",
    preparedBy: "Sam Lu",
    approvedBy: "Eden Chan",
  },
  {
    clientCode: "C-HBR-010",
    companyNumber: "240379",
    groupCode: "G-HARBOUR",
    groupNameEn: "Harbour Group",
    nameEn: "Harbour Retail Limited",
    contactPerson: "Cathy Ho",
    email: "cathy@harbour.example",
    hsicSectionCode: "G",
    yearEndDate: "2026-03-31",
    placeOfIncorporation: "Hong Kong",
    listedOrPrivate: "PRIVATE",
    clientPartnerPic: "Edric Han",
    clientManagerMic: "Leo Li",
    serviceLines: "Audit, Accounting",
    approvalReferenceNumber: "NCA-240379",
    approvalDate: "2026-03-12",
    preparedBy: "King Su",
    approvedBy: "Leo Li",
  },
];

export const CMP_DEMO_ENGAGEMENTS: readonly CmpDemoEngagement[] = [
  {
    clientCode: "C-WKS-001",
    engagementCode: "WKS-2026-AUD",
    serviceType: "AUDIT",
    yearEndDate: "2026-10-31",
    reportDate: "2027-01-31",
    approvalReferenceNumber: "NEA-240377-AUD",
    engagementDate: "2026-01-20",
    budgetedHours: "420.00",
    agreedFee: "180000.00",
    recoveryRate: "",
    feeCurrency: "HKD",
    pic: "Jony Ma",
    mic: "Leo Li",
    remarks: "Demo annual audit engagement.",
  },
  {
    clientCode: "C-ORC-2026",
    engagementCode: "ORC-2026-AUD",
    serviceType: "AUDIT",
    yearEndDate: "2026-12-31",
    reportDate: "2027-03-31",
    approvalReferenceNumber: "NEA-240378-AUD",
    engagementDate: "2026-02-25",
    budgetedHours: "560.00",
    agreedFee: "240000.00",
    recoveryRate: "",
    feeCurrency: "HKD",
    pic: "Jony Ma",
    mic: "Eden Chan",
    remarks: "Demo audit engagement.",
  },
  {
    clientCode: "C-ORC-2026",
    engagementCode: "ORC-2026-RISK",
    serviceType: "RISK",
    yearEndDate: "2026-12-31",
    reportDate: "2027-02-28",
    approvalReferenceNumber: "NEA-240378-RSK",
    engagementDate: "2026-03-05",
    budgetedHours: "180.00",
    agreedFee: "95000.00",
    recoveryRate: "",
    feeCurrency: "HKD",
    pic: "Edric Han",
    mic: "Sam Lu",
    remarks: "Demo risk service engagement.",
  },
  {
    clientCode: "C-HBR-010",
    engagementCode: "HBR-2026-ACC",
    serviceType: "ACCOUNTING",
    yearEndDate: "2026-03-31",
    reportDate: "2026-06-30",
    approvalReferenceNumber: "NEA-240379-ACC",
    engagementDate: "2026-03-20",
    budgetedHours: "240.00",
    agreedFee: "120000.00",
    recoveryRate: "",
    feeCurrency: "HKD",
    pic: "Edric Han",
    mic: "Leo Li",
    remarks: "Demo accounting service engagement.",
  },
];

export function buildTmsEngagementDirectoryFromCmp(
  engagements = CMP_DEMO_ENGAGEMENTS,
  clients = CMP_DEMO_CLIENTS
): CmpDemoTmsEngagementDirectoryItem[] {
  const clientByCode = new Map(
    clients.map((client) => [client.clientCode, client])
  );

  return engagements.map((engagement) => {
    const client = clientByCode.get(engagement.clientCode);
    if (!client) {
      throw new Error(
        `CMP engagement ${engagement.engagementCode} references unknown client ${engagement.clientCode}`
      );
    }

    return {
      engagementCode: engagement.engagementCode,
      clientCode: client.clientCode,
      clientName: client.nameEn,
      pic: engagement.pic,
      mic: engagement.mic,
      codeAliases: [],
    };
  });
}

// CMP acceptance
export const CmpAcceptanceRequestTypeEnum = z.enum([
  "CLIENT",
  "CLIENT_CHANGE",
  "ENGAGEMENT",
  "ENGAGEMENT_CHANGE",
]);
export type CmpAcceptanceRequestType = z.infer<
  typeof CmpAcceptanceRequestTypeEnum
>;

export const CmpAcceptanceStatusEnum = z.enum([
  "DRAFT",
  "STAFF_EDITING",
  "PENDING_MIC",
  "PENDING_PIC",
  "PENDING_IT",
  "APPROVED",
  "RETURNED",
  "CANCELLED",
]);
export type CmpAcceptanceStatus = z.infer<typeof CmpAcceptanceStatusEnum>;

export const CmpAcceptanceStepEnum = z.enum(["MIC", "PIC", "IT", "DONE"]);
export type CmpAcceptanceStep = z.infer<typeof CmpAcceptanceStepEnum>;

export const CmpAcceptanceStepStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "RETURNED",
]);
export type CmpAcceptanceStepStatus = z.infer<
  typeof CmpAcceptanceStepStatusEnum
>;

const CmpAcceptanceUserRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  globalRole: GlobalRoleSchema,
});
export type CmpAcceptanceUserRef = z.infer<typeof CmpAcceptanceUserRefSchema>;

const CmpOptionalAcceptanceTargetIdSchema = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === "string" && !value.trim()) {
    return;
  }
  return value;
}, z.string().trim().min(1).optional());

export const CreateCmpAcceptanceRequestSchema = z.object({
  type: CmpAcceptanceRequestTypeEnum,
  draftName: z.string().trim().min(1).max(100).optional(),
  targetClientId: CmpOptionalAcceptanceTargetIdSchema,
  targetEngagementId: CmpOptionalAcceptanceTargetIdSchema,
  clientPayload: CmpClientAcceptanceDraftPayloadSchema.optional(),
  engagementPayload: CmpAcceptanceEngagementDraftPayloadSchema.optional(),
  micApproverId: z.string().trim().min(1).optional(),
  picApproverId: z.string().trim().min(1).optional(),
  itApproverId: z.string().trim().min(1).optional(),
  draftAssigneeId: z.string().trim().min(1).optional(),
  submit: z.boolean().optional(),
});
export type CreateCmpAcceptanceRequestInput = z.infer<
  typeof CreateCmpAcceptanceRequestSchema
>;

export const UpdateCmpAcceptanceRequestSchema = z.object({
  draftName: z.string().trim().min(1).max(100).optional(),
  targetClientId: CmpOptionalAcceptanceTargetIdSchema,
  targetEngagementId: CmpOptionalAcceptanceTargetIdSchema,
  clientPayload: CmpClientAcceptanceDraftPayloadSchema.optional(),
  engagementPayload: CmpAcceptanceEngagementDraftPayloadSchema.optional(),
  micApproverId: z.string().trim().min(1).optional(),
  picApproverId: z.string().trim().min(1).optional(),
  itApproverId: z.string().trim().min(1).optional(),
  draftAssigneeId: z.string().trim().min(1).optional(),
  submit: z.boolean().optional(),
});
export type UpdateCmpAcceptanceRequestInput = z.infer<
  typeof UpdateCmpAcceptanceRequestSchema
>;

export const CmpAcceptanceListQuerySchema = z.object({
  type: CmpAcceptanceRequestTypeEnum.optional(),
  status: CmpAcceptanceStatusEnum.optional(),
  currentStep: CmpAcceptanceStepEnum.optional(),
  targetEngagementId: z.string().trim().min(1).optional(),
  q: z.string().trim().optional(),
});
export type CmpAcceptanceListQuery = z.infer<
  typeof CmpAcceptanceListQuerySchema
>;

export const CmpAcceptanceDraftListTypeSchema = z.enum([
  "CLIENT",
  "ENGAGEMENT",
]);
export type CmpAcceptanceDraftListType = z.infer<
  typeof CmpAcceptanceDraftListTypeSchema
>;

export const CmpAcceptanceDraftListQuerySchema = z.object({
  type: CmpAcceptanceDraftListTypeSchema,
});
export type CmpAcceptanceDraftListQuery = z.infer<
  typeof CmpAcceptanceDraftListQuerySchema
>;

export const CmpAcceptanceActionSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});
export type CmpAcceptanceActionInput = z.infer<
  typeof CmpAcceptanceActionSchema
>;

export const CmpAcceptanceReturnSchema = z.object({
  comment: z.string().trim().min(1).max(2000),
});
export type CmpAcceptanceReturnInput = z.infer<
  typeof CmpAcceptanceReturnSchema
>;

export const CmpAcceptanceDraftAssignmentSchema = z.object({
  assigneeId: z.string().trim().min(1),
});
export type CmpAcceptanceDraftAssignmentInput = z.infer<
  typeof CmpAcceptanceDraftAssignmentSchema
>;

export const CmpAcceptanceApprovalStepSchema = z.object({
  id: z.string(),
  step: CmpAcceptanceStepEnum,
  approver: CmpAcceptanceUserRefSchema,
  approverId: z.string(),
  status: CmpAcceptanceStepStatusEnum,
  comment: z.string().nullable(),
  actedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type CmpAcceptanceApprovalStepRecord = z.infer<
  typeof CmpAcceptanceApprovalStepSchema
>;

const CmpStoredEngagementPayloadSchema = z.union([
  CreateCmpEngagementSchema,
  CmpAcceptanceEngagementDraftPayloadSchema,
]);
const CmpStoredClientPayloadSchema = z.union([
  CreateCmpClientSchema,
  CmpClientAcceptanceDraftPayloadSchema,
]);

export const CmpAcceptanceRequestSchema = z.object({
  id: z.string(),
  requestNo: z.string(),
  draftName: z.string().nullable().optional(),
  type: CmpAcceptanceRequestTypeEnum,
  status: CmpAcceptanceStatusEnum,
  currentStep: CmpAcceptanceStepEnum,
  submittedById: z.string(),
  submittedBy: CmpAcceptanceUserRefSchema,
  micApproverId: z.string(),
  micApprover: CmpAcceptanceUserRefSchema,
  picApproverId: z.string().nullable(),
  picApprover: CmpAcceptanceUserRefSchema.nullable(),
  itApproverId: z.string().nullable(),
  itApprover: CmpAcceptanceUserRefSchema.nullable(),
  workflowVersion: z.number().int().positive(),
  draftAssigneeId: z.string().nullable(),
  draftAssignee: CmpAcceptanceUserRefSchema.nullable(),
  draftCompletedAt: z.string().nullable(),
  draftCompletedById: z.string().nullable(),
  draftCompletedBy: CmpAcceptanceUserRefSchema.nullable(),
  returnedFromStep: CmpAcceptanceStepEnum.nullable(),
  picApprovedAt: z.string().nullable(),
  targetClientId: z.string().nullable(),
  targetEngagementId: z.string().nullable(),
  clientPayload: CmpStoredClientPayloadSchema.nullable(),
  engagementPayload: CmpStoredEngagementPayloadSchema.nullable(),
  returnReason: z.string().nullable(),
  submittedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  returnedAt: z.string().nullable(),
  changedFieldCount: z.number().int().nonnegative().nullable().optional(),
  amlSummary: z
    .object({
      status: z.enum(["NOT_RUN", "CLEAR", "ATTENTION", "ERROR"]),
      subjectCount: z.number().int().nonnegative(),
      attentionCount: z.number().int().nonnegative(),
      errorCount: z.number().int().nonnegative(),
      lastScreenedAt: z.string().datetime().nullable(),
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvalSteps: z.array(CmpAcceptanceApprovalStepSchema),
});
export type CmpAcceptanceRequest = z.infer<typeof CmpAcceptanceRequestSchema>;

export const CmpAcceptanceRequestsResponseSchema = z.object({
  requests: z.array(CmpAcceptanceRequestSchema),
});
export type CmpAcceptanceRequestsResponse = z.infer<
  typeof CmpAcceptanceRequestsResponseSchema
>;

export const CmpAcceptanceDraftListItemSchema = z.object({
  request: CmpAcceptanceRequestSchema,
  displayStatus: z.literal("DRAFT"),
  currentOwner: CmpAcceptanceUserRefSchema,
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
export type CmpAcceptanceDraftListItem = z.infer<
  typeof CmpAcceptanceDraftListItemSchema
>;

export const CmpAcceptanceDraftsResponseSchema = z.object({
  drafts: z.array(CmpAcceptanceDraftListItemSchema),
});
export type CmpAcceptanceDraftsResponse = z.infer<
  typeof CmpAcceptanceDraftsResponseSchema
>;

export const CmpAcceptanceChangeKindEnum = z.enum([
  "ADDED",
  "REMOVED",
  "MODIFIED",
]);
export type CmpAcceptanceChangeKind = z.infer<
  typeof CmpAcceptanceChangeKindEnum
>;

const CmpAcceptanceChangeScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const CmpAcceptanceChangeValueSchema = z.union([
  CmpAcceptanceChangeScalarSchema,
  z.array(z.record(z.string(), CmpAcceptanceChangeScalarSchema)),
]);
export type CmpAcceptanceChangeValue = z.infer<
  typeof CmpAcceptanceChangeValueSchema
>;

export const CmpAcceptanceFieldChangeSchema = z.object({
  field: z.string(),
  kind: CmpAcceptanceChangeKindEnum,
  before: CmpAcceptanceChangeValueSchema,
  after: CmpAcceptanceChangeValueSchema,
});
export type CmpAcceptanceFieldChange = z.infer<
  typeof CmpAcceptanceFieldChangeSchema
>;

export const CmpAcceptanceChangeGroupSchema = z.object({
  section: z.string(),
  changes: z.array(CmpAcceptanceFieldChangeSchema),
});
export type CmpAcceptanceChangeGroup = z.infer<
  typeof CmpAcceptanceChangeGroupSchema
>;

export const CmpAcceptanceChangeSummarySchema = z.object({
  status: z.enum(["AVAILABLE", "BASELINE_UNAVAILABLE"]),
  changedFieldCount: z.number().int().nonnegative(),
  baselineCapturedAt: z.string().nullable(),
  staleMasterData: z.boolean(),
  groups: z.array(CmpAcceptanceChangeGroupSchema),
});
export type CmpAcceptanceChangeSummary = z.infer<
  typeof CmpAcceptanceChangeSummarySchema
>;

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
