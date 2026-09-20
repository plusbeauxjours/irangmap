"use client";

import { ATTRIBUTE_SCHEMA, CATEGORY_LABEL, SOURCE_LABEL, linkouts, type Venue } from "@/lib/venues";

interface Props {
  venue: Venue;
  onBack: () => void;
}

export function VenueDetail({ venue: v, onBack }: Props) {
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
          {ATTRIBUTE_SCHEMA.map((a) => (
            <div key={a.key} className="flex items-start justify-between gap-3 px-3 py-2">
              <dt className="text-sm text-neutral-700">{a.label}</dt>
              <dd className="text-right text-xs text-neutral-400">
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-500">확인 필요</span>
                <p className="mt-0.5 max-w-[200px]">{a.hint}</p>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-neutral-500">
          이 항목들은 공식 홈페이지·인스타그램·사업자 확인·이용자 제보로 채워지며, 채워질 때 출처와 확인일이 함께 표시됩니다.
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
