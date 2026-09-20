"use client";

import type { ReactNode } from "react";
import { compactFacts } from "@/lib/facts";
import type { Venue } from "@/lib/venues";

import { Baby, BadgeCheck, Building2, CategoryIcon, CircleCheck, Coins, Home, MapPin, SockIcon, Users } from "./icons";

interface Props {
  venues: Venue[];
  hoveredId: number | null;
  selectedId: number | null;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
}

const MAX_ROWS = 300;

function Chip({ icon, text, tone = "neutral" }: { icon: ReactNode; text: string; tone?: "neutral" | "green" }) {
  const cls = tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] ${cls}`}>
      {icon}
      {text}
    </span>
  );
}

export function VenueList({ venues, hoveredId, selectedId, onHover, onSelect }: Props) {
  if (venues.length === 0) {
    return <p className="p-6 text-sm text-neutral-500">이 범위에는 표시할 업소가 없습니다. 지도를 움직이거나 필터를 풀어보세요.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100" role="list">
      {venues.slice(0, MAX_ROWS).map((v) => {
        const active = v.id === hoveredId || v.id === selectedId;
        const facts = v.attrs ? compactFacts(v.attrs) : null;
        const f = (k: string) => facts?.find((x) => x.key === k)?.value ?? null;
        return (
          <li key={v.id}>
            <button
              type="button"
              onMouseEnter={() => onHover(v.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(v.id)}
              onBlur={() => onHover(null)}
              onClick={() => onSelect(v.id)}
              className={`flex w-full gap-3 px-4 py-3 text-left transition ${active ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
            >
              <CategoryIcon category={v.category} size={16} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium leading-tight">{v.name}</span>
                  {v.attrs && <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-label="이용 정보 확인됨" />}
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-500">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{v.addr || "주소 없음"}</span>
                </p>
                <p className="mt-1.5 flex flex-wrap gap-1">
                  {facts ? (
                    <>
                      {f("age") && <Chip icon={<Baby size={11} />} text={f("age")!} tone="green" />}
                      {f("fee") && <Chip icon={<Coins size={11} />} text={f("fee")!} tone="green" />}
                      {f("guardian") && <Chip icon={<Users size={11} />} text={`보호자 ${f("guardian")}`} tone="green" />}
                      {f("socks") && <Chip icon={<SockIcon width={11} height={11} />} text="양말 필수" tone="green" />}
                    </>
                  ) : (
                    <>
                      {v.public && <Chip icon={<Building2 size={11} />} text="공공" />}
                      {v.indoor && <Chip icon={<Home size={11} />} text={v.indoor} />}
                      {v.sources.length > 1 && <Chip icon={<BadgeCheck size={11} />} text={`${v.sources.length}종 교차 확인`} />}
                    </>
                  )}
                </p>
              </div>
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
