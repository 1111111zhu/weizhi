import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FrameworkTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.frameworkTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ code: "asc" }],
    });
  }
}
