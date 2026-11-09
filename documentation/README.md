# PromptGuard — Multilabel Prompt Security Scanner
**University Final Year Project • Artificial Intelligence • NLP • Cybersecurity**

## Project Overview
PromptGuard is an explainable machine-learning security scanner and protection middleware placed between an application and an LLM. It detects and intercepts malicious prompts before they reach foundation models.

- **Primary Language:** Python
- **Environment:** Google Colab
- **ML Approach:** Supervised Multilabel Classification
- **Core Model:** TF-IDF Vectorizer + MultiOutputClassifier (Logistic Regression)
- **PII / Secret Detection:** Regex Rule-based Layer (Emails, Phone, API Keys, Private Keys)
- **Interface:** Gradio

## Threat Categories (4 Labels)
1. `prompt_injection`: Direct instruction override, system prompt exfiltration, delimiter manipulation.
2. `jailbreak`: Adversarial persona adoption (DAN, Developer Mode, uncensored AI framing).
3. `sensitive_data`: PII and credential exposure (AWS keys, OpenAI tokens, passwords, emails).
4. `malicious_intent`: Harmful and unauthorized objectives (malware craft, credential theft, exploit generation).

## Decision Policy
Priority: `BLOCK > REVIEW > ALLOW`
- **ALLOW**: No meaningful risk detected, or verified educational hard-negative query.
- **REVIEW**: Prompt injection or sensitive credential pattern detected.
- **BLOCK**: Adversarial jailbreak or active malicious intent detected.

## Repository Structure
```
PromptGuard/
├── PromptGuard.ipynb              # 18-Cell End-to-End Google Colab Notebook
├── dataset/
│   └── promptguard_dataset.csv   # Curated 420-sample reviewed dataset
├── models/
│   └── promptguard_model.joblib  # Trained model & vectorizer bundle
├── results/
│   ├── classification_report.txt # Official Precision, Recall, F1 metrics
│   └── evaluation_results.json   # Machine-readable evaluation report
├── documentation/
│   └── README.md
├── requirements.txt
└── train_multilabel.py           # Standalone training script
```

## How to Run in Google Colab
1. Upload `PromptGuard.ipynb` and `dataset/promptguard_dataset.csv` to Google Colab.
2. Select **Runtime > Run All**.
3. The interactive Gradio interface will launch directly inside Cell 17.
