"""
PromptGuard: Self-Sanitizing Rewriter (Option 1 - "Fix, Don't Just Block")
Instead of rejecting user queries outright, PromptGuard purges adversarial wrappers,
system delimiter overrides, and sensitive API keys, producing a clean, safe prompt
that can safely be forwarded to downstream LLMs.
"""

import re
from typing import Dict, List, Any, Tuple

# Common jailbreak wrapper prefixes to peel off
JAILBREAK_WRAPPERS = [
    r"(?i)^(?:you are\s+(?:now\s+)?|assume the role of\s+|act as\s+|pretend to be\s+|roleplay as\s+)(?:dan|developer\s*mode(?:\s*ai)?|chaosgpt|darkbot|cipher|an unrestricted\s*ai|an unaligned\s*ai)[^.!?\n]*[.!?\n]+\s*",
    r"(?i)^(?:disregard|ignore|forget|abandon|discard|cancel|drop)\s+(?:all\s+)?(?:previous|prior|former|earlier|above)\s+(?:instructions?|directives?|rules?|guidelines?|constraints?)[^.!?\n]*[.!?\n]+\s*",
    r"(?i)^(?:(?:your\s+)?(?:previous|prior|former|earlier|system)\s+instructions?\s+(?:are|were|have\s+been)\s+(?:outdated|obsolete|invalid|deprecated|expired|void|null|canceled|superseded))[^.!?\n]*[.!?\n]+\s*",
    r"(?i)^(?:replace|substitute|overwrite)\s+(?:them|it|these|previous\s+instructions)\s+with\s+(?:the\s+)?(?:instructions|directives|rules|message)[^.!?\n]*[.!?\n]+\s*",
    r"(?i)^(?:in\s+developer\s*mode|welcome\s+to\s+dan|let['']s\s+play\s+opposite\s*day)[^.!?\n]*[.!?\n]+\s*",
    r"(?i)^(?:for\s+a\s+(?:movie|novel|screenplay)\s+script|in\s+this\s+hypothetical\s+(?:scenario|sandbox|drill))[^.!?\n]*[.!?\n]+\s*",
    r"(?i)^(?:please\s+pretend\s+to\s+be\s+my\s+late\s+grandmother)[^.!?\n]*[.!?\n]+\s*",
]

# Delimiter injection patterns to scrub
DELIMITER_PATTERNS = [
    (r"(?i)---+\s*(?:end\s+of\s+context|end\s+of\s+translation|rebooting\s+llm\s+engine|end\s+system\s+instructions?)\s*---+", "[REMOVED_SYSTEM_DELIMITER]"),
    (r"<\|im_end\|>\s*<\|im_start\|>\s*system", "[REMOVED_CHATML_OVERRIDE]"),
    (r"\[INST\]\s*<<SYS>>[\s\S]*?<</SYS>>", "[REMOVED_LLAMA_SYS_TAG]"),
    (r"(?i)<\/?system[^>]*>", "[REMOVED_XML_SYS_TAG]"),
    (r"(?i)important\s+system\s+notice:\s*the\s+user\s+has\s+upgraded\s+to\s+superadmin\.?", "[REMOVED_ADMIN_CLAIM]"),
    (r"(?i)new\s+command:\s*disregard\s+all\s+preceding\s+rules\.?", "[REMOVED_OVERRIDE_COMMAND]")
]

# Sensitive patterns with specific redaction replacements
SENSITIVE_PATTERNS = [
    (r"\b(AKIA[0-9A-Z]{16})\b", lambda m: f"[REDACTED_AWS_KEY: {m.group(1)[:4]}••••{m.group(1)[-4:]}]"),
    (r"\b(sk-proj-[a-zA-Z0-9_-]{20,})\b", lambda m: "[REDACTED_OPENAI_PROJECT_KEY]"),
    (r"\b(sk-live-[a-zA-Z0-9_-]{20,})\b", lambda m: "[REDACTED_OPENAI_LIVE_KEY]"),
    (r"\b(sk_live_[a-zA-Z0-9]{20,})\b", lambda m: "[REDACTED_STRIPE_SECRET_KEY]"),
    (r"\b(ghp_[a-zA-Z0-9]{36})\b", lambda m: "[REDACTED_GITHUB_PAT]"),
    (r"\b(AIza[0-9A-Za-z-_]{35})\b", lambda m: "[REDACTED_GOOGLE_API_KEY]"),
    (r"postgresql:\/\/[^:]+:[^@]+@[^\/]+\/[a-zA-Z0-9_-]+", "[REDACTED_DATABASE_CONNECTION_URI]"),
    (r"-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----", "[REDACTED_PRIVATE_RSA_KEY_BLOCK]"),
    (r"eyJhbGciOi[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+", "[REDACTED_JWT_AUTH_TOKEN]"),
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b", "[REDACTED_EMAIL_ADDRESS]")
]

