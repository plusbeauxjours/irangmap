"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_FILTERS, filterVenues, inBounds, parseVenues, type Bounds, type Filters, type Venue } from "@/lib/venues";

import { FiltersBar } from "./Filters";
import { Blocks } from "./icons";
import { VenueDetail } from "./VenueDetail";
import { VenueList } from "./VenueList";

const KO_COLLATOR = new Intl.Collator("ko");

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-neutral-500">지도를 불러오는 중…</div>,
});

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
      <aside className="order-2 flex min-h-0 flex-col overflow-hidden border-t border-neutral-200 md:order-1 md:border-r md:border-t-0">
        <header className="flex items-baseline justify-between px-4 pt-4">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold tracking-tight"><Blocks size={18} className="text-rose-600" /> 키즈카페 지도</h1>
          <span className="text-xs text-neutral-400">MVP · 공공데이터 시드</span>
        </header>
        <FiltersBar filters={filters} onChange={setFilters} total={venues.length} visible={visible.length} />
        {error && <p className="m-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selected ? (
            <VenueDetail venue={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <VenueList venues={visible} hoveredId={hoveredId} selectedId={selectedId} onHover={setHoveredId} onSelect={onSelect} />
          )}
        </div>
      </aside>
      <main className="order-1 min-h-0 md:order-2">
        <MapView venues={filtered} hoveredId={hoveredId} selected={selected} onBoundsChange={onBoundsChange} onSelect={onSelect} />
      </main>
    </div>
  );
}
