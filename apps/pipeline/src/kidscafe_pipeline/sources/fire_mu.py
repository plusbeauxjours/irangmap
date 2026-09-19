"""소방청_다중이용업소 영업장별 고유 일련번호 (data.go.kr 15083979).

전국 키즈카페업이 8행뿐이라 시드가 아니다. `다중이용업소` 플래그 교차검증용.
파일은 CP949, 상호에 콤마가 들어가는 행이 있어 csv 모듈로 읽는다.
"""

import csv
import io
from collections import Counter
from pathlib import Path
from typing import Any

SOURCE = "fire_mu"
FIELDS = ("상호", "주소", "영업장면적", "MU번호", "업종", "영업상태")
ENCODINGS = ("cp949", "utf-8-sig")


def read_rows(path: Path) -> list[dict[str, str]]:
    raw = path.read_bytes()
    for enc in ENCODINGS:
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"{path}: {ENCODINGS} 어느 인코딩으로도 디코딩되지 않음")
    reader = csv.DictReader(io.StringIO(text))
    missing = set(FIELDS) - set(reader.fieldnames or ())
    if missing:
        raise ValueError(
            f"{path}: 헤더에 {sorted(missing)} 없음 (헤더={reader.fieldnames})"
        )
    return [
        {k.strip(): (v or "").strip() for k, v in row.items() if k} for row in reader
    ]


def is_kids_cafe(row: dict[str, str]) -> bool:
    return "키즈카페" in row.get("업종", "")


def sido_of(address: str) -> str:
    return address.split()[0] if address.strip() else "(주소없음)"


def source_key(row: dict[str, str]) -> str:
    return row["MU번호"] or f"{row['상호']}|{row['주소']}"


def summarize(rows: list[dict[str, str]]) -> dict[str, Any]:
    kids = [r for r in rows if is_kids_cafe(r)]
    active = [r for r in kids if r["영업상태"] == "정상"]
    return {
        "source": SOURCE,
        "total_rows": len(rows),
        "biz_types": len({r["업종"] for r in rows}),
        "kids_rows": len(kids),
        "kids_status": dict(Counter(r["영업상태"] for r in kids)),
        "kids_active_dedup": len({(r["상호"], r["주소"]) for r in active}),
        "kids_active_by_sido": dict(
            Counter(sido_of(r["주소"]) for r in active).most_common()
        ),
    }


def to_source_records(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    return [{"source": SOURCE, "source_key": source_key(r), "raw": r} for r in rows]
