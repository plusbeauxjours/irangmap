from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# config.py → kidscafe_pipeline → src → apps/pipeline → apps → repo
REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    # 뒤에 오는 파일이 우선한다: 루트 .env를 apps/pipeline/.env가 덮어쓸 수 있다.
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://kidscafe:kidscafe@localhost:5433/kidscafe"
    data_dir: Path = REPO_ROOT / "data" / "raw"

    # 공공데이터포털
    data_go_kr_key: str | None = None
    datagokr_themepark_url: str | None = None
    datagokr_restcafe_url: str | None = None
    datagokr_playground_url: str | None = None
    datagokr_daily_limit: int = 10_000

    # 경기데이터드림 · VWorld
    gg_data_key: str | None = None
    vworld_key: str | None = None

    # 크롤 킬스위치 — 기본 꺼짐
    enable_naver_aux: bool = False
    naver_aux_level: int = 1
    enable_umppa_snapshot: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
