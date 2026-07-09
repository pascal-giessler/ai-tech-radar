import pytest

from airadar.application.settings import (
    GetSettings,
    SettingsValidationError,
    UpdateSettings,
)
from airadar.domain.model.radar_settings import RadarSettings
from airadar.infrastructure.sources.presets import get_preset, load_presets

from tests.fakes import InMemorySettingsRepository, RecordingBroadcaster


def make_get(repo: InMemorySettingsRepository) -> GetSettings:
    return GetSettings(
        repo, load_presets(), default_min_cluster_size=4, default_min_tools=12
    )


def test_get_settings_falls_back_to_defaults_when_row_unset() -> None:
    repo = InMemorySettingsRepository(RadarSettings())  # nullable knobs unset
    body = make_get(repo).execute()

    assert body["area_preset"] == "ai"
    assert body["min_cluster_size"] == 4  # env/const default
    assert body["min_tools"] == 12
    assert {"slug", "title"} <= body["presets"][0].keys()
    assert {p["slug"] for p in body["presets"]} >= {"ai", "rust", "platform"}
    assert body["pipeline"] == {
        "embedding_model": "BAAI/bge-small-en-v1.5",
        "embedding_dim": 384,
        "reduce_to": 5,
        "algorithm": "HDBSCAN",
        "labeler": "c-TF-IDF",
    }


def test_get_settings_uses_row_values_when_present() -> None:
    repo = InMemorySettingsRepository(
        RadarSettings(area_preset="rust", min_cluster_size=8, min_tools=30)
    )
    body = make_get(repo).execute()
    assert body["area_preset"] == "rust"
    assert body["min_cluster_size"] == 8
    assert body["min_tools"] == 30


def test_update_persists_valid_patch_and_emits_notify() -> None:
    repo = InMemorySettingsRepository(RadarSettings())
    broadcaster = RecordingBroadcaster()
    get = make_get(repo)
    update = UpdateSettings(repo, load_presets(), get, broadcaster)

    body = update.execute({"area_preset": "platform", "min_cluster_size": 6})

    assert body["area_preset"] == "platform"
    assert body["min_cluster_size"] == 6
    assert body["min_tools"] == 12  # untouched → still default
    assert broadcaster.events == [{"type": "radar_config_changed"}]
    assert repo.get().area_preset == "platform"


@pytest.mark.parametrize(
    "patch",
    [
        {"area_preset": "nonexistent"},
        {"min_cluster_size": 1},
        {"min_cluster_size": 21},
        {"min_tools": 1},
        {"min_tools": 101},
    ],
)
def test_update_rejects_invalid_patch(patch) -> None:
    repo = InMemorySettingsRepository(RadarSettings())
    update = UpdateSettings(repo, load_presets(), make_get(repo), RecordingBroadcaster())
    with pytest.raises(SettingsValidationError):
        update.execute(patch)


def test_presets_resolve_topics() -> None:
    presets = load_presets()
    assert {p.slug for p in presets} >= {"ai", "rust", "platform"}
    ai = get_preset("ai")
    # ai preset keeps the historical hardcoded topic set
    assert ai.topics == ["llm", "ai-agents", "developer-tools", "mcp", "rag", "llmops"]
    with pytest.raises(KeyError):
        get_preset("does-not-exist")
