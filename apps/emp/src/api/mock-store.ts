import { getAssignableProjectRolesForGlobalRole } from "@project-wing/shared";
import type {
  ProjectRole,
  ReorderDesktopProjectPlacementsInput,
  UpdateDesktopProjectPlacementInput,
} from "@project-wing/shared";

import {
  findNextAvailableDesktopPosition,
  getDefaultIconPosition,
} from "../lib/desktop-layout";
import type {
  AuditLog,
  DesktopFolder,
  DesktopProjectPlacement,
  Project,
  User,
  WorkflowNode,
  Workspace,
} from "./client";
import { defaultWorkflow, initialState } from "./mock-data";
import type { MockState } from "./mock-types";

const CURRENT_USER_KEY = "project-wing-preview-user";
const PREVIEW_FIXTURE_VERSION_KEY = "project-wing-preview-fixture-version";
const PREVIEW_FIXTURE_VERSION = "9";
const SIDEBAR_MESSAGE_FIXTURE_PREFIX = "message-sidebar-";
const STORAGE_KEY = "project-wing-preview-state";
const MOCK_DESKTOP_BOUNDS = {
  width: 1600,
  height: 900,
  iconWidth: 132,
  iconHeight: 132,
};

export function clone<T>(value: T): T {
  return structuredClone(value) as T;
}

export function loadState(): MockState {
  if (!canUseStorage()) {
    return clone(initialState);
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const state = clone(initialState);
    saveState(state);
    return state;
  }
  const state = JSON.parse(raw) as MockState;
  state.projectTemplates ??= clone(initialState.projectTemplates);
  state.smartFormTemplates ??= clone(initialState.smartFormTemplates);
  state.deletedAttachments ??= {};
  state.attachmentVersions ??= {};
  state.attachmentContents ??= {};
  state.projectTemplateFileContents ??= {};
  const fixtureVersion = window.localStorage.getItem(
    PREVIEW_FIXTURE_VERSION_KEY
  );
  const fixturesChanged = ensureInitialPreviewFixtures(
    state,
    fixtureVersion !== PREVIEW_FIXTURE_VERSION
  );
  if (fixturesChanged) {
    saveState(state);
  }
  window.localStorage.setItem(
    PREVIEW_FIXTURE_VERSION_KEY,
    PREVIEW_FIXTURE_VERSION
  );
  return state;
}

export function saveState(state: MockState) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function withState<T>(mutator: (state: MockState) => T): Promise<T> {
  const state = loadState();
  try {
    const result = mutator(state);
    saveState(state);
    return Promise.resolve(clone(result));
  } catch (error) {
    return Promise.reject(error);
  }
}

export function getCurrentUser(state: MockState) {
  const storedUserId = canUseStorage()
    ? window.localStorage.getItem(CURRENT_USER_KEY)
    : null;
  return (
    state.users.find((user) => user.id === storedUserId) ??
    state.users.find((user) => user.email === "partner@projectwing.local") ??
    state.users[0]
  );
}

export function setCurrentUser(userId: string) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(CURRENT_USER_KEY, userId);
}

export function mockError(message: string, code = "MOCK_NOT_FOUND") {
  return Object.assign(new Error(message), {
    code,
    requestId: "preview-mock",
  });
}

function ensureInitialPreviewFixtures(
  state: MockState,
  replaceExistingFixtures: boolean
) {
  let changed = ensureSidebarMessageFixtures(state, replaceExistingFixtures);
  for (const [projectId, initialWorkflow] of Object.entries(
    initialState.workflows
  )) {
    const storedWorkflow = state.workflows[projectId];
    if (!storedWorkflow?.length || initialWorkflow.length === 0) {
      continue;
    }

    const fixturePapersByNodeId = collectPreviewFixturePapers(initialWorkflow);
    if (fixturePapersByNodeId.size === 0) {
      continue;
    }

    if (replaceExistingFixtures) {
      state.workflows[projectId] = replacePreviewFixturePapers(
        storedWorkflow,
        fixturePapersByNodeId
      );
      changed = true;
      continue;
    }
    const existingPaperIds = new Set<string>();
    collectWorkingPaperIds(storedWorkflow, existingPaperIds);
    let workflowChanged = false;
    const markWorkflowChanged = () => {
      workflowChanged = true;
    };
    const mergedWorkflow = mergeMissingPreviewFixturePapers(
      storedWorkflow,
      fixturePapersByNodeId,
      existingPaperIds,
      markWorkflowChanged
    );

    if (workflowChanged) {
      state.workflows[projectId] = mergedWorkflow;
      changed = true;
    }
  }
  return changed;
}

