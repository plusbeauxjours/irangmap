from logging.config import fileConfig

from alembic import context
from geoalchemy2 import alembic_helpers
from sqlalchemy import engine_from_config, pool

from kidscafe_pipeline import models  # noqa: F401  — 메타데이터 등록용
from kidscafe_pipeline.config import get_settings
from kidscafe_pipeline.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to):
    """PostGIS가 소유한 객체는 autogenerate 대상에서 뺀다.

    이게 없으면 첫 autogenerate가 `spatial_ref_sys`와 PostGIS 인덱스를 drop하려 든다.
    """
    if type_ == "table" and name == "spatial_ref_sys":
        return False
    if type_ == "table" and getattr(obj, "schema", None) in {
        "tiger",
        "tiger_data",
        "topology",
    }:
        return False
    return alembic_helpers.include_object(obj, name, type_, reflected, compare_to)


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        include_object=include_object,
        render_item=alembic_helpers.render_item,
        process_revision_directives=alembic_helpers.writer,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            render_item=alembic_helpers.render_item,
            process_revision_directives=alembic_helpers.writer,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
