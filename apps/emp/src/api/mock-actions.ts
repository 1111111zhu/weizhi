import type {
  ReauthorizeProjectMemberInput,
  AcceptInvitationInput,
  CreateInvitationInput,
  CreateProjectInput,
  CreateWorkflowNodeInput,
  CreateWorkingPaperInput,
  InChargeRole,
  GlobalRole,
  MoveProjectPlacementInput,
  ProjectRole,
  UpdateProjectInput,
  UpdateProjectMemberInChargeRoleInput,
  UpdateProjectMemberRoleInput,
  UpdateUserInput,
  UpdateWorkflowNodeInput,
} from "@project-wing/shared";
import {
  canGlobalRoleManageProjectMembers,
  canManageProjectLeadership,
  isProjectPermissionSubjectConsistent,
  getProjectInvitationEligibility,
  getStandardHourlyRate,
  normalizeCodeWithoutDigitFour,
} from "@project-wing/shared";

import type {
  Attachment,
  AttachmentVersion,
  Project,
  ProjectMember,
  ProjectTemplate,
  ProjectTemplateFile,
  ProjectTemplateNode,
  User,
  WorkflowNode,
  WorkingPaper,
} from "./client";
import { mockCmpEngagements } from "./mock-data";
import {
  addLog,
  clone,
  defaultProjectWorkflow,
  ensureDefaultWorkspace,
  ensureDesktopPlacements,
  findNode,
  findProject,
  getAllowedProjectRoles,
  getCurrentUser,
  loadState,
  getNextProjectNumber,
  mockError,
  updateDesktopPlacement,
  withState,
} from "./mock-store";

export function createProject(input: CreateProjectInput) {
  return withState((state) => {
    const currentUser = getCurrentUser(state);
    if (!canGlobalRoleManageProjectMembers(currentUser.globalRole)) {
      throw mockError("Current role cannot create projects", "FORBIDDEN");
    }
    const workspace = ensureDefaultWorkspace(state, currentUser);
    if (
      !input.applicableAccountingStandard?.trim() &&
      !input.frameworkTemplateId?.trim()
    ) {
      throw mockError(
        "适用准则模板不存在或已停用",
        "FRAMEWORK_TEMPLATE_NOT_FOUND"
      );
    }
    const cmpSource = resolveMockCmpProjectSource(input);
    const projectNumber = getNextProjectNumber(state);
    const projectCode = cmpSource.generateProjectCode
      ? `DUMMY-EMP-${projectNumber}`
      : cmpSource.projectCode;
    const initialMembers = new Map<string, ProjectMember>([
      [
        currentUser.id,
        createMember(
          currentUser,
          undefined,
          currentUser.globalRole === "PARTNER" ? "PARTNER_IN_CHARGE" : null
        ),
      ],
    ]);
    if (cmpSource.engagementMicUserId) {
      const micUser = state.users.find(
        (user) => user.id === cmpSource.engagementMicUserId
      );
      if (
        !micUser ||
        micUser.status !== "ACTIVE" ||
        micUser.globalRole !== "MANAGER"
      ) {
        throw mockError(
          "Select active PIC and MIC users in CMP before creating an EMS project",
          "VALIDATION_FAILED"
        );
      }
      initialMembers.set(
        micUser.id,
        createMember(micUser, "REVIEWER", "MANAGER_IN_CHARGE")
      );
    }
    if (cmpSource.engagementPicUserId) {
      const picUser = state.users.find(
        (user) => user.id === cmpSource.engagementPicUserId
      );
      if (
        !picUser ||
        picUser.status !== "ACTIVE" ||
        !["PARTNER", "PRINCIPAL"].includes(picUser.globalRole)
      ) {
        throw mockError(
          "Select active PIC and MIC users in CMP before creating an EMS project",
          "VALIDATION_FAILED"
        );
      }
      initialMembers.set(
        picUser.id,
        createMember(picUser, "PARTNER", "PARTNER_IN_CHARGE")
      );
    }
    if (
      state.workspaces.some((item) =>
        item.projects.some((project) => project.projectCode === projectCode)
      )
    ) {
      throw mockError("项目代码已存在", "DUPLICATE_PROJECT_CODE");
    }
    const rollForwardSourceId = input.rollForwardFromProjectId?.trim();
    const rollForwardSource = rollForwardSourceId
      ? findProject(state, rollForwardSourceId)
      : null;
    if (rollForwardSourceId) {
      if (!rollForwardSource || rollForwardSource.status !== "ARCHIVED") {
        throw mockError(
          "Only archived projects can be rolled forward",
          "ROLL_FORWARD_SOURCE_NOT_AVAILABLE"
        );
      }
      if (
        (currentUser.globalRole as string) !== "SUPER_ADMIN" &&
        !rollForwardSource.members?.some(
          (member) => member.user.id === currentUser.id
        )
      ) {
        throw mockError(
          "Only accessible archived projects can be rolled forward",
          "ROLL_FORWARD_SOURCE_NOT_AVAILABLE"
        );
      }
    }
    const project: Project = {
      id: `project-${Date.now()}`,
      projectNumber,
      workspaceId: workspace.id,
      name: input.name,
      projectCode,
      cmpClientId: cmpSource.cmpClientId,
      cmpEngagementId: cmpSource.cmpEngagementId,
      language: input.language,
      frameworkTemplateId: input.frameworkTemplateId || null,
      applicableAccountingStandard:
        input.applicableAccountingStandard?.trim() ||
        state.frameworkTemplates.find(
          (template) => template.id === input.frameworkTemplateId
        )?.name ||
        null,
      frameworkTemplate: state.frameworkTemplates.find(
        (template) => template.id === input.frameworkTemplateId
      ),
      reportingDate: input.reportDate,
      yearEndDate: input.yearEndDate,
      reportDate: input.reportDate,
      archiveDeadline: input.archiveDeadline,
      rolledForwardFromProjectId: rollForwardSource?.id ?? null,
      notes: input.notes,
      status: "ACTIVE",
      members: [...initialMembers.values()],
    };
    if (rollForwardSource && input.inheritMembers !== false) {
      const existingMemberIds = new Set(
        project.members?.map((member) => member.user.id)
      );
      for (const member of rollForwardSource.members ?? []) {
        if (existingMemberIds.has(member.user.id)) {
          continue;
        }
        project.members?.push(createMember(member.user, member.projectRole));
        existingMemberIds.add(member.user.id);
      }
    }
    workspace.projects.unshift(project);
    if (input.folderId) {
      updateDesktopPlacement(state, currentUser, project.id, {
        folderId: input.folderId,
        desktopX: 24,
        desktopY: 24,
      });
    } else {
      ensureDesktopPlacements(state, currentUser);
    }
    state.workflows[project.id] = rollForwardSource
      ? workflowFromRollForwardSource(
          state,
          project.id,
          state.workflows[rollForwardSource.id] ?? []
        )
      : input.projectTemplateId
        ? workflowFromProjectTemplate(
            project.id,
            findProjectTemplateForCreate(
              state.projectTemplates,
              input.projectTemplateId
            ),
            currentUser
          )
        : defaultProjectWorkflow(project.id);
    state.deletedAttachments[project.id] = [];
    state.auditLogs[project.id] = [];
    addLog(
      state,
      project.id,
      "PROJECT_CREATED",
      `创建项目 ${project.projectCode}`
    );
    if (rollForwardSource) {
      addLog(
        state,
        project.id,
        "PROJECT_ROLLED_FORWARD",
        `Rolled forward ${rollForwardSource.projectCode} into ${project.projectCode}`
      );
    }
    const seenInviteeIds = new Set<string>();
    for (const invitation of input.invitations ?? []) {
      const recipient = state.users.find(
        (user) => user.id === invitation.recipientUserId
      );
      if (!recipient) {
        throw mockError("请选择有效的收件人", "VALIDATION_FAILED");
      }
      if (recipient.id === currentUser.id) {
        throw mockError(
          "项目负责人已在项目中，无需重复邀请",
          "DUPLICATE_INVITATION"
        );
      }
      if (seenInviteeIds.has(recipient.id)) {
        throw mockError("请勿重复邀请同一成员", "DUPLICATE_INVITATION");
      }
      seenInviteeIds.add(recipient.id);
      requireInvitationEligibility(recipient, invitation.invitedRole);
      const token = `preview-token-${Date.now()}-${recipient.id}`;
      state.invitations[token] = {
        projectId: project.id,
        invitedRole: invitation.invitedRole,
        recipientEmail: recipient.email,
        expiresAt: expiresAt(invitation.expiresInDays),
        createdAt: new Date().toISOString(),
        status: "PENDING",
      };
      state.messages.unshift({
        id: `message-${Date.now()}-${recipient.id}`,
        recipientId: recipient.id,
        senderId: currentUser.id,
        projectId: project.id,
        workingPaperId: null,
        reviewQuestionId: null,
        type: "PROJECT_INVITATION",
        title: `邀请加入 ${project.name ?? project.projectCode}`,
        body: `${currentUser.name} 邀请你加入项目组。`,
        actionUrl: `/invitations/${token}`,
        readAt: null,
        createdAt: new Date().toISOString(),
        sender: currentUser,
        project: {
          id: project.id,
          projectCode: project.projectCode,
          name: project.name ?? project.projectCode,
        },
        workingPaper: null,
        reviewQuestion: null,
        projectInvitation: {
          id: `invite-${Date.now()}-${recipient.id}`,
          status: "PENDING",
          invitedRole: invitation.invitedRole,
          expiresAt: expiresAt(invitation.expiresInDays),
          project: {
            id: project.id,
            projectCode: project.projectCode,
            name: project.name ?? project.projectCode,
          },
        },
      });
      addLog(state, project.id, "INVITATION_CREATED", "生成项目邀请链接");
    }
    return project;
  });
}

