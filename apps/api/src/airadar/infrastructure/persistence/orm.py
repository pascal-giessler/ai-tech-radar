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
)
