"""스키마. alembic이 유일한 소유자다 — 바꾸면 마이그레이션을 만든다.

- venue: 정규 키즈카페 1행.
- venue_source_record: 소스 원본. 지우지 않는다(재매칭·감사용).
- venue_attribute: 출처·신뢰도·확인일이 붙은 팩트(이력). 이 테이블이 제품이다.
- pipeline_run: 파이프라인이 쓰는 모든 행에 run_id를 남겨 revert 가능하게 한다.
"""

from datetime import datetime
from typing import Any

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base

VENUE_KINDS = ("private", "public_seoul", "public_other")
VENUE_STATUSES = ("open", "closed", "unknown")
VERIFIED_BY = ("llm", "owner", "user", "admin")


class PipelineRun(Base):
    __tablename__ = "pipeline_run"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    command: Mapped[str] = mapped_column(String(200))
    dry_run: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stats: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )


class Venue(Base):
    __tablename__ = "venue"
    __table_args__ = (
        CheckConstraint(f"kind IN {VENUE_KINDS!r}", name="ck_venue_kind"),
        CheckConstraint(f"status IN {VENUE_STATUSES!r}", name="ck_venue_status"),
        UniqueConstraint("slug", name="uq_venue_slug"),
        Index("ix_venue_geom", "geom", postgresql_using="gist"),
        Index("ix_venue_status", "status"),
        Index("ix_venue_sigungu", "sido", "sigungu"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(120))
    name: Mapped[str] = mapped_column(String(200))
    name_norm: Mapped[str] = mapped_column(String(200))
    brand: Mapped[str | None] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(
        String(20), default="private", server_default="private"
    )
    addr_road: Mapped[str | None] = mapped_column(Text)
    addr_jibun: Mapped[str | None] = mapped_column(Text)
    sido: Mapped[str | None] = mapped_column(String(40))
    sigungu: Mapped[str | None] = mapped_column(String(40))
    geom = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True
    )
    phone: Mapped[str | None] = mapped_column(String(40))
    website: Mapped[str | None] = mapped_column(Text)
    instagram: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(10), default="unknown", server_default="unknown"
    )
    status_reason: Mapped[str | None] = mapped_column(Text)
    last_positive_signal_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    status_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class VenueSourceRecord(Base):
    __tablename__ = "venue_source_record"
    __table_args__ = (
        UniqueConstraint("source", "source_key", name="uq_source_record_key"),
        Index("ix_source_record_venue", "venue_id"),
        Index("ix_source_record_run", "run_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(32))
    source_key: Mapped[str] = mapped_column(String(200))
    raw: Mapped[dict[str, Any]] = mapped_column(JSONB)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    venue_id: Mapped[int | None] = mapped_column(
        ForeignKey("venue.id", ondelete="SET NULL")
    )
    match_confidence: Mapped[float | None] = mapped_column(Float)
    run_id: Mapped[int | None] = mapped_column(
        ForeignKey("pipeline_run.id", ondelete="SET NULL")
    )


class VenueAttribute(Base):
    __tablename__ = "venue_attribute"
    __table_args__ = (
        CheckConstraint(
            f"verified_by IN {VERIFIED_BY!r}", name="ck_attribute_verified_by"
        ),
        Index("ix_attribute_venue_key", "venue_id", "key"),
        Index("ix_attribute_run", "run_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venue_id: Mapped[int] = mapped_column(ForeignKey("venue.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(60))
    value: Mapped[Any] = mapped_column(JSONB)
    source_record_id: Mapped[int | None] = mapped_column(
        ForeignKey("venue_source_record.id", ondelete="SET NULL")
    )
    confidence: Mapped[float] = mapped_column(Float)
    verified_by: Mapped[str] = mapped_column(String(10))
    evidence_url: Mapped[str | None] = mapped_column(Text)
    evidence_quote: Mapped[str | None] = mapped_column(Text)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    run_id: Mapped[int | None] = mapped_column(
        ForeignKey("pipeline_run.id", ondelete="SET NULL")
    )
