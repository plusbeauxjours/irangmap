from kidscafe_pipeline import enrich_review as er


def doc(title, contents, url, dt="2026-09-01T00:00:00"):
    return {"title": title, "contents": contents, "url": url, "datetime": dt}


def test_tokens_and_query():
    assert er.brand_token("(주)리틀베베 키즈카페") == "리틀베베"
    assert er.brand_token("도토리숲센터") == "도토리숲"
    assert (
        er.region_hint("경기도 수원시 영통구 덕영대로 1566, 3층 (영통동)")
        == "수원시 영통구 영통동"
    )
    assert (
        er.query_of("㈜플레이영", "경기도 용인시 기흥구 x")
        == "플레이영 용인시 기흥구 요금"
    )


def test_shape_posts_filters_and_orders():
    blog = [
        doc("근처 맛집", "칼국수 맛집", "u1"),  # 토큰 없음 → 제외
        doc("<b>리틀베베</b> 후기", "요금 12,000원", "u2", "2026-01-01"),
        doc("리틀베베 협찬 후기", "체험단으로 다녀왔어요", "u3", "2026-09-01"),
        doc("천안 가볼만한곳", "리틀베베 근처", "u4", "2026-09-10"),
    ]
    cafe = [doc("리틀베베 최신", "보호자 5,000원", "u5", "2026-08-01"), blog[1]]
    posts = er.shape_posts(blog, cafe, "리틀베베 키즈카페")
    assert [p["url"] for p in posts] == ["u5", "u2", "u4", "u3"]
    assert posts[0]["kind"] == "cafe" and posts[-1]["sponsored"]
    assert posts[1]["title"] == "리틀베베 후기"


def _rec(**kw):
    base = {
        "same_venue": True,
        "confidence": 0.8,
        "fetched_at": "2026-09-28",
        "values": {
            "child_fee": {
                "value": "1시간 8,000원",
                "url": "u1",
                "date": "2026-08-01",
                "evidence": "8,000원",
            },
            "hours": {
                "value": "10~20시",
                "url": "u2",
                "date": "2026-09-01",
                "evidence": None,
            },
        },
    }
    base.update(kw)
    return base


def test_compact_keeps_only_values_and_provenance():
    posts = [{"url": "u1", "date": "2026-08-01", "title": "t", "snippet": "본문"}]
    data = {
        "same_venue": True,
        "confidence": 0.7,
        "child_fee": {"value": "8,000원", "post": 1, "evidence": "가" * 300},
        "socks": {"value": None, "post": None, "evidence": None},
        "hours": {"value": "10시", "post": 9, "evidence": ""},
    }
    out = er.compact(data, posts)
    assert set(out["values"]) == {"child_fee", "hours"}
    assert out["values"]["child_fee"]["url"] == "u1"
    assert len(out["values"]["child_fee"]["evidence"]) == er.SNIPPET_MAX
    assert out["values"]["hours"]["url"] is None
    assert "본문" not in str(out)


def test_to_attrs_thresholds():
    a = er.to_attrs(_rec())
    assert a["source"] == "review" and a["child_fee"] == "1시간 8,000원"
    assert a["observed_at"] == "2026-09-01" and a["evidence_url"] == "u1"
    assert er.to_attrs(_rec(same_venue=False)) is None
    assert er.to_attrs(_rec(confidence=0.3)) is None
    assert er.to_attrs(_rec(error="x")) is None
    no_core = _rec(
        values={"hours": {"value": "10시", "url": "u", "date": "d", "evidence": None}}
    )
    assert er.to_attrs(no_core) is None


def test_attach_only_where_no_attrs():
    venues = [
        {"name": "a", "sources": ["playground:1"], "attrs": {"source": "official"}},
        {"name": "b", "sources": ["playground:2"]},
        {"name": "c", "sources": ["playground:3"]},
        {"name": "d", "sources": ["playground:4"]},
    ]
    cache = {
        "playground:1": _rec(),
        "playground:2": _rec(),
        "playground:3": _rec(confidence=0.1),
    }
    stats = er.attach(venues, cache)
    assert venues[0]["attrs"] == {"source": "official"}
    assert venues[1]["attrs"]["source"] == "review"
    assert "attrs" not in venues[2] and "attrs" not in venues[3]
    assert stats == {"attached": 1, "skipped_has_attrs": 1, "below_threshold": 1}
