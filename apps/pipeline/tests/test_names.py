from kidscafe_pipeline.names import name_similarity, normalize_name


def test_normalize_strips_corp_branch_and_facility_suffixes() -> None:
    assert normalize_name("(주)타요키즈카페 롯데몰 진주점") == "타요키즈카페롯데몰진주"
    assert normalize_name("스타필드마켓 월계점 챔피언") == "스타필드마켓월계점챔피언"
    assert normalize_name("도안화로 내 어린이놀이시설") == "도안화로"
    assert normalize_name("향남돈실내놀이시설") == "향남돈"
    assert normalize_name("꿀잼키즈룸 대전용산점") == "꿀잼키즈룸대전용산"


def test_similarity_ignores_spacing_and_scores_partials() -> None:
    assert name_similarity("하이마운틴어드벤처", "하이마운틴 어드벤처") == 1.0
    assert name_similarity("점핑파크 미사점", "쿠우쿠우미사점") < 0.5
    assert name_similarity("킹콩점프 키즈카페", "킹콩점프") >= 0.8
    assert name_similarity("", "무엇") == 0.0
