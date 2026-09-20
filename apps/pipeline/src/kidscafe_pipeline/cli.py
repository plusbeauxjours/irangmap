import gzip
import json
import sys
from pathlib import Path
from typing import Any

import typer

from . import enrich_umppa, extract_claude, reports
from .config import REPO_ROOT, get_settings
from .geocode import VWorldGeocoder
from .sources import (
    fire_mu,
    official,
    playground,
    rest_cafes,
    themepark_other,
    umppa,
)
from .sources.datagokr import PLAYGROUND_PAGING, DataGoKrClient

app = typer.Typer(
    no_args_is_help=True,
    help="kidscafe 데이터 파이프라인",
    pretty_exceptions_enable=False,
)
ingest_app = typer.Typer(
    no_args_is_help=True, help="공공데이터 수집 → venue_source_record"
)
app.add_typer(ingest_app, name="ingest")
report_app = typer.Typer(no_args_is_help=True, help="원본 파일 기반 리포트 (DB 불필요)")
app.add_typer(report_app, name="report")


def _echo(stats: dict) -> None:
    typer.echo(json.dumps(stats, ensure_ascii=False, indent=2))


def _repo_path(p: Path | None) -> Path | None:
    """`uv run --directory`가 cwd를 바꾸므로 상대 경로는 repo 루트 기준으로 푼다."""
    if p is None or p.is_absolute():
        return p
    return REPO_ROOT / p


@ingest_app.command("fire-mu")
def ingest_fire_mu(
    path: Path | None = typer.Option(
        None, help="소방청 CSV 경로. 기본 data/raw/fire_mu.download"
    ),
    dry_run: bool = typer.Option(False, "--dry-run", help="DB에 쓰지 않고 집계만 출력"),
) -> None:
    """소방청 다중이용업소 CSV에서 키즈카페업 행만 원본으로 적재한다."""
    csv_path = _repo_path(path) or get_settings().data_dir / "fire_mu.download"
    rows = fire_mu.read_rows(csv_path)
    stats = fire_mu.summarize(rows)
    if dry_run:
        _echo({**stats, "dry_run": True})
        return

    from .db import session_scope
    from .loader import upsert_source_records
    from .runs import finish_run, start_run

    kids = [r for r in rows if fire_mu.is_kids_cafe(r)]
    with session_scope() as session:
        run = start_run(session, "ingest fire-mu", dry_run=False)
        stats["upserted"] = upsert_source_records(
            session, fire_mu.to_source_records(kids), run.id
        )
        stats["run_id"] = run.id
        finish_run(session, run, stats)
    _echo(stats)


@ingest_app.command("themepark-other")
def ingest_themepark_other(
    dry_run: bool = typer.Option(False, "--dry-run", help="DB에 쓰지 않고 집계만 출력"),
    limit: int | None = typer.Option(None, help="처음 N건만 (스파이크용)"),
    save: Path | None = typer.Option(
        None, help="받은 항목 전체를 이 JSON 파일에도 저장"
    ),
) -> None:
    """행안부 테마파크업(기타) 조회서비스 전량을 원본으로 적재한다 (1차 시드)."""
    settings = get_settings()
    if not settings.data_go_kr_key or not settings.datagokr_themepark_url:
        raise typer.BadParameter(
            ".env에 DATA_GO_KR_KEY와 DATAGOKR_THEMEPARK_URL이 필요합니다 "
            "(data.go.kr 활용신청 뒤 명세에서 확인)."
        )
    client = DataGoKrClient(
        settings.data_go_kr_key, daily_limit=settings.datagokr_daily_limit
    )
    items: list[dict] = []
    for item in client.iter_items(settings.datagokr_themepark_url):
        items.append(item)
        if limit and len(items) >= limit:
            break
    stats = {**themepark_other.summarize(items), "api_calls": client.calls}
    save = _repo_path(save)
    if save:
        save.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
        stats["saved_to"] = str(save)
    if dry_run:
        _echo({**stats, "dry_run": True})
        return

    from .db import session_scope
    from .loader import upsert_source_records
    from .runs import finish_run, start_run

    with session_scope() as session:
        run = start_run(session, "ingest themepark-other", dry_run=False)
        stats["upserted"] = upsert_source_records(
            session, themepark_other.to_source_records(items), run.id
        )
        stats["run_id"] = run.id
        finish_run(session, run, stats)
    _echo(stats)


