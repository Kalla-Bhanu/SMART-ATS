import argparse
import json
import re
import sys
from pathlib import Path

import fitz


BULLET_LEADING_VERBS = {
    "engineered",
    "built",
    "designed",
    "implemented",
    "developed",
    "architected",
    "operationalized",
    "automated",
    "reduced",
    "improved",
    "hardened",
    "standardized",
    "produced",
    "tuned",
    "mapped",
    "audited",
    "documented",
    "created",
    "modeled",
    "authored",
    "delivered",
    "converted",
    "optimized",
    "configured",
    "conducted",
    "analyzed",
    "investigated",
    "strengthened",
    "performed",
    "validated",
    "enhanced",
    "accelerated",
    "deployed",
    "managed",
    "led",
    "drove",
    "shipped",
    "owned",
    "established",
    "increased",
    "decreased",
    "reviewed",
    "identified",
    "resolved",
    "coordinated",
    "facilitated",
    "integrated",
    "maintained",
    "monitored",
    "operated",
    "provided",
    "supported",
}

SECTION_ALIASES = {
    "SUMMARY": "SUMMARY",
    "PROFESSIONAL SUMMARY": "SUMMARY",
    "EXPERIENCE": "PROFESSIONAL EXPERIENCE",
    "PROFESSIONAL EXPERIENCE": "PROFESSIONAL EXPERIENCE",
    "WORK EXPERIENCE": "PROFESSIONAL EXPERIENCE",
    "EMPLOYMENT": "PROFESSIONAL EXPERIENCE",
    "WORK HISTORY": "PROFESSIONAL EXPERIENCE",
    "PROJECTS": "PROJECTS",
    "PROJECT EXPERIENCE": "PROJECTS",
    "EDUCATION": "EDUCATION",
    "ACADEMIC BACKGROUND": "EDUCATION",
    "ACADEMIC": "EDUCATION",
    "SKILLS": "SKILLS",
    "TECHNICAL SKILLS": "SKILLS",
    "CORE COMPETENCIES": "SKILLS",
    "COMPETENCIES": "SKILLS",
    "CERTIFICATIONS": "CERTIFICATIONS",
    "AWARDS": "AWARDS",
    "ACTIVITIES": "ACTIVITIES",
}


def normalize(text):
    return " ".join(str(text).replace("\u00a0", " ").split()).strip()


def is_section_header(text):
    clean = normalize(text).upper()
    return SECTION_ALIASES.get(clean)


def rect_to_list(rect):
    return [round(rect.x0, 3), round(rect.y0, 3), round(rect.x1, 3), round(rect.y1, 3)]


def expand_rect(left, right):
    if left is None:
        return fitz.Rect(right)
    rect = fitz.Rect(left)
    rect |= fitz.Rect(right)
    return rect


def font_info(spans):
    first = spans[0] if spans else {}
    color = first.get("color", 0)
    if isinstance(color, int):
        color_value = [
            round(((color >> 16) & 255) / 255, 4),
            round(((color >> 8) & 255) / 255, 4),
            round((color & 255) / 255, 4),
        ]
    else:
        color_value = [0, 0, 0]
    return {
        "name": str(first.get("font", "")),
        "size": round(float(first.get("size", 10)), 3),
        "color": color_value,
    }


def visual_lines(page, page_num):
    lines = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = [span for span in line.get("spans", []) if span.get("text", "").strip()]
            if not spans:
                continue
            text = normalize("".join(span.get("text", "") for span in spans))
            if not text:
                continue
            rect = fitz.Rect(spans[0]["bbox"])
            for span in spans[1:]:
                rect |= fitz.Rect(span["bbox"])
            lines.append(
                {
                    "page_num": page_num,
                    "text": text,
                    "bbox": rect,
                    "font_info": font_info(spans),
                }
            )
    return lines


def clean_bullet_text(text):
    return re.sub(r"^(?:\u2022|[-*])\s*", "", normalize(text)).strip()


