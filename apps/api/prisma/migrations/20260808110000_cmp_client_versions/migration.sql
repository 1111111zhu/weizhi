CREATE TABLE "cmp_client_versions" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL,
    "acceptance_request_id" TEXT,
    "snapshot_json" JSONB NOT NULL,
    "change_summary_json" JSONB,
    "changed_by_id" TEXT,
    "changed_by_name" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_by_name" TEXT,
    "approved_at" TIMESTAMP(3),
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cmp_client_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_client_versions_acceptance_request_id_key" ON "cmp_client_versions"("acceptance_request_id");
CREATE UNIQUE INDEX "cmp_client_versions_client_id_version_number_key" ON "cmp_client_versions"("client_id", "version_number");
CREATE INDEX "cmp_client_versions_client_id_approved_at_idx" ON "cmp_client_versions"("client_id", "approved_at");
CREATE INDEX "cmp_client_versions_changed_by_id_approved_at_idx" ON "cmp_client_versions"("changed_by_id", "approved_at");

ALTER TABLE "cmp_client_versions"
  ADD CONSTRAINT "cmp_client_versions_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "cmp_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cmp_client_versions"
  ADD CONSTRAINT "cmp_client_versions_acceptance_request_id_fkey"
  FOREIGN KEY ("acceptance_request_id") REFERENCES "cmp_acceptance_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
