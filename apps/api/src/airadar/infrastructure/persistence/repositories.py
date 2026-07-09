"""SQLAlchemy Core implementations of the repository ports (session-per-call)."""

from sqlalchemy import Engine, delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from airadar.domain.model.adoption import AdoptionRing
from airadar.domain.model.cluster import Cluster
from airadar.domain.model.position import Position3D
from airadar.domain.model.radar_settings import RadarSettings
from airadar.domain.model.repo_ref import RepoRef
from airadar.domain.model.tool import Tool
from airadar.infrastructure.persistence.orm import (
    SETTINGS_ROW_ID,
    clusters_table,
    custom_presets_table,
    radar_settings_table,
    tools_table,
)
from airadar.infrastructure.sources.presets import Preset


def _tool_to_row(tool: Tool) -> dict:
    return {
        "slug": tool.slug,
        "owner": tool.ref.owner,
        "name": tool.ref.name,
        "description": tool.description,
        "topics": tool.topics,
        "language": tool.language,
        "url": tool.url,
        "stars": tool.stars,
        "stars_prev": tool.stars_prev,
        "repo_created_at": tool.repo_created_at,
        "first_seen_at": tool.first_seen_at,
        "last_updated_at": tool.last_updated_at,
        "trend_score": tool.trend_score,
        "ring": tool.ring.slug if tool.ring else None,
        "pos_x": tool.position.x if tool.position else None,
        "pos_y": tool.position.y if tool.position else None,
        "pos_z": tool.position.z if tool.position else None,
        "cluster_id": tool.cluster_id,
        "embedding": tool.embedding,
        "embedded_fingerprint": tool.embedded_fingerprint,
        "open_issues": tool.open_issues,
        "commit_activity": tool.commit_activity,
        "area": tool.area,
    }


def _row_to_tool(row) -> Tool:
    position = None
    if row.pos_x is not None:
        position = Position3D(row.pos_x, row.pos_y, row.pos_z)
    return Tool(
        ref=RepoRef(owner=row.owner, name=row.name),
        description=row.description,
        topics=list(row.topics or []),
        language=row.language,
        url=row.url,
        stars=row.stars,
        stars_prev=row.stars_prev,
        repo_created_at=row.repo_created_at,
        first_seen_at=row.first_seen_at,
        last_updated_at=row.last_updated_at,
        trend_score=row.trend_score,
        ring=AdoptionRing.from_slug(row.ring) if row.ring else None,
        position=position,
        cluster_id=row.cluster_id,
        embedding=list(row.embedding) if row.embedding is not None else None,
        embedded_fingerprint=row.embedded_fingerprint,
        open_issues=row.open_issues if row.open_issues is not None else 0,
        commit_activity=list(row.commit_activity or []),
        area=row.area if row.area is not None else "ai",
    )


class SqlToolRepository:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def get_by_ref(self, ref: RepoRef) -> Tool | None:
        return self.get_by_slug(ref.slug)

    def get_by_slug(self, slug: str) -> Tool | None:
        with self._engine.connect() as conn:
            row = conn.execute(
                select(tools_table).where(tools_table.c.slug == slug)
            ).first()
        return _row_to_tool(row) if row else None

    def upsert(self, tool: Tool) -> Tool:
        row = _tool_to_row(tool)
        stmt = pg_insert(tools_table).values(**row)
        stmt = stmt.on_conflict_do_update(
            index_elements=[tools_table.c.slug],
            set_={k: v for k, v in row.items() if k != "slug"},
        )
        with self._engine.begin() as conn:
            conn.execute(stmt)
        return tool

    def list_all(self) -> list[Tool]:
        with self._engine.connect() as conn:
            rows = conn.execute(select(tools_table)).all()
        return [_row_to_tool(r) for r in rows]

    def list_ranked(self, limit: int = 200) -> list[Tool]:
        with self._engine.connect() as conn:
            rows = conn.execute(
                select(tools_table)
                .order_by(tools_table.c.trend_score.desc())
                .limit(limit)
            ).all()
        return [_row_to_tool(r) for r in rows]

    def prune_area(self, keep: str) -> int:
        """Delete tools not belonging to the active area, so an area switch swaps
        the landscape cleanly. Returns the number removed."""
        with self._engine.begin() as conn:
            result = conn.execute(
                delete(tools_table).where(tools_table.c.area != keep)
            )
        return result.rowcount or 0


