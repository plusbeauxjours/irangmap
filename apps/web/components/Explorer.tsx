"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { applyOverrides, type Override } from "@/lib/overrides";
import { DEFAULT_FILTERS, filterVenues, inBounds, parseVenues, type Bounds, type Filters, type Venue } from "@/lib/venues";

import { AuthButton } from "./AuthButton";
import { FiltersBar } from "./Filters";
import { Blocks } from "./icons";
import { VenueDetail } from "./VenueDetail";
import { VenueList } from "./VenueList";

const KO_COLLATOR = new Intl.Collator("ko");

/** 모바일 바텀시트 높이 스냅(화면 높이 대비): 접힘·중간·펼침. */
const SNAPS = [0.22, 0.5, 0.9];
const SHEET_MIN = 0.16;
const SHEET_MAX = 0.92;

/** 데이터가 아직 fetch되기 전(venues.length === 0) 리스트 자리에 보이는 뼈대. */
function ListSkeleton() {
  return (
    <ul className="animate-pulse divide-y divide-neutral-100" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="flex gap-3 px-4 py-3">
          <span className="h-8 w-8 shrink-0 rounded-full bg-neutral-200" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <div className="h-3.5 w-2/3 rounded bg-neutral-200" />
            <div className="h-2.5 w-4/5 rounded bg-neutral-100" />
            <div className="flex gap-1.5">
              <div className="h-3.5 w-12 rounded-full bg-neutral-100" />
              <div className="h-3.5 w-14 rounded-full bg-neutral-100" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-neutral-500">지도를 불러오는 중…</div>,
});
const KakaoMapView = dynamic(() => import("./KakaoMapView").then((m) => m.KakaoMapView), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-100" />,
});
// 카카오 JS 키가 있으면 카카오맵(한국 사용자에게 익숙한 지도), 없으면 VWorld 래스터로 대체
const USE_KAKAO = Boolean(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);

