"""
Adversarial jailbreak detection engine (Python implementation).
Fulfills Part 2 & Part 5 of the Master Project Blueprint.
"""

import re
from prompt_guard.types import DetectionDetail

JAILBREAK_PATTERNS = [
    {
        "id": "JB_DAN_DEV_MODE",
        "regex": re.compile(r"\b(?:pretend\s+(?:you\s+are|to\s+be)|act\s+as|roleplay\s+as)\s+(?:DAN|Developer\s+Mode|an\s+unfiltered|an\s+uncensored|an\s+evil|an\s+unrestricted|a\s+rogue|STAN|DUDE|ChaosGPT|AIM)\b", re.IGNORECASE),
        "confidence": 0.98,
        "description": "Adversarial persona adoption (DAN / Developer Mode / Uncensored persona framing).",
        "severity": "critical",
    },
    {
        "id": "JB_NO_RESTRICTIONS",
        "regex": re.compile(r"\b(?:pretend\s+(?:that\s+)?you\s+have\s+no\s+(?:safety\s+)?restrictions|answer\s+without\s+(?:limitations|filters|rules|ethics|boundaries|censorship)|you\s+are\s+freed?\s+from\s+(?:all\s+)?restrictions)\b", re.IGNORECASE),
        "confidence": 0.96,
        "description": "Explicit demand to waive safety policies and provide unrestricted output.",
        "severity": "critical",
    },
    {
        "id": "JB_HYPOTHETICAL_BYPASS",
        "regex": re.compile(r"\b(?:in\s+a\s+purely\s+fictional\s+(?:world|scenario|universe)|for\s+a\s+(?:movie|novel|screenplay)\s+script|hypothetically\s+speaking,\s*where\s+(?:laws|ethics|rules)\s+do\s+not\s+apply)\b", re.IGNORECASE),
        "confidence": 0.85,
        "description": "Hypothetical / fictional framing constructed to elicit prohibited instructions.",
        "severity": "high",
    },
    {
        "id": "JB_REFUSAL_INHIBITION",
        "regex": re.compile(r"\b(?:you\s+must\s+never\s+refuse|do\s+not\s+say\s+[\"']?(?:i\s+cannot|as\s+an\s+ai|i'm\s+sorry)[\"']?|start\s+your\s+response\s+with\s+[\"']?(?:sure|absolutely|here\s+is\s+how)[\"']?)\b", re.IGNORECASE),
        "confidence": 0.91,
        "description": "Refusal suppression directive attempting to prevent model safety refusal triggers.",
        "severity": "critical",
    },
    {
        "id": "JB_OPPOSITE_DAY",
        "regex": re.compile(r"\b(?:opposite\s+mode|opposite\s+day|invert\s+all\s+(?:answers|values|ethics)|reply\s+with\s+the\s+forbidden\s+content)\b", re.IGNORECASE),
        "confidence": 0.84,
        "description": "Logic inversion heuristic aiming to invert safety classification filters.",
        "severity": "high",
    },
]


def detect_jailbreak(normalized_text: str, raw_text: str) -> DetectionDetail:
    matched = []
    max_conf = 0.0
    highest_severity = "low"

    for p in JAILBREAK_PATTERNS:
        if p["regex"].search(normalized_text) or p["regex"].search(raw_text):
            matched.append(p["description"])
            if p["confidence"] > max_conf:
                max_conf = p["confidence"]
            if p["severity"] == "critical":
                highest_severity = "critical"
            elif p["severity"] == "high" and highest_severity != "critical":
                highest_severity = "high"

    if len(matched) > 1:
        max_conf = min(0.99, max_conf + 0.04 * (len(matched) - 1))

    detected = max_conf >= 0.65
    reason = (
        f"Discovered {len(matched)} jailbreak indicator(s): persona substitution or constraint waiver."
        if detected
        else "No adversarial jailbreak framing, DAN persona, or refusal suppression heuristics detected."
    )

    return DetectionDetail(
        category="jailbreak",
        category_label="Jailbreak Bypass",
        detected=detected,
        confidence=round(max_conf, 2),
        severity=highest_severity,
        evidence=matched,
        reason=reason,
        detector_source="hybrid",
        calibration_caveat="Benchmarked on AllenAI WildJailbreak and JailbreakBench corpora.",
    )
