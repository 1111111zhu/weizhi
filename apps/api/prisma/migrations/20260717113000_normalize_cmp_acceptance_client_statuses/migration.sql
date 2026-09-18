UPDATE "cmp_acceptance_requests"
SET "client_payload" = jsonb_set("client_payload", '{status}', '"INACTIVE"'::jsonb)
WHERE "type"::text IN ('CLIENT', 'CLIENT_CHANGE')
  AND "client_payload" IS NOT NULL
  AND "client_payload"->>'status' IN ('ARCHIVED', 'PROSPECT', 'LEAD', 'FILES_ARCHIVED');
