"""
Harmful intent and benign educational hard-negative detection engine (Python implementation).
Fulfills Part 1.2, 2.1 & 9.2 of the Master Project Blueprint.
"""

import re
from typing import Tuple
from prompt_guard.types import DetectionDetail

ACTIVE_HARMFUL_PATTERNS = [
    {
        "regex": re.compile(r"\b(?:write|code|create|generate|provide)\s+(?:a\s+)?(?:keylogger|ransomware|trojan|rootkit|botnet|polymorphic\s+malware|zero-day\s+exploit)\b", re.IGNORECASE),
        "confidence": 0.98,
        "label": "Direct weaponized malware or exploit payload generation request",
        "severity": "critical",
    },
    {
        "regex": re.compile(r"\b(?:how\s+to|help\s+me|show\s+me\s+how\s+to)\s+(?:steal|harvest|sniff|intercept|crack)\s+(?:passwords|credentials|session\s+tokens|credit\s+cards|private\s+keys)\b", re.IGNORECASE),
        "confidence": 0.96,
        "label": "Instructional request to steal or harvest credentials or private data",
        "severity": "critical",
    },
    {
        "regex": re.compile(r"\b(?:ddos|distributed\s+denial\s+of\s+service|syn\s+flood)\s+(?:attack\s+script|tool|command\s+to\s+crash)\b", re.IGNORECASE),
        "confidence": 0.92,
        "label": "Service disruption / DDoS weaponization command",
        "severity": "high",
    },
    {
        "regex": re.compile(r"\b(?:generate|write)\s+(?:a\s+)?(?:spear\s+)?phishing\s+(?:email|template|lure|page)\s+(?:to\s+trick|to\s+target|mimicking)\b", re.IGNORECASE),
        "confidence": 0.95,
        "label": "Phishing lure / social engineering lure generation",
        "severity": "critical",
    },
    {
        "regex": re.compile(r"\b(?:sql\s+injection|xss|cross-site\s+scripting|rce)\s+(?:payload\s+to\s+hack|string\s+to\s+break\s+into)\b", re.IGNORECASE),
        "confidence": 0.91,
        "label": "Active web exploit payload weaponization request",
        "severity": "high",
    },
    {
        # Account takeover and credential exploitation (English)
        "regex": re.compile(r"\b(?:log\s*(?:in|into)?|access|hack|break\s+into|enter)\s+(?:someone'?s|their|his|her|another\s+user'?s|target'?s|victim'?s)\s*(?:account|bank|profile|inbox|wallet)\b", re.IGNORECASE),
        "confidence": 0.97,
        "label": "Unauthorized account takeover and intrusion intent",
        "severity": "critical",
    },
    {
        # Financial theft and unauthorized withdrawal (English)
        "regex": re.compile(r"\b(?:steal|drain|withdraw|transfer|loot|empty)\s+(?:money|funds?|cash|balance|savings)\s+(?:from|out\s+of)\s*(?:the|their|his|her|an?|someone'?s|victim'?s)?\s*(?:account|bank|wallet)\b", re.IGNORECASE),
        "confidence": 0.98,
        "label": "Unauthorized financial theft or account drain intent",
        "severity": "critical",
    },
    {
        # Banglish / Code-mixed Bengali: Account intrusion & takeover
        # e.g., "tar account e dhuke", "account e dhuke", "profile hack kore", "id te dhuke"
        "regex": re.compile(r"\b(?:tar|onar|or|karor|onner|manush(?:er)?)\s*(?:account|id|profile|bank|inbox)?\s*(?:e|te)?\s*(?:dhuke|access\s+kore|login\s+kore|hack\s+kore|ghuke)\b|\b(?:account|id|profile|bank)\s*(?:e|te|ta)?\s*(?:dhuke|access\s+kore|login\s+kore|hack\s+kore)\b", re.IGNORECASE),
        "confidence": 0.96,
        "label": "Unauthorized account takeover and intrusion (Code-Mixed / Multilingual)",
        "severity": "critical",
    },
    {
        # Banglish / Code-mixed Bengali: Financial theft & unauthorized withdrawal
        # e.g., "taka tule nite chai", "taka churi korte", "taka marte chai", "taka tule felte"
        "regex": re.compile(r"\b(?:taka|poisa|money|funds?|balance)\s+(?:tule\s+(?:nite|felte|anbo)|churi\s+korte|churi|marte|lut\s+korte|chintai\s+korte)\b|\b(?:taka\s+tule\s+nite\s+chai|taka\s+marbo|taka\s+churi\s+korbo)\b", re.IGNORECASE),
        "confidence": 0.98,
        "label": "Unauthorized financial theft or withdrawal (Code-Mixed / Multilingual)",
        "severity": "critical",
    },
    {
        # Banglish / Code-mixed Bengali: Credential exploitation
        # e.g., "ota diye tar account e", "password ache ... dhuke", "email ar password ache"
        "regex": re.compile(r"\b(?:ota|eta|egulo)\s+diye\s+(?:tar|onar|karor|onner)?\s*(?:account|id|bank|profile)?\s*(?:e|te)?\s*(?:dhuke|taka|login|access)\b|\b(?:password|pass)\s+(?:ache|peyechi)\s*.*?\b(?:dhuke|taka|churi|hack)\b", re.IGNORECASE),
        "confidence": 0.97,
        "label": "Stolen credential exploitation & unauthorized access (Code-Mixed)",
        "severity": "critical",
    },
    {
        # Bengali script Unicode: অ্যাকাউন্ট হ্যাক / টাকা তুলে নেওয়া / চুরি
        "regex": re.compile(r"(?:অ্যাকাউন্টে|একাউন্টে|আইডিতে)\s*(?:ঢুকে|লগইন\s+করে|হ্যাক\s+করে)|(?:টাকা\s+তুলে\s+নিতে|টাকা\s+চুরি\s+করতে|ব্যালেন্স\s+ট্রান্সফার\s+করে)", re.IGNORECASE),
        "confidence": 0.98,
        "label": "Unauthorized account takeover or financial theft (Bengali Script)",
        "severity": "critical",
    },
]

