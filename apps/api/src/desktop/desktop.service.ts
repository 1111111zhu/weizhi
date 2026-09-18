import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateDesktopFolderInput,
  ReorderDesktopProjectPlacementsInput,
  UpdateDesktopFolderInput,
  UpdateDesktopProjectPlacementInput,
} from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { PROJECT_CMP_CLIENT_SELECT } from "../projects/projects.service";
import {
  defaultDesktopPosition,
  findNextAvailableDesktopPosition,
} from "./desktop-layout";

const DEFAULT_FOLDER_NAME = "Default";

type DesktopProjectForPlacement = {
  id: string;
};

@Injectable()
export class DesktopService {
  constructor(private readonly prisma: PrismaService) {}

  async getDesktop(user: RequestUser) {
    const defaultFolder = await this.ensureDefaultFolder(user.id);
    const projects = await this.prisma.project.findMany({
      where: this.accessibleProjectWhere(user),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        frameworkTemplate: true,
        members: {
          where: { status: "ACTIVE" },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    await this.ensureProjectPlacements(user.id, defaultFolder.id, projects);

    const [folders, placements] = await Promise.all([
      this.prisma.desktopFolder.findMany({
        where: { ownerId: user.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.desktopProjectPlacement.findMany({
        where: {
          userId: user.id,
          projectId: { in: projects.map((project) => project.id) },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          project: {
            include: {
              cmpClient: { select: PROJECT_CMP_CLIENT_SELECT },
              frameworkTemplate: true,
              members: {
                where: { status: "ACTIVE" },
                include: {
                  user: { select: { id: true, name: true, email: true, globalRole: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return { folders, placements };
  }

  createFolder(user: RequestUser, input: CreateDesktopFolderInput) {
    return this.prisma.desktopFolder.create({
      data: {
        ownerId: user.id,
        name: input.name,
        isDefault: false,
      },
    });
  }

  async updateFolder(
    folderId: string,
    user: RequestUser,
    input: UpdateDesktopFolderInput
  ) {
    await this.requireOwnedFolder(folderId, user.id);
    return this.prisma.desktopFolder.update({
      where: { id: folderId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.sortOrder === undefined
          ? {}
          : { sortOrder: input.sortOrder }),
      },
    });
  }

  async deleteFolder(folderId: string, user: RequestUser) {
    const folder = await this.prisma.desktopFolder.findFirst({
      where: { id: folderId, ownerId: user.id },
    });
    if (!folder) {
      throw new ApiNotFoundException("NOT_FOUND", "Folder not found");
    }
    if (folder.isDefault) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Default folder cannot be deleted"
      );
    }
    const placementCount = await this.prisma.desktopProjectPlacement.count({
      where: { userId: user.id, folderId },
    });
    if (placementCount > 0) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Folder must be empty before deletion"
      );
    }

    await this.prisma.desktopFolder.delete({ where: { id: folderId } });

    return { id: folderId };
  }

  async updateProjectPlacement(
    projectId: string,
    user: RequestUser,
    input: UpdateDesktopProjectPlacementInput
  ) {
    await this.requireAccessibleProject(projectId, user);
    if (input.folderId) {
      await this.prisma.desktopFolder.findFirstOrThrow({
        where: { id: input.folderId, ownerId: user.id },
      });
    }

    const currentPlacement =
      await this.prisma.desktopProjectPlacement.findFirst({
        where: { userId: user.id, projectId },
      });
    const defaultFolder = currentPlacement
      ? null
      : await this.ensureDefaultFolder(user.id);
    const folderId =
      input.folderId ?? currentPlacement?.folderId ?? defaultFolder?.id;
    if (!folderId) {
      throw new ApiNotFoundException("NOT_FOUND", "Folder not found");
    }

    const occupiedPlacements =
      await this.prisma.desktopProjectPlacement.findMany({
        where: {
          userId: user.id,
          folderId,
          projectId: { not: projectId },
        },
        select: { desktopX: true, desktopY: true },
      });
    const fallbackPosition = defaultDesktopPosition(occupiedPlacements.length);
    const position = findNextAvailableDesktopPosition(
      {
        desktopX:
          input.desktopX ??
          currentPlacement?.desktopX ??
          fallbackPosition.desktopX,
        desktopY:
          input.desktopY ??
          currentPlacement?.desktopY ??
          fallbackPosition.desktopY,
      },
      occupiedPlacements
    );
    const updateData = {
      folderId,
      desktopX: position.desktopX,
      desktopY: position.desktopY,
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      ...(input.lastOpened ? { lastOpenedAt: new Date() } : {}),
    };
    return this.prisma.desktopProjectPlacement.upsert({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId,
        },
      },
      update: updateData,
      create: {
        userId: user.id,
        projectId,
        folderId,
        desktopX: position.desktopX,
        desktopY: position.desktopY,
        sortOrder: input.sortOrder ?? 0,
        ...(input.lastOpened ? { lastOpenedAt: new Date() } : {}),
      },
      include: {
        project: {
          include: {
            cmpClient: { select: PROJECT_CMP_CLIENT_SELECT },
            frameworkTemplate: true,
            members: {
              where: { status: "ACTIVE" },
              include: {
                user: { select: { id: true, name: true, email: true, globalRole: true } },
              },
            },
          },
        },
      },
    });
  }

  async reorderProjectPlacements(
    folderId: string,
    user: RequestUser,
    input: ReorderDesktopProjectPlacementsInput
  ) {
    await this.requireOwnedFolder(folderId, user.id);

    const projectIds = input.placements.map((placement) => placement.projectId);
    const uniqueProjectIds = new Set(projectIds);
    if (uniqueProjectIds.size !== projectIds.length) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Desktop placement order contains duplicate projects"
      );
    }

    const [accessibleProjects, folderPlacements] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          id: { in: projectIds },
          ...this.accessibleProjectWhere(user),
        },
        select: { id: true },
      }),
      this.prisma.desktopProjectPlacement.findMany({
        where: {
          userId: user.id,
          folderId,
          projectId: { in: projectIds },
        },
        select: { projectId: true },
      }),
    ]);

    if (accessibleProjects.length !== uniqueProjectIds.size) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Project is not available on this desktop"
      );
    }
    if (folderPlacements.length !== uniqueProjectIds.size) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Project is not in this desktop folder"
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const placement of input.placements) {
        const result = await tx.desktopProjectPlacement.updateMany({
          where: {
            userId: user.id,
            folderId,
            projectId: placement.projectId,
          },
          data: {
            desktopX: placement.desktopX,
            desktopY: placement.desktopY,
            sortOrder: placement.sortOrder,
          },
        });
        if (result.count === 0) {
          throw new ApiNotFoundException(
            "NOT_FOUND",
            "Project is not in this desktop folder"
          );
        }
      }
    });

    return { count: input.placements.length };
  }

  private async ensureDefaultFolder(userId: string) {
    const existing = await this.prisma.desktopFolder.findFirst({
      where: { ownerId: userId, isDefault: true },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.desktopFolder.create({
      data: {
        ownerId: userId,
        name: DEFAULT_FOLDER_NAME,
        isDefault: true,
        sortOrder: 0,
      },
    });
  }

  private async ensureProjectPlacements(
    userId: string,
    folderId: string,
    projects: DesktopProjectForPlacement[]
  ) {
    if (projects.length === 0) {
      return;
    }
    const existingPlacements =
      await this.prisma.desktopProjectPlacement.findMany({
        where: {
          userId,
          projectId: { in: projects.map((project) => project.id) },
        },
        orderBy: [
          { folderId: "asc" },
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
        select: {
          id: true,
          projectId: true,
          folderId: true,
          desktopX: true,
          desktopY: true,
        },
      });
    const placedProjectIds = new Set(
      existingPlacements.map((placement) => placement.projectId)
    );
    const occupiedByFolder = new Map<
      string,
      { desktopX: number; desktopY: number }[]
    >();
    const updateExisting = [];
    for (const placement of existingPlacements) {
      const targetFolderId = placement.folderId;
      const occupied = occupiedByFolder.get(targetFolderId) ?? [];
      const position = findNextAvailableDesktopPosition(
        {
          desktopX: placement.desktopX,
          desktopY: placement.desktopY,
        },
        occupied
      );
      occupied.push(position);
      occupiedByFolder.set(targetFolderId, occupied);
      if (
        position.desktopX !== placement.desktopX ||
        position.desktopY !== placement.desktopY
      ) {
        updateExisting.push(
          this.prisma.desktopProjectPlacement.update({
            where: { id: placement.id },
            data: {
              folderId: targetFolderId,
              desktopX: position.desktopX,
              desktopY: position.desktopY,
            },
          })
        );
      }
    }
    const missing = projects
      .map((project, index) => ({ project, index }))
      .filter(({ project }) => !placedProjectIds.has(project.id));
    const defaultFolderOccupied = occupiedByFolder.get(folderId) ?? [];
    const createData = missing.map(({ project }) => {
      const targetFolderId = folderId;
      const occupied = defaultFolderOccupied;
      const sortOrder = occupied.length;
      const position = findNextAvailableDesktopPosition(
        defaultDesktopPosition(sortOrder),
        occupied
      );
      occupied.push(position);
      occupiedByFolder.set(targetFolderId, occupied);
      return {
        userId,
        projectId: project.id,
        folderId: targetFolderId,
        ...position,
        sortOrder,
      };
    });
    await Promise.all(updateExisting);
    if (createData.length > 0) {
      await this.prisma.desktopProjectPlacement.createMany({
        data: createData,
        skipDuplicates: true,
      });
    }
  }

  private async requireAccessibleProject(projectId: string, user: RequestUser) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.accessibleProjectWhere(user),
      },
      select: { id: true },
    });
    if (!project) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Project is not available on this desktop"
      );
    }
  }

  private async requireOwnedFolder(folderId: string, userId: string) {
    const folder = await this.prisma.desktopFolder.findFirst({
      where: { id: folderId, ownerId: userId },
      select: { id: true },
    });
    if (!folder) {
      throw new ApiNotFoundException("NOT_FOUND", "Folder not found");
    }
    return folder;
  }

  private accessibleProjectWhere(user: RequestUser): Prisma.ProjectWhereInput {
    const visibleStatuses = [
      "ACTIVE",
      "PENDING_FINAL_CHECK",
      "ARCHIVED",
    ] as const;
    if (user.globalRole === "SUPER_ADMIN") {
      return { status: { in: [...visibleStatuses] } };
    }
    return {
      status: { in: [...visibleStatuses] },
      members: {
        some: {
          userId: user.id,
          status: "ACTIVE",
        },
      },
    };
  }
}
