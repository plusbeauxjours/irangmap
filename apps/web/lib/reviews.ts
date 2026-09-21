/** 카카오(다음) 블로그·카페 검색 결과를 후기 미리보기로 다듬는 순수 함수들. */
export interface ReviewItem {
  title: string;
  url: string;
  snippet: string;
  source: string; // 블로그명·카페명
  date: string; // YYYY-MM-DD
  kind: "blog" | "cafe";
  sponsored: boolean;
  /** 2 = 제목에 업소 토큰, 1 = 본문에만 (근처 맛집 글처럼 스치듯 언급된 경우) */
  relevance: 1 | 2;
}

const SPONSORED = /협찬|체험단|제공\s*받|원고료|광고|서포터즈|소정의|무상으로/;

export function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

/** 업소명에서 검색 결과 관련성 판정에 쓸 핵심 토큰: 법인 표기·지점 접미를 뗀 첫 단어(2자 이상). */
export function brandToken(name: string): string {
  const cleaned = name.replace(/\(주\)|㈜|주식회사/g, " ").replace(/\s+/g, " ").trim();
  const first = cleaned.split(" ")[0] ?? "";
  return first.replace(/(점|센터|지점)$/, "").slice(0, 8);
}

interface KakaoDoc {
  title: string;
  url: string;
  contents: string;
  datetime: string;
  blogname?: string;
  cafename?: string;
}

/** 두 검색(블로그·카페) 결과를 합치고, 업소 핵심 토큰이 없는 글은 버리고, 협찬 글은 뒤로 보낸다. */
export function shapeReviews(blog: KakaoDoc[], cafe: KakaoDoc[], venueName: string, limit = 5): ReviewItem[] {
  const token = brandToken(venueName);
  const items: ReviewItem[] = [];
  const seen = new Set<string>();
  const push = (docs: KakaoDoc[], kind: ReviewItem["kind"]) => {
    for (const d of docs) {
      const title = stripTags(d.title);
      const snippet = stripTags(d.contents);
      if (seen.has(d.url)) continue;
      const inTitle = token.length >= 2 && title.includes(token);
      if (token.length >= 2 && !inTitle && !snippet.includes(token)) continue;
      seen.add(d.url);
      items.push({
        title,
        url: d.url,
        snippet: snippet.slice(0, 120),
        source: d.blogname ?? d.cafename ?? "",
        date: d.datetime.slice(0, 10),
        kind,
        sponsored: SPONSORED.test(`${title} ${snippet}`),
        relevance: inTitle || token.length < 2 ? 2 : 1,
      });
    }
  };
  push(blog, "blog");
  push(cafe, "cafe");
  // 협찬 아닌 글 → 제목에 업소명이 있는 글 → 최신순
  items.sort((a, b) => Number(a.sponsored) - Number(b.sponsored) || b.relevance - a.relevance || b.date.localeCompare(a.date));
  return items.slice(0, limit);
}
