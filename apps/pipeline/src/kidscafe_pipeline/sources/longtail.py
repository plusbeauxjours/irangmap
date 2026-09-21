"""롱테일(개인 업소) 공식 채널 탐색 — 카카오 웹 검색으로 공식 홈페이지 후보를 찾는다.

검색 결과의 대부분은 모음 사이트(디렉터리·순위·블로그·SNS)라서 도메인 차단
목록으로 걸러내고, 남은 것 중 제목에 업소 핵심 토큰이 든 URL만 '공식 후보'로 본다.
결과는 URL·제목만 남긴다(수집은 다음 단계에서 robots 확인 후).
"""

import re
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

import httpx

KAKAO_WEB = "https://dapi.kakao.com/v2/search/web"

# 공식 사이트가 아닌 것들: 포털·SNS·블로그·디렉터리·순위·위키·리뷰·쇼핑·지도
BLOCKED = (
    "naver.com",
    "daum.net",
    "kakao.com",
    "google.",
    "youtube.com",
    "instagram.com",
    "facebook.com",
    "tistory.com",
    "namu.wiki",
    "wikipedia.org",
    "dodam-platform.com",
    "dokdokplace.kr",
    "soonwidot.co.kr",
    "diningcode.com",
    "mangoplate.com",
    "tripadvisor",
    "coupang.com",
    "11st.co.kr",
    "gmarket",
    "interpark",
    "yanolja",
    "goodchoice",
    "kidsnote",
    "ochangup.co.kr",
    "saramin",
    "jobkorea",
    "albamon",
    "modoo.at",
    "blog.",
    "cafe.",
    "brunch.co.kr",
    "velog.io",
    "medium.com",
    "pinterest",
    "x.com",
    "twitter.com",
    "smartstore",
    "tmon",
    "wemakeprice",
    "kakaomap",
    "place.map",
    "band.us",
    "linkareer",
    # 표본 300곳 탐색에서 드러난 모음 사이트(업소 정보를 재게시하는 디렉터리·순위·뉴스)
    "kidsinfo.kr",
    "carmap.co.kr",
    "weseb.com",
    "medicalmap.co.kr",
    "platformdodam.com",
    "voiceofyouth.co.kr",
    "conyplace.com",
    "bizopen.kr",
    "kkuda.kr",
    "bizno.net",
    "purpleo.co.kr",
    "dayoff.co.kr",
    "mom-mom.net",
    "tripinfo.co.kr",
    "ayo.pe.kr",
    "academic.kr",
    "bootcareer.net",
    "daangn.com",
    "114-service.co.kr",
    "dokdokinfo.kr",
    "deepplant.co.kr",
    "yugacrew.com",
    "easysearch.kr",
    "gooooodtip.co.kr",
    "enterenter.co.kr",
    "ggha.net",
    "woori-chunsa.com",
    "hgnews.co.kr",
    "cnbcnews.net",
    "jntoday.co.kr",
    "honammaeil.com",
)


def brand_token(name: str) -> str:
    cleaned = re.sub(r"\(주\)|㈜|주식회사", " ", name)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    first = cleaned.split(" ")[0] if cleaned else ""
    return re.sub(r"(점|센터|지점)$", "", first)[:8]


def region_hint(addr: str) -> str:
    parts = [p for p in re.sub(r"\([^)]*\)", " ", addr or "").split() if p]
    gu = [p for p in parts[1:] if re.search(r"(구|시|군)$", p) and len(p) <= 6][:2]
    return " ".join(gu)


def is_blocked(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return any(b in host for b in BLOCKED)


def classify(doc: dict[str, Any], token: str) -> str | None:
    """official | instagram | naver_blog | None(무시)."""
    url = doc.get("url", "")
    title = re.sub(r"<[^>]+>", "", doc.get("title", ""))
    host = urlparse(url).netloc.lower()
    if "instagram.com" in host:
        return "instagram"
    if "blog.naver.com" in host and token and token in title:
        return "naver_blog"
    if is_blocked(url):
        return None
    if token and token in title:
        return "official"
    return None


@dataclass
class ChannelFinder:
    rest_key: str
    client: httpx.Client | None = None
    min_interval_s: float = 0.2  # 카카오 웹 검색 일 3만 회, 초당 수 회 여유
    calls: int = 0
    _last: float = field(default=0.0, repr=False)

    def __post_init__(self) -> None:
        if self.client is None:
            self.client = httpx.Client(
                timeout=15.0, headers={"Authorization": f"KakaoAK {self.rest_key}"}
            )

    def search(self, query: str, size: int = 10) -> list[dict[str, Any]]:
        wait = self.min_interval_s - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        assert self.client is not None
        r = self.client.get(KAKAO_WEB, params={"query": query, "size": size})
        self._last = time.monotonic()
        self.calls += 1
        if r.status_code == 429:
            time.sleep(2)
            r = self.client.get(KAKAO_WEB, params={"query": query, "size": size})
            self.calls += 1
        r.raise_for_status()
        return r.json().get("documents", [])

    def find(self, name: str, addr: str) -> dict[str, Any]:
        token = brand_token(name)
        query = f"{name} {region_hint(addr)} 키즈카페".strip()
        docs = self.search(query)
        out: dict[str, Any] = {
            "query": query,
            "token": token,
            "official": [],
            "instagram": [],
            "naver_blog": [],
        }
        for d in docs:
            kind = classify(d, token)
            if kind:
                out[kind].append(
                    {
                        "url": d["url"],
                        "title": re.sub(r"<[^>]+>", "", d.get("title", ""))[:80],
                    }
                )
        return out
