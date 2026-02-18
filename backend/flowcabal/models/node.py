"""Node system — mirrors flow-cabal/src/lib/core/node.ts + apiconfig.ts.

Pure metadata definitions. Runtime state belongs in the runner.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .textblock import (
    NodeId,
    TextBlockList,
    generate_id,
    get_dependencies,
    text_block_list_from_dict,
    text_block_list_to_dict,
)


# ---------------------------------------------------------------------------
# Position
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class Position:
    x: float = 0.0
    y: float = 0.0


# ---------------------------------------------------------------------------
# ApiConnection — mirrors apiconfig.ts ApiConnection
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class ApiConnection:
    endpoint: str = "https://api.openai.com/v1"
    api_key: str = ""
    model: str = "gpt-4o"


# ---------------------------------------------------------------------------
# ApiParameters — mirrors apiconfig.ts ApiParameters
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class ApiParameters:
    temperature: float = 0.7
    max_tokens: int = 4096
    top_p: float = 1.0
    presence_penalty: float = 0.0
    frequency_penalty: float = 0.0
    stop_sequences: list[str] = field(default_factory=list)
    streaming: bool = True


# ---------------------------------------------------------------------------
# ApiConfiguration — mirrors apiconfig.ts ApiConfiguration
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class ApiConfiguration:
    connection: ApiConnection = field(default_factory=ApiConnection)
    parameters: ApiParameters = field(default_factory=ApiParameters)
    system_prompt: TextBlockList = field(default_factory=TextBlockList)
    user_prompt: TextBlockList = field(default_factory=TextBlockList)


def get_api_config_dependencies(config: ApiConfiguration) -> list[NodeId]:
    sys_deps = get_dependencies(config.system_prompt)
    usr_deps = get_dependencies(config.user_prompt)
    seen: set[NodeId] = set(sys_deps)
    result = list(sys_deps)
    for d in usr_deps:
        if d not in seen:
            seen.add(d)
            result.append(d)
    return result


# ---------------------------------------------------------------------------
# NodeDefinition — mirrors node.ts NodeDefinition
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class NodeDefinition:
    id: NodeId = field(default_factory=generate_id)
    name: str = ""
    position: Position = field(default_factory=Position)
    api_config: ApiConfiguration = field(default_factory=ApiConfiguration)


def get_node_dependencies(node: NodeDefinition) -> list[NodeId]:
    return get_api_config_dependencies(node.api_config)


# ---------------------------------------------------------------------------
# JSON serialization
# ---------------------------------------------------------------------------

def _position_to_dict(p: Position) -> dict:
    return {"x": p.x, "y": p.y}


def _position_from_dict(d: dict) -> Position:
    return Position(x=d.get("x", 0.0), y=d.get("y", 0.0))


def _connection_to_dict(c: ApiConnection) -> dict:
    return {"endpoint": c.endpoint, "apiKey": c.api_key, "model": c.model}


def _connection_from_dict(d: dict) -> ApiConnection:
    return ApiConnection(
        endpoint=d.get("endpoint", "https://api.openai.com/v1"),
        api_key=d.get("apiKey", d.get("api_key", "")),
        model=d.get("model", "gpt-4o"),
    )


def _params_to_dict(p: ApiParameters) -> dict:
    return {
        "temperature": p.temperature,
        "maxTokens": p.max_tokens,
        "topP": p.top_p,
        "presencePenalty": p.presence_penalty,
        "frequencyPenalty": p.frequency_penalty,
        "stopSequences": p.stop_sequences,
        "streaming": p.streaming,
    }


def _params_from_dict(d: dict) -> ApiParameters:
    return ApiParameters(
        temperature=d.get("temperature", 0.7),
        max_tokens=d.get("maxTokens", d.get("max_tokens", 4096)),
        top_p=d.get("topP", d.get("top_p", 1.0)),
        presence_penalty=d.get("presencePenalty", d.get("presence_penalty", 0.0)),
        frequency_penalty=d.get("frequencyPenalty", d.get("frequency_penalty", 0.0)),
        stop_sequences=d.get("stopSequences", d.get("stop_sequences", [])),
        streaming=d.get("streaming", True),
    )


def _api_config_to_dict(cfg: ApiConfiguration) -> dict:
    return {
        "connection": _connection_to_dict(cfg.connection),
        "parameters": _params_to_dict(cfg.parameters),
        "systemPrompt": text_block_list_to_dict(cfg.system_prompt),
        "userPrompt": text_block_list_to_dict(cfg.user_prompt),
    }


def _api_config_from_dict(d: dict) -> ApiConfiguration:
    return ApiConfiguration(
        connection=_connection_from_dict(d.get("connection", {})),
        parameters=_params_from_dict(d.get("parameters", {})),
        system_prompt=text_block_list_from_dict(d.get("systemPrompt", d.get("system_prompt", {"id": generate_id(), "blocks": []}))),
        user_prompt=text_block_list_from_dict(d.get("userPrompt", d.get("user_prompt", {"id": generate_id(), "blocks": []}))),
    )


def node_to_dict(node: NodeDefinition) -> dict:
    return {
        "id": node.id,
        "name": node.name,
        "position": _position_to_dict(node.position),
        "apiConfig": _api_config_to_dict(node.api_config),
    }


def node_from_dict(d: dict) -> NodeDefinition:
    return NodeDefinition(
        id=d["id"],
        name=d.get("name", ""),
        position=_position_from_dict(d.get("position", {})),
        api_config=_api_config_from_dict(d.get("apiConfig", d.get("api_config", {}))),
    )