function resolveMockCmpProjectSource(input: CreateProjectInput): {
  projectCode: string;
  generateProjectCode?: boolean;
  cmpClientId?: string | null;
  cmpEngagementId?: string | null;
  engagementPicUserId?: string | null;
  engagementMicUserId?: string | null;
} {
  const cmpEngagementId = input.cmpEngagementId?.trim();
  if (!cmpEngagementId) {
    const projectCode = input.projectCode?.trim();
    if (!projectCode) {
      return { projectCode: "", generateProjectCode: true };
    }
    return { projectCode };
  }
  const engagement = mockCmpEngagements.find(
    (item) =>
      item.id === cmpEngagementId &&
      item.clientId === input.cmpClientId &&
      item.status === "ACTIVE"
  );
  if (!engagement) {
    throw mockError(
      "Only active CMP engagements under an active client can create EMS projects",
      "CMP_ENGAGEMENT_NOT_AVAILABLE"
    );
  }
  if (!engagement.picUserId || !engagement.micUserId) {
    throw mockError(
      "Select active PIC and MIC users in CMP before creating an EMS project",
      "VALIDATION_FAILED"
    );
  }
  const projectPicUserId =
    input.projectPicUserId?.trim() || engagement.picUserId;
  return {
    projectCode: input.projectCode?.trim() || "",
    generateProjectCode: !input.projectCode?.trim(),
    cmpClientId: engagement.clientId,
    cmpEngagementId: engagement.id,
    engagementPicUserId: projectPicUserId,
    engagementMicUserId: engagement.micUserId,
  };
}

export function createInvitation(
  projectId: string,
  input: CreateInvitationInput
) {
  return writeMockInvitation(projectId, input);
}

export function createPicRecoveryInvitation(
  projectId: string,
  input: { recipientUserId: string; reason: string }
) {
  return writeMockInvitation(
    projectId,
    {
      recipientUserId: input.recipientUserId,
      invitedRole: "PARTNER",
      expiresInDays: 7,
    },
    input.reason
  );
}

