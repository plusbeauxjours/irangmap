import { brandToken, shapeReviews, stripTags } from "./reviews";

test("brandToken strips corporate prefix and branch suffix", () => {
  expect(brandToken("(주)바운스 세종센터")).toBe("바운스");
  expect(brandToken("서울형 키즈카페 시립 1호점")).toBe("서울형");
  expect(brandToken("챔피언1250 더리버몰점")).toBe("챔피언1250");
});

test("shapeReviews drops unrelated docs, dedupes, pushes sponsored last, newest first", () => {
  const doc = (title: string, url: string, contents = "", datetime = "2026-09-01T00:00:00.000+09:00") => ({ title, url, contents, datetime, blogname: "b" });
  const items = shapeReviews(
    [
      doc("<b>바운스</b> 세종 다녀온 <b>후기</b>", "https://a/1", "협찬 받아 다녀왔어요", "2026-09-10T00:00:00.000+09:00"),
      doc("세종 장난감 대여 노리마루", "https://a/2", "에어 미끄럼틀"),
      doc("바운스 트램폴린 솔직 후기", "https://a/3", "아이랑", "2026-09-05T00:00:00.000+09:00"),
      doc("바운스 트램폴린 솔직 후기", "https://a/3", "중복"),
      doc("나성동 부대찌개 맛집", "https://a/4", "바운스 근처 맛집", "2026-09-09T00:00:00.000+09:00"),
    ],
    [],
    "(주)바운스 세종센터",
  );
  expect(items.map((i) => i.url)).toEqual(["https://a/3", "https://a/4", "https://a/1"]);
  expect(items[1].relevance).toBe(1);
  expect(items[2].sponsored).toBe(true);
  expect(stripTags("<b>세종</b> &amp; 후기")).toBe("세종 & 후기");
});
