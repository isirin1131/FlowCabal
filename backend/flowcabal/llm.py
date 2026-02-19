"""Async OpenAI-compatible LLM client."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

if TYPE_CHECKING:
    from .engine import ResolvedCallConfig


async def generate(call_config: ResolvedCallConfig, system: str, user: str) -> str:
    """Non-streaming generation. Returns the full response text."""
    client = AsyncOpenAI(base_url=call_config.endpoint, api_key=call_config.api_key)
    messages: list[ChatCompletionMessageParam] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    response = await client.chat.completions.create(
        model=call_config.model,
        messages=messages,
        temperature=call_config.temperature,
        max_completion_tokens=call_config.max_tokens,
        top_p=call_config.top_p,
        presence_penalty=call_config.presence_penalty,
        frequency_penalty=call_config.frequency_penalty,
        stream=False,
    )
    return response.choices[0].message.content or ""


async def generate_stream(call_config: ResolvedCallConfig, system: str, user: str) -> AsyncIterator[str]:
    """Streaming generation. Yields text chunks."""
    client = AsyncOpenAI(base_url=call_config.endpoint, api_key=call_config.api_key)
    messages: list[ChatCompletionMessageParam] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    stream = await client.chat.completions.create(
        model=call_config.model,
        messages=messages,
        temperature=call_config.temperature,
        max_completion_tokens=call_config.max_tokens,
        top_p=call_config.top_p,
        presence_penalty=call_config.presence_penalty,
        frequency_penalty=call_config.frequency_penalty,
        stream=True,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content
