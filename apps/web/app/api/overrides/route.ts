import { db, dbEnabled, schema } from "@/lib/db";

export const revalidate = 60;

/** 승인된 제보·사업자 값 전체. 지도가 한 번 받아 업소에 덮어쓴다(수백 건 규모). */
export async function GET() {
  if (!dbEnabled) return Response.json([]);
  const rows = await db().select().from(schema.venueOverrides);
  return Response.json(
    rows.map((r) => ({ venueKey: r.venueKey, attrs: r.attrs, source: r.source, closed: r.closed, updatedAt: r.updatedAt.toISOString() })),
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
