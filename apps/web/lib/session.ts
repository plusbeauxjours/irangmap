import { eq } from "drizzle-orm";

import { auth } from "@/auth";

import { db, dbEnabled, schema } from "./db";

export interface SessionUser {
  id: string;
  name: string | null;
  image: string | null;
}

/** 로그인한 사용자(카카오 회원번호 기준). 없으면 null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = (session as { kakaoId?: string } | null)?.kakaoId;
  if (!session?.user || !id) return null;
  return { id, name: session.user.name ?? null, image: session.user.image ?? null };
}

/** 사용자 행을 만들거나 갱신한다(로그인 시·첫 제보 시). */
export async function upsertUser(u: SessionUser): Promise<void> {
  if (!dbEnabled) return;
  await db()
    .insert(schema.users)
    .values({ id: u.id, name: u.name, image: u.image })
    .onConflictDoUpdate({ target: schema.users.id, set: { name: u.name, image: u.image, lastLoginAt: new Date() } });
}

export async function isAdmin(userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const rows = await db().select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return rows[0]?.role === "admin";
}
