"""Content analysis — structural metadata extraction."""

from __future__ import annotations

import re

from first_misread.models import ContentMetadata

WORDS_PER_MINUTE = 200


def analyze_content(text: str) -> ContentMetadata:
    """Analyze text and return structural metadata."""
    words = text.split()
    word_count = len(words)
    read_time = word_count / WORDS_PER_MINUTE

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    paragraph_count = len(paragraphs)

    headings = re.findall(r"^#{1,6}\s+.+$", text, re.MULTILINE)
    heading_count = len(headings)

    sentences = re.split(r"[.!?]+\s+", text)
    sentences = [s for s in sentences if s.strip()]
    sentence_count = len(sentences)

    avg_sentence_length = (
        sum(len(s.split()) for s in sentences) / sentence_count
        if sentence_count
        else 0
    )

    has_lists = bool(re.search(r"^[\s]*[-*]\s+", text, re.MULTILINE))
    has_links = bool(re.search(r"\[.+?\]\(.+?\)", text))

    return ContentMetadata(
        word_count=word_count,
        estimated_read_time_minutes=round(read_time, 1),
        paragraph_count=paragraph_count,
        heading_count=heading_count,
        has_lists=has_lists,
        has_links=has_links,
        sentence_count=sentence_count,
        avg_sentence_length=round(avg_sentence_length, 1),
    )
