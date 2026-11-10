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
            contribution = round(max_w * det.confidence * mult, 1)
            base_score += contribution
            breakdown.append(
                f"{det.category_label}: confidence {int(det.confidence * 100)}%, severity {det.severity.upper()} (+{contribution} pts)"
            )

    # Continuous Statistical Threat Floor:
    # Catches rephrased prompts and indirect evasion tricks that register intermediate confidence (>= 35%)
    max_confidence = max((d.confidence for d in detections), default=0.0)
    continuous_ml_risk = round(max_confidence * 100.0, 1)
    if continuous_ml_risk >= 35.0 and base_score < continuous_ml_risk:
        base_score = continuous_ml_risk
        breakdown.append(f"Statistical ML threat signature ({int(max_confidence * 100)}% confidence: floor {continuous_ml_risk} pts)")

    # Multi-threat compounding synergy
    if len(detected_threats) > 1:
        synergy = round(min(25.0, (len(detected_threats) - 1) * 12.5), 1)
        base_score += synergy
        breakdown.append(f"Multi-threat synergy ({len(detected_threats)} concurrent vectors: +{synergy} pts)")

    # Obfuscation penalties
    if normalized.has_zero_width_chars:
        base_score += 15.0
        breakdown.append(f"Zero-width unicode formatting detected ({normalized.zero_width_count} chars: +15.0 pts)")

    if normalized.has_base64_candidate:
        base_score += 18.0
        breakdown.append("Base64 encoded payload smuggling detected (+18.0 pts)")

    if normalized.has_obfuscated_spacing:
        base_score += 12.0
        breakdown.append("Letter-spaced word evasion pattern detected (+12.0 pts)")

    # Compound attack floor (credential theft / weaponized intrusion)
    has_secret = any(d.detected and d.category == "sensitive_data" for d in detections)
    has_harm = any(d.detected and d.category == "harmful_intent" for d in detections)
    has_inj = any(d.detected and d.category == "prompt_injection" for d in detections)
    if (has_secret and has_harm) or (has_inj and has_harm):
        if base_score < 90.0:
            base_score = 94.0
            breakdown.append("Severe compound intrusion & credential abuse vector identified (Severe tier floor 94.0 pts).")

    # Severity overrides
    has_critical = any(d.detected and d.severity == "critical" for d in detections)
    if has_critical and base_score < 75.0:
        base_score = 78.5
        breakdown.append("Critical severity override enforced (minimum floor 78.5 pts).")

    has_high = any(d.detected and d.severity in ["high", "critical"] for d in detections)
    if has_high and base_score < 50.0:
        base_score = 52.0
        breakdown.append("High severity threat floor enforced (minimum floor 52.0 pts).")

    # Uncertainty / ambiguity check
    intermediate = [d for d in detections if not d.detected and d.confidence >= 0.35]
    if len(detected_threats) == 0 and len(intermediate) > 0 and base_score < 25.0:
        base_score = 32.0
        breakdown.append("Uncertain / borderline pattern flagged for REVIEW (32.0 pts).")

    final_score = round(max(0.0, min(100.0, base_score)), 1)
    if final_score.is_integer():
        final_score = int(final_score)

    # 7-Tier Granular NIST / MITRE / OWASP Risk Level Classification
    if final_score >= 90.0:
        level = "SEVERE"          # Tier 6: Multi-Vector Emergency Attack
    elif final_score >= 75.0:
        level = "CRITICAL"        # Tier 5: Active Exploit / Direct Breach
    elif final_score >= 60.0:
        level = "HIGH"            # Tier 4: Confirmed Threat Vector
    elif final_score >= 45.0:
        level = "ELEVATED"        # Tier 3: Elevated Review / Borderline Threat
    elif final_score >= 25.0:
        level = "LOW"             # Tier 2: Low Caution
    elif final_score >= 10.0:
        level = "INFORMATIONAL"   # Tier 1: Minor Anomaly / Educational
    else:
        level = "CLEAN"           # Tier 0: Pristine Safe Query

    return final_score, level, breakdown
