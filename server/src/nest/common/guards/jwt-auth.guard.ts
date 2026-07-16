import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";
import { queryOne } from "../../../config/database.js";
import { AuthPayload } from "../../../types/index.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentication required");
    }

    const token = authHeader.split(" ")[1];

    let payload: AuthPayload & { purpose?: string };
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload & { purpose?: string };
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // Reject non-access tokens (e.g. 2FA login-challenge JWTs).
    // Mirrors Express authenticate() in middleware/auth.ts.
    if (payload.purpose) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // Server-side revocation: verify user still active in DB
    const user = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE id = $1 AND is_active = TRUE",
      [payload.userId],
    );
    if (!user) {
      throw new UnauthorizedException("Session expired. Please log in again.");
    }

    req.user = payload;
    return true;
  }
}
