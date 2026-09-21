import { z } from "zod";

import { shapeReviews } from "@/lib/reviews";

/**
 * 카카오(다음) 블로그·카페 검색 → 후기 미리보기. 결과는 저장하지 않고 응답 캐시(1시간)만 둔다.
 * 네이버 검색 API가 신규 앱에 열리지 않아 대체한 경로. 결과에는 blog.naver.com 글도 포함된다.
 */
const Query = z.object({ q: z.string().trim().min(2).max(80), name: z.string().trim().min(1).max(120) });

export async function GET(req: Request) {
  const key = process.env.KAKAO_REST_API_KEY ?? process.env.AUTH_KAKAO_ID;
  if (!key) return Response.json({ items: [], disabled: true });
  const url = new URL(req.url);
  const parsed = Query.safeParse({ q: url.searchParams.get("q"), name: url.searchParams.get("name") });
  if (!parsed.success) return Response.json({ error: "q, name이 필요합니다" }, { status: 400 });
  const { q, name } = parsed.data;
  const headers = { Authorization: `KakaoAK ${key}` };
  const call = async (kind: "blog" | "cafe") => {
    const r = await fetch(`https://dapi.kakao.com/v2/search/${kind}?query=${encodeURIComponent(q)}&size=10&sort=accuracy`, { headers, next: { revalidate: 3600 } });
    if (!r.ok) return [];
    const j = (await r.json()) as { documents?: [] };
    return j.documents ?? [];
  };
  const [blog, cafe] = await Promise.all([call("blog"), call("cafe")]);
  return Response.json({ items: shapeReviews(blog, cafe, name) }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
