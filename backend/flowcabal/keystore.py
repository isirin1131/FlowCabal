"""Encrypted API key storage — Fernet + SQLite config table."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

_KEY_PREFIX = "api_key."


def _key_path(project_dir: Path) -> Path:
    return project_dir / "secret.key"


def _get_or_create_fernet(project_dir: Path) -> Fernet:
    path = _key_path(project_dir)
    if path.exists():
        key = path.read_bytes().strip()
    else:
        key = Fernet.generate_key()
        project_dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(key)
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass  # Windows
    return Fernet(key)


def _ensure_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS config"
        " (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    )


def save_api_key(
    db_path: Path, project_dir: Path, role: str, plaintext: str
) -> None:
    """Encrypt and store an API key."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    f = _get_or_create_fernet(project_dir)
    encrypted = f.encrypt(plaintext.encode()).decode()
    with sqlite3.connect(db_path) as conn:
        _ensure_table(conn)
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
            (_KEY_PREFIX + role, encrypted),
        )


def load_api_keys(db_path: Path, project_dir: Path) -> dict[str, str]:
    """Load and decrypt all API keys. Returns {role: plaintext}."""
    if not db_path.exists() or not _key_path(project_dir).exists():
        return {}
    f = _get_or_create_fernet(project_dir)
    result: dict[str, str] = {}
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute(
                "SELECT key, value FROM config WHERE key LIKE ?",
                (_KEY_PREFIX + "%",),
            )
            for key, encrypted in cursor:
                role = key[len(_KEY_PREFIX):]
                try:
                    result[role] = f.decrypt(encrypted.encode()).decode()
                except InvalidToken:
                    pass  # corrupted or re-keyed — skip
    except sqlite3.OperationalError:
        pass  # table doesn't exist yet
    return result


def delete_api_key(db_path: Path, role: str) -> bool:
    """Delete an API key."""
    if not db_path.exists():
        return False
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM config WHERE key = ?", (_KEY_PREFIX + role,)
            )
            return cursor.rowcount > 0
    except sqlite3.OperationalError:
        return False


def mask(value: str) -> str:
    """Mask an API key for display."""
    if len(value) <= 8:
        return "****"
    return value[:4] + "..." + value[-4:]
