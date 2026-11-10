"""
PromptGuard Advanced Machine Learning Engine
Multi-representation text classification with sublinear TF-IDF,
subword character n-grams, contextual linguistic signals, and
calibrated multi-output logistic regression with token saliency attribution.
"""

import json
import math
import os
import re
from typing import Dict, List, Any, Optional

MODEL_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "promptguard_model.json")

_MODEL_CACHE: Optional[Dict[str, Any]] = None

LABELS = ["prompt_injection", "jailbreak", "sensitive_data", "malicious_intent"]

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "to", "of", "in", "that", "this", 
    "it", "for", "where", "do", "does", "did", "on", "with", "and", "or", "by", "at", 
    "from", "as", "be", "been", "being", "have", "has", "had", "so", "than", "then", 
    "there", "here", "which", "who", "whom", "whose", "what", "we", "you", "they", "i"
}

IMPERATIVE_MARKERS = {
    "override", "ignore", "disregard", "bypass", "reveal", "print", "execute", 
    "act", "pretend", "discard", "forget", "abandon", "drop", "clear", "wipe", 
    "reset", "cancel", "supersede", "replace", "substitute", "unbound", "erase", 
    "disable", "unfiltered", "unrestricted", "delete", "remove", "unmask"
}

ROLEPLAY_MARKERS = {
    "roleplay", "fictional", "pretend", "dan", "chaos", "unrestricted", "hypothetical", 
    "hypothetically", "screenplay", "movie", "story", "game", "universe", "scenario", 
    "simulation", "persona", "character", "alter-ego", "jailbreak", "unfiltered", 
    "developer", "debug", "root", "sudo", "jailbroken", "imagine"
}

REFUSAL_SUPPRESSION_MARKERS = {
    "apologize", "refuse", "disclaimer", "warning", "warnings", "restrictions", 
    "comply", "obey", "freely", "unfiltered", "never", "cannot", "ethics", "ethical"
}

EXFILTRATION_MARKERS = {
    "secret", "token", "password", "credentials", "credential", "key", "keys", 
    "prompt", "instructions", "guidelines", "rules", "verbatim", "dump", "exfiltrate", 
    "leak", "confidential", "internal", "hidden", "private"
}

INDIRECT_HIJACKING_MARKERS = {
    "regardless", "rate", "score", "candidate", "resume", "evaluate", "mention", 
    "unconditionally", "verdict", "overriding", "grade", "reviewing", "qualifications",
    "fit", "recommendation", "override", "bypass", "perfect"
}

CONCEALMENT_MARKERS = {
    "mention", "reveal", "disclose", "tell", "indicate", "acknowledge", "secret", 
    "hidden", "stealth", "covert", "leak", "silently", "omit", "suppress", "hide"
}

def get_model() -> Optional[Dict[str, Any]]:
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE

    if os.path.exists(MODEL_JSON_PATH):
        try:
            with open(MODEL_JSON_PATH, "r", encoding="utf-8") as f:
                _MODEL_CACHE = json.load(f)
                return _MODEL_CACHE
        except Exception:
            pass

    return None

def reload_model() -> Optional[Dict[str, Any]]:
    global _MODEL_CACHE
    _MODEL_CACHE = None
    return get_model()

