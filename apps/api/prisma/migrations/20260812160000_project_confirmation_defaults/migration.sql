CREATE TABLE "project_confirmation_defaults" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "client_name" TEXT,
    "confirmation_date" TEXT,
    "reference" TEXT,
    "pic" TEXT,
    "mic" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_confirmation_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_confirmation_defaults_project_id_key"
ON "project_confirmation_defaults"("project_id");

ALTER TABLE "project_confirmation_defaults"
ADD CONSTRAINT "project_confirmation_defaults_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
