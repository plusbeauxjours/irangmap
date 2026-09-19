"""업소 분류 — 테마파크업(기타)처럼 키즈카페가 아닌 것이 섞인 소스를 걸러낸다.

규칙은 2026-09-19 스파이크의 상호 토큰 분포(docs/spike-data.md)에서 뽑았다.
소스 힌트가 있으면 우선한다: 놀이시설 A013 → kids_cafe, A004 → restaurant_with_playroom.
"""

import re
from dataclasses import dataclass

CATEGORIES = (
    "kids_cafe",
    "trampoline_park",
    "restaurant_with_playroom",
    "water",
    "camping",
    "arcade",
    "event",
    "other",
)

# 프랜차이즈 사전: 상호에 포함되면 카테고리 확정 (스파이크 토큰 상위).
FRANCHISE: dict[str, str] = {
    "챔피언": "kids_cafe",
    "타요키즈": "kids_cafe",
    "큐리키즈": "kids_cafe",
    "쁘띠몽드": "kids_cafe",
    "리틀비틀": "kids_cafe",
    "꼬마대통령": "kids_cafe",
    "모넬로": "kids_cafe",
    "와글아이": "kids_cafe",
    "롤리폴리": "kids_cafe",
    "코코몽": "kids_cafe",
    "노리파크": "kids_cafe",
    "월드킹": "kids_cafe",
    "키즈다쿵": "kids_cafe",
    "뽀로로파크": "kids_cafe",
    "릴리펏": "kids_cafe",
    "플레이타임": "kids_cafe",
    "펀키즈": "kids_cafe",
    "서울형키즈카페": "kids_cafe",
    "서울형 키즈카페": "kids_cafe",
    "헬로방방": "trampoline_park",
    "점핑몬스터": "trampoline_park",
    "바운스": "trampoline_park",
    "킹콩점프": "trampoline_park",
    "점핑파크": "trampoline_park",
    "점프노리": "trampoline_park",
    "붕붕뜀틀": "trampoline_park",
    "트램폴린파크": "trampoline_park",
    "방방": "trampoline_park",
}

_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        "event",
        re.compile(r"축제|페스티벌|행사|운동회|이벤트|박람회|야시장|영화제|마켓", re.I),
    ),
    (
        "camping",
        re.compile(r"캠핑|글램핑|야영장|펜션|민박|카라반|리조트|관광농원|휴양림", re.I),
    ),
    ("water", re.compile(r"워터|물놀이|수영|아쿠아|해수욕|풀장|스파", re.I)),
    (
        "arcade",
        re.compile(
            r"오락실|오락|게임|아케이드|vr|브이알|스크린|사격|야구장|볼링|zzang", re.I
        ),
    ),
    ("trampoline_park", re.compile(r"점핑|트램|바운스|jump|방방|뜀틀", re.I)),
    (
        "kids_cafe",
        re.compile(
            r"키즈|키카|kids|어린이|실내\s*놀이|놀이\s*(터|방|공간|시설)|플레이|play|볼풀|정글",
            re.I,
        ),
    ),
]


@dataclass(frozen=True)
class Classification:
    category: str
    kids_score: float  # 1.0 확정 · 0.7 규칙 · 0.4 약한 단서 · 0.0 없음
    reason: str


def classify_name(name: str | None, *, place_code: str | None = None) -> Classification:
    n = name or ""
    if place_code == "A013":
        return Classification("kids_cafe", 1.0, "playground:A013")
    if place_code == "A004":
        return Classification("restaurant_with_playroom", 0.3, "playground:A004")
    for token, cat in FRANCHISE.items():
        if token in n:
            return Classification(cat, 1.0, f"franchise:{token}")
    for cat, rx in _RULES:
        if rx.search(n):
            score = 0.7 if cat in ("kids_cafe", "trampoline_park") else 0.0
            return Classification(cat, score, f"rule:{cat}")
    return Classification("other", 0.0, "unclassified")


def is_map_default(c: Classification) -> bool:
    """지도 기본 노출 대상."""
    return c.category in ("kids_cafe", "trampoline_park") and c.kids_score >= 0.7
