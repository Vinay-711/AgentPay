"""Synthetic Agent Behavior Sequences Dataset Generator.

Generates normal spending patterns (consistent payments, low volatility)
vs anomalous patterns (sudden spikes, flash-drain, rapid frequency bursts).
"""

import numpy as np
import pandas as pd
from typing import List, Tuple


def extract_sequence_features(amounts: List[float]) -> List[float]:
    """Extract statistical summary features from a sequence of transaction amounts.

    Features:
    0: mean
    1: std
    2: max
    3: min
    4: max_to_mean_ratio
    5: diff_std (volatility of consecutive step changes)
    6: sum_total
    """
    arr = np.array(amounts, dtype=float)
    if len(arr) == 0:
        return [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0]
    if len(arr) == 1:
        return [float(arr[0]), 0.0, float(arr[0]), float(arr[0]), 1.0, 0.0, float(arr[0])]

    mean_val = float(np.mean(arr))
    std_val = float(np.std(arr))
    max_val = float(np.max(arr))
    min_val = float(np.min(arr))
    ratio = max_val / (mean_val + 1e-6)
    diffs = np.diff(arr)
    diff_std = float(np.std(diffs))
    total = float(np.sum(arr))

    return [mean_val, std_val, max_val, min_val, ratio, diff_std, total]


def generate_behavior_dataset(
    n_normal: int = 4000, n_anomalous: int = 500, seq_len: int = 8, random_seed: int = 42
) -> Tuple[pd.DataFrame, np.ndarray]:
    """Generate synthetic behavioral sequence features with anomaly labels (1 = normal, -1 = anomaly)."""
    np.random.seed(random_seed)

    features = []
    labels = []

    # 1. Normal Sequences: Low variance, steady increments
    for _ in range(n_normal):
        base_level = np.random.uniform(0.01, 0.10)
        noise = np.random.normal(0, base_level * 0.15, seq_len)
        seq = np.maximum(0.001, base_level + noise)
        feat = extract_sequence_features(seq.tolist())
        features.append(feat)
        labels.append(1)  # Normal

    # 2. Anomalous Sequences: Spikes, Drains, Bursts
    for _ in range(n_anomalous):
        anomaly_type = np.random.choice(["spike", "burst", "drain"])
        base_level = np.random.uniform(0.01, 0.08)
        seq = np.random.normal(base_level, base_level * 0.1, seq_len)

        if anomaly_type == "spike":
            spike_idx = np.random.randint(1, seq_len)
            seq[spike_idx] *= np.random.uniform(8.0, 30.0)
        elif anomaly_type == "burst":
            seq = seq * np.random.uniform(4.0, 10.0)
        elif anomaly_type == "drain":
            seq[-1] = np.random.uniform(2.0, 10.0)

        seq = np.maximum(0.001, seq)
        feat = extract_sequence_features(seq.tolist())
        features.append(feat)
        labels.append(-1)  # Anomaly

    cols = ["mean", "std", "max", "min", "max_to_mean_ratio", "diff_std", "sum_total"]
    df = pd.DataFrame(features, columns=cols)
    y = np.array(labels)

    return df, y


if __name__ == "__main__":
    df, y = generate_behavior_dataset()
    print(f"Generated {len(df)} sequences. Anomaly count: {sum(y == -1)}")
    print(df.describe())
