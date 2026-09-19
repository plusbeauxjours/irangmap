"""엔티티 매칭 — 소스가 다른 두 레코드가 같은 업소인지.

스파이크(2026-09-19, docs/spike-data.md)에서 확인한 것:
- 거리만으로 병합하면 같은 상가의 다른 업소를 합친다(쿠우쿠우 ↔ 점핑파크 미사점).
- 이름 유사도는 공백·법인·지점 접미를 걷어낸 뒤 문자 단위로 봐야 한다(names.py).
- 인허가 좌표(5174→4326)와 놀이시설 WGS84 좌표는 같은 곳이면 대개 ≤50m, 넉넉히 300m.
"""

import math
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from .names import name_similarity

GRID_DEG = 0.01  # ≈ 1.1km. 인접 9칸을 보면 반경 ~1km 후보가 전부 들어온다.
STRONG_SIM = 0.8
WEAK_SIM = 0.5
SAME_BUILDING_M = 50
RADIUS_M = 300


@dataclass(frozen=True)
class Candidate:
    source: str
    key: str
    name: str
    lon: float
    lat: float


@dataclass(frozen=True)
class Match:
    tier: str  # strong | weak | none
    other: Candidate | None
    distance_m: float | None
    similarity: float


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2
    a += math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _cell(lon: float, lat: float) -> tuple[int, int]:
    return (int(lon // GRID_DEG), int(lat // GRID_DEG))


class SpatialIndex:
    def __init__(self, cands: Iterable[Candidate]) -> None:
        self._grid: dict[tuple[int, int], list[Candidate]] = defaultdict(list)
        for c in cands:
            self._grid[_cell(c.lon, c.lat)].append(c)

    def near(
        self, lon: float, lat: float, radius_m: float = RADIUS_M
    ) -> list[tuple[Candidate, float]]:
        cx, cy = _cell(lon, lat)
        out = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for c in self._grid.get((cx + dx, cy + dy), ()):
                    d = haversine_m(lon, lat, c.lon, c.lat)
                    if d <= radius_m:
                        out.append((c, d))
        return out


def tier_of(similarity: float, distance_m: float) -> str:
    """같은 건물(≤50m)이면 지점명 차이를 감안해 유사도 기준을 낮춘다."""
    if similarity >= STRONG_SIM or (
        similarity >= 0.6 and distance_m <= SAME_BUILDING_M
    ):
        return "strong"
    if similarity >= WEAK_SIM:
        return "weak"
    return "none"


def best_match(
    cand: Candidate, index: SpatialIndex, radius_m: float = RADIUS_M
) -> Match:
    best: Match = Match("none", None, None, 0.0)
    for other, d in index.near(cand.lon, cand.lat, radius_m):
        if other.source == cand.source:
            continue
        sim = name_similarity(cand.name, other.name)
        tier = tier_of(sim, d)
        rank = ({"strong": 2, "weak": 1, "none": 0}[tier], sim, -d)
        best_rank = (
            {"strong": 2, "weak": 1, "none": 0}[best.tier],
            best.similarity,
            -(best.distance_m or 0),
        )
        if rank > best_rank:
            best = Match(tier, other, d, sim)
    return best
