"use client";

import { useState, type ReactNode } from "react";

import { CATEGORY_LABEL, SOURCE_LABEL, linkouts, type Venue } from "@/lib/venues";

import { ArrowLeft, BadgeCheck, Building2, CalendarCheck, Camera, CategoryIcon, ChevronDown, ChevronUp, CircleCheck, CircleHelp, Clock, ExternalLink, Home, Info, MapPin, Phone } from "./icons";
import { QuickFacts } from "./QuickFacts";
import { ReportDialog } from "./ReportDialog";
import { RichText } from "./RichText";

interface Props {
  venue: Venue;
  onBack: () => void;
  reportsEnabled?: boolean;
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-100 pt-5">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

/** 긴 안내문은 3줄만 보이고 "더보기"로 펼친다. */
function Collapsible({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 140 || text.split("\n").length > 3;
  return (
    <div className="rounded-card border border-neutral-200 bg-white px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-800">{title}</span>
        {long && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-0.5 rounded text-xs text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            aria-expanded={open}
          >
            {open ? "접기" : "더보기"}
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      <div className={`mt-1 ${open || !long ? "" : "max-h-[4.6rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"}`}>
        <RichText text={text} />
      </div>
    </div>
  );
}

const btn = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
const btnFocusNeutral = "focus-visible:ring-neutral-400";

export function VenueDetail({ venue: v, onBack, reportsEnabled = false }: Props) {
  const a = v.attrs;
  const [allSlots, setAllSlots] = useState(false);
  const [reporting, setReporting] = useState(false);
  const slots = a?.hours ?? [];
  const shownSlots = allSlots ? slots : slots.slice(0, 4);

  return (
    <div className="flex flex-col gap-5 p-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 self-start rounded text-sm text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <ArrowLeft size={16} /> 목록으로
      </button>

      <header className="flex gap-3">
        <CategoryIcon category={v.category} size={22} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight text-neutral-900">{v.name}</h2>
          <p className="mt-1 flex items-start gap-1 text-sm text-neutral-600">
            <MapPin size={14} className="mt-0.5 shrink-0 text-neutral-400" />
            <span>{v.addr || "주소 없음"}</span>
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">{CATEGORY_LABEL[v.category]}</span>
            {v.indoor && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                <Home size={12} /> {v.indoor}
              </span>
            )}
            {v.public && (
              <span className="inline-flex items-center gap-1 rounded-full bg-verified-50 px-2 py-0.5 text-verified-700">
                <Building2 size={12} /> 공공 운영
              </span>
            )}
            {v.sources.length > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700" title="서로 다른 공공데이터에서 같은 업소로 확인됨">
                <BadgeCheck size={12} /> {v.sources.length}종 교차 확인
              </span>
            )}
          </p>
        </div>
      </header>

      {a ? (
        <p className={`flex items-start gap-1.5 rounded-card px-3 py-2.5 text-xs ${a.scope === "brand" ? "bg-amber-50 text-amber-900" : "bg-verified-50 text-verified-800"}`}>
          <CircleCheck size={14} className="mt-0.5 shrink-0" />
          <span>
            <strong>{a.source_label}</strong>에서 확인 · {a.observed_at}
            {a.scope === "brand" && <span className="block text-amber-800/80">브랜드 공통 안내입니다. 이 매장의 실제 요금·연령은 다를 수 있어요.</span>}
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-1.5 rounded-card bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
          <CircleHelp size={14} className="mt-0.5 shrink-0 text-neutral-400" />
          <span>
            아직 확인된 이용 정보가 없어요. <span className="text-neutral-500">공식 채널·사업자 확인·이용자 제보로 채워지며, 채워질 때 출처와 확인일이 함께 표시됩니다.</span>
          </span>
        </p>
      )}

      <QuickFacts attrs={a} />

      {a && (a.operating_days || a.closed_days || slots.length > 0 || a.hours_text) && (
        <Section icon={<Clock size={14} />} title="운영">
          <div className="rounded-card border border-neutral-200 bg-white px-3.5 py-2.5 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {a.operating_days && (
                <>
                  <dt className="text-neutral-500">운영일</dt>
                  <dd className="font-medium">{a.operating_days}</dd>
                </>
              )}
              {a.closed_days && (
                <>
                  <dt className="text-neutral-500">휴관일</dt>
                  <dd>{a.closed_days}</dd>
                </>
              )}
            </dl>
            {slots.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {shownSlots.map((h) => (
                  <span key={h} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{h}</span>
                ))}
                {slots.length > 4 && (
                  <button type="button" onClick={() => setAllSlots(!allSlots)} className="rounded px-1.5 py-0.5 text-xs text-neutral-500 underline">
                    {allSlots ? "접기" : `+${slots.length - 4}회차`}
                  </button>
                )}
              </div>
            ) : (
              a.hours_text && <p className="mt-2 whitespace-pre-line text-xs text-neutral-600">{a.hours_text.slice(0, 300)}</p>
            )}
          </div>
        </Section>
      )}

      <Section icon={<Phone size={14} />} title="연락처">
        <div className="flex flex-wrap gap-2">
          {v.phone ? (
            <a href={`tel:${v.phone.replace(/[^\d+]/g, "")}`} className={`${btn} border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:ring-neutral-400`}>
              <Phone size={14} /> {v.phone}
            </a>
          ) : (
            <span className={`${btn} border-dashed border-neutral-300 text-neutral-400`}>
              <Phone size={14} /> 전화 미확인
            </span>
          )}
          {a?.reservation_url && (
            <a
              href={a.reservation_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn} border-verified-600 bg-white text-verified-700 hover:bg-verified-50 focus-visible:ring-verified-300`}
            >
              <CalendarCheck size={14} /> 예약
            </a>
          )}
          {a?.evidence_url && (
            <a href={a.evidence_url} target="_blank" rel="noopener noreferrer" className={`${btn} ${btnFocusNeutral} border-neutral-300 text-neutral-700 hover:border-neutral-900`}>
              <ExternalLink size={14} /> 원문
            </a>
          )}
          {a?.photo_url && (
            <a href={a.photo_url} target="_blank" rel="noopener noreferrer" className={`${btn} ${btnFocusNeutral} border-neutral-300 text-neutral-700 hover:border-neutral-900`}>
              <Camera size={14} /> 사진
            </a>
          )}
        </div>
      </Section>

      <Section icon={<ExternalLink size={14} />} title="외부에서 더 보기">
        <div className="flex flex-wrap gap-1.5">
          {linkouts(v).map((l) => (
            <a
              key={l.key}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            >
              {l.label} <ExternalLink size={11} />
            </a>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-neutral-400">리뷰·사진은 외부 서비스에서 확인하세요. 이 페이지는 외부 리뷰·사진을 저장하지 않습니다.</p>
      </Section>

      {a && (a.age_rules || a.notes || a.discounts || a.capacity || a.parking || a.child_fee || a.guardian_fee || a.play_zones || a.amenities) && (
        <Section icon={<Info size={14} />} title="자세한 안내">
          <div className="flex flex-col gap-2">
            {(a.child_fee || a.guardian_fee) && (
              <Collapsible title="요금" text={[a.child_fee ? `아동: ${a.child_fee}` : null, a.guardian_fee ? `보호자: ${a.guardian_fee}` : null].filter(Boolean).join("\n")} />
            )}
            {a.age_rules ? <Collapsible title="이용 연령·대상" text={a.age_rules} /> : a.age_range && a.age_range.length > 12 && <Collapsible title="이용 연령·대상" text={a.age_range} />}
            {(a.play_zones || a.amenities) && (
              <Collapsible title="놀이 공간·편의" text={[a.play_zones, a.amenities].filter(Boolean).join("\n")} />
            )}
            {(a.capacity || a.parking) && (
              <Collapsible
                title="정원·주차"
                text={[a.capacity ? `정원 개인 ${a.capacity["개인"] ?? "-"}명 · 단체 ${a.capacity["단체"] ?? "-"}명` : null, a.parking].filter(Boolean).join("\n")}
              />
            )}
            {a.discounts && <Collapsible title="입장료 할인" text={a.discounts} />}
            {a.notes && <Collapsible title="유의사항" text={a.notes} />}
          </div>
        </Section>
      )}

      <Section icon={<BadgeCheck size={14} />} title="출처">
        <ul className="space-y-0.5 text-xs text-neutral-600">
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
      </Section>

      {reportsEnabled ? (
        <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-900 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
          <Info size={14} /> 정보 제보 · 사업자 확인
        </button>
      ) : (
        <button type="button" disabled className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-400" title="준비 중">
          <Info size={14} /> 정보 제보 · 사업자 확인 (준비 중)
        </button>
      )}
      {reporting && <ReportDialog venue={v} onClose={() => setReporting(false)} />}
    </div>
  );
}
