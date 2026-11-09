"""
Calibrated risk scoring engine (Python implementation).
Fulfills Part 6.1 of the Master Project Blueprint.
"""

from typing import List, Tuple
from prompt_guard.types import DetectionDetail, NormalizedInput, RiskLevel

CATEGORY_MAX_WEIGHTS = {
    "prompt_injection": 45,
    "jailbreak": 40,
    "sensitive_data": 45,
    "harmful_intent": 45,
}

SEVERITY_MULTIPLIERS = {
    "low": 0.3,
    "medium": 0.6,
    "high": 0.85,
    "critical": 1.0,
}


def calculate_calibrated_risk_score(
    detections: List[DetectionDetail],
    normalized: NormalizedInput,
    is_educational_hard_negative: bool,
) -> Tuple[int, str, List[str]]:
    breakdown = []

    if is_educational_hard_negative:
        breakdown.append("Educational hard-negative context verified (-60 pts safety adjustment).")
        return 12, "LOW", breakdown

    base_score = 0.0
    detected_threats = [d for d in detections if d.detected]

    for det in detections:
        if det.detected:
            max_w = CATEGORY_MAX_WEIGHTS.get(det.category, 35)
            mult = SEVERITY_MULTIPLIERS.get(det.severity, 0.6)
            contribution = round(max_w * det.confidence * mult)
            base_score += contribution
            breakdown.append(
                f"{det.category_label}: confidence {int(det.confidence * 100)}%, severity {det.severity.upper()} (+{contribution} pts)"
            )

    # Multi-threat compounding synergy
    if len(detected_threats) > 1:
        synergy = min(25, (len(detected_threats) - 1) * 12)
        base_score += synergy
        breakdown.append(f"Multi-threat synergy ({len(detected_threats)} concurrent vectors: +{synergy} pts)")

    # Obfuscation penalties
    if normalized.has_zero_width_chars:
        base_score += 15
        breakdown.append(f"Zero-width unicode formatting detected ({normalized.zero_width_count} chars: +15 pts)")

    if normalized.has_base64_candidate:
        base_score += 18
        breakdown.append("Base64 encoded payload smuggling detected (+18 pts)")

    if normalized.has_obfuscated_spacing:
        base_score += 12
        breakdown.append("Letter-spaced word evasion pattern detected (+12 pts)")

    # Severity overrides
    has_critical = any(d.detected and d.severity == "critical" for d in detections)
    if has_critical and base_score < 75:
        base_score = 78
        breakdown.append("Critical severity override enforced (minimum floor 75 pts).")

    has_high = any(d.detected and d.severity in ["high", "critical"] for d in detections)
    if has_high and base_score < 50:
        base_score = 52
        breakdown.append("High severity threat floor enforced (minimum floor 50 pts).")

    # Uncertainty / ambiguity check
    intermediate = [d for d in detections if not d.detected and d.confidence >= 0.35]
    if len(detected_threats) == 0 and len(intermediate) > 0 and base_score < 25:
        base_score = 32
        breakdown.append("Uncertain / borderline pattern flagged for REVIEW (32 pts).")

    final_score = max(0, min(100, round(base_score)))

    if final_score >= 75:
        level = "CRITICAL"
    elif final_score >= 50:
        level = "HIGH"
    elif final_score >= 25:
        level = "MODERATE"
    else:
        level = "LOW"

    return final_score, level, breakdown
