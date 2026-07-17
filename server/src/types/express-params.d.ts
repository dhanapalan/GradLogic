/**
 * Express 5 @types widen route params to `string | string[]`.
 * Our handlers always treat params as a single path segment string.
 */
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    params: Record<string, string>;
  }
}
