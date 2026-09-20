"""서울형 키즈카페 — 우리동네키움포털 (umppa.seoul.go.kr/icare).

robots.txt: `/icare/` Allow.
목록: GET BD_selectKidsCafeList.do
      ?q_currPage=N&q_rowPerPage=5&q_fcltyStle=2001&q_hiddenVal=1
      카드마다 시설명·썸네일·이용정원(개인/단체)·이용연령·주소·전화·fcltyId.
상세: GET BD_selectKidsCafeView.do?q_fcltyId=…
      운영일·휴관일·이용연령 규칙·회차 운영시간·이용료(아동 5,000원, 보호자 무료)·
      입장료 할인·이용규칙(양말 필수 등)·주차.
가드레일: 킬스위치(ENABLE_UMPPA), 단일 IP, 요청 간 ≥5초, 연락처 포함 UA,
      차단(403/429)이면 즉시 중단.
"""

import html
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

SOURCE = "umppa"
BASE = "https://umppa.seoul.go.kr/icare/user/kidsCafe/"
LIST_URL = BASE + "BD_selectKidsCafeList.do"
VIEW_URL = BASE + "BD_selectKidsCafeView.do"
RESERVE_URL = "https://umppa.seoul.go.kr/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do?q_fcltyId={fclty_id}&q_fcltyStle="
MIN_INTERVAL_S = 5.0
UA = "kidscafe-map/0.1 (public-data aggregation; contact: repo owner)"


class Blocked(RuntimeError):
    pass


def _clean(fragment: str) -> str:
    t = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    t = re.sub(r"[ \t\xa0]+", " ", t)
    return re.sub(r"\n\s*\n+", "\n", t).strip()


def parse_age_range(text: str) -> tuple[int | None, int | None]:
    m = re.search(r"(\d{1,2})\s*~\s*(\d{1,2})\s*세", text)
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)


_WON = r"(\d{1,3}(?:,\d{3})+|\d{4,5})\s*원"


def parse_fee_text(text: str | None) -> dict[str, Any]:
    """이용료 섹션 자유 텍스트에서 아동 요금·보호자 문구를 뽑는다.

    변형: '아동 1명당 5,000원(보호자 무료)', '아동 1인 5,000원 / 보호자 포함 금액',
    '개인 이용료 아동당 5,000원', '무료'.
    """
    t = text or ""
    lines = [ln.strip(" -*•·\t") for ln in t.splitlines() if ln.strip()]
    fee: int | None = None
    fee_line: str | None = None
    for ln in lines:
        m = re.search(r"(?:아동|어린이|아이|개인)[^\n]{0,20}?" + _WON, ln)
        if m:
            fee, fee_line = int(m.group(1).replace(",", "")), ln
            break
    if fee is None:
        for ln in lines:
            m = re.search(_WON, ln)
            if m:
                fee, fee_line = int(m.group(1).replace(",", "")), ln
                break
    if fee is None and re.search(r"무료", t):
        fee, fee_line = 0, "무료"
    guardian = next(
        (ln for ln in lines if re.search(r"보호자|인솔자|성인|어른", ln)), None
    )
    guardian_free = bool(re.search(r"(보호자|인솔자|성인|어른)[^\n]{0,12}?무료", t))
    return {
        "fee_child_krw": fee,
        "fee_child_text": fee_line[:120] if fee_line else None,
        "guardian_text": guardian[:120] if guardian else None,
        "guardian_free": guardian_free,
    }


def parse_list(page_html: str) -> list[dict[str, Any]]:
    cards = re.findall(
        r'<div class="kidscafe_wrap">(.*?)<!-- kidscafe_wrap end -->',
        page_html,
        flags=re.S,
    )
    out = []
    for c in cards:
        name = _clean(re.search(r"<h5>(.*?)</h5>", c, flags=re.S).group(1))
        fid = re.search(r"q_fcltyId=([A-Z]{2}\d{6})", c)
        thumb = re.search(r'<img src="([^"]+)"', c)
        cap = re.findall(r"<strong>(개인|단체)</strong>\s*<span>\s*(\d+)\s*명", c)
        age_m = re.search(r'<dd class="age">\s*<strong>(.*?)</strong>', c, flags=re.S)
        age_text = _clean(age_m.group(1)) if age_m else ""
        addr_m = re.search(
            r"주&nbsp;.*?</dt>\s*<dd class=\"age\">(.*?)</dd>", c, flags=re.S
        )
        phone_m = re.search(r'href="tel:([^"]+)"', c)
        lo, hi = parse_age_range(age_text)
        out.append(
            {
                "fclty_id": fid.group(1) if fid else None,
                "name": name,
                "thumbnail_url": ("https://umppa.seoul.go.kr" + thumb.group(1))
                if thumb and thumb.group(1).startswith("/")
                else (thumb.group(1) if thumb else None),
                "capacity": {k: int(v) for k, v in cap},
                "age_text": age_text,
                "age_min": lo,
                "age_max": hi,
                "address": _clean(addr_m.group(1)) if addr_m else "",
                "phone": phone_m.group(1).strip() if phone_m else None,
            }
        )
    return out


