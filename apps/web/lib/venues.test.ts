import { firstAmount } from "./facts";
import { ATTRIBUTE_SCHEMA, DEFAULT_FILTERS, filterVenues, inBounds, linkouts, normalizeSido, parseVenues, regionHint, type Venue } from "./venues";

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
  expect(links.map((l) => l.key)).toEqual(["naver_blog", "naver_cafe", "kakao", "naver", "google"]);
  expect(links[2].href).toContain(encodeURIComponent("서울형 키즈카페 시립1호점 서울 동작구 노량진로 10"));
  expect(links[0].href).toBe(`https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent("서울형 키즈카페 시립1호점 동작구 후기")}`);
  expect(links[1].href).toContain("where=article");
});

test("regionHint keeps gu/si tokens and the dong in parentheses, and strips (주)", () => {
  expect(regionHint("경기도 수원시 영통구 덕영대로 1566, 더 판타지움 3층 (영통동)")).toBe("수원시 영통구 영통동");
  expect(regionHint("서울 강동구 고덕비즈밸리로 51")).toBe("강동구");
  expect(regionHint(undefined)).toBe("");
  const v = { ...venues[1], name: "(주)바운스 세종센터", addr: "세종특별자치시 국세청로 32 (나성동)" };
  expect(decodeURIComponent(linkouts(v)[0].href)).toContain("바운스 세종센터 나성동 후기");
  expect(decodeURIComponent(linkouts(v)[2].href)).not.toContain("(주)");
});

test("attribute schema covers what parents check first", () => {
  const keys = ATTRIBUTE_SCHEMA.map((a) => a.key);
  expect(keys).toEqual(expect.arrayContaining(["age_range", "guardian_fee", "socks", "notes", "photos"]));
});


describe("firstAmount", () => {
  it("picks the first won amount and marks ranges", () => {
    expect(firstAmount("2시간권 25,000원, 200분 32,000원")).toBe("25,000원~");
    expect(firstAmount("보호자입장권 8,000원")).toBe("8,000원");
    expect(firstAmount("무료")).toBeNull();
  });
});
