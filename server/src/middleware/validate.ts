import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiResponse } from "../types/index.js";

/**
 * Express middleware to validate request body, query, or params against a Zod schema.
 * Returns 400 with `message` (joined) and `fieldErrors` map for form UIs.
 */
export const validate = (
  schema: ZodSchema,
  source: "body" | "query" | "params" = "body"
) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        const messages: string[] = [];
        for (const e of err.errors) {
          const key = e.path.length ? e.path.join(".") : "_form";
          if (!fieldErrors[key]) fieldErrors[key] = e.message;
          messages.push(`${key}: ${e.message}`);
        }
        res.status(400).json({
          success: false,
          error: "Validation failed",
          message: messages.join("; "),
          fieldErrors,
        });
        return;
      }
      next(err);
    }
  };
};