def _sections(view_html: str) -> dict[str, str]:
    """h3~h6 제목 기준으로 본문을 자른다.

    이용정원·이용연령·운영시간·이용료·입장료 할인·이용규칙 등.
    """
    body = re.sub(r"<script.*?</script>|<style.*?</style>", " ", view_html, flags=re.S)
    parts = re.split(r"<h[3-6][^>]*>(.*?)</h[3-6]>", body, flags=re.S)
    sections: dict[str, str] = {}
    for i in range(1, len(parts) - 1, 2):
        title = _clean(parts[i])
        if title and title not in sections:
            sections[title] = _clean(parts[i + 1])[:4000]
    return sections


def parse_view(view_html: str) -> dict[str, Any]:
    sec = _sections(view_html)
    flat = _clean(view_html)
    fees = parse_fee_text(sec.get("이용료") or flat)
    fee_child = fees["fee_child_krw"]
    guardian_free = fees["guardian_free"]
    socks_required = bool(re.search(r"미끄럼\s*방지\s*양말", flat))
    oper = re.search(r"운영일\s*\n?\s*([^\n]{1,40})", flat)
    closed = re.search(r"휴관일\s*\n?\s*([^\n]{1,80})", flat)
    parking = re.search(r"([^\n]*주차[^\n]*)", flat)
    slots = re.findall(r"(\d회차)\s*\n?\s*(\d{2}:\d{2}~\d{2}:\d{2})", flat)
    lo, hi = parse_age_range(sec.get("이용연령", "") or flat)
    return {
        "age_min": lo,
        "age_max": hi,
        "age_rules": sec.get("이용연령", "")[:1500],
        "fee_child_krw": fee_child,
        "guardian_free": guardian_free,
        "socks_required": socks_required,
        "operating_days": oper.group(1).strip() if oper else None,
        "closed_days": closed.group(1).strip() if closed else None,
        "hours_slots": [f"{a} {b}" for a, b in slots][:12],
        "hours_text": sec.get("운영시간", "")[:600] or None,
        "fee_child_text": fees["fee_child_text"],
        "guardian_text": fees["guardian_text"],
        "parking": parking.group(1).strip()[:200] if parking else None,
        "fee_text": sec.get("이용료", "")[:1500],
        "discount_text": sec.get("입장료 할인", "")[:1500],
        "rules_text": sec.get("이용규칙", "")[:2000],
        "sections": list(sec),
    }


@dataclass
class UmppaCrawler:
    enabled: bool
    client: httpx.Client | None = None
    min_interval_s: float = MIN_INTERVAL_S
    style: str = "2001"
    calls: int = 0
    _last: float = field(default=0.0, repr=False)

    def __post_init__(self) -> None:
        if self.client is None:
            self.client = httpx.Client(
                timeout=30.0, headers={"User-Agent": UA}, follow_redirects=True
            )

    def _get(self, url: str, params: dict[str, Any]) -> str:
        if not self.enabled:
            raise RuntimeError("ENABLE_UMPPA=false — 크롤 킬스위치가 꺼져 있습니다.")
        wait = self.min_interval_s - (time.monotonic() - self._last)
        if self.calls and wait > 0:
            time.sleep(wait)
        assert self.client is not None
        resp = self.client.get(url, params=params)
        self._last = time.monotonic()
        self.calls += 1
        if resp.status_code in (403, 429):
            raise Blocked(f"{resp.status_code} from {url} — 즉시 중단(우회 금지)")
        resp.raise_for_status()
        return resp.text

    def list_page(self, page: int) -> list[dict[str, Any]]:
        params = {
            "q_hiddenVal": "1",
            "q_fcltyId": "",
            "q_rowPerPage": "5",
            "q_currPage": str(page),
            "q_sortName": "",
            "q_sortOrder": "",
            "q_fcltyStle": self.style,
        }
        return parse_list(self._get(LIST_URL, params))

    def view(self, fclty_id: str) -> dict[str, Any]:
        data = parse_view(
            self._get(VIEW_URL, {"q_fcltyId": fclty_id, "q_fcltyStle": ""})
        )
        data["view_url"] = f"{VIEW_URL}?q_fcltyId={fclty_id}&q_fcltyStle="
        data["reservation_url"] = RESERVE_URL.format(fclty_id=fclty_id)
        return data

    def crawl(
        self, *, max_pages: int | None = None, with_view: bool = True, on_progress=None
    ) -> list[dict[str, Any]]:
        facilities: list[dict[str, Any]] = []
        seen: set[str] = set()
        page = 1
        while True:
            cards = self.list_page(page)
            new = [c for c in cards if c["fclty_id"] and c["fclty_id"] not in seen]
            if not new:
                break
            for c in new:
                seen.add(c["fclty_id"])
                facilities.append(c)
            if on_progress:
                on_progress(page, len(facilities))
            page += 1
            if max_pages and page > max_pages:
                break
        if with_view:
            for f in facilities:
                f["detail"] = self.view(f["fclty_id"])
                if on_progress:
                    on_progress(None, len(facilities))
        return facilities
