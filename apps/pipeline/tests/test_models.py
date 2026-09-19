from kidscafe_pipeline import models
from kidscafe_pipeline.config import REPO_ROOT
from kidscafe_pipeline.db import Base


def test_schema_has_core_tables() -> None:
    assert {"venue", "venue_source_record", "venue_attribute", "pipeline_run"} <= set(
        Base.metadata.tables
    )


def test_source_record_upsert_key_is_source_plus_key() -> None:
    table = models.VenueSourceRecord.__table__
    uniques = {
        c.name: tuple(col.name for col in c.columns)
        for c in table.constraints
        if c.name
    }
    assert uniques["uq_source_record_key"] == ("source", "source_key")


def test_every_pipeline_written_table_carries_run_id() -> None:
    for name in ("venue_source_record", "venue_attribute"):
        assert "run_id" in Base.metadata.tables[name].c


def test_repo_root_points_at_the_monorepo() -> None:
    assert (REPO_ROOT / "apps" / "pipeline" / "pyproject.toml").is_file()
    assert (REPO_ROOT / "pnpm-workspace.yaml").is_file()
