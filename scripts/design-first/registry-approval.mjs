import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const APPROVAL_STATUSES = new Set([
  "proposed",
  "revision-requested",
  "approved",
]);
const PROVENANCE_HASH_PATTERN = /^[a-f0-9]{64}$/;

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidIsoDateTime(value) {
  if (!isNonemptyString(value) || !value.includes("T")) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function readProvenanceHash(projectRoot) {
  if (!projectRoot) return null;
  const path = resolve(projectRoot, "docs/ui-provenance.generated.json");
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function validateApprovedIdentity(approval, report) {
  const validHash = PROVENANCE_HASH_PATTERN.test(approval.provenanceHash);
  if (
    !isNonemptyString(approval.approvedBy) ||
    !isNonemptyString(approval.approvedAt) ||
    !validHash
  ) {
    report.error(
      "Approved registry requires approval.approvedBy, approval.approvedAt, and a 64-character approval.provenanceHash"
    );
  }
  if (
    isNonemptyString(approval.approvedAt) &&
    !isValidIsoDateTime(approval.approvedAt)
  ) {
    report.error("approval.approvedAt must be an ISO 8601 date-time");
  }
  return validHash;
}

function validateCurrentHash(approval, expectedProvenanceHash, report) {
  if (!expectedProvenanceHash) {
    report.error("Approved registry requires a current provenance inventory");
  } else if (approval.provenanceHash !== expectedProvenanceHash) {
    report.error(
      "approval.provenanceHash does not match the current inventory"
    );
  }
}

export function validateRegistryApproval(
  approval,
  expectedProvenanceHash,
  report
) {
  if (!APPROVAL_STATUSES.has(approval.status)) {
    report.error(
      `approval.status must be one of ${[...APPROVAL_STATUSES].sort().join(", ")}`
    );
  }
  if (approval.status === "approved") {
    if (validateApprovedIdentity(approval, report)) {
      validateCurrentHash(approval, expectedProvenanceHash, report);
    }
    return;
  }
  if (
    approval.provenanceHash !== null &&
    !PROVENANCE_HASH_PATTERN.test(approval.provenanceHash)
  ) {
    report.error(
      "approval.provenanceHash must be null or 64 lower-case hex characters"
    );
  }
}
