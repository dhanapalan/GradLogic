import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const defaultClientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const defaultAdminClientUrl =
  process.env.ADMIN_CLIENT_URL || "http://admin.localhost:5173";
const defaultCollegeClientUrl =
  process.env.COLLEGE_CLIENT_URL || "http://campus.localhost:5173";
const defaultStudentClientUrl =
  process.env.STUDENT_CLIENT_URL || "http://exam.localhost:5173";

const clientUrlCandidates = [
  defaultClientUrl,
  defaultAdminClientUrl,
  defaultCollegeClientUrl,
  defaultStudentClientUrl,
  ...(process.env.CLIENT_URLS ? process.env.CLIENT_URLS.split(",") : []),
]
  .map((v) => (v || "").trim())
  .filter(Boolean);

const clientUrls = Array.from(new Set(clientUrlCandidates));

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  CLIENT_URL: clientUrls[0] || defaultClientUrl,
  CLIENT_URLS: clientUrls,
  AI_ENGINE_URL: process.env.AI_ENGINE_URL || "http://localhost:8000",

  // PostgreSQL
  PG_HOST: process.env.PG_HOST || "localhost",
  PG_PORT: parseInt(process.env.PG_PORT || "5432", 10),
  PG_USER: process.env.PG_USER || "talentsecure",
  PG_PASSWORD: process.env.PG_PASSWORD || "secret",
  PG_DATABASE: process.env.PG_DATABASE || "talentsecure_db",

  // Redis
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "dev-jwt-secret-talentsecure-2026",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  // Short-lived access token; refresh tokens keep sessions alive with rotation.
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "1h",
  // Refresh token lifetime (opaque token stored hashed in DB).
  REFRESH_TOKEN_EXPIRES_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "30", 10),
  // Password reset link lifetime (minutes).
  PASSWORD_RESET_EXPIRES_MIN: parseInt(process.env.PASSWORD_RESET_EXPIRES_MIN || "30", 10),

  // API Controls
  DISABLE_RATE_LIMIT: process.env.DISABLE_RATE_LIMIT === "true",

  // MinIO / S3
  S3_ENDPOINT: process.env.S3_ENDPOINT || "http://localhost:9000",
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || "minioadmin",
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || "minioadmin",
  S3_BUCKET: process.env.S3_BUCKET || "talentsecure",
  S3_REGION: process.env.S3_REGION || "us-east-1",

  // AI Engine service-to-service API key
  AI_ENGINE_API_KEY: process.env.AI_ENGINE_API_KEY || "dev-ai-engine-key",

  // Anthropic (Claude) — used for AI plan generation, assessment generation, interview feedback
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",

  // Vapi.ai — voice AI mock interviews
  VAPI_API_KEY: process.env.VAPI_API_KEY || "",          // private server key
  VAPI_PUBLIC_KEY: process.env.VAPI_PUBLIC_KEY || "",    // exposed to client
  VAPI_WEBHOOK_SECRET: process.env.VAPI_WEBHOOK_SECRET || "",

  // OpenAI (kept for backward compat — prefer ANTHROPIC_API_KEY)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o",

  // Judge0 (code execution sandbox)
  JUDGE0_API_URL: process.env.JUDGE0_API_URL || "http://localhost:2358",
  JUDGE0_API_KEY: process.env.JUDGE0_API_KEY || "",

  // Microsoft SSO (Azure AD)
  MSAL_CLIENT_ID: process.env.MSAL_CLIENT_ID || "",
  MSAL_CLIENT_SECRET: process.env.MSAL_CLIENT_SECRET || "",
  MSAL_TENANT_ID: process.env.MSAL_TENANT_ID || "common",
  MSAL_REDIRECT_URI: process.env.MSAL_REDIRECT_URI || "http://localhost:5173/auth/callback",

  // Email Configuration
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  EMAIL_FROM: process.env.EMAIL_FROM || "GradLogic <noreply@nallas.com>",
} as const;

// ── Production secrets guard ──────────────────────────────────────────────────
// Fail fast if the app boots in production while any sensitive value is still the
// built-in development default. Booting with a publicly-known JWT_SECRET would let
// anyone forge valid tokens, so we refuse to start rather than run insecurely.
if (env.NODE_ENV === "production") {
  const insecureDefaults: Array<[string, string, string]> = [
    ["JWT_SECRET", env.JWT_SECRET, "dev-jwt-secret-talentsecure-2026"],
    ["AI_ENGINE_API_KEY", env.AI_ENGINE_API_KEY, "dev-ai-engine-key"],
    ["PG_PASSWORD", env.PG_PASSWORD, "secret"],
    ["S3_ACCESS_KEY", env.S3_ACCESS_KEY, "minioadmin"],
    ["S3_SECRET_KEY", env.S3_SECRET_KEY, "minioadmin"],
  ];

  const offenders = insecureDefaults
    .filter(([, value, fallback]) => value === fallback)
    .map(([name]) => name);

  if (offenders.length > 0) {
    throw new Error(
      `Refusing to start in production: the following secrets are still set to their ` +
        `insecure development defaults — ${offenders.join(", ")}. Set them via environment variables.`,
    );
  }
}
