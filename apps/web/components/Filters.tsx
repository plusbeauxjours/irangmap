"use client";

import { CATEGORY_LABEL, type Category, type Filters } from "@/lib/venues";

import { BadgeCheck, Building2, CATEGORY_STYLE, CircleCheck, Home, Search } from "./icons";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  total: number;
  visible: number;
}

const CATEGORIES: Category[] = ["kids_cafe", "trampoline_park"];

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const CATEGORY_ACTIVE_CLASS: Record<Category, string> = {
  kids_cafe: "border-brand-600 bg-brand-600 text-white shadow-sm",
  trampoline_park: "border-trampoline-600 bg-trampoline-600 text-white shadow-sm",
};

export function FiltersBar({ filters, onChange, total, visible }: Props) {
  const toggleCategory = (c: Category) => {
    const next = new Set(filters.categories);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...filters, categories: next });
  };
  // 카테고리 칩: 가장 눈에 띄는 1차 필터 (브랜드 색으로 채움)
  const categoryChip = (c: Category, active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${FOCUS_RING} focus-visible:ring-neutral-400 ${
      active ? CATEGORY_ACTIVE_CLASS[c] : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
    }`;
  // 나머지 토글: 보조 필터 (작고 차분하게, 좁은 화면에서 가로 스크롤)
  const toggleChip = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${FOCUS_RING} focus-visible:ring-neutral-400 ${
      active ? "border-neutral-800 bg-neutral-800 text-white" : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300 hover:bg-white"
    }`;

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 p-4">
      <p className="flex items-center gap-1.5 text-xs text-neutral-500" title="공공데이터 3종 + 서울형 키즈카페, 2026-09-20 기준">
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
        지도 범위 안 <strong className="font-semibold text-neutral-900">{visible.toLocaleString()}</strong>곳
        <span className="text-neutral-300">·</span>
        전국 {total.toLocaleString()}곳
      </p>
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="이름·주소 검색 (예: 판교, 챔피언)"
          className={`w-full rounded-xl border border-neutral-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 ${FOCUS_RING} focus-visible:ring-brand-200`}
          aria-label="검색"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const { Icon } = CATEGORY_STYLE[c];
          return (
            <button key={c} type="button" className={categoryChip(c, filters.categories.has(c))} onClick={() => toggleCategory(c)} aria-pressed={filters.categories.has(c)}>
              <Icon size={14} /> {CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-hide">
        <button type="button" className={toggleChip(filters.verifiedOnly)} onClick={() => onChange({ ...filters, verifiedOnly: !filters.verifiedOnly })} aria-pressed={filters.verifiedOnly} title="연령·요금 등 이용 정보가 확인된 곳만">
          <CircleCheck size={13} /> 정보 있음
        </button>
        <button type="button" className={toggleChip(filters.publicOnly)} onClick={() => onChange({ ...filters, publicOnly: !filters.publicOnly })} aria-pressed={filters.publicOnly}>
          <Building2 size={13} /> 공공
        </button>
        <button type="button" className={toggleChip(filters.indoorOnly)} onClick={() => onChange({ ...filters, indoorOnly: !filters.indoorOnly })} aria-pressed={filters.indoorOnly}>
          <Home size={13} /> 실내
        </button>
        <button type="button" className={toggleChip(filters.multiSourceOnly)} onClick={() => onChange({ ...filters, multiSourceOnly: !filters.multiSourceOnly })} aria-pressed={filters.multiSourceOnly} title="서로 다른 공공데이터 2종 이상에서 확인된 곳">
          <BadgeCheck size={13} /> 교차 확인
        </button>
      </div>
    </div>
  );
}
