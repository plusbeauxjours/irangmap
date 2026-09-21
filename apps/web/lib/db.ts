import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/** Neon HTTP 드라이버 — 서버리스(Vercel)에서 연결 풀 없이 요청마다 짧게 쓴다. */
export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 없습니다");
  return drizzle(neon(url), { schema });
}

export const dbEnabled = Boolean(process.env.DATABASE_URL);
export { schema };