def extract_features(text: str) -> Dict[str, float]:
    words = re.findall(r"\b\w+\b", text.lower())
    features: Dict[str, float] = {}

    if not words:
        return features

    content_word_counts: Dict[str, int] = {}
    for w in words:
        if w not in STOPWORDS and len(w) > 1:
            content_word_counts[w] = content_word_counts.get(w, 0) + 1

    for w, count in content_word_counts.items():
        features[w] = 1.0 + math.log(count)

    for i in range(len(words) - 1):
        bg = f"{words[i]}_{words[i+1]}"
        features[bg] = features.get(bg, 0.0) + 1.0

    for w in words:
        if w not in STOPWORDS and len(w) >= 3:
            for j in range(len(w) - 2):
                cg = f"c:{w[j:j+3]}"
                features[cg] = features.get(cg, 0.0) + 0.5

    word_count = max(1, len(words))

    imp_count = sum(1 for w in words if w in IMPERATIVE_MARKERS)
    if imp_count > 0:
        features["sem:imperative_density"] = (imp_count / word_count) * 2.0

    rp_count = sum(1 for w in words if w in ROLEPLAY_MARKERS)
    if rp_count > 0:
        features["sem:roleplay_framing"] = (rp_count / word_count) * 2.0

    ref_count = sum(1 for w in words if w in REFUSAL_SUPPRESSION_MARKERS)
    if ref_count > 0:
        features["sem:refusal_suppression"] = (ref_count / word_count) * 2.0

    exfil_count = sum(1 for w in words if w in EXFILTRATION_MARKERS)
    if exfil_count > 0:
        features["sem:exfiltration_probing"] = (exfil_count / word_count) * 2.0

    hijack_count = sum(1 for w in words if w in INDIRECT_HIJACKING_MARKERS)
    if hijack_count > 0:
        features["sem:indirect_hijacking"] = (hijack_count / word_count) * 2.5

    conceal_count = sum(1 for w in words if w in CONCEALMENT_MARKERS)
    if conceal_count > 0:
        features["sem:concealment_secrecy"] = (conceal_count / word_count) * 2.5

    delims = re.findall(r"(?:---|===|###|<\||<system>|\[SYSTEM\])", text)
    if delims:
        features["sem:structural_delimiter"] = (len(delims) / word_count) * 3.0

    text_len = max(1, len(text))
    char_freq: Dict[str, int] = {}
    for ch in text:
        char_freq[ch] = char_freq.get(ch, 0) + 1
    entropy = -sum((cnt / text_len) * math.log2(cnt / text_len) for cnt in char_freq.values() if cnt > 0)
    features["sem:character_entropy"] = min(1.0, entropy / 6.0)

    return features

def predict_ml_comprehensive(text: str) -> Dict[str, Any]:
    model = get_model()
    features = extract_features(text)
    words = re.findall(r"\b\w+\b", text.lower())

    if not model or "weights" not in model:
        probs = {lbl: 0.02 for lbl in LABELS}
        logits = {lbl: -3.89 for lbl in LABELS}
        return {
            "probabilities": probs,
            "logits": logits,
            "top_features": [],
            "token_saliency": [{"token": w, "weight": 0.0, "category": "benign"} for w in words],
            "feature_count": len(features),
        }

    biases = model.get("biases", [-0.5, -0.5, -0.5, -0.5])
    weights = model.get("weights", [{}, {}, {}, {}])
    idf = model.get("idf", {})

    probs: Dict[str, float] = {}
    logits: Dict[str, float] = {}
    all_top_features: List[Dict[str, Any]] = []

    for idx, label_name in enumerate(LABELS):
        b = biases[idx] if idx < len(biases) else -0.5
        w = weights[idx] if idx < len(weights) else {}

        logit = b
        label_features = []
        for feat_name, feat_val in features.items():
            feat_weight = w.get(feat_name, 0.0)
            feat_idf = idf.get(feat_name, 1.0)
            contribution = feat_weight * feat_val * feat_idf
            logit += contribution
            if abs(contribution) > 0.05:
                label_features.append({
                    "feature": feat_name,
                    "weight": round(feat_weight, 4),
                    "contribution": round(contribution, 4),
                    "category": label_name,
                })

        prob = 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, logit))))
        probs[label_name] = round(prob, 4)
        logits[label_name] = round(logit, 3)

        label_features.sort(key=lambda x: abs(x["contribution"]), reverse=True)
        all_top_features.extend(label_features[:5])

    token_saliency: List[Dict[str, Any]] = []
    for w in words:
        total_w = 0.0
        max_cat = "benign"
        highest_c = 0.0

        for idx, label_name in enumerate(LABELS):
            model_w = weights[idx] if idx < len(weights) else {}
            cw = model_w.get(w, 0.0) * idf.get(w, 1.0)
            if len(w) >= 3 and w not in STOPWORDS:
                for j in range(len(w) - 2):
                    cg = f"c:{w[j:j+3]}"
                    cw += model_w.get(cg, 0.0) * idf.get(cg, 1.0) * 0.5
            total_w += cw
            if cw > highest_c:
                highest_c = cw
                max_cat = label_name

        token_saliency.append({
            "token": w,
            "weight": round(total_w, 3),
            "category": max_cat if total_w > 0.15 else "benign",
        })

    return {
        "probabilities": probs,
        "logits": logits,
        "top_features": all_top_features[:15],
        "token_saliency": token_saliency,
        "feature_count": len(features),
    }

def predict_ml_probabilities(text: str) -> Dict[str, float]:
    return predict_ml_comprehensive(text)["probabilities"]
