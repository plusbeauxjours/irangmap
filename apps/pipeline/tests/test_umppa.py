from pathlib import Path

from kidscafe_pipeline.sources import umppa

FIX = Path(__file__).parent / "fixtures"


def test_parse_list_extracts_cards() -> None:
    cards = umppa.parse_list((FIX / "umppa_list.html").read_text(encoding="utf-8"))
    assert len(cards) == 5
    first = cards[0]
    assert first["fclty_id"] == "DJ230901"
    assert first["name"] == "서울형 키즈카페 시립 1호점"
    assert first["capacity"] == {"개인": 33, "단체": 33}
    assert (first["age_min"], first["age_max"]) == (4, 10)
    assert first["address"].startswith("서울특별시 동작구 노량진로 10")
    assert first["phone"] == "02-824-0614"
    assert first["thumbnail_url"].startswith("https://umppa.seoul.go.kr/icare/upload/")


def test_parse_view_extracts_fees_socks_hours() -> None:
    d = umppa.parse_view((FIX / "umppa_view.html").read_text(encoding="utf-8"))
    assert (d["age_min"], d["age_max"]) == (4, 10)
    assert d["fee_child_krw"] == 5000
    assert d["guardian_free"] is True
    assert d["socks_required"] is True
    assert d["operating_days"].startswith("화~일")
    assert "월" in d["closed_days"]
    assert any("09:40~11:40" in s for s in d["hours_slots"])
    assert "주차" in (d["parking"] or "")
    assert "이용료" in d["sections"] and "이용규칙" in d["sections"]


def test_kill_switch_blocks_requests() -> None:
    c = umppa.UmppaCrawler(enabled=False)
    try:
        c.list_page(1)
    except RuntimeError as e:
        assert "ENABLE_UMPPA" in str(e)
    else:
        raise AssertionError("expected RuntimeError")
