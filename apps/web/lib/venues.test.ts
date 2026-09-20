import { ATTRIBUTE_SCHEMA, DEFAULT_FILTERS, filterVenues, inBounds, linkouts, normalizeSido, parseVenues, type Venue } from "./venues";

const gj = {
  features: [
    { geometry: { coordinates: [127.0, 37.5] as [number, number] }, properties: { id: 1, name: "까르르키즈카페 에코점", category: "kids_cafe", sources: ["playground:1", "themepark:3010000:A1"], addr: "경기 김포시 유현로 242", indoor: "실내", public: false } },
    { geometry: { coordinates: [129.0, 35.1] as [number, number] }, properties: { id: 2, name: "점핑몬스터 부산점", category: "trampoline_park", sources: ["themepark:2600000:B1"], addr: "부산광역시 중구 흑교로 74", indoor: "실내", public: false } },
    { geometry: { coordinates: [126.9, 37.51] as [number, number] }, properties: { id: 3, name: "서울형 키즈카페 시립1호점", category: "kids_cafe", sources: ["playground:9"], addr: "서울 동작구 노량진로 10", indoor: "실내", public: true } },
  ],
};
const venues: Venue[] = parseVenues(gj);

test("parseVenues normalizes short sido names from the playground source", () => {
  expect(venues.map((v) => v.sido)).toEqual(["경기도", "부산광역시", "서울특별시"]);
  expect(normalizeSido("")).toBe("");
});

test("filterVenues applies category, multi-source, public and query filters", () => {
  expect(filterVenues(venues, DEFAULT_FILTERS)).toHaveLength(3);
  expect(filterVenues(venues, { ...DEFAULT_FILTERS, categories: new Set(["trampoline_park"]) }).map((v) => v.id)).toEqual([2]);
  expect(filterVenues(venues, { ...DEFAULT_FILTERS, multiSourceOnly: true }).map((v) => v.id)).toEqual([1]);
  expect(filterVenues(venues, { ...DEFAULT_FILTERS, publicOnly: true }).map((v) => v.id)).toEqual([3]);
  expect(filterVenues(venues, { ...DEFAULT_FILTERS, query: "노량진" }).map((v) => v.id)).toEqual([3]);
});

test("inBounds keeps only venues inside the viewport", () => {
  const seoul = { west: 126.7, south: 37.4, east: 127.2, north: 37.7 };
  expect(venues.filter((v) => inBounds(v, seoul)).map((v) => v.id)).toEqual([1, 3]);
});


test("linkouts build encoded search deep links for each external service", () => {
  const links = linkouts(venues[2]);
  expect(links.map((l) => l.key)).toEqual(["kakao", "naver", "google", "instagram"]);
  expect(links[0].href).toContain(encodeURIComponent("서울형 키즈카페 시립1호점 서울 동작구 노량진로 10"));
  expect(links[3].href).toContain(encodeURIComponent("서울형키즈카페시립1호점"));
});

test("attribute schema covers what parents check first", () => {
  const keys = ATTRIBUTE_SCHEMA.map((a) => a.key);
  expect(keys).toEqual(expect.arrayContaining(["age_range", "guardian_fee", "socks", "notes", "photos"]));
});
