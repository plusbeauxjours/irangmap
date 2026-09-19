from kidscafe_pipeline.resolve import (
    Candidate,
    SpatialIndex,
    best_match,
    haversine_m,
    tier_of,
)

# 스파이크에서 나온 실제 쌍들. (놀이시설 이름, 테마파크 이름, 거리 m)
TP = [
    Candidate("themepark", "t1", "스타필드마켓 월계점 챔피언", 127.0600, 37.6250),
    Candidate("themepark", "t2", "점핑파크 미사점", 127.1900, 37.5600),
    Candidate("themepark", "t3", "플레이월드 안산점", 126.8300, 37.3000),
    Candidate("themepark", "t4", "프레리키즈카페 양주옥정점", 127.0950, 37.8200),
]
INDEX = SpatialIndex(TP)


def test_haversine_scale() -> None:
    assert abs(haversine_m(127.0, 37.5, 127.0, 37.501) - 111) < 2


def test_identical_name_nearby_is_strong() -> None:
    m = best_match(
        Candidate("playground", "p1", "스타필드마켓 월계점 챔피언", 127.0605, 37.6255),
        INDEX,
    )
    assert m.tier == "strong" and m.other and m.other.key == "t1"


def test_same_building_different_business_is_not_merged() -> None:
    m = best_match(
        Candidate("playground", "p2", "쿠우쿠우미사점", 127.1901, 37.5601), INDEX
    )
    assert m.tier == "none"


def test_branch_name_variation_in_same_building_is_strong() -> None:
    m = best_match(
        Candidate(
            "playground", "p3", "플레이월드 상록수점 놀이시설", 126.8300, 37.3000
        ),
        INDEX,
    )
    assert m.tier == "strong" and m.other and m.other.key == "t3"


def test_shared_region_token_only_yields_weak_for_review() -> None:
    m = best_match(
        Candidate("playground", "p4", "더키즈랩 양주옥정점", 127.0965, 37.8210), INDEX
    )
    assert m.tier == "weak"


def test_same_source_never_matches_itself() -> None:
    m = best_match(TP[0], INDEX)
    assert m.tier == "none" and m.other is None


def test_tier_thresholds() -> None:
    assert tier_of(0.85, 250) == "strong"
    assert tier_of(0.65, 20) == "strong"
    assert tier_of(0.65, 200) == "weak"
    assert tier_of(0.3, 5) == "none"
