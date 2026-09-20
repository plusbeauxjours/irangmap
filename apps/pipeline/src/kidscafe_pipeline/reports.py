"""시드 3종 합산 리포트 — DB 없이 원본 파일로 union N과 매칭 tier 분포를 본다.

- 놀이시설 A013 운영(WGS84)이 기준 집합.
- 테마파크업(기타) 영업 중 classify로 kids_cafe/trampoline_park인 것을 A013과 매칭.
- 휴게음식점 키즈 후보(업태 또는 상호 적중, 영업)를 위 둘과 매칭.
- strong 매칭은 같은 업소로 접고, 나머지를 더해 union을 추정한다.
"""

import glob
import gzip
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from . import normalize
from .classify import classify_name, is_map_default
from .resolve import Candidate, SpatialIndex, best_match
from .sources import rest_cafes, themepark_other


def _read_jsonl_gz(paths: list[str]) -> list[dict[str, Any]]:
    """아직 쓰고 있는(또는 잘린) gz도 읽은 데까지는 살린다."""
    out: list[dict[str, Any]] = []
    for p in paths:
        try:
            with gzip.open(p, "rb") as f:
                for raw in f:
                    try:
                        out.append(json.loads(raw))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        continue
        except (EOFError, OSError, gzip.BadGzipFile):
            continue  # 스트림 끝이 안 닫힌 파일: 여기까지 읽은 것으로 진행
    return out


# 일부 구청은 폐업을 영업상태 대신 상호에 '(폐)'로 표기한다(부산 해운대구 등)
CLOSED_NAME_RE = re.compile(r"\(폐\)|폐업|폐점")

META: dict[str, dict[str, Any]] = {}  # f"{source}:{key}" → 주소·카테고리 등 부가 정보


def _remember(c: Candidate, **meta: Any) -> Candidate:
    META[f"{c.source}:{c.key}"] = meta
    return c


def load_playground_a013(path: Path) -> list[Candidate]:
    cands = []
    for it in _read_jsonl_gz([str(path)]):
        if it.get("instlPlaceCd") != "A013" or it.get("operYnCdNm") != "운영":
            continue
        if not it.get("latCrtsVl") or not it.get("lotCrtsVl"):
            continue
        c = Candidate(
            "playground",
            str(it["pfctSn"]),
            it.get("pfctNm") or "",
            float(it["lotCrtsVl"]),
            float(it["latCrtsVl"]),
        )
        cands.append(
            _remember(
                c,
                category="kids_cafe",
                addr=it.get("ronaAddr") or it.get("lotnoAddr") or "",
                indoor=it.get("idrodrCdNm"),
                public=it.get("prvtPblcYnCdNm") == "공공",
            )
        )
    return cands


def load_themepark_kids(path: Path) -> tuple[list[Candidate], Counter]:
    items = json.load(open(path, encoding="utf-8"))
    cats: Counter = Counter()
    cands = []
    for it in items:
        if not str(it.get("SALS_STTS_NM", "")).startswith("영업"):
            continue
        c = classify_name(it.get("BPLC_NM"))
        cats[c.category] += 1
        coord = normalize.parse_coord(it)
        if is_map_default(c) and coord:
            cand = Candidate(
                "themepark",
                themepark_other.source_key(it),
                it.get("BPLC_NM") or "",
                *coord,
            )
            cands.append(
                _remember(
                    cand,
                    category=c.category,
                    addr=it.get("ROAD_NM_ADDR") or it.get("LOTNO_ADDR") or "",
                    phone=it.get("TELNO") or None,
                )
            )
    return cands, cats


