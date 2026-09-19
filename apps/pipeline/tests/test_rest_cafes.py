from kidscafe_pipeline.sources import rest_cafes


def _item(**kw):
    base = {
        "MNG_NO": "M1",
        "BPLC_NM": "울랄라 커피",
        "BZSTAT_SE_NM": "커피숍",
        "SNTTN_BZSTAT_NM": "",
        "SALS_STTS_NM": "영업/정상",
        "ROAD_NM_ADDR": "경기도 김포시 유현로 242",
        "CRD_INFO_X": "1",
        "HPG": "",
        "MLT_UTZTN_BSNSSP_YN": "N",
    }
    return {**base, **kw}


def test_bzstat_matcher_handles_spelling_variants() -> None:
    for text in (
        "키즈카페",
        "키즈까페",
        "키즈 카페",
        "키카",
        "실내놀이터",
        "어린이놀이방",
        "Kids Cafe",
    ):
        assert rest_cafes.bzstat_hit(_item(BZSTAT_SE_NM=text)), text
    for text in ("커피숍", "패스트푸드", "기타", "다방", "제과점영업"):
        assert not rest_cafes.bzstat_hit(_item(BZSTAT_SE_NM=text)), text


def test_summary_counts_bzstat_hits_separately_from_name_only() -> None:
    s = rest_cafes.Summary()
    s.add(_item(BZSTAT_SE_NM="키즈카페"))  # 업태로 잡힘
    s.add(
        _item(MNG_NO="M2", BZSTAT_SE_NM="기타", BPLC_NM="해피 키즈카페 김포점")
    )  # 상호로만
    s.add(
        _item(MNG_NO="M3", BZSTAT_SE_NM="키즈카페", SALS_STTS_NM="폐업", CRD_INFO_X="")
    )
    s.add(_item(MNG_NO="M4"))  # 무관한 커피숍
    d = s.as_dict()
    assert d["total_items"] == 4
    assert d["kids_bzstat"] == 2
    assert d["kids_name_only"] == 1
    assert d["kids_active"] == 2
    assert d["kids_active_by_sido"] == {"경기도": 2}
    assert d["bzstat_kids_like"] == {"키즈카페": 2}
    assert d["kids_active_coord_missing"] == 0
