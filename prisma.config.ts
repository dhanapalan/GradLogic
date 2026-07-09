import "dotenv/config"; // Prisma no longer auto-loads .env when a config file exists
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma configuration (replaces the deprecated `package.json#prisma` key).
 *
 * Note: database seeding is handled by the SQL scripts in docker/init-db/*,
 * not by Prisma — so no `migrations.seed` command is configured here.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
});
