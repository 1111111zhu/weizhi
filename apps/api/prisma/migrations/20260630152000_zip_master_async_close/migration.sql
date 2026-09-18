ALTER TABLE "zip_master_sessions"
  ADD COLUMN "entry_tree_json" JSONB;

ALTER TABLE "zip_entry_master_sessions"
  ADD COLUMN "base_operation_sequence" INTEGER NOT NULL DEFAULT 0;
