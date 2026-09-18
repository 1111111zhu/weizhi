CREATE UNIQUE INDEX "cmp_acceptance_requests_active_client_change_target_key"
  ON "cmp_acceptance_requests" ("target_client_id")
  WHERE "type" = 'CLIENT_CHANGE'
    AND "status" IN (
      'DRAFT',
      'STAFF_EDITING',
      'RETURNED',
      'PENDING_MIC',
      'PENDING_PIC',
      'PENDING_IT'
    );

CREATE UNIQUE INDEX "cmp_acceptance_requests_active_engagement_change_target_key"
  ON "cmp_acceptance_requests" ("target_engagement_id")
  WHERE "type" = 'ENGAGEMENT_CHANGE'
    AND "status" IN (
      'DRAFT',
      'STAFF_EDITING',
      'RETURNED',
      'PENDING_MIC',
      'PENDING_PIC',
      'PENDING_IT'
    );
