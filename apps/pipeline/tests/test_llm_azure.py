from kidscafe_pipeline import llm_azure
from kidscafe_pipeline.extract_claude import SCHEMA


def test_strict_schema_requires_everything_and_closes_objects() -> None:
    s = llm_azure.strict_schema(SCHEMA)
    assert s["additionalProperties"] is False
    assert set(s["required"]) == set(s["properties"])
    bl = s["properties"]["brand_level"]
    assert bl["additionalProperties"] is False and set(bl["required"]) == set(
        bl["properties"]
    )
    item = s["properties"]["stores"]["items"]
    assert item["additionalProperties"] is False and "store_name" in item["required"]
    assert "additionalProperties" not in SCHEMA  # 원본 불변


def test_base_url_prefers_explicit_and_builds_foundry_host() -> None:
    assert (
        llm_azure.base_url("myres", None)
        == "https://myres.services.ai.azure.com/openai/v1"
    )
    assert (
        llm_azure.base_url(None, "https://x.openai.azure.com/openai/v1/")
        == "https://x.openai.azure.com/openai/v1"
    )
