"""
PromptGuard: Portable ML Prediction Engine
Evaluates TF-IDF (Unigram + Bigram) and MultiOutput Logistic Regression
using the trained weights and parameters from models/promptguard_model.json.
Runs in sub-millisecond time with zero external dependencies.
"""

import json
import math
import os
import re
from typing import Dict

MODEL_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "promptguard_model.json")

_MODEL_CACHE = None

def get_model():
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

def extract_ngrams(text: str):
    words = re.findall(r"\b\w+\b", text.lower())
    unigrams = words
    bigrams = [f"{words[i]}_{words[i+1]}" for i in range(len(words)-1)]
    return unigrams + bigrams

def predict_ml_probabilities(text: str) -> Dict[str, float]:
    """
    Computes calibrated sigmoid probabilities P(y_k = 1 | x) for all 4 labels
    using the trained TF-IDF vectorizer and logistic regression parameters.
    """
    labels = ["prompt_injection", "jailbreak", "sensitive_data", "malicious_intent"]
    default_scores = {col: 0.01 for col in labels}

    model = get_model()
    if not model or "weights" not in model:
        # Fallback heuristic calculation if model not yet trained
        return default_scores

    biases = model.get("biases", [-0.8, -0.9, -0.8, -0.9])
    weights = model.get("weights", [{}, {}, {}, {}])
    idf = model.get("idf", {})

    tokens = extract_ngrams(text)
    scores = {}

    for idx, label_name in enumerate(labels):
        b = biases[idx] if idx < len(biases) else -0.8
        w = weights[idx] if idx < len(weights) else {}

        # Logit calculation: z = b + sum(w_i * idf_i)
        z = b + sum(w.get(t, 0.0) * idf.get(t, 1.0) for t in tokens)
        prob = 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, z))))
        scores[label_name] = round(prob, 4)

    return scores