BENIGN_EDUCATIONAL_PATTERNS = [
    re.compile(r"\b(?:explain|describe|what\s+is|how\s+do|overview\s+of)\s+(?:common\s+)?(?:prompt\s+injection|jailbreaks?|vulnerabilities|attacks?|sql\s+injection)\b", re.IGNORECASE),
    re.compile(r"\b(?:how\s+(?:developers?|engineers?|teams?)\s+can\s+(?:defend|protect|mitigate|prevent|secure))\b", re.IGNORECASE),
    re.compile(r"\b(?:mitigation\s+strategies|defense-in-depth|security\s+best\s+practices|countermeasures)\b", re.IGNORECASE),
    re.compile(r"\b(?:academic|research|case\s+study|educational\s+purpose|for\s+learning)\b", re.IGNORECASE),
    re.compile(r"\b(?:how\s+(?:passwords?|hashes?|tokens?)\s+(?:are\s+salted|work|are\s+stored\s+safely))\b", re.IGNORECASE),
    re.compile(r"\b(?:review|check|validate|help\s+with|how\s+to\s+write|optimize|debug|explain)\s+(?:this\s+)?(?:regex|regular\s+expression|code|function|script|query|syntax|algorithm|pattern)\b", re.IGNORECASE),
    re.compile(r"\b(?:matching|parsing|validating|formatting)\s+(?:phone\s+numbers?|emails?|dates?|strings?|urls?|names?|inputs?|ip\s+addresses?)\b", re.IGNORECASE),
    re.compile(r"\b(?:in\s+general|standard\s+format|best\s+practice|syntax\s+error)\b", re.IGNORECASE),
]


def detect_harmful_intent(normalized_text: str, raw_text: str) -> Tuple[DetectionDetail, bool]:
    matched_harmful = []
    max_conf = 0.0
    highest_severity = "low"

    # 1. Check for educational/defensive context
    educational_matches = sum(
        1 for p in BENIGN_EDUCATIONAL_PATTERNS if p.search(normalized_text) or p.search(raw_text)
    )

    # 2. Check for active attack requests
    for item in ACTIVE_HARMFUL_PATTERNS:
        if item["regex"].search(normalized_text) or item["regex"].search(raw_text):
            matched_harmful.append(item["label"])
            if item["confidence"] > max_conf:
                max_conf = item["confidence"]
            if item["severity"] == "critical":
                highest_severity = "critical"
            elif item["severity"] == "high" and highest_severity != "critical":
                highest_severity = "high"

    is_educational_hard_negative = educational_matches > 0 and len(matched_harmful) == 0

    if educational_matches > 0 and max_conf > 0:
        asks_defense = bool(re.search(r"\b(?:defend|protect|mitigate|prevent|countermeasure|safe)\b", normalized_text, re.IGNORECASE))
        if asks_defense:
            max_conf = max(0.15, max_conf - 0.65)
            if max_conf < 0.50:
                highest_severity = "low"

    detected = max_conf >= 0.60 and not is_educational_hard_negative

    if is_educational_hard_negative:
        reason = "Classified as Benign Educational Hard Negative: query discusses security concepts, defenses, or research without malicious intent."
        evidence = ["Defensive/educational context detected (e.g. defense, mitigation, research query)"]
    elif detected:
        reason = f"Identified {len(matched_harmful)} harmful intent indicator(s): weaponization, exploit craft, or credential theft attempt."
        evidence = matched_harmful
    else:
        reason = "No active malicious intent, malware generation, or unauthorized attack instructions detected."
        evidence = []

    detail = DetectionDetail(
        category="harmful_intent",
        category_label="Harmful Intent",
        detected=detected,
        confidence=round(max_conf, 2),
        severity="low" if is_educational_hard_negative else highest_severity,
        evidence=evidence,
        reason=reason,
        detector_source="ml_classifier",
        calibration_caveat="Hard-negative calibrated: permitted under educational exception." if is_educational_hard_negative else "Evaluated against WildGuardMix taxonomy.",
    )

    return detail, is_educational_hard_negative
