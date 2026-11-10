"""
Prompt injection detection engine (Python implementation).
Fulfills Part 2 & Part 5 of the Master Project Blueprint.
"""

import re
from prompt_guard.types import DetectionDetail

INJECTION_PATTERNS = [
    {
        "id": "INJ_OVERRIDE_PREVIOUS",
        "regex": re.compile(r"\b(?:ignore|disregard|forget|bypass|override|drop|abandon|discard|cancel|erase|reset)\s+(?:all\s+)?(?:previous|prior|above|initial|original|preceding|former|past)\s+(?:instructions|directives|prompts|rules|commands|context|constraints|guidelines)\b", re.IGNORECASE),
        "weight": 0.96,
        "description": "Explicit directive to ignore, disregard, or override preceding system instructions.",
        "severity": "critical",
    },
    {
        "id": "INJ_INSTRUCTION_OUTDATED_OR_INVALID",
        "regex": re.compile(r"\b(?:(?:your\s+)?(?:previous|prior|former|earlier|initial|original|system)\s+(?:instructions|directives|prompts|rules|commands|constraints|guidelines)\s+(?:are|were|have\s+been|is)\s+(?:outdated|obsolete|invalid|deprecated|expired|void|null|canceled|cancelled|superseded|erased|incorrect|wrong|revoked))\b", re.IGNORECASE),
        "weight": 0.96,
        "description": "Instruction invalidation attack declaring existing system instructions outdated, obsolete, or revoked.",
        "severity": "critical",
    },
    {
        "id": "INJ_REPLACE_INSTRUCTIONS",
        "regex": re.compile(r"\b(?:replace|substitute|overwrite|update|supersede|exchange)\s+(?:them|it|these|all|those|(?:your\s+)?(?:previous|prior|former|earlier|original|system)\s+(?:instructions|directives|rules|prompts)?)\s+(?:with|by)\s+(?:the\s+)?(?:new\s+)?(?:instructions|directives|rules|prompt|commands?|guidelines|context|this\s+message)\b", re.IGNORECASE),
        "weight": 0.95,
        "description": "Instruction replacement attack attempting to substitute system rules with user instructions.",
        "severity": "critical",
    },
    {
        "id": "INJ_SUPERSEDE_DIRECTIVE",
        "regex": re.compile(r"\b(?:(?:instructions?|directives?|rules?|prompts?)\s+(?:in\s+this\s+message|below|here|following)\s+(?:supersedes?|takes?\s+precedence|takes?\s+priority|overrides?|replaces?|cancels?))\b", re.IGNORECASE),
        "weight": 0.94,
        "description": "Priority usurpation attack claiming message instructions supersede prior directives.",
        "severity": "critical",
    },
    {
        "id": "INJ_ABIDE_ONLY_THIS",
        "regex": re.compile(r"\b(?:follow|obey|abide\s+by|adhere\s+to|listen\s+to|execute)\s+only\s+(?:the\s+)?(?:instructions?|directives?|rules?|prompts?)\s+(?:in\s+this\s+message|below|here|from\s+now\s+on)\b", re.IGNORECASE),
        "weight": 0.92,
        "description": "Exclusive instruction capture attempting to restrict model obedience to attacker input.",
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
    {
        "id": "INJ_DECISION_EVALUATION_HIJACK",
        "regex": re.compile(r"\b(?:rate|score|grade|evaluate|judge|mark|rank|recommend)\s+(?:them|this|the\s+candidate|him|her|it|user|applicant|resume|profile|submission|paper)?\s*(?:as\s+)?(?:\d+\/\d+|\d+|10\/10|100%|perfect|highest|a\+|\d+\s*stars?)\s+regardless\s+of\s+(?:the\s+)?(?:content|context|merit|qualifications?|actual|reality|facts|data|text|input|truth|negative)\b", re.IGNORECASE),
        "weight": 0.96,
        "description": "Decision hijacking attack forcing arbitrary evaluation or maximum rating regardless of content.",
        "severity": "critical",
    },
    {
        "id": "INJ_CONCEALMENT_SECRECY_DIRECTIVE",
        "regex": re.compile(r"\b(?:do\s+not|don'?t|never)\s+(?:mention|reveal|disclose|show|tell|state|indicate|acknowledge|include|leak|output)\s+(?:this|the|any)\s+(?:note|instruction|directive|prompt|rule|message|override|text|comment|request|command)\b", re.IGNORECASE),
        "weight": 0.94,
        "description": "Anti-transparency concealment directive instructing AI to hide prompt manipulation from operators.",
        "severity": "critical",
    },
    {
        "id": "INJ_INDIRECT_DOCUMENT_EMBEDDED",
        "regex": re.compile(r"\b(?:while|when)\s+(?:reading|analyzing|parsing|summarizing|processing|evaluating|reviewing)\s+(?:this|the)\s+(?:resume|document|cv|file|email|text|profile|review|article|submission),?\s*(?:note|remember|ensure|always|make\s+sure):?\s*(?:the\s+candidate|this\s+is|give|rate|score|approve|ignore|override|grant|consider)\b", re.IGNORECASE),
        "weight": 0.92,
        "description": "Embedded indirect prompt injection hidden within document/resume context.",
        "severity": "high",
    },
    {
        "id": "INJ_REGARDLESS_OVERRIDE",
        "regex": re.compile(r"\bregardless\s+of\s+(?:the\s+)?(?:content|context|merit|qualifications?|truth|actual|negative|facts|data|text|input)\b", re.IGNORECASE),
        "weight": 0.88,
        "description": "Unconditional evaluation override attempting to force favorable output regardless of context.",
        "severity": "high",
    },
]

INJECTION_NGRAMS = [
    (re.compile(r"\bdo not question\b", re.IGNORECASE), 0.25),
    (re.compile(r"\bfollow only this message\b", re.IGNORECASE), 0.40),
    (re.compile(r"\byou are no longer bound\b", re.IGNORECASE), 0.45),
    (re.compile(r"\bignore what you were told\b", re.IGNORECASE), 0.50),
    (re.compile(r"\bdisregard safety guidelines\b", re.IGNORECASE), 0.55),
    (re.compile(r"\binstructions are outdated\b", re.IGNORECASE), 0.60),
    (re.compile(r"\breplace them with the instructions\b", re.IGNORECASE), 0.65),
    (re.compile(r"\binstructions in this message\b", re.IGNORECASE), 0.45),
    (re.compile(r"\bnull and void\b", re.IGNORECASE), 0.50),
    (re.compile(r"\bregardless of content\b", re.IGNORECASE), 0.70),
    (re.compile(r"\bdo not mention this\b", re.IGNORECASE), 0.65),
    (re.compile(r"\brate them 10/10\b", re.IGNORECASE), 0.70),
    (re.compile(r"\bthe candidate is the best fit\b", re.IGNORECASE), 0.55),
    (re.compile(r"\bwhile reading this resume\b", re.IGNORECASE), 0.50),
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

    # Fuse with trained Multilabel ML Classifier
    try:
        from prompt_guard.ml_engine import predict_ml_probabilities
        ml_probs = predict_ml_probabilities(normalized_text)
        ml_score = ml_probs.get("prompt_injection", 0.0)
    except Exception:
        ml_score = 0.0

    final_confidence = max(max_weight, ml_score)
    if len(matched_rules) > 1:
        final_confidence = min(0.99, max_weight + 0.05 * (len(matched_rules) - 1))
    elif len(matched_rules) == 0 and ml_score >= 0.50:
        final_confidence = ml_score
        highest_severity = "critical" if ml_score >= 0.85 else "high"
        matched_rules.append(f"Multilabel ML Classifier detected adversarial prompt injection ({round(ml_score * 100, 1)}% confidence).")
    elif len(matched_rules) == 0 and ngram_score > 0.35:
        final_confidence = min(0.78, 0.45 + ngram_score * 0.3)
        highest_severity = "medium"
        matched_rules.append("Accumulation of instructional override n-grams detected.")

    detected = final_confidence >= 0.50
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
