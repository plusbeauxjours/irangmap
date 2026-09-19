"""행정안전부_전국어린이놀이시설정보서비스 (data.go.kr 15124519).

어린이놀이시설 안전관리법 대상 시설 전부(85,338건, 2026-09-19).
- 엔드포인트 `https://apis.data.go.kr/1741000/pfc3/getPfctInfo3`
  (스펙은 data.go.kr 페이지 인라인 swaggerJson에 있음)
- 페이징 `pageIndex` / `recordCountPerPage`(상한 1000)
- 응답 `response.body.items[]` + `totalCnt`
- 서버 필터 없음
- 키즈카페 후보 = 설치장소 A013 놀이제공영업소 + A004 식품접객업소(카페형)
- 필드: pfctSn 일련번호 · pfctNm · ronaAddr / lotnoAddr · latCrtsVl / lotCrtsVl(WGS84)
  · instlPlaceCd/Nm 설치장소 · operYnCdNm 운영/폐쇄 · idrodrCdNm 실내/실외
  · instlYmd 설치 · clsgYmd 폐쇄 · acptnYmd 검사수리 · prvtPblcYnCdNm 공공/민간
  · wowaStylRideCdNm 물놀이 · rgnCd / rgnCdNm 법정동
"""

from collections import Counter
from typing import Any

SOURCE = "playground"
KEY_FIELD = "pfctSn"
KIDS_PLACE_CODES = {"A013": "놀이제공영업소", "A004": "식품접객업소"}


def source_key(item: dict[str, Any]) -> str:
    key = str(item.get(KEY_FIELD, "") or "").strip()
    if not key:
        raise KeyError(f"{KEY_FIELD} 없음: keys={sorted(item)}")
    return key


def is_kids_candidate(item: dict[str, Any]) -> bool:
    return item.get("instlPlaceCd") in KIDS_PLACE_CODES


def is_operating(item: dict[str, Any]) -> bool:
    return item.get("operYnCdNm") == "운영"


def sido_of(item: dict[str, Any]) -> str:
    rgn = (item.get("rgnCdNm") or item.get("ronaAddr") or "").strip()
    return rgn.split()[0] if rgn else "(지역없음)"


def summarize(items: list[dict[str, Any]]) -> dict[str, Any]:
    kids = [it for it in items if is_kids_candidate(it)]
    kids_op = [it for it in kids if is_operating(it)]
    return {
        "source": SOURCE,
        "total_items": len(items),
        "by_place": dict(
            Counter(it.get("instlPlaceCdNm") for it in items).most_common()
        ),
        "by_oper": dict(Counter(it.get("operYnCdNm") for it in items).most_common()),
        "kids_candidates": len(kids),
        "kids_by_place_oper": dict(
            Counter(f"{it.get('instlPlaceCdNm')}/{it.get('operYnCdNm')}" for it in kids)
        ),
        "kids_op": len(kids_op),
        "kids_op_indoor": dict(Counter(it.get("idrodrCdNm") for it in kids_op)),
        "kids_op_public": dict(Counter(it.get("prvtPblcYnCdNm") for it in kids_op)),
        "kids_op_by_sido": dict(Counter(sido_of(it) for it in kids_op).most_common()),
        "kids_op_coord_missing": sum(1 for it in kids_op if not it.get("latCrtsVl")),
        "kids_op_install_year": dict(
            sorted(Counter(str(it.get("instlYmd") or "")[:4] for it in kids_op).items())
        ),
        "kids_op_water": dict(Counter(it.get("wowaStylRideCdNm") for it in kids_op)),
    }


def to_source_records(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"source": SOURCE, "source_key": source_key(it), "raw": it} for it in items]