function ensureSidebarMessageFixtures(
  state: MockState,
  replaceExistingFixtures: boolean
) {
  const fixtures = initialState.messages.filter((message) =>
    message.id.startsWith(SIDEBAR_MESSAGE_FIXTURE_PREFIX)
  );
  if (!fixtures.length) {
    return false;
  }

  const fixtureIds = new Set(fixtures.map((message) => message.id));
  if (replaceExistingFixtures) {
    state.messages = [
      ...state.messages.filter((message) => !fixtureIds.has(message.id)),
      ...clone(fixtures),
    ];
    return true;
  }

  const existingIds = new Set(state.messages.map((message) => message.id));
  const missingFixtures = fixtures.filter(
    (message) => !existingIds.has(message.id)
  );
  if (!missingFixtures.length) {
    return false;
  }
  state.messages.push(...clone(missingFixtures));
  return true;
}

function replacePreviewFixturePapers(
  nodes: WorkflowNode[],
  fixturePapersByNodeId: Map<string, WorkflowNode["workingPapers"]>
): WorkflowNode[] {
  return nodes.map((node) => ({
    ...node,
    workingPapers: [
      ...clone(fixturePapersByNodeId.get(node.id) ?? []),
      ...(node.workingPapers ?? []).filter(
        (paper) => !paper.id.startsWith("mock-paper-")
      ),
    ],
    children: replacePreviewFixturePapers(
      node.children ?? [],
      fixturePapersByNodeId
    ),
  }));
}

function collectPreviewFixturePapers(nodes: WorkflowNode[]) {
  const papersByNodeId = new Map<string, WorkflowNode["workingPapers"]>();
  for (const node of nodes) {
    const fixturePapers = (node.workingPapers ?? []).filter((paper) =>
      paper.id.startsWith("mock-paper-")
    );
    if (fixturePapers.length > 0) {
      papersByNodeId.set(node.id, fixturePapers);
    }
    for (const [nodeId, papers] of collectPreviewFixturePapers(
      node.children ?? []
    )) {
      papersByNodeId.set(nodeId, papers);
    }
  }
  return papersByNodeId;
}

function collectWorkingPaperIds(nodes: WorkflowNode[], ids: Set<string>) {
  for (const node of nodes) {
    for (const paper of node.workingPapers ?? []) {
      ids.add(paper.id);
    }
    collectWorkingPaperIds(node.children ?? [], ids);
  }
}

function mergeMissingPreviewFixturePapers(
  nodes: WorkflowNode[],
  fixturePapersByNodeId: Map<string, WorkflowNode["workingPapers"]>,
  existingPaperIds: Set<string>,
  markChanged: () => void
): WorkflowNode[] {
  return nodes.map((node) => {
    const fixturePapers = fixturePapersByNodeId.get(node.id) ?? [];
    const missingPapers = fixturePapers.filter(
      (paper) => !existingPaperIds.has(paper.id)
    );
    if (missingPapers.length > 0) {
      markChanged();
      for (const paper of missingPapers) {
        existingPaperIds.add(paper.id);
      }
    }

    return {
      ...node,
      workingPapers: [...clone(missingPapers), ...(node.workingPapers ?? [])],
      children: mergeMissingPreviewFixturePapers(
        node.children ?? [],
        fixturePapersByNodeId,
        existingPaperIds,
        markChanged
      ),
    };
  });
}

/** @deprecated Use Desktop Folder instead */
export function findWorkspace(state: MockState, workspaceId: string) {
  return state.workspaces.find((workspace) => workspace.id === workspaceId);
}

export function findProject(state: MockState, projectId: string) {
  return state.workspaces
    .flatMap((workspace) => workspace.projects)
    .find((project) => project.id === projectId);
}

/** @deprecated Use Desktop Folder instead */
export function ensureDefaultWorkspace(
  state: MockState,
  user: User
): Workspace {
  const existing =
    state.workspaces.find(
      (workspace) =>
        workspace.ownerId === user.id && workspace.name === "My Projects"
    ) ?? state.workspaces.find((workspace) => workspace.ownerId === user.id);
  if (existing) {
    return existing;
  }
  const workspace: Workspace = {
    id: `workspace-default-${user.id}`,
    name: "My Projects",
    clientName: user.name,
    ownerId: user.id,
    description: "Personal compatibility workspace for project launcher.",
    projects: [],
  };
  state.workspaces.unshift(workspace);
  return workspace;
}

