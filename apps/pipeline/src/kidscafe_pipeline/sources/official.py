"""프랜차이즈 공식 사이트 수집 — 채널 조사(channels.json) 결과의 URL만 가져온다.

가드레일: robots.txt 준수(urllib.robotparser), 호스트별 요청 간 ≥3초, 로그인·우회 없음,
403/429면 그 호스트는 중단. 본문은 텍스트로 정리해 data/raw/official/<brand>/에 저장.
"""

import hashlib
import html
import json
import re
import time
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx

UA = "kidscafe-map/0.1 (official-site fact check; contact: repo owner)"
MIN_INTERVAL_S = 3.0
MAX_CRAWL_DELAY_S = (
    60.0  # robots Crawl-delay가 이보다 크면(코코몽 3600) 그 호스트는 건너뜀
)


def html_to_text(page: str) -> str:
    """본문 텍스트. 제목은 `## `, 표 셀은 ` | `로 남겨 매장별 구획을 유지한다."""
    t = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", page, flags=re.S | re.I)
    t = re.sub(r"<!--.*?-->", " ", t, flags=re.S)
    t = re.sub(r"<h[1-6][^>]*>", "\n## ", t, flags=re.I)
    # 표 제목이 이미지인 사이트(뽀로로파크 '일산,영등포,금천점') → alt를 제목으로
    t = re.sub(
        r'<img[^>]+alt="([^"]{2,60})"[^>]*>',
        lambda m: f"\n## {m.group(1)}\n" if m.group(1).strip() else " ",
        t,
        flags=re.I,
    )
    t = re.sub(r"</t[dh]>", " | ", t, flags=re.I)
    t = re.sub(
        r"<br\s*/?>|</(p|div|li|tr|h[1-6]|dd|dt|section|article|caption)>",
        "\n",
        t,
        flags=re.I,
    )
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    t = re.sub(r"[ \t\xa0]+", " ", t)
    t = re.sub(r"( \| )+\n", "\n", t)  # 행 끝의 빈 셀 구분자 정리
    return re.sub(r"\n\s*\n+", "\n", t).strip()


def store_links(page: str, base: str, pattern: str, cap: int = 40) -> list[str]:
    """매장 목록 페이지에서 매장별 상세 링크(정규식 매치)를 절대 URL로 모은다."""
    rx = re.compile(pattern)
    b = urlparse(base)
    out: list[str] = []
    for m in re.finditer(r'href="([^"#]+)"', page, flags=re.I):
        href = m.group(1)
        path = href if href.startswith("/") else urlparse(href).path
        if href.startswith("http") and urlparse(href).netloc != b.netloc:
            continue
        if rx.match(path):
            out.append(
                href if href.startswith("http") else f"{b.scheme}://{b.netloc}{path}"
            )
    return list(dict.fromkeys(out))[:cap]


def image_urls(page: str, base: str) -> list[str]:
    """요금표가 이미지인 사이트가 많다 — img src를 절대 URL로 모아둔다."""
    out = []
    for m in re.finditer(r'<img[^>]+src="([^"]+)"', page, flags=re.I):
        src = m.group(1)
        if src.startswith("data:"):
            continue
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/"):
            p = urlparse(base)
            src = f"{p.scheme}://{p.netloc}{src}"
        elif not src.startswith("http"):
            src = base.rsplit("/", 1)[0] + "/" + src
        out.append(src)
    return list(dict.fromkeys(out))


@dataclass
class OfficialFetcher:
    out_dir: Path
    client: httpx.Client | None = None
    min_interval_s: float = MIN_INTERVAL_S
    calls: int = 0
    _last: dict[str, float] = field(default_factory=dict, repr=False)
    _robots: dict[str, urllib.robotparser.RobotFileParser | None] = field(
        default_factory=dict, repr=False
    )
    _blocked: set[str] = field(default_factory=set, repr=False)
    skipped_crawl_delay: dict[str, float] = field(default_factory=dict)
    last_html: str = field(default="", repr=False)

    def __post_init__(self) -> None:
        if self.client is None:
            self.client = httpx.Client(
                timeout=30.0, headers={"User-Agent": UA}, follow_redirects=True
            )

    def _allowed(self, url: str) -> bool:
        host = urlparse(url).netloc
        if host not in self._robots:
            rp = urllib.robotparser.RobotFileParser()
            try:
                self._wait(host)
                assert self.client is not None
                r = self.client.get(f"https://{host}/robots.txt")
                self.calls += 1
                if r.status_code == 200:
                    rp.parse(r.text.splitlines())
                    self._robots[host] = rp
                else:
                    self._robots[host] = None  # robots 없음 = 허용
            except httpx.HTTPError:
                self._robots[host] = None
        rp = self._robots[host]
        if rp is None:
            return True
        delay = rp.crawl_delay("*")
        if delay and delay > MAX_CRAWL_DELAY_S:
            self._blocked.add(host)
            self.skipped_crawl_delay[host] = delay
            return False
        if delay and delay > self.min_interval_s:
            self.min_interval_s = float(delay)
        return rp.can_fetch("*", url)

    def _wait(self, host: str) -> None:
        wait = self.min_interval_s - (time.monotonic() - self._last.get(host, 0.0))
        if wait > 0:
            time.sleep(wait)
        self._last[host] = time.monotonic()

    def fetch(self, brand: str, url: str, kind: str) -> dict | None:
        """한 페이지를 받아 텍스트·이미지 URL·메타를 저장한다. 막히면 None."""
        host = urlparse(url).netloc
        if host in self._blocked or not self._allowed(url):
            return None
        self._wait(host)
        assert self.client is not None
        try:
            r = self.client.get(url)
        except httpx.HTTPError as e:
            return {"brand": brand, "url": url, "kind": kind, "error": str(e)[:200]}
        self.calls += 1
        if r.status_code in (403, 429):
            self._blocked.add(host)
            return None
        if r.status_code != 200:
            return {
                "brand": brand,
                "url": url,
                "kind": kind,
                "error": f"http {r.status_code}",
            }
        self.last_html = r.text
        text = html_to_text(r.text)
        slug = hashlib.sha1(url.encode()).hexdigest()[:10]
        d = self.out_dir / brand
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{kind}-{slug}.txt").write_text(text, encoding="utf-8")
        (d / f"{kind}-{slug}.html").write_text(r.text, encoding="utf-8")
        meta = {
            "brand": brand,
            "url": url,
            "kind": kind,
            "fetched_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "chars": len(text),
            "images": image_urls(r.text, url)[:60],
            "text_file": f"{kind}-{slug}.txt",
        }
        (d / f"{kind}-{slug}.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        return meta