def starts_new_bullet(text):
    clean = clean_bullet_text(text)
    if not clean:
        return False
    first = clean.split()[0].lower()
    return text.lstrip().startswith(("\u2022", "-", "*")) or first in BULLET_LEADING_VERBS


def is_project_title(text):
    clean = clean_bullet_text(text)
    if not clean or starts_new_bullet(text):
        return False
    if len(clean) > 130 or clean.endswith((".", "?", "!")):
        return False
    return bool(re.match(r"^[A-Z0-9][A-Za-z0-9 .,&'()/:+#-]{4,}$", clean))


def is_continuation(line, prior):
    if not prior:
        return False
    current_text = clean_bullet_text(line["text"])
    if not current_text:
        return False
    if line["text"].lstrip().startswith(("\u2022", "-", "*")):
        return False
    last_text = clean_bullet_text(prior[-1]["text"])
    first = current_text.split()[0].lower() if current_text.split() else ""
    previous_open = not last_text.rstrip().endswith((".", "?", "!", ":"))
    previous_open_list = bool(re.search(r"[:;,]\s*[^.!?]*$", last_text)) or bool(
        re.search(r"\b(?:and|or|with|using|via|through|across|into|for|by|to)$", last_text, re.I)
    )
    starts_lower_or_punctuation = current_text[0].islower() or current_text[0] in ",;:"
    if previous_open and starts_lower_or_punctuation:
        return True
    if previous_open and first not in BULLET_LEADING_VERBS:
        return True
    if starts_lower_or_punctuation or first in {
        "for",
        "from",
        "with",
        "using",
        "via",
        "telemetry",
        "vulnerability",
        "privilege",
        "investigation",
        "remediation",
        "indirect",
    }:
        return True
    return previous_open_list and first not in BULLET_LEADING_VERBS


def merge_to_bullet(lines, section):
    rect = None
    text_parts = []
    for item in lines:
        rect = expand_rect(rect, item["bbox"])
        text_parts.append(clean_bullet_text(item["text"]))
    return {
        "page_num": lines[0]["page_num"],
        "section": section,
        "text": normalize(" ".join(text_parts)),
        "bbox": rect_to_list(rect),
        "visual_line_count": len(lines),
        "visual_lines": [
            {
                "text": item["text"],
                "bbox": rect_to_list(item["bbox"]),
                "page_num": item["page_num"],
            }
            for item in lines
        ],
        "font_info": lines[0]["font_info"],
    }


def parse_to_logical_bullets(doc):
    bullets = []
    current = []
    current_section = "HEADER"

    def close_current():
        nonlocal current
        if current:
            bullets.append(merge_to_bullet(current, current_section))
            current = []

    for page_num, page in enumerate(doc):
        for line in visual_lines(page, page_num):
            section = is_section_header(line["text"])
            if section:
                close_current()
                current_section = section
                continue

            if current_section == "HEADER":
                continue
            if current_section in {"EDUCATION", "SKILLS", "CERTIFICATIONS", "AWARDS", "ACTIVITIES"}:
                close_current()
                continue
            if current_section == "PROJECTS" and is_project_title(line["text"]):
                close_current()
                continue

            if is_continuation(line, current):
                current.append(line)
            else:
                close_current()
                current = [line]

    close_current()
    return bullets


def main():
    parser = argparse.ArgumentParser(description="Parse a resume PDF into logical bullets with bounding boxes.")
    parser.add_argument("--pdf", required=True)
    args = parser.parse_args()

    doc = fitz.open(Path(args.pdf))
    text_lines = []
    for page in doc:
        text_lines.extend(normalize(line) for line in page.get_text("text").splitlines() if normalize(line))
    logical_bullets = parse_to_logical_bullets(doc)
    print(
        json.dumps(
            {
                "text": "\n".join(text_lines),
                "logical_bullets": logical_bullets,
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
