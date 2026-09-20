"use client";

import type { ReactNode } from "react";
import { compactFacts } from "@/lib/facts";
import type { Venue } from "@/lib/venues";

import { Baby, BadgeCheck, Building2, CategoryIcon, CircleCheck, CircleHelp, Coins, Home, MapPin, SockIcon, Users } from "./icons";

interface Props {
  venues: Venue[];
  hoveredId: number | null;
  selectedId: number | null;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
}

const MAX_ROWS = 300;

function Chip({ icon, text, tone = "neutral" }: { icon: ReactNode; text: string; tone?: "neutral" | "green" }) {
  const cls = tone === "green" ? "bg-verified-50 text-verified-700" : "bg-neutral-100 text-neutral-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] ${cls}`}>
      {icon}
      {text}
    </span>
  );
}

export function VenueList({ venues, hoveredId, selectedId, onHover, onSelect }: Props) {
  if (venues.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <CircleHelp size={28} className="text-neutral-300" aria-hidden="true" />
        <p className="text-sm font-semibold text-neutral-700">이 범위에는 업소가 없어요</p>
        <p className="text-xs text-neutral-400">지도를 움직이거나 필터를 풀어보세요</p>
      </div>
    );
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
              className={`flex min-h-11 w-full gap-3 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 ${
                active ? "bg-neutral-100" : "hover:bg-neutral-50 active:bg-neutral-100"
              }`}
            >
              <CategoryIcon category={v.category} size={16} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[15px] font-semibold leading-tight text-neutral-900">{v.name}</span>
                  {v.attrs && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-verified-50 px-1.5 py-0.5 text-[10px] font-semibold text-verified-700">
                      <CircleCheck size={11} aria-hidden="true" /> 확인
                    </span>
                  )}
                </div>
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
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-neutral-400">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{v.addr || "주소 없음"}</span>
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
