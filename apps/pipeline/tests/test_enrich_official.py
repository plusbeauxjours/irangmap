from kidscafe_pipeline import enrich_official as eo


def test_brand_of_skips_generic_and_seoul() -> None:
    generic = {"방방", "트램폴린파크"}
    assert eo.brand_of("바운스 트램폴린파크 세종점", generic) == "바운스"
    assert eo.brand_of("우리동네 방방", generic) is None
    assert eo.brand_of("서울형키즈카페 시립1호점", generic) is None


def test_locality_tokens_and_store_match() -> None:
    assert eo.locality_tokens("뽀로로파크 롯데빅마켓 영등포점", "뽀로로파크") == [
        "영등포"
    ]
    assert eo.locality_tokens("세종센터", "바운스") == ["세종"]
    venue = {"name": "바운스 트램폴린파크 세종", "addr": "세종특별자치시 국세청로 32"}
    store = {
        "store_name": "세종센터",
        "address": "세종 국세청로 32 마크원애비뉴 B동 4층",
    }
    assert eo.store_matches(venue, store, "바운스") >= 1.0
    other = {"store_name": "강남센터", "address": "서울 강남구 테헤란로 1"}
    assert eo.store_matches(venue, other, "바운스") < 1.0


def test_attach_prefers_store_over_brand_and_keeps_existing_attrs() -> None:
    results = [
        {
            "brand": "바운스",
            "url": "https://v/center",
            "confidence": 0.5,
            "observed_at": "2026-09-20",
            "brand_level": {
                "age_range": None,
                "child_fee": None,
                "guardian_fee": None,
                "socks": "미끄럼방지 양말 필수",
                "play_zones": None,
                "amenities": None,
                "hours": None,
                "notes": None,
                "reservation": None,
            },
            "stores": [],
            "store_names": [],
        },
        {
            "brand": "바운스",
            "url": "https://v/center/sejong",
            "confidence": 0.9,
            "observed_at": "2026-09-20",
            "brand_level": {f: None for f in eo._FIELDS},
            "stores": [
                {
                    "store_name": "세종센터",
                    "address": "세종 국세청로 32",
                    "phone": "1599-9583",
                    "age_range": "신장 80cm 이상",
                    "child_fee": "3시간 키즈 16,800원",
                    "guardian_fee": "보호자입장권 8,000원",
                    "socks": None,
                    "play_zones": "트램폴린",
                    "amenities": None,
                    "hours": "주중 10:00~19:00",
                    "notes": None,
                    "reservation": None,
                }
            ],
            "store_names": ["세종센터"],
        },
    ]
    venues = [
        {
            "name": "바운스 트램폴린파크 세종",
            "addr": "세종특별자치시 국세청로 32",
            "sources": ["playground:1"],
        },
        {
            "name": "바운스 강남",
            "addr": "서울 강남구 역삼동 1",
            "sources": ["playground:2"],
        },
        {
            "name": "바운스 부산",
            "addr": "부산 해운대구",
            "sources": ["playground:3"],
            "attrs": {"source": "umppa"},
        },
    ]
    stats = eo.attach(venues, results, generic=set(), observed="2026-09-20")
    assert stats["store_scope"] == 1 and stats["brand_scope"] == 1
    a = venues[0]["attrs"]
    assert (
        a["scope"] == "store"
        and a["child_fee"].startswith("3시간")
        and a["socks"].startswith("미끄럼")
    )
    assert venues[0]["phone"] == "1599-9583"
    b = venues[1]["attrs"]
    assert (
        b["scope"] == "brand" and b["socks"] and b["child_fee"] is None
    )  # store 페이지 값은 공통값에 안 섞임
    assert venues[2]["attrs"] == {"source": "umppa"}
