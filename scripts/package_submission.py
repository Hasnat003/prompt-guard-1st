#!/usr/bin/env python3
"""
Packages all updated submission files into public/PromptGuard_University_Submission.zip
"""

import os
import zipfile

OUTPUT_ZIP = "public/PromptGuard_University_Submission.zip"
ROOT_DIR = "."

FILES_TO_INCLUDE = [
    ("PromptGuard.ipynb", "PromptGuard.ipynb"),
    ("dataset/promptguard_dataset.csv", "dataset/promptguard_dataset.csv"),
    ("models/promptguard_model.joblib", "models/promptguard_model.joblib"),
    ("results/classification_report.txt", "results/classification_report.txt"),
    ("requirements.txt", "requirements.txt"),
    ("documentation/README.md", "documentation/README.md"),
    ("train_multilabel.py", "train_multilabel.py"),
]

DIRECTORIES_TO_INCLUDE = [
    ("prompt_guard", "prompt_guard"),
]

def create_zip():
    os.makedirs(os.path.dirname(OUTPUT_ZIP), exist_ok=True)
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for src, arc in FILES_TO_INCLUDE:
            if os.path.exists(src):
                zf.write(src, arc)
                print(f"Added file: {src} -> {arc}")
            else:
                print(f"Warning: File not found: {src}")

        for src_dir, arc_dir in DIRECTORIES_TO_INCLUDE:
            if os.path.exists(src_dir):
                for root, _, files in os.walk(src_dir):
                    for file in files:
                        if file.endswith((".py", ".json", ".md")):
                            full_path = os.path.join(root, file)
                            rel_path = os.path.relpath(full_path, src_dir)
                            arc_path = os.path.join(arc_dir, rel_path)
                            zf.write(full_path, arc_path)
                            print(f"Added module: {full_path} -> {arc_path}")

    size = os.path.getsize(OUTPUT_ZIP)
    print(f"\n[✓] Successfully created {OUTPUT_ZIP} ({size:,} bytes)")

if __name__ == "__main__":
    create_zip()
