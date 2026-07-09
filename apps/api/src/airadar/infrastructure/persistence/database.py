from sqlalchemy import Engine, create_engine, text

from airadar.infrastructure.persistence.orm import metadata

# Columns added after the first release. `create_all` never alters existing tables,
# so we apply these idempotently on startup — a non-destructive upgrade path without
# pulling in a full migration tool for a single-table schema.
_ADDITIVE_COLUMNS = {
    "tools": [
        ("ring", "VARCHAR(16)"),
        ("open_issues", "INTEGER NOT NULL DEFAULT 0"),
        ("commit_activity", "JSON NOT NULL DEFAULT '[]'::json"),
        ("area", "VARCHAR(64) NOT NULL DEFAULT 'ai'"),
    ],
    "clusters": [
        ("keywords", "JSON NOT NULL DEFAULT '[]'::json"),
        ("description", "TEXT NOT NULL DEFAULT ''"),
    ],
}

# Idempotent seed for the single-row settings table (id = 1).
_SEED_SETTINGS = (
    "INSERT INTO radar_settings (id, area_preset, min_cluster_size, min_tools) "
    "VALUES (1, 'ai', NULL, NULL) ON CONFLICT (id) DO NOTHING"
)


def make_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


class DatabasePing:
    """Readiness probe: is the database reachable right now?"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def __call__(self) -> bool:
        try:
            with self._engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False


def init_db(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    metadata.create_all(engine)
    with engine.begin() as conn:
        for table, columns in _ADDITIVE_COLUMNS.items():
            for name, ddl_type in columns:
                conn.execute(
                    text(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "{name}" {ddl_type}')
                )
        conn.execute(text(_SEED_SETTINGS))
