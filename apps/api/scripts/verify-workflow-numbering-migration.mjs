import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const database = await PGlite.create();

try {
  await database.exec(`
    CREATE TABLE "workflow_nodes" (
      "id" TEXT PRIMARY KEY,
      "project_id" TEXT NOT NULL,
      "parent_id" TEXT,
      "level" INTEGER NOT NULL,
      "code" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL,
      "created_at" TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP NOT NULL,
      UNIQUE ("project_id", "parent_id", "code")
    );

    CREATE TABLE "working_papers" (
      "id" TEXT PRIMARY KEY,
      "workflow_node_id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "bucket" TEXT NOT NULL,
      "created_at" TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP NOT NULL,
      UNIQUE ("workflow_node_id", "code")
    );

    CREATE TABLE "attachments" (
      "id" TEXT PRIMARY KEY,
      "working_paper_id" TEXT,
      "workflow_node_id" TEXT,
      "code" TEXT,
      "title" TEXT,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "deleted_at" TIMESTAMP,
      "deleted_from_working_paper_id" TEXT,
      "deleted_from_workflow_node_id" TEXT,
      "deleted_from_working_paper_code" TEXT,
      "deleted_from_working_paper_title" TEXT,
      "created_at" TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP NOT NULL
    );

    CREATE TABLE "project_template_nodes" (
      "id" TEXT PRIMARY KEY,
      "project_template_id" TEXT NOT NULL,
      "parent_id" TEXT,
      "level" INTEGER NOT NULL,
      "code" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL,
      "created_at" TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP NOT NULL,
      UNIQUE ("project_template_id", "parent_id", "code")
    );

    CREATE TABLE "project_template_files" (
      "id" TEXT PRIMARY KEY,
      "template_node_id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL,
      "created_at" TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP NOT NULL,
      UNIQUE ("template_node_id", "code")
    );

    CREATE TABLE "project_template_smart_forms" (
      "id" TEXT PRIMARY KEY,
      "template_node_id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL,
      "created_at" TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP NOT NULL,
      UNIQUE ("template_node_id", "code")
    );
  `);

  const createdAt = "2026-07-01T00:00:00.000Z";
  await database.query(
    `INSERT INTO "workflow_nodes"
      ("id", "project_id", "parent_id", "level", "code", "title",
       "sort_order", "created_at", "updated_at")
     VALUES
      ('root-1', 'project-1', NULL, 1, 'A', '1000', 1, $1, $1),
      ('root-2', 'project-1', NULL, 1, 'B', 'Execution', 2, $1, $1),
      ('numeric-title', 'project-2', NULL, 1, 'Z', '2026', 1, $1, $1),
      ('same-code-title', 'project-3', NULL, 1, 'A', 'A', 1, $1, $1)`,
    [createdAt]
  );

  for (let ordinal = 1; ordinal <= 10; ordinal += 1) {
    await database.query(
      `INSERT INTO "workflow_nodes"
        ("id", "project_id", "parent_id", "level", "code", "title",
         "sort_order", "created_at", "updated_at")
       VALUES ($1, 'project-1', 'root-1', 2, $2, $3, $4, $5, $5)`,
      [
        `child-${ordinal}`,
        `A${ordinal}`,
        `Child ${ordinal}`,
        ordinal,
        createdAt,
      ]
    );
  }

  for (let ordinal = 1; ordinal <= 10; ordinal += 1) {
    await database.query(
      `INSERT INTO "workflow_nodes"
        ("id", "project_id", "parent_id", "level", "code", "title",
         "sort_order", "created_at", "updated_at")
       VALUES ($1, 'project-1', 'child-10', 3, $2, $3, $4, $5, $5)`,
      [
        `grandchild-${ordinal}`,
        `A10-${ordinal}`,
        `Grandchild ${ordinal}`,
        ordinal,
        createdAt,
      ]
    );
  }

  await database.query(
    `INSERT INTO "workflow_nodes"
      ("id", "project_id", "parent_id", "level", "code", "title",
       "sort_order", "created_at", "updated_at")
     VALUES
      ('level-4', 'project-1', 'grandchild-10', 4, 'legacy-4', 'Level 4',
       1, $1, $1),
      ('level-5', 'project-1', 'level-4', 5, 'legacy-5', 'Level 5',
       1, $1, $1)`,
    [createdAt]
  );

  await database.query(
    `INSERT INTO "working_papers"
      ("id", "workflow_node_id", "code", "title", "bucket",
       "created_at", "updated_at")
     VALUES
      ('paper-1', 'child-1', 'A1-F001', 'First file', 'CURRENT', $1, $1),
      ('paper-2', 'child-1', 'A1-F002', 'Second file', 'CURRENT', $1, $1),
      ('paper-temp', 'child-1', 'TEMP-F001', 'Temporary file',
       'TEMPORARY', $1, $1)`,
    [createdAt]
  );

  await database.query(
    `INSERT INTO "attachments"
      ("id", "working_paper_id", "workflow_node_id", "code", "title",
       "sort_order", "deleted_at", "deleted_from_working_paper_id",
       "deleted_from_workflow_node_id", "deleted_from_working_paper_code",
       "deleted_from_working_paper_title", "created_at", "updated_at")
     VALUES
      ('attachment-1', 'paper-1', 'child-1', 'A1-F001', 'First file',
       2, NULL, NULL, NULL, NULL, NULL, $1, $1),
      ('attachment-2', 'paper-2', 'child-1', 'CUSTOM-REF', 'Second file',
       1, NULL, NULL, NULL, NULL, NULL, $1, $1),
      ('deleted-with-paper', NULL, NULL, 'A1-F001', 'Deleted file',
       0, $1, 'paper-1', 'child-1', 'A1-F001', 'First file', $1, $1),
      ('deleted-orphan', NULL, NULL, 'A1-F099', 'Orphaned file',
       0, $1, 'missing-paper', 'child-1', 'A1-F099', 'Orphaned file',
       $1, $1),
      ('deleted-manual-orphan', NULL, NULL, 'CUSTOM-DELETED',
       'Manual orphaned file', 0, $2, 'missing-manual-paper', 'child-1',
       'A1-F098', 'Manual orphaned file', $2, $2)`,
    [createdAt, "2026-07-02T00:00:00.000Z"]
  );

  await database.query(
    `INSERT INTO "project_template_nodes"
      ("id", "project_template_id", "parent_id", "level", "code", "title",
       "sort_order", "created_at", "updated_at")
     VALUES
      ('template-root', 'template-1', NULL, 1, 'A', 'Planning',
       1, $1, $1),
      ('template-child', 'template-1', 'template-root', 2, 'A1', 'Assets',
       1, $1, $1),
      ('template-numeric-title', 'template-1', NULL, 1, 'Z', '2026',
       2, $1, $1)`,
    [createdAt]
  );
  await database.query(
    `INSERT INTO "project_template_files"
      ("id", "template_node_id", "code", "title", "sort_order",
       "created_at", "updated_at")
     VALUES
      ('template-file', 'template-child', 'A1-F002', 'Template file',
       2, $1, $1)`,
    [createdAt]
  );
  await database.query(
    `INSERT INTO "project_template_smart_forms"
      ("id", "template_node_id", "code", "title", "sort_order",
       "created_at", "updated_at")
     VALUES
      ('template-smart-form', 'template-child', 'A1-F001', 'Template form',
       1, $1, $1)`,
    [createdAt]
  );

  const migrationSql = await readFile(
    fileURLToPath(
      new URL(
        "../prisma/migrations/20260730123000_renumber_project_workflows/migration.sql",
        import.meta.url
      )
    ),
    "utf-8"
  );
  await database.exec(migrationSql);

  const nodes = await database.query(
    `SELECT "id", "code", "title"
     FROM "workflow_nodes"
     WHERE "id" IN (
       'root-1', 'root-2', 'child-1', 'child-10', 'grandchild-10',
       'level-4', 'level-5', 'numeric-title', 'same-code-title'
     )
     ORDER BY "id"`
  );
  assert.deepEqual(nodes.rows, [
    { id: "child-1", code: "1100", title: "Child 1" },
    { id: "child-10", code: "1-10-00", title: "Child 10" },
    {
      id: "grandchild-10",
      code: "1-10-10-0",
      title: "Grandchild 10",
    },
    { id: "level-4", code: "1-10-10-1", title: "Level 4" },
    { id: "level-5", code: "1-10-10-1-1", title: "Level 5" },
    { id: "numeric-title", code: "1000", title: "2026" },
    { id: "root-1", code: "1000", title: "A" },
    { id: "root-2", code: "2000", title: "Execution" },
    { id: "same-code-title", code: "1000", title: "A" },
  ]);

  const papers = await database.query(
    `SELECT "id", "code", "title"
     FROM "working_papers"
     ORDER BY "id"`
  );
  assert.deepEqual(papers.rows, [
    { id: "paper-1", code: "1100.2", title: "First file" },
    { id: "paper-2", code: "1100.1", title: "Second file" },
    { id: "paper-temp", code: "TEMP-F001", title: "Temporary file" },
  ]);

  const attachments = await database.query(
    `SELECT
       "id",
       "code",
       "deleted_from_working_paper_code"
     FROM "attachments"
     ORDER BY "id"`
  );
  assert.deepEqual(attachments.rows, [
    {
      id: "attachment-1",
      code: "1100.2",
      deleted_from_working_paper_code: null,
    },
    {
      id: "attachment-2",
      code: "CUSTOM-REF",
      deleted_from_working_paper_code: null,
    },
    {
      id: "deleted-manual-orphan",
      code: "CUSTOM-DELETED",
      deleted_from_working_paper_code: "1100.4",
    },
    {
      id: "deleted-orphan",
      code: "1100.3",
      deleted_from_working_paper_code: "1100.3",
    },
    {
      id: "deleted-with-paper",
      code: "1100.2",
      deleted_from_working_paper_code: "1100.2",
    },
  ]);

  const templateNodes = await database.query(
    `SELECT "id", "code", "title"
     FROM "project_template_nodes"
     ORDER BY "id"`
  );
  assert.deepEqual(templateNodes.rows, [
    { id: "template-child", code: "1100", title: "Assets" },
    {
      id: "template-numeric-title",
      code: "2000",
      title: "2026",
    },
    { id: "template-root", code: "1000", title: "Planning" },
  ]);

  const templateItems = await database.query(
    `SELECT 'FILE' AS "item_type", "id", "code", "title"
       FROM "project_template_files"
     UNION ALL
     SELECT 'SMART_FORM' AS "item_type", "id", "code", "title"
       FROM "project_template_smart_forms"
     ORDER BY "item_type"`
  );
  assert.deepEqual(templateItems.rows, [
    {
      item_type: "FILE",
      id: "template-file",
      code: "1100.2",
      title: "Template file",
    },
    {
      item_type: "SMART_FORM",
      id: "template-smart-form",
      code: "1100.1",
      title: "Template form",
    },
  ]);
} finally {
  await database.close();
}