function writeMockInvitation(
  projectId: string,
  input: CreateInvitationInput,
  recoveryReason?: string
) {
  return withState((state) => {
    const project = findProject(state, projectId);
    if (!project) {
      throw mockError("项目不存在");
    }
    const recipient = state.users.find(
      (user) =>
        user.id === input.recipientUserId || user.email === input.recipientEmail
    );
    if (recoveryReason !== undefined) {
      if (
        getCurrentUser(state).globalRole !== "SUPER_ADMIN" ||
        project.status === "DELETED" ||
        !recoveryReason.trim()
      ) {
        throw mockError("当前不能发起恢复邀请");
      }
      if (
        (project.members ?? []).some(
          (member) =>
            member.membershipStatus !== "INVITED" &&
            member.user.status !== "DISABLED" &&
            ["PARTNER", "PRINCIPAL"].includes(member.user.globalRole)
        )
      ) {
        throw mockError("请从已加入的合资格成员中恢复 PIC");
      }
      if (
        !recipient ||
        recipient.status !== "ACTIVE" ||
        !["PARTNER", "PRINCIPAL"].includes(recipient.globalRole)
      ) {
        throw mockError("请选择有效的 Partner 或 Principal");
      }
    }
    if (input.recipientUserId && !recipient) {
      throw mockError("请选择有效的收件人", "VALIDATION_FAILED");
    }
    if (recipient) {
      requireInvitationEligibility(recipient, input.invitedRole);
    }
    if (
      recipient &&
      Object.values(state.invitations).some(
        (invitation) =>
          invitation.projectId === projectId &&
          (invitation.status ?? "PENDING") === "PENDING" &&
          (!invitation.expiresAt ||
            new Date(invitation.expiresAt).getTime() > Date.now()) &&
          invitation.recipientEmail?.toLowerCase() ===
            recipient.email.toLowerCase()
      )
    ) {
      throw mockError(
        "该用户已有待处理邀请，请勿重复邀请",
        "VALIDATION_FAILED"
      );
    }
    const token = `preview-token-${Date.now()}`;
    const inviteUrl = buildInviteUrl(token);
    state.invitations[token] = {
      projectId,
      invitedRole: input.invitedRole,
      recipientEmail: recipient?.email ?? input.recipientEmail,
      expiresAt: expiresAt(input.expiresInDays),
      createdAt: new Date().toISOString(),
      status: "PENDING",
    };
    if (recipient) {
      state.messages.unshift({
        id: `message-${Date.now()}`,
        recipientId: recipient.id,
        senderId: getCurrentUser(state).id,
        projectId,
        workingPaperId: null,
        reviewQuestionId: null,
        type: "PROJECT_INVITATION",
        title: `邀请加入 ${project.name ?? project.projectCode}`,
        body: `${getCurrentUser(state).name} 邀请你加入项目组。`,
        actionUrl: `/invitations/${token}`,
        readAt: null,
        createdAt: new Date().toISOString(),
        sender: getCurrentUser(state),
        project: {
          id: project.id,
          projectCode: project.projectCode,
          name: project.name ?? project.projectCode,
        },
        workingPaper: null,
        reviewQuestion: null,
        projectInvitation: {
          id: `invite-${Date.now()}`,
          status: "PENDING",
          invitedRole: input.invitedRole,
          expiresAt: expiresAt(input.expiresInDays),
          project: {
            id: project.id,
            projectCode: project.projectCode,
            name: project.name ?? project.projectCode,
          },
        },
      });
    }
    addLog(
      state,
      projectId,
      recoveryReason === undefined
        ? "INVITATION_CREATED"
        : "PROJECT_PIC_RECOVERY_INVITATION_CREATED",
      recoveryReason ?? "生成项目邀请链接"
    );
    return {
      inviteUrl,
      invitedRole: input.invitedRole,
      expiresAt: expiresAt(input.expiresInDays),
      delivery: recipient
        ? {
            recipientEmail: recipient.email,
            delivered: true,
            message: "已投递到演示通知",
          }
        : null,
    };
  });
}

export function updateProjectMemberRole(
  projectId: string,
  memberId: string,
  input: UpdateProjectMemberRoleInput
) {
  return withState((state) => {
    const member = findProject(state, projectId)?.members?.find(
      (item) => item.id === memberId
    );
    if (!member) {
      throw mockError("成员不存在");
    }
    if (member.inChargeRole) {
      throw mockError("请先由 PIC 取消该成员的负责人身份");
    }
    member.projectRole = input.projectRole;
    member.roleConsistent = member.allowedProjectRoles.includes(
      input.projectRole
    );
    member.roleConflictReason = member.roleConsistent
      ? null
      : "该项目职责与账号职级不匹配，请复核。";
    addLog(
      state,
      projectId,
      "MEMBER_ROLE_UPDATED",
      `调整 ${member.user.name} 的项目职责`
    );
    return member;
  });
}

export function updateProjectMemberInChargeRole(
  projectId: string,
  memberId: string,
  input: UpdateProjectMemberInChargeRoleInput
) {
  return withState((state) =>
    changeMockLeadership(state, projectId, memberId, input.inChargeRole)
  );
}

export function recoverProjectPic(
  projectId: string,
  memberId: string,
  input: { reason: string }
) {
  return withState((state) =>
    changeMockLeadership(
      state,
      projectId,
      memberId,
      "PARTNER_IN_CHARGE",
      input.reason
    )
  );
}

export function reauthorizeProjectMember(
  projectId: string,
  memberId: string,
  input: ReauthorizeProjectMemberInput
) {
  return withState((state) => {
    const project = findProject(state, projectId);
    const user = getCurrentUser(state);
    if (!project || project.status === "DELETED") {
      throw mockError("项目不可用");
    }
    const actor = project.members?.find((member) => member.user.id === user.id);
    if (
      !actor ||
      !canManageProjectLeadership({
        globalRole: user.globalRole,
        projectRole: actor.projectRole,
        inChargeRole: actor.inChargeRole,
        authorizationSuspended: Boolean(actor.authorizationSuspendedAt),
      })
    ) {
      throw mockError("只有有效 PIC 可以重新授权");
    }
    const member = project.members?.find(
      (candidate) => candidate.id === memberId
    );
    if (
      !member ||
      member.user.id === user.id ||
      member.user.status === "DISABLED" ||
      !input.reason.trim() ||
      !isProjectPermissionSubjectConsistent({
        globalRole: member.user.globalRole,
        projectRole: input.projectRole,
        inChargeRole: null,
      })
    ) {
      throw mockError("重新授权信息无效");
    }
    if (
      isProjectPermissionSubjectConsistent({
        globalRole: member.user.globalRole,
        projectRole: member.projectRole,
        inChargeRole: member.inChargeRole,
        authorizationSuspended: Boolean(member.authorizationSuspendedAt),
      })
    ) {
      throw mockError("授权仍然有效");
    }
    member.projectRole = input.projectRole;
    member.inChargeRole = null;
    member.authorizationSuspendedAt = null;
    member.roleConsistent = true;
    member.roleConflictReason = null;
    addLog(
      state,
      projectId,
      "PROJECT_AUTHORIZATION_RESTORED",
      `${member.user.name}: ${input.reason}`
    );
    return member;
  });
}

