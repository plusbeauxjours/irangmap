from kidscafe_pipeline.classify import classify_name, is_map_default


def test_place_code_overrides_name() -> None:
    assert (
        classify_name("누리마을감자탕 덕천점 실내", place_code="A004").category
        == "restaurant_with_playroom"
    )
    assert classify_name("주식회사 잘큼", place_code="A013").category == "kids_cafe"


def test_franchise_dictionary_wins_over_generic_rules() -> None:
    assert classify_name("(주)점핑몬스터세종신도시점").category == "trampoline_park"
    assert classify_name("스타필드마켓 월계점 챔피언").category == "kids_cafe"
    assert classify_name("서울형 키즈카페 강서구 발산1동점").kids_score == 1.0


def test_rules_separate_non_kids_businesses() -> None:
    assert classify_name("2026 천안유니브시티 페스티벌 명랑운동회").category == "event"
    assert classify_name("밀양댐오토캠핑장").category == "camping"
    assert classify_name("ZZANG GAMES(짱오락실)").category == "arcade"
    assert classify_name("하이비치워터파크").category == "water"
    assert classify_name("전주문화방송(주)").category == "other"


def test_map_default_only_for_confident_kids_categories() -> None:
    assert is_map_default(classify_name("원더빌 키즈카페 고덕점"))
    assert not is_map_default(
        classify_name("도안화로 내 어린이놀이시설", place_code="A004")
    )
    assert not is_map_default(classify_name("황정민글램핑"))
