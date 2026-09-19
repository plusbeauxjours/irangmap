from typing import Any

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .models import VenueSourceRecord


def upsert_source_records(
    session: Session, records: list[dict[str, Any]], run_id: int
) -> int:
    """(source, source_key) 기준 upsert. 원본은 덮어쓰되 지우지 않는다."""
    if not records:
        return 0
    stmt = insert(VenueSourceRecord).values([{**r, "run_id": run_id} for r in records])
    stmt = stmt.on_conflict_do_update(
        constraint="uq_source_record_key",
        set_={
            "raw": stmt.excluded.raw,
            "fetched_at": func.now(),
            "run_id": stmt.excluded.run_id,
        },
    )
    result = session.execute(stmt)
    return result.rowcount
