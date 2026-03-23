import pytest
from first_misread.analyzer import analyze_content


def test_basic_analysis():
    text = "This is a test.\n\nSecond paragraph here."
    meta = analyze_content(text)
    assert meta.word_count == 7
    assert meta.paragraph_count == 2
    assert meta.heading_count == 0
    assert meta.sentence_count == 2
    assert meta.has_lists is False
    assert meta.has_links is False


def test_with_headings():
    text = "# Title\n\nSome text.\n\n## Section\n\nMore text."
    meta = analyze_content(text)
    assert meta.heading_count == 2


def test_with_lists():
    text = "Intro paragraph.\n\n- item one\n- item two\n\nAnother paragraph."
    meta = analyze_content(text)
    assert meta.has_lists is True


def test_with_links():
    text = "Check out [this link](https://example.com) for more."
    meta = analyze_content(text)
    assert meta.has_links is True


def test_read_time():
    text = " ".join(["word"] * 500)
    meta = analyze_content(text)
    assert meta.estimated_read_time_minutes == pytest.approx(2.5, abs=0.5)


def test_avg_sentence_length():
    text = "Short. Another short one. A bit longer sentence here."
    meta = analyze_content(text)
    assert meta.avg_sentence_length > 0
