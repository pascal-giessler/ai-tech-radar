from collections import defaultdict

from airadar.application.dto import LandscapeReport
from airadar.domain.model.cluster import UNCHARTED_ID, UNCHARTED_LABEL, Cluster
from airadar.domain.model.position import Position3D
from airadar.domain.model.slug import slugify
from airadar.domain.model.tool import Tool
from airadar.domain.ports import (
    Clusterer,
    ClusterLabeler,
    ClusterRepository,
    EmbeddingModel,
    Projector,
    ToolRepository,
    UpdateBroadcaster,
)


class RecomputeLandscape:
    """Embed changed tools, project all to 3D, cluster, label, persist, broadcast."""

    def __init__(
        self,
        tools: ToolRepository,
        clusters: ClusterRepository,
        embedder: EmbeddingModel,
        projector: Projector,
        clusterer: Clusterer,
        labeler: ClusterLabeler,
        broadcaster: UpdateBroadcaster,
        min_tools: int = 12,
    ) -> None:
        self._tools = tools
        self._clusters = clusters
        self._embedder = embedder
        self._projector = projector
        self._clusterer = clusterer
        self._labeler = labeler
        self._broadcaster = broadcaster
        self._min_tools = min_tools

    def execute(self) -> LandscapeReport:
        tools = self._tools.list_all()
        if not tools:
            return LandscapeReport(tool_count=0, cluster_count=0)

        self._embed_changed(tools)
        embeddings = [t.embedding for t in tools]

        positions = self._projector.project(embeddings)
        for tool, position in zip(tools, positions, strict=True):
            tool.position = position

        if len(tools) < self._min_tools:
            assignments = [-1] * len(tools)
        else:
            assignments = self._clusterer.assign(embeddings)

        clusters = self._build_clusters(tools, assignments)
        for tool in tools:
            self._tools.upsert(tool)
        self._clusters.replace_all(clusters)

        self._broadcaster.publish({"type": "landscape_updated", "tool_count": len(tools)})
        return LandscapeReport(tool_count=len(tools), cluster_count=len(clusters))

    def _embed_changed(self, tools: list[Tool]) -> None:
        pending = [t for t in tools if t.needs_embedding()]
        if not pending:
            return
        vectors = self._embedder.embed([t.embedding_text() for t in pending])
        for tool, vector in zip(pending, vectors, strict=True):
            tool.embedding = vector
            tool.embedded_fingerprint = tool.content_fingerprint()

    def _build_clusters(self, tools: list[Tool], assignments: list[int]) -> list[Cluster]:
        members: dict[int, list[Tool]] = defaultdict(list)
        for tool, raw_label in zip(tools, assignments, strict=True):
            members[raw_label].append(tool)

        real_labels = sorted(label for label in members if label != -1)
        labels_text = self._labeler.label(
            {label: [t.description for t in members[label]] for label in real_labels}
        )

        # Remap: raw clusterer labels -> stable ids with 0 reserved for Uncharted.
        clusters: list[Cluster] = []
        if -1 in members:
            clusters.append(self._make_cluster(UNCHARTED_ID, UNCHARTED_LABEL, members[-1]))
        for new_id, raw_label in enumerate(real_labels, start=1):
            clusters.append(
                self._make_cluster(new_id, labels_text[raw_label], members[raw_label])
            )
        return clusters

    def _make_cluster(self, cluster_id: int, label: str, members: list[Tool]) -> Cluster:
        for tool in members:
            tool.cluster_id = cluster_id
        n = len(members)
        centroid = Position3D(
            x=sum(t.position.x for t in members) / n,
            y=sum(t.position.y for t in members) / n,
            z=sum(t.position.z for t in members) / n,
        )
        return Cluster(id=cluster_id, label=label, slug=slugify(label), size=n, centroid=centroid)
