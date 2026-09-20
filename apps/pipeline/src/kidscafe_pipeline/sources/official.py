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


def html_to_text(page: str) -> str:
    t = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", page, flags=re.S | re.I)
    t = re.sub(
        r"<br\s*/?>|</(p|div|li|tr|h[1-6]|dd|dt|section|article)>", "\n", t, flags=re.I
    )
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    t = re.sub(r"[ \t\xa0]+", " ", t)
    return re.sub(r"\n\s*\n+", "\n", t).strip()


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
        return True if rp is None else rp.can_fetch("*", url)

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
        text = html_to_text(r.text)
        slug = hashlib.sha1(url.encode()).hexdigest()[:10]
        d = self.out_dir / brand
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{kind}-{slug}.txt").write_text(text, encoding="utf-8")
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