@ingest_app.command("rest-cafes")
def ingest_rest_cafes(
    dry_run: bool = typer.Option(False, "--dry-run", help="DB에 쓰지 않고 집계만 출력"),
    save: Path | None = typer.Option(
        None, help="전량을 gzip JSONL로 저장 (예: rest_cafes.jsonl.gz)"
    ),
    start_page: int = typer.Option(1, help="중단된 pull 재개용 시작 페이지"),
    max_pages: int | None = typer.Option(None, help="스파이크용: 최대 페이지 수"),
) -> None:
    """행안부 휴게음식점 조회서비스 전량(647k, 100/page)을 스트리밍 집계한다."""
    settings = get_settings()
    if not settings.data_go_kr_key or not settings.datagokr_restcafe_url:
        raise typer.BadParameter(
            ".env에 DATA_GO_KR_KEY와 DATAGOKR_RESTCAFE_URL이 필요합니다."
        )
    if not dry_run:
        raise typer.BadParameter(
            "DB 적재는 아직 구현 전 — 지금은 --dry-run만 지원합니다."
        )
    client = DataGoKrClient(
        settings.data_go_kr_key, daily_limit=settings.datagokr_daily_limit
    )
    summary = rest_cafes.Summary()
    save = _repo_path(save)
    # 재개(start_page>1)면 이어 쓴다. 새 pull이면 덮어쓴다.
    out = (
        gzip.open(save, "at" if start_page > 1 else "wt", encoding="utf-8")
        if save
        else None
    )
    pages_done = 0

    class _Stop(Exception):
        pass

    def on_page(page: int, total: int) -> None:
        nonlocal pages_done
        pages_done += 1
        if page % 100 == 0 or page == start_page:
            print(
                f"page {page} / ~{-(-total // 100)}  items={summary.total}",
                file=sys.stderr,
            )
        if max_pages and pages_done >= max_pages:
            raise _Stop

    try:
        for item in client.iter_items(
            settings.datagokr_restcafe_url, start_page=start_page, on_page=on_page
        ):
            summary.add(item)
            if out:
                out.write(json.dumps(item, ensure_ascii=False) + "\n")
    except _Stop:
        pass
    finally:
        if out:
            out.close()
    stats = {**summary.as_dict(), "api_calls": client.calls, "dry_run": True}
    if save:
        stats["saved_to"] = str(save)
    _echo(stats)


@ingest_app.command("playground")
def ingest_playground(
    dry_run: bool = typer.Option(False, "--dry-run", help="DB에 쓰지 않고 집계만 출력"),
    save: Path | None = typer.Option(None, help="받은 항목 전체를 gzip JSONL로 저장"),
) -> None:
    """행안부 전국어린이놀이시설정보서비스 전량(85k, 1000/page)을 받는다."""
    settings = get_settings()
    if not settings.data_go_kr_key or not settings.datagokr_playground_url:
        raise typer.BadParameter(
            ".env에 DATA_GO_KR_KEY와 DATAGOKR_PLAYGROUND_URL이 필요합니다."
        )
    if not dry_run:
        raise typer.BadParameter(
            "DB 적재는 아직 구현 전 — 지금은 --dry-run만 지원합니다."
        )
    client = DataGoKrClient(
        settings.data_go_kr_key, daily_limit=settings.datagokr_daily_limit
    )
    items = list(
        client.iter_items(settings.datagokr_playground_url, paging=PLAYGROUND_PAGING)
    )
    stats = {**playground.summarize(items), "api_calls": client.calls, "dry_run": True}
    save = _repo_path(save)
    if save:
        with gzip.open(save, "wt", encoding="utf-8") as out:
            for it in items:
                out.write(json.dumps(it, ensure_ascii=False) + "\n")
        stats["saved_to"] = str(save)
    _echo(stats)


@report_app.command("seeds")
def report_seeds(
    raw_dir: Path | None = typer.Option(None, help="원본 폴더. 기본 data/raw"),
) -> None:
    """놀이시설 A013 ∪ 테마파크(키즈) ∪ 휴게음식점(키즈) — 매칭 tier와 union N 추정."""
    raw = _repo_path(raw_dir) or get_settings().data_dir
    pg = reports.load_playground_a013(raw / "playground.jsonl.gz")
    tp, tp_cats = reports.load_themepark_kids(raw / "themepark_other.json")
    rc, rc_stats = reports.load_rest_cafes_kids(str(raw / "rest_cafes.part*.jsonl.gz"))
    out = reports.union_report(pg, tp, rc)
    out.pop("venues")
    out["themepark_categories"] = dict(tp_cats.most_common())
    out["restcafes"] = {
        k: rc_stats[k]
        for k in (
            "files",
            "distinct_mng_no",
            "bzstat_distinct",
            "bzstat_kids_like",
            "snttn_kids_like",
            "kids_bzstat",
            "kids_name_only",
            "kids_active",
            "kids_active_by_sido",
            "kids_active_bzstat",
            "kids_active_coord_missing",
            "kids_active_hpg",
            "kids_active_mlt_yn",
        )
    }
    _echo(out)


