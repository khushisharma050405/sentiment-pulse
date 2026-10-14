import csv
import io
import json
import os
import re
import shutil
import zipfile
from typing import Any, Tuple
from fastapi import HTTPException
from PIL import Image
import pypdf
import pytesseract
import openpyxl

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_TABLE_ROWS = 1000

# UI noise patterns to filter from OCR screenshots
NOISE_EXACT_LINES = {
    "like", "likes", "liked",
    "reply", "replies", "replying", "replying to",
    "retweet", "retweets", "repost", "reposts", "quote", "quotes",
    "share", "share post", "send", "save", "bookmark",
    "follow", "following", "followed",
    "translate", "translate post", "view translation",
    "view replies", "show replies", "hide replies", "show this thread",
    "comments", "comment", "add a comment", "more", "posts",
    "for you", "following", "explore", "notifications", "messages",
    "home", "search", "verified", "subscribed", "subscribe"
}

RE_STATUS_BAR = re.compile(r"^(?:\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?|\d{1,3}%|LTE|5G|4G|WiFi|Wi-Fi)$", re.IGNORECASE)
RE_METRIC_LINE = re.compile(
    r"^[\d\s,.]*(?:k|m|b)?\s*(?:likes?|reposts?|retweets?|views?|comments?|replies|shares?|bookmarks?)\b.*$",
    re.IGNORECASE
)
RE_BARE_NUMBERS = re.compile(r"^[\d\s,.]+$")
RE_COMPACT_COUNT = re.compile(r"^\d+[\.,]?\d*[kKmMbB]?$")
RE_TIMESTAMP = re.compile(
    r"^(?:\d+\s*(?:s|sec|m|min|mins|h|hr|hrs|d|days?|w|weeks?|mo|months?|y|yrs?)\s*(?:ago)?|yesterday|today(?:\s*at\s*\d{1,2}:\d{2})?)$",
    re.IGNORECASE
)
RE_HANDLE_TIMESTAMP = re.compile(r"^@\w+\s*·\s*\d+[smhdw]$", re.IGNORECASE)


def get_tesseract_cmd() -> str:
    candidates = [
        os.getenv("TESSERACT_CMD"),
        shutil.which("tesseract"),
        "/opt/anaconda3/envs/ocr-env/bin/tesseract",
        "backend/.venv/bin/tesseract",
        "/opt/homebrew/bin/tesseract",
        "/usr/local/bin/tesseract",
        "/usr/bin/tesseract",
    ]
    for c in candidates:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return ""


def is_tesseract_available() -> bool:
    cmd = get_tesseract_cmd()
    return bool(cmd)


def clean_ocr_text(raw_text: str) -> str:
    """Removes social media UI noise (Likes, Reply, bare numbers, timestamps) and keeps post content."""
    lines = [line.strip() for line in raw_text.splitlines()]
    cleaned_lines = []

    for line in lines:
        if not line:
            continue
        lower = line.lower().strip()

        # Check exact matches
        if lower in NOISE_EXACT_LINES:
            continue

        # Check status bar indicators
        if RE_STATUS_BAR.match(lower):
            continue

        # Check metric counter lines (e.g. "1,420 Likes  340 Reposts")
        if RE_METRIC_LINE.match(lower):
            continue

        # Check bare numbers
        if RE_BARE_NUMBERS.match(lower) or RE_COMPACT_COUNT.match(lower):
            continue

        # Check timestamps
        if RE_TIMESTAMP.match(lower) or RE_HANDLE_TIMESTAMP.match(lower):
            continue

        # If line contains common action button cluster at end, strip it
        line_clean = re.sub(r"\b\d+[\.,]?\d*[kKmM]?\s*(?:likes?|reposts?|replies|views?)\b.*$", "", line, flags=re.IGNORECASE).strip()
        line_clean = re.sub(r"\b(?:Like|Reply|Share|Repost|Retweet)\b", "", line_clean, flags=re.IGNORECASE).strip()

        if line_clean and not RE_BARE_NUMBERS.match(line_clean):
            cleaned_lines.append(line_clean)

    result = " ".join(cleaned_lines).strip()
    # Normalize multiple whitespace
    return re.sub(r"\s+", " ", result)


