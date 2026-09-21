import { z } from "zod";

import { db, dbEnabled, schema } from "@/lib/db";
import { currentUser, upsertUser } from "@/lib/session";

const Body = z.object({
  venueKey: z.string().min(3).max(120),
  venueName: z.string().min(1).max(120),
  businessName: z.string().trim().min(1).max(100),
  contactPhone: z.string().trim().min(8).max(20),
  proof: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  if (!dbEnabled) return Response.json({ error: "사업자 확인 기능이 아직 준비되지 않았습니다" }, { status: 503 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "입력값을 확인해 주세요" }, { status: 400 });
  const b = parsed.data;
  await upsertUser(user);
  const [row] = await db()
    .insert(schema.claims)
    .values({ venueKey: b.venueKey, venueName: b.venueName, userId: user.id, businessName: b.businessName, contactPhone: b.contactPhone, proof: b.proof ?? null })
    .returning({ id: schema.claims.id });
  return Response.json({ ok: true, id: row.id });
}
