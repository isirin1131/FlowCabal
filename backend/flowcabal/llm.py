"""Async OpenAI-compatible LLM client."""

from __future__ import annotations

from collections.abc import AsyncIterator

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

from .models.node import ApiConnection, ApiParameters


async def generate( connection: ApiConnection, parameters: ApiParameters, system: str, user: str,) -> str:
    """Non-streaming generation. Returns the full response text."""
    client = AsyncOpenAI(base_url=connection.endpoint, api_key=connection.api_key)
    messages: list[ChatCompletionMessageParam] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    response = await client.chat.completions.create(
        model=connection.model,
        messages=messages,
        temperature=parameters.temperature,
        max_completion_tokens=parameters.max_tokens,
        top_p=parameters.top_p,
        presence_penalty=parameters.presence_penalty,
        frequency_penalty=parameters.frequency_penalty,
        stop=parameters.stop_sequences or None,
        stream=False,
    )
    return response.choices[0].message.content or ""


async def generate_stream( connection: ApiConnection, parameters: ApiParameters, system: str, user: str,) -> AsyncIterator[str]:
    """Streaming generation. Yields text chunks."""
    client = AsyncOpenAI(base_url=connection.endpoint, api_key=connection.api_key)
    messages: list[ChatCompletionMessageParam] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    stream = await client.chat.completions.create(
        model=connection.model,
        messages=messages,
        temperature=parameters.temperature,
        max_completion_tokens=parameters.max_tokens,
        top_p=parameters.top_p,
        presence_penalty=parameters.presence_penalty,
        frequency_penalty=parameters.frequency_penalty,
        stop=parameters.stop_sequences or None,
        stream=True,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content
