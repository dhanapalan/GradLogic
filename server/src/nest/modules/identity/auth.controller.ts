import {
  Controller, Post, Get, Body, Req, HttpCode, HttpStatus, BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import crypto from "crypto";
import * as authService from "../../../services/auth.service.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { AuthPayload } from "../../../types/index.js";
import { env } from "../../../config/env.js";
import { setupPasswordSchema } from "../../../validators/password.js";

// Strict brute-force guard for credential endpoints: 10 attempts / 15 min per IP.
// Mirrors the legacy Express authLimiter that the global 100/15min throttle replaced.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 15 * 60 * 1000 } };

function generateOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now().toString();
  const payload = `${nonce}.${ts}`;
  const sig = crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyOAuthState(state: string): boolean {
  try {
    const decoded = Buffer.from(state, "base64url").toString();
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;
    const [nonce, ts, sig] = parts;
    const expected = crypto.createHmac("sha256", env.JWT_SECRET)
      .update(`${nonce}.${ts}`).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return false;
    if (Date.now() - parseInt(ts) > 10 * 60 * 1000) return false;
    return true;
  } catch { return false; }
}

@Controller("api/auth")
export class AuthController {
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }, @Req() req: Request) {
    const result = await authService.loginUser(body.email, body.password, req.ip ?? undefined);
    return { success: true, data: result };
  }

  @Public()
  @Post("register/student")
  async registerStudent(@Body() body: unknown, @Req() req: Request) {
    const result = await authService.registerStudent(body as any, req.ip ?? undefined);
    return { success: true, data: result };
  }

  @Public()
  @Post("register/company")
  async registerCompany(@Body() body: unknown, @Req() req: Request) {
    const result = await authService.registerCompany(body as any, req.ip ?? undefined);
    return { success: true, data: result };
  }

  @Get("me")
  async me(@CurrentUser() user: AuthPayload) {
    const result = await authService.getMe(user.userId);
    return { success: true, data: result };
  }

  @Post("setup-password")
  @HttpCode(HttpStatus.OK)
  async setupPassword(@Body() body: unknown, @CurrentUser() user: AuthPayload) {
    const parsed = setupPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join("; "));
    }
    await authService.updatePassword(user.userId, parsed.data.password);
    return { success: true, message: "Password updated successfully" };
  }

  @Public()
  @Get("microsoft")
  async microsoftUrl() {
    const state = generateOAuthState();
    const url = await authService.getMicrosoftAuthUrl(state);
    return { success: true, data: { url, state } };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("microsoft")
  @HttpCode(HttpStatus.OK)
  async microsoftLogin(@Body() body: { code: string; state: string }, @Req() req: Request) {
    if (!body.code) throw new BadRequestException("Authorization code is required");
    if (!body.state || !verifyOAuthState(body.state)) {
      throw new BadRequestException("Invalid or expired OAuth state. Please try signing in again.");
    }
    const result = await authService.loginWithMicrosoft(body.code, req.ip ?? undefined);
    return { success: true, data: result };
  }
}