export_app = typer.Typer(no_args_is_help=True, help="파생 산출물 내보내기")
app.add_typer(export_app, name="export")


@export_app.command("geojson")
def export_geojson(
    out: Path = typer.Option(..., help="출력 GeoJSON 경로"),
    raw_dir: Path | None = typer.Option(None, help="원본 폴더. 기본 data/raw"),
) -> None:
    """3소스 union(strong 매칭 병합)을 지도 MVP용 GeoJSON으로 내보낸다."""
    raw = _repo_path(raw_dir) or get_settings().data_dir
    out = _repo_path(out) or out
    pg = reports.load_playground_a013(raw / "playground.jsonl.gz")
    tp, _ = reports.load_themepark_kids(raw / "themepark_other.json")
    rc, _ = reports.load_rest_cafes_kids(str(raw / "rest_cafes.part*.jsonl.gz"))
    venues = reports.union_report(pg, tp, rc)["venues"]
    umppa_stats = None
    umppa_path = raw / "umppa.json"
    if umppa_path.exists():
        settings = get_settings()
        facilities = json.loads(umppa_path.read_text(encoding="utf-8"))
        coords = enrich_umppa.geocode_all(
            facilities,
            VWorldGeocoder(settings.vworld_key or ""),
            raw.parent / "derived" / "umppa_geocode_cache.json",
        )
        umppa_stats = enrich_umppa.attach(venues, facilities, coords)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(reports.to_geojson(venues), ensure_ascii=False), encoding="utf-8"
    )
    _echo(
        {
            "features": len(venues),
            "umppa": umppa_stats,
            "out": str(out),
            "bytes": out.stat().st_size,
        }
    )


@ingest_app.command("umppa")
def ingest_umppa(
    dry_run: bool = typer.Option(False, "--dry-run", help="DB에 쓰지 않고 집계만 출력"),
    save: Path | None = typer.Option(None, help="시설+상세 JSON 저장 경로"),
    max_pages: int | None = typer.Option(None, help="목록 페이지 상한 (스파이크용)"),
    no_view: bool = typer.Option(
        False, "--no-view", help="상세(이용안내) 페이지는 건너뜀"
    ),
) -> None:
    """서울형 키즈카페(우리동네키움포털) 목록·이용안내를 수집한다.

    ENABLE_UMPPA=true 필요, 요청 간 5초 이상.
    """
    settings = get_settings()
    if not dry_run:
        raise typer.BadParameter(
            "DB 적재는 아직 구현 전 — 지금은 --dry-run만 지원합니다."
        )
    crawler = umppa.UmppaCrawler(enabled=settings.enable_umppa)

    def progress(page, n):
        print(f"page={page} facilities={n} calls={crawler.calls}", file=sys.stderr)

    facilities = crawler.crawl(
        max_pages=max_pages, with_view=not no_view, on_progress=progress
    )
    save = _repo_path(save)
    if save:
        save.parent.mkdir(parents=True, exist_ok=True)
        save.write_text(
            json.dumps(facilities, ensure_ascii=False, indent=1), encoding="utf-8"
        )
    with_detail = [f for f in facilities if f.get("detail")]
    _echo(
        {
            "source": umppa.SOURCE,
            "facilities": len(facilities),
            "with_detail": len(with_detail),
            "calls": crawler.calls,
            "age_ranges": sorted({f["age_text"] for f in facilities})[:12],
            "guardian_free": sum(
                1 for f in with_detail if f["detail"].get("guardian_free")
            ),
            "socks_required": sum(
                1 for f in with_detail if f["detail"].get("socks_required")
            ),
            "fee_child_values": sorted(
                {f["detail"].get("fee_child_krw") for f in with_detail} - {None}
            ),
            "saved_to": str(save) if save else None,
            "dry_run": True,
        }
    )


