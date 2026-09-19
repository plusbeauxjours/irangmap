import json

import httpx

from kidscafe_pipeline.geocode import VWorldGeocoder


def _transport(ok_types: set[str]) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        t = request.url.params["type"]
        if t in ok_types:
            body = {
                "response": {
                    "status": "OK",
                    "refined": {"text": "서울특별시 동작구 노량진로 10 (대방동)"},
                    "result": {"point": {"x": "126.9273", "y": "37.5124"}},
                }
            }
        else:
            body = {"response": {"status": "NOT_FOUND"}}
        return httpx.Response(200, content=json.dumps(body))

    return httpx.MockTransport(handler)


def test_geocode_prefers_road_then_falls_back_to_parcel() -> None:
    g = VWorldGeocoder("K", client=httpx.Client(transport=_transport({"parcel"})))
    got = g.geocode("서울특별시 동작구 노량진로 10", "서울특별시 동작구 대방동 1")
    assert got is not None and got.addr_type == "parcel" and g.calls == 2


def test_geocode_returns_none_when_nothing_matches() -> None:
    g = VWorldGeocoder("K", client=httpx.Client(transport=_transport(set())))
    assert g.geocode("없는 주소", None) is None
    assert g.geocode("", "") is None and g.calls == 1
