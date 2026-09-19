from pathlib import Path

import pytest

from kidscafe_pipeline.sources import fire_mu

HEADER = "상호,주소,영업장면적,MU번호,업종,영업상태"
ROWS = [
    '"하바나, 본점",부산광역시 연제구 연산동1255-1,90.3,MU1,일반음식점,폐업',
    "운동회,대전광역시 서구 관저동1536-0(관저중로64번길58-0),215.7,MU2,키즈카페업,정상",
    "운동회,대전광역시 서구 관저동1536-0(관저중로64번길58-0),215.7,MU3,키즈카페업,정상",
    "큐티해피,경기도 김포시 풍무동1002-0(유현로242-0),89.89,MU4,키즈카페업,폐업",
    "무번호,,10,,키즈카페업,정상",
]


@pytest.fixture
def csv_path(tmp_path: Path) -> Path:
    p = tmp_path / "fire_mu.csv"
    p.write_bytes("\n".join([HEADER, *ROWS]).encode("cp949"))
    return p


def test_read_rows_decodes_cp949_and_quoted_commas(csv_path: Path) -> None:
    rows = fire_mu.read_rows(csv_path)
    assert len(rows) == 5
    assert rows[0]["상호"] == "하바나, 본점"
    assert rows[1]["업종"] == "키즈카페업"


def test_summarize_counts_kids_and_dedupes_by_name_address(csv_path: Path) -> None:
    stats = fire_mu.summarize(fire_mu.read_rows(csv_path))
    assert stats["total_rows"] == 5
    assert stats["kids_rows"] == 4
    assert stats["kids_status"] == {"정상": 3, "폐업": 1}
    # 같은 상호+주소의 MU 다중행(운동회 ×2)은 하나로
    assert stats["kids_active_dedup"] == 2
    assert stats["kids_active_by_sido"] == {"대전광역시": 2, "(주소없음)": 1}


def test_source_key_falls_back_when_mu_missing(csv_path: Path) -> None:
    rows = fire_mu.read_rows(csv_path)
    assert fire_mu.source_key(rows[1]) == "MU2"
    assert fire_mu.source_key(rows[4]) == "무번호|"


def test_read_rows_rejects_wrong_header(tmp_path: Path) -> None:
    p = tmp_path / "bad.csv"
    p.write_text("a,b,c\n1,2,3\n", encoding="cp949")
    with pytest.raises(ValueError, match="헤더"):
        fire_mu.read_rows(p)
