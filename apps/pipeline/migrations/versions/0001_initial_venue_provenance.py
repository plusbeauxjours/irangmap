"""venue · source record · attribute · pipeline_run

Revision ID: 0001
Revises:
Create Date: 2026-09-19

수기 작성. Docker 없이 만든 첫 마이그레이션이라 autogenerate 대신 models.py를 그대로 옮겼다.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "pipeline_run",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("command", sa.String(length=200), nullable=False),
        sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "stats",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "venue",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("name_norm", sa.String(length=200), nullable=False),
        sa.Column("brand", sa.String(length=100), nullable=True),
        sa.Column(
            "kind", sa.String(length=20), nullable=False, server_default="private"
        ),
        sa.Column("addr_road", sa.Text(), nullable=True),
        sa.Column("addr_jibun", sa.Text(), nullable=True),
        sa.Column("sido", sa.String(length=40), nullable=True),
        sa.Column("sigungu", sa.String(length=40), nullable=True),
        sa.Column(
            "geom",
            Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("website", sa.Text(), nullable=True),
        sa.Column("instagram", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=10), nullable=False, server_default="unknown"
        ),
        sa.Column("status_reason", sa.Text(), nullable=True),
        sa.Column("last_positive_signal_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "kind IN ('private','public_seoul','public_other')", name="ck_venue_kind"
        ),
        sa.CheckConstraint(
            "status IN ('open','closed','unknown')", name="ck_venue_status"
        ),
        sa.UniqueConstraint("slug", name="uq_venue_slug"),
    )
    op.create_index(
        "ix_venue_geom", "venue", ["geom"], unique=False, postgresql_using="gist"
    )
    op.create_index("ix_venue_status", "venue", ["status"], unique=False)
    op.create_index("ix_venue_sigungu", "venue", ["sido", "sigungu"], unique=False)

    op.create_table(
        "venue_source_record",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("source_key", sa.String(length=200), nullable=False),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "venue_id",
            sa.Integer(),
            sa.ForeignKey("venue.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("match_confidence", sa.Float(), nullable=True),
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey("pipeline_run.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.UniqueConstraint("source", "source_key", name="uq_source_record_key"),
    )
    op.create_index(
        "ix_source_record_venue", "venue_source_record", ["venue_id"], unique=False
    )
    op.create_index(
        "ix_source_record_run", "venue_source_record", ["run_id"], unique=False
    )

    op.create_table(
        "venue_attribute",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "venue_id",
            sa.Integer(),
            sa.ForeignKey("venue.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(length=60), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "source_record_id",
            sa.Integer(),
            sa.ForeignKey("venue_source_record.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("verified_by", sa.String(length=10), nullable=False),
        sa.Column("evidence_url", sa.Text(), nullable=True),
        sa.Column("evidence_quote", sa.Text(), nullable=True),
        sa.Column(
            "observed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey("pipeline_run.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.CheckConstraint(
            "verified_by IN ('llm','owner','user','admin')",
            name="ck_attribute_verified_by",
        ),
    )
    op.create_index(
        "ix_attribute_venue_key", "venue_attribute", ["venue_id", "key"], unique=False
    )
    op.create_index("ix_attribute_run", "venue_attribute", ["run_id"], unique=False)


def downgrade() -> None:
    op.drop_table("venue_attribute")
    op.drop_table("venue_source_record")
    op.drop_index("ix_venue_sigungu", table_name="venue")
    op.drop_index("ix_venue_status", table_name="venue")
    op.drop_index("ix_venue_geom", table_name="venue")
    op.drop_table("venue")
    op.drop_table("pipeline_run")
