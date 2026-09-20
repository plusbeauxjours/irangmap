"""프랜차이즈 공식 사이트 추출물(official_attrs*.json)을 union 업소에 붙인다.

- 업소의 브랜드 = 이름에 든 FRANCHISE 키. 일반 명사 브랜드(channels.json의
  brand_type=generic: 방방·트램폴린파크 등)는 제외.
- 브랜드 공통(brand_level) 값은 그 브랜드 전 매장에 scope="brand"로, 매장별(stores[])
  값은 매장명의 지역 토큰(세종·일산·킨텍스…)이 업소 이름·주소에 있으면 scope="store"로
  덮어쓴다.
- 이미 attrs가 있는 업소(서울형 등 공공 출처)는 건드리지 않는다.
"""

import glob
import json
import re
from pathlib import Path
from typing import Any

from .classify import FRANCHISE
from .names import normalize_name

SOURCE = "official"
_FIELDS = (
    "age_range",
    "child_fee",
    "guardian_fee",
    "socks",
    "play_zones",
    "amenities",
    "hours",
    "notes",
    "reservation",
)
_STRIP = re.compile(
    r"키즈\s*카페|트램폴린\s*파크|트램펄린|파크|센터|매장|지점|\d*호?점\b|점\b|店|"
    r"롯데|이마트|신세계|백화점|빅마켓|스퀘어|몰|타워|프라자|플라자|아울렛|\(.*?\)"
)
_SIDO_SHORT = {
    "서울특별시": "서울",
    "경기도": "경기",
    "인천광역시": "인천",
    "부산광역시": "부산",
    "대구광역시": "대구",
    "대전광역시": "대전",
    "울산광역시": "울산",
    "세종특별자치시": "세종",
}


def brands_of(name: str, generic: set[str]) -> list[str]:
    """이름에 든 브랜드 키들(긴 것부터). '바운스 트램폴린파크'처럼 둘 이상일 수 있다."""
    n = normalize_name(name).replace(" ", "")
    out = []
    for key in sorted(FRANCHISE, key=len, reverse=True):
        if key in generic or key.startswith("서울형"):
            continue
        if key.replace(" ", "") in n:
            out.append(key)
    return out


def brand_of(name: str, generic: set[str]) -> str | None:
    hits = brands_of(name, generic)
    return hits[0] if hits else None


def locality_tokens(store_name: str, brand: str) -> list[str]:
    """'뽀로로파크 롯데빅마켓 영등포점' → ['영등포'], '세종센터' → ['세종']."""
    s = store_name.replace(brand, " ")
    for alias in ("뽀로로", "타요", "VAUNCE", "바운스", "챔피언", "플레이타임"):
        s = s.replace(alias, " ")
    s = _STRIP.sub(" ", s)
    toks = [t for t in re.split(r"[\s·,/&-]+", s) if len(t) >= 2 and not t.isdigit()]
    return toks


def store_matches(venue: dict[str, Any], store: dict[str, Any], brand: str) -> float:
    toks = locality_tokens(store.get("store_name") or "", brand)
    hay = f"{venue.get('name', '')} {venue.get('addr', '')}".replace(" ", "")
    if not toks:
        return 0.0
    hit = sum(1 for t in toks if t.replace(" ", "") in hay)
    score = hit / len(toks)
    addr = store.get("address") or ""
    vaddr = venue.get("addr") or ""
    if addr and vaddr:
        a = re.split(r"\s+", addr.strip())[:3]
        v = re.split(r"\s+", vaddr.strip())[:3]
        a = [_SIDO_SHORT.get(x, x) for x in a]
        v = [_SIDO_SHORT.get(x, x) for x in v]
        if len(a) >= 2 and len(v) >= 2 and a[1] == v[1]:
            score += 0.5  # 같은 시군구
        elif len(a) >= 2 and len(v) >= 2 and a[1] != v[1] and hit == 0:
            score -= 0.5
    return score


