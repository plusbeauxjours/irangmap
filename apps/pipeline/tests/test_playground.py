from kidscafe_pipeline.sources import playground

ITEMS = [
    {
        "pfctSn": 1,
        "instlPlaceCd": "A013",
        "instlPlaceCdNm": "놀이제공영업소",
        "operYnCdNm": "운영",
        "idrodrCdNm": "실내",
        "prvtPblcYnCdNm": "민간",
        "rgnCdNm": "경기도 김포시 풍무동",
        "latCrtsVl": 37.6,
        "instlYmd": "20240101",
        "wowaStylRideCdNm": "미포함",
    },
    {
        "pfctSn": 2,
        "instlPlaceCd": "A004",
        "instlPlaceCdNm": "식품접객업소",
        "operYnCdNm": "폐쇄",
        "idrodrCdNm": "실내",
        "prvtPblcYnCdNm": "민간",
        "rgnCdNm": "서울특별시 성동구 용답동",
        "latCrtsVl": None,
        "instlYmd": "20190101",
        "wowaStylRideCdNm": "미포함",
    },
    {
        "pfctSn": 3,
        "instlPlaceCd": "A010",
        "instlPlaceCdNm": "주택단지",
        "operYnCdNm": "운영",
        "idrodrCdNm": "실외",
        "prvtPblcYnCdNm": "민간",
        "rgnCdNm": "부산광역시 중구 보수동1가",
        "latCrtsVl": 35.1,
        "instlYmd": "20100101",
        "wowaStylRideCdNm": "미포함",
    },
]


def test_summarize_counts_only_kids_place_codes() -> None:
    s = playground.summarize(ITEMS)
    assert s["total_items"] == 3
    assert s["kids_candidates"] == 2
    assert s["kids_op"] == 1
    assert s["kids_by_place_oper"] == {"놀이제공영업소/운영": 1, "식품접객업소/폐쇄": 1}
    assert s["kids_op_by_sido"] == {"경기도": 1}
    assert s["kids_op_coord_missing"] == 0


def test_source_key_is_pfct_sn() -> None:
    assert playground.source_key(ITEMS[0]) == "1"