@ingest_app.command("official")
def ingest_official(
    channels: Path = typer.Option(
        Path("data/raw/official/channels.json"), help="채널 조사 결과 JSON"
    ),
    out_dir: Path = typer.Option(Path("data/raw/official"), help="텍스트 저장 폴더"),
    brands: str | None = typer.Option(None, help="쉼표로 브랜드 제한"),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="DB에 쓰지 않음(현재 유일 경로)"
    ),
) -> None:
    """프랜차이즈 공식 사이트(매장 목록·이용안내)를 robots 준수·3초 간격으로 저장."""
    if not dry_run:
        raise typer.BadParameter("DB 적재는 아직 구현 전 — --dry-run만 지원합니다.")
    ch_path = _repo_path(channels) or channels
    out = _repo_path(out_dir) or out_dir
    rows = json.loads(ch_path.read_text(encoding="utf-8"))
    want = {b.strip() for b in brands.split(",")} if brands else None
    fetcher = official.OfficialFetcher(out)
    saved, skipped, errors = [], [], []
    for row in rows:
        if want and row["brand"] not in want:
            continue
        if row.get("brand_type") == "generic":
            skipped.append(row["brand"])
            continue
        for kind in ("official_url", "store_list_url", "info_url"):
            url = row.get(kind)
            if not url:
                continue
            meta = fetcher.fetch(row["brand"], url, kind.replace("_url", ""))
            if meta is None:
                errors.append({"brand": row["brand"], "url": url, "error": "blocked"})
            elif meta.get("error"):
                errors.append(meta)
            else:
                saved.append({k: meta[k] for k in ("brand", "kind", "chars", "url")})
                print(
                    f"saved {meta['brand']} {meta['kind']} {meta['chars']}c",
                    file=sys.stderr,
                )
    _echo(
        {
            "saved": len(saved),
            "calls": fetcher.calls,
            "generic_skipped": skipped,
            "errors": errors,
            "out_dir": str(out),
            "dry_run": True,
        }
    )


extract_app = typer.Typer(
    no_args_is_help=True, help="저장된 원문 → 구조화 속성 (claude -p)"
)
app.add_typer(extract_app, name="extract")


@extract_app.command("official")
def extract_official(
    in_dir: Path = typer.Option(
        Path("data/raw/official"), help="ingest official 산출 폴더"
    ),
    out: Path = typer.Option(
        Path("data/derived/official_attrs.json"), help="결과 JSON"
    ),
    model: str = typer.Option("sonnet", help="claude -p 모델 별칭"),
    brands: str | None = typer.Option(None, help="쉼표로 브랜드 제한"),
    limit: int | None = typer.Option(None, help="처리할 페이지 수 상한(스파이크용)"),
    redo: bool = typer.Option(False, "--redo", help="이미 추출된 페이지도 다시"),
) -> None:
    """저장 텍스트를 Claude Code 헤드리스로 읽어 속성을 뽑는다(증분, 재시작 안전)."""
    src = _repo_path(in_dir) or in_dir
    out = _repo_path(out) or out
    results: dict[str, Any] = {}
    if out.exists() and not redo:
        results = json.loads(out.read_text(encoding="utf-8"))
    want = {b.strip() for b in brands.split(",")} if brands else None
    metas = sorted(p for p in src.glob("*/*.json"))
    done = 0
    cost = 0.0
    for mp in metas:
        meta = json.loads(mp.read_text(encoding="utf-8"))
        if want and meta["brand"] not in want:
            continue
        key = f"{meta['brand']}|{meta['url']}"
        if key in results and not redo:
            continue
        if limit is not None and done >= limit:
            break
        text = (mp.parent / meta["text_file"]).read_text(encoding="utf-8")
        if len(text) < 80:
            results[key] = {
                "error": "too short",
                "brand": meta["brand"],
                "url": meta["url"],
            }
            continue
        data = extract_claude.extract(
            text, brand=meta["brand"], url=meta["url"], model=model
        )
        data.update({"brand": meta["brand"], "url": meta["url"], "kind": meta["kind"]})
        data["observed_at"] = meta["fetched_at"][:10]
        results[key] = data
        done += 1
        cost += (data.get("_usage") or {}).get("cost_usd") or 0.0
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(
            f"{meta['brand']:10s} {meta['kind']:6s} conf={data.get('confidence')} "
            f"age={data.get('age_range')} fee={str(data.get('child_fee'))[:30]}",
            file=sys.stderr,
        )
    _echo(
        {
            "extracted_now": done,
            "total": len(results),
            "cost_usd_now": round(cost, 3),
            "out": str(out),
        }
    )
