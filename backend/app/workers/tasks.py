import os

import structlog

logger = structlog.get_logger()


def cleanup_uploaded_file(file_path: str) -> None:
    try:
        if os.path.isfile(file_path):
            os.remove(file_path)
            logger.info("file.cleaned", path=file_path)
    except OSError as exc:
        logger.warning("file.cleanup_failed", path=file_path, error=str(exc))
