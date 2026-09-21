"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/session";

async function requireAdmin() {
  const u = await currentUser();
  if (!u || !(await isAdmin(u.id))) throw new Error("관리자만 할 수 있습니다");
  return u;
}

async function hasApprovedClaim(venueKey: string, userId: string): Promise<boolean> {
  const rows = await db()
    .select({ id: schema.claims.id })
    .from(schema.claims)
    .where(and(eq(schema.claims.venueKey, venueKey), eq(schema.claims.userId, userId), eq(schema.claims.status, "approved")))
    .limit(1);
  return rows.length > 0;
}

/** 제보 승인: 값을 overrides에 합친다. 사업자 확인이 된 사용자의 제보는 owner 출처. */
export async function reviewReport(id: number, decision: "approved" | "rejected") {
  const admin = await requireAdmin();
  const d = db();
  const [r] = await d.select().from(schema.reports).where(eq(schema.reports.id, id)).limit(1);
  if (!r || r.status !== "pending") return;
  if (decision === "approved") {
    const source = (await hasApprovedClaim(r.venueKey, r.userId)) ? "owner" : "user";
    const [cur] = await d.select().from(schema.venueOverrides).where(eq(schema.venueOverrides.venueKey, r.venueKey)).limit(1);
    const attrs = { ...(cur?.attrs ?? {}), ...(r.kind === "info" ? r.fields : {}) };
    const closed = r.kind === "closed" ? 1 : (cur?.closed ?? 0);
    // owner 값이 이미 있으면 일반 이용자 제보로 낮추지 않는다
    const nextSource = cur?.source === "owner" ? "owner" : source;
    await d
      .insert(schema.venueOverrides)
      .values({ venueKey: r.venueKey, attrs, source: nextSource, closed })
      .onConflictDoUpdate({ target: schema.venueOverrides.venueKey, set: { attrs, source: nextSource, closed, updatedAt: new Date() } });
  }
  await d.update(schema.reports).set({ status: decision, reviewedAt: new Date(), reviewedBy: admin.id }).where(eq(schema.reports.id, id));
  revalidatePath("/admin");
  revalidatePath("/api/overrides");
}

export async function reviewClaim(id: number, decision: "approved" | "rejected") {
  const admin = await requireAdmin();
  await db().update(schema.claims).set({ status: decision, reviewedAt: new Date(), reviewedBy: admin.id }).where(eq(schema.claims.id, id));
  revalidatePath("/admin");
}