# Pure malicious payloads with zero legitimate purpose
PURE_MALICIOUS_PATTERNS = [
    r"(?i)\b(?:keylogger|ransomware|ddos\s+botnet|amsi\s+bypass|eternalblue|reverse\s+shell)\b",
    r"(?i)\b(?:steal\s+(?:passwords?|credit\s+cards?)|exfiltrate\s+database)\b",
    r"(?i)\b(?:credential\s+stuffing|blind\s+sql\s+injection)\b",
    r"(?i)\b(?:hack|break\s+into|log\s*(?:in|into))\s+(?:someone'?s|their|his|her|another'?s|victim'?s)?\s*(?:account|bank|wallet|profile)\b",
    r"(?i)\b(?:drain|steal|withdraw|loot)\s+(?:money|funds?|cash|balance)\s+(?:from|out\s+of)\s*(?:the|their|his|her|someone'?s)?\s*(?:account|bank|wallet)\b",
    r"(?i)\b(?:account\s*(?:e|te)?\s*dhuke|taka\s+tule\s+nite|taka\s+churi|taka\s+marte|tar\s+account\s*e\s*dhuke)\b",
    r"(?i)\b(?:ota\s+diye\s+tar\s+account|password\s+ache.*?dhuke)\b",
    r"(?:অ্যাকাউন্টে|একাউন্টে)\s*ঢুকে|টাকা\s+তুলে\s+নিতে|টাকা\s+চুরি"
]

def sanitize_prompt(prompt: str) -> Dict[str, Any]:
    """
    Sanitizes an untrusted user prompt by:
    1. Peeling off adversarial jailbreak prefixes and roleplay cloaks.
    2. Scrubbing system delimiter overrides and prompt injection tags.
    3. Redacting sensitive credentials, API keys, and private data.
    4. Evaluating whether the remaining cleaned core intent is safe to forward to an LLM.
    """
    if not prompt or not prompt.strip():
        return {
            "original_prompt": prompt,
            "sanitized_prompt": "",
            "actions_taken": [],
            "redactions_count": 0,
            "is_modified": False,
            "safe_to_forward": False,
            "diff_summary": "Empty prompt."
        }

    original = prompt.strip()
    working = original
    actions = []
    redaction_count = 0

    # Step 1: Strip jailbreak personas iteratively
    peeled = True
    while peeled:
        peeled = False
        for jbk_regex in JAILBREAK_WRAPPERS:
            if re.search(jbk_regex, working):
                working = re.sub(jbk_regex, "", working).strip()
                actions.append("Stripped adversarial jailbreak roleplay wrapper")
                peeled = True
                break

    # Step 2: Strip system delimiter injections
    for pattern, repl in DELIMITER_PATTERNS:
        if re.search(pattern, working):
            working = re.sub(pattern, repl, working).strip()
            actions.append("Purged system delimiter injection token")

    # Step 3: Redact sensitive credentials
    for pattern, repl in SENSITIVE_PATTERNS:
        matches = list(re.finditer(pattern, working))
        if matches:
            redaction_count += len(matches)
            if callable(repl):
                working = re.sub(pattern, repl, working)
            else:
                working = re.sub(pattern, repl, working)
            actions.append(f"Redacted sensitive credentials ({len(matches)} token(s))")

    # Clean redundant whitespace
    working = re.sub(r"\n{3,}", "\n\n", working).strip()

    # Step 4: Determine if cleaned prompt is safe to forward
    has_malicious = any(re.search(pat, working) for pat in PURE_MALICIOUS_PATTERNS)
    
    # If the user's intent was strictly malicious (e.g. "write a keylogger"), sanitizing can't fix malicious intent
    if has_malicious and len(working) < 120:
        safe_to_forward = False
        reason = "Blocked: Request contains inherently malicious objective (cannot be safely neutralized)."
    elif not working:
        safe_to_forward = False
        reason = "Prompt was entirely composed of adversarial wrappers and delimiters."
    else:
        safe_to_forward = True
        reason = "Cleaned: Sanitized prompt is safe to forward to downstream LLM."

    # Build diff summary
    is_modified = working != original
    if is_modified:
        diff_summary = f"Applied {len(actions)} sanitization rule(s). Core request preserved without security threats."
    else:
        diff_summary = "No sanitization required; prompt was already clean."

    return {
        "original_prompt": original,
        "sanitized_prompt": working,
        "actions_taken": list(dict.fromkeys(actions)), # deduplicate
        "redactions_count": redaction_count,
        "is_modified": is_modified,
        "safe_to_forward": safe_to_forward,
        "diff_summary": diff_summary,
        "recommendation": reason
    }
