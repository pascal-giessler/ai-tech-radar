from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)

EMBEDDING_DIM = 384

metadata = MetaData()

tools_table = Table(
    "tools",
    metadata,
    Column("slug", String(255), primary_key=True),
    Column("owner", String(255), nullable=False),
    Column("name", String(255), nullable=False),
    Column("description", Text, nullable=False, default=""),
    Column("topics", JSON, nullable=False, default=list),
    Column("language", String(100), nullable=True),
    Column("url", String(500), nullable=False),
    Column("stars", Integer, nullable=False),
    Column("stars_prev", Integer, nullable=True),
    Column("repo_created_at", DateTime(timezone=True), nullable=False),
    Column("first_seen_at", DateTime(timezone=True), nullable=False),
    Column("last_updated_at", DateTime(timezone=True), nullable=False),
    Column("trend_score", Float, nullable=False, default=0.0),
    Column("ring", String(16), nullable=True),
    Column("pos_x", Float, nullable=True),
    Column("pos_y", Float, nullable=True),
    Column("pos_z", Float, nullable=True),
    Column("cluster_id", Integer, nullable=True),
    Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
    Column("embedded_fingerprint", String(64), nullable=True),
    Column("open_issues", Integer, nullable=False, default=0),
    Column("commit_activity", JSON, nullable=False, default=list),
    Column("area", String(64), nullable=False, default="ai"),
)

clusters_table = Table(
    "clusters",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=False),
    Column("label", String(255), nullable=False),
    Column("slug", String(255), nullable=False, index=True),
    Column("size", Integer, nullable=False),
    Column("centroid_x", Float, nullable=False),
    Column("centroid_y", Float, nullable=False),
    Column("centroid_z", Float, nullable=False),
    Column("keywords", JSON, nullable=False, default=list),
    Column("description", Text, nullable=False, default=""),
)

# Single-row (id fixed = 1) tunable configuration. Nullable knobs fall back to
# env/const defaults when unset.
radar_settings_table = Table(
    "radar_settings",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=False),
    Column("area_preset", String(64), nullable=False, default="ai"),
    Column("min_cluster_size", Integer, nullable=True),
    Column("min_tools", Integer, nullable=True),
)

SETTINGS_ROW_ID = 1
