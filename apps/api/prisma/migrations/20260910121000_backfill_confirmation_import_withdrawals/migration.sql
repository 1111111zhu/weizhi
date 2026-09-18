INSERT INTO confirmation_follow_up_events (id, confirmation_id, event_type, actor_id, source, notes, payload, occurred_at)
SELECT 'import-withdrawal-' || i.id, i.confirmation_id, 'IMPORT_WITHDRAWN', i.withdrawn_by, 'PROJECT_TEAM_MANUAL',
'已撤回导入：' || i.source_file_name || '；目标项目：' || p.project_code || '；待归档',
jsonb_build_object('operation', 'RESPONSE_IMPORT_WITHDRAWN', 'importItemId', i.id, 'importJobId', i.job_id, 'projectId', j.project_id), i.withdrawn_at
FROM confirmation_emp_import_items i
JOIN confirmation_emp_import_jobs j ON j.id = i.job_id
JOIN projects p ON p.id = j.project_id
WHERE i.withdrawn_at IS NOT NULL AND NOT EXISTS (
SELECT 1 FROM confirmation_follow_up_events e WHERE e.confirmation_id = i.confirmation_id AND e.event_type = 'IMPORT_WITHDRAWN' AND e.payload->>'importItemId' = i.id
)
ON CONFLICT (id) DO NOTHING;
