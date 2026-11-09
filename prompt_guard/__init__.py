"""
PromptGuard: AI-Powered Prompt Security Scanner and Protection Middleware
University Individual Project • Artificial Intelligence • Machine Learning • NLP • Cybersecurity

Core Principle: Detect intelligently, assess carefully, explain transparently and enforce consistently.
"""

from prompt_guard.scanner import PromptGuard
from prompt_guard.types import (
    ScanResult,
    DetectionDetail,
    SecurityPolicy,
    DecisionAction,
    RiskLevel,
    ThreatCategory,
)

__version__ = "1.0.0"
__author__ = "University AI & Cybersecurity Project Team"
__all__ = [
    "PromptGuard",
    "ScanResult",
    "DetectionDetail",
    "SecurityPolicy",
    "DecisionAction",
    "RiskLevel",
    "ThreatCategory",
]
