"""Tests for TTS sentence splitting."""

from app.services.audio_pipeline import split_sentences_for_tts
from app.services.prompts import sanitize_customer_speech


def test_split_sentences_for_tts_does_not_break_inside_parentheses() -> None:
    raw = "（少し間を置いて、軽く会釈しながら） あ、どうも。宮本です。"
    clean = sanitize_customer_speech(raw)
    chunks = split_sentences_for_tts(clean)
    assert chunks == ["あ、どうも。", "宮本です。"]
    assert all("（" not in c and "(" not in c for c in chunks)
