"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_FILTERS, filterVenues, inBounds, parseVenues, type Bounds, type Filters, type Venue } from "@/lib/venues";

import { FiltersBar } from "./Filters";
import { Blocks } from "./icons";
import { VenueDetail } from "./VenueDetail";
import { VenueList } from "./VenueList";

const KO_COLLATOR = new Intl.Collator("ko");

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

export function Explorer() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/venues.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((gj) => {
        performance.mark("kc:geojson-fetched");
        const parsed = parseVenues(gj);
        performance.mark("kc:venues-parsed");
        setVenues(parsed);
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
  const onSelect = useCallback((id: number) => setSelectedId(id), []);

  return (
    <div className="grid h-screen grid-rows-[45vh_1fr] md:grid-cols-[420px_1fr] md:grid-rows-1">
      <aside className="order-2 flex min-h-0 flex-col overflow-hidden rounded-t-card bg-white shadow-sheet md:order-1 md:rounded-none md:border-r md:border-neutral-200 md:shadow-none">
        {/* 모바일: 지도 위에 얹힌 바텀시트처럼 보이도록 손잡이 표시 */}
        <div className="flex shrink-0 justify-center pb-1 pt-2 md:hidden">
          <span className="h-1 w-9 rounded-full bg-neutral-200" aria-hidden="true" />
        </div>
        <header className="flex flex-col gap-1 px-4 pb-1 pt-1 md:pb-3 md:pt-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Blocks size={17} />
            </span>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900">키즈카페 지도</h1>
          </div>
          <p className="hidden pl-10 text-xs leading-snug text-neutral-500 md:block">후기 대신, 출처와 확인일이 붙은 정보로 고르는 키즈카페</p>
        </header>
        <FiltersBar filters={filters} onChange={setFilters} total={venues.length} visible={visible.length} />
        {error && <p className="m-4 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selected ? (
            <VenueDetail venue={selected} onBack={() => setSelectedId(null)} />
          ) : venues.length === 0 && !error ? (
            <ListSkeleton />
          ) : (
            <VenueList venues={visible} hoveredId={hoveredId} selectedId={selectedId} onHover={setHoveredId} onSelect={onSelect} />
          )}
        </div>
      </aside>
      <main className="order-1 min-h-0 md:order-2">
        {USE_KAKAO ? (
          <KakaoMapView venues={filtered} hoveredId={hoveredId} selected={selected} onBoundsChange={onBoundsChange} onSelect={onSelect} />
        ) : (
          <MapView venues={filtered} hoveredId={hoveredId} selected={selected} onBoundsChange={onBoundsChange} onSelect={onSelect} />
        )}
      </main>
    </div>
  );
}