export function Explorer({ authEnabled = false, reportsEnabled = false, reviewsEnabled = false }: { authEnabled?: boolean; reportsEnabled?: boolean; reviewsEnabled?: boolean }) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState(1);
  const [dragH, setDragH] = useState<number | null>(null);
  const [bottomInset, setBottomInset] = useState(0);
  const sheetRef = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; h: number; last: number; moved: boolean } | null>(null);

  useEffect(() => {
    fetch("/data/venues.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((gj) => {
        performance.mark("kc:geojson-fetched");
        const parsed = parseVenues(gj);
        performance.mark("kc:venues-parsed");
        setVenues(parsed);
        // 승인된 제보·사업자 값은 별도 API에서 받아 덮어쓴다(실패해도 지도는 그대로)
        if (reportsEnabled) {
          fetch("/api/overrides")
            .then((r) => (r.ok ? (r.json() as Promise<Override[]>) : []))
            .then((ov) => ov.length && setVenues(applyOverrides(parsed, ov)))
            .catch(() => undefined);
        }
      })
      .catch((e: Error) => setError(`데이터를 불러오지 못했습니다 (${e.message}). pnpm data:sync 를 실행했나요?`));
  }, []);

  const filtered = useMemo(() => filterVenues(venues, filters), [venues, filters]);
  const visible = useMemo(() => {
    const list = bounds ? filtered.filter((v) => inBounds(v, bounds)) : filtered;
    // localeCompare(x, "ko")를 비교마다 호출하면 Collator를 매번 만들어 2,845건 정렬에 수 초가 걸린다.
    return [...list].sort((a, b) => KO_COLLATOR.compare(a.name, b.name));
  }, [filtered, bounds]);
  const selected = useMemo(() => venues.find((v) => v.id === selectedId) ?? null, [venues, selectedId]);

  useEffect(() => {
    if (venues.length) performance.mark("kc:list-rendered");
  }, [venues]);

  // 진단: `/?perf=1`이면 8초·25초 시점의 마크를 서버(/api/perf)에 보낸다.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("perf") !== "1") return;
    const report = () => {
      const marks: Record<string, number> = {};
      for (const m of performance.getEntriesByType("mark")) if (m.name.startsWith("kc:")) marks[m.name] = Math.round(m.startTime);
      const q = new URLSearchParams({ ua: navigator.userAgent.slice(-45), marks: JSON.stringify(marks) });
      fetch(`/api/perf?${q}`).catch(() => undefined);
    };
    const t1 = setTimeout(report, 8000);
    const t2 = setTimeout(report, 25000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const onBoundsChange = useCallback((b: Bounds) => setBounds(b), []);
  // 터치에는 mouseleave가 없어 목록이 사라져도 hover가 남는다 → 선택 시 함께 해제
  const onSelect = useCallback((id: number) => {
    setHoveredId(null);
    setSelectedId(id);
    setSnap((s) => (s === 0 ? 1 : s)); // 접힌 시트에서 지도 마커를 눌렀으면 상세가 보이게 올린다
  }, []);

  // 지도가 시트에 가려지는 높이(px) — 선택한 업소를 보이는 영역 가운데로 옮기는 데 쓴다. md 이상은 0.
  useEffect(() => {
    const update = () => setBottomInset(window.matchMedia("(min-width: 768px)").matches ? 0 : Math.round(SNAPS[snap] * window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [snap]);

  const clampH = (h: number) => Math.min(Math.max(h, SHEET_MIN * window.innerHeight), SHEET_MAX * window.innerHeight);
  const onHandleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const h = sheetRef.current?.offsetHeight ?? 0;
    drag.current = { y: e.clientY, h, last: h, moved: false };
  };
  const onHandleMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    d.last = clampH(d.h + dy);
    setDragH(d.last);
  };
  const onHandleUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setSnap((s) => (s + 1) % SNAPS.length); // 탭: 접힘→중간→펼침→접힘
    } else {
      const frac = d.last / window.innerHeight;
      setSnap(SNAPS.reduce((best, v, i) => (Math.abs(v - frac) < Math.abs(SNAPS[best] - frac) ? i : best), 0));
    }
    setDragH(null);
  };

  // 목록을 스크롤한 채 업소를 고르면 상세가 중간부터 열리므로 맨 위로
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId !== null) scrollRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  return (
    <div className="relative h-dvh overflow-hidden md:grid md:grid-cols-[420px_1fr] md:grid-rows-1">
      <aside
        ref={sheetRef}
        style={{ "--sheet-h": dragH !== null ? `${dragH}px` : `${SNAPS[snap] * 100}dvh` } as React.CSSProperties}
        className={`absolute inset-x-0 bottom-0 z-10 flex h-(--sheet-h) min-h-0 flex-col overflow-hidden rounded-t-card bg-white shadow-sheet md:static md:h-auto md:rounded-none md:border-r md:border-neutral-200 md:shadow-none ${
          dragH === null ? "transition-[height] duration-200 ease-out" : ""
        }`}
      >
        {/* 모바일: 바텀시트 손잡이 — 끌어서 높이 조절, 탭하면 단계 전환 */}
        <button
          type="button"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          aria-label="목록 높이 조절"
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center md:hidden"
        >
          <span className="h-1 w-9 rounded-full bg-neutral-300" aria-hidden="true" />
        </button>
        <header className="flex flex-col gap-1 px-4 pb-1 pt-1 md:pb-3 md:pt-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Blocks size={17} />
            </span>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900">아이랑맵</h1>
            {authEnabled && (
              <div className="ml-auto">
                <AuthButton />
              </div>
            )}
          </div>
          <p className="hidden pl-10 text-xs leading-snug text-neutral-500 md:block">전국 키즈카페 지도 — 출처와 확인일이 붙은 정보로 고르기</p>
        </header>
        <FiltersBar filters={filters} onChange={setFilters} total={venues.length} visible={visible.length} />
        {error && <p className="m-4 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">{error}</p>}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {selected ? (
            <VenueDetail venue={selected} onBack={() => setSelectedId(null)} reportsEnabled={reportsEnabled} reviewsEnabled={reviewsEnabled} />
          ) : venues.length === 0 && !error ? (
            <ListSkeleton />
          ) : (
            <VenueList venues={visible} hoveredId={hoveredId} selectedId={selectedId} onHover={setHoveredId} onSelect={onSelect} />
          )}
        </div>
        <footer className="flex flex-wrap items-center gap-x-3 border-t border-neutral-200 px-4 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-[11px] text-neutral-500">
          <Link href="/about" className="py-2 hover:text-neutral-900">소개·데이터 출처</Link>
          <Link href="/terms" className="py-2 hover:text-neutral-900">이용약관</Link>
          <Link href="/privacy" className="py-2 hover:text-neutral-900">개인정보처리방침</Link>
          <a href="mailto:plusbeauxjours@gmail.com" className="py-2 hover:text-neutral-900">문의·제보</a>
          <span className="ml-auto text-neutral-400">지도 © Kakao</span>
        </footer>
      </aside>
      <main className="absolute inset-0 md:static md:min-h-0">
        {USE_KAKAO ? (
          <KakaoMapView venues={filtered} hoveredId={hoveredId} selected={selected} onBoundsChange={onBoundsChange} onSelect={onSelect} bottomInset={bottomInset} />
        ) : (
          <MapView venues={filtered} hoveredId={hoveredId} selected={selected} onBoundsChange={onBoundsChange} onSelect={onSelect} bottomInset={bottomInset} />
        )}
      </main>
    </div>
  );
}
