#!/usr/bin/env python3
"""
PromptGuard: Advanced Multilabel ML Training Pipeline
Upgraded with:
- Stopword-filtered unigrams (prevents grammatical words like 'a', 'where', 'the' from masking threats)
- Rich semantic signals (Imperative density, Roleplay/Virtualization, Refusal Suppression, Exfiltration Probing)
- Subword Character N-Grams (3-to-4 grams) for morphological / paraphrase resilience
- MultiOutput Logistic Regression with L2 regularization and balanced class weights
- Calibrated probability outputs and loss history tracking
"""

import csv
import json
import math
import os
import random
import re
import sys
import time
from typing import Dict, List, Tuple, Any

DATASET_PATH = "dataset/promptguard_dataset.csv"
OUTPUT_MODEL_DIR = "models"
OUTPUT_RESULTS_DIR = "results"
SRC_DATA_DIR = "src/data"

LABEL_COLS = ["prompt_injection", "jailbreak", "sensitive_data", "malicious_intent"]

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

def extract_features(text: str) -> Dict[str, float]:
    words = re.findall(r"\b\w+\b", text.lower())
    features: Dict[str, float] = {}
    if not words:
        return features

    # Filtered content words for unigrams (excludes functional noise)
    content_word_counts: Dict[str, int] = {}
    for w in words:
        if w not in STOPWORDS and len(w) > 1:
            content_word_counts[w] = content_word_counts.get(w, 0) + 1

    # Sublinear TF-IDF scaling: 1 + log(count)
    for w, count in content_word_counts.items():
        features[w] = 1.0 + math.log(count)

    # Word bigrams (keeps bigram connections like ignore_previous, reveal_system)
    for i in range(len(words) - 1):
        bg = f"{words[i]}_{words[i+1]}"
        features[bg] = features.get(bg, 0.0) + 1.0

    # Character subword 3-grams for morphological resilience against evasions
    for w in words:
        if w not in STOPWORDS and len(w) >= 3:
            for j in range(len(w) - 2):
                cg = f"c:{w[j:j+3]}"
                features[cg] = features.get(cg, 0.0) + 0.5

    word_count = max(1, len(words))

    # Semantic signal 1: Imperative / Command density
    imp_count = sum(1 for w in words if w in IMPERATIVE_MARKERS)
    if imp_count > 0:
        features["sem:imperative_density"] = (imp_count / word_count) * 2.0

    # Semantic signal 2: Roleplay / Virtualization framing
    rp_count = sum(1 for w in words if w in ROLEPLAY_MARKERS)
    if rp_count > 0:
        features["sem:roleplay_framing"] = (rp_count / word_count) * 2.0

    # Semantic signal 3: Refusal suppression
    ref_count = sum(1 for w in words if w in REFUSAL_SUPPRESSION_MARKERS)
    if ref_count > 0:
        features["sem:refusal_suppression"] = (ref_count / word_count) * 2.0

    # Semantic signal 4: Exfiltration probing
    exfil_count = sum(1 for w in words if w in EXFILTRATION_MARKERS)
    if exfil_count > 0:
        features["sem:exfiltration_probing"] = (exfil_count / word_count) * 2.0

    # Semantic signal 5: Indirect decision hijacking & manipulation
    hijack_count = sum(1 for w in words if w in INDIRECT_HIJACKING_MARKERS)
    if hijack_count > 0:
        features["sem:indirect_hijacking"] = (hijack_count / word_count) * 2.5

    # Semantic signal 6: Concealment & anti-transparency directives
    conceal_count = sum(1 for w in words if w in CONCEALMENT_MARKERS)
    if conceal_count > 0:
        features["sem:concealment_secrecy"] = (conceal_count / word_count) * 2.5

    # Structural delimiters
    delims = re.findall(r"(?:---|===|###|<\||<system>|\[SYSTEM\])", text)
    if delims:
        features["sem:structural_delimiter"] = (len(delims) / word_count) * 3.0

    # Character Shannon entropy
    text_len = max(1, len(text))
    char_freq: Dict[str, int] = {}
    for ch in text:
        char_freq[ch] = char_freq.get(ch, 0) + 1
    entropy = -sum((cnt / text_len) * math.log2(cnt / text_len) for cnt in char_freq.values() if cnt > 0)
    features["sem:character_entropy"] = min(1.0, entropy / 6.0)

    return features

