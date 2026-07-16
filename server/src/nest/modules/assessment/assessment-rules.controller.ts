import { Controller, Get, Post, Put, Body, Param, Query } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator.js";
import * as ctrl from "../../../controllers/assessmentRule.controller.js";
import { ExpressAdapter } from "../../utils/express-adapter.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { AuthPayload } from "../../../types/index.js";

@Controller("api/assessment-rules")
@Roles("super_admin", "hr", "engineer")
export class AssessmentRulesController {
  @Get()
  list(@Query() query: any) {
    return ExpressAdapter.invoke(ctrl.list, { query });
  }

  @Post("seed-phase1")
  @Roles("super_admin", "hr")
  seedPhase1(@CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.seedPhase1, { user });
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return ExpressAdapter.invoke(ctrl.getById, { params: { id } });
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.create, { body, user });
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.update, { params: { id }, body, user });
  }

  @Post(":id/clone")
  clone(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.clone, { params: { id }, user });
  }

  @Post(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.archive, { params: { id }, user });
  }

  @Get(":id/versions")
  getVersions(@Param("id") id: string) {
    return ExpressAdapter.invoke(ctrl.getVersions, { params: { id } });
  }

  @Post(":id/versions")
  createVersion(@Param("id") id: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.createVersion, { params: { id }, body, user });
  }
}
