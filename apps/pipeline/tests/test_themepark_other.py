import pytest

from kidscafe_pipeline.sources import themepark_other

ITEMS = [
    {
        "MNG_NO": "A1",
        "OPN_ATMY_GRP_CD": "3010000",
        "BPLC_NM": "레인보우 키즈카페",
        "ROAD_NM_ADDR": "경기도 김포시 유현로 242",
        "SALS_STTS_NM": "영업/정상",
        "DTL_SALS_STTS_NM": "영업중",
        "CULTR_SPTS_TPBIZ_NM": "신고테마파크업",
        "CRD_INFO_X": "197000.1",
        "LCPMT_YMD": "2024-03-02",
    },
    {
        "MNG_NO": "A2",
        "OPN_ATMY_GRP_CD": "4490000",
        "BPLC_NM": "천안 페스티벌 명랑운동회",
        "ROAD_NM_ADDR": "",
        "LOTNO_ADDR": "충청남도 천안시 서북구 백석동 251",
        "SALS_STTS_NM": "영업/정상",
        "DTL_SALS_STTS_NM": "영업중",
        "CULTR_SPTS_TPBIZ_NM": "신고테마파크업",
        "CRD_INFO_X": "",
        "LCPMT_YMD": "2026-09-17",
    },
    {
        "MNG_NO": "A3",
        "OPN_ATMY_GRP_CD": "3010000",
        "BPLC_NM": "옛날 놀이방",
        "ROAD_NM_ADDR": "서울특별시 성동구 용답29길 19",
        "SALS_STTS_NM": "폐업",
        "DTL_SALS_STTS_NM": "폐업",
        "CULTR_SPTS_TPBIZ_NM": "신고테마파크업",
        "CRD_INFO_X": "1",
        "LCPMT_YMD": "2019-01-01",
    },
]


def test_summarize_uses_localdata_code_fields() -> None:
    stats = themepark_other.summarize(ITEMS)
    assert stats["total_items"] == 3
    assert stats["status"] == {"영업/정상": 2, "폐업": 1}
    assert stats["active"] == 2
    assert stats["active_by_sido"] == {"경기도": 1, "충청남도": 1}
    assert stats["active_coord_missing"] == 1
    assert stats["active_road_addr_missing"] == 1
    assert stats["active_kids_name_hits"] == 1  # 페스티벌은 키즈카페가 아니다
    assert stats["active_license_year"] == {"2024": 1, "2026": 1}


def test_source_key_combines_municipality_and_management_number() -> None:
    assert themepark_other.source_key(ITEMS[0]) == "3010000:A1"
    with pytest.raises(KeyError):
        themepark_other.source_key({"BPLC_NM": "x", "MNG_NO": "A1"})