export function ensureDefaultDesktopFolder(
  state: MockState,
  userId: string
): DesktopFolder {
  const existing = state.desktopFolders.find(
    (folder) => folder.ownerId === userId && folder.isDefault
  );
  if (existing) {
    return existing;
  }
  const now = new Date().toISOString();
  const folder: DesktopFolder = {
    id: `desktop-folder-default-${userId}`,
    ownerId: userId,
    name: "Default",
    sortOrder: 0,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
  state.desktopFolders.unshift(folder);
  return folder;
}

export function listAccessibleProjects(
  state: MockState,
  user: User
): Project[] {
  const projects = state.workspaces.flatMap((workspace) => workspace.projects);
  const uniqueProjects = new Map<string, Project>();
  for (const project of projects) {
    if (project.status === "ARCHIVED" || project.status === "DELETED") {
      continue;
    }
    if (
      user.globalRole === "SUPER_ADMIN" ||
      project.members?.some((member) => member.user.id === user.id)
    ) {
      uniqueProjects.set(project.id, project);
    }
  }
  return [...uniqueProjects.values()];
}

export function ensureDesktopPlacements(
  state: MockState,
  user: User
): DesktopProjectPlacement[] {
  const folder = ensureDefaultDesktopFolder(state, user.id);
  const projects = listAccessibleProjects(state, user);
  // Clean up stale placements for archived/deleted projects
  const activeIds = new Set(projects.map((p) => p.id));
  state.desktopPlacements = state.desktopPlacements.filter(
    (placement) =>
      placement.userId !== user.id || activeIds.has(placement.projectId)
  );
  const occupied = state.desktopPlacements
    .filter(
      (placement) =>
        placement.userId === user.id && placement.folderId === folder.id
    )
    .map((placement) => ({
      x: placement.desktopX,
      y: placement.desktopY,
    }));
  for (const [index, project] of projects.entries()) {
    if (
      !state.desktopPlacements.some(
        (placement) =>
          placement.userId === user.id && placement.projectId === project.id
      )
    ) {
      const position = findNextAvailableDesktopPosition({
        bounds: MOCK_DESKTOP_BOUNDS,
        desired: getDefaultIconPosition(index),
        occupied,
      });
      const now = new Date().toISOString();
      state.desktopPlacements.push({
        id: `desktop-placement-${user.id}-${project.id}`,
        userId: user.id,
        projectId: project.id,
        folderId: folder.id,
        desktopX: position.x,
        desktopY: position.y,
        sortOrder: index,
        lastOpenedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      occupied.push(position);
    }
  }
  return desktopPlacementsWithProjects(state, user);
}

export function updateDesktopPlacement(
  state: MockState,
  user: User,
  projectId: string,
  input: UpdateDesktopProjectPlacementInput
): DesktopProjectPlacement {
  const project = listAccessibleProjects(state, user).find(
    (item) => item.id === projectId
  );
  if (!project) {
    throw mockError("Project is not available on this desktop");
  }

  const previousPlacements = state.desktopPlacements.filter(
    (placement) => placement.userId === user.id
  );
  const placements = ensureDesktopPlacements(state, user);
  const existing = state.desktopPlacements.find(
    (placement) =>
      placement.userId === user.id && placement.projectId === projectId
  );
  const fallbackFolder = ensureDefaultDesktopFolder(state, user.id);
  const folderId = input.folderId ?? existing?.folderId ?? fallbackFolder.id;
  const folder = state.desktopFolders.find(
    (item) => item.id === folderId && item.ownerId === user.id
  );
  if (!folder) {
    throw mockError("Folder not found");
  }
  const currentPlacementIds = new Set(
    state.desktopPlacements.map((placement) => placement.id)
  );
  const occupied = state.desktopPlacements
    .filter(
      (placement) =>
        placement.userId === user.id &&
        placement.projectId !== projectId &&
        placement.folderId === folder.id
    )
    .map((placement) => ({
      x: placement.desktopX,
      y: placement.desktopY,
    }));
  for (const placement of previousPlacements) {
    if (
      placement.folderId === folder.id &&
      !currentPlacementIds.has(placement.id)
    ) {
      occupied.push({ x: placement.desktopX, y: placement.desktopY });
    }
  }
  const position = findNextAvailableDesktopPosition({
    bounds: MOCK_DESKTOP_BOUNDS,
    desired: {
      x: input.desktopX ?? existing?.desktopX ?? 24,
      y: input.desktopY ?? existing?.desktopY ?? 24,
    },
    occupied,
  });
  const now = new Date().toISOString();
  const target = existing ?? {
    id: `desktop-placement-${user.id}-${projectId}`,
    userId: user.id,
    projectId,
    folderId: folder.id,
    desktopX: 0,
    desktopY: 0,
    sortOrder: placements.length,
    lastOpenedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  target.folderId = folder.id;
  target.desktopX = position.x;
  target.desktopY = position.y;
  target.sortOrder = input.sortOrder ?? target.sortOrder;
  target.lastOpenedAt = input.lastOpened ? now : target.lastOpenedAt;
  target.updatedAt = now;
  if (!existing) {
    state.desktopPlacements.push(target);
  }
  return { ...target, project };
}

export function reorderDesktopPlacements(
  state: MockState,
  user: User,
  folderId: string,
  input: ReorderDesktopProjectPlacementsInput
) {
  const folder = state.desktopFolders.find(
    (item) => item.id === folderId && item.ownerId === user.id
  );
  if (!folder) {
    throw mockError("Folder not found");
  }

  const accessibleProjectIds = new Set(
    listAccessibleProjects(state, user).map((project) => project.id)
  );
  const projectIds = input.placements.map((placement) => placement.projectId);
  const uniqueProjectIds = new Set(projectIds);
  if (uniqueProjectIds.size !== projectIds.length) {
    throw mockError("Desktop placement order contains duplicate projects");
  }
  if (projectIds.some((projectId) => !accessibleProjectIds.has(projectId))) {
    throw mockError("Project is not available on this desktop");
  }

  for (const placement of input.placements) {
    const target = state.desktopPlacements.find(
      (item) =>
        item.userId === user.id &&
        item.folderId === folder.id &&
        item.projectId === placement.projectId
    );
    if (!target) {
      throw mockError("Project is not in this desktop folder");
    }
    target.desktopX = placement.desktopX;
    target.desktopY = placement.desktopY;
    target.sortOrder = placement.sortOrder;
    target.updatedAt = new Date().toISOString();
  }

  return { count: input.placements.length };
}

export function desktopPlacementsWithProjects(
  state: MockState,
  user: User
): DesktopProjectPlacement[] {
  const projectsById = new Map(
    listAccessibleProjects(state, user).map((project) => [project.id, project])
  );
  return state.desktopPlacements
    .filter(
      (placement) =>
        placement.userId === user.id && projectsById.has(placement.projectId)
    )
    .flatMap((placement) => {
      const project = projectsById.get(placement.projectId);
      return project ? [{ ...placement, project }] : [];
    })
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.projectId.localeCompare(right.projectId)
    );
}

export function findNode(
  nodes: WorkflowNode[],
  nodeId: string
): WorkflowNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    const child = findNode(node.children ?? [], nodeId);
    if (child) {
      return child;
    }
  }
  return null;
}

export function removeNode(nodes: WorkflowNode[], nodeId: string): boolean {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index !== -1) {
    nodes.splice(index, 1);
    return true;
  }
  return nodes.some((node) => removeNode(node.children ?? [], nodeId));
}

