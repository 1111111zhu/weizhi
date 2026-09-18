CREATE TABLE "cmp_client_contacts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT,
    "position" TEXT,
    "department" TEXT,
    "office_phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "remarks" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cmp_client_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cmp_client_contacts_client_id_sort_order_idx"
ON "cmp_client_contacts"("client_id", "sort_order");

ALTER TABLE "cmp_client_contacts"
ADD CONSTRAINT "cmp_client_contacts_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "cmp_clients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "cmp_client_contacts" (
    "id",
    "client_id",
    "name",
    "position",
    "department",
    "office_phone",
    "mobile",
    "email",
    "remarks",
    "sort_order"
)
SELECT
    'legacy_' || md5(random()::text || clock_timestamp()::text || "id"),
    "id",
    "contact_person",
    "contact_position",
    "contact_department",
    "telephone",
    "contact_mobile",
    "email",
    "contact_remarks",
    0
FROM "cmp_clients"
WHERE "contact_person" IS NOT NULL
   OR "contact_position" IS NOT NULL
   OR "contact_department" IS NOT NULL
   OR "telephone" IS NOT NULL
   OR "contact_mobile" IS NOT NULL
   OR "email" IS NOT NULL
   OR "contact_remarks" IS NOT NULL;
