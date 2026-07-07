from sqlalchemy import Engine, create_engine, text

from airadar.infrastructure.persistence.orm import metadata

# Columns added after the first release. `create_all` never alters existing tables,
# so we apply these idempotently on startup — a non-destructive upgrade path without
# pulling in a full migration tool for a single-table schema.
_ADDITIVE_COLUMNS = {
    "tools": [("ring", "VARCHAR(16)")],
}


def make_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


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