export function addLog(
  state: MockState,
  projectId: string,
  action: string,
  description: string,
  target?: { targetType?: string; targetId?: string | null }
) {
  const actor = getCurrentUser(state);
  const log: AuditLog = {
    id: `log-${Date.now()}`,
    action,
    targetType: target?.targetType ?? inferAuditTargetType(action),
    targetId: target?.targetId ?? projectId,
    projectId,
    ipAddress: "preview",
    userAgent: "ProjectWing mock preview",
    description,
    createdAt: new Date().toISOString(),
    actor: {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      globalRole: actor.globalRole,
    },
  };
  state.auditLogs[projectId] = [log, ...(state.auditLogs[projectId] ?? [])];
}

function inferAuditTargetType(action: string) {
  if (action.includes("ATTACHMENT")) {
    return "ATTACHMENT";
  }
  if (action.includes("WORKING_PAPER")) {
    return "WORKING_PAPER";
  }
  if (action.includes("WORKFLOW_NODE")) {
    return "WORKFLOW_NODE";
  }
  if (action.includes("INVITATION")) {
    return "PROJECT_INVITATION";
  }
  if (action.includes("MEMBER")) {
    return "PROJECT_MEMBER";
  }
  if (action.includes("DECLARATION")) {
    return "INDEPENDENCE_DECLARATION";
  }
  if (action.includes("USER") || action.includes("PASSWORD")) {
    return "USER";
  }
  return "PROJECT";
}

export function getAllowedProjectRoles(
  globalRole: User["globalRole"]
): ProjectRole[] {
  return getAssignableProjectRolesForGlobalRole(globalRole);
}

export function createProjectCode(state: MockState) {
  const count = state.workspaces.reduce(
    (total, workspace) => total + workspace.projects.length,
    1
  );
  return `AUD-2026-${String(count).padStart(4, "0")}`;
}

export function getNextProjectNumber(state: MockState) {
  const currentMax = state.workspaces.reduce(
    (max, workspace) =>
      workspace.projects.reduce(
        (workspaceMax, project) =>
          Math.max(workspaceMax, project.projectNumber ?? 999_999),
        max
      ),
    999_999
  );
  return currentMax + 1;
}

export function defaultProjectWorkflow(projectId: string): WorkflowNode[] {
  return clone(defaultWorkflow).map((node) => rewriteNodeIds(node, projectId));
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function rewriteNodeIds(node: WorkflowNode, projectId: string): WorkflowNode {
  const id = `${projectId}-${node.id}`;
  return {
    ...node,
    id,
    children: node.children?.map((child) => ({
      ...rewriteNodeIds(child, projectId),
      parentId: id,
    })),
  };
}
