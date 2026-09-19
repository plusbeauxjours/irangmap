from kidscafe_pipeline import normalize

# 테마파크업(기타) 실데이터에서 뽑은 좌표(EPSG:5174).
# 변환 결과가 주소의 도시 안에 떨어지는지로 검증한다.
JEONJU_MBC = (211310.968538978, 257156.586411105)  # 전북 전주시 완산구
CHEONAN_STADIUM = (210178.819591002, 368635.028176592)  # 충남 천안시 서북구


def test_tm_to_wgs84_lands_in_the_right_city() -> None:
    lon, lat = normalize.tm_to_wgs84(*JEONJU_MBC)
    assert 127.05 < lon < 127.20 and 35.78 < lat < 35.88  # 전주 시내
    lon, lat = normalize.tm_to_wgs84(*CHEONAN_STADIUM)
    assert 127.05 < lon < 127.20 and 36.75 < lat < 36.90  # 천안 시내


def test_parse_coord_rejects_missing_and_out_of_korea() -> None:
    assert normalize.parse_coord({"CRD_INFO_X": "", "CRD_INFO_Y": ""}) is None
    assert normalize.parse_coord({"CRD_INFO_X": "abc", "CRD_INFO_Y": "1"}) is None
    assert (
        normalize.parse_coord({"CRD_INFO_X": "9999999", "CRD_INFO_Y": "9999999"})
        is None
    )
    got = normalize.parse_coord(
        {"CRD_INFO_X": str(JEONJU_MBC[0]), "CRD_INFO_Y": str(JEONJU_MBC[1])}
    )
    assert got is not None and normalize.in_korea(*got)
