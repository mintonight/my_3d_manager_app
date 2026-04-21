"""SolidWorks / OLE compound file thumbnail extraction.

SolidWorks stores embedded preview images inside .sldprt/.sldasm/.slddrw
files. Depending on version and save settings, the preview can live in
several places and formats:

1. OLE streams named like ``PreviewPNG`` / ``BigPreviewPNG`` — raw PNG bytes
2. OLE streams named like ``JPEGView`` / ``JpegPreview`` — JPEG bytes
3. OLE streams named like ``PreviewBitmap`` — Windows DIB (headerless BMP)
4. Nested under storages such as ``\\x03Revision\\PreviewPNG`` or per-config
5. The standard OLE ``\\x05SummaryInformation`` Thumbnail property

This module walks every stream in the compound document, tries each of
those decoding strategies, and converts the result to PNG/JPEG bytes ready
to serve to the browser. Pillow is used to normalize anything that isn't
already a browser-renderable format.
"""

from __future__ import annotations

import io
import struct
from typing import Optional

import olefile


PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
PNG_IEND = b"IEND\xaeB`\x82"
JPEG_MAGIC = b"\xff\xd8\xff"
JPEG_EOI = b"\xff\xd9"
BMP_MAGIC = b"BM"

# Stream name fragments that typically carry the preview bitmap in OLE-based
# CAD files. Matched case-insensitively.
PREVIEW_HINTS = (
    "previewpng",
    "bigpreviewpng",
    "preview",
    "jpegview",
    "jpegpreview",
    "thumbnail",
    "bitmap",
    "png",
    "jpeg",
    "jpg",
)


def _extract_png(buf: bytes) -> Optional[bytes]:
    start = buf.find(PNG_MAGIC)
    if start < 0:
        return None
    end = buf.find(PNG_IEND, start)
    if end < 0:
        return buf[start:]
    return buf[start : end + len(PNG_IEND)]


def _extract_jpeg(buf: bytes) -> Optional[bytes]:
    start = buf.find(JPEG_MAGIC)
    if start < 0:
        return None
    end = buf.find(JPEG_EOI, start)
    if end < 0:
        return buf[start:]
    return buf[start : end + len(JPEG_EOI)]


def _scan_for_png_or_jpeg(content: bytes) -> Optional[tuple[bytes, str]]:
    png = _extract_png(content)
    if png and len(png) > 64:
        return png, "image/png"
    jpeg = _extract_jpeg(content)
    if jpeg and len(jpeg) > 64:
        return jpeg, "image/jpeg"
    return None


def _dib_to_bmp(dib: bytes) -> Optional[bytes]:
    """Wrap a headerless Windows DIB in a BMP file header."""
    if len(dib) < 40:
        return None
    try:
        header_size = struct.unpack_from("<I", dib, 0)[0]
    except struct.error:
        return None
    # Valid BITMAPINFOHEADER / BITMAPV4HEADER / BITMAPV5HEADER sizes
    if header_size not in (12, 40, 52, 56, 64, 108, 124):
        return None
    if len(dib) < header_size + 4:
        return None
    try:
        bit_count = struct.unpack_from("<H", dib, 14)[0]
        colors_used = struct.unpack_from("<I", dib, 32)[0] if header_size >= 40 else 0
    except struct.error:
        return None
    if bit_count not in (1, 4, 8, 16, 24, 32):
        return None
    palette_entries = 0
    if bit_count <= 8:
        palette_entries = colors_used or (1 << bit_count)
    palette_bytes = palette_entries * 4
    pixel_offset = 14 + header_size + palette_bytes
    file_size = 14 + len(dib)
    bmp_header = struct.pack("<2sIHHI", b"BM", file_size, 0, 0, pixel_offset)
    return bmp_header + dib


def _pillow_to_png(data: bytes) -> Optional[tuple[bytes, str]]:
    """Decode arbitrary image bytes with Pillow and re-encode to PNG."""
    try:
        from PIL import Image
    except Exception:
        return None
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:
        return None
    out = io.BytesIO()
    try:
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.mode or img.mode == "P" else "RGB")
        img.save(out, format="PNG", optimize=True)
    except Exception:
        return None
    return out.getvalue(), "image/png"


