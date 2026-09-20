"use client";

import {
  type ExpressionSpecification,
  type GeoJSONSource,
  Map as MLMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

import { CATEGORY_LABEL, toFeatureCollection, type Bounds, type Venue } from "@/lib/venues";

const KEY = process.env.NEXT_PUBLIC_VWORLD_KEY ?? "";
const TILES = KEY
  ? `https://api.vworld.kr/req/wmts/1.0.0/${KEY}/Base/{z}/{y}/{x}.png`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = KEY ? "© VWorld(국토교통부)" : "© OpenStreetMap contributors";

const COLOR_BY_CATEGORY: ExpressionSpecification = [
  "match",
  ["get", "category"],
  "trampoline_park",
  "#2563eb",
  "#e11d48",
];

// 번들러(webpack/turbopack)가 maplibre의 모듈 워커 URL을 만들지 못해 빈 워커가 뜬다 →
// dist의 워커 파일을 public/vendor/에 복사(pnpm vendor)하고 정적 경로로 지정한다.
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const coordsOf = (geometry: unknown) => (geometry as { coordinates: [number, number] }).coordinates;

interface Props {
  venues: Venue[];
  hoveredId: number | null;
  selected: Venue | null;
  onBoundsChange: (b: Bounds) => void;
  onSelect: (id: number) => void;
}

export function MapView({ venues, hoveredId, selected, onBoundsChange, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  // 데이터 fetch와 지도 load의 순서가 보장되지 않으므로 state로 두고 effect를 다시 돌린다.
  const [ready, setReady] = useState(false);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const labelsRef = useRef<Map<number, Marker>>(new Map());

  // 지도 생성 (1회)
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    performance.mark("kc:map-create");
    const map = new MLMap({
      container: container.current,
      style: {
        version: 8,
        sources: { base: { type: "raster", tiles: [TILES], tileSize: 256, attribution: ATTRIBUTION, maxzoom: 19 } },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      center: [127.6, 36.4],
      zoom: 6.3,
      minZoom: 6,
      maxZoom: 17,
      scrollZoom: false, // 연속 줌 대신 아래에서 1레벨 단위 스냅 줌
      fadeDuration: 0,
      renderWorldCopies: false,
    });
    // 휠·트랙패드 줌을 정수 레벨 단위로 스냅한다. 연속 줌은 중간 단계마다 타일·클러스터를 다시 계산해 느리다.
    let wheelBusy = false;
    let wheelAcc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelBusy) return;
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < 30) return;
      const dir = wheelAcc > 0 ? -1 : 1;
      wheelAcc = 0;
      wheelBusy = true;
      const rect = map.getCanvas().getBoundingClientRect();
      const around = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
      const target = Math.min(17, Math.max(6, Math.round(map.getZoom()) + dir));
      map.easeTo({ zoom: target, around, duration: 220 });
      map.once("moveend", () => {
        wheelBusy = false;
      });
    };
    const canvasContainer = map.getCanvasContainer();
    canvasContainer.addEventListener("wheel", onWheel, { passive: false });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const emitBounds = () => {
      const b = map.getBounds();
      onBoundsChange({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };

    map.on("load", () => {
      performance.mark("kc:map-load");
      map.addSource("venues", {
        type: "geojson",
        data: toFeatureCollection([]),
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 13,
      });
      map.addSource("hover", { type: "geojson", data: toFeatureCollection([]) });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "venues",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#f43f5e",
          "circle-opacity": 0.85,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26, 200, 32],
        },
      });
      map.addLayer({
        id: "points",
        type: "circle",
        source: "venues",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": COLOR_BY_CATEGORY,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 14, 8],
          // 이용 정보가 확인된 업소는 초록 링 — 리스트의 체크 아이콘과 같은 뜻
          "circle-stroke-color": ["case", ["==", ["get", "verified"], 1], "#059669", "#fff"],
          "circle-stroke-width": ["case", ["==", ["get", "verified"], 1], 3, 1.5],
        },
      });
      map.addLayer({
        id: "hover-ring",
        type: "circle",
        source: "hover",
        paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": 14, "circle-stroke-color": "#111827", "circle-stroke-width": 3 },
      });

      // 클러스터 숫자: symbol 레이어는 원격 글리프(폰트)가 필요해 404·지연에 취약하다 → HTML 라벨.
      const syncClusterLabels = () => {
        const seen = new Set<number>();
        for (const f of map.queryRenderedFeatures({ layers: ["clusters"] })) {
          const id = f.properties.cluster_id as number;
          seen.add(id);
          if (!labelsRef.current.has(id)) {
            const el = document.createElement("div");
            el.className = "kc-cluster-label";
            el.textContent = String(f.properties.point_count_abbreviated);
            labelsRef.current.set(
              id,
              new Marker({ element: el }).setLngLat(coordsOf(f.geometry)).addTo(map),
            );
          }
        }
        for (const [id, marker] of labelsRef.current) {
          if (!seen.has(id)) {
            marker.remove();
            labelsRef.current.delete(id);
          }
        }
      };
      map.on("idle", syncClusterLabels);
      map.on("sourcedata", (e) => {
        if (e.sourceId === "venues" && e.isSourceLoaded) {
          performance.mark("kc:venues-source-loaded");
          setSourceLoaded(true);
        }
      });

      map.on("click", "clusters", async (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const src = map.getSource("venues") as GeoJSONSource;
        const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id as number);
        map.easeTo({ center: coordsOf(f.geometry), zoom });
      });
      map.on("click", "points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { id: number; name: string; category: keyof typeof CATEGORY_LABEL; addr: string; sources: number; verified: number };
        onSelect(Number(p.id));
        const verified = Number(p.verified) === 1 ? `<br/><span style="color:#059669">✓ 이용 정보 확인됨</span>` : "";
        new Popup({ offset: 10, closeButton: false })
          .setLngLat(coordsOf(f.geometry))
          .setHTML(
            `<div style="font:13px/1.4 system-ui"><strong>${p.name}</strong><br/>${CATEGORY_LABEL[p.category] ?? p.category}${verified}<br/><span style="color:#555">${p.addr}</span></div>`,
          )
          .addTo(map);
      });
      for (const layer of ["clusters", "points"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __kcMap?: MLMap }).__kcMap = map; // 개발 중 디버깅용
      }
      setReady(true);
      emitBounds();
    });
    map.on("moveend", emitBounds);
    return () => {
      canvasContainer.removeEventListener("wheel", onWheel);
      for (const marker of labelsRef.current.values()) marker.remove();
      labelsRef.current.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
      setSourceLoaded(false);
    };
    // onBoundsChange/onSelect는 부모가 useCallback으로 고정하므로 1회 생성으로 충분하다.
  }, []);

  // 필터 결과를 소스에 반영
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("venues") as GeoJSONSource | undefined)?.setData(toFeatureCollection(venues));
  }, [venues, ready]);

  // 리스트 hover → 링 표시
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const v = venues.find((x) => x.id === hoveredId);
    (map.getSource("hover") as GeoJSONSource | undefined)?.setData(toFeatureCollection(v ? [v] : []));
  }, [hoveredId, venues, ready]);

  // 리스트 클릭 → 이동
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    map.flyTo({ center: [selected.lon, selected.lat], zoom: Math.max(map.getZoom(), 15), speed: 1.4 });
  }, [selected]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" role="region" aria-label="지도" />
      <div className="pointer-events-none absolute bottom-6 left-3 hidden flex-col gap-1 md:flex rounded-lg bg-white/90 px-3 py-2 text-[11px] text-neutral-700 shadow" aria-label="범례">
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full border-2 border-white" style={{ background: "#e11d48" }} /> 키즈카페</span>
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full border-2 border-white" style={{ background: "#2563eb" }} /> 트램폴린</span>
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full border-2" style={{ background: "#e11d48", borderColor: "#059669" }} /> 이용 정보 확인됨</span>
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full text-center text-[7px] font-bold leading-3 text-white" style={{ background: "#f43f5e" }}>9</i> 묶음 · 클릭해 펼치기</span>
      </div>
      {!sourceLoaded && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-neutral-900/80 px-3 py-1 text-xs text-white shadow">
          {ready ? "업소 위치 표시 중…" : "지도 불러오는 중…"}
        </div>
      )}
    </div>
  );
}
