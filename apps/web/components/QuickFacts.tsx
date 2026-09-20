"use client";

import type { ComponentType } from "react";
import { compactFacts, type Fact } from "@/lib/facts";
import type { VenueAttrs } from "@/lib/venues";

import { Baby, CalendarCheck, CircleParking, Coins, SockIcon, Users } from "./icons";

const ICON: Record<Fact["key"], ComponentType<{ size?: number; className?: string }>> = {
  age: Baby,
  fee: Coins,
  guardian: Users,
  socks: SockIcon,
  reservation: CalendarCheck,
  parking: CircleParking,
};

/** 타일은 흰 카드 하나로 통일하고 아이콘 색만 항목별로 다르게 — 배경색까지 칠하면 화면이 시끄럽다. */
const ICON_TONE: Record<Fact["key"], string> = {
  age: "text-brand-600",
  fee: "text-neutral-800",
  guardian: "text-neutral-800",
  socks: "text-neutral-800",
  reservation: "text-verified-600",
  parking: "text-trampoline-600",
};

/** 부모가 3초 안에 훑는 6칸: 연령·아동 요금·보호자·양말·예약·주차. 모르면 회색 점선 "미확인". */
export function QuickFacts({ attrs, compact = false }: { attrs: VenueAttrs | null | undefined; compact?: boolean }) {
  const facts = compactFacts(attrs);
  return (
    <ul className={`grid gap-2 ${compact ? "grid-cols-6" : "grid-cols-3"}`} aria-label="핵심 이용 정보">
      {facts.map((f) => {
        const Icon = ICON[f.key];
        const known = f.value !== null;
        const inner = (
          <>
            <Icon size={compact ? 16 : 22} className={known ? ICON_TONE[f.key] : "text-neutral-300"} />
            {!compact && <span className="mt-1 text-[11px] text-neutral-500">{f.label}</span>}
            <span className={`${compact ? "text-[10px]" : "text-sm"} font-semibold leading-tight ${known ? "text-neutral-900" : "text-neutral-400"}`}>
              {known ? f.value : "미확인"}
            </span>
          </>
        );
        const cls = `flex flex-col items-center justify-center rounded-card text-center transition ${compact ? "px-1 py-1.5" : "px-2 py-3"} ${
          known ? "border border-neutral-200 bg-white shadow-card" : "border border-dashed border-neutral-200 bg-neutral-50/70"
        }`;
        return (
          <li key={f.key} title={f.sub ?? f.label}>
            {f.href ? (
              <a
                href={f.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${cls} hover:border-verified-300 hover:bg-verified-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-verified-500`}
              >
                {inner}
              </a>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
