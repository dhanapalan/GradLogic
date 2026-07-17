import {
  Controller, Get, Delete, Param, Req, HttpCode, HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { AuthPayload } from "../../../types/index.js";
import {
  listActiveSessions,
  revokeAllUserTokens,
  revokeSessionById,
} from "../../../services/token.service.js";
import { recordAuditEvent } from "../../../services/adminAudit.service.js";
import { readRefreshCookie } from "../../../utils/refreshCookie.js";

@Controller("api/sessions")
export class SessionsController {
  @Get()
  async list(@CurrentUser() user: AuthPayload, @Req() req: Request) {
    // Header or httpOnly cookie only — never query strings (logs/Referer).
    const header = req.headers["x-refresh-token"];
    const current =
      (typeof header === "string" && header ? header : undefined) ??
      readRefreshCookie(req) ??
      undefined;
    const data = await listActiveSessions(user.userId, current);
    return { success: true, data };
  }

  @Delete("all")
  @HttpCode(HttpStatus.OK)
  async revokeAll(@CurrentUser() user: AuthPayload, @Req() req: Request) {
    await revokeAllUserTokens(user.userId);
    recordAuditEvent({
      userId: user.userId,
      action: "SESSIONS_REVOKED_ALL",
      resourceType: "session",
      resourceId: user.userId,
      ipAddress: req.ip,
    }).catch(() => {});
    return { success: true, message: "All sessions revoked" };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async revokeOne(
    @CurrentUser() user: AuthPayload,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    await revokeSessionById(user.userId, id);
    recordAuditEvent({
      userId: user.userId,
      action: "SESSION_REVOKED",
      resourceType: "session",
      resourceId: id,
      ipAddress: req.ip,
    }).catch(() => {});
    return { success: true, message: "Session revoked" };
  }
}
