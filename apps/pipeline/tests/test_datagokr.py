import json

import httpx
import pytest

from kidscafe_pipeline.sources.datagokr import (
    PLAYGROUND_PAGING,
    DailyLimitReached,
    DataGoKrClient,
)


def _paged_transport(pages: dict[int, list[dict]], total: int) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["serviceKey"] == "KEY"
        page = int(request.url.params["pageNo"])
        body = {
            "response": {"body": {"items": pages.get(page, []), "totalCount": total}}
        }
        return httpx.Response(200, content=json.dumps(body))

    return httpx.MockTransport(handler)


def test_iter_items_walks_pages_until_total_count() -> None:
    pages = {1: [{"id": 1}, {"id": 2}], 2: [{"id": 3}]}
    client = DataGoKrClient(
        "KEY", client=httpx.Client(transport=_paged_transport(pages, total=3))
    )
    got = list(client.iter_items("https://api.example/svc", page_size=2))
    assert [g["id"] for g in got] == [1, 2, 3]
    assert client.calls == 2


def test_iter_items_accepts_xml_style_item_wrapper() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = {"response": {"body": {"items": {"item": {"id": 9}}, "totalCount": 1}}}
        return httpx.Response(200, content=json.dumps(body))

    client = DataGoKrClient(
        "KEY", client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    assert list(client.iter_items("https://api.example/svc")) == [{"id": 9}]


def test_daily_limit_stops_before_exceeding() -> None:
    client = DataGoKrClient(
        "KEY",
        daily_limit=1,
        client=httpx.Client(transport=_paged_transport({1: [{}]}, 5)),
    )
    client.get("https://api.example/svc", {"pageNo": 1})
    with pytest.raises(DailyLimitReached):
        client.get("https://api.example/svc", {"pageNo": 2})


def test_iter_items_supports_playground_paging_convention() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert (
            "pageIndex" in request.url.params
            and "recordCountPerPage" in request.url.params
        )
        page = int(request.url.params["pageIndex"])
        items = [{"pfctSn": page}] if page <= 2 else []
        body = {"response": {"body": {"items": items, "totalCnt": 2}}}
        return httpx.Response(200, content=json.dumps(body))

    client = DataGoKrClient(
        "KEY", client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    got = list(
        client.iter_items(
            "https://api.example/pfc3", paging=PLAYGROUND_PAGING, page_size=1
        )
    )
    assert [g["pfctSn"] for g in got] == [1, 2] and client.calls == 2
