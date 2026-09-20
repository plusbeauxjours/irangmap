"use client";

import { useEffect, useRef, useState } from "react";

import { CATEGORY_LABEL, type Bounds, type Venue } from "@/lib/venues";

interface Props {
  venues: Venue[];
  hoveredId: number | null;
  selected: Venue | null;
  onBoundsChange: (b: Bounds) => void;
  onSelect: (id: number) => void;
}

const KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
const SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false&libraries=clusterer`;
const COLOR: Record<Venue["category"], string> = { kids_cafe: "#e11d48", trampoline_park: "#2563eb" };
// 카카오 레벨: 1(가장 확대) ~ 14(가장 축소). 13이면 남한 전체가 한 화면에 든다.
const LEVEL_COUNTRY = 13;
const LEVEL_DETAIL = 3;
const CLUSTER_MIN_LEVEL = 5; // 이 레벨 미만(더 확대)에서는 개별 마커

let sdkPromise: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const w = window as unknown as { kakao?: { maps?: { load?: (cb: () => void) => void } } };
    if (w.kakao?.maps?.load) {
      w.kakao.maps.load(resolve);
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => kakao.maps.load(resolve);
    s.onerror = () => reject(new Error("카카오맵 SDK를 불러오지 못했습니다 (키·도메인 등록·카카오맵 활성화 확인)"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

function markerSvg(fill: string, verified: boolean): string {
  const stroke = verified ? "#059669" : "#ffffff";
  const width = verified ? 3 : 2;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'><circle cx='11' cy='11' r='8' fill='${fill}' stroke='${stroke}' stroke-width='${width}'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function toBounds(b: kakao.maps.LatLngBounds): Bounds {
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return { west: sw.getLng(), south: sw.getLat(), east: ne.getLng(), north: ne.getLat() };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function KakaoMapView({ venues, hoveredId, selected, onBoundsChange, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const clustererRef = useRef<kakao.maps.MarkerClusterer | null>(null);
  const markersRef = useRef<Map<number, kakao.maps.Marker>>(new Map());
  const imagesRef = useRef<Map<string, kakao.maps.MarkerImage>>(new Map());
  const ringRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const popupRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const venuesRef = useRef<Venue[]>(venues);
  venuesRef.current = venues;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onBoundsRef = useRef(onBoundsChange);
  onBoundsRef.current = onBoundsChange;
  const [ready, setReady] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 지도 생성 (한 번)
  useEffect(() => {
    let cancelled = false;
    performance.mark("kc:map-create");
    loadSdk()
      .then(() => {
        if (cancelled || !container.current) return;
        const map = new kakao.maps.Map(container.current, {
          center: new kakao.maps.LatLng(36.4, 127.6),
          level: LEVEL_COUNTRY,
        });
        map.setMaxLevel(LEVEL_COUNTRY);
        mapRef.current = map;
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: CLUSTER_MIN_LEVEL,
          minClusterSize: 2,
          gridSize: 70,
          disableClickZoom: false,
          calculator: [10, 50, 200],
          styles: [36, 42, 50, 60].map((px) => ({
            width: `${px}px`,
            height: `${px}px`,
            lineHeight: `${px}px`,
            borderRadius: `${px / 2}px`,
            background: "rgba(244,63,94,.85)",
            border: "2px solid #fff",
            color: "#fff",
            textAlign: "center",
            fontWeight: "600",
            fontSize: "12px",
            boxShadow: "0 1px 4px rgba(0,0,0,.25)",
          })),
        });
        const ringEl = document.createElement("div");
        ringEl.style.cssText = "width:28px;height:28px;border-radius:50%;border:3px solid #111827;pointer-events:none;box-sizing:border-box";
        ringRef.current = new kakao.maps.CustomOverlay({ content: ringEl, xAnchor: 0.5, yAnchor: 0.5, zIndex: 5 });
        kakao.maps.event.addListener(map, "idle", () => onBoundsRef.current(toBounds(map.getBounds())));
        kakao.maps.event.addListener(map, "click", () => popupRef.current?.setMap(null));
        onBoundsRef.current(toBounds(map.getBounds()));
        performance.mark("kc:map-load");
        setReady(true);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // 업소 → 마커. 마커 객체는 업소 id별로 한 번만 만들고(2,900개 생성이 가장 비싼 일),
  // 필터가 바뀌면 클러스터러에 넣는 집합만 바꾼다.
  useEffect(() => {
    const map = mapRef.current;
    const clusterer = clustererRef.current;
    if (!ready || !map || !clusterer) return;
    const image = (cat: Venue["category"], verified: boolean) => {
      const k = `${cat}:${verified ? 1 : 0}`;
      let img = imagesRef.current.get(k);
      if (!img) {
        img = new kakao.maps.MarkerImage(markerSvg(COLOR[cat], verified), new kakao.maps.Size(22, 22), { offset: new kakao.maps.Point(11, 11) });
        imagesRef.current.set(k, img);
      }
      return img;
    };
    const showPopup = (v: Venue, m: kakao.maps.Marker) => {
      const verified = v.attrs ? `<br/><span style="color:#059669">✓ 이용 정보 확인됨</span>` : "";
      const html = `<div style="font:13px/1.4 system-ui;background:#fff;border-radius:8px;padding:8px 10px;box-shadow:0 2px 8px rgba(0,0,0,.2);max-width:240px"><strong>${escapeHtml(v.name)}</strong><br/>${CATEGORY_LABEL[v.category]}${verified}<br/><span style="color:#555">${escapeHtml(v.addr)}</span></div>`;
      if (!popupRef.current) popupRef.current = new kakao.maps.CustomOverlay({ content: html, position: m.getPosition(), yAnchor: 1.4, zIndex: 10 });
      else {
        popupRef.current.setContent(html);
        popupRef.current.setPosition(m.getPosition());
      }
      popupRef.current.setMap(map);
    };
    const markers: kakao.maps.Marker[] = [];
    for (const v of venues) {
      let m = markersRef.current.get(v.id);
      if (!m) {
        m = new kakao.maps.Marker({ position: new kakao.maps.LatLng(v.lat, v.lon), image: image(v.category, Boolean(v.attrs)), title: v.name, clickable: true });
        const marker = m;
        kakao.maps.event.addListener(marker, "click", () => {
          onSelectRef.current(v.id);
          showPopup(v, marker);
        });
        markersRef.current.set(v.id, m);
      }
      markers.push(m);
    }
    clusterer.clear();
    clusterer.addMarkers(markers);
    performance.mark("kc:venues-source-loaded");
    setPlaced(true);
  }, [venues, ready]);

  // 리스트 hover → 링
  useEffect(() => {
    const map = mapRef.current;
    const ring = ringRef.current;
    if (!map || !ring) return;
    const v = hoveredId === null ? undefined : venuesRef.current.find((x) => x.id === hoveredId);
    if (!v) {
      ring.setMap(null);
      return;
    }
    ring.setPosition(new kakao.maps.LatLng(v.lat, v.lon));
    ring.setMap(map);
  }, [hoveredId]);

  // 리스트 클릭 → 이동
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const pos = new kakao.maps.LatLng(selected.lat, selected.lon);
    if (map.getLevel() > LEVEL_DETAIL) map.setLevel(LEVEL_DETAIL, { anchor: pos });
    map.panTo(pos);
  }, [selected]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" role="region" aria-label="지도" />
      <div className="pointer-events-none absolute bottom-6 left-3 flex flex-col gap-1 rounded-lg bg-white/90 px-3 py-2 text-[11px] text-neutral-700 shadow" aria-label="범례">
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full border-2 border-white" style={{ background: "#e11d48" }} /> 키즈카페</span>
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full border-2 border-white" style={{ background: "#2563eb" }} /> 트램폴린</span>
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full border-2" style={{ background: "#e11d48", borderColor: "#059669" }} /> 이용 정보 확인됨</span>
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full text-center text-[7px] font-bold leading-3 text-white" style={{ background: "#f43f5e" }}>9</i> 묶음 · 클릭해 펼치기</span>
      </div>
      {error ? (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-rose-600 px-3 py-2 text-xs text-white shadow">{error}</div>
      ) : (
        !placed && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-neutral-900/80 px-3 py-1 text-xs text-white shadow">
            {ready ? "업소 위치 표시 중…" : "카카오맵 불러오는 중…"}
          </div>
        )
      )}
    </div>
  );
}
