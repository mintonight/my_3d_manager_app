"""SolidWorks COM API converter: .sldprt/.sldasm -> STEP."""

import logging
import os
import sys
import tempfile
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

SW_EXTENSIONS = {".sldprt", ".sldasm"}

# SolidWorks COM is a single-instance process; concurrent OpenDoc/SaveAs calls
# collide and can crash the host. Serialize all conversions process-wide.
_com_lock = threading.Lock()


def _ensure_pywin32_dlls() -> None:
    """Add pywin32 DLL directory to sys.path if not already present."""
    site = Path(sys.prefix) / "Lib" / "site-packages"
    for subdir in ("pywin32_system32", "win32", "win32com"):
        dll_dir = site / subdir
        if dll_dir.is_dir() and str(dll_dir) not in sys.path:
            sys.path.insert(0, str(dll_dir))
    os.environ["PATH"] = str(site / "pywin32_system32") + ";" + os.environ.get("PATH", "")


def is_solidworks_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in SW_EXTENSIONS


def convert_to_step(source_path: Path, original_name: str) -> bytes | None:
    """Convert a SolidWorks file to STEP format. Returns STEP bytes or None on failure."""
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in SW_EXTENSIONS:
        return None

    _ensure_pywin32_dlls()
    import pythoncom
    import win32com.client

    # Hold the lock for the whole COM session: CoInitialize through CoUninitialize.
    # This guarantees only one thread drives SolidWorks at a time.
    with _com_lock:
        pythoncom.CoInitialize()
        try:
            sw = win32com.client.Dispatch("SldWorks.Application")
            doc_type = 1 if ext == ".sldprt" else 2

            sw_doc = sw.OpenDoc(str(source_path), doc_type)
            if sw_doc is None:
                logger.warning("SolidWorks failed to open: %s", original_name)
                return None

            with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as tmp:
                tmp_path = tmp.name

            try:
                result = sw_doc.SaveAs3(tmp_path, 0, 0)
                if result != 0:
                    logger.warning("SolidWorks SaveAs failed: code=%s", result)
                    return None
                step_bytes = Path(tmp_path).read_bytes()
                return step_bytes if step_bytes else None
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                sw.CloseDoc(sw_doc.GetTitle)
        except Exception:
            logger.exception("SolidWorks COM conversion error")
            return None
        finally:
            pythoncom.CoUninitialize()
