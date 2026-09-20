"use client";

import {
  type ExpressionSpecification,
  type GeoJSONSource,
  Map as MLMap,
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

  // 지도 생성 (1회)
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new MLMap({
      container: container.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: { base: { type: "raster", tiles: [TILES], tileSize: 256, attribution: ATTRIBUTION, maxzoom: 19 } },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      center: [127.6, 36.4],
      zoom: 6.3,
      minZoom: 5,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const emitBounds = () => {
      const b = map.getBounds();
      onBoundsChange({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };

    map.on("load", () => {
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
        id: "cluster-count",
        type: "symbol",
        source: "venues",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Open Sans Bold"] },
        paint: { "text-color": "#fff" },
      });
      map.addLayer({
        id: "points",
        type: "circle",
        source: "venues",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": COLOR_BY_CATEGORY,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 14, 8],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: "hover-ring",
        type: "circle",
        source: "hover",
        paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": 14, "circle-stroke-color": "#111827", "circle-stroke-width": 3 },
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
        const p = f.properties as { id: number; name: string; category: keyof typeof CATEGORY_LABEL; addr: string; sources: number };
        onSelect(Number(p.id));
        new Popup({ offset: 10, closeButton: false })
          .setLngLat(coordsOf(f.geometry))
          .setHTML(
            `<div style="font:13px/1.4 system-ui"><strong>${p.name}</strong><br/>${CATEGORY_LABEL[p.category] ?? p.category} · 출처 ${p.sources}개<br/><span style="color:#555">${p.addr}</span></div>`,
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
      map.remove();
      mapRef.current = null;
      setReady(false);
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

  return <div ref={container} className="h-full w-full" role="region" aria-label="지도" />;
}