def load_results(pattern: str) -> list[dict[str, Any]]:
    out = []
    for p in sorted(glob.glob(pattern)):
        for v in json.loads(Path(p).read_text(encoding="utf-8")).values():
            if v.get("error") or not v.get("brand"):
                continue
            out.append(v)
    return out


def _pick(values: list[tuple[float, str | None]]) -> str | None:
    """confidence 높은 순으로 첫 non-null."""
    for _, v in sorted(values, key=lambda x: -x[0]):
        if v:
            return v
    return None


def build_brand_index(results: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    by_brand: dict[str, dict[str, Any]] = {}
    for r in results:
        brand = r["brand"]
        b = by_brand.setdefault(
            brand,
            {
                "brand_level": {f: [] for f in _FIELDS},
                "stores": {},
                "urls": [],
                "observed_at": r.get("observed_at"),
            },
        )
        conf = float(r.get("confidence") or 0)
        b["urls"].append(r["url"])
        if r.get("kind") != "store":
            # 매장 페이지의 brand_level 값은 그 매장 요금일 확률이 높다 → 공통값 제외
            for f in _FIELDS:
                b["brand_level"][f].append((conf, (r.get("brand_level") or {}).get(f)))
        for st in r.get("stores") or []:
            name = (st.get("store_name") or "").strip()
            if not name:
                continue
            cur = b["stores"].setdefault(
                name, {"store_name": name, "_conf": conf, "_url": r["url"]}
            )
            for f in (*_FIELDS, "address", "phone"):
                if st.get(f) and (not cur.get(f) or conf >= cur["_conf"]):
                    cur[f] = st[f]
                    cur["_url"] = r["url"]
    for b in by_brand.values():
        b["brand_level"] = {f: _pick(vals) for f, vals in b["brand_level"].items()}
    return by_brand


def to_attrs(
    brand: str, level: dict[str, Any], scope: str, url: str, observed: str
) -> dict[str, Any]:
    hours = level.get("hours")
    return {
        "source": SOURCE,
        "source_label": f"{brand} 공식 사이트",
        "scope": scope,
        "observed_at": observed,
        "evidence_url": url,
        "age_range": level.get("age_range"),
        "child_fee": level.get("child_fee"),
        "guardian_fee": level.get("guardian_fee"),
        "socks": level.get("socks"),
        "play_zones": level.get("play_zones"),
        "amenities": level.get("amenities"),
        "hours_text": hours,
        "notes": level.get("notes"),
        "reservation": level.get("reservation"),
    }


def attach(
    venues: list[dict[str, Any]],
    results: list[dict[str, Any]],
    generic: set[str],
    observed: str,
) -> dict[str, Any]:
    index = build_brand_index(results)
    stats = {"brands": len(index), "brand_scope": 0, "store_scope": 0, "no_data": 0}
    for v in venues:
        if v.get("attrs"):
            continue
        brand = next((b for b in brands_of(v["name"], generic) if b in index), None)
        if not brand:
            continue
        b = index[brand]
        best, best_score = None, 0.0
        for st in b["stores"].values():
            sc = store_matches(v, st, brand)
            if sc > best_score:
                best, best_score = st, sc
        merged = dict(b["brand_level"])
        scope, url = "brand", (b["urls"][0] if b["urls"] else None)
        if best and best_score >= 1.0:
            for f in _FIELDS:
                if best.get(f):
                    merged[f] = best[f]
            scope, url = "store", best["_url"]
            if not v.get("phone") and best.get("phone"):
                v["phone"] = best["phone"]
        if not any(
            merged.get(f)
            for f in ("age_range", "child_fee", "guardian_fee", "socks", "hours")
        ):
            stats["no_data"] += 1
            continue
        v["attrs"] = to_attrs(
            brand, merged, scope, url or "", b.get("observed_at") or observed
        )
        v["sources"].append(f"{SOURCE}:{brand}")
        stats[f"{scope}_scope"] += 1
    return stats
