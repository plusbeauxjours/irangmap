"""서울형 키즈카페(umppa) 수집물을 union 업소에 붙인다.

주소 → VWorld 지오코딩(캐시) → 300m 안 이름 유사도 매칭(resolve.best_match).
strong/weak 매칭이면 그 업소에 `attrs`(출처·확인일 포함)를 붙이고, 매칭이 없으면
umppa 단독 업소로 추가한다(서울시가 운영하므로 public=True).
"""

import json
import re
from datetime import date
from pathlib import Path
from typing import Any

from .geocode import VWorldGeocoder
from .resolve import Candidate, SpatialIndex, best_match

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
        got = geocoder.geocode(addr) or (
            geocoder.geocode(" ".join(addr.split()[:4])) if addr else None
        )
        cache[fid] = [got.lon, got.lat] if got else None
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    return {k: (v[0], v[1]) for k, v in cache.items() if v}


def to_attrs(f: dict[str, Any], observed: str) -> dict[str, Any]:
    d = f.get("detail") or {}
    lo, hi = d.get("age_min", f.get("age_min")), d.get("age_max", f.get("age_max"))
    fee = d.get("fee_child_krw")
    fee_txt = f"아동 1명당 {fee:,}원" if fee else None
    slots = d.get("hours_slots") or []
    return {
        "source": SOURCE,
        "source_label": SOURCE_LABEL,
        "observed_at": observed,
        "evidence_url": d.get("view_url"),
        "reservation_url": d.get("reservation_url"),
        "photo_url": f.get("thumbnail_url"),
        "age_range": f"{lo}~{hi}세 (연나이)"
        if lo is not None and hi is not None
        else None,
        "age_rules": (d.get("age_rules") or "")[:600] or None,
        "guardian_fee": "보호자 무료" if d.get("guardian_free") else None,
        "child_fee": fee_txt,
        "socks": ("미끄럼방지 양말 필수" if d.get("socks_required") else None),
        "capacity": f.get("capacity") or None,
        "operating_days": d.get("operating_days"),
        "closed_days": d.get("closed_days"),
        "hours": slots[:8] or None,
        "parking": d.get("parking"),
        "notes": (d.get("rules_text") or "")[:800] or None,
        "discounts": (d.get("discount_text") or "")[:400] or None,
        "reservation": "온라인 예약(우리동네키움포털)",
    }


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
        m = best_match(Candidate(SOURCE, fid, f["name"], lon, lat), index)
        if m.tier in ("strong", "weak") and m.other is not None:
            v = venues[int(m.other.key)]
            stats[m.tier] += 1
            v["sources"].append(f"{SOURCE}:{fid}")
            v["public"] = True
            v["attrs"] = attrs
            v.setdefault("phone", f.get("phone"))
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
