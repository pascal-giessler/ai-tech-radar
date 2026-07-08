import airadar.migrate as migrate


class _DummyEngine:
    disposed = False

    def dispose(self) -> None:
        self.disposed = True


def test_migrate_returns_zero_on_success(monkeypatch) -> None:
    engine = _DummyEngine()
    monkeypatch.setattr(migrate, "make_engine", lambda url: engine)
    monkeypatch.setattr(migrate, "init_db_with_retry", lambda e: None)

    assert migrate.main() == 0
    assert engine.disposed  # engine always released


def test_migrate_returns_one_on_failure(monkeypatch) -> None:
    engine = _DummyEngine()
    monkeypatch.setattr(migrate, "make_engine", lambda url: engine)

    def boom(_engine):
        raise RuntimeError("db unreachable")

    monkeypatch.setattr(migrate, "init_db_with_retry", boom)

    assert migrate.main() == 1
    assert engine.disposed
