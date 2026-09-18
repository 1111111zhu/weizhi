INSERT INTO confirmation_follow_up_events (id, confirmation_id, event_type, actor_id, source, notes, payload, occurred_at)
SELECT 'zip-archive-' || i.id, i.confirmation_id, 'PROGRAM_COMPLETED', j.created_by, 'PROJECT_TEAM_MANUAL',
'回函已归档至 ZIP：' || COALESCE(i.zip_entry_name, i.source_file_name),
jsonb_build_object('operation','RESPONSE_ARCHIVED_TO_EMP','mode','ZIP','importJobId',j.id,'importItemId',i.id,'responseArtifactId',i.response_artifact_id,'attachmentId',i.attachment_id),
COALESCE(j.completed_at, i.created_at)
FROM confirmation_emp_import_items i JOIN confirmation_emp_import_jobs j ON j.id=i.job_id
WHERE j.mode='ZIP' AND i.status='SUCCEEDED' AND i.source_kind='RESPONSE_ARTIFACT'
AND NOT EXISTS (SELECT 1 FROM confirmation_follow_up_events e WHERE e.confirmation_id=i.confirmation_id AND e.payload->>'operation'='RESPONSE_ARCHIVED_TO_EMP' AND e.payload->>'importJobId'=j.id AND e.payload->>'responseArtifactId'=i.response_artifact_id)
ON CONFLICT (id) DO NOTHING;
