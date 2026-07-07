from airadar.config import Settings


def test_settings_defaults() -> None:
    settings = Settings(database_url="postgresql+psycopg://x:y@localhost/db", _env_file=None)
    assert settings.ingest_interval_minutes == 30
    assert settings.min_tools_for_clustering == 12
    assert settings.github_token is None


def test_settings_reads_env(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://a:b@db/airadar")
    monkeypatch.setenv("GITHUB_TOKEN", "ghp_x")
    monkeypatch.setenv("INGEST_INTERVAL_MINUTES", "5")
    settings = Settings(_env_file=None)
    assert settings.database_url.endswith("/airadar")
    assert settings.github_token == "ghp_x"
    assert settings.ingest_interval_minutes == 5


def test_build_app_wires_routes_without_db() -> None:
    """create_app over a fake-backed container must not require postgres or models."""
    from fastapi.testclient import TestClient

    from airadar.application.queries import GetLandscape, GetTool, ListClusters, ListTools
    from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster
    from airadar.interface.container import Container
    from airadar.interface.http import create_app

    from tests.fakes import InMemoryClusterRepository, InMemoryToolRepository

    tools, clusters = InMemoryToolRepository(), InMemoryClusterRepository()
    container = Container(
        get_landscape=GetLandscape(tools, clusters),
        get_tool=GetTool(tools),
        list_tools=ListTools(tools),
        list_clusters=ListClusters(clusters),
        tools=tools,
        clusters=clusters,
        broadcaster=AsyncFanoutBroadcaster(),
    )
    client = TestClient(create_app(container))
    assert client.get("/api/landscape").json()["tools"] == []
