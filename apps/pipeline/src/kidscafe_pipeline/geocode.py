"""VWorld(국토부) 지오코더 — 주소 → WGS84.

`https://api.vworld.kr/req/address?service=address&request=getcoord`.
도로명(road)으로 먼저, 실패하면 지번(parcel)으로.
공공 API라 결과 저장에 제약이 없다(카카오와 다름).
"""

from dataclasses import dataclass

import httpx

VWORLD_URL = "https://api.vworld.kr/req/address"


@dataclass(frozen=True)
class GeocodeResult:
    lon: float
    lat: float
    refined: str
    addr_type: str  # road | parcel


class VWorldGeocoder:
    def __init__(
        self, key: str, *, timeout: float = 15.0, client: httpx.Client | None = None
    ):
        self.key = key
        self.calls = 0
        self._client = client or httpx.Client(timeout=timeout)

    def _query(self, address: str, addr_type: str) -> GeocodeResult | None:
        params = {
            "service": "address",
            "request": "getcoord",
            "version": "2.0",
            "crs": "epsg:4326",
            "type": addr_type,
            "refine": "true",
            "simple": "false",
            "format": "json",
            "address": address,
            "key": self.key,
        }
        resp = self._client.get(VWORLD_URL, params=params)
        resp.raise_for_status()
        self.calls += 1
        body = resp.json().get("response", {})
        if body.get("status") != "OK":
            return None
        point = body["result"]["point"]
        return GeocodeResult(
            lon=float(point["x"]),
            lat=float(point["y"]),
            refined=body.get("refined", {}).get("text", ""),
            addr_type=addr_type,
        )

    def geocode(
        self, road_addr: str | None, jibun_addr: str | None = None
    ) -> GeocodeResult | None:
        for addr, kind in ((road_addr, "road"), (jibun_addr, "parcel")):
            if addr and addr.strip():
                got = self._query(addr.strip(), kind)
                if got:
                    return got
        return None
