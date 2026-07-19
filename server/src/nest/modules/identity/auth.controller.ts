import {
  Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "../../../utils/refreshCookie.js";
import crypto from "crypto";
import { z } from "zod";
import * as authService from "../../../services/auth.service.js";
import * as twoFactorService from "../../../services/twoFactor.service.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { AuthPayload } from "../../../types/index.js";
import { env } from "../../../config/env.js";
import { setupPasswordSchema, passwordSchema } from "../../../validators/password.js";

const companyRegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  email: z.string().email("Invalid email"),
  password: passwordSchema,
  company_name: z.string().min(2, "Company name required").max(255),
  industry: z.string().optional(),
  headquarters: z.string().optional(),
});

function zodErrorMessage(err: z.ZodError): string {
  return err.errors.map((e) => e.message).join("; ");
}

const AUTH_THROTTLE = { default: { limit: env.DISABLE_RATE_LIMIT ? 1_000_000 : 10, ttl: 15 * 60 * 1000 } };

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
  async login(
    @Body() body: { email?: string; student_id?: string; password?: string; rememberMe?: boolean },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identifier = (body.email || body.student_id || "").trim();
    const password = body.password || "";
    if (!identifier || !password) {
      throw new BadRequestException("Email/Student ID and password are required");
    }
    const result = await authService.loginUser(identifier, password, req.ip ?? undefined, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    const refreshToken = (result as { refreshToken?: string })?.refreshToken;
    if (refreshToken) setRefreshCookie(res, refreshToken, Boolean(body.rememberMe));
    return { success: true, data: result };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("register/company")
  async registerCompany(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = companyRegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(zodErrorMessage(parsed.error));
    }
    const result = await authService.registerCompany(parsed.data, req.ip ?? undefined);
    const refreshToken = (result as { refreshToken?: string })?.refreshToken;
    if (refreshToken) setRefreshCookie(res, refreshToken, false);
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
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string; rememberMe?: boolean },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = body.refreshToken || readRefreshCookie(req);
    if (!refreshToken) throw new UnauthorizedException("Refresh token is required");
    const result = await authService.refreshSession(refreshToken, {
      ip: req.ip ?? undefined,
      userAgent: req.headers["user-agent"],
    });
    const rotated = (result as { refreshToken?: string })?.refreshToken;
    if (rotated) setRefreshCookie(res, rotated, Boolean(body.rememberMe));
    return { success: true, data: result };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const actorId = (req as Request & { user?: AuthPayload }).user?.userId;
    const refreshToken = body?.refreshToken || readRefreshCookie(req) || undefined;
    await authService.logout(refreshToken, actorId, req.ip ?? undefined);
    clearRefreshCookie(res);
    return { success: true, message: "Logged out" };
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() body: { currentPassword?: string; newPassword?: string },
    @CurrentUser() user: AuthPayload,
  ) {
    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException("Current and new password are required");
    }
    const parsed = passwordSchema.safeParse(body.newPassword);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join("; "));
    }
    await authService.changePassword(user.userId, body.currentPassword, body.newPassword);
    return { success: true, message: "Password changed successfully. Please log in again." };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email?: string }, @Req() req: Request) {
    if (!body.email) throw new BadRequestException("Email is required");
    const result = await authService.requestPasswordReset(body.email, req.ip ?? undefined);
    return {
      success: true,
      message: "If an account exists for that email, a reset code has been sent.",
      data: Object.keys(result).length ? result : undefined,
    };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() body: { email?: string; otp?: string },
    @Req() req: Request,
  ) {
    if (!body.email || !body.otp) {
      throw new BadRequestException("Email and OTP are required");
    }
    const data = await authService.verifyPasswordResetOtp(
      body.email,
      body.otp,
      req.ip ?? undefined,
    );
    return { success: true, data, message: "OTP verified" };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: { token?: string; password?: string },
    @Req() req: Request,
  ) {
    if (!body.token || !body.password) {
      throw new BadRequestException("Token and password are required");
    }
    const parsed = passwordSchema.safeParse(body.password);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join("; "));
    }
    await authService.resetPassword(body.token, body.password, req.ip ?? undefined);
    return { success: true, message: "Password reset successfully. You can now log in." };
  }

  @Get("permissions")
  async permissions(@CurrentUser() user: AuthPayload) {
    const perms = await authService.getUserPermissions(user.role);
    return { success: true, data: { permissions: perms } };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactor(
    @Body() body: { challengeToken?: string; code?: string; rememberMe?: boolean },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.challengeToken || !body.code) {
      throw new BadRequestException("2FA session and code are required");
    }
    const result = await authService.verifyTwoFactorLogin(
      body.challengeToken,
      body.code,
      req.ip ?? undefined,
      { userAgent: req.headers["user-agent"], ip: req.ip },
    );
    const refreshToken = (result as { refreshToken?: string })?.refreshToken;
    if (refreshToken) setRefreshCookie(res, refreshToken, Boolean(body.rememberMe));
    return { success: true, data: result };
  }

  @Get("2fa/status")
  async twoFactorStatus(@CurrentUser() user: AuthPayload) {
    const data = await twoFactorService.getStatus(user.userId);
    return { success: true, data };
  }

  @Post("2fa/setup")
  async twoFactorSetup(@CurrentUser() user: AuthPayload) {
    const data = await twoFactorService.beginSetup(user.userId, user.email);
    return { success: true, data };
  }

  @Post("2fa/enable")
  @HttpCode(HttpStatus.OK)
  async twoFactorEnable(
    @Body() body: { code?: string },
    @CurrentUser() user: AuthPayload,
  ) {
    if (!body.code) throw new BadRequestException("Enter the 6-digit code");
    await twoFactorService.enable(user.userId, body.code);
    return { success: true, message: "Two-factor authentication enabled" };
  }

  @Post("2fa/disable")
  @HttpCode(HttpStatus.OK)
  async twoFactorDisable(
    @Body() body: { code?: string },
    @CurrentUser() user: AuthPayload,
  ) {
    if (!body.code) throw new BadRequestException("Enter the 6-digit code");
    await twoFactorService.disable(user.userId, body.code);
    return { success: true, message: "Two-factor authentication disabled" };
  }

  @Public()
  @Get("microsoft/url")
  async microsoftUrl() {
    const state = generateOAuthState();
    const url = await authService.getMicrosoftAuthUrl(state);
    return { success: true, data: { url, state } };
  }

  @Public()
  @Get("microsoft")
  async microsoftUrlAlias() {
    return this.microsoftUrl();
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("microsoft")
  @HttpCode(HttpStatus.OK)
  async microsoftLogin(
    @Body() body: { code: string; state: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.code) throw new BadRequestException("Authorization code is required");
    if (!body.state || !verifyOAuthState(body.state)) {
      throw new BadRequestException("Invalid or expired OAuth state. Please try signing in again.");
    }
    const result = await authService.loginWithMicrosoft(body.code, req.ip ?? undefined);
    const refreshToken = (result as { refreshToken?: string })?.refreshToken;
    if (refreshToken) setRefreshCookie(res, refreshToken, false);
    return { success: true, data: result };
  }
}
