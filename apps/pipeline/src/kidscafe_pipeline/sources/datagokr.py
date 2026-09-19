"""공공데이터포털(data.go.kr) 조회서비스 공통 클라이언트.

행안부 인허가 조회서비스(테마파크업(기타) 15155250, 휴게음식점 15154921)는
표준 응답 `response.body.items.item[]` + `totalCount`를 따른다
(2026-09-19 확인, 페이지 크기 상한 100).
엔드포인트 URL과 파라미터 이름은 활용신청 뒤 명세에서 확인해 .env(`DATAGOKR_*_URL`)로
넣는다 — 여기서는 추측하지 않는다.
개발계정 일 10,000건 한도를 클라이언트가 세서 넘기 전에 멈춘다.
"""

import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class PagingSpec:
    """서비스별 페이징 규약. 기본값은 행안부 인허가 조회서비스."""

    page_param: str = "pageNo"
    size_param: str = "numOfRows"
    total_keys: tuple[str, ...] = ("totalCount", "totalCnt")
    max_page_size: int = 100


LOCALDATA_PAGING = PagingSpec()
PLAYGROUND_PAGING = PagingSpec(
    page_param="pageIndex", size_param="recordCountPerPage", max_page_size=1000
)


class DailyLimitReached(RuntimeError):
    pass


class DataGoKrClient:
    def __init__(
        self,
        service_key: str,
        *,
        daily_limit: int = 10_000,
        timeout: float = 30.0,
        max_retries: int = 3,
        client: httpx.Client | None = None,
    ) -> None:
        self.service_key = service_key
        self.daily_limit = daily_limit
        self.max_retries = max_retries
        self.calls = 0
        self._client = client or httpx.Client(timeout=timeout)

    def get(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        if self.calls >= self.daily_limit:
            raise DailyLimitReached(f"일 한도 {self.daily_limit}건 도달")
        query = {"serviceKey": self.service_key, "type": "json", **params}
        for attempt in range(self.max_retries):
            try:
                resp = self._client.get(url, params=query)
                resp.raise_for_status()
                self.calls += 1
                return resp.json()
            except (httpx.HTTPStatusError, httpx.TransportError):
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(2**attempt)
        raise AssertionError("unreachable")

    def iter_items(
        self,
        url: str,
        *,
        page_size: int | None = None,
        params: dict[str, Any] | None = None,
        start_page: int = 1,
        on_page: Callable[[int, int], None] | None = None,
        paging: PagingSpec = LOCALDATA_PAGING,
    ) -> Iterator[dict[str, Any]]:
        size = page_size or paging.max_page_size
        page = start_page
        seen = (start_page - 1) * size
        while True:
            data = self.get(
                url,
                {paging.page_param: page, paging.size_param: size, **(params or {})},
            )
            body = data.get("response", {}).get("body", {})
            items = body.get("items") or []
            if isinstance(items, dict):  # XML→JSON 변환 형태: {"item": [...]}
                items = items.get("item") or []
            if isinstance(items, dict):
                items = [items]
            yield from items
            seen += len(items)
            total = next((int(body[k]) for k in paging.total_keys if body.get(k)), 0)
            if on_page:
                on_page(page, total)
            if not items or (total and seen >= total):
                return
            page += 1