function changeMockLeadership(
  state: Parameters<typeof findProject>[0],
  projectId: string,
  memberId: string,
  leadership: InChargeRole | null,
  reason?: string
) {
  const user = getCurrentUser(state);
  const project = findProject(state, projectId);
  if (
    !user ||
    !project ||
    user.status === "DISABLED" ||
    project.status !== "ACTIVE"
  ) {
    throw mockError("Project leadership is unavailable");
  }
  const members = (project.members ?? []).filter(
    (member) => member.membershipStatus !== "INVITED"
  );
  const subject = (member: ProjectMember) => ({
    authorizationSuspended: Boolean(member.authorizationSuspendedAt),
    globalRole: member.user.globalRole,
    projectRole: member.projectRole,
    inChargeRole: member.inChargeRole,
  });
  const pics = members.filter(
    (member) =>
      member.user.status !== "DISABLED" &&
      canManageProjectLeadership(subject(member))
  );
  const recovery = reason !== undefined;
  if (
    recovery
      ? user.globalRole !== "SUPER_ADMIN" || pics.length > 0 || !reason.trim()
      : !pics.some((member) => member.user.id === user.id)
  ) {
    throw mockError(
      "Only the effective PIC may manage leadership; recovery requires an administrator and no effective PIC"
    );
  }
  const target = members.find((member) => member.id === memberId);
  if (!target) {
    throw mockError("Member not found");
  }
  const projectRole = leadership
    ? leadership === "PARTNER_IN_CHARGE"
      ? "PARTNER"
      : "REVIEWER"
    : target.projectRole;
  if (
    leadership &&
    (target.user.id === user.id ||
      target.user.status === "DISABLED" ||
      !isProjectPermissionSubjectConsistent({
        ...subject(target),
        authorizationSuspended: false,
        projectRole,
        inChargeRole: leadership,
      }))
  ) {
    throw mockError("Member cannot hold this leadership role");
  }
  if (
    leadership !== "PARTNER_IN_CHARGE" &&
    pics.length === 1 &&
    pics[0].id === target.id
  ) {
    throw mockError("Assign another PIC first");
  }
  target.inChargeRole = leadership;
  if (leadership) {
    target.authorizationSuspendedAt = null;
  }
  target.projectRole = projectRole;
  addLog(
    state,
    projectId,
    recovery ? "PROJECT_PIC_RECOVERED" : "PROJECT_MEMBER_IN_CHARGE_UPDATED",
    `${target.user.name}: ${leadership ?? "none"}${recovery ? `: ${reason}` : ""}`
  );
  return target;
}

export function acceptInvitation(
  token: string,
  _unused_input: AcceptInvitationInput
) {
  return withState((state) => {
    const invitation = state.invitations[token];
    if (!invitation) {
      throw mockError("邀请链接不存在或已过期");
    }
    const project = findProject(state, invitation.projectId);
    if (!project) {
      throw mockError("项目不存在");
    }
    const user = getCurrentUser(state);
    if (
      invitation.recipientEmail &&
      invitation.recipientEmail.toLowerCase() !== user.email.toLowerCase()
    ) {
      throw mockError(
        "此邀请只允许指定邮箱账号接受",
        "INVITATION_RECIPIENT_MISMATCH"
      );
    }
    requireInvitationEligibility(user, invitation.invitedRole);
    const members = project.members?.some(
      (member) => member.user.id === user.id
    )
      ? project.members
      : [
          ...(project.members ?? []),
          createMember(user, invitation.invitedRole),
        ];
    syncProjectMembers(state, project.id, members);
    invitation.status = "USED";
    state.messages
      .filter((message) => message.actionUrl === `/invitations/${token}`)
      .forEach((message) => {
        message.readAt ??= new Date().toISOString();
      });
    addLog(
      state,
      project.id,
      "INVITATION_ACCEPTED",
      `${user.name} 接受项目邀请`
    );
    return { projectId: project.id };
  });
}

export function moveProjectPlacement(
  projectId: string,
  input: MoveProjectPlacementInput
) {
  return withState((state) => {
    const user = getCurrentUser(state);
    if (!input.folderId) {
      throw mockError("请选择文件夹");
    }
    const project = findProject(state, projectId);
    if (!project) {
      throw mockError("项目不存在");
    }
    if (!project.members?.some((member) => member.user.id === user.id)) {
      throw mockError("你不是该项目成员");
    }
    updateDesktopPlacement(state, user, projectId, {
      folderId: input.folderId,
    });
    addLog(state, projectId, "PROJECT_PLACEMENT_MOVED", "移动项目到文件夹");
    return project;
  });
}

export function updateProject(projectId: string, input: UpdateProjectInput) {
  return withState((state) => {
    const currentUser = getCurrentUser(state);
    const project = findProject(state, projectId);
    if (!project) {
      throw mockError("椤圭洰涓嶅瓨鍦?");
    }
    const isPartner = project.members?.some(
      (member) =>
        member.user.id === currentUser.id && member.projectRole === "PARTNER"
    );
    if (!isPartner && currentUser.globalRole !== "SUPER_ADMIN") {
      throw mockError("浣犳病鏈夋潈闄愪慨鏀归」鐩熀鏈俊鎭?", "FORBIDDEN");
    }
    const duplicateProject = state.workspaces
      .flatMap((workspace) => workspace.projects)
      .find(
        (item) =>
          item.id !== projectId && item.projectCode === input.projectCode.trim()
      );
    if (duplicateProject) {
      throw mockError("椤圭洰浠ｇ爜宸插瓨鍦?", "DUPLICATE_PROJECT_CODE");
    }

    Object.assign(project, {
      name: input.name,
      projectCode: input.projectCode.trim(),
      reportingDate: input.reportDate,
      yearEndDate: input.yearEndDate,
      reportDate: input.reportDate,
      archiveDeadline: input.archiveDeadline,
      notes: input.notes,
    });

    addLog(
      state,
      projectId,
      "PROJECT_UPDATED",
      `鏇存柊椤圭洰鍩烘湰淇℃伅 ${input.projectCode.trim()}`
    );
    const updated = findProject(state, projectId);
    if (!updated) {
      throw mockError("椤圭洰涓嶅瓨鍦?");
    }
    return updated;
  });
}

