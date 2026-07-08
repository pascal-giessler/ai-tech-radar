"""One-shot schema migration entrypoint: `python -m airadar.migrate`.

Run as a Kubernetes Job (and a compose one-shot service) before api/worker start,
so no replica races schema changes.
"""

import sys

from airadar.config import Settings
from airadar.infrastructure.persistence.database import make_engine
from airadar.runtime import configure_logging, init_db_with_retry, logger


def main() -> int:
    configure_logging()
    settings = Settings()
    engine = make_engine(settings.database_url)
    try:
        init_db_with_retry(engine)
    except Exception:
        logger.exception("migration failed")
        return 1
    finally:
        engine.dispose()
    logger.info("migration complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
