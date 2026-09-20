"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_FILTERS, filterVenues, inBounds, parseVenues, type Bounds, type Filters, type Venue } from "@/lib/venues";

import { FiltersBar } from "./Filters";
import { VenueList } from "./VenueList";

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
      .then((gj) => setVenues(parseVenues(gj)))
      .catch((e: Error) => setError(`데이터를 불러오지 못했습니다 (${e.message}). pnpm data:sync 를 실행했나요?`));
  }, []);

  const filtered = useMemo(() => filterVenues(venues, filters), [venues, filters]);
  const visible = useMemo(() => {
    const list = bounds ? filtered.filter((v) => inBounds(v, bounds)) : filtered;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [filtered, bounds]);
  const selected = useMemo(() => venues.find((v) => v.id === selectedId) ?? null, [venues, selectedId]);

  const onBoundsChange = useCallback((b: Bounds) => setBounds(b), []);
  const onSelect = useCallback((id: number) => setSelectedId(id), []);

  return (
    <div className="grid h-screen grid-rows-[45vh_1fr] md:grid-cols-[420px_1fr] md:grid-rows-1">
      <aside className="order-2 flex min-h-0 flex-col overflow-hidden border-t border-neutral-200 md:order-1 md:border-r md:border-t-0">
        <header className="flex items-baseline justify-between px-4 pt-4">
          <h1 className="text-lg font-semibold tracking-tight">키즈카페 지도</h1>
          <span className="text-xs text-neutral-400">MVP · 공공데이터 시드</span>
        </header>
        <FiltersBar filters={filters} onChange={setFilters} total={venues.length} visible={visible.length} />
        {error && <p className="m-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <VenueList venues={visible} hoveredId={hoveredId} selectedId={selectedId} onHover={setHoveredId} onSelect={onSelect} />
        </div>
      </aside>
      <main className="order-1 min-h-0 md:order-2">
        <MapView venues={filtered} hoveredId={hoveredId} selected={selected} onBoundsChange={onBoundsChange} onSelect={onSelect} />
      </main>
    </div>
  );
}
