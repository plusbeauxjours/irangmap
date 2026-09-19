from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import PipelineRun


def start_run(session: Session, command: str, *, dry_run: bool) -> PipelineRun:
    run = PipelineRun(command=command, dry_run=dry_run)
    session.add(run)
    session.flush()  # run.id 확보 — 이후 쓰는 행에 스탬프한다
    return run


def finish_run(session: Session, run: PipelineRun, stats: dict[str, Any]) -> None:
    run.stats = stats
    run.finished_at = func.now()
    session.flush()
