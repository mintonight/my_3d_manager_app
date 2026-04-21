import hashlib
from pathlib import Path

from .config import BLOB_DIR


def _blob_path(hash_hex: str) -> Path:
    return BLOB_DIR / hash_hex[:2] / hash_hex[2:]


def save_blob(content: bytes) -> str:
    h = hashlib.sha256(content).hexdigest()
    path = _blob_path(h)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    return h


def get_blob_path(hash_hex: str) -> Path:
    path = _blob_path(hash_hex)
    if not path.exists():
        raise FileNotFoundError(f"blob {hash_hex} not found")
    return path
