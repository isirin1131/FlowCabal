"""Multi-angle profile generation using OpenViking + agent LLM."""

from __future__ import annotations

import tempfile
from pathlib import Path

from openviking import SyncOpenViking

from ..config import LLMConfig
from ..agent.core import agent_generate


# Supported profile types and their generation prompts
_PROFILE_PROMPTS = {
    "characters": (
        "Analyze the manuscript content and create a comprehensive character profile. Include:\n"
        "- Full name and aliases\n"
        "- Physical description\n"
        "- Personality traits and arc\n"
        "- Key relationships\n"
        "- Current status and location in the story\n"
        "- Notable quotes or speech patterns"
    ),
    "plot-threads": (
        "Analyze the manuscript content and create a plot thread summary. Include:\n"
        "- Thread name and description\n"
        "- Current status (active, resolved, dormant)\n"
        "- Key events in chronological order\n"
        "- Characters involved\n"
        "- Unresolved questions or hooks\n"
        "- Connections to other plot threads"
    ),
}


async def generate_profile(
    viking: SyncOpenViking,
    agent_llm: LLMConfig,
    profile_type: str,
    entity_name: str,
) -> str:
    """Generate or regenerate a profile for a specific entity.

    Reads relevant manuscript content from OpenViking, uses the agent LLM to
    analyze it, and writes the profile back to OpenViking.
    """
    if profile_type not in _PROFILE_PROMPTS:
        raise ValueError(f"Unknown profile type: {profile_type}. Supported: {list(_PROFILE_PROMPTS.keys())}")

    # Gather manuscript content about this entity
    manuscript_content = _gather_entity_mentions(viking, entity_name)

    if not manuscript_content:
        return f"No manuscript content found mentioning '{entity_name}'."

    # Generate the profile using agent LLM
    system = (
        f"You are a literary analyst creating a {profile_type.rstrip('s')} profile for a novel. "
        "Be thorough and precise. Only include information explicitly present in the text."
    )
    user = (
        f"{_PROFILE_PROMPTS[profile_type]}\n\n"
        f"Entity name: {entity_name}\n\n"
        f"Manuscript content:\n{manuscript_content[:30000]}"
    )

    profile_text = await agent_generate(agent_llm, system, user)

    # Write profile to OpenViking
    profile_uri = f"viking://resources/project/profiles/{profile_type}/{entity_name}/"
    try:
        viking.mkdir(profile_uri)
    except Exception:
        pass

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, prefix=f"profile-{entity_name}-"
    ) as f:
        f.write(f"# {entity_name}\n\n{profile_text}")
        tmp_path = f.name

    try:
        viking.add_resource(
            path=tmp_path,
            target=profile_uri,
            reason=f"Profile for {entity_name} ({profile_type})",
            wait=True,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return profile_text


def _gather_entity_mentions(viking: SyncOpenViking, entity_name: str) -> str:
    """Search OpenViking for manuscript passages mentioning an entity."""
    parts: list[str] = []

    # Semantic search for the entity name
    try:
        results = viking.find(
            entity_name,
            target_uri="viking://resources/project/manuscript/",
            limit=10,
        )
        for r in results.resources:
            try:
                content = viking.read(r.uri)
                if content:
                    parts.append(content)
            except Exception:
                # Fall back to overview
                try:
                    overview = viking.overview(r.uri)
                    if overview:
                        parts.append(overview)
                except Exception:
                    pass
    except Exception:
        pass

    return "\n\n---\n\n".join(parts)
