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
