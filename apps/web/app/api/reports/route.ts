import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { db, dbEnabled, schema } from "@/lib/db";
import { currentUser, upsertUser } from "@/lib/session";

const FIELD_KEYS = ["age_range", "child_fee", "guardian_fee", "socks", "hours_text", "play_zones", "amenities", "parking", "notes", "reservation"] as const;

const Body = z.object({
  venueKey: z.string().min(3).max(120),
  venueName: z.string().min(1).max(120),
  kind: z.enum(["info", "closed", "error"]),
  fields: z.partialRecord(z.enum(FIELD_KEYS), z.string().trim().max(500)).default({}),
  message: z.string().trim().max(1000).optional(),
});

const DAILY_LIMIT = 20;

export async function POST(req: Request) {
  if (!dbEnabled) return Response.json({ error: "제보 기능이 아직 준비되지 않았습니다" }, { status: 503 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "입력값을 확인해 주세요" }, { status: 400 });
  const body = parsed.data;
  const fields = Object.fromEntries(Object.entries(body.fields).filter(([, v]) => v && v.trim()));
  if (body.kind === "info" && Object.keys(fields).length === 0 && !body.message) {
    return Response.json({ error: "바뀐 값이나 설명을 하나 이상 적어 주세요" }, { status: 400 });
  }
  const d = db();
  await upsertUser(user);
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [{ n }] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.reports)
    .where(and(eq(schema.reports.userId, user.id), gte(schema.reports.createdAt, since)));
  if (n >= DAILY_LIMIT) return Response.json({ error: "하루 제보 한도(20건)를 넘었습니다" }, { status: 429 });
  const [row] = await d
    .insert(schema.reports)
    .values({ venueKey: body.venueKey, venueName: body.venueName, userId: user.id, kind: body.kind, fields, message: body.message ?? null })
    .returning({ id: schema.reports.id });
  return Response.json({ ok: true, id: row.id });
}