def _try_bmp_or_dib(content: bytes) -> Optional[tuple[bytes, str]]:
    """Try to interpret content as either a BMP file or a bare DIB, convert to PNG."""
    # BMP file starts with "BM"
    bmp_start = content.find(BMP_MAGIC)
    if bmp_start >= 0 and len(content) - bmp_start >= 14:
        try:
            file_size = struct.unpack_from("<I", content, bmp_start + 2)[0]
        except struct.error:
            file_size = 0
        if 0 < file_size <= len(content) - bmp_start + 1024:
            result = _pillow_to_png(content[bmp_start : bmp_start + file_size])
            if result:
                return result
        result = _pillow_to_png(content[bmp_start:])
        if result:
            return result
    # Bare DIB — some SolidWorks streams begin with a small preamble, try
    # common skips before the header.
    for skip in (0, 4, 8, 12, 16, 20):
        if skip >= len(content):
            break
        wrapped = _dib_to_bmp(content[skip:])
        if not wrapped:
            continue
        result = _pillow_to_png(wrapped)
        if result:
            return result
    return None


def _from_summary_thumbnail(ole: olefile.OleFileIO) -> Optional[tuple[bytes, str]]:
    """Pull a thumbnail from the standard OLE ``SummaryInformation`` property set."""
    try:
        meta = ole.get_metadata()
    except Exception:
        return None
    thumb = getattr(meta, "thumbnail", None)
    if not thumb or len(thumb) < 16:
        return None
    # SummaryInformation thumbnail: 4-byte CF tag, then either CF_DIB bytes
    # or a Packed Metafile. Try different skip amounts and heuristics.
    for skip in (0, 4, 8, 12, 16):
        if skip >= len(thumb):
            break
        candidate = thumb[skip:]
        result = _scan_for_png_or_jpeg(candidate)
        if result:
            return result
        result = _try_bmp_or_dib(candidate)
        if result:
            return result
    return None


def _walk_streams(ole: olefile.OleFileIO) -> list[list[str]]:
    try:
        return list(ole.listdir(streams=True, storages=False))
    except Exception:
        return []


def extract_solidworks_thumbnail(data: bytes) -> Optional[tuple[bytes, str]]:
    """Return (image_bytes, mime_type) or None if nothing found.

    Strategy:
      1. Parse as OLE Compound File.
      2. Rank every stream by how 'preview-ish' its name is.
      3. For each, try PNG → JPEG → BMP/DIB decode.
      4. Fall back to ``SummaryInformation`` thumbnail.
      5. Final fallback: raw scan over the whole file for PNG/JPEG magic.
    """
    buf = io.BytesIO(data)
    try:
        if not olefile.isOleFile(buf):
            return _raw_scan(data)
    except Exception:
        return _raw_scan(data)

    try:
        ole = olefile.OleFileIO(buf)
    except Exception:
        return _raw_scan(data)

    try:
        streams = _walk_streams(ole)

        def stream_rank(path: list[str]) -> int:
            name = "/".join(path).lower()
            for index, hint in enumerate(PREVIEW_HINTS):
                if hint in name:
                    return index
            return len(PREVIEW_HINTS)

        streams.sort(key=stream_rank)

        # Pass 1: PNG / JPEG in hinted streams
        for stream_path in streams:
            name = "/".join(stream_path).lower()
            if not any(hint in name for hint in PREVIEW_HINTS):
                continue
            try:
                content = ole.openstream(stream_path).read()
            except Exception:
                continue
            found = _scan_for_png_or_jpeg(content)
            if found:
                return found

        # Pass 2: BMP/DIB in hinted streams
        for stream_path in streams:
            name = "/".join(stream_path).lower()
            if not any(hint in name for hint in PREVIEW_HINTS):
                continue
            try:
                content = ole.openstream(stream_path).read()
            except Exception:
                continue
            result = _try_bmp_or_dib(content)
            if result:
                return result

        # Pass 3: PNG / JPEG in ANY stream (previews sometimes live in
        # storages with unexpected names, e.g. ``\x03Revision`` or config dirs)
        for stream_path in streams:
            name = "/".join(stream_path).lower()
            if any(hint in name for hint in PREVIEW_HINTS):
                continue
            try:
                content = ole.openstream(stream_path).read()
            except Exception:
                continue
            found = _scan_for_png_or_jpeg(content)
            if found:
                return found

        # Pass 4: OLE SummaryInformation thumbnail
        summary = _from_summary_thumbnail(ole)
        if summary:
            return summary
    finally:
        try:
            ole.close()
        except Exception:
            pass

    return _raw_scan(data)


def _raw_scan(data: bytes) -> Optional[tuple[bytes, str]]:
    """Whole-file scan for PNG/JPEG magic as a last resort."""
    return _scan_for_png_or_jpeg(data)


def list_ole_streams(data: bytes) -> list[str]:
    """Debug helper — return every stream path in the OLE file, joined with '/'."""
    buf = io.BytesIO(data)
    try:
        if not olefile.isOleFile(buf):
            return []
        ole = olefile.OleFileIO(buf)
    except Exception:
        return []
    try:
        return ["/".join(path) for path in _walk_streams(ole)]
    finally:
        try:
            ole.close()
        except Exception:
            pass
