import { applyOverrides } from "./overrides";
import type { Venue } from "./venues";

const v = (id: number, sources: string[], attrs?: Venue["attrs"]): Venue => ({ id, name: `v${id}`, category: "kids_cafe", sources, addr: "", sido: "", lon: 0, lat: 0, attrs: attrs ?? null });

test("overrides win over existing attrs and mark the source", () => {
  const venues = [v(1, ["playground:1"], { source: "official", source_label: "브랜드", observed_at: "2026-09-20", child_fee: "옛 요금", socks: "필수" }), v(2, ["playground:2"])];
  const out = applyOverrides(venues, [{ venueKey: "playground:1", attrs: { child_fee: "새 요금" }, source: "owner", closed: 0, updatedAt: "2026-09-21T01:00:00.000Z" }]);
  expect(out[0].attrs?.child_fee).toBe("새 요금");
  expect(out[0].attrs?.socks).toBe("필수");
  expect(out[0].attrs?.source_label).toBe("사업자 확인");
  expect(out[0].attrs?.observed_at).toBe("2026-09-21");
  expect(out[0].sources).toContain("override:owner");
  expect(out[1].attrs).toBeNull();
});

test("closed overrides remove the venue", () => {
  const out = applyOverrides([v(1, ["a:1"]), v(2, ["a:2"])], [{ venueKey: "a:2", attrs: {}, source: "user", closed: 1, updatedAt: "2026-09-21T00:00:00Z" }]);
  expect(out.map((x) => x.id)).toEqual([1]);
});
