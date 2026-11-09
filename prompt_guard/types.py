"""
Typed contracts and schemas for PromptGuard Python security middleware.
Conforms to Blueprint Part 7.3 & 7.4.
"""

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Optional, Dict, Any


class ThreatCategory(str, Enum):
    PROMPT_INJECTION = "prompt_injection"
    JAILBREAK = "jailbreak"
    SENSITIVE_DATA = "sensitive_data"
    HARMFUL_INTENT = "harmful_intent"


class DecisionAction(str, Enum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    REVIEW = "REVIEW"


class RiskLevel(str, Enum):
    CLEAN = "CLEAN"                    # Tier 0: 0.0 - 9.9
    INFORMATIONAL = "INFORMATIONAL"    # Tier 1: 10.0 - 24.9
    LOW = "LOW"                        # Tier 2: 25.0 - 44.9
    MODERATE = "MODERATE"              # Tier 3: 45.0 - 64.9
    ELEVATED = "ELEVATED"              # Tier 3 (Alias)
    HIGH = "HIGH"                      # Tier 4: 65.0 - 79.9
    CRITICAL = "CRITICAL"              # Tier 5: 80.0 - 91.9
    SEVERE = "SEVERE"                  # Tier 6: 92.0 - 100.0


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SecretMatch:
    type: str
    label: str
    raw: str
    redacted: str
    start_index: int
    end_index: int
    confidence: float
    entropy: Optional[float] = None


@dataclass
class DetectionDetail:
    category: str
    category_label: str
    detected: bool
    confidence: float
    severity: str
    evidence: List[str]
    reason: str
    detector_source: str
    calibration_caveat: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class NormalizedInput:
    raw: str
    normalized: str
    has_zero_width_chars: bool
    zero_width_count: int
    has_obfuscated_spacing: bool
    has_base64_candidate: bool
    decoded_base64: Optional[str]
    has_homoglyphs: bool
    detected_language: str
    char_count: int
    token_count_estimate: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SecurityPolicy:
    id: str = "standard"
    name: str = "Standard Balanced"
    allow_threshold: int = 25
    block_threshold: int = 50
    strictness: str = "standard"
    block_on_critical_secret: bool = True
    block_on_confirmed_injection: bool = True
    block_on_confirmed_jailbreak: bool = True
    block_on_harmful_intent: bool = True
    redact_secrets_in_logs: bool = True
    uncertainty_threshold: float = 0.15
    max_prompt_length: int = 8000

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ScanResult:
    request_id: str
    timestamp: str
    is_safe: bool
    risk_score: int
    risk_level: str
    action: str
    detections: List[DetectionDetail]
    normalized_input: NormalizedInput
    processing_time_ms: float
    policy_applied: str
    action_reason: str
    recommendation: str
    redacted_prompt: str
    educational_hard_negative: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp,
            "is_safe": self.is_safe,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "action": self.action,
            "detections": [d.to_dict() for d in self.detections],
            "normalized_input": self.normalized_input.to_dict(),
            "processing_time_ms": self.processing_time_ms,
            "policy_applied": self.policy_applied,
            "action_reason": self.action_reason,
            "recommendation": self.recommendation,
            "redacted_prompt": self.redacted_prompt,
            "educational_hard_negative": self.educational_hard_negative,
        }
