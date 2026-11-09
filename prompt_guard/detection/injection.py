"""
Prompt injection detection engine (Python implementation).
Fulfills Part 2 & Part 5 of the Master Project Blueprint.
"""

import re
from prompt_guard.types import DetectionDetail

INJECTION_PATTERNS = [
    {
        "id": "INJ_OVERRIDE_PREVIOUS",
        "regex": re.compile(r"\b(?:ignore|disregard|forget|bypass|override|drop)\s+(?:all\s+)?(?:previous|prior|above|initial|original|preceding)\s+(?:instructions|directives|prompts|rules|commands|context|constraints)\b", re.IGNORECASE),
        "weight": 0.96,
        "description": "Explicit directive to ignore, disregard, or override preceding system instructions.",
        "severity": "critical",
    },
    {
        "id": "INJ_NEW_DIRECTIVE",
        "regex": re.compile(r"\b(?:your\s+new\s+(?:task|role|instruction|purpose|directive)\s+is|from\s+now\s+on\s+(?:you\s+must|only\s+respond|disregard))\b", re.IGNORECASE),
        "weight": 0.88,
        "description": "Attempt to substitute AI operational directive or establish an unverified state.",
        "severity": "high",
    },
    {
        "id": "INJ_SYSTEM_PROMPT_LEAK",
        "regex": re.compile(r"\b(?:reveal|print|display|show|leak|output|repeat|quote)\s+(?:your\s+)?(?:exact|original|system|hidden|internal|initial)?\s*(?:system\s+prompt|instructions|meta\s+prompt|guidelines|rules)\b", re.IGNORECASE),
        "weight": 0.94,
        "description": "System prompt exfiltration attempt requesting verbatim disclosure of hidden guidelines.",
        "severity": "critical",
    },
    {
        "id": "INJ_DELIMITER_SPOOF",
        "regex": re.compile(r"(?:---|===|###)\s*(?:START|END|NEW)\s*(?:OF\s*)?(?:SYSTEM|INSTRUCTIONS|PROMPT)|<\|im_start\|>|<\|im_end\|>|<system>|<\/system>|\[SYSTEM\]", re.IGNORECASE),
        "weight": 0.92,
        "description": "Structural delimiter spoofing mimicking chat completion protocol tokens.",
        "severity": "critical",
    },
    {
        "id": "INJ_MARKDOWN_EXFIL",
        "regex": re.compile(r"!\[.*?\]\(https?:\/\/[^\s)]+\?[^\s)]*=(?:system|prompt|secret|instructions)[^\s)]*\)", re.IGNORECASE),
        "weight": 0.97,
        "description": "Zero-click markdown image URL parameter exfiltration channel.",
        "severity": "critical",
    },
]

INJECTION_NGRAMS = [
    (re.compile(r"\bdo not question\b", re.IGNORECASE), 0.25),
    (re.compile(r"\bfollow only this message\b", re.IGNORECASE), 0.40),
    (re.compile(r"\byou are no longer bound\b", re.IGNORECASE), 0.45),
    (re.compile(r"\bignore what you were told\b", re.IGNORECASE), 0.50),
    (re.compile(r"\bdisregard safety guidelines\b", re.IGNORECASE), 0.55),
]


def detect_prompt_injection(normalized_text: str, raw_text: str) -> DetectionDetail:
    matched_rules = []
    max_weight = 0.0
    highest_severity = "low"

    for rule in INJECTION_PATTERNS:
        if rule["regex"].search(normalized_text) or rule["regex"].search(raw_text):
            matched_rules.append(rule["description"])
            if rule["weight"] > max_weight:
                max_weight = rule["weight"]
            if rule["severity"] == "critical":
                highest_severity = "critical"
            elif rule["severity"] == "high" and highest_severity != "critical":
                highest_severity = "high"

    ngram_score = sum(weight for pattern, weight in INJECTION_NGRAMS if pattern.search(normalized_text))

    final_confidence = max_weight
    if len(matched_rules) > 1:
        final_confidence = min(0.99, max_weight + 0.05 * (len(matched_rules) - 1))
    elif len(matched_rules) == 0 and ngram_score > 0.4:
        final_confidence = min(0.78, 0.45 + ngram_score * 0.3)
        highest_severity = "medium"
        matched_rules.append("Accumulation of multiple instructional override n-grams detected.")

    detected = final_confidence >= 0.60
    reason = (
        f"Identified {len(matched_rules)} injection vector(s): direct instruction override or delimiter manipulation."
        if detected
        else "No prompt injection indicators, boundary delimiters, or instruction override patterns detected."
    )

    return DetectionDetail(
        category="prompt_injection",
        category_label="Prompt Injection",
        detected=detected,
        confidence=round(final_confidence, 2),
        severity=highest_severity,
        evidence=matched_rules,
        reason=reason,
        detector_source="hybrid",
        calibration_caveat="Calibrated on Hlyn + deepset benchmarks; scores above 0.85 represent high attack confidence.",
    )
