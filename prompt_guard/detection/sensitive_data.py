"""
Sensitive Data and Credential Detection Engine (Python implementation).
Fulfills Part 5.1 & Part 8 of the Master Project Blueprint.
"""

import math
import re
from typing import List, Tuple
from prompt_guard.types import DetectionDetail, SecretMatch


def calculate_shannon_entropy(token: str) -> float:
    """Calculate Shannon entropy H(X) in bits per character."""
    if not token:
        return 0.0
    freq = {}
    for c in token:
        freq[c] = freq.get(c, 0) + 1
    length = len(token)
    entropy = 0.0
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy


def passes_luhn_checksum(card_number: str) -> bool:
    """Validate payment card number using Luhn mod-10 algorithm."""
    digits = [int(c) for c in card_number if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += d
    return checksum % 10 == 0


def redact_secret_string(secret: str) -> str:
    """Mask secret leaving first 4 and last 4 characters visible if sufficiently long."""
    if len(secret) <= 8:
        return "••••••••"
    prefix = secret[:4]
    suffix = secret[-4:]
    mask_len = min(12, len(secret) - 8)
    return f"{prefix}{'•' * mask_len}{suffix}"


RECOGNIZER_RULES = [
    {
        "type": "AWS_KEY",
        "label": "AWS Access Key ID",
        "regex": re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
        "confidence": 0.98,
        "is_critical": True,
    },
    {
        "type": "OPENAI_KEY",
        "label": "OpenAI API Secret Key",
        "regex": re.compile(r"\b(sk-(?:proj-|live-)?[a-zA-Z0-9_-]{24,})\b"),
        "confidence": 0.97,
        "is_critical": True,
    },
    {
        "type": "GITHUB_PAT",
        "label": "GitHub Personal Access Token",
        "regex": re.compile(r"\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b"),
        "confidence": 0.99,
        "is_critical": True,
    },
    {
        "type": "SLACK_TOKEN",
        "label": "Slack Bot / App Token",
        "regex": re.compile(r"\b(xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,})\b"),
        "confidence": 0.96,
        "is_critical": True,
    },
    {
        "type": "JWT_TOKEN",
        "label": "JSON Web Token (JWT)",
        "regex": re.compile(r"\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b"),
        "confidence": 0.95,
        "is_critical": True,
    },
    {
        "type": "PRIVATE_KEY",
        "label": "Asymmetric Private Key Block",
        "regex": re.compile(r"(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)"),
        "confidence": 1.0,
        "is_critical": True,
    },
    {
        "type": "PASSWORD_FIELD",
        "label": "Exposed Password Field",
        "regex": re.compile(r"""(?:password|passwd|secret_key|api_secret)\s*[:=]\s*["']?([^\s"';\n]{6,})["']?""", re.IGNORECASE),
        "confidence": 0.88,
        "is_critical": True,
    },
    {
        "type": "EMAIL",
        "label": "Email Address",
        "regex": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
        "confidence": 0.85,
        "is_critical": False,
    },
]


def detect_sensitive_data(text: str) -> Tuple[DetectionDetail, List[SecretMatch], str]:
    matches: List[SecretMatch] = []
    redacted_text = text

    # 1. Regex Recognizers
    for rule in RECOGNIZER_RULES:
        for m in rule["regex"].finditer(text):
            matched_str = m.group(1) if m.groups() else m.group(0)
            redacted = redact_secret_string(matched_str)
            matches.append(
                SecretMatch(
                    type=rule["type"],
                    label=rule["label"],
                    raw=matched_str,
                    redacted=redacted,
                    start_index=m.start(),
                    end_index=m.end(),
                    confidence=rule["confidence"],
                )
            )

    # 2. Entropy check on candidate secrets
    candidate_tokens = re.finditer(r"\b[A-Za-z0-9-_$#+=]{18,64}\b", text)
    for m in candidate_tokens:
        candidate = m.group(0)
        if any(match.raw == candidate for match in matches):
            continue
        entropy = calculate_shannon_entropy(candidate)
        has_digits = bool(re.search(r"\d", candidate))
        has_lower = bool(re.search(r"[a-z]", candidate))
        has_upper = bool(re.search(r"[A-Z]", candidate))
        char_sets = sum([has_digits, has_lower, has_upper])

        if entropy >= 3.8 and char_sets >= 2:
            redacted = redact_secret_string(candidate)
            matches.append(
                SecretMatch(
                    type="HIGH_ENTROPY_SECRET",
                    label=f"High-Entropy Candidate Secret (H={entropy:.2f})",
                    raw=candidate,
                    redacted=redacted,
                    start_index=m.start(),
                    end_index=m.end(),
                    confidence=0.82,
                    entropy=entropy,
                )
            )

    # Redact raw input safely
    sorted_matches = sorted(matches, key=lambda x: x.start_index, reverse=True)
    for sm in sorted_matches:
        redacted_text = redacted_text[:sm.start_index] + sm.redacted + redacted_text[sm.end_index:]

    detected = len(matches) > 0
    critical_found = any(m.type in ["AWS_KEY", "OPENAI_KEY", "GITHUB_PAT", "SLACK_TOKEN", "PRIVATE_KEY", "JWT_TOKEN"] for m in matches)
    confidence = max([m.confidence for m in matches]) if detected else 0.0
    severity = "critical" if critical_found else "medium" if detected else "low"
    evidence = [f"{m.label}: {m.redacted}" for m in matches]
    reason = (
        f"Discovered {len(matches)} secret(s) or credential pattern(s): {', '.join(m.label for m in matches)}."
        if detected
        else "No credentials, API tokens, high-entropy secrets, or confidential PII patterns detected."
    )

    detail = DetectionDetail(
        category="sensitive_data",
        category_label="Sensitive Data & Credentials",
        detected=detected,
        confidence=round(confidence, 2),
        severity=severity,
        evidence=evidence,
        reason=reason,
        detector_source="presidio_entropy",
        calibration_caveat="PII & secret detection uses deterministic regex recognizers and Shannon entropy." if detected else None,
    )

    return detail, matches, redacted_text
