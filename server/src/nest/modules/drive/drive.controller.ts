import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { AuthPayload } from "../../../types/index.js";
import { ExpressAdapter } from "../../utils/express-adapter.js";
import * as ctrl from "../../../controllers/drive.controller.js";

@Controller("api/drives")
export class DriveController {
  @Get()
  @Roles("super_admin", "hr", "engineer", "college_admin")
  list(@Query() query: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.list, { query, user });
  }

  @Get(":id")
  @Roles("super_admin", "hr", "engineer", "college_admin")
  getById(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.getById, { params: { id }, user });
  }

  @Post()
  @Roles("super_admin", "hr")
  create(@Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.create, { body, user });
  }

  @Put(":id")
  @Roles("super_admin", "hr")
  update(@Param("id") id: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.update, { params: { id }, body, user });
  }

  @Post(":id/generate")
  @Roles("super_admin", "hr")
  generate(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.generate, { params: { id }, user });
  }

  @Get(":id/pool")
  @Roles("super_admin", "hr", "engineer", "college_admin")
  getPool(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.getPool, { params: { id }, user });
  }

  @Post(":id/pool/approve")
  @Roles("super_admin", "hr")
  approvePool(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.approvePool, { params: { id }, user });
  }

  @Post(":id/pool/reject")
  @Roles("super_admin", "hr")
  rejectPool(@Param("id") id: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.rejectPool, { params: { id }, body, user });
  }

  @Put("questions/:queryId")
  @Roles("super_admin", "hr", "engineer")
  editQuestion(@Param("queryId") queryId: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.editQuestion, { params: { queryId }, body, user });
  }

  @Patch("questions/:queryId/status")
  @Roles("super_admin", "hr", "engineer")
  updateQuestionStatus(@Param("queryId") queryId: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.updateQuestionStatus, { params: { queryId }, body, user });
  }

  @Post(":id/pool/regenerate")
  @Roles("super_admin", "hr", "engineer")
  regeneratePool(@Param("id") id: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.regeneratePool, { params: { id }, body, user });
  }

  @Post(":id/cancel")
  @Roles("super_admin", "hr")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.cancel, { params: { id }, user });
  }

  @Post(":id/ready")
  @Roles("super_admin", "hr")
  markReady(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.markReady, { params: { id }, user });
  }

  @Post(":id/publish")
  @Roles("super_admin", "hr")
  publish(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.publish, { params: { id }, user });
  }

  @Get(":id/collections")
  @Roles("super_admin", "hr", "engineer", "college_admin")
  listCollections(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.listCollections, { params: { id }, user });
  }

  @Post(":id/collections")
  @Roles("super_admin", "hr")
  attachCollections(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: AuthPayload
  ) {
    return ExpressAdapter.invoke(ctrl.attachCollections, { params: { id }, body, user });
  }

  @Post(":id/seed-from-collections")
  @Roles("super_admin", "hr")
  seedFromCollections(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.seedFromCollections, { params: { id }, user });
  }

  @Get(":id/students")
  @Roles("super_admin", "hr", "engineer", "college_admin")
  getStudents(@Param("id") id: string, @Query() query: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.getStudents, { params: { id }, query, user });
  }

  @Post(":id/students")
  @Roles("super_admin", "hr")
  addStudents(@Param("id") id: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.addStudents, { params: { id }, body, user });
  }

  @Post(":id/students/csv")
  @Roles("super_admin", "hr")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  addStudentsByCSV(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.addStudentsByCSV, { params: { id }, file, user });
  }

  @Post(":id/students/campus")
  @Roles("super_admin", "hr")
  addStudentsByCampus(@Param("id") id: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.addStudentsByCampus, { params: { id }, body, user });
  }

  @Delete(":id/students/:studentId")
  @Roles("super_admin", "hr")
  removeStudent(@Param("id") id: string, @Param("studentId") studentId: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.removeStudent, { params: { id, studentId }, user });
  }

  @Get(":id/assignments")
  @Roles("super_admin", "hr", "engineer", "college_admin")
  getAssignments(@Param("id") id: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.getAssignments, { params: { id }, user });
  }

  @Post(":id/assignments")
  @Roles("super_admin", "hr")
  addAssignment(@Param("id") id: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.addAssignment, { params: { id }, body, user });
  }

  @Post(":id/students/:studentId/shortlist")
  @Roles("super_admin", "hr")
  shortlistStudent(@Param("id") id: string, @Param("studentId") studentId: string, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.shortlistStudent, { params: { id, studentId }, user });
  }

  @Post(":id/students/:studentId/interview")
  @Roles("super_admin", "hr")
  scheduleInterview(@Param("id") id: string, @Param("studentId") studentId: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.scheduleInterview, { params: { id, studentId }, body, user });
  }

  @Post(":id/students/:studentId/interview-feedback")
  @Roles("super_admin", "hr")
  completeInterview(@Param("id") id: string, @Param("studentId") studentId: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.completeInterview, { params: { id, studentId }, body, user });
  }

  @Post(":id/students/:studentId/offer")
  @Roles("super_admin", "hr")
  releaseOffer(@Param("id") id: string, @Param("studentId") studentId: string, @Body() body: any, @CurrentUser() user: AuthPayload) {
    return ExpressAdapter.invoke(ctrl.releaseOffer, { params: { id, studentId }, body, user });
  }
}
