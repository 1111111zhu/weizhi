import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.role.findMany({
      orderBy: [{ scope: "asc" }, { code: "asc" }],
      include: { rolePermissions: { include: { permission: true } } },
    });
  }
}
