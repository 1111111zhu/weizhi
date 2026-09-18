-- DESTRUCTIVE MIGRATION
-- Create and verify a timestamped custom-format pg_dump before deployment.

UPDATE "cmp_acceptance_requests"
SET "client_payload" = "client_payload" - ARRAY[
  'prcOperationStatus',
  'prcOperationDetails',
  'hasPrcOperation',
  'booksAndRecordsInPrcStatus',
  'booksAndRecordsLocation',
  'booksAndRecordsInPrc',
  'prcArchiveStatus',
  'hasPrcArchive',
  'ultimateShareholdingAvailable',
  'shareholdingByPrcEnterprise',
  'shareholdingByPrcIndividual',
  'shareholdingByHkMacaoTaiwanInvestors',
  'otherInvestors',
  'otherInvestorsDetails',
  'shareholdingRemark',
  'shareholdingEffectiveDate',
  'shareholdingChangeDetails',
  'prcEstablishments',
  'mofBaseVersion'
]::text[]
WHERE "client_payload" IS NOT NULL;

UPDATE "cmp_acceptance_requests"
SET "change_baseline_payload" = "change_baseline_payload" - ARRAY[
  'prcOperationStatus',
  'prcOperationDetails',
  'hasPrcOperation',
  'booksAndRecordsInPrcStatus',
  'booksAndRecordsLocation',
  'booksAndRecordsInPrc',
  'prcArchiveStatus',
  'hasPrcArchive',
  'ultimateShareholdingAvailable',
  'shareholdingByPrcEnterprise',
  'shareholdingByPrcIndividual',
  'shareholdingByHkMacaoTaiwanInvestors',
  'otherInvestors',
  'otherInvestorsDetails',
  'shareholdingRemark',
  'shareholdingEffectiveDate',
  'shareholdingChangeDetails',
  'prcEstablishments',
  'mofBaseVersion'
]::text[]
WHERE "change_baseline_payload" IS NOT NULL;

DROP TABLE "cmp_client_shareholding_history";
DROP TABLE "cmp_client_prc_establishments";

ALTER TABLE "cmp_clients"
  DROP COLUMN "prc_operation_status",
  DROP COLUMN "prc_operation_details",
  DROP COLUMN "has_prc_operation",
  DROP COLUMN "books_and_records_in_prc_status",
  DROP COLUMN "books_and_records_location",
  DROP COLUMN "books_and_records_in_prc",
  DROP COLUMN "prc_archive_status",
  DROP COLUMN "has_prc_archive",
  DROP COLUMN "ultimate_shareholding_available",
  DROP COLUMN "shareholding_by_prc_enterprise",
  DROP COLUMN "shareholding_by_prc_individual",
  DROP COLUMN "shareholding_by_hk_macao_taiwan_investors",
  DROP COLUMN "other_investors",
  DROP COLUMN "other_investors_details",
  DROP COLUMN "shareholding_remark",
  DROP COLUMN "mof_version";
