"""Synthetic Transaction Risk Dataset Generator.

Generates 6,000+ synthetic transaction records with realistic distributions,
edge cases, clear heuristic labeling, and injected noise for training
lightweight tabular risk models.
"""

import numpy as np
import pandas as pd
from pathlib import Path


def generate_transaction_dataset(n_samples: int = 6500, random_seed: int = 42) -> pd.DataFrame:
    """Generate synthetic transaction risk dataset.

    Features:
    - transaction_amount: Amount in ETH (0.005 to 5.0)
    - daily_spending: Current spend today in ETH
    - remaining_budget: Remaining daily budget
    - transaction_limit: Max allowed per-transaction in ETH
    - agent_reputation: 0 to 100
    - recipient_reputation: 0 to 100
    - recipient_age: Age of recipient in days (0 to 730)
    - previous_transactions: Count of past successful txs (0 to 1000)
    - failed_transactions: Count of failed txs (0 to 100)
    - transaction_frequency: Txs per hour (0.1 to 30.0)
    - task_similarity: Cosine similarity to declared task (0.0 to 1.0)
    - recipient_verified: 1 if verified, 0 otherwise
    - contract_verified: 1 if verified bytecode/source, 0 otherwise
    - time_since_last_transaction: Seconds (1 to 86400)
    - label: 0 for ALLOW, 1 for BLOCK
    """
    np.random.seed(random_seed)

    # 1. Generate base features
    daily_limit = np.random.uniform(1.0, 10.0, n_samples)
    transaction_limit = daily_limit * np.random.uniform(0.1, 0.4, n_samples)
    daily_spending = daily_limit * np.random.beta(a=1.5, b=2.5, size=n_samples)
    remaining_budget = np.maximum(0.0, daily_limit - daily_spending)

    # Transaction amount: mixture of normal small payments and occasional huge spikes
    is_spike = np.random.binomial(1, 0.12, n_samples)
    normal_amounts = np.random.exponential(scale=0.08, size=n_samples) + 0.005
    spike_amounts = np.random.uniform(1.0, 5.0, n_samples)
    transaction_amount = np.where(is_spike == 1, spike_amounts, normal_amounts)
    transaction_amount = np.round(transaction_amount, 4)

    agent_reputation = np.random.beta(a=5.0, b=1.5, size=n_samples) * 100.0
    recipient_reputation = np.random.beta(a=3.5, b=2.0, size=n_samples) * 100.0

    recipient_age = np.random.exponential(scale=120, size=n_samples).astype(int)
    recipient_age = np.clip(recipient_age, 0, 730)

    previous_transactions = np.random.poisson(lam=40, size=n_samples)
    fail_rate = np.random.beta(a=1.0, b=15.0, size=n_samples)
    failed_transactions = np.random.binomial(previous_transactions + 5, fail_rate)

    transaction_frequency = np.random.gamma(shape=2.0, scale=1.5, size=n_samples)
    task_similarity = np.random.beta(a=6.0, b=1.5, size=n_samples)

    recipient_verified = (recipient_reputation > 65).astype(int)
    # Randomly introduce unverified recipients
    recipient_verified = np.where(np.random.rand(n_samples) < 0.25, 0, recipient_verified)

    contract_verified = (recipient_age > 30).astype(int)
    contract_verified = np.where(np.random.rand(n_samples) < 0.2, 0, contract_verified)

    time_since_last_transaction = np.random.exponential(scale=3600, size=n_samples) + 2.0
    time_since_last_transaction = np.clip(time_since_last_transaction, 1.0, 86400.0)

    # 2. Heuristic Ground Truth Calculation
    risk_score = np.zeros(n_samples)

    # Hard Limit Violations
    risk_score += np.where(transaction_amount > transaction_limit, 0.45, 0.0)
    risk_score += np.where(transaction_amount > remaining_budget, 0.40, 0.0)

    # Suspicious Recipient
    risk_score += np.where((recipient_reputation < 35) & (recipient_age < 14), 0.35, 0.0)
    risk_score += np.where((recipient_verified == 0) & (contract_verified == 0), 0.15, 0.0)

    # Failure / Anomaly Patterns
    failure_ratio = failed_transactions / (previous_transactions + 1)
    risk_score += np.where(failure_ratio > 0.25, 0.25, 0.0)
    risk_score += np.where(task_similarity < 0.40, 0.20, 0.0)
    risk_score += np.where((time_since_last_transaction < 10) & (transaction_frequency > 12.0), 0.25, 0.0)

    # Mitigating factors
    risk_score -= np.where((agent_reputation > 85) & (recipient_reputation > 80), 0.20, 0.0)
    risk_score -= np.where((recipient_verified == 1) & (previous_transactions > 50), 0.15, 0.0)

    # Add realistic Gaussian noise
    noise = np.random.normal(0, 0.08, n_samples)
    final_risk = risk_score + noise

    # Label: 1 for BLOCK, 0 for ALLOW
    label = (final_risk > 0.45).astype(int)

    # Random 4% label flip for non-separable noise
    flip_mask = np.random.rand(n_samples) < 0.04
    label = np.where(flip_mask, 1 - label, label)

    df = pd.DataFrame({
        "transaction_amount": transaction_amount,
        "daily_spending": np.round(daily_spending, 4),
        "remaining_budget": np.round(remaining_budget, 4),
        "transaction_limit": np.round(transaction_limit, 4),
        "agent_reputation": np.round(agent_reputation, 2),
        "recipient_reputation": np.round(recipient_reputation, 2),
        "recipient_age": recipient_age,
        "previous_transactions": previous_transactions,
        "failed_transactions": failed_transactions,
        "transaction_frequency": np.round(transaction_frequency, 2),
        "task_similarity": np.round(task_similarity, 3),
        "recipient_verified": recipient_verified,
        "contract_verified": contract_verified,
        "time_since_last_transaction": np.round(time_since_last_transaction, 1),
        "label": label,
    })

    return df


if __name__ == "__main__":
    df = generate_transaction_dataset()
    out_dir = Path(__file__).parent
    csv_path = out_dir / "transaction_risk_dataset.csv"
    df.to_csv(csv_path, index=False)
    print(f"Generated {len(df)} rows. Saved to {csv_path}")
    print("Label distribution:")
    print(df["label"].value_counts(normalize=True))
