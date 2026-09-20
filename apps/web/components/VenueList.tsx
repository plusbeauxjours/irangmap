"use client";

import { CATEGORY_LABEL, SOURCE_LABEL, type Venue } from "@/lib/venues";

interface Props {
  venues: Venue[];
  hoveredId: number | null;
  selectedId: number | null;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
}

const MAX_ROWS = 300;

export function VenueList({ venues, hoveredId, selectedId, onHover, onSelect }: Props) {
  if (venues.length === 0) {
    return <p className="p-6 text-sm text-neutral-500">이 범위에는 표시할 업소가 없습니다. 지도를 움직이거나 필터를 풀어보세요.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100" role="list">
      {venues.slice(0, MAX_ROWS).map((v) => {
        const active = v.id === hoveredId || v.id === selectedId;
        return (
          <li key={v.id}>
            <button
              type="button"
              onMouseEnter={() => onHover(v.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(v.id)}
              onBlur={() => onHover(null)}
              onClick={() => onSelect(v.id)}
              className={`w-full px-4 py-3 text-left transition ${active ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium leading-tight">{v.name}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${v.category === "trampoline_park" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"}`}>
                  {CATEGORY_LABEL[v.category]}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-neutral-500">{v.addr || "주소 없음"}</p>
              <p className="mt-1 flex flex-wrap gap-1 text-[11px] text-neutral-500">
                {v.sources.map((s) => (
                  <span key={s} className="rounded border border-neutral-200 px-1">{SOURCE_LABEL[s.split(":")[0]] ?? s.split(":")[0]}</span>
                ))}
                {v.public && <span className="rounded border border-emerald-200 bg-emerald-50 px-1 text-emerald-700">공공</span>}
                {v.indoor && <span className="rounded border border-neutral-200 px-1">{v.indoor}</span>}
              </p>
            </button>
          </li>
        );
      })}
      {venues.length > MAX_ROWS && (
        <li className="p-4 text-center text-xs text-neutral-500">{(venues.length - MAX_ROWS).toLocaleString()}곳 더 있음 — 지도를 확대하세요</li>
      )}
    </ul>
  );
}
