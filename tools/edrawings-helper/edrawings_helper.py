import ctypes
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


APP_DIR = Path(os.environ.get("APPDATA", Path.home())) / "ZGG"
CONFIG_PATH = APP_DIR / "edrawings-helper.json"
CACHE_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "ZGG" / "edrawings-cache"

DEFAULT_EDRAWINGS_PATHS = [
    Path(r"C:\Program Files\SOLIDWORKS Corp\eDrawings\eDrawings.exe"),
    Path(r"C:\Program Files (x86)\SOLIDWORKS Corp\eDrawings\eDrawings.exe"),
]


def show_error(message: str) -> None:
    if os.name == "nt":
        ctypes.windll.user32.MessageBoxW(None, message, "ZGG eDrawings Helper", 0x10)
    else:
        print(message, file=sys.stderr)


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def resolve_edrawings_path() -> Path:
    config = load_config()
    candidates = [
        config.get("edrawings_exe_path"),
        os.environ.get("ZGG_EDRAWINGS_EXE_PATH"),
        *[str(path) for path in DEFAULT_EDRAWINGS_PATHS],
    ]
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(str(candidate)).expanduser()
        if path.is_file():
            return path
    raise RuntimeError("eDrawings.exe was not found. Run install_protocol.ps1 with -EDrawingsPath.")


def parse_protocol_url(raw: str) -> tuple[str, str]:
    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme != "zgg-edrawings" or parsed.netloc != "open":
        raise RuntimeError("Invalid zgg-edrawings protocol URL.")
    params = urllib.parse.parse_qs(parsed.query)
    download_url = params.get("url", [""])[0]
    filename = params.get("filename", ["model.sldprt"])[0]
    if urllib.parse.urlparse(download_url).scheme not in {"http", "https"}:
        raise RuntimeError("Invalid download URL.")
    return download_url, sanitize_filename(filename)


def sanitize_filename(filename: str) -> str:
    cleaned = filename.replace("\\", "_").replace("/", "_").strip()
    for char in '<>:"|?*':
        cleaned = cleaned.replace(char, "_")
    return cleaned or "model.sldprt"


def download_file(url: str, filename: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / f"{uuid.uuid4().hex}-{filename}"
    request = urllib.request.Request(url, headers={"User-Agent": "ZGG eDrawings Helper"})
    with urllib.request.urlopen(request, timeout=120) as response:
        with target.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
    return target


def main() -> int:
    if len(sys.argv) < 2:
        show_error("Missing zgg-edrawings URL.")
        return 2
    try:
        download_url, filename = parse_protocol_url(sys.argv[1])
        model_path = download_file(download_url, filename)
        edrawings_path = resolve_edrawings_path()
        subprocess.Popen([str(edrawings_path), str(model_path)], cwd=str(model_path.parent))
        return 0
    except Exception as exc:
        show_error(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
