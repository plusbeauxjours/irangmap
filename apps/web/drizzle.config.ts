import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  tablesFilter: ["app_*"], // 파이프라인(alembic) 테이블은 건드리지 않는다
});
