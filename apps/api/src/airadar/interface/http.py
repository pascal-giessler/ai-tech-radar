import json
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from airadar.application.queries import tool_summary
from airadar.application.settings import SettingsValidationError
from airadar.domain.model.adoption import AdoptionRing
from airadar.interface.container import Container


class SettingsPatch(BaseModel):
    area_preset: str | None = None
    min_cluster_size: int | None = None
    min_tools: int | None = None


class NewArea(BaseModel):
    title: str
    topics: list[str] = []


def create_app(container: Container, lifespan=None) -> FastAPI:
    app = FastAPI(title="AI Radar API", lifespan=lifespan)

    @app.get("/health")
    def health() -> dict:
        # Liveness: always ok while the process serves. Must not depend on DB or scan
        # freshness, or Kubernetes would restart healthy pods.
        return {"status": "alive"}

    @app.get("/health/ready")
    def readiness() -> JSONResponse:
        # Readiness: gate traffic on the database being reachable; report scan freshness.
        reachable = container.db_ping()
        body = {"ready": reachable, **container.status.as_dict(datetime.now(UTC))}
        return JSONResponse(body, status_code=200 if reachable else 503)

    @app.get("/api/rings")
    def rings() -> list[dict]:
        counts: dict[str, int] = {r.slug: 0 for r in AdoptionRing.ordered()}
        for tool in container.tools.list_all():
            if tool.ring is not None:
                counts[tool.ring.slug] += 1
        return [
            {"slug": r.slug, "label": r.label, "order": r.order, "count": counts[r.slug]}
            for r in AdoptionRing.ordered()
        ]

    @app.get("/api/landscape")
    def landscape() -> dict:
        return container.get_landscape.execute()

    @app.get("/api/tools")
    def tools(limit: int = Query(default=200, ge=1, le=1000)) -> list[dict]:
        return container.list_tools.execute(limit=limit)

    @app.get("/api/tools/{slug}")
    def tool(slug: str) -> dict:
        detail = container.get_tool.execute(slug)
        if detail is None:
            raise HTTPException(status_code=404, detail="tool not found")
        return detail

    @app.get("/api/clusters")
    def clusters() -> list[dict]:
        return container.list_clusters.execute()

    @app.get("/api/clusters/{slug}")
    def cluster(slug: str) -> dict:
        found = container.clusters.get_by_slug(slug)
        if found is None:
            raise HTTPException(status_code=404, detail="cluster not found")
        members = [
            tool_summary(t) for t in container.tools.list_all() if t.cluster_id == found.id
        ]
        members.sort(key=lambda t: t["trend_score"], reverse=True)
        return {
            "cluster": {
                "id": found.id,
                "label": found.label,
                "slug": found.slug,
                "size": found.size,
                "centroid": {
                    "x": found.centroid.x,
                    "y": found.centroid.y,
                    "z": found.centroid.z,
                },
                "keywords": found.keywords,
                "description": found.description,
            },
            "tools": members,
        }

    @app.get("/api/settings")
    def get_settings() -> dict:
        if container.get_settings is None:
            raise HTTPException(status_code=503, detail="settings unavailable")
        return container.get_settings.execute()

    @app.patch("/api/settings")
    def patch_settings(patch: SettingsPatch) -> dict:
        if container.update_settings is None:
            raise HTTPException(status_code=503, detail="settings unavailable")
        try:
            return container.update_settings.execute(patch.model_dump(exclude_unset=True))
        except SettingsValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post("/api/areas", status_code=201)
    def add_area(body: NewArea) -> dict:
        if container.add_custom_area is None:
            raise HTTPException(status_code=503, detail="settings unavailable")
        try:
            return container.add_custom_area.execute(title=body.title, topics=body.topics)
        except SettingsValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.get("/api/events")
    async def events() -> EventSourceResponse:
        async def stream():
            async for event in container.broadcaster.subscribe():
                yield {"event": event.get("type", "message"), "data": json.dumps(event)}

        return EventSourceResponse(stream())

    return app
