import json

from fastapi import FastAPI, HTTPException, Query
from sse_starlette.sse import EventSourceResponse

from airadar.application.queries import tool_summary
from airadar.interface.container import Container


def create_app(container: Container, lifespan=None) -> FastAPI:
    app = FastAPI(title="AI Radar API", lifespan=lifespan)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

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
            },
            "tools": members,
        }

    @app.get("/api/events")
    async def events() -> EventSourceResponse:
        async def stream():
            async for event in container.broadcaster.subscribe():
                yield {"event": event.get("type", "message"), "data": json.dumps(event)}

        return EventSourceResponse(stream())

    return app
