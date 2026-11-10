#!/usr/bin/env python3
"""
Packages all submission and presentation files into:
- public/PromptGuard_University_Submission.zip
- public/PromptGuard_Codebase_Submission.zip
"""

import os
import zipfile

OUTPUT_ZIPS = [
    "public/PromptGuard_University_Submission.zip",
    "public/PromptGuard_Codebase_Submission.zip",
]

FILES_TO_INCLUDE = [
    ("run_local_app.py", "run_local_app.py"),
    ("quick_demo.py", "quick_demo.py"),
    ("cli.py", "cli.py"),
    ("HOW_TO_RUN.md", "HOW_TO_RUN.md"),
    ("PromptGuard.ipynb", "PromptGuard.ipynb"),
    ("dataset/promptguard_dataset.csv", "dataset/promptguard_dataset.csv"),
    ("models/promptguard_model.json", "models/promptguard_model.json"),
    ("models/promptguard_model.joblib", "models/promptguard_model.joblib"),
    ("models/model_metadata.json", "models/model_metadata.json"),
    ("results/classification_report.txt", "results/classification_report.txt"),
    ("results/evaluation_results.json", "results/evaluation_results.json"),
    ("results/million_scale_training_audit.json", "results/million_scale_training_audit.json"),
    ("requirements.txt", "requirements.txt"),
    ("documentation/README.md", "documentation/README.md"),
    ("documentation/project_report.md", "documentation/project_report.md"),
    ("train_multilabel.py", "train_multilabel.py"),
    ("scripts/train_million_scale.py", "scripts/train_million_scale.py"),
    ("scripts/download_full_million_dataset.py", "scripts/download_full_million_dataset.py"),
    ("tests/test_scanner.py", "tests/test_scanner.py"),
    ("app/streamlit_app.py", "app/streamlit_app.py"),
    ("examples/universal_middleware.py", "examples/universal_middleware.py"),
]

DIRECTORIES_TO_INCLUDE = [
    ("prompt_guard", "prompt_guard"),
]

def create_zips():
    for out_zip in OUTPUT_ZIPS:
        os.makedirs(os.path.dirname(out_zip), exist_ok=True)
        with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            for src, arc in FILES_TO_INCLUDE:
                if os.path.exists(src):
                    zf.write(src, arc)
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

        size = os.path.getsize(out_zip)
        print(f"[✓] Successfully created {out_zip} ({size:,} bytes)")

if __name__ == "__main__":
    create_zips()

