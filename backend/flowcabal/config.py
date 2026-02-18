"""Configuration — Pydantic settings from ~/.flowcabal/config.toml or env vars."""

from __future__ import annotations

import tomllib
from pathlib import Path

import tomli_w
from pydantic import BaseModel


_DEFAULT_DIR = Path.home() / ".flowcabal"


class LLMConfig(BaseModel):
    endpoint: str = "https://api.openai.com/v1"
    api_key: str = ""
    model: str = "gpt-4o"


class FlowCabalConfig(BaseModel):
    user_llm: LLMConfig = LLMConfig()
    agent_llm: LLMConfig = LLMConfig(model="gpt-4o-mini")
    embedding: LLMConfig = LLMConfig(model="text-embedding-3-small")
    data_dir: Path = _DEFAULT_DIR / "data"

    @staticmethod
    def config_path() -> Path:
        return _DEFAULT_DIR / "config.toml"

    @classmethod
    def load(cls) -> FlowCabalConfig:
        """Load from config file, falling back to defaults."""
        path = cls.config_path()
        if path.exists():
            with open(path, "rb") as f:
                data = tomllib.load(f)
            return cls.model_validate(data)
        return cls()

    def save(self) -> None:
        """Write current config to TOML file."""
        path = self.config_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        # Convert to nested dict with string paths
        data = self.model_dump()
        data["data_dir"] = str(data["data_dir"])
        with open(path, "wb") as f:
            tomli_w.dump(data, f)

    def ensure_data_dir(self) -> Path:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return self.data_dir
