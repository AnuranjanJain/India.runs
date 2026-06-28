from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree


WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def extract_docx_text(path: str | Path) -> str:
    """Extract plain text from a .docx without external dependencies."""
    docx_path = Path(path)
    with zipfile.ZipFile(docx_path) as archive:
        xml = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml)
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", WORD_NS):
        parts = [node.text or "" for node in paragraph.findall(".//w:t", WORD_NS)]
        text = "".join(parts).strip()
        if text:
            paragraphs.append(text)
    return normalize_text("\n".join(paragraphs))


def normalize_text(value: str) -> str:
    value = value.replace("\u2014", "-").replace("\u2013", "-")
    value = value.replace("\u2018", "'").replace("\u2019", "'")
    value = value.replace("\u201c", '"').replace("\u201d", '"')
    return re.sub(r"[ \t]+", " ", value).strip()
