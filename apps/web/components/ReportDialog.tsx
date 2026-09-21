"use client";

import { signIn, useSession } from "next-auth/react";
import { useState } from "react";

import { venueKey } from "@/lib/venue-key";
import type { Venue } from "@/lib/venues";

import { X } from "./icons";

type Tab = "info" | "issue" | "claim";
const INFO_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "age_range", label: "이용 연령", placeholder: "예: 12개월~7세" },
  { key: "child_fee", label: "아동 요금", placeholder: "예: 2시간 15,000원, 추가 30분 3,000원" },
  { key: "guardian_fee", label: "보호자 요금", placeholder: "예: 보호자 1인 무료(음료 별도)" },
  { key: "socks", label: "양말", placeholder: "예: 미끄럼방지 양말 필수, 현장 판매 2,000원" },
  { key: "hours_text", label: "운영시간", placeholder: "예: 10:00~20:00, 매주 월 휴무" },
  { key: "play_zones", label: "놀이 공간", placeholder: "예: 볼풀, 트램폴린, 정글짐, 유아존" },
  { key: "parking", label: "주차", placeholder: "예: 건물 주차 2시간 무료" },
  { key: "notes", label: "유의사항", placeholder: "예: 보호자 동반 필수, 음식물 반입 금지" },
];

const input = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900";

/** 정보 제보 · 폐업/오류 신고 · 사업자 확인 요청. 로그인 필요. */
export function ReportDialog({ venue, onClose }: { venue: Venue; onClose: () => void }) {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("info");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [issueKind, setIssueKind] = useState<"closed" | "error">("closed");
  const [claim, setClaim] = useState({ businessName: "", contactPhone: "", proof: "" });
  const [state, setState] = useState<{ busy: boolean; done?: string; error?: string }>({ busy: false });

  const submit = async () => {
    setState({ busy: true });
    const key = venueKey(venue);
    const res =
      tab === "claim"
        ? await fetch("/api/claims", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ venueKey: key, venueName: venue.name, ...claim }) })
        : await fetch("/api/reports", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ venueKey: key, venueName: venue.name, kind: tab === "info" ? "info" : issueKind, fields: tab === "info" ? fields : {}, message: message || undefined }),
          });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return setState({ busy: false, error: json.error ?? "전송에 실패했습니다" });
    setState({ busy: false, done: tab === "claim" ? "확인 요청을 받았습니다. 확인 후 연락드리고, 승인되면 이 업소 정보를 직접 관리할 수 있습니다." : "제보 고맙습니다. 검토 후 반영되며, 반영되면 출처가 '이용자 제보'로 표시됩니다." });
  };

  const tabBtn = (t: Tab, label: string) => (
    <button type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm ${tab === t ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`} aria-pressed={tab === t}>
      {label}
    </button>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="정보 제보" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-sheet md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{venue.name}</h2>
            <p className="text-xs text-neutral-500">정보 제보 · 사업자 확인</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded p-1 text-neutral-500 hover:bg-neutral-100"><X size={18} /></button>
        </div>

        {status === "loading" ? (
          <p className="py-6 text-center text-sm text-neutral-500">로그인 상태 확인 중…</p>
        ) : !session?.user ? (
          <div className="py-4 text-center">
            <p className="mb-3 text-sm text-neutral-700">제보와 사업자 확인은 카카오 로그인 후 이용할 수 있습니다. 닉네임·프로필 사진만 받습니다.</p>
            <button type="button" onClick={() => signIn("kakao")} className="rounded-lg bg-[#FEE500] px-4 py-2 text-sm font-semibold text-[#191919]">카카오 로그인</button>
          </div>
        ) : state.done ? (
          <p className="rounded-lg bg-verified-50 p-4 text-sm text-verified-800">{state.done}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {tabBtn("info", "이용 정보 제보")}
              {tabBtn("issue", "폐업·오류 신고")}
              {tabBtn("claim", "사업자 확인")}
            </div>

            {tab === "info" && (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500">아는 항목만 적어 주세요. 직접 확인한 내용이면 좋습니다.</p>
                {INFO_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-xs font-medium text-neutral-600">{f.label}</span>
                    <input className={input} placeholder={f.placeholder} value={fields[f.key] ?? ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} maxLength={500} />
                  </label>
                ))}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-600">설명(선택)</span>
                  <textarea className={input} rows={2} placeholder="어디서 확인했는지, 언제 방문했는지" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
                </label>
              </div>
            )}

            {tab === "issue" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["closed", "error"] as const).map((k) => (
                    <label key={k} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm ${issueKind === k ? "border-neutral-900" : "border-neutral-200"}`}>
                      <input type="radio" name="issue" className="mr-1.5" checked={issueKind === k} onChange={() => setIssueKind(k)} />
                      {k === "closed" ? "폐업·영업 종료" : "정보 오류(위치·이름 등)"}
                    </label>
                  ))}
                </div>
                <textarea className={input} rows={3} placeholder="무엇이 잘못됐는지, 어떻게 확인했는지" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
              </div>
            )}

            {tab === "claim" && (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500">업소 운영자 본인이면 확인 후 이 업소의 정보를 직접 관리할 수 있습니다. 연락처는 확인 용도로만 쓰고 공개하지 않습니다.</p>
                <input className={input} placeholder="상호(사업자등록상)" value={claim.businessName} onChange={(e) => setClaim({ ...claim, businessName: e.target.value })} maxLength={100} />
                <input className={input} placeholder="연락 가능한 전화번호" value={claim.contactPhone} onChange={(e) => setClaim({ ...claim, contactPhone: e.target.value })} maxLength={20} />
                <input className={input} placeholder="확인 근거(선택): 공식 인스타·홈페이지 주소, 사업자번호 앞 5자리 등" value={claim.proof} onChange={(e) => setClaim({ ...claim, proof: e.target.value })} maxLength={500} />
              </div>
            )}

            {state.error && <p className="mt-3 text-sm text-brand-700">{state.error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">취소</button>
              <button type="button" onClick={submit} disabled={state.busy} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {state.busy ? "보내는 중…" : tab === "claim" ? "확인 요청" : "제보 보내기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
