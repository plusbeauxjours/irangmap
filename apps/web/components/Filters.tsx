"use client";

import { useEffect, useRef, useState } from "react";

import { CATEGORY_LABEL, DEFAULT_FILTERS, type Category, type Filters } from "@/lib/venues";

import { BadgeCheck, Building2, CATEGORY_STYLE, CircleCheck, Home, Search, SlidersHorizontal, X } from "./icons";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  total: number;
  visible: number;
}

const CATEGORIES: Category[] = ["kids_cafe", "trampoline_park"];
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400";

type ToggleKey = "verifiedOnly" | "publicOnly" | "indoorOnly" | "multiSourceOnly";
const TOGGLES: { key: ToggleKey; label: string; hint: string; Icon: typeof Home }[] = [
  { key: "verifiedOnly", label: "이용 정보 있음", hint: "연령·요금 등이 확인된 곳만", Icon: CircleCheck },
  { key: "publicOnly", label: "공공 운영", hint: "서울형 키즈카페 등 지자체 운영", Icon: Building2 },
  { key: "indoorOnly", label: "실내", hint: "실내 시설만", Icon: Home },
  { key: "multiSourceOnly", label: "교차 확인", hint: "공공데이터 2종 이상에서 확인", Icon: BadgeCheck },
];

/** 켜져 있는 필터 수 — 기본값과 다른 것만 센다 (카테고리 하나를 끄면 1). */
export function activeFilterCount(f: Filters): number {
  let n = CATEGORIES.filter((c) => !f.categories.has(c)).length;
  for (const t of TOGGLES) if (f[t.key]) n += 1;
  return n;
}

export function FiltersBar({ filters, onChange, total, visible }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = activeFilterCount(filters);

  // 바깥 클릭·Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleCategory = (c: Category) => {
    const next = new Set(filters.categories);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...filters, categories: next });
  };
  const reset = () => onChange({ ...DEFAULT_FILTERS, categories: new Set(DEFAULT_FILTERS.categories), query: filters.query });

  return (
    <div className="border-b border-neutral-200 px-4 pb-3 pt-2 md:p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500" title="공공데이터 3종 + 서울형 키즈카페 + 브랜드 공식 사이트">
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" aria-hidden="true" />
        지도 범위 안 <strong className="font-semibold text-neutral-900">{visible.toLocaleString()}</strong>곳
        <span className="text-neutral-300">·</span>
        전국 {total.toLocaleString()}곳
      </p>

      <div ref={panelRef} className="relative flex items-center gap-2">
        <label className="relative block flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="이름·주소 검색 (예: 판교, 챔피언)"
            className={`w-full rounded-xl border border-neutral-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-neutral-900 ${FOCUS_RING} focus-visible:ring-neutral-300`}
            aria-label="검색"
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`필터${active ? ` (${active}개 적용)` : ""}`}
          className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${FOCUS_RING} ${
            active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
          }`}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          {active > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white">{active}</span>
          )}
        </button>

        {open && (
          <div role="dialog" aria-label="필터" className="absolute right-0 top-12 z-20 w-72 rounded-card border border-neutral-200 bg-white p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">필터</span>
              <div className="flex items-center gap-2">
                {active > 0 && (
                  <button type="button" onClick={reset} className="text-xs text-neutral-500 underline-offset-2 hover:underline">
                    초기화
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
                  <X size={16} />
                </button>
              </div>
            </div>

            <p className="mb-1 text-[11px] font-medium text-neutral-500">종류</p>
            <div className="mb-3 flex gap-2">
              {CATEGORIES.map((c) => {
                const { Icon } = CATEGORY_STYLE[c];
                const on = filters.categories.has(c);
                const tone = c === "kids_cafe" ? "border-brand-200 bg-brand-50 text-brand-700" : "border-trampoline-200 bg-trampoline-50 text-trampoline-700";
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    aria-pressed={on}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition ${FOCUS_RING} ${
                      on ? tone : "border-neutral-200 bg-white text-neutral-400 line-through"
                    }`}
                  >
                    <Icon size={14} /> {CATEGORY_LABEL[c]}
                  </button>
                );
              })}
            </div>

            <p className="mb-1 text-[11px] font-medium text-neutral-500">조건</p>
            <ul className="divide-y divide-neutral-100">
              {TOGGLES.map((t) => (
                <li key={t.key}>
                  <label className="flex cursor-pointer items-center gap-2.5 py-2">
                    <input
                      type="checkbox"
                      checked={filters[t.key]}
                      onChange={(e) => onChange({ ...filters, [t.key]: e.target.checked })}
                      className="h-4 w-4 accent-neutral-900"
                    />
                    <t.Icon size={14} className="text-neutral-500" aria-hidden="true" />
                    <span className="flex-1 text-sm text-neutral-800">{t.label}</span>
                    <span className="text-[11px] text-neutral-400">{t.hint}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {active > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORIES.filter((c) => !filters.categories.has(c)).map((c) => (
            <button key={c} type="button" onClick={() => toggleCategory(c)} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-200">
              {CATEGORY_LABEL[c]} 제외 <X size={11} />
            </button>
          ))}
          {TOGGLES.filter((t) => filters[t.key]).map((t) => (
            <button key={t.key} type="button" onClick={() => onChange({ ...filters, [t.key]: false })} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-200">
              {t.label} <X size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
