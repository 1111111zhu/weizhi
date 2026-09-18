CREATE TABLE "cmp_entity_maps" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" TEXT NOT NULL,
  "updated_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_entity_maps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cmp_entity_map_nodes" (
  "id" TEXT NOT NULL,
  "map_id" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "position_x" DOUBLE PRECISION NOT NULL,
  "position_y" DOUBLE PRECISION NOT NULL,
  "display_name_override" TEXT,
  "company_number_override" TEXT,
  "jurisdiction_override" TEXT,
  "pending_acceptance_id" TEXT,
  "pending_client_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_entity_map_nodes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cmp_entity_relationships" ADD COLUMN "map_id" TEXT;
CREATE UNIQUE INDEX "cmp_entity_map_nodes_entity_id_key" ON "cmp_entity_map_nodes"("entity_id");
CREATE UNIQUE INDEX "cmp_entity_map_nodes_pending_acceptance_id_key" ON "cmp_entity_map_nodes"("pending_acceptance_id");
CREATE INDEX "cmp_entity_maps_updated_at_idx" ON "cmp_entity_maps"("updated_at");
CREATE INDEX "cmp_entity_map_nodes_map_id_idx" ON "cmp_entity_map_nodes"("map_id");
CREATE INDEX "cmp_entity_map_nodes_pending_client_code_idx" ON "cmp_entity_map_nodes"("pending_client_code");
CREATE INDEX "cmp_entity_relationships_map_id_idx" ON "cmp_entity_relationships"("map_id");
ALTER TABLE "cmp_entity_map_nodes" ADD CONSTRAINT "cmp_entity_map_nodes_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "cmp_entity_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_entity_map_nodes" ADD CONSTRAINT "cmp_entity_map_nodes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "cmp_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_entity_relationships" ADD CONSTRAINT "cmp_entity_relationships_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "cmp_entity_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
