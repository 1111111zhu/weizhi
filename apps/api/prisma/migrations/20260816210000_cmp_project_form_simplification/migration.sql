-- Remove the retired Exceptional high level before replacing the PostgreSQL enum.
UPDATE "cmp_engagements"
SET
  "engagement_risk_classification" = 'NORMAL',
  "eq_reviewer_user_id" = NULL,
  "eq_reviewer" = NULL,
  "risk_management_partner_user_id" = NULL,
  "risk_management_partner" = NULL
WHERE "engagement_risk_classification" = 'EXCEPTIONAL_HIGH';

-- Keep only the two supported deliverable kinds and resequence their display order.
UPDATE "cmp_engagements" AS engagement
SET "deliverables" = COALESCE((
  SELECT jsonb_agg(
    (item - 'sortOrder') || jsonb_build_object('sortOrder', ordinal - 1)
    ORDER BY ordinal
  ) AS value
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(engagement."deliverables") = 'array'
      THEN engagement."deliverables" ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS entries(item, ordinal)
  WHERE item ->> 'code' IN ('AUDITORS_REPORT', 'CUSTOM')
), '[]'::jsonb);

-- Draft and historical acceptance payloads must remain readable by the reduced schema.
UPDATE "cmp_acceptance_requests"
SET "engagement_payload" = CASE
  WHEN "engagement_payload" IS NULL THEN NULL
  WHEN "engagement_payload" ->> 'engagementRiskClassification' = 'EXCEPTIONAL_HIGH' THEN
    jsonb_strip_nulls(
      (
        "engagement_payload"
          - 'riskManagementPartnerUserId'
          - 'riskManagementPartner'
          - 'eqReviewerUserId'
          - 'eqReviewer'
      )
      || jsonb_build_object(
        'engagementRiskClassification', 'NORMAL',
        'deliverables', COALESCE((
          SELECT jsonb_agg(
            (item - 'sortOrder') || jsonb_build_object('sortOrder', ordinal - 1)
            ORDER BY ordinal
          )
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof("engagement_payload" -> 'deliverables') = 'array'
              THEN "engagement_payload" -> 'deliverables' ELSE '[]'::jsonb END
          ) WITH ORDINALITY AS entries(item, ordinal)
          WHERE item ->> 'code' IN ('AUDITORS_REPORT', 'CUSTOM')
        ), '[]'::jsonb)
      )
    )
  ELSE
    jsonb_strip_nulls(
      (
        "engagement_payload"
          - 'riskManagementPartnerUserId'
          - 'riskManagementPartner'
      )
      || jsonb_build_object(
        'deliverables', COALESCE((
          SELECT jsonb_agg(
            (item - 'sortOrder') || jsonb_build_object('sortOrder', ordinal - 1)
            ORDER BY ordinal
          )
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof("engagement_payload" -> 'deliverables') = 'array'
              THEN "engagement_payload" -> 'deliverables' ELSE '[]'::jsonb END
          ) WITH ORDINALITY AS entries(item, ordinal)
          WHERE item ->> 'code' IN ('AUDITORS_REPORT', 'CUSTOM')
        ), '[]'::jsonb)
      )
    )
END
WHERE "engagement_payload" IS NOT NULL;

ALTER TABLE "cmp_engagements"
  DROP COLUMN "risk_management_partner_user_id",
  DROP COLUMN "risk_management_partner";

ALTER TYPE "CmpEngagementRiskClassification" RENAME TO "CmpEngagementRiskClassification_old";
CREATE TYPE "CmpEngagementRiskClassification" AS ENUM ('NORMAL', 'GREATER_THAN_NORMAL');
ALTER TABLE "cmp_engagements"
  ALTER COLUMN "engagement_risk_classification" DROP DEFAULT,
  ALTER COLUMN "engagement_risk_classification" TYPE "CmpEngagementRiskClassification"
    USING "engagement_risk_classification"::text::"CmpEngagementRiskClassification",
  ALTER COLUMN "engagement_risk_classification" SET DEFAULT 'NORMAL';
DROP TYPE "CmpEngagementRiskClassification_old";
