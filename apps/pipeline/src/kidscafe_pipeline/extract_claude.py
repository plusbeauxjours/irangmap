"""공식 사이트 텍스트 → 구조화 속성. Claude Code 헤드리스(`claude -p`)로 추출.

API 키 대신 사용자의 Claude Code 로그인을 쓴다. `--tools ""`,
`--strict-mcp-config`, `--setting-sources ""`로 도구·MCP·CLAUDE.md를 빼서
호출당 오버헤드를 약 1.2k 토큰으로 줄인다. 이미지(요금표)는 `--tools Read`로 넘긴다.
"""

import json
import os
import subprocess
from pathlib import Path
from typing import Any

_FIELDS: dict[str, Any] = {
    "age_range": {"type": ["string", "null"]},
    "child_fee": {"type": ["string", "null"]},
    "guardian_fee": {"type": ["string", "null"]},
    "socks": {"type": ["string", "null"]},
    "play_zones": {"type": ["string", "null"]},
    "amenities": {"type": ["string", "null"]},
    "hours": {"type": ["string", "null"]},
    "notes": {"type": ["string", "null"]},
    "reservation": {"type": ["string", "null"]},
    "phone": {"type": ["string", "null"]},
    "address": {"type": ["string", "null"]},
}
_REQUIRED = list(_FIELDS)

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "brand_level": {
            "type": "object",
            "description": "브랜드 전 매장 공통 안내(없으면 값 전부 null)",
            "properties": _FIELDS,
            "required": _REQUIRED,
        },
        "stores": {
            "type": "array",
            "description": "매장별로 다른 값이 있을 때만. 매장명은 원문 그대로",
            "items": {
                "type": "object",
                "properties": {"store_name": {"type": "string"}, **_FIELDS},
                "required": ["store_name", *_REQUIRED],
            },
        },
        "store_names": {
            "type": "array",
            "items": {"type": "string"},
            "description": "페이지에 나열된 매장명 전부(값이 없어도)",
        },
        "evidence": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["brand_level", "stores", "store_names", "evidence", "confidence"],
}

SYSTEM = (
    "너는 한국 키즈카페 공식 안내문에서 부모가 보는 이용 정보를 뽑는다. "
    "안내문에 없는 값은 null. 추측 금지. 값은 원문 표현을 짧게 유지"
    "(예: '12개월~만 7세', "
    "'아동 2시간 15,000원, 추가 30분 3,000원', '보호자 1인 무료(음료 별도)'). "
    "evidence에는 각 값의 근거가 되는 원문 구절을 그대로 넣는다. "
    "요금표가 이미지라 텍스트에 없으면 null로 두고 notes에 '요금표 이미지'라고 적는다. "
    "브랜드 공통 안내는 brand_level에, 매장별로 다른 값은 stores[]에 매장명과 함께. "
    "매장 목록 페이지면 store_names에 매장명을 전부 적고, "
    "주소·전화는 stores[]에 담는다. "
    "confidence는 값들이 원문에 명시된 정도(0~1)."
)


def _cmd(*, model: str, tools: list[str], add_dir: Path | None) -> list[str]:
    cmd = [
        "claude",
        "-p",
        "--output-format",
        "json",
        "--strict-mcp-config",
        "--setting-sources",
        "",
        "--no-session-persistence",
        "--model",
        model,
        "--json-schema",
        json.dumps(SCHEMA, ensure_ascii=False),
        "--system-prompt",
        SYSTEM,
        "--tools",
        ",".join(tools) if tools else "",
    ]
    if tools:
        cmd += ["--allowedTools", *tools, "--max-turns", "6"]
    if add_dir:
        cmd += ["--add-dir", str(add_dir)]
    # 프롬프트는 stdin으로 넘긴다: `--tools`가 가변 인자라 뒤에 오는 위치 인자를 먹고,
    # 40k자 텍스트는 argv 한도에도 걸릴 수 있다.
    return cmd


def extract(
    text: str,
    *,
    brand: str,
    url: str,
    images: list[Path] | None = None,
    model: str = "sonnet",
    timeout_s: int = 180,
) -> dict[str, Any]:
    """텍스트(+선택 이미지 파일)에서 속성을 뽑는다. 실패하면 {'error': ...}."""
    prompt = (
        f"브랜드: {brand}\n출처 URL: {url}\n\n=== 안내문 텍스트 ===\n{text[:40000]}"
    )
    tools: list[str] = []
    add_dir = None
    if images:
        tools = ["Read"]
        add_dir = images[0].parent
        prompt += (
            "\n\n=== 이미지(요금표 등) — Read 도구로 열어 읽을 것 ===\n"
            + "\n".join(str(p) for p in images[:6])
        )
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    try:
        proc = subprocess.run(
            _cmd(model=model, tools=tools, add_dir=add_dir),
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return {"error": "timeout"}
    try:
        out = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"error": (proc.stderr or proc.stdout)[:300]}
    if out.get("is_error"):
        return {"error": str(out.get("result"))[:300]}
    data = out.get("structured_output") or {}
    data["_usage"] = {
        "cost_usd": out.get("total_cost_usd"),
        "in": out.get("usage", {}).get("input_tokens"),
        "cache_create": out.get("usage", {}).get("cache_creation_input_tokens"),
        "out": out.get("usage", {}).get("output_tokens"),
        "model": model,
    }
    return data
