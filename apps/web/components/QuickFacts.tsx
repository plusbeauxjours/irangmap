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

/** 알려진 값은 항목별로 은은한 배경색을 준다 — 스캔하기 쉽게, 그러나 브랜드 팔레트 안에서. */
const TINT: Record<Fact["key"], { bg: string; border: string; icon: string; text: string }> = {
  age: { bg: "bg-brand-50", border: "border-brand-100", icon: "text-brand-600", text: "text-brand-900" },
  fee: { bg: "bg-verified-50", border: "border-verified-100", icon: "text-verified-600", text: "text-verified-900" },
  guardian: { bg: "bg-trampoline-50", border: "border-trampoline-100", icon: "text-trampoline-600", text: "text-trampoline-900" },
  socks: { bg: "bg-neutral-100", border: "border-neutral-200", icon: "text-neutral-600", text: "text-neutral-900" },
  reservation: { bg: "bg-verified-50", border: "border-verified-100", icon: "text-verified-600", text: "text-verified-900" },
  parking: { bg: "bg-trampoline-50", border: "border-trampoline-100", icon: "text-trampoline-600", text: "text-trampoline-900" },
};

/** 부모가 3초 안에 훑는 6칸: 연령·아동 요금·보호자·양말·예약·주차. 모르면 회색 점선 "미확인". */
export function QuickFacts({ attrs, compact = false }: { attrs: VenueAttrs | null | undefined; compact?: boolean }) {
  const facts = compactFacts(attrs);
  return (
    <ul className={`grid gap-2 ${compact ? "grid-cols-6" : "grid-cols-3"}`} aria-label="핵심 이용 정보">
      {facts.map((f) => {
        const Icon = ICON[f.key];
        const known = f.value !== null;
        const tint = TINT[f.key];
        const inner = (
          <>
            <Icon size={compact ? 16 : 22} className={known ? tint.icon : "text-neutral-300"} />
            {!compact && <span className="mt-1 text-[11px] text-neutral-500">{f.label}</span>}
            <span className={`${compact ? "text-[10px]" : "text-sm"} font-semibold leading-tight ${known ? tint.text : "text-neutral-400"}`}>
              {known ? f.value : "미확인"}
            </span>
          </>
        );
        const cls = `flex flex-col items-center justify-center rounded-card text-center transition ${compact ? "px-1 py-1.5" : "px-2 py-3"} ${
          known ? `border ${tint.border} ${tint.bg}` : "border border-dashed border-neutral-200 bg-neutral-50/70"
        }`;
        return (
          <li key={f.key} title={f.sub ?? f.label}>
            {f.href ? (
              <a
                href={f.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${cls} hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-verified-500`}
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
