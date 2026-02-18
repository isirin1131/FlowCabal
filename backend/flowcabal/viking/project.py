"""OpenViking project structure management.

Creates and ensures the viking:// directory layout for a FlowCabal project.
"""

from __future__ import annotations

from openviking import SyncOpenViking


# The canonical project directory structure under viking://resources/project/
_PROJECT_DIRS = [
    "viking://resources/project/",
    "viking://resources/project/meta/",
    "viking://resources/project/entities/",
    "viking://resources/project/entities/characters/",
    "viking://resources/project/entities/locations/",
    "viking://resources/project/entities/plot-threads/",
    "viking://resources/project/manuscript/",
    "viking://resources/project/summaries/",
    "viking://resources/project/profiles/",
    "viking://resources/project/profiles/characters/",
    "viking://resources/project/profiles/plot-threads/",
    "viking://resources/project/profiles/world-state/",
    "viking://resources/project/profiles/themes/",
    "viking://resources/project/profiles/style/",
]


def init_project(client: SyncOpenViking) -> None:
    """Create the full project directory structure in OpenViking.

    Idempotent — safe to call multiple times.
    """
    for uri in _PROJECT_DIRS:
        try:
            client.mkdir(uri)
        except Exception:
            # Directory may already exist
            pass


def ensure_project(client: SyncOpenViking) -> None:
    """Ensure project structure exists (alias for init_project)."""
    init_project(client)


def get_project_status(client: SyncOpenViking) -> dict:
    """Return a summary of the project's OpenViking content."""
    status: dict = {"initialized": False, "sections": {}}
    try:
        tree = client.tree("viking://resources/project/")
        status["initialized"] = True
        status["tree"] = tree
    except Exception:
        return status

    # Count items in each section
    for section in ["meta", "entities", "manuscript", "summaries", "profiles"]:
        uri = f"viking://resources/project/{section}/"
        try:
            ls_result = client.ls(uri, recursive=True)
            status["sections"][section] = len(ls_result) if isinstance(ls_result, list) else 0
        except Exception:
            status["sections"][section] = 0

    return status
