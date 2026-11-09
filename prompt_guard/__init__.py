"""
PromptGuard: AI-Powered Prompt Security Scanner and Protection Middleware
University Individual Project • Artificial Intelligence • Machine Learning • NLP • Cybersecurity

Core Principle: Detect intelligently, assess carefully, explain transparently and enforce consistently.
"""

from prompt_guard.scanner import PromptGuard
from prompt_guard.sanitizer import sanitize_prompt
from prompt_guard.canary import (
    generate_canary_token,
    inject_canary_into_system_prompt,
    inspect_llm_output,
)
from prompt_guard.types import (
    ScanResult,
    DetectionDetail,
    SecurityPolicy,
    DecisionAction,
    RiskLevel,
    ThreatCategory,
)

__version__ = "1.1.0"
__author__ = "University AI & Cybersecurity Project Team"
__all__ = [
    "PromptGuard",
    "sanitize_prompt",
    "generate_canary_token",
    "inject_canary_into_system_prompt",
    "inspect_llm_output",
    "ScanResult",
    "DetectionDetail",
    "SecurityPolicy",
    "DecisionAction",
    "RiskLevel",
    "ThreatCategory",
]