export function createWorkflowNode(
  projectId: string,
  input: CreateWorkflowNodeInput
) {
  return withState((state) => {
    const workflow = state.workflows[projectId] ?? [];
    const parentIdInput = input.parentId?.trim() || null;
    const isRoot = !parentIdInput;
    let level: number;
    let parentId: string | null;

    if (isRoot) {
      level = 1;
      parentId = null;
    } else {
      const parent = findNode(workflow, parentIdInput);
      if (!parent) {
        throw mockError("父级组或阶段不存在");
      }
      level = parent.level + 1;
      parentId = parent.id;
    }

    const code = normalizeCodeWithoutDigitFour(input.code.trim());
    const title = getDisplayTitleFromCode(code, input.title);
    const node: WorkflowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      parentId,
      code,
      title,
      level,
      nodeType:
        level === 1 ? "PHASE" : level === 2 ? "ACCOUNT" : "WORKING_PAPER",
      workingPapers: [],
      children: [],
    };

    if (isRoot) {
      state.workflows[projectId] = [...workflow, node];
    } else {
      const parent = findNode(workflow, parentIdInput);
      if (!parent) {
        throw mockError("父目录不存在");
      }
      parent.children = [...(parent.children ?? []), node];
    }
    addLog(
      state,
      projectId,
      "WORKFLOW_NODE_CREATED",
      `新增${getWorkflowNodeLevelLabel(node.level)} ${node.code} ${node.title}`
    );
    return node;
  });
}

export function updateWorkflowNode(
  projectId: string,
  nodeId: string,
  input: UpdateWorkflowNodeInput
) {
  return withState((state) => {
    const workflow = state.workflows[projectId] ?? [];
    const node = findNode(workflow, nodeId);
    if (!node) {
      throw mockError("组或底稿不存在");
    }
    const isRelocation = "parentId" in input || Boolean(input.insert);

    if (input.code !== undefined && input.title !== undefined) {
      const code = normalizeCodeWithoutDigitFour(input.code.trim());
      node.code = code;
      node.title =
        input.title.trim() === input.code.trim() ? code : input.title;
    }

    if (isRelocation) {
      const requestedParentId =
        "parentId" in input ? input.parentId?.trim() || null : undefined;
      const insertTarget = input.insert
        ? findNode(workflow, input.insert.targetNodeId)
        : null;
      if (input.insert && !insertTarget) {
        throw mockError("插入位置不存在");
      }
      const parentId =
        requestedParentId === undefined
          ? (insertTarget?.parentId ?? null)
          : requestedParentId;
      const targetParent = parentId ? findNode(workflow, parentId) : null;
      if (parentId && !targetParent) {
        throw mockError("目标目录不存在");
      }
      if (targetParent && containsWorkflowNode(node, targetParent.id)) {
        throw mockError("不能移动到自身或下级目录");
      }
      if (
        input.insert &&
        (insertTarget?.parentId ?? null) !== (parentId ?? null)
      ) {
        throw mockError("插入位置必须在目标目录下");
      }
      const removed = removeWorkflowNode(workflow, nodeId);
      if (!removed) {
        throw mockError("组或底稿不存在");
      }
      let siblings = workflow;
      if (parentId) {
        if (!targetParent) {
          throw mockError("目标目录不存在");
        }
        if (!targetParent.children) {
          targetParent.children = [];
        }
        siblings = targetParent.children;
      }
      const targetIndex =
        input.insert && insertTarget
          ? siblings.findIndex((item) => item.id === insertTarget.id)
          : -1;
      const insertIndex =
        targetIndex < 0
          ? siblings.length
          : input.insert?.placement === "BEFORE"
            ? targetIndex
            : targetIndex + 1;
      removed.parentId = parentId;
      updateWorkflowNodeLevels(
        removed,
        targetParent ? targetParent.level + 1 : 1
      );
      siblings.splice(insertIndex, 0, removed);
      siblings.forEach((item, index) => {
        (item as WorkflowNode & { sortOrder?: number }).sortOrder = index + 1;
      });
    }

    addLog(
      state,
      projectId,
      "WORKFLOW_NODE_UPDATED",
      input.code === undefined
        ? `移动${getWorkflowNodeLevelLabel(node.level)} ${node.code}`
        : `重命名${getWorkflowNodeLevelLabel(node.level)} ${node.code}`
    );
    return node;
  });
}

function removeWorkflowNode(
  nodes: WorkflowNode[],
  nodeId: string
): WorkflowNode | null {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index !== -1) {
    return nodes.splice(index, 1)[0] ?? null;
  }
  for (const node of nodes) {
    const removed = removeWorkflowNode(node.children ?? [], nodeId);
    if (removed) {
      return removed;
    }
  }
  return null;
}

function containsWorkflowNode(root: WorkflowNode, nodeId: string): boolean {
  if (root.id === nodeId) {
    return true;
  }
  return (root.children ?? []).some((child) =>
    containsWorkflowNode(child, nodeId)
  );
}

function updateWorkflowNodeLevels(node: WorkflowNode, level: number) {
  node.level = level;
  node.nodeType =
    level === 1 ? "PHASE" : level === 2 ? "ACCOUNT" : "WORKING_PAPER";
  for (const child of node.children ?? []) {
    child.parentId = node.id;
    updateWorkflowNodeLevels(child, level + 1);
  }
}

export function createWorkingPaper(
  projectId: string,
  input: CreateWorkingPaperInput
) {
  return withState((state) => {
    const node = findNode(
      state.workflows[projectId] ?? [],
      input.workflowNodeId
    );
    if (!node) {
      throw mockError("目标底稿不存在");
    }
    const code = normalizeCodeWithoutDigitFour(input.code.trim());
    const title = getDisplayTitleFromCode(code, input.title);
    const paper: WorkingPaper = {
      id: `paper-${Date.now()}`,
      projectId,
      workflowNodeId: node.id,
      code,
      title,
      paperType: input.paperType,
      bucket: input.bucket,
      preparerId: null,
      reviewerId: null,
      preparedAt: null,
      reviewedAt: null,
      returnedAt: null,
      reviewNote: null,
      preparer: null,
      reviewer: null,
      attachments: [],
    };
    node.workingPapers = [...(node.workingPapers ?? []), paper];
    addLog(state, projectId, "WORKING_PAPER_CREATED", `新增底稿 ${paper.code}`);
    return paper;
  });
}

