CREATE TYPE "WorkingPaperBucket" AS ENUM ('CURRENT', 'PRIOR', 'TEMPORARY');

ALTER TABLE "working_papers"
ADD COLUMN "bucket" "WorkingPaperBucket" NOT NULL DEFAULT 'CURRENT';

CREATE INDEX "working_papers_workflow_node_id_bucket_idx"
ON "working_papers"("workflow_node_id", "bucket");
