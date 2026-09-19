from pathlib import Path

from kidscafe_pipeline.cli import _repo_path
from kidscafe_pipeline.config import REPO_ROOT


def test_relative_paths_resolve_against_repo_root() -> None:
    assert _repo_path(Path("data/derived/x.json")) == REPO_ROOT / "data/derived/x.json"
    assert _repo_path(Path("/abs/y.json")) == Path("/abs/y.json")
    assert _repo_path(None) is None