def detect_file_type(data: bytes, filename: str) -> Tuple[str, str]:
    """
    Detects format using magic bytes, not just the file extension.
    Returns (category, mime_type) where category is in ('image', 'table', 'text', 'pdf').
    """
    ext = os.path.splitext(filename)[1].lower()

    # 1. Images
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image", "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image", "image/jpeg"
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        return "image", "image/webp"

    # If filename claims to be an image but magic bytes don't match
    if ext in (".png", ".jpg", ".jpeg", ".webp"):
        raise HTTPException(400, f"File '{filename}' content does not match expected image magic bytes.")

    # 2. PDF
    if data.startswith(b"%PDF-"):
        return "pdf", "application/pdf"
    if ext == ".pdf":
        raise HTTPException(400, f"File '{filename}' is not a valid PDF document.")

    # 3. XLSX (ZIP archive with PK\x03\x04 and xl/ structure)
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                names = z.namelist()
                if any(n.startswith("xl/") for n in names) or "[Content_Types].xml" in names:
                    return "table", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        except Exception:
            pass
        raise HTTPException(400, f"File '{filename}' is not a valid spreadsheet document.")

    # 4. Check for binary / executable magic bytes
    if data.startswith(b"MZ") or data.startswith(b"\x7fELF") or data.startswith(b"\xca\xfe\xba\xbe"):
        raise HTTPException(400, f"File '{filename}' contains an unsupported binary executable.")

    # Null bytes indicate binary data
    if b"\x00" in data[:4096]:
        raise HTTPException(400, f"File '{filename}' contains unsupported binary data.")

    # 5. Text-based files (JSON, CSV, TSV, TXT)
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = data.decode("latin-1")
        except Exception:
            raise HTTPException(400, f"File '{filename}' cannot be decoded as text.")

    trimmed = text.strip()

    # JSON check
    if (trimmed.startswith("[") and trimmed.endswith("]")) or (trimmed.startswith("{") and trimmed.endswith("}")):
        try:
            json.loads(trimmed)
            return "text", "application/json"
        except Exception:
            pass

    # TSV check
    if ext == ".tsv" or ("\t" in trimmed and "\n" in trimmed):
        return "table", "text/tab-separated-values"

    # CSV check
    if ext == ".csv" or ("," in trimmed and "\n" in trimmed):
        return "table", "text/csv"

    # TXT check
    return "text", "text/plain"


def detect_platform_from_text(text: str) -> str:
    lower = text.lower()
    if "twitter.com" in lower or "x.com" in lower or "retweet" in lower or "repost" in lower:
        return "X"
    if "instagram.com" in lower or "insta" in lower:
        return "Instagram"
    if "reddit.com" in lower or "r/" in lower or "upvote" in lower:
        return "Reddit"
    if "facebook.com" in lower or "fb.com" in lower:
        return "Facebook"
    return "Other"


def extract_from_image(data: bytes, filename: str) -> Tuple[list[dict], list[str]]:
    warnings = []
    items = []
    tess_cmd = get_tesseract_cmd()
    if not tess_cmd:
        warnings.append("OCR engine (tesseract) is not installed on the system.")
        return items, warnings

    pytesseract.pytesseract.tesseract_cmd = tess_cmd

    try:
        img = Image.open(io.BytesIO(data))
        raw_ocr = pytesseract.image_to_string(img)
        cleaned = clean_ocr_text(raw_ocr)

        if cleaned:
            platform = detect_platform_from_text(raw_ocr)
            items.append({"platform": platform, "text": cleaned})
        else:
            warnings.append("No readable post or caption text detected in image.")
    except Exception as e:
        warnings.append(f"OCR processing failed: {str(e)}")

    return items, warnings