export async function userRoleImpact(id: string, globalRole: GlobalRole) {
  const state = loadState();
  const currentGrade = state.users.find((user) => user.id === id)?.globalRole;
  const projects = state.workspaces
    .flatMap((workspace) => workspace.projects)
    .flatMap((project) =>
      (project.members ?? [])
        .filter(
          (member) =>
            member.user.id === id &&
            !member.authorizationSuspendedAt &&
            (!isProjectPermissionSubjectConsistent({
              globalRole,
              projectRole: member.projectRole,
              inChargeRole: member.inChargeRole,
            }) ||
              (currentGrade &&
                !isProjectPermissionSubjectConsistent({
                  globalRole: currentGrade,
                  projectRole: member.projectRole,
                  inChargeRole: member.inChargeRole,
                })))
        )
        .map((member) => ({
          memberId: member.id,
          projectId: project.id,
          projectCode: project.projectCode,
          projectName: project.name ?? project.projectCode,
        }))
    )
    .sort((a, b) => a.memberId.localeCompare(b.memberId));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify([currentGrade, globalRole, projects])
    )
  );
  return {
    projects,
    token: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join(""),
  };
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const impact = input.globalRole
    ? await userRoleImpact(id, input.globalRole)
    : null;
  if (
    impact?.projects.length &&
    input.projectAuthorizationImpactToken !== impact.token
  ) {
    throw mockError("请确认项目授权影响");
  }
  return withState((state) => {
    const user = state.users.find((item) => item.id === id);
    if (!user) {
      throw mockError("用户不存在");
    }
    if (user.globalRole === "SUPER_ADMIN" && user.status !== "DISABLED") {
      const wouldRemoveActiveSuperAdmin =
        input.status === "DISABLED" ||
        (input.globalRole !== undefined && input.globalRole !== "SUPER_ADMIN");
      const activeSuperAdmins = state.users.filter(
        (item) =>
          item.globalRole === "SUPER_ADMIN" && item.status !== "DISABLED"
      );
      if (wouldRemoveActiveSuperAdmin && activeSuperAdmins.length <= 1) {
        throw mockError("至少保留一个启用的超级管理员", "LAST_SUPER_ADMIN");
      }
    }
    if (input.globalRole) {
      user.globalRole = input.globalRole;
      const standardRate = getStandardHourlyRate(input.globalRole);
      if (standardRate !== undefined) {
        user.hourlyRate = standardRate.toFixed(2);
      }
    }
    if (input.status) {
      user.status = input.status;
    }
    for (const project of state.workspaces.flatMap(
      (workspace) => workspace.projects
    )) {
      for (const member of project.members ?? []) {
        if (member.user.id !== id) {
          continue;
        }
        member.user = {
          ...member.user,
          globalRole: user.globalRole,
          status: user.status,
        };
        if (
          impact?.projects.some((affected) => affected.memberId === member.id)
        ) {
          member.authorizationSuspendedAt = new Date().toISOString();
        }
        member.roleConsistent = isProjectPermissionSubjectConsistent({
          globalRole: user.globalRole,
          projectRole: member.projectRole,
          inChargeRole: member.inChargeRole,
          authorizationSuspended: Boolean(member.authorizationSuspendedAt),
        });
      }
    }
    return user;
  });
}

function createMember(
  user: User,
  projectRole?: ProjectRole,
  inChargeRole?: InChargeRole | null
): ProjectMember {
  const allowedProjectRoles = getAllowedProjectRoles(user.globalRole);
  const resolvedProjectRole =
    projectRole ??
    (user.globalRole === "PARTNER"
      ? "PARTNER"
      : user.globalRole === "EQCR"
        ? "EQCR"
        : user.globalRole === "TAX_EXPERT"
          ? "TAX_REVIEWER"
          : "PREPARER");
  return {
    id: `member-${Date.now()}`,
    projectRole: resolvedProjectRole,
    inChargeRole: inChargeRole ?? null,
    allowedProjectRoles,
    roleConsistent: allowedProjectRoles.includes(resolvedProjectRole),
    declarationAccepted: false,
    declarationAcceptedAt: null,
    user,
  };
}

function findProjectTemplateForCreate(
  templates: ProjectTemplate[],
  templateId: string
) {
  const template = templates.find(
    (item) => item.id === templateId && item.status === "PUBLISHED"
  );
  if (!template) {
    throw mockError("Project template not found");
  }
  return template;
}

function workflowFromRollForwardSource(
  state: Parameters<typeof findProject>[0],
  targetProjectId: string,
  sourceNodes: WorkflowNode[]
): WorkflowNode[] {
  let sequence = 0;
  const makeId = (prefix: string) => {
    sequence += 1;
    return `${prefix}-${targetProjectId}-${Date.now()}-${sequence}`;
  };
  const cloneNodes = (
    nodes: WorkflowNode[],
    parentId: string | null = null
  ): WorkflowNode[] =>
    nodes.map((node) => {
      const nodeId = makeId("node");
      const workingPapers = (node.workingPapers ?? []).map((paper) => {
        const paperId = makeId("paper");
        const attachments = (paper.attachments ?? [])
          .filter((attachment) => !attachment.deletedAt)
          .map((attachment) => {
            const attachmentId = makeId("attachment");
            const sourceVersions =
              state.attachmentVersions[attachment.id] ??
              buildFallbackAttachmentVersions(attachment);
            const versionIdBySourceId = new Map<string, string>();
            const versions = sourceVersions.map((version) => {
              const versionId = makeId("version");
              versionIdBySourceId.set(version.id, versionId);
              return {
                ...clone(version),
                id: versionId,
                attachmentId,
                projectId: targetProjectId,
                parentVersionId: version.parentVersionId
                  ? (versionIdBySourceId.get(version.parentVersionId) ?? null)
                  : null,
                sourceVersionId: null,
                fileUrl: `${version.fileUrl}?rollForward=${targetProjectId}`,
              };
            });
            state.attachmentVersions[attachmentId] = versions;
            const headVersion =
              versions.find((version) => version.isCurrent) ??
              versions.at(-1) ??
              null;
            return {
              ...clone(attachment),
              id: attachmentId,
              workingPaperId: paperId,
              workflowNodeId: nodeId,
              bucket: "PRIOR" as const,
              preparerId: null,
              reviewerId: null,
              preparedAt: null,
              reviewedAt: null,
              returnedAt: null,
              reviewNote: null,
              lockedBy: null,
              lockedAt: null,
              lockExpiresAt: null,
              lockSessionId: null,
              lockHeartbeatAt: null,
              lockStaleAt: null,
              lockRevokedAt: null,
              lockRevokedBy: null,
              lockReleaseReason: null,
              signoffs: [],
              reviewQuestions: [],
              headVersionId: headVersion?.id ?? null,
              fileUrl: headVersion?.fileUrl ?? attachment.fileUrl,
            };
          });
        return {
          ...clone(paper),
          id: paperId,
          projectId: targetProjectId,
          workflowNodeId: nodeId,
          bucket: "PRIOR" as const,
          preparerId: null,
          reviewerId: null,
          preparedAt: null,
          reviewedAt: null,
          returnedAt: null,
          reviewNote: null,
          preparer: null,
          reviewer: null,
          signoffs: [],
          reviewQuestions: [],
          attachments,
        };
      });
      return {
        ...clone(node),
        id: nodeId,
        parentId,
        workingPapers,
        children: cloneNodes(node.children ?? [], nodeId),
      };
    });

  return cloneNodes(sourceNodes);
}

