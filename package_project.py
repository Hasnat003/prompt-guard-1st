#!/usr/bin/env python3
"""
Creates PromptGuard_University_Submission.zip containing all required files:
- PromptGuard.ipynb
- dataset/promptguard_dataset.csv
- models/promptguard_model.joblib
- results/classification_report.txt
- results/evaluation_results.json
- documentation/README.md
- requirements.txt
- train_multilabel.py
"""

import os
import zipfile

os.makedirs("public", exist_ok=True)
zip_path = "public/PromptGuard_University_Submission.zip"

files_to_pack = [
    ("PromptGuard.ipynb", "PromptGuard/PromptGuard.ipynb"),
    ("dataset/promptguard_dataset.csv", "PromptGuard/dataset/promptguard_dataset.csv"),
    ("models/promptguard_model.joblib", "PromptGuard/models/promptguard_model.joblib"),
    ("models/promptguard_model.json", "PromptGuard/models/promptguard_model.json"),
    ("results/classification_report.txt", "PromptGuard/results/classification_report.txt"),
    ("results/evaluation_results.json", "PromptGuard/results/evaluation_results.json"),
    ("documentation/README.md", "PromptGuard/documentation/README.md"),
    ("requirements.txt", "PromptGuard/requirements.txt"),
    ("train_multilabel.py", "PromptGuard/train_multilabel.py"),
]

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for src, dst in files_to_pack:
        if os.path.exists(src):
            zf.write(src, dst)
            print(f"Added {src} as {dst}")
        else:
            print(f"Warning: {src} not found!")

print(f"\n[✓] Successfully created university project zip: {zip_path} ({os.path.getsize(zip_path)} bytes)")
