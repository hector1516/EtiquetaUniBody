"""Logger simple con persistencia en SQLite local."""
import logging
import os
from datetime import datetime

_LOG_DIR = os.path.join(os.getenv("APPDATA") or os.path.expanduser("~"), "EtiquetaUniBody")
os.makedirs(_LOG_DIR, exist_ok=True)
_LOG_FILE = os.path.join(_LOG_DIR, "app.log")

logger = logging.getLogger("EtiquetaUniBody")
logger.setLevel(logging.INFO)
if not logger.handlers:
    fh = logging.FileHandler(_LOG_FILE, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(fh)
    sh = logging.StreamHandler()
    sh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(sh)

def log_event(level, module, action, message):
    getattr(logger, level.lower(), logger.info)(f"[{module}] {action}: {message}")