function buildFallbackAttachmentVersions(
  attachment: Attachment
): AttachmentVersion[] {
  const uploadedAt =
    attachment.lastModifiedAt ??
    attachment.createdAt ??
    new Date().toISOString();
  return [
    {
      id: attachment.headVersionId ?? `version-${attachment.id}`,
      attachmentId: attachment.id,
      projectId: "",
      version: attachment.version,
      parentVersionId: null,
      sourceVersionId: null,
      fileKind: attachment.fileKind,
      fileName: attachment.fileName,
      originalName: attachment.originalName,
      fileUrl: attachment.fileUrl,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      workDate: attachment.workDate,
      uploadedBy: attachment.uploadedBy,
      uploadedAt,
      archivedBy: attachment.uploadedBy ?? "user-partner",
      action: "INITIAL",
      message: null,
      isCurrent: true,
      createdAt: uploadedAt,
    },
  ];
}

function workflowFromProjectTemplate(
  projectId: string,
  template: ProjectTemplate,
  user: User
): WorkflowNode[] {
  const templateNodes = template.nodes ?? [];
  const rootNodes = templateNodes.filter((node) => !node.parentId);
  const shouldRestoreSmeRootTitles = hasSmeRootFolderSet(rootNodes);
  const siblingIndexByNodeId = getProjectTemplateSiblingIndexes(templateNodes);
  const rootWorkflowCodeByTemplateId = new Map<string, string>();
  if (shouldRestoreSmeRootTitles) {
    for (const node of rootNodes) {
      const rootCode = getSmeRootCode(node.code);
      if (rootCode) {
        rootWorkflowCodeByTemplateId.set(node.id, rootCode);
      }
    }
  }
  const byId = new Map<string, WorkflowNode>();
  for (const node of templateNodes) {
    const identity = getProjectTemplateWorkflowNodeIdentity(node, {
      shouldRestoreSmeRootTitles: shouldRestoreSmeRootTitles && !node.parentId,
      siblingIndex: siblingIndexByNodeId.get(node.id) ?? 1,
      smeRootParentCode: node.parentId
        ? (rootWorkflowCodeByTemplateId.get(node.parentId) ?? null)
        : null,
    });
    byId.set(node.id, {
      id: `node-${projectId}-${node.id}`,
      parentId: node.parentId ? `node-${projectId}-${node.parentId}` : null,
      level: node.level,
      code: identity.code,
      title: identity.title,
      nodeType: node.nodeType,
      workingPapers: (node.files ?? []).map((file) =>
        workingPaperFromTemplateFile(projectId, file, user)
      ),
      children: [],
    });
  }
  const roots: WorkflowNode[] = [];
  for (const templateNode of templateNodes) {
    const node = byId.get(templateNode.id);
    if (!node) {
      continue;
    }
    if (templateNode.parentId && byId.has(templateNode.parentId)) {
      const parent = byId.get(templateNode.parentId);
      if (!parent) {
        continue;
      }
      parent.children = [...(parent.children ?? []), node];
    } else {
      roots.push(node);
    }
  }
  sortWorkflowNodes(roots);
  return roots;
}

function workingPaperFromTemplateFile(
  projectId: string,
  file: ProjectTemplateFile,
  user: User
): WorkingPaper {
  const paperId = `paper-${projectId}-${file.id}`;
  const attachment = attachmentFromTemplateFile(projectId, paperId, file, user);
  return {
    id: paperId,
    projectId,
    workflowNodeId: `node-${projectId}-${file.templateNodeId}`,
    code: file.code,
    title: getProjectTemplateDisplayTitle(file),
    paperType: file.paperType,
    bucket: "CURRENT",
    preparerId: null,
    reviewerId: null,
    attachments: [attachment],
    signoffs: [],
    reviewQuestions: [],
    templateItemId: file.templateItemId ?? null,
  };
}

function attachmentFromTemplateFile(
  projectId: string,
  paperId: string,
  file: ProjectTemplateFile,
  user: User
): Attachment {
  const now = new Date().toISOString();
  return {
    id: `attachment-${projectId}-${file.id}`,
    workingPaperId: paperId,
    fileKind: "SUPPORTING",
    fileName: file.fileName,
    originalName: file.originalName ?? file.title,
    fileUrl: `mock://working-papers/${projectId}/${paperId}/${file.fileName}`,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    version: 1,
    createdAt: now,
    uploadedBy: user.id,
    lastModifiedBy: user.id,
    lastModifiedAt: now,
    uploader: { id: user.id, name: user.name, email: user.email },
    lastModifier: { id: user.id, name: user.name, email: user.email },
  };
}

function sortWorkflowNodes(nodes: WorkflowNode[]) {
  nodes.sort((left, right) => left.code.localeCompare(right.code));
  for (const node of nodes) {
    sortWorkflowNodes(node.children ?? []);
  }
}

function getProjectTemplateDisplayTitle(item: { code: string; title: string }) {
  return getDisplayTitleFromCode(item.code, item.title);
}

function getProjectTemplateWorkflowNodeIdentity(
  node: { code: string; title: string },
  input: {
    shouldRestoreSmeRootTitles: boolean;
    siblingIndex: number;
    smeRootParentCode: string | null;
  }
) {
  if (input.smeRootParentCode) {
    const code = `${input.smeRootParentCode}${formatOrdinalWithoutDigitFour(
      input.siblingIndex
    )}`;
    return {
      code,
      title: getProjectTemplateGeneratedChildTitle(node, code),
    };
  }

  if (input.shouldRestoreSmeRootTitles) {
    const rootCode = getSmeRootCode(node.code);
    if (rootCode) {
      return {
        code: rootCode,
        title:
          (SME_ROOT_CODE_BY_TITLE[node.code.trim()]
            ? SME_ROOT_TITLE_BY_CODE[rootCode]
            : getProjectTemplateNodeDisplayTitle(node, false)) ||
          SME_ROOT_TITLE_BY_CODE[rootCode],
      };
    }
  }

  return {
    code: node.code,
    title: getProjectTemplateNodeDisplayTitle(
      node,
      input.shouldRestoreSmeRootTitles
    ),
  };
}

function formatOrdinalWithoutDigitFour(index: number) {
  let value = 0;
  let remaining = index;
  while (remaining > 0) {
    value += 1;
    if (!String(value).includes("4")) {
      remaining -= 1;
    }
  }
  return String(value);
}

