"""상호 정규화.

소스마다 다른 표기(법인 접두, 지점 접미, 시설 접미, 띄어쓰기)를 걷어낸다.
"""

import re

from rapidfuzz import fuzz

_CORP = re.compile(r"\(주\)|주식회사|유한회사|농업회사법인|\(유\)|㈜")
_FACILITY_SUFFIX = re.compile(
    r"(내\s*)?(어린이\s*)?(실내\s*)?놀이\s*(시설|방|공간|터)$"
)
_BRANCH_SUFFIX = re.compile(r"\s*\d*호?점$")
_PAREN = re.compile(r"\([^)]*\)")
_NONWORD = re.compile(r"[^가-힣a-z0-9]+")


def normalize_name(name: str | None) -> str:
    """비교용 키: 괄호·법인·시설 접미·지점 접미 제거, 소문자, 공백 제거."""
    n = (name or "").lower()
    n = _PAREN.sub(" ", n)
    n = _CORP.sub(" ", n)
    n = n.strip()
    n = _FACILITY_SUFFIX.sub("", n).strip()
    n = _BRANCH_SUFFIX.sub("", n).strip()
    return _NONWORD.sub("", n)


def name_similarity(a: str | None, b: str | None) -> float:
    """0~1. 공백 제거 문자열의 ratio와 부분 일치 중 큰 값."""
    na, nb = normalize_name(a), normalize_name(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    return max(fuzz.ratio(na, nb), fuzz.partial_ratio(na, nb) * 0.9) / 100.0
