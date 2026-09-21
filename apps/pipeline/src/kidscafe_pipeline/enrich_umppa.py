"""서울형 키즈카페(umppa) 수집물을 union 업소에 붙인다.

주소 → VWorld 지오코딩(캐시) → 300m 안 이름 유사도 매칭(resolve.best_match).
strong/weak 매칭이면 그 업소에 `attrs`(출처·확인일 포함)를 붙이고, 매칭이 없으면
umppa 단독 업소로 추가한다(서울시가 운영하므로 public=True).
"""

import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

import httpx

from .geocode import VWorldGeocoder
from .names import name_similarity
from .resolve import Candidate, Match, SpatialIndex, tier_of
from .sources.umppa import parse_fee_text

SOURCE = "umppa"
SOURCE_LABEL = "서울시 우리동네키움포털"


def _norm_addr(addr: str) -> str:
    """괄호(법정동)와 층·호를 떼어 지오코딩이 잘 되는 도로명만 남긴다."""
    a = re.sub(r"\([^)]*\)", " ", addr)
    a = re.sub(r"\s+\S*(\d+층|지하\s*\d*층|B\d+|\d+호)\S*.*$", "", a)
    return re.sub(r"\s+", " ", a).strip()


def geocode_all(
    facilities: list[dict[str, Any]], geocoder: VWorldGeocoder, cache_path: Path
) -> dict[str, tuple[float, float]]:
    cache: dict[str, Any] = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
    for f in facilities:
        fid = f["fclty_id"]
        if fid in cache:
            continue
        addr = _norm_addr(f.get("address") or "")
        try:
            got = geocoder.geocode(addr) or (
                geocoder.geocode(" ".join(addr.split()[:4])) if addr else None
            )
        except httpx.HTTPError as e:
            # GitHub 러너에서는 VWorld가 닿지 않는다(2026-09-21). 새 시설만 좌표 없이
            # 넘기고 캐시된 것은 그대로 쓴다 — 다음 로컬 실행 때 채워진다.
            print(f"geocode skipped {fid}: {type(e).__name__}", file=sys.stderr)
            continue
        cache[fid] = [got.lon, got.lat] if got else None
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    return {k: (v[0], v[1]) for k, v in cache.items() if v}


def to_attrs(f: dict[str, Any], observed: str) -> dict[str, Any]:
    d = f.get("detail") or {}
    lo = d.get("age_min") if d.get("age_min") is not None else f.get("age_min")
    hi = d.get("age_max") if d.get("age_max") is not None else f.get("age_max")
    fees = parse_fee_text(d.get("fee_text"))
    fee = (
        fees["fee_child_krw"]
        if fees["fee_child_krw"] is not None
        else d.get("fee_child_krw")
    )
    if fee == 0:
        fee_txt: str | None = "무료"
    elif fees["fee_child_text"]:
        fee_txt = fees["fee_child_text"]
    elif fee:
        fee_txt = f"아동 1명당 {fee:,}원"
    else:
        fee_txt = None
    guardian_free = fees["guardian_free"] or bool(d.get("guardian_free"))
    guardian_txt = "보호자 무료" if guardian_free else fees["guardian_text"]
    slots = d.get("hours_slots") or []
    age_range = None
    if lo is not None and hi is not None:
        age_range = f"{lo}~{hi}세 (연나이)"
    return {
        "source": SOURCE,
        "source_label": SOURCE_LABEL,
        "observed_at": observed,
        "evidence_url": d.get("view_url"),
        "reservation_url": d.get("reservation_url"),
        "photo_url": f.get("thumbnail_url"),
        "age_range": age_range,
        "age_rules": (d.get("age_rules") or "")[:600] or None,
        "guardian_fee": guardian_txt,
        "child_fee": fee_txt,
        "child_fee_krw": fee,
        "socks": ("미끄럼방지 양말 필수" if d.get("socks_required") else None),
        "capacity": f.get("capacity") or None,
        "operating_days": d.get("operating_days"),
        "closed_days": d.get("closed_days"),
        "hours": slots[:8] or None,
        "hours_text": d.get("hours_text"),
        "parking": d.get("parking"),
        "notes": (d.get("rules_text") or "")[:800] or None,
        "discounts": (d.get("discount_text") or "")[:400] or None,
        "reservation": "온라인 예약(우리동네키움포털)",
    }