class SqlClusterRepository:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def replace_all(self, clusters: list[Cluster]) -> None:
        with self._engine.begin() as conn:
            conn.execute(delete(clusters_table))
            if clusters:
                conn.execute(
                    clusters_table.insert(),
                    [
                        {
                            "id": c.id,
                            "label": c.label,
                            "slug": c.slug,
                            "size": c.size,
                            "centroid_x": c.centroid.x,
                            "centroid_y": c.centroid.y,
                            "centroid_z": c.centroid.z,
                            "keywords": c.keywords,
                            "description": c.description,
                        }
                        for c in clusters
                    ],
                )

    def list_all(self) -> list[Cluster]:
        with self._engine.connect() as conn:
            rows = conn.execute(
                select(clusters_table).order_by(clusters_table.c.size.desc())
            ).all()
        return [self._row_to_cluster(r) for r in rows]

    def get_by_slug(self, slug: str) -> Cluster | None:
        with self._engine.connect() as conn:
            row = conn.execute(
                select(clusters_table).where(clusters_table.c.slug == slug)
            ).first()
        return self._row_to_cluster(row) if row else None

    @staticmethod
    def _row_to_cluster(row) -> Cluster:
        return Cluster(
            id=row.id,
            label=row.label,
            slug=row.slug,
            size=row.size,
            centroid=Position3D(row.centroid_x, row.centroid_y, row.centroid_z),
            keywords=list(row.keywords or []),
            description=row.description or "",
        )


class SqlPresetRepository:
    """User-added radar areas, persisted so they survive restarts and reach both
    the API (settings list) and the worker (topics to ingest)."""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def list_all(self) -> list[Preset]:
        with self._engine.connect() as conn:
            rows = conn.execute(select(custom_presets_table)).all()
        return [
            Preset(
                slug=r.slug,
                title=r.title,
                topics=list(r.topics or []),
                seed_file=r.seed_file,
            )
            for r in rows
        ]

    def add(self, slug: str, title: str, topics: list[str], seed_file: str | None = None) -> None:
        stmt = pg_insert(custom_presets_table).values(
            slug=slug, title=title, topics=topics, seed_file=seed_file
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[custom_presets_table.c.slug],
            set_={"title": title, "topics": topics, "seed_file": seed_file},
        )
        with self._engine.begin() as conn:
            conn.execute(stmt)


class SqlSettingsRepository:
    """Single-row (id = SETTINGS_ROW_ID) settings; falls back to defaults if absent."""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def get(self) -> RadarSettings:
        with self._engine.connect() as conn:
            row = conn.execute(
                select(radar_settings_table).where(
                    radar_settings_table.c.id == SETTINGS_ROW_ID
                )
            ).first()
        if row is None:
            return RadarSettings()
        return RadarSettings(
            area_preset=row.area_preset,
            min_cluster_size=row.min_cluster_size,
            min_tools=row.min_tools,
        )

    def update(self, **fields) -> RadarSettings:
        allowed = {"area_preset", "min_cluster_size", "min_tools"}
        values = {k: v for k, v in fields.items() if k in allowed}
        with self._engine.begin() as conn:
            stmt = pg_insert(radar_settings_table).values(id=SETTINGS_ROW_ID, **values)
            stmt = stmt.on_conflict_do_update(
                index_elements=[radar_settings_table.c.id],
                set_=values or {"id": SETTINGS_ROW_ID},
            )
            conn.execute(stmt)
        return self.get()
