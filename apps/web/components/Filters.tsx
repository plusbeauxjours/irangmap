"use client";

import { CATEGORY_LABEL, type Category, type Filters } from "@/lib/venues";

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
    `rounded-full border px-3 py-1 text-sm transition ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"}`;

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 p-4">
      <input
        type="search"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="이름·주소 검색 (예: 판교, 챔피언)"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        aria-label="검색"
      />
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" className={chip(filters.categories.has(c))} onClick={() => toggleCategory(c)} aria-pressed={filters.categories.has(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
        <button type="button" className={chip(filters.multiSourceOnly)} onClick={() => onChange({ ...filters, multiSourceOnly: !filters.multiSourceOnly })} aria-pressed={filters.multiSourceOnly}>
          교차 확인됨
        </button>
        <button type="button" className={chip(filters.indoorOnly)} onClick={() => onChange({ ...filters, indoorOnly: !filters.indoorOnly })} aria-pressed={filters.indoorOnly}>
          실내
        </button>
        <button type="button" className={chip(filters.publicOnly)} onClick={() => onChange({ ...filters, publicOnly: !filters.publicOnly })} aria-pressed={filters.publicOnly}>
          공공
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        지도 범위 안 <strong className="text-neutral-900">{visible.toLocaleString()}</strong>곳 · 전국 {total.toLocaleString()}곳 (공공데이터 3종 병합, 2026-09-19)
      </p>
    </div>
  );
}
