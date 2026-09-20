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

export function FiltersBar({ filters, onChange, total, visible }: Props) {
  const toggleCategory = (c: Category) => {
    const next = new Set(filters.categories);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...filters, categories: next });
  };
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"}`;

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 p-4">
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="이름·주소 검색 (예: 판교, 챔피언)"
          className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-neutral-900"
          aria-label="검색"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const { Icon } = CATEGORY_STYLE[c];
          return (
            <button key={c} type="button" className={chip(filters.categories.has(c))} onClick={() => toggleCategory(c)} aria-pressed={filters.categories.has(c)}>
              <Icon size={14} /> {CATEGORY_LABEL[c]}
            </button>
          );
        })}
        <button type="button" className={chip(filters.verifiedOnly)} onClick={() => onChange({ ...filters, verifiedOnly: !filters.verifiedOnly })} aria-pressed={filters.verifiedOnly} title="연령·요금 등 이용 정보가 확인된 곳만">
          <CircleCheck size={14} /> 정보 있음
        </button>
        <button type="button" className={chip(filters.publicOnly)} onClick={() => onChange({ ...filters, publicOnly: !filters.publicOnly })} aria-pressed={filters.publicOnly}>
          <Building2 size={14} /> 공공
        </button>
        <button type="button" className={chip(filters.indoorOnly)} onClick={() => onChange({ ...filters, indoorOnly: !filters.indoorOnly })} aria-pressed={filters.indoorOnly}>
          <Home size={14} /> 실내
        </button>
        <button type="button" className={chip(filters.multiSourceOnly)} onClick={() => onChange({ ...filters, multiSourceOnly: !filters.multiSourceOnly })} aria-pressed={filters.multiSourceOnly} title="서로 다른 공공데이터 2종 이상에서 확인된 곳">
          <BadgeCheck size={14} /> 교차 확인
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        지도 범위 안 <strong className="text-neutral-900">{visible.toLocaleString()}</strong>곳 · 전국 {total.toLocaleString()}곳 (공공데이터 3종 + 서울형 키즈카페, 2026-09-20)
      </p>
    </div>
  );
}
