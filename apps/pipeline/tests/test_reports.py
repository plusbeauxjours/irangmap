import gzip
import json
from pathlib import Path

from kidscafe_pipeline import reports
from kidscafe_pipeline.resolve import Candidate


def test_read_jsonl_gz_tolerates_truncated_stream(tmp_path: Path) -> None:
    p = tmp_path / "a.jsonl.gz"
    with gzip.open(p, "wt", encoding="utf-8") as f:
        for i in range(50):
            f.write(json.dumps({"i": i}) + "\n")
    data = p.read_bytes()
    p.write_bytes(data[: len(data) - 12])  # 끝 마커 잘라내기
    got = reports._read_jsonl_gz([str(p)])
    assert 0 < len(got) <= 50 and got[0] == {"i": 0}


def test_union_report_folds_strong_matches_only() -> None:
    pg = [Candidate("playground", "p1", "까르르키즈카페 에코점", 127.0, 37.5)]
    tp = [
        Candidate(
            "themepark", "t1", "까르르키즈카페 에코점", 127.0001, 37.5001
        ),  # same → folded
        Candidate("themepark", "t2", "점핑몬스터 시흥능곡점", 127.2, 37.4),  # new
    ]
    rc = [Candidate("rest_cafes", "r1", "쁘띠몽드 당진점", 126.6, 36.9)]  # new
    out = reports.union_report(pg, tp, rc)
    assert out["themepark_vs_playground"] == {"strong": 1, "none": 1}
    assert out["union_estimate"] == 3
    assert out["union_breakdown"] == {
        "playground": 1,
        "themepark_added": 1,
        "restcafes_added": 1,
    }


def test_merge_attaches_sources_and_geojson_has_one_feature_per_venue() -> None:
    reports.META.clear()
    pg = [
        reports._remember(
            Candidate("playground", "p1", "까르르키즈카페 에코점", 127.0, 37.5),
            category="kids_cafe",
            addr="A",
        )
    ]
    tp = [
        reports._remember(
            Candidate("themepark", "t1", "까르르키즈카페 에코점", 127.0001, 37.5001),
            category="kids_cafe",
            phone="02",
        )
    ]
    out = reports.union_report(pg, tp, [])
    assert len(out["venues"]) == 1
    v = out["venues"][0]
    assert (
        v["sources"] == ["playground:p1", "themepark:t1"]
        and v["addr"] == "A"
        and v["phone"] == "02"
    )
    gj = reports.to_geojson(out["venues"])
    assert gj["features"][0]["properties"]["id"] == 1 and gj["features"][0]["geometry"][
        "coordinates"
    ] == [127.0, 37.5]


def test_closed_name_regex() -> None:
    from kidscafe_pipeline.reports import CLOSED_NAME_RE

    assert CLOSED_NAME_RE.search("릴리펏 마린시티점(폐)")
    assert CLOSED_NAME_RE.search("모모로 키즈카페 폐업")
    assert not CLOSED_NAME_RE.search("폐광 테마 키즈카페")
