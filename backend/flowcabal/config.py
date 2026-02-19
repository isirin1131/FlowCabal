"""Configuration — TOML for non-secret settings, encrypted SQLite for API keys."""

from __future__ import annotations

import os
import tomllib
from pathlib import Path

import tomli_w
from pydantic import BaseModel


_PROJECT_DIR = Path(".flowcabal")


class LLMConfig(BaseModel):
    endpoint: str = "https://api.openai.com/v1"
    api_key: str = ""  # populated from encrypted store, never persisted to TOML
    model: str = "gpt-4o"


class GenerationDefaults(BaseModel):
    temperature: float = 0.7
    max_tokens: int = 4096
    top_p: float = 1.0
    presence_penalty: float = 0.0
    frequency_penalty: float = 0.0
    streaming: bool = True


class FlowCabalConfig(BaseModel):
    user_llm: LLMConfig = LLMConfig()
    agent_llm: LLMConfig = LLMConfig(model="gpt-4o-mini")
    embedding: LLMConfig = LLMConfig(model="text-embedding-3-small")
    generation_defaults: GenerationDefaults = GenerationDefaults()
    enable_agents: bool = False
    data_dir: Path = _PROJECT_DIR / "data"

    @staticmethod
    def config_path() -> Path:
        return _PROJECT_DIR / "config.toml"

    @staticmethod
    def project_dir() -> Path:
        return _PROJECT_DIR

    @classmethod
    def load(cls) -> FlowCabalConfig:
        """Load TOML config, then decrypt API keys from SQLite."""
        path = cls.config_path()
        if path.exists():
            with open(path, "rb") as f:
                data = tomllib.load(f)
            cfg = cls.model_validate(data)
        else:
            cfg = cls()

        # Encrypted keys from SQLite
        from .keystore import load_api_keys

        db_path = cfg.data_dir / "flowcabal.db"
        keys = load_api_keys(db_path, _PROJECT_DIR)
        db_base = keys.get("default", "")
        cfg.user_llm.api_key = keys.get("user_llm", db_base)
        cfg.agent_llm.api_key = keys.get("agent_llm", db_base)
        cfg.embedding.api_key = keys.get("embedding", db_base)

        # Env var override (for CI/containers)
        if key := os.environ.get("FLOWCABAL_API_KEY"):
            cfg.user_llm.api_key = key
            cfg.agent_llm.api_key = key
            cfg.embedding.api_key = key
        return cfg

    def save(self) -> None:
        """Write non-secret config to TOML. API keys are never written."""
        path = self.config_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        data = self.model_dump()
        data["data_dir"] = str(data["data_dir"])
        for section in ("user_llm", "agent_llm", "embedding"):
            data[section].pop("api_key", None)
        with open(path, "wb") as f:
            tomli_w.dump(data, f)

    def ensure_data_dir(self) -> Path:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return self.data_dir
