"""Train Lightweight XGBoost Model for Transaction Risk.

Fast inference (<5ms) using XGBClassifier, saved to JSON format.
"""

from pathlib import Path
import json
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

import sys
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from ml.datasets.transaction_risk import generate_transaction_dataset

def train_and_evaluate():
    print("Generating synthetic dataset (6,500 rows)...")
    df = generate_transaction_dataset(n_samples=6500, random_seed=42)

    feature_cols = [
        "transaction_amount",
        "daily_spending",
        "remaining_budget",
        "transaction_limit",
        "agent_reputation",
        "recipient_reputation",
        "recipient_age",
        "previous_transactions",
        "failed_transactions",
        "transaction_frequency",
        "task_similarity",
        "recipient_verified",
        "contract_verified",
        "time_since_last_transaction",
    ]

    X = df[feature_cols]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"Training XGBoost on {len(X_train)} samples, testing on {len(X_test)} samples...")

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        eval_metric="logloss",
        random_state=42,
        tree_method="hist",
    )

    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)

    print("\n=== TRANSACTION RISK MODEL PERFORMANCE ===")
    print(f"Accuracy:  {acc:.4f}")
    print(f"Precision: {prec:.4f}")
    print(f"Recall:    {rec:.4f}")
    print(f"F1 Score:  {f1:.4f}")
    print(f"ROC-AUC:   {auc:.4f}")

    # Save model and metadata
    models_dir = Path(__file__).resolve().parent.parent / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    model_path = models_dir / "transaction_risk.json"
    model.save_model(str(model_path))

    meta_path = models_dir / "transaction_risk_meta.json"
    meta = {
        "features": feature_cols,
        "metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(auc, 4),
        },
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nModel saved successfully to: {model_path}")
    return acc, prec, rec, f1, auc


if __name__ == "__main__":
    train_and_evaluate()
