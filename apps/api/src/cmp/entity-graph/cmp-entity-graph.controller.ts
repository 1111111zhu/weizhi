import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CmpClientGraphQuerySchema,
  CmpCompanyIdentityMatchQuerySchema,
  CreateCmpEntityRelationshipSchema,
  CreateCmpGroupRelationshipSchema,
  CreateCmpRelatedEntitySchema,
  UpdateCmpEntityRelationshipSchema,
  UpdateCmpGroupRelationshipSchema,
  UpdateCmpRelatedEntitySchema,
} from "@project-wing/shared/cmp-entity-graph";

import { AuthGuard } from "../../auth/auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { SkipDeclarationGate } from "../../auth/declaration-gate.decorator";
import type { RequestUser } from "../../auth/request-user";
import { ApiBadRequestException } from "../../common/api-error";
import { CmpEntityGraphService } from "./cmp-entity-graph.service";

@Controller("cmp/clients")
@UseGuards(AuthGuard)
@SkipDeclarationGate()
export class CmpEntityGraphController {
  constructor(
    @Inject(CmpEntityGraphService)
    private readonly graphs: CmpEntityGraphService
  ) {}

  // Keep this route two segments below /cmp/clients so it cannot be
  // Intercepted by the legacy /cmp/clients/:id route registered by
  // CmpController.
  @Get("identity/company-match")
  findCompanyIdentityMatch(@Query() query: unknown) {
    const parsed = CmpCompanyIdentityMatchQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Company identity query is invalid"
      );
    }
    return this.graphs.findCompanyIdentityMatch(parsed.data);
  }

  @Get(":id/graph")
  getClientGraph(@Param("id") id: string, @Query() query: unknown) {
    const parsed = CmpClientGraphQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Graph query is invalid"
      );
    }
    return this.graphs.getClientGraph(id, parsed.data.asOf);
  }

  @Get(":id/entities")
  listEntities(@Param("id") id: string) {
    return this.graphs.listClientEntities(id);
  }

  @Post(":id/entities")
  createEntity(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.graphs.createClientEntity(
      id,
      parseBody(CreateCmpRelatedEntitySchema, body),
      user
    );
  }

  @Patch(":id/entities/:entityId")
  updateEntity(
    @Param("id") id: string,
    @Param("entityId") entityId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.graphs.updateClientEntity(
      id,
      entityId,
      parseBody(UpdateCmpRelatedEntitySchema, body),
      user
    );
  }

  @Delete(":id/entities/:entityId")
  removeEntity(
    @Param("id") id: string,
    @Param("entityId") entityId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.graphs.removeClientEntity(id, entityId, user);
  }

  @Get(":id/relationships")
  listRelationships(@Param("id") id: string) {
    return this.graphs.listClientRelationships(id);
  }

  @Post(":id/relationships")
  createRelationship(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.graphs.createClientRelationship(
      id,
      parseBody(CreateCmpEntityRelationshipSchema, body),
      user
    );
  }

  @Patch(":id/relationships/:relationshipId")
  updateRelationship(
    @Param("id") id: string,
    @Param("relationshipId") relationshipId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.graphs.updateClientRelationship(
      id,
      relationshipId,
      parseBody(UpdateCmpEntityRelationshipSchema, body),
      user
    );
  }

  @Delete(":id/relationships/:relationshipId")
  removeRelationship(
    @Param("id") id: string,
    @Param("relationshipId") relationshipId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.graphs.removeClientRelationship(id, relationshipId, user);
  }

  @Get(":id/group-relationships")
  listGroupRelationships(@Param("id") id: string) {
    return this.graphs.listClientGroupRelationships(id);
  }

  @Post(":id/group-relationships")
  createGroupRelationship(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.graphs.createClientGroupRelationship(
      id,
      parseBody(CreateCmpGroupRelationshipSchema, body),
      user
    );
  }

  @Patch(":id/group-relationships/:relationshipId")
  updateGroupRelationship(
    @Param("id") id: string,
    @Param("relationshipId") relationshipId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.graphs.updateClientGroupRelationship(
      id,
      relationshipId,
      parseBody(UpdateCmpGroupRelationshipSchema, body),
      user
    );
  }

  @Delete(":id/group-relationships/:relationshipId")
  removeGroupRelationship(
    @Param("id") id: string,
    @Param("relationshipId") relationshipId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.graphs.removeClientGroupRelationship(id, relationshipId, user);
  }
}

function parseBody<T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  body: unknown
) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Related party input is invalid"
    );
  }
  return parsed.data as T;
}
