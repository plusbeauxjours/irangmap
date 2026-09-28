"""Azure AI Foundry(OpenAI 모델) 추출 백엔드 — job-crawler와 같은 리소스·방식.

- v1 surface(`https://{resource}.services.ai.azure.com/openai/v1`)에 일반 OpenAI
  클라이언트를 붙이고 `model`에는 배포명(기본 modulabs-gpt-5.5)을 넣는다.
  api-version 고정이 필요 없다.
- Responses API + strict json_schema. strict 모드는 모든 속성이 required이고
  객체마다 additionalProperties=false여야 한다 → `strict_schema()`가 맞춘다.
"""

import copy
import json
from typing import Any

from openai import OpenAI

from .extract_claude import SCHEMA, SYSTEM


def strict_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """모든 객체에 additionalProperties=false, required=모든 키. 원본 불변."""
    out = copy.deepcopy(schema)

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object" and "properties" in node:
                node["additionalProperties"] = False
                node["required"] = list(node["properties"].keys())
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(out)
    return out


def base_url(resource: str | None, explicit: str | None) -> str:
    if explicit:
        return explicit.rstrip("/")
    if not resource:
        raise RuntimeError(
            "AZURE_OPENAI_RESOURCE 또는 AZURE_OPENAI_BASE_URL이 필요합니다"
        )
    return f"https://{resource}.services.ai.azure.com/openai/v1"


def make_client(
    api_key: str, resource: str | None, explicit_base: str | None
) -> OpenAI:
    return OpenAI(
        api_key=api_key, base_url=base_url(resource, explicit_base), max_retries=3
    )


def extract(
    client: OpenAI,
    text: str,
    *,
    brand: str,
    url: str,
    deployment: str = "modulabs-gpt-5.5",
    effort: str = "low",
    max_output_tokens: int = 6000,
) -> dict[str, Any]:
    """안내문 텍스트 → extract_claude와 같은 shape(brand_level, stores[]) + _usage."""
    prompt = (
        f"브랜드: {brand}\n출처 URL: {url}\n\n=== 안내문 텍스트 ===\n{text[:40000]}"
    )
    return extract_json(
        client,
        prompt,
        system=SYSTEM,
        schema=SCHEMA,
        name="kidscafe_facts",
        deployment=deployment,
        effort=effort,
        max_output_tokens=max_output_tokens,
    )


def extract_json(
    client: OpenAI,
    prompt: str,
    *,
    system: str,
    schema: dict[str, Any],
    name: str,
    deployment: str = "modulabs-gpt-5.5",
    effort: str | None = "low",
    max_output_tokens: int = 6000,
) -> dict[str, Any]:
    """프롬프트 → strict json_schema 응답 dict + _usage. 실패하면 {'error': ...}."""
    try:
        resp = client.responses.create(
            model=deployment,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": name,
                    "schema": strict_schema(schema),
                    "strict": True,
                }
            },
            # 비추론 모델(gpt-4.1-mini 등)은 reasoning을 받지 않는다 → effort=None
            **({"reasoning": {"effort": effort}} if effort else {}),
            max_output_tokens=max_output_tokens,
        )
    except Exception as e:  # noqa: BLE001 — 호출 실패는 결과 파일에 남기고 다음 페이지로
        return {"error": f"{type(e).__name__}: {str(e)[:300]}"}
    if getattr(resp, "status", None) == "incomplete":
        reason = getattr(
            getattr(resp, "incomplete_details", None), "reason", "incomplete"
        )
        return {"error": f"incomplete: {reason}"}
    raw = resp.output_text
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"error": f"invalid json: {raw[:200]}"}
    usage = getattr(resp, "usage", None)
    data["_usage"] = {
        "backend": "azure",
        "model": deployment,
        "in": getattr(usage, "input_tokens", None),
        "out": getattr(usage, "output_tokens", None),
    }
    return data
