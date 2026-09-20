from kidscafe_pipeline import enrich_umppa


def _fac(fid="DJ230901", name="서울형 키즈카페 시립 1호점"):
    return {
        "fclty_id": fid,
        "name": name,
        "address": "서울특별시 동작구 노량진로 10 (노량진동) 2층",
        "phone": "02-824-0614",
        "thumbnail_url": "https://umppa.seoul.go.kr/x.jpg",
        "capacity": {"개인": 33, "단체": 33},
        "age_min": 4,
        "age_max": 10,
        "detail": {
            "age_min": 4,
            "age_max": 10,
            "fee_child_krw": 5000,
            "guardian_free": True,
            "socks_required": True,
            "operating_days": "화~일",
            "closed_days": "매주 월요일",
            "hours_slots": ["1회차 09:40~11:40"],
            "rules_text": "양말 필수",
            "view_url": "https://v",
            "reservation_url": "https://r",
        },
    }


def test_norm_addr_strips_parenthesis_and_floor() -> None:
    assert (
        enrich_umppa._norm_addr("서울특별시 동작구 노량진로 10 (노량진동) 2층")
        == "서울특별시 동작구 노량진로 10"
    )


def test_attach_matches_nearby_same_name_and_adds_unmatched() -> None:
    venues = [
        {
            "name": "서울형키즈카페 시립1호점",
            "lon": 126.94,
            "lat": 37.51,
            "sources": ["playground:1"],
            "category": "kids_cafe",
            "addr": "",
            "public": True,
        }
    ]
    facs = [_fac(), _fac("GN000001", "서울형 키즈카페 강남구 삼성점")]
    coords = {"DJ230901": (126.9401, 37.5101), "GN000001": (127.06, 37.51)}
    stats = enrich_umppa.attach(venues, facs, coords, observed="2026-09-20")
    assert stats["strong"] == 1 and stats["added"] == 1 and len(venues) == 2
    a = venues[0]["attrs"]
    assert a["age_range"] == "4~10세 (연나이)"
    assert a["child_fee"] == "아동 1명당 5,000원"
    assert a["guardian_fee"] == "보호자 무료" and a["socks"].startswith("미끄럼방지")
    assert a["observed_at"] == "2026-09-20" and a["source"] == "umppa"
    assert venues[0]["sources"] == ["playground:1", "umppa:DJ230901"]
    assert venues[1]["public"] is True and venues[1]["phone"] == "02-824-0614"


def test_similarity_uses_parenthesis_alias_and_strips_seoul_pattern() -> None:
    assert (
        enrich_umppa.similarity(
            "서울형 키즈카페 송파구 잠실근린공원점(하하호호놀이터)",
            "하하호호놀이터 송파구1호점",
        )
        >= 0.6
    )
    assert (
        enrich_umppa.similarity(
            "서울형 키즈카페 중랑구 묵동점 (중랑실내놀이터 묵동장미마을점)",
            "중랑실내놀이터 묵동장미마을점",
        )
        >= 0.8
    )
    assert enrich_umppa.similarity("서울형 키즈카페 동작구 사당2동점", "닥터방방") < 0.3


def test_match_umppa_prefers_public_neighbor_within_30m() -> None:
    venues = [
        {
            "name": "은평아이맘놀이터 역촌동점(서울형 키즈카페)",
            "lon": 126.92,
            "lat": 37.60,
            "public": True,
        },
        {"name": "닥터방방", "lon": 126.9201, "lat": 37.6001, "public": False},
    ]
    from kidscafe_pipeline.resolve import Candidate, SpatialIndex

    index = SpatialIndex(
        Candidate("union", str(i), v["name"], v["lon"], v["lat"])
        for i, v in enumerate(venues)
    )
    m = enrich_umppa.match_umppa(
        Candidate(
            "umppa",
            "EP1",
            "서울형 키즈카페 은평구 역촌동점(은평아이맘놀이터)",
            126.92,
            37.60,
        ),
        venues,
        index,
    )
    assert m.tier == "strong" and m.other.key == "0"
    far = enrich_umppa.match_umppa(
        Candidate("umppa", "X", "서울형 키즈카페 동작구 사당2동점", 126.9201, 37.6001),
        [venues[1]],
        SpatialIndex([Candidate("union", "0", "닥터방방", 126.9201, 37.6001)]),
    )
    assert far.tier == "none"
