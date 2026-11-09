"""
PromptGuard Transformer Fine-Tuning Pipeline (PyTorch + Hugging Face)
Fulfills Part 4.2 & 4.4 of the Master Project Blueprint.
Optimized for Google Colab GPU (T4 / A100) or local CUDA workstations.

Run on Colab via:
    !python train_transformer.py --model_name microsoft/deberta-v3-base --batch_size 16 --epochs 3
"""

import argparse
import os

SCRIPT_TEMPLATE = """# ==============================================================================
# PROMPTGUARD: TRANSFORMER FINE-TUNING PIPELINE (DeBERTa-v3 / DistilBERT)
# University Individual Project • Artificial Intelligence & Cybersecurity
# ==============================================================================

# 1. Install prerequisites in Colab:
# !pip install -q transformers datasets accelerate evaluate torch scikit-learn

import torch
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding,
    EarlyStoppingCallback
)
import evaluate
import numpy as np

def main():
    MODEL_NAME = "{model_name}"
    OUTPUT_DIR = "./results_promptguard"
    
    print(f"[*] Initializing training with base model: {{MODEL_NAME}}")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[*] Compute device: {{device}} (GPU: {{torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}})")

    # 2. Load Public Security Dataset (Hlyn / deepset / WildJailbreak)
    print("[*] Downloading dataset from Hugging Face Hub: deepset/prompt-injections...")
    dataset = load_dataset("deepset/prompt-injections")
    
    # 3. Tokenizer initialization
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    def preprocess_function(examples):
        return tokenizer(examples["text"], truncation=True, max_length=256)

    tokenized_dataset = dataset.map(preprocess_function, batched=True)
    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    # 4. Metrics calculation
    f1_metric = evaluate.load("f1")
    acc_metric = evaluate.load("accuracy")
    precision_metric = evaluate.load("precision")
    recall_metric = evaluate.load("recall")

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        predictions = np.argmax(logits, axis=-1)
        return {{
            "accuracy": acc_metric.compute(predictions=predictions, references=labels)["accuracy"],
            "f1": f1_metric.compute(predictions=predictions, references=labels, average="macro")["f1"],
            "precision": precision_metric.compute(predictions=predictions, references=labels, average="macro")["precision"],
            "recall": recall_metric.compute(predictions=predictions, references=labels, average="macro")["recall"],
        }}

    # 5. Model with 2 output labels (Benign: 0, Attack: 1)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=2)
    model.to(device)

    # 6. Training Arguments per Blueprint Part 4.4
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        learning_rate=2e-5,
        per_device_train_batch_size={batch_size},
        per_device_eval_batch_size={batch_size},
        num_train_epochs={epochs},
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        fp16=torch.cuda.is_available(),
        logging_steps=50,
        report_to="none"
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset["train"],
        eval_dataset=tokenized_dataset["test"],
        tokenizer=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)]
    )

    # 7. Execute Training Loop
    print("[*] Starting transformer fine-tuning loop...")
    trainer.train()

    # 8. Save Fine-Tuned Weights
    final_model_dir = "./promptguard_deberta_model"
    trainer.save_model(final_model_dir)
    tokenizer.save_pretrained(final_model_dir)
    print(f"[✓] Best model and tokenizer saved to {{final_model_dir}}")

if __name__ == "__main__":
    main()
"""

def generate_script(model_name: str, batch_size: int, epochs: int):
    return SCRIPT_TEMPLATE.format(model_name=model_name, batch_size=batch_size, epochs=epochs)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_name", default="microsoft/deberta-v3-base")
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--epochs", type=int, default=3)
    args = parser.parse_args()

    content = generate_script(args.model_name, args.batch_size, args.epochs)
    with open("run_colab_training.py", "w") as f:
        f.write(content)
    print(f"Colab training script written to run_colab_training.py for {args.model_name}")
