"use client";

import { ATTRIBUTE_SCHEMA, CATEGORY_LABEL, SOURCE_LABEL, linkouts, type Venue, type VenueAttrs } from "@/lib/venues";

interface Props {
  venue: Venue;
  onBack: () => void;
}

/** 스키마 키 → 수집된 값(문자열). 없으면 null → "확인 필요". */
function valueFor(key: (typeof ATTRIBUTE_SCHEMA)[number]["key"], a: VenueAttrs | null | undefined): string | null {
  if (!a) return null;
  switch (key) {
    case "age_range":
      return a.age_range ?? null;
    case "guardian_fee":
      return a.guardian_fee ?? null;
    case "child_fee":
      return a.child_fee ?? null;
    case "socks":
      return a.socks ?? null;
    case "amenities": {
      const parts = [a.parking, a.capacity ? `정원 개인 ${a.capacity["개인"] ?? "-"}명 · 단체 ${a.capacity["단체"] ?? "-"}명` : null].filter(Boolean);
      return parts.length ? parts.join(" · ") : null;
    }
    case "notes":
      return a.notes ?? null;
    default:
      return null;
  }
}

export function VenueDetail({ venue: v, onBack }: Props) {
  const a = v.attrs;
  return (
    <div className="flex flex-col gap-5 p-4">
      <button type="button" onClick={onBack} className="self-start text-sm text-neutral-500 hover:text-neutral-900">
        ← 목록으로
      </button>

      <header>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-semibold leading-tight">{v.name}</h2>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${v.category === "trampoline_park" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"}`}>
            {CATEGORY_LABEL[v.category]}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">{v.addr || "주소 없음"}</p>
        <p className="mt-2 flex flex-wrap gap-1 text-[11px] text-neutral-600">
          {v.indoor && <span className="rounded border border-neutral-200 px-1.5 py-0.5">{v.indoor}</span>}
          {v.public && <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">공공 운영</span>}
          {v.sources.length > 1 && <span className="rounded border border-neutral-200 px-1.5 py-0.5">공공데이터 {v.sources.length}종 교차 확인</span>}
        </p>
      </header>

      {a && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-emerald-900">
              {a.source_label}에서 확인 <span className="ml-1 text-xs font-normal text-emerald-700">{a.observed_at}</span>
            </p>
            {a.reservation_url && (
              <a href={a.reservation_url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700">
                예약 페이지 ↗
              </a>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {a.operating_days && (<><dt className="text-neutral-500">운영일</dt><dd>{a.operating_days}</dd></>)}
            {a.closed_days && (<><dt className="text-neutral-500">휴관일</dt><dd>{a.closed_days}</dd></>)}
            {a.hours && a.hours.length > 0 && (<><dt className="text-neutral-500">회차</dt><dd className="flex flex-wrap gap-1">{a.hours.map((h) => <span key={h} className="rounded bg-white px-1.5 py-0.5 text-xs">{h}</span>)}</dd></>)}
            {a.reservation && (<><dt className="text-neutral-500">예약</dt><dd>{a.reservation}</dd></>)}
          </dl>
          <p className="mt-2 flex flex-wrap gap-3 text-xs">
            {a.evidence_url && <a href={a.evidence_url} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">원문(이용안내) 보기</a>}
            {a.photo_url && <a href={a.photo_url} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">시설 사진 보기(서울시)</a>}
          </p>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">연락·바로가기</h3>
        {v.phone ? (
          <a href={`tel:${v.phone.replace(/[^\d+]/g, "")}`} className="block text-sm font-medium text-neutral-900 underline-offset-2 hover:underline">
            📞 {v.phone}
          </a>
        ) : (
          <p className="text-sm text-neutral-500">전화번호 미확인 (인허가 데이터에 없음)</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {linkouts(v).map((l) => (
            <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:border-neutral-900">
              {l.label} ↗
            </a>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">사진·리뷰·영업시간은 위 서비스에서 확인하세요. 이 페이지는 외부 리뷰·사진을 저장하지 않습니다.</p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">이용 정보</h3>
        <dl className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {ATTRIBUTE_SCHEMA.map((attr) => {
            const val = valueFor(attr.key, a);
            return (
              <div key={attr.key} className="flex items-start justify-between gap-3 px-3 py-2">
                <dt className="shrink-0 text-sm text-neutral-700">{attr.label}</dt>
                {val ? (
                  <dd className="whitespace-pre-line text-right text-sm text-neutral-900">
                    {val}
                    {attr.key === "age_range" && a?.age_rules && a.age_rules !== val && (
                      <p className="mt-0.5 max-w-[240px] text-xs text-neutral-500">{a.age_rules}</p>
                    )}
                  </dd>
                ) : (
                  <dd className="text-right text-xs text-neutral-400">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-500">확인 필요</span>
                    <p className="mt-0.5 max-w-[200px]">{attr.hint}</p>
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
        {a?.discounts && (
          <p className="mt-2 whitespace-pre-line rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-800">입장료 할인</span> {a.discounts}
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          {a
            ? `값은 ${a.source_label} 공개 정보(${a.observed_at} 확인)이며, 최신 내용은 원문·예약 페이지에서 다시 확인하세요.`
            : "이 항목들은 공식 홈페이지·인스타그램·사업자 확인·이용자 제보로 채워지며, 채워질 때 출처와 확인일이 함께 표시됩니다."}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">출처</h3>
        <ul className="space-y-1 text-xs text-neutral-600">
          {v.sources.map((s) => {
            const [src, ...rest] = s.split(":");
            return (
              <li key={s}>
                <span className="font-medium text-neutral-800">{SOURCE_LABEL[src] ?? src}</span>
                <span className="ml-1 text-neutral-400">{rest.join(":")}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <button type="button" disabled className="rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-400" title="준비 중">
        정보 제보 · 사업자 확인 (준비 중)
      </button>
    </div>
  );
}
