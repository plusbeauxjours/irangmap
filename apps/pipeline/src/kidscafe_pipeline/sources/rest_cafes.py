"""행정안전부_식품_휴게음식점 조회서비스 (data.go.kr 15154921) — 2차 시드.

엔드포인트 `https://apis.data.go.kr/1741000/rest_cafes/info`, 647k행, 페이지 상한 100,
서버 필터 없음(업태·상태·지자체 파라미터 전부 무시됨, 2026-09-19 확인) → 전량 스트리밍.
업태 필드: BZSTAT_SE_NM(업태구분명, 자유 텍스트) · SNTTN_BZSTAT_NM(위생업태명).
그 외: MLT_UTZTN_BSNSSP_YN 다중이용업소여부 · HPG 홈페이지 · FCLT_TOTAL_SCL 시설총규모.
"""

import re
from collections import Counter
from typing import Any

SOURCE = "rest_cafes"
KEY_FIELD = "MNG_NO"
# 업태구분명/위생업태명에서 키즈카페를 가리키는 표현. 띄어쓰기·'까페' 변형 포함.
KIDS_BZSTAT_RE = re.compile(
    r"키\s*즈\s*[카까]\s*페|키카|kids|어린이|실내\s*놀이|놀이\s*(터|방|공간)", re.I
)
# 상호만으로 의심되는 표현 (업태가 '기타'·'커피숍'으로 잡힌 키즈카페 회수용). 약한 신호.
KIDS_NAME_RE = re.compile(
    r"키\s*즈\s*[카까]\s*페|키카|kids\s*cafe|키즈\s*룸|키즈\s*랜드|실내\s*놀이터", re.I
)


def source_key(item: dict[str, Any]) -> str:
    key = str(item.get(KEY_FIELD, "")).strip()
    if not key:
        raise KeyError(f"{KEY_FIELD} 없음: keys={sorted(item)}")
    return key


def bzstat_hit(item: dict[str, Any]) -> bool:
    text = f"{item.get('BZSTAT_SE_NM') or ''} {item.get('SNTTN_BZSTAT_NM') or ''}"
    return bool(KIDS_BZSTAT_RE.search(text))


def name_hit(item: dict[str, Any]) -> bool:
    return bool(KIDS_NAME_RE.search(item.get("BPLC_NM") or ""))


def is_active(item: dict[str, Any]) -> bool:
    return str(item.get("SALS_STTS_NM", "")).startswith("영업")


def sido_of(item: dict[str, Any]) -> str:
    addr = (item.get("ROAD_NM_ADDR") or item.get("LOTNO_ADDR") or "").strip()
    return addr.split()[0] if addr else "(주소없음)"


class Summary:
    """전량을 메모리에 들지 않고 한 건씩 집계한다."""

    def __init__(self) -> None:
        self.total = 0
        self.status: Counter[str] = Counter()
        self.bzstat: Counter[str] = Counter()
        self.snttn: Counter[str] = Counter()
        self.kids_bzstat = 0
        self.kids_name_only = 0
        self.kids_active = 0
        self.kids_active_by_sido: Counter[str] = Counter()
        self.kids_active_bzstat: Counter[str] = Counter()
        self.kids_active_coord_missing = 0
        self.kids_active_hpg = 0
        self.kids_active_mlt_yn: Counter[str] = Counter()

    def add(self, item: dict[str, Any]) -> None:
        self.total += 1
        self.status[item.get("SALS_STTS_NM", "")] += 1
        self.bzstat[item.get("BZSTAT_SE_NM", "")] += 1
        self.snttn[item.get("SNTTN_BZSTAT_NM", "")] += 1
        b, n = bzstat_hit(item), name_hit(item)
        if b:
            self.kids_bzstat += 1
        elif n:
            self.kids_name_only += 1
        if (b or n) and is_active(item):
            self.kids_active += 1
            self.kids_active_by_sido[sido_of(item)] += 1
            self.kids_active_bzstat[item.get("BZSTAT_SE_NM", "")] += 1
            if not str(item.get("CRD_INFO_X", "")).strip():
                self.kids_active_coord_missing += 1
            if str(item.get("HPG", "")).strip():
                self.kids_active_hpg += 1
            self.kids_active_mlt_yn[str(item.get("MLT_UTZTN_BSNSSP_YN", ""))] += 1

    def as_dict(self) -> dict[str, Any]:
        return {
            "source": SOURCE,
            "total_items": self.total,
            "status": dict(self.status.most_common()),
            "bzstat_distinct": len(self.bzstat),
            "bzstat_top": dict(self.bzstat.most_common(40)),
            "bzstat_kids_like": {
                k: v for k, v in self.bzstat.items() if KIDS_BZSTAT_RE.search(k)
            },
            "snttn_distinct": len(self.snttn),
            "snttn_kids_like": {
                k: v for k, v in self.snttn.items() if KIDS_BZSTAT_RE.search(k)
            },
            "kids_bzstat": self.kids_bzstat,
            "kids_name_only": self.kids_name_only,
            "kids_active": self.kids_active,
            "kids_active_by_sido": dict(self.kids_active_by_sido.most_common()),
            "kids_active_bzstat": dict(self.kids_active_bzstat.most_common(15)),
            "kids_active_coord_missing": self.kids_active_coord_missing,
            "kids_active_hpg": self.kids_active_hpg,
            "kids_active_mlt_yn": dict(self.kids_active_mlt_yn),
        }


def to_source_record(item: dict[str, Any]) -> dict[str, Any]:
    return {"source": SOURCE, "source_key": source_key(item), "raw": item}
