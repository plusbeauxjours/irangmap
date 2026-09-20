export type Category = "kids_cafe" | "trampoline_park";

export interface Venue {
  id: number;
  name: string;
  category: Category;
  sources: string[];
  addr: string;
  sido: string;
  lon: number;
  lat: number;
  indoor?: string;
  public?: boolean;
  phone?: string | null;
  homepage?: string | null;
  attrs?: VenueAttrs | null;
}

/** 출처·확인일이 붙은 이용 정보. 지금은 서울형 키즈카페(우리동네키움포털)만 채워진다. */
export interface VenueAttrs {
  source: string;
  source_label: string;
  observed_at: string;
  evidence_url?: string | null;
  reservation_url?: string | null;
  photo_url?: string | null;
  age_range?: string | null;
  age_rules?: string | null;
  guardian_fee?: string | null;
  child_fee?: string | null;
  socks?: string | null;
  capacity?: Record<string, number> | null;
  operating_days?: string | null;
  closed_days?: string | null;
  hours?: string[] | null;
  hours_text?: string | null;
  child_fee_krw?: number | null;
  parking?: string | null;
  notes?: string | null;
  discounts?: string | null;
  reservation?: string | null;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Filters {
  query: string;
  categories: Set<Category>;
  multiSourceOnly: boolean;
  indoorOnly: boolean;
  publicOnly: boolean;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  kids_cafe: "키즈카페",
  trampoline_park: "트램폴린",
};

export const SOURCE_LABEL: Record<string, string> = {
  playground: "놀이시설 등록",
  themepark: "테마파크업 신고",
  rest_cafes: "휴게음식점 인허가",
  umppa: "서울시 우리동네키움포털",
};

// 소스마다 시도 표기가 다르다 (놀이시설: "경기", 인허가: "경기도").
const SIDO_ALIASES: Record<string, string> = {
  서울: "서울특별시",
  경기: "경기도",
  인천: "인천광역시",
  부산: "부산광역시",
  대구: "대구광역시",
  대전: "대전광역시",
  울산: "울산광역시",
  세종: "세종특별자치시",
  광주: "전남광주통합특별시",
  전남: "전남광주통합특별시",
  전라남도: "전남광주통합특별시",
  광주광역시: "전남광주통합특별시",
  강원: "강원특별자치도",
  강원도: "강원특별자치도",
  충북: "충청북도",
  충남: "충청남도",
  전북: "전북특별자치도",
  전라북도: "전북특별자치도",
  경북: "경상북도",
  경남: "경상남도",
  제주: "제주특별자치도",
};

export function normalizeSido(addr: string | undefined): string {
  const first = (addr ?? "").trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return SIDO_ALIASES[first] ?? first;
}

interface Feature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, unknown>;
}

export function parseVenues(geojson: { features: Feature[] }): Venue[] {
  return geojson.features.map((f) => {
    const p = f.properties;
    const addr = String(p.addr ?? "");
    return {
      id: Number(p.id),
      name: String(p.name ?? ""),
      category: (p.category as Category) ?? "kids_cafe",
      sources: (p.sources as string[]) ?? [],
      addr,
      sido: normalizeSido(addr),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      indoor: p.indoor as string | undefined,
      public: Boolean(p.public),
      phone: (p.phone as string | null | undefined) ?? null,
      homepage: (p.homepage as string | null | undefined) ?? null,
      attrs: (p.attrs as VenueAttrs | null | undefined) ?? null,
    };
  });
}

export const DEFAULT_FILTERS: Filters = {
  query: "",
  categories: new Set<Category>(["kids_cafe", "trampoline_park"]),
  multiSourceOnly: false,
  indoorOnly: false,
  publicOnly: false,
};

export function filterVenues(venues: Venue[], f: Filters): Venue[] {
  const q = f.query.trim().toLowerCase();
  return venues.filter((v) => {
    if (!f.categories.has(v.category)) return false;
    if (f.multiSourceOnly && v.sources.length < 2) return false;
    if (f.indoorOnly && v.indoor !== "실내") return false;
    if (f.publicOnly && !v.public) return false;
    if (q && !`${v.name} ${v.addr}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function inBounds(v: Venue, b: Bounds): boolean {
  return v.lon >= b.west && v.lon <= b.east && v.lat >= b.south && v.lat <= b.north;
}

export function toFeatureCollection(venues: Venue[]) {
  return {
    type: "FeatureCollection" as const,
    features: venues.map((v) => ({
      type: "Feature" as const,
      id: v.id,
      geometry: { type: "Point" as const, coordinates: [v.lon, v.lat] },
      properties: { id: v.id, name: v.name, category: v.category, addr: v.addr, sources: v.sources.length },
    })),
  };
}


/** 외부 서비스 검색 딥링크 — 데이터 저장 없이 링크만 (카카오 place_id·네이버는 링크아웃 원칙). */
export function linkouts(v: Venue) {
  const q = encodeURIComponent(`${v.name} ${v.sido}`.trim());
  const qAddr = encodeURIComponent(`${v.name} ${v.addr}`.trim());
  return [
    { key: "kakao", label: "카카오맵", href: `https://map.kakao.com/?q=${qAddr}` },
    { key: "naver", label: "네이버 지도", href: `https://map.naver.com/p/search/${q}` },
    { key: "google", label: "구글 검색", href: `https://www.google.com/search?q=${qAddr}` },
    { key: "instagram", label: "인스타그램", href: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(v.name.replace(/\s+/g, ""))}` },
  ];
}

/** 부모가 실제로 보는 이용 정보. 값은 공식 채널·사업자 확인 후 채운다 (Phase 2). */
export const ATTRIBUTE_SCHEMA = [
  { key: "age_range", label: "이용 연령", hint: "예: 12개월~7세, 초등생 입장 가능" },
  { key: "guardian_fee", label: "보호자 요금", hint: "보호자 무료/유료, 음료 포함 여부" },
  { key: "child_fee", label: "아동 요금·시간", hint: "시간제/종일, 추가 시간 요금" },
  { key: "socks", label: "양말 착용", hint: "미끄럼방지 양말 필수 여부, 현장 판매" },
  { key: "play_zones", label: "놀이 공간", hint: "볼풀·트램폴린·정글짐·모래·역할놀이·유아존" },
  { key: "amenities", label: "편의 시설", hint: "어른 카페·식사·수유실·기저귀 교환대·주차" },
  { key: "notes", label: "유의사항", hint: "보호자 동반 규칙, 예약 필수 여부, 휴무" },
  { key: "photos", label: "사진", hint: "사업자·이용자 제공 사진" },
] as const;
