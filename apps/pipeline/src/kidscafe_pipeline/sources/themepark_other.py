"""행정안전부_문화_테마파크업(기타) 조회서비스 (data.go.kr 15155250) — 1차 시드.

엔드포인트 `https://apis.data.go.kr/1741000/amusement_facilities_other/info`,
페이지 크기 상한 100, 필드는 LOCALDATA 코드형(2026-09-19 확인). 자주 쓰는 것:
- MNG_NO 관리번호 · BPLC_NM 사업장명 · LOTNO_ADDR / ROAD_NM_ADDR 주소
- CRD_INFO_X / CRD_INFO_Y 좌표(EPSG:5174) · TELNO
- SALS_STTS_NM 영업상태 · DTL_SALS_STTS_NM 상세영업상태
- LCPMT_YMD 인허가일자 · CLSBIZ_YMD 폐업일자 · CULTR_SPTS_TPBIZ_NM 업종명
- DAT_UPDT_SE 갱신구분(I/U/D) · LAST_MDFCN_PNT 최종수정
"""

import re
from collections import Counter
from typing import Any

SOURCE = "themepark_other"
KEY_FIELD = "MNG_NO"
# 사업장명만으로 키즈카페일 가능성이 높은 표현.
# 축제·이동식 유기기구·방송국도 같은 업종에 섞여 있다.
KIDS_NAME_RE = re.compile(
    r"키즈|키카|kids|어린이|아이|놀이|플레이|play|점핑|트램|볼풀|정글", re.I
)


def source_key(item: dict[str, Any]) -> str:
    """MNG_NO는 지자체 안에서만 고유(7,241건 중 343개 값) → 지자체 코드와 합친다."""
    mng = str(item.get(KEY_FIELD, "")).strip()
    grp = str(item.get("OPN_ATMY_GRP_CD", "")).strip()
    if not mng or not grp:
        raise KeyError(f"{KEY_FIELD}/OPN_ATMY_GRP_CD 없음: keys={sorted(item)}")
    return f"{grp}:{mng}"


def sido_of(item: dict[str, Any]) -> str:
    addr = (item.get("ROAD_NM_ADDR") or item.get("LOTNO_ADDR") or "").strip()
    return addr.split()[0] if addr else "(주소없음)"


def is_kids_name(item: dict[str, Any]) -> bool:
    return bool(KIDS_NAME_RE.search(item.get("BPLC_NM") or ""))


def summarize(items: list[dict[str, Any]]) -> dict[str, Any]:
    active = [it for it in items if str(it.get("SALS_STTS_NM", "")).startswith("영업")]
    return {
        "source": SOURCE,
        "total_items": len(items),
        "status": dict(
            Counter(it.get("SALS_STTS_NM", "") for it in items).most_common()
        ),
        "detail_status": dict(
            Counter(it.get("DTL_SALS_STTS_NM", "") for it in items).most_common(8)
        ),
        "biz_type": dict(
            Counter(it.get("CULTR_SPTS_TPBIZ_NM", "") for it in items).most_common()
        ),
        "active": len(active),
        "active_by_sido": dict(Counter(sido_of(it) for it in active).most_common()),
        "active_coord_missing": sum(
            1 for it in active if not str(it.get("CRD_INFO_X", "")).strip()
        ),
        "active_road_addr_missing": sum(
            1 for it in active if not str(it.get("ROAD_NM_ADDR", "")).strip()
        ),
        "active_kids_name_hits": sum(1 for it in active if is_kids_name(it)),
        "active_license_year": dict(
            sorted(Counter(str(it.get("LCPMT_YMD", ""))[:4] for it in active).items())
        ),
    }


def to_source_records(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"source": SOURCE, "source_key": source_key(it), "raw": it} for it in items]
