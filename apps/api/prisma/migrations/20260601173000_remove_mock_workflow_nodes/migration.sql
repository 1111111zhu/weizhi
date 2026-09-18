-- Remove the old demonstration workflow nodes. These were default scaffold data,
-- not real user-created working papers. Keep any node that already has children
-- or working paper records attached.

DELETE FROM "workflow_nodes" AS node
WHERE node."level" = 3
  AND node."code" IN ('A01-0001', 'E01-0001', 'R01-0001')
  AND NOT EXISTS (
    SELECT 1
    FROM "working_papers" AS paper
    WHERE paper."workflow_node_id" = node."id"
  );

DELETE FROM "workflow_nodes" AS node
WHERE node."level" = 2
  AND node."code" IN ('A01', 'E01', 'R01')
  AND NOT EXISTS (
    SELECT 1
    FROM "workflow_nodes" AS child
    WHERE child."parent_id" = node."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "working_papers" AS paper
    WHERE paper."workflow_node_id" = node."id"
  );
