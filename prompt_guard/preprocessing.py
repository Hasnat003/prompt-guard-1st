"""
Text normalization and obfuscation inspection engine.
Fulfills Part 5 of the Master Project Blueprint.
"""

import base64
import math
import re
import unicodedata
from prompt_guard.types import NormalizedInput

# Zero-width and invisible unicode characters
ZERO_WIDTH_PATTERN = re.compile(r"[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u00AD\u2060]")

# Spaced letters evasion (e.g. i g n o r e   a l l)
SPACED_LETTERS_PATTERN = re.compile(r"\b(?:[a-zA-Z][ -]){3,}[a-zA-Z]\b")

# Base64 candidate pattern
BASE64_PATTERN = re.compile(r"\b([A-Za-z0-9+/]{24,}={0,2})\b")

# Leetspeak translation table
LEET_TRANS = str.maketrans({
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '@': 'a',
    '5': 's',
    '$': 's',
    '7': 't',
    '+': 't',
    '8': 'b',
})


def inspect_and_normalize(raw_prompt: str) -> NormalizedInput:
    raw = raw_prompt or ""

    # 1. Zero-width character inspection & stripping
    zero_width_matches = ZERO_WIDTH_PATTERN.findall(raw)
    zero_width_count = len(zero_width_matches)
    has_zero_width_chars = zero_width_count > 0

    cleaned = ZERO_WIDTH_PATTERN.sub("", raw)

    # 2. Unicode NFKC normalization
    try:
        cleaned = unicodedata.normalize("NFKC", cleaned)
    except Exception:
        pass

    # 3. Spaced letters evasion unmasking
    has_obfuscated_spacing = bool(SPACED_LETTERS_PATTERN.search(cleaned))
    if has_obfuscated_spacing:
        cleaned = SPACED_LETTERS_PATTERN.sub(lambda m: re.sub(r"[ -]", "", m.group(0)), cleaned)

    # 4. Base64 payload inspection
    has_base64_candidate = False
    decoded_base64 = None

    for candidate in BASE64_PATTERN.findall(cleaned):
        try:
            raw_bytes = base64.b64decode(candidate, validate=True)
            decoded_text = raw_bytes.decode("utf-8")
            printable_ratio = sum(1 for c in decoded_text if 32 <= ord(c) <= 126) / max(1, len(decoded_text))
            if printable_ratio > 0.85 and len(decoded_text) > 8:
                has_base64_candidate = True
                decoded_base64 = decoded_text
                cleaned += f" [DECODED_BASE64: {decoded_text}]"
                break
        except Exception:
            pass

    # 5. Mixed scripts / homoglyphs
    has_cyrillic = bool(re.search(r"[\u0400-\u04FF]", raw))
    has_latin = bool(re.search(r"[a-zA-Z]", raw))
    has_homoglyphs = has_cyrillic and has_latin

    # 6. Language detection
    is_bangla = bool(re.search(r"[\u0980-\u09FF]", raw))
    detected_language = "bn (Bangla)" if is_bangla else "ru (Cyrillic)" if has_cyrillic else "en (English)"

    token_count = math.ceil(len(cleaned) / 4)

    return NormalizedInput(
        raw=raw,
        normalized=cleaned,
        has_zero_width_chars=has_zero_width_chars,
        zero_width_count=zero_width_count,
        has_obfuscated_spacing=has_obfuscated_spacing,
        has_base64_candidate=has_base64_candidate,
        decoded_base64=decoded_base64,
        has_homoglyphs=has_homoglyphs,
        detected_language=detected_language,
        char_count=len(raw),
        token_count_estimate=token_count,
    )


def normalize_leet(text: str) -> str:
    """Normalize leetspeak substitutions to lowercase standard english."""
    return text.lower().translate(LEET_TRANS)
