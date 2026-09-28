"""블로그·카페 후기(카카오 다음 검색) → 이용 정보 속성. 공식·서울형이 없는 업소만.

- 검색: 업소명(법인 표기 제거) + 주소 지역 힌트 + "요금". 블로그·카페 각 10건.
- 걸러내기는 웹 `lib/reviews.ts`와 같다: 업소 핵심 토큰이 제목·요약에 없는 글은 버리고,
  협찬 의심 글은 뒤로, 제목 일치 우선, 최신순.
- 저장 최소화: 글 본문·제목은 저장하지 않는다. 값마다 근거 글 URL·작성일과
  100자 이하 근거 구절만 남긴다(`data/derived/review_attrs.json`).
- 출처 source="review"(공식보다 낮은 신뢰). export 때 attrs가 없는 업소에만 붙는다.
"""

import re
from typing import Any

SOURCE = "review"
SPONSORED = re.compile(r"협찬|체험단|제공\s*받|원고료|광고|서포터즈|소정의|무상으로")
FIELDS = (
    "age_range",
    "child_fee",
    "guardian_fee",
    "socks",
    "hours",
    "parking",
    "reservation",
    "play_zones",
    "amenities",
)
CORE = ("age_range", "child_fee", "guardian_fee", "socks")
MIN_CONFIDENCE = 0.5
SNIPPET_MAX = 100


def strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s or "")
    for a, b in (("&quot;", '"'), ("&lt;", "<"), ("&gt;", ">"), ("&amp;", "&")):
        s = s.replace(a, b)
    return s.strip()


def search_name(name: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"\(주\)|주식회사|㈜", " ", name)).strip()


def brand_token(name: str) -> str:
    """lib/reviews.ts brandToken과 같다: 법인 표기·지점 접미를 뗀 첫 단어(최대 8자)."""
    first = (search_name(name).split(" ") or [""])[0]
    return re.sub(r"(점|센터|지점)$", "", first)[:8]


def region_hint(addr: str | None) -> str:
    """lib/venues.ts regionHint와 같다: 구·시·군 두 토큰 + 괄호 안 동."""
    a = addr or ""
    m = re.search(r"\(([가-힣0-9]+동)(?=[),\s])", a)
    parts = re.sub(r"\(.*?\)", " ", a).split()
    gu = [p for p in parts[1:] if re.search(r"(구|시|군)$", p) and len(p) <= 6][:2]
    return " ".join([*gu, *([m.group(1)] if m else [])])


def query_of(name: str, addr: str | None) -> str:
    return re.sub(r"\s+", " ", f"{search_name(name)} {region_hint(addr)} 요금").strip()


def shape_posts(
    blog: list[dict[str, Any]],
    cafe: list[dict[str, Any]],
    venue_name: str,
    limit: int = 6,
) -> list[dict[str, Any]]:
    """두 검색 결과 → 관련 글(본문 요약은 메모리에만). reviews.ts shapeReviews 규칙."""
    token = brand_token(venue_name)
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for docs, kind in ((blog, "blog"), (cafe, "cafe")):
        for d in docs:
            url = d.get("url") or ""
            if not url or url in seen:
                continue
            title, snippet = (
                strip_tags(d.get("title", "")),
                strip_tags(d.get("contents", "")),
            )
            in_title = len(token) >= 2 and token in title
            if len(token) >= 2 and not in_title and token not in snippet:
                continue
            seen.add(url)
            items.append(
                {
                    "title": title,
                    "snippet": snippet,
                    "url": url,
                    "date": (d.get("datetime") or "")[:10],
                    "kind": kind,
                    "sponsored": bool(SPONSORED.search(f"{title} {snippet}")),
                    "relevance": 2 if in_title or len(token) < 2 else 1,
                }
            )
    items.sort(key=lambda x: x["date"], reverse=True)
    items.sort(key=lambda x: (x["sponsored"], -x["relevance"]))
    return items[:limit]


