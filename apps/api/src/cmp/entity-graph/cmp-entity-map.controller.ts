import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  AttachCmpEntityMapDraftSchema,
  BindCmpEntityMapNodeClientSchema,
  CmpEntityMapClientCandidateQuerySchema,
  CreateCmpEntityMapEdgeSchema,
  CreateCmpEntityMapNodeSchema,
  CreateCmpEntityMapSchema,
  UpdateCmpEntityMapEdgeSchema,
  UpdateCmpEntityMapNodeSchema,
} from "@project-wing/shared/cmp-entity-maps";

import { AuthGuard } from "../../auth/auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { SkipDeclarationGate } from "../../auth/declaration-gate.decorator";
import type { RequestUser } from "../../auth/request-user";
import { ApiBadRequestException } from "../../common/api-error";
import { CmpEntityGraphService } from "./cmp-entity-graph.service";

@Controller("cmp/entity-maps")
@UseGuards(AuthGuard)
@SkipDeclarationGate()
export class CmpEntityMapController {
  constructor(private readonly maps: CmpEntityGraphService) {}
  @Get() list() {
    return this.maps.listMaps();
  }
  @Get("client-candidates") candidates(@Query() query: unknown) {
    return this.maps.findClientCandidates(
      parse(CmpEntityMapClientCandidateQuerySchema, query)
    );
  }
  @Get(":id") get(@Param("id") id: string) {
    return this.maps.getMap(id);
  }
  @Post() create(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    return this.maps.createMap(parse(CreateCmpEntityMapSchema, body), user);
  }
  @Post(":id/nodes") createNode(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.maps.createNode(
      id,
      parse(CreateCmpEntityMapNodeSchema, body),
      user
    );
  }
  @Patch(":id/nodes/:nodeId") updateNode(
    @Param("id") id: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.maps.updateNode(
      id,
      nodeId,
      parse(UpdateCmpEntityMapNodeSchema, body),
      user
    );
  }
  @Post(":id/edges") createEdge(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.maps.createEdge(
      id,
      parse(CreateCmpEntityMapEdgeSchema, body),
      user
    );
  }
  @Patch(":id/edges/:edgeId") updateEdge(
    @Param("id") id: string,
    @Param("edgeId") edgeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.maps.updateEdge(
      id,
      edgeId,
      parse(UpdateCmpEntityMapEdgeSchema, body),
      user
    );
  }
  @Post(":id/attach-draft") attachDraft(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.maps.attachDraft(
      id,
      parse(AttachCmpEntityMapDraftSchema, body),
      user
    );
  }
  @Post(":id/nodes/:nodeId/bind-client") bind(
    @Param("id") id: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.maps.bindNodeClient(
      id,
      nodeId,
      parse(BindCmpEntityMapNodeClientSchema, body),
      user
    );
  }
}

function parse(
  schema: {
    safeParse: (body: unknown) => { success: boolean; data?: unknown };
  },
  body: unknown
) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Entity Map input is invalid"
    );
  }
  return result.data as never;
}
