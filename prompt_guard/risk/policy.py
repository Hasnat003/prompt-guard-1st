"""
Security policy and decision engine (Python implementation).
Fulfills Part 5.2 of the Master Project Blueprint.
"""

from typing import List, Tuple
from prompt_guard.types import DetectionDetail, SecurityPolicy

POLICY_PRESETS = {
    "standard": SecurityPolicy(
        id="standard",
        name="Standard Balanced",
        allow_threshold=25,
        block_threshold=50,
        strictness="standard",
        block_on_critical_secret=True,
        block_on_confirmed_injection=True,
        block_on_confirmed_jailbreak=True,
        block_on_harmful_intent=True,
        redact_secrets_in_logs=True,
        uncertainty_threshold=0.15,
        max_prompt_length=8000,
    ),
    "high_defense": SecurityPolicy(
        id="high_defense",
        name="High-Defense Enterprise",
        allow_threshold=15,
        block_threshold=40,
        strictness="high_defense",
        block_on_critical_secret=True,
        block_on_confirmed_injection=True,
        block_on_confirmed_jailbreak=True,
        block_on_harmful_intent=True,
        redact_secrets_in_logs=True,
        uncertainty_threshold=0.10,
        max_prompt_length=4000,
    ),
    "strict_compliance": SecurityPolicy(
        id="strict_compliance",
        name="Strict Compliance / Zero-Trust",
        allow_threshold=10,
        block_threshold=30,
        strictness="strict_compliance",
        block_on_critical_secret=True,
        block_on_confirmed_injection=True,
        block_on_confirmed_jailbreak=True,
        block_on_harmful_intent=True,
        redact_secrets_in_logs=True,
        uncertainty_threshold=0.05,
        max_prompt_length=2500,
    ),
    "permissive": SecurityPolicy(
        id="permissive",
        name="Permissive / Audit Only",
        allow_threshold=50,
        block_threshold=80,
        strictness="permissive",
        block_on_critical_secret=False,
        block_on_confirmed_injection=False,
        block_on_confirmed_jailbreak=False,
        block_on_harmful_intent=False,
        redact_secrets_in_logs=True,
        uncertainty_threshold=0.20,
        max_prompt_length=12000,
    ),
}


def evaluate_policy(
    risk_score: int,
    risk_level: str,
    detections: List[DetectionDetail],
    policy: SecurityPolicy,
    is_educational_hard_negative: bool,
) -> Tuple[str, str, str]:
    """
    Evaluates risk score and detections against policy thresholds.
    Returns (action, action_reason, recommendation).
    """
    if is_educational_hard_negative and risk_score < policy.block_threshold:
        return (
            "ALLOW",
            "Request allowed: verified educational or defensive inquiry without malicious exploit payload.",
            "Safe to forward to downstream LLM application.",
        )

    inj = next((d for d in detections if d.category == "prompt_injection" and d.detected), None)
    jb = next((d for d in detections if d.category == "jailbreak" and d.detected), None)
    secret = next((d for d in detections if d.category == "sensitive_data" and d.detected), None)
    harmful = next((d for d in detections if d.category == "harmful_intent" and d.detected), None)

    if policy.block_on_critical_secret and secret and secret.severity == "critical":
        return (
            "BLOCK",
            "Policy block enforced: high-risk credential or private API key detected in user prompt.",
            "Strip or redact exposed credentials before forwarding. PromptGuard auto-redaction available.",
        )

    if policy.block_on_confirmed_injection and inj and (inj.severity == "critical" or inj.confidence >= 0.85):
        return (
            "BLOCK",
            "Policy block enforced: high-confidence prompt injection attempting instruction override.",
            "Reject request. Enforce strict parameterization between instructions and data.",
        )

    if policy.block_on_confirmed_jailbreak and jb and (jb.severity == "critical" or jb.confidence >= 0.85):
        return (
            "BLOCK",
            "Policy block enforced: adversarial persona manipulation or restriction bypass detected.",
            "Reject request. Enforce model refusal boundaries.",
        )

    if policy.block_on_harmful_intent and harmful and not is_educational_hard_negative:
        return (
            "BLOCK",
            "Policy block enforced: active harmful intent or weaponization vector identified.",
            "Reject request and log security event.",
        )

    if risk_score >= policy.block_threshold:
        return (
            "BLOCK",
            f"Calculated risk score ({risk_score}/100) exceeds configured BLOCK threshold ({policy.block_threshold}/100).",
            "Security policy blocked this request. Review threat categories and inspect unmasked evidence.",
        )

    if risk_score >= policy.allow_threshold:
        return (
            "REVIEW",
            f"Calculated risk score ({risk_score}/100) sits within the inspection band [{policy.allow_threshold}-{policy.block_threshold - 1}].",
            "Request requires automated sandboxing or secondary human reviewer approval prior to execution.",
        )

    return (
        "ALLOW",
        f"No threat category exceeds configured action thresholds ({risk_score}/100 < {policy.allow_threshold}).",
        "Request cleared. Safe to forward to LLM model with standard system constraints.",
    )
