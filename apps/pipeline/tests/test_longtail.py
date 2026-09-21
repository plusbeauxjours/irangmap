from kidscafe_pipeline.sources import longtail as lt


def test_brand_token_and_region_hint() -> None:
    assert lt.brand_token("꿀잼키즈룸 마포점") == "꿀잼키즈룸"
    assert lt.brand_token("(주)바운스 세종센터") == "바운스"
    assert lt.region_hint("서울특별시 마포구 동교로 132-3 (서교동)") == "마포구"
    assert lt.region_hint("경기도 수원시 영통구 덕영대로 1566") == "수원시 영통구"


def test_classify_filters_aggregators_and_keeps_official_with_token() -> None:
    tok = "꿀잼키즈룸"
    assert (
        lt.classify(
            {
                "url": "https://dodam-platform.com/children-play-facilities/4986",
                "title": "꿀잼키즈룸 마포점",
            },
            tok,
        )
        is None
    )
    assert (
        lt.classify(
            {"url": "https://www.instagram.com/kkuljam_mapo/", "title": "꿀잼키즈룸"},
            tok,
        )
        == "instagram"
    )
    assert (
        lt.classify(
            {"url": "https://blog.naver.com/x/1", "title": "<b>꿀잼키즈룸</b> 후기"},
            tok,
        )
        == "naver_blog"
    )
    assert (
        lt.classify(
            {"url": "https://kkuljam.co.kr/", "title": "꿀잼키즈룸 | 무인 키즈룸"}, tok
        )
        == "official"
    )
    assert (
        lt.classify({"url": "https://someshop.co.kr/", "title": "다른 가게"}, tok)
        is None
    )