_STRIP = re.compile(
    r"서울형\s*키즈\s*카페|서울형|키즈\s*카페|시립|구립|\d{4}|여기저기|"
    r"[가-힣]+구(?=\s|$)|[가-힣]+동\s*\d*호?점?|\d+호점|점\b"
)
_PUBLIC_HINT = re.compile(r"서울형|키즈카페|놀이터|키움|노리|실내놀이")


def _aliases(name: str) -> list[str]:
    """원명 + 괄호 별칭 + (서울형·구·동·호점을 뗀) 잔여어."""
    out = [name]
    out += [p for p in re.findall(r"\(([^)]{2,})", name)]
    stripped = _STRIP.sub(" ", re.sub(r"\([^)]*\)?", " ", name)).strip()
    if len(stripped) >= 2:
        out.append(stripped)
    return out


def similarity(umppa_name: str, other_name: str) -> float:
    return max(name_similarity(a, other_name) for a in _aliases(umppa_name))


def match_umppa(
    cand: Candidate, venues: list[dict[str, Any]], index: SpatialIndex
) -> Match:
    """서울형 이름 패턴(구·동·호점·괄호 별칭)을 감안한 매칭.

    - 이름 유사도(별칭 포함) + 거리로 tier_of.
    - 30 m 안의 공공 시설(또는 서울형/놀이터/키움류 이름)은 이름이 달라도 strong:
      같은 건물의 같은 시설을 다른 이름으로 등록한 경우다.
    - weak는 100 m 안 공공류만 인정한다.
    """
    best: Match = Match("none", None, None, 0.0)
    rank_of = {"strong": 2, "weak": 1, "none": 0}
    for other, d in index.near(cand.lon, cand.lat, 300):
        v = venues[int(other.key)]
        sim = similarity(cand.name, other.name)
        public_like = bool(v.get("public") or _PUBLIC_HINT.search(other.name))
        tier = tier_of(sim, d)
        if tier != "strong" and d <= 30 and public_like:
            tier = "strong"
        if tier == "weak" and not (d <= 100 and public_like):
            tier = "none"  # '키즈카페' 한 단어만 겹치는 먼 민간 업소는 접지 않는다
        rank = (rank_of[tier], sim, -d)
        if rank > (rank_of[best.tier], best.similarity, -(best.distance_m or 0)):
            best = Match(tier, other, d, sim)
    return best


def attach(
    venues: list[dict[str, Any]],
    facilities: list[dict[str, Any]],
    coords: dict[str, tuple[float, float]],
    observed: str | None = None,
) -> dict[str, Any]:
    observed = observed or date.today().isoformat()
    index = SpatialIndex(
        Candidate("union", str(i), v["name"], v["lon"], v["lat"])
        for i, v in enumerate(venues)
    )
    stats = {
        "facilities": len(facilities),
        "geocoded": 0,
        "strong": 0,
        "weak": 0,
        "added": 0,
    }
    for f in facilities:
        fid = f["fclty_id"]
        attrs = to_attrs(f, observed)
        if fid not in coords:
            continue
        stats["geocoded"] += 1
        lon, lat = coords[fid]
        m = match_umppa(Candidate(SOURCE, fid, f["name"], lon, lat), venues, index)
        if m.tier in ("strong", "weak") and m.other is not None:
            v = venues[int(m.other.key)]
            stats[m.tier] += 1
            v["sources"].append(f"{SOURCE}:{fid}")
            v["public"] = True
            if "attrs" not in v:
                v["attrs"] = attrs
            if not v.get("phone"):
                v["phone"] = f.get("phone")
            continue
        stats["added"] += 1
        venues.append(
            {
                "name": f["name"],
                "lon": lon,
                "lat": lat,
                "sources": [f"{SOURCE}:{fid}"],
                "category": "kids_cafe",
                "addr": f.get("address") or "",
                "indoor": "실내",
                "public": True,
                "phone": f.get("phone"),
                "attrs": attrs,
            }
        )
    return stats