def load_rest_cafes_kids(pattern: str) -> tuple[list[Candidate], dict[str, Any]]:
    paths = sorted(p for p in glob.glob(pattern) if "truncated" not in p)
    seen: set[str] = set()
    summary = rest_cafes.Summary()
    cands = []
    for it in _read_jsonl_gz(paths):
        key = it.get("MNG_NO")
        if not key or key in seen:
            continue
        seen.add(key)
        summary.add(it)
        if (
            rest_cafes.bzstat_hit(it) or rest_cafes.name_hit(it)
        ) and rest_cafes.is_active(it):
            coord = normalize.parse_coord(it)
            if coord:
                cand = Candidate("rest_cafes", key, it.get("BPLC_NM") or "", *coord)
                cands.append(
                    _remember(
                        cand,
                        category="kids_cafe",
                        addr=it.get("ROAD_NM_ADDR") or it.get("LOTNO_ADDR") or "",
                        phone=it.get("TELNO") or None,
                        homepage=it.get("HPG") or None,
                    )
                )
    stats = summary.as_dict()
    stats["files"] = paths
    stats["distinct_mng_no"] = len(seen)
    return cands, stats


def union_report(
    playground: list[Candidate], themepark: list[Candidate], restcafes: list[Candidate]
) -> dict[str, Any]:
    base_index = SpatialIndex(playground)
    tiers_tp: Counter = Counter()
    tp_new = []
    for c in themepark:
        m = best_match(c, base_index)
        tiers_tp[m.tier] += 1
        if m.tier != "strong":
            tp_new.append(c)
    index2 = SpatialIndex(playground + tp_new)
    tiers_rc: Counter = Counter()
    rc_new = []
    for c in restcafes:
        m = best_match(c, index2)
        tiers_rc[m.tier] += 1
        if m.tier != "strong":
            rc_new.append(c)
    venues = [
        v
        for v in _merge(playground, themepark, restcafes, base_index, index2)
        if not CLOSED_NAME_RE.search(v["name"])
    ]
    return {
        "venues": venues,
        "playground_a013_active": len(playground),
        "themepark_kids_default": len(themepark),
        "themepark_vs_playground": dict(tiers_tp),
        "restcafes_kids_active": len(restcafes),
        "restcafes_vs_union": dict(tiers_rc),
        "union_estimate": len(playground) + len(tp_new) + len(rc_new),
        "union_breakdown": {
            "playground": len(playground),
            "themepark_added": len(tp_new),
            "restcafes_added": len(rc_new),
        },
    }


def _merge(
    playground: list[Candidate],
    themepark: list[Candidate],
    restcafes: list[Candidate],
    base_index: SpatialIndex,
    index2: SpatialIndex,
) -> list[dict[str, Any]]:
    """strong 매칭은 기준 업소에 소스를 덧붙이고, 나머지는 새 업소로."""
    by_key: dict[str, dict[str, Any]] = {}
    for c in playground:
        by_key[f"{c.source}:{c.key}"] = {
            "name": c.name,
            "lon": c.lon,
            "lat": c.lat,
            "sources": [f"{c.source}:{c.key}"],
            **META.get(f"{c.source}:{c.key}", {}),
        }
    for group, index in ((themepark, base_index), (restcafes, index2)):
        for c in group:
            m = best_match(c, index)
            if m.tier == "strong" and m.other is not None:
                target = by_key.get(f"{m.other.source}:{m.other.key}")
                if target is not None:
                    target["sources"].append(f"{c.source}:{c.key}")
                    for k, v in META.get(f"{c.source}:{c.key}", {}).items():
                        target.setdefault(k, v)
                    continue
            by_key[f"{c.source}:{c.key}"] = {
                "name": c.name,
                "lon": c.lon,
                "lat": c.lat,
                "sources": [f"{c.source}:{c.key}"],
                **META.get(f"{c.source}:{c.key}", {}),
            }
    return list(by_key.values())


def to_geojson(venues: list[dict[str, Any]]) -> dict[str, Any]:
    feats = []
    for i, v in enumerate(venues):
        props = {k: val for k, val in v.items() if k not in ("lon", "lat")}
        props["id"] = i + 1
        feats.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(v["lon"], 6), round(v["lat"], 6)],
                },
                "properties": props,
            }
        )
    return {"type": "FeatureCollection", "features": feats}
