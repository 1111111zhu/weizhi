/** @deprecated Use `/projects` instead */
export function workspacesPath() {
  return "/workspaces";
}

/** @deprecated Use `/projects/:id` instead */
export function workspacePath(workspaceId: string) {
  return `/workspaces/${workspaceId}`;
}

/** @deprecated Use `/projects/new` instead */
export function newWorkspaceProjectPath(workspaceId: string) {
  return `${workspacePath(workspaceId)}/projects/new`;
}

/** @deprecated Use `/projects/:id` instead */
export function workspaceProjectPath(workspaceId: string, projectId: string) {
  return `${workspacePath(workspaceId)}/projects/${projectId}`;
}

/** @deprecated Use `/projects/:id/members` instead */
export function workspaceMembersPath(workspaceId: string, projectId: string) {
  return `${workspaceProjectPath(workspaceId, projectId)}/members`;
}
