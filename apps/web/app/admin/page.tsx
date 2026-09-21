import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { db, dbEnabled, schema } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/session";

import { reviewClaim, reviewReport } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!dbEnabled || !user || !(await isAdmin(user.id))) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-neutral-600">
        관리자만 볼 수 있는 페이지입니다. <Link href="/" className="underline">지도로 돌아가기</Link>
      </main>
    );
  }
  const d = db();
  const reports = await d.select().from(schema.reports).where(eq(schema.reports.status, "pending")).orderBy(desc(schema.reports.createdAt)).limit(100);
  const claims = await d.select().from(schema.claims).where(eq(schema.claims.status, "pending")).orderBy(desc(schema.claims.createdAt)).limit(100);
  const users = await d.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  const nameOf = new Map(users.map((u) => [u.id, u.name ?? u.id]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-sm">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">검토 대기</h1>
        <Link href="/" className="text-neutral-500 underline">지도로</Link>
      </header>

      <h2 className="mb-2 font-semibold">사업자 확인 요청 {claims.length}건</h2>
      <ul className="mb-8 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
        {claims.length === 0 && <li className="p-4 text-neutral-400">없음</li>}
        {claims.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{c.venueName} <span className="text-xs text-neutral-400">{c.venueKey}</span></p>
              <p className="text-neutral-700">{c.businessName} · {c.contactPhone}</p>
              {c.proof && <p className="text-neutral-500">근거: {c.proof}</p>}
              <p className="text-xs text-neutral-400">{nameOf.get(c.userId)} · {c.createdAt.toLocaleString("ko-KR")}</p>
            </div>
            <div className="flex gap-2">
              <form action={reviewClaim.bind(null, c.id, "approved")}><button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-white">승인</button></form>
              <form action={reviewClaim.bind(null, c.id, "rejected")}><button className="rounded-lg border border-neutral-300 px-3 py-1.5">거절</button></form>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 font-semibold">이용자 제보 {reports.length}건</h2>
      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
        {reports.length === 0 && <li className="p-4 text-neutral-400">없음</li>}
        {reports.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <span className="mr-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{r.kind === "info" ? "정보" : r.kind === "closed" ? "폐업" : "오류"}</span>
                {r.venueName} <span className="text-xs text-neutral-400">{r.venueKey}</span>
              </p>
              {Object.keys(r.fields).length > 0 && (
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-neutral-700">
                  {Object.entries(r.fields).map(([k, v]) => (<><dt key={`${k}-k`} className="text-neutral-400">{k}</dt><dd key={`${k}-v`}>{v}</dd></>))}
                </dl>
              )}
              {r.message && <p className="mt-1 whitespace-pre-line text-neutral-700">{r.message}</p>}
              <p className="text-xs text-neutral-400">{nameOf.get(r.userId)} · {r.createdAt.toLocaleString("ko-KR")}</p>
            </div>
            <div className="flex gap-2">
              <form action={reviewReport.bind(null, r.id, "approved")}><button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-white">승인</button></form>
              <form action={reviewReport.bind(null, r.id, "rejected")}><button className="rounded-lg border border-neutral-300 px-3 py-1.5">거절</button></form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