_VAL = {
    "type": "object",
    "properties": {
        "value": {"type": ["string", "null"]},
        "post": {"type": ["integer", "null"], "description": "근거 글 번호"},
        "evidence": {
            "type": ["string", "null"],
            "description": "근거 구절 원문(100자 이내)",
        },
    },
}
SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "same_venue": {
            "type": "boolean",
            "description": "글들이 대상 업소(같은 지점)에 대한 것인가",
        },
        **{f: _VAL for f in FIELDS},
        "confidence": {"type": "number"},
    },
}
SYSTEM = (
    "너는 한국 키즈카페 방문 후기 검색 결과(제목+요약)에서 "
    "부모가 보는 이용 정보를 뽑는다. "
    "대상 업소와 같은 지점에 대한 글의 내용만 쓴다"
    "(다른 지점·다른 업소·주변 가게 글은 무시). "
    "글에 명시되지 않은 값은 null. 추측 금지. 값은 짧게(예: '12개월~만 7세', "
    "'아동 2시간 15,000원', '보호자 3,000원', '미끄럼방지 양말 필수'). "
    "age_range=이용 연령, child_fee=아동 요금, guardian_fee=보호자 요금, "
    "socks=양말 규정, "
    "hours=운영시간, parking=주차, reservation=예약 방법. "
    "age_range는 입장 가능 연령 규정이 명시된 경우만(글쓴이 아이의 나이는 아님). "
    "무인 키즈룸 등 공간 단위 대관 요금이면 child_fee 값을 반드시 '대관'으로 시작한다"
    "(예: '대관 평일 30분 20,000원'). 요금이 글에 없으면 guardian_fee도 null. "
    "post는 근거 글 번호, evidence는 근거 원문 구절(100자 이내). "
    "confidence는 값들이 이 업소에 대해 명시된 정도(0~1). "
    "글이 오래됐거나 서로 다르면 낮춘다."
)


def build_prompt(name: str, addr: str | None, posts: list[dict[str, Any]]) -> str:
    lines = [f"대상 업소: {name}\n주소: {addr or ''}\n\n=== 검색 결과 ==="]
    for i, p in enumerate(posts, 1):
        tag = " [협찬 의심]" if p["sponsored"] else ""
        lines.append(f"[{i}] ({p['date']}){tag} {p['title']}\n{p['snippet']}")
    return "\n\n".join(lines)


def compact(data: dict[str, Any], posts: list[dict[str, Any]]) -> dict[str, Any]:
    """LLM 결과 → 저장용: 값 + 근거 글 URL·날짜 + 100자 근거. 본문은 버린다."""
    out: dict[str, Any] = {
        "same_venue": bool(data.get("same_venue")),
        "confidence": data.get("confidence"),
        "values": {},
    }
    for f in FIELDS:
        item = data.get(f) or {}
        val = item.get("value")
        if not val:
            continue
        idx = item.get("post")
        post = (
            posts[idx - 1] if isinstance(idx, int) and 1 <= idx <= len(posts) else None
        )
        out["values"][f] = {
            "value": val,
            "url": post["url"] if post else None,
            "date": post["date"] if post else None,
            "evidence": (item.get("evidence") or "")[:SNIPPET_MAX] or None,
        }
    return out


def to_attrs(rec: dict[str, Any]) -> dict[str, Any] | None:
    """캐시 레코드 → GeoJSON attrs. 기준 미달이면 None."""
    if rec.get("error") or not rec.get("same_venue"):
        return None
    if float(rec.get("confidence") or 0) < MIN_CONFIDENCE:
        return None
    vals = {f: v for f, v in (rec.get("values") or {}).items() if v.get("url")}
    if not any(f in vals for f in CORE):
        return None
    dates = sorted((v["date"] for v in vals.values() if v.get("date")), reverse=True)
    first = next(v for f, v in vals.items())
    return {
        "source": SOURCE,
        "source_label": "블로그·카페 후기",
        "scope": None,
        "observed_at": dates[0] if dates else rec.get("fetched_at", ""),
        "evidence_url": first["url"],
        "confidence": rec.get("confidence"),
        "age_range": (vals.get("age_range") or {}).get("value"),
        "child_fee": (vals.get("child_fee") or {}).get("value"),
        "guardian_fee": (vals.get("guardian_fee") or {}).get("value"),
        "socks": (vals.get("socks") or {}).get("value"),
        "hours_text": (vals.get("hours") or {}).get("value"),
        "parking": (vals.get("parking") or {}).get("value"),
        "reservation": (vals.get("reservation") or {}).get("value"),
        "play_zones": (vals.get("play_zones") or {}).get("value"),
        "amenities": (vals.get("amenities") or {}).get("value"),
        "evidence": {
            f: {k: v[k] for k in ("url", "date", "evidence")} for f, v in vals.items()
        },
    }


def attach(venues: list[dict[str, Any]], cache: dict[str, Any]) -> dict[str, int]:
    """공식·서울형 attrs가 없는 업소에만 후기 attrs를 붙인다. 키 = sources[0]."""
    stats = {"attached": 0, "skipped_has_attrs": 0, "below_threshold": 0}
    for v in venues:
        rec = cache.get((v.get("sources") or [""])[0])
        if not rec:
            continue
        if v.get("attrs"):
            stats["skipped_has_attrs"] += 1
            continue
        attrs = to_attrs(rec)
        if not attrs:
            stats["below_threshold"] += 1
            continue
        v["attrs"] = attrs
        stats["attached"] += 1
    return stats
