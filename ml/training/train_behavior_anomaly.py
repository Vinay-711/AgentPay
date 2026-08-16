"""Train Isolation Forest for Agent Spending Sequence Anomaly Detection."""

from pathlib import Path
import pickle
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report, roc_auc_score

import sys
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from ml.datasets.agent_behavior import generate_behavior_dataset, extract_sequence_features


def train_and_save_model():
    print("Generating synthetic behavioral sequences...")
    df, y = generate_behavior_dataset(n_normal=4500, n_anomalous=500, random_seed=42)

    X = df.values

    print(f"Fitting IsolationForest on {len(X)} sequence summaries...")
    model = IsolationForest(
        n_estimators=100,
        contamination=0.10,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)

    # Evaluate
    y_pred = model.predict(X)
    raw_scores = model.decision_function(X)  # Higher is more normal, lower is more anomalous

    # Invert scores for AUC (higher = more anomalous)
    anomaly_scores = -raw_scores
    auc = roc_auc_score((y == -1).astype(int), anomaly_scores)

    print("\n=== BEHAVIOR ANOMALY MODEL REPORT ===")
    print(classification_report(y, y_pred, target_names=["Anomaly (-1)", "Normal (1)"]))
    print(f"ROC-AUC: {auc:.4f}")

    # Save pickle
    models_dir = Path(__file__).resolve().parent.parent / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    pkl_path = models_dir / "behavior_anomaly.pkl"

    with open(pkl_path, "wb") as f:
        pickle.dump(model, f)

    print(f"Saved Isolation Forest model to {pkl_path}")
    return auc


if __name__ == "__main__":
    train_and_save_model()