function getProjectTemplateNodeDisplayTitle(
  node: { code: string; title: string },
  allowSmeRootTitle: boolean
) {
  const displayTitle = getDisplayTitleFromCode(node.code, node.title);
  if (displayTitle !== node.code.trim()) {
    return displayTitle;
  }
  return allowSmeRootTitle
    ? (SME_ROOT_TITLE_BY_CODE[node.code.trim()] ?? displayTitle)
    : displayTitle;
}

function getProjectTemplateGeneratedChildTitle(
  node: { code: string; title: string },
  generatedCode: string
) {
  const title = getProjectTemplateNodeDisplayTitle(node, false);
  if (title && !isReferenceCodeText(title)) {
    return stripProjectTemplateCodePrefix(title, generatedCode) || title;
  }
  return (
    stripProjectTemplateCodePrefix(node.code.trim(), generatedCode) ||
    stripLegacyReferenceCodePrefix(node.code.trim()) ||
    title ||
    generatedCode
  );
}

function getProjectTemplateSiblingIndexes(nodes: ProjectTemplateNode[]) {
  const nodesByParentId = new Map<string, ProjectTemplateNode[]>();
  for (const node of nodes) {
    const parentKey = node.parentId ?? "";
    nodesByParentId.set(parentKey, [
      ...(nodesByParentId.get(parentKey) ?? []),
      node,
    ]);
  }
  const indexes = new Map<string, number>();
  for (const siblings of nodesByParentId.values()) {
    siblings
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .forEach((node, index) => indexes.set(node.id, index + 1));
  }
  return indexes;
}

function getDisplayTitleFromCode(code: string, title: string) {
  const titleValue = title.trim();
  const codeValue = code.trim();
  if (!titleValue || !codeValue) {
    return titleValue || codeValue;
  }
  if (isReferenceCodeText(titleValue)) {
    return codeValue;
  }
  const titleWithoutCode = stripProjectTemplateCodePrefix(
    titleValue,
    codeValue
  );
  return titleWithoutCode || codeValue;
}

function stripProjectTemplateCodePrefix(titleValue: string, code: string) {
  const codePattern = code
    .trim()
    .split(/\s*-\s*/g)
    .filter(Boolean)
    .map(escapeRegExp)
    .join(String.raw`\s*-\s*`);
  if (!codePattern) {
    return titleValue;
  }
  if (new RegExp(`^${codePattern}$`, "i").test(titleValue)) {
    return "";
  }
  const prefixMatch = titleValue.match(
    new RegExp(
      `^${codePattern}\\s*(?:-|\\u2013|\\u2014|:|\\uFF1A)\\s*(.+)$`,
      "i"
    )
  );
  if (!prefixMatch) {
    return stripLegacyReferenceCodePrefix(titleValue) ?? titleValue;
  }
  const remainingTitle = prefixMatch[1].trim();
  return stripLegacyReferenceCodePrefix(remainingTitle) ?? remainingTitle;
}

function stripLegacyReferenceCodePrefix(title: string) {
  const parts = title
    .split(LEGACY_REFERENCE_TITLE_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || !isReferenceCodeStart(parts[0])) {
    return null;
  }
  if (parts.every(isReferenceCodePart)) {
    return "";
  }
  let prefixCount = 0;
  while (
    prefixCount < parts.length - 1 &&
    isReferenceCodePart(parts[prefixCount])
  ) {
    prefixCount += 1;
  }
  return prefixCount > 0 ? parts.slice(prefixCount).join(" - ").trim() : null;
}

function isReferenceCodeStart(value: string) {
  return (
    /^[A-Za-z]$/i.test(value) ||
    /^[A-Za-z]{1,3}\d+[A-Za-z]?$/i.test(value) ||
    /^F\d{1,5}$/i.test(value)
  );
}

function isReferenceCodePart(value: string) {
  return isReferenceCodeStart(value) || /^\d{1,6}$/.test(value);
}

function isReferenceCodeText(value: string) {
  const parts = value
    .trim()
    .split(/\s*-\s*/g)
    .filter(Boolean);
  return (
    parts.length > 0 &&
    isReferenceCodeStart(parts[0]) &&
    parts.every(isReferenceCodePart)
  );
}

const LEGACY_REFERENCE_TITLE_SEPARATOR =
  /\s*(?:[:\uFF1A]|[\u2013\u2014]+|-)\s*/g;
const SME_ROOT_CODES = ["A", "B", "C", "D", "E", "F", "G"];
const SME_ROOT_TITLE_BY_CODE: Record<string, string> = {
  A: "Planning",
  B: "General Procedures",
  C: "Execution",
  D: "Reporting",
  E: "Completion",
  F: "Continued Connected Transactions (CCT)",
  G: "Other Audit Programmes",
};
const SME_ROOT_CODE_BY_TITLE = Object.fromEntries(
  Object.entries(SME_ROOT_TITLE_BY_CODE).map(([code, title]) => [title, code])
) as Record<string, string>;

function hasSmeRootFolderSet(nodes: { code: string }[]) {
  const codes = new Set(
    nodes.map((node) => getSmeRootCode(node.code)).filter(Boolean)
  );
  return SME_ROOT_CODES.every((code) => codes.has(code));
}

function getSmeRootCode(value: string) {
  const code = value.trim();
  return SME_ROOT_TITLE_BY_CODE[code] ? code : SME_ROOT_CODE_BY_TITLE[code];
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function getWorkflowNodeLevelLabel(level: number) {
  if (level === 1) {
    return "phase";
  }
  if (level === 2) {
    return "group";
  }
  return "workpaper";
}

function syncProjectMembers(
  state: Parameters<typeof findProject>[0],
  projectId: string,
  members: ProjectMember[]
) {
  for (const workspace of state.workspaces) {
    for (const project of workspace.projects) {
      if (project.id === projectId) {
        project.members = members;
      }
    }
  }
}

function requireInvitationEligibility(user: User, projectRole: ProjectRole) {
  const eligibility = getProjectInvitationEligibility(user);
  if (
    !eligibility.canReceiveInvitation ||
    !eligibility.assignableProjectRoles.includes(projectRole)
  ) {
    throw mockError(
      "该账号职级不能被邀请为所选项目职责",
      "INVALID_PROJECT_ROLE"
    );
  }
}

function buildInviteUrl(token: string) {
  if (typeof window === "undefined") {
    return `/invitations/${token}`;
  }
  return `${window.location.origin}/invitations/${token}`;
}

function expiresAt(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}
