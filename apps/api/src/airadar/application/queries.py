from datetime import UTC, datetime

from airadar.domain.model.cluster import Cluster
from airadar.domain.model.tool import Tool
from airadar.domain.ports import ClusterRepository, ToolRepository


def _position_dict(tool: Tool) -> dict | None:
    if tool.position is None:
        return None
    return {"x": tool.position.x, "y": tool.position.y, "z": tool.position.z}


def tool_summary(tool: Tool) -> dict:
    return {
        "slug": tool.slug,
        "name": tool.ref.name,
        "owner": tool.ref.owner,
        "description": tool.description,
        "language": tool.language,
        "topics": tool.topics,
        "stars": tool.stars,
        "stars_gained": tool.stars_gained,
        "trend_score": round(tool.trend_score, 2),
        "ring": tool.ring.slug if tool.ring else None,
        "url": tool.url,
        "position": _position_dict(tool),
        "cluster_id": tool.cluster_id,
        "open_issues": tool.open_issues,
        "commit_activity": tool.commit_activity,
    }


def tool_detail(tool: Tool) -> dict:
    return tool_summary(tool) | {
        "first_seen_at": tool.first_seen_at.isoformat(),
        "repo_created_at": tool.repo_created_at.isoformat(),
        "last_updated_at": tool.last_updated_at.isoformat(),
    }


def cluster_summary(cluster: Cluster) -> dict:
    return {
        "id": cluster.id,
        "label": cluster.label,
        "slug": cluster.slug,
        "size": cluster.size,
        "centroid": {"x": cluster.centroid.x, "y": cluster.centroid.y, "z": cluster.centroid.z},
        "keywords": cluster.keywords,
        "description": cluster.description,
    }


class GetLandscape:
    def __init__(self, tools: ToolRepository, clusters: ClusterRepository) -> None:
        self._tools = tools
        self._clusters = clusters

    def execute(self) -> dict:
        return {
            "tools": [tool_summary(t) for t in self._tools.list_all()],
            "clusters": [cluster_summary(c) for c in self._clusters.list_all()],
            "generated_at": datetime.now(UTC).isoformat(),
        }


class GetTool:
    def __init__(self, tools: ToolRepository) -> None:
        self._tools = tools

    def execute(self, slug: str) -> dict | None:
        tool = self._tools.get_by_slug(slug)
        return tool_detail(tool) if tool else None


class ListTools:
    def __init__(self, tools: ToolRepository) -> None:
        self._tools = tools

    def execute(self, limit: int = 200) -> list[dict]:
        return [tool_summary(t) for t in self._tools.list_ranked(limit)]


class ListClusters:
    def __init__(self, clusters: ClusterRepository) -> None:
        self._clusters = clusters

    def execute(self) -> list[dict]:
        return [cluster_summary(c) for c in self._clusters.list_all()]
