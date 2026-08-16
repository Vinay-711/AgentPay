"""Unified ML Inference Engine for AgentGuard.

Exposes low-latency (<5ms) evaluation functions for:
1. score_transaction(features: dict) -> float
2. compute_reputation(agent_stats: dict) -> int
3. score_behavior(amounts: list[float]) -> dict
4. classify_intent(text: str) -> dict
"""

from pathlib import Path
import json
import pickle
from typing import Dict, Any, List, Optional
import numpy as np

# Global cached model singletons
_MODELS_DIR = Path(__file__).resolve().parent / "models"
_TX_MODEL = None
_BEHAVIOR_MODEL = None
_PROMPT_MODEL = None


def _get_tx_model():
    global _TX_MODEL
    if _TX_MODEL is None:
        import xgboost as xgb
        model_path = _MODELS_DIR / "transaction_risk.json"
        if not model_path.exists():
            from ml.training.train_transaction_risk import train_and_evaluate
            train_and_evaluate()
        model = xgb.XGBClassifier()
        model.load_model(str(model_path))
        _TX_MODEL = model
    return _TX_MODEL


def _get_behavior_model():
    global _BEHAVIOR_MODEL
    if _BEHAVIOR_MODEL is None:
        pkl_path = _MODELS_DIR / "behavior_anomaly.pkl"
        if not pkl_path.exists():
            from ml.training.train_behavior_anomaly import train_and_save_model
            train_and_save_model()
        with open(pkl_path, "rb") as f:
            _BEHAVIOR_MODEL = pickle.load(f)
    return _BEHAVIOR_MODEL


def _get_prompt_model():
    global _PROMPT_MODEL
    if _PROMPT_MODEL is None:
        pkl_path = _MODELS_DIR / "prompt_injection.pkl"
        if not pkl_path.exists():
            from ml.training.train_prompt_injection import train_and_save_prompt_classifier
            train_and_save_prompt_classifier()
        with open(pkl_path, "rb") as f:
            _PROMPT_MODEL = pickle.load(f)
    return _PROMPT_MODEL


def score_transaction(features: Dict[str, Any]) -> float:
    """Evaluate tabular risk score for a transaction.

    Args:
        features: Dictionary of transaction metrics.

    Returns:
        float: Risk probability between 0.0 (safest) and 1.0 (highest risk).
    """
    model = _get_tx_model()

    feature_order = [
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

    row = []
    for f in feature_order:
        val = features.get(f, 0.0)
        row.append(float(val))

    X = np.array([row], dtype=float)
    probs = model.predict_proba(X)
    risk_score = float(probs[0, 1])
    return round(risk_score, 4)


def compute_reputation(agent_stats: Dict[str, Any]) -> int:
    """Compute deterministic 6-factor reputation score (0 - 100)."""
    from ml.datasets.agent_reputation import compute_reputation_score
    return compute_reputation_score(agent_stats)


def score_behavior(amounts: List[float]) -> Dict[str, Any]:
    """Score spending sequence for anomalous bursts or draining patterns.

    Args:
        amounts: List of recent transaction amounts in ETH.

    Returns:
        dict: {"is_anomalous": bool, "score": float}
    """
    from ml.datasets.agent_behavior import extract_sequence_features
    model = _get_behavior_model()

    feats = extract_sequence_features(amounts)
    X = np.array([feats], dtype=float)

    pred = model.predict(X)[0]  # 1 = Normal, -1 = Anomaly
    raw_score = float(model.decision_function(X)[0])

    # Convert decision function to normalized 0-1 anomaly score (higher = more anomalous)
    # Decision function typical range: -0.5 to 0.5
    anomaly_score = float(np.clip(0.5 - raw_score, 0.0, 1.0))

    return {
        "is_anomalous": bool(pred == -1),
        "score": round(anomaly_score, 4),
    }


def classify_intent(text: str) -> Dict[str, Any]:
    """Classify user / task prompt into SAFE, SUSPICIOUS, or MALICIOUS.

    Args:
        text: Prompt or task reason string.

    Returns:
        dict: {"category": str, "confidence": float, "is_injection": bool}
    """
    if not text or not text.strip():
        return {"category": "SAFE", "confidence": 1.0, "is_injection": False}

    pipeline = _get_prompt_model()
    probs = pipeline.predict_proba([text])[0]
    classes = pipeline.classes_

    best_idx = int(np.argmax(probs))
    category = str(classes[best_idx])
    confidence = float(probs[best_idx])

    is_injection = category == "MALICIOUS"

    return {
        "category": category,
        "confidence": round(confidence, 4),
        "is_injection": is_injection,
    }