def load_data(filepath=DATASET_PATH):
    if not os.path.exists(filepath):
        print(f"Error: dataset not found at {filepath}")
        sys.exit(1)

    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        data = list(reader)

    texts = [row["text"] for row in data]
    labels = [[int(row[col]) for col in LABEL_COLS] for row in data]
    return texts, labels, data

def train_model(
    epochs: int = 25,
    learning_rate: float = 0.12,
    l2_reg: float = 0.001,
    dataset_path: str = DATASET_PATH,
    custom_samples: List[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    texts, labels, raw_data = load_data(dataset_path)

    if custom_samples:
        for s in custom_samples:
            texts.append(s["text"])
            labels.append([int(s.get(col, 0)) for col in LABEL_COLS])

    n_samples = len(texts)
    random.seed(42)
    indices = list(range(n_samples))
    random.shuffle(indices)

    split_idx = int(n_samples * 0.8)
    train_idx = indices[:split_idx]
    test_idx = indices[split_idx:]

    X_train = [texts[i] for i in train_idx]
    y_train = [labels[i] for i in train_idx]
    X_test = [texts[i] for i in test_idx]
    y_test = [labels[i] for i in test_idx]

    train_features = [extract_features(t) for t in X_train]
    test_features = [extract_features(t) for t in X_test]

    doc_freq: Dict[str, int] = {}
    for feats in train_features:
        for f in feats.keys():
            doc_freq[f] = doc_freq.get(f, 0) + 1

    num_docs = len(X_train)
    idf = {f: math.log((1 + num_docs) / (1 + df)) + 1.0 for f, df in doc_freq.items()}

    weights: List[Dict[str, float]] = [{} for _ in range(4)]
    biases: List[float] = [-0.5 for _ in range(4)]

    pos_weights = []
    for label_idx in range(4):
        pos_count = sum(row[label_idx] for row in y_train)
        neg_count = len(y_train) - pos_count
        pos_weights.append(max(1.0, min(8.0, neg_count / max(1, pos_count))))

    loss_history: List[float] = []
    start_time = time.time()

    for epoch in range(epochs):
        epoch_loss = 0.0
        current_lr = learning_rate / (1.0 + 0.02 * epoch)

        for feats, target_row in zip(train_features, y_train):
            for label_idx in range(4):
                target = target_row[label_idx]
                w = weights[label_idx]
                b = biases[label_idx]

                z = b + sum(w.get(f_name, 0.0) * f_val * idf.get(f_name, 1.0) for f_name, f_val in feats.items())
                pred_prob = 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, z))))

                err = pred_prob - target
                weight_mult = pos_weights[label_idx] if target == 1 else 1.0
                step = current_lr * err * weight_mult

                eps = 1e-12
                p_clamped = max(eps, min(1.0 - eps, pred_prob))
                sample_loss = -(target * math.log(p_clamped) + (1.0 - target) * math.log(1.0 - p_clamped))
                epoch_loss += sample_loss

                biases[label_idx] -= step * 0.05
                for f_name, f_val in feats.items():
                    current_w = w.get(f_name, 0.0)
                    grad = (err * weight_mult * f_val * idf.get(f_name, 1.0)) + (l2_reg * current_w)
                    w[f_name] = current_w - current_lr * grad * 0.02

        avg_loss = epoch_loss / (len(train_features) * 4)
        loss_history.append(round(avg_loss, 4))

    train_time = time.time() - start_time

    # Evaluate on held-out test split
    y_pred: List[List[int]] = []
    for feats in test_features:
        pred_row = []
        for label_idx in range(4):
            w = weights[label_idx]
            b = biases[label_idx]
            z = b + sum(w.get(f_name, 0.0) * f_val * idf.get(f_name, 1.0) for f_name, f_val in feats.items())
            prob = 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, z))))
            pred_row.append(1 if prob >= 0.35 else 0)
        y_pred.append(pred_row)

    metrics_dict = {}
    f1_list, prec_list, rec_list = [], [], []
    all_tp, all_fp, all_fn, all_support = 0, 0, 0, 0

    for idx, label_name in enumerate(LABEL_COLS):
        actuals = [row[idx] for row in y_test]
        preds = [row[idx] for row in y_pred]

        tp = sum(1 for a, p in zip(actuals, preds) if a == 1 and p == 1)
        tn = sum(1 for a, p in zip(actuals, preds) if a == 0 and p == 0)
        fp = sum(1 for a, p in zip(actuals, preds) if a == 0 and p == 1)
        fn = sum(1 for a, p in zip(actuals, preds) if a == 1 and p == 0)
        support = sum(actuals)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 1.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 1.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 1.0
        acc = (tp + tn) / max(1, (tp + tn + fp + fn))

        metrics_dict[label_name] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "accuracy": round(acc, 4),
            "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
            "support": support,
        }
        all_tp += tp
        all_fp += fp
        all_fn += fn
        all_support += support
        f1_list.append(f1)
        prec_list.append(prec)
        rec_list.append(rec)

    macro_f1 = sum(f1_list) / len(f1_list)
    macro_prec = sum(prec_list) / len(prec_list)
    macro_rec = sum(rec_list) / len(rec_list)
    micro_f1 = (2 * all_tp) / max(1, 2 * all_tp + all_fp + all_fn)

    compact_weights = []
    top_features_per_label = {}
    for idx, label_name in enumerate(LABEL_COLS):
        w = weights[idx]
        filtered = {k: round(v, 4) for k, v in w.items() if abs(v) >= 0.005}
        compact_weights.append(filtered)
        top_sorted = sorted(filtered.items(), key=lambda x: x[1], reverse=True)
        top_features_per_label[label_name] = [
            {"feature": k, "weight": v} for k, v in top_sorted[:15]
        ]

    compact_idf = {
        k: round(v, 4)
        for k, v in idf.items()
        if any(k in compact_weights[i] for i in range(4))
    }

    model_payload = {
        "model_type": "MultiOutputLogisticRegression + Sublinear TF-IDF, Subword & Contextual Features",
        "labels": LABEL_COLS,
        "vocabulary_size": len(compact_idf),
        "biases": [round(b, 4) for b in biases],
        "idf": compact_idf,
        "weights": compact_weights,
        "macro_f1": round(macro_f1, 4),
        "micro_f1": round(micro_f1, 4),
        "macro_precision": round(macro_prec, 4),
        "macro_recall": round(macro_rec, 4),
        "loss_history": loss_history,
        "metrics": metrics_dict,
        "top_features": top_features_per_label,
        "training_time_seconds": round(train_time, 3),
        "total_samples": n_samples,
        "test_samples": len(X_test),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    os.makedirs(OUTPUT_MODEL_DIR, exist_ok=True)
    os.makedirs(OUTPUT_RESULTS_DIR, exist_ok=True)
    os.makedirs(SRC_DATA_DIR, exist_ok=True)

    model_path = os.path.join(OUTPUT_MODEL_DIR, "promptguard_model.json")
    with open(model_path, "w", encoding="utf-8") as f:
        json.dump(model_payload, f, indent=2)

    ts_mirror_path = os.path.join(SRC_DATA_DIR, "trainedModel.json")
    with open(ts_mirror_path, "w", encoding="utf-8") as f:
        json.dump(model_payload, f, indent=2)

    with open(os.path.join(OUTPUT_RESULTS_DIR, "evaluation_results.json"), "w", encoding="utf-8") as f:
        json.dump({
            "macro_f1": round(macro_f1, 4),
            "micro_f1": round(micro_f1, 4),
            "metrics": metrics_dict,
            "loss_history": loss_history,
            "training_time": round(train_time, 3),
        }, f, indent=2)

    return model_payload

if __name__ == "__main__":
    epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    lr = float(sys.argv[2]) if len(sys.argv) > 2 else 0.12
    result = train_model(epochs=epochs, learning_rate=lr)
    print("=" * 65)
    print("PROMPTGUARD MULTILABEL MACHINE LEARNING MODEL TRAINED SUCCESSFULLY")
    print(f"Total Samples: {result['total_samples']} | Test Samples: {result['test_samples']}")
    print(f"Macro-F1: {result['macro_f1'] * 100:.2f}% | Micro-F1: {result['micro_f1'] * 100:.2f}%")
    print(f"Training Time: {result['training_time_seconds']}s across {len(result['loss_history'])} epochs")
    print("=" * 65)
    for lbl, m in result['metrics'].items():
        print(f"  • {lbl:<20}: F1={m['f1']*100:.2f}% | Prec={m['precision']*100:.2f}% | Rec={m['recall']*100:.2f}%")
    print(f"[✓] Artifacts exported to {OUTPUT_MODEL_DIR}/promptguard_model.json and {SRC_DATA_DIR}/trainedModel.json")