def extract_from_table(data: bytes, filename: str, mime: str) -> Tuple[list[dict], list[str]]:
    warnings = []
    items = []

    if "spreadsheetml" in mime:  # XLSX
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        try:
            sheet = wb.active
            rows = list(sheet.iter_rows(values_only=True)) if sheet else []
        finally:
            wb.close()
        if not rows:
            return items, ["Spreadsheet is empty."]

        first_row = [str(c).strip().lower() if c is not None else "" for c in rows[0]]
        pi = next((i for i, c in enumerate(first_row) if c in ("platform", "source", "channel")), -1)
        ti = next((i for i, c in enumerate(first_row) if c in ("text", "post", "content", "body", "comment", "review", "message")), -1)

        data_rows = rows[1:] if (pi != -1 or ti != -1) else rows
        if pi == -1: pi = 0
        if ti == -1: ti = 1 if len(rows[0]) > 1 else 0

        for r in data_rows:
            if not r: continue
            raw_plat = str(r[pi]).strip() if pi < len(r) and r[pi] is not None and pi != ti else "Other"
            raw_text = str(r[ti]).strip() if ti < len(r) and r[ti] is not None else ""
            if raw_text and raw_text.lower() != "text":
                items.append({"platform": raw_plat or "Other", "text": raw_text[:5000]})
            if len(items) >= MAX_TABLE_ROWS:
                warnings.append(f"Table exceeded {MAX_TABLE_ROWS} rows; capped at {MAX_TABLE_ROWS}.")
                break
    else:  # CSV or TSV
        delimiter = "\t" if "tab-separated" in mime else ","
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("latin-1")

        reader = csv.reader(io.StringIO(text), delimiter=delimiter)
        rows = list(reader)
        if not rows:
            return items, ["Table file is empty."]

        first_row = [c.strip().lower() for c in rows[0]]
        pi = next((i for i, c in enumerate(first_row) if c in ("platform", "source", "channel")), -1)
        ti = next((i for i, c in enumerate(first_row) if c in ("text", "post", "content", "body", "comment", "review", "message")), -1)

        data_rows = rows[1:] if (pi != -1 or ti != -1) else rows
        if pi == -1: pi = 0
        if ti == -1: ti = 1 if len(rows[0]) > 1 else 0

        for r in data_rows:
            if not r: continue
            raw_plat = r[pi].strip() if pi < len(r) and pi != ti else "Other"
            raw_text = r[ti].strip() if ti < len(r) else ""
            if raw_text and raw_text.lower() != "text":
                items.append({"platform": raw_plat or "Other", "text": raw_text[:5000]})
            if len(items) >= MAX_TABLE_ROWS:
                warnings.append(f"Table exceeded {MAX_TABLE_ROWS} rows; capped at {MAX_TABLE_ROWS}.")
                break

    return items, warnings


def extract_from_text(data: bytes, filename: str, mime: str) -> Tuple[list[dict], list[str]]:
    warnings = []
    items = []

    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("latin-1")

    if mime == "application/json":
        try:
            parsed = json.loads(text)
            candidates = parsed if isinstance(parsed, list) else parsed.get("posts") or parsed.get("items") or [parsed]
            if isinstance(candidates, list):
                for obj in candidates:
                    if isinstance(obj, dict):
                        p = str(obj.get("platform", "Other")).strip() or "Other"
                        t = str(obj.get("text") or obj.get("post") or obj.get("content") or "").strip()
                        if t:
                            items.append({"platform": p, "text": t[:5000]})
                    elif isinstance(obj, str) and obj.strip():
                        items.append({"platform": "Other", "text": obj.strip()[:5000]})
                    if len(items) >= MAX_TABLE_ROWS:
                        warnings.append(f"Capped at {MAX_TABLE_ROWS} items.")
                        break
        except Exception as e:
            warnings.append(f"JSON parsing error: {str(e)}")
    else:  # .txt (one post per line)
        for line in text.splitlines():
            line = line.strip()
            if line:
                items.append({"platform": "Other", "text": line[:5000]})
            if len(items) >= MAX_TABLE_ROWS:
                warnings.append(f"Capped at {MAX_TABLE_ROWS} lines.")
                break

    return items, warnings


def extract_from_pdf(data: bytes, filename: str) -> Tuple[list[dict], list[str]]:
    warnings = []
    items = []
    try:
        reader = pypdf.PdfReader(io.BytesIO(data))
        for page_idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            # Split by double newline into distinct posts/paragraphs
            paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", page_text) if p.strip()]
            for para in paragraphs:
                if len(para) > 10:  # ignore tiny artifacts
                    items.append({"platform": "Other", "text": para[:5000]})
                if len(items) >= MAX_TABLE_ROWS:
                    warnings.append(f"Capped at {MAX_TABLE_ROWS} extracted passages.")
                    break
            if len(items) >= MAX_TABLE_ROWS:
                break
        if not items:
            warnings.append("No readable text found in PDF.")
    except Exception as e:
        warnings.append(f"Failed to extract PDF text: {str(e)}")

    return items, warnings


def process_uploaded_file(data: bytes, filename: str) -> dict:
    """Processes in-memory file bytes and returns {filename, type, items, warnings}."""
    if len(data) == 0:
        raise HTTPException(400, f"File '{filename}' is empty.")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(413, f"File '{filename}' exceeds the 5 MB limit.")

    category, mime = detect_file_type(data, filename)

    if category == "image":
        items, warnings = extract_from_image(data, filename)
    elif category == "table":
        items, warnings = extract_from_table(data, filename, mime)
    elif category == "pdf":
        items, warnings = extract_from_pdf(data, filename)
    else:  # text / json / txt
        items, warnings = extract_from_text(data, filename, mime)

    return {
        "filename": filename,
        "type": category,
        "items": items,
        "warnings": warnings,
    }
