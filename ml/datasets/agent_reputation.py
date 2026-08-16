"""Agent Reputation Scoring & Synthetic History Generator.

Transparent, deterministic 6-factor reputation engine (0 - 100):
  1. Success Rate (30%): (completed / total_jobs) * 30
  2. Transaction History (20%): Volume of completed jobs scaled to 100 jobs
  3. Client Ratings (20%): Average rating (1.0 - 5.0) normalized to 20 pts
  4. Account Age (10%): Age in days scaled to 90 days maturity
  5. Client Diversity (10%): Ratio of unique clients to total jobs
  6. Dispute History (10%): Penalty for unresolved disputes (-2 pts each)
"""

import numpy as np
import pandas as pd
from typing import Dict, Any


def compute_reputation_score(stats: Dict[str, Any]) -> int:
    """Calculate transparent reputation score (0 - 100) from historical metrics.

    Args:
        stats: Dictionary containing:
            - jobs_completed (int)
            - jobs_failed (int)
            - ratings (float, 1.0 - 5.0, default 4.0)
            - account_age (int, days, default 30)
            - unique_clients (int, default None)
            - disputes (int, default 0)

    Returns:
        int: Reputation score clamped between 0 and 100.
             Default for brand new agents with zero history is 50.
    """
    completed = int(stats.get("jobs_completed", 0))
    failed = int(stats.get("jobs_failed", 0))
    total_jobs = completed + failed

    # Brand new agents default to baseline score of 50
    if total_jobs == 0 and int(stats.get("account_age", 0)) == 0:
        return 50

    # 1. Success Rate Component (30 pts)
    if total_jobs > 0:
        success_ratio = completed / total_jobs
        score_success = success_ratio * 30.0
    else:
        score_success = 15.0  # Neutral baseline

    # 2. Transaction History Scale (20 pts)
    # Logarithmic saturation up to 100 jobs
    score_history = min(20.0, (completed / 100.0) * 20.0)

    # 3. Client Ratings (20 pts)
    rating = float(stats.get("ratings", 4.0))
    rating_clamped = max(1.0, min(5.0, rating))
    score_ratings = ((rating_clamped - 1.0) / 4.0) * 20.0

    # 4. Account Age (10 pts)
    # Reaches max points after 90 days
    age_days = int(stats.get("account_age", 30))
    score_age = min(10.0, (age_days / 90.0) * 10.0)

    # 5. Client Diversity & Volume Consistency (10 pts)
    unique_clients = int(stats.get("unique_clients", max(1, completed // 2)))
    diversity_ratio = min(1.0, unique_clients / (completed + 1))
    score_diversity = diversity_ratio * 10.0

    # 6. Dispute History (10 pts)
    disputes = int(stats.get("disputes", 0))
    score_disputes = max(0.0, 10.0 - (disputes * 2.5))

    total_score = (
        score_success
        + score_history
        + score_ratings
        + score_age
        + score_diversity
        + score_disputes
    )

    return int(round(max(0, min(100, total_score))))


def generate_agent_reputation_dataset(n_agents: int = 1000, random_seed: int = 42) -> pd.DataFrame:
    """Generate synthetic agent performance profiles with computed reputation scores."""
    np.random.seed(random_seed)

    jobs_completed = np.random.geometric(p=0.03, size=n_agents) - 1
    fail_rate = np.random.beta(a=1.0, b=20.0, size=n_agents)
    jobs_failed = np.random.binomial(jobs_completed + 1, fail_rate)

    total_jobs = jobs_completed + jobs_failed
    success_rate = np.where(total_jobs > 0, np.round((jobs_completed / total_jobs) * 100.0, 2), 100.0)

    avg_transaction = np.random.exponential(scale=0.05, size=n_agents) + 0.005
    total_volume = np.round(jobs_completed * avg_transaction, 4)

    ratings = np.random.beta(a=8.0, b=2.0, size=n_agents) * 4.0 + 1.0
    account_age = np.random.exponential(scale=180, size=n_agents).astype(int) + 1
    account_age = np.clip(account_age, 1, 730)

    unique_clients = np.minimum(jobs_completed, np.random.poisson(lam=np.maximum(1, jobs_completed // 2)))
    disputes = np.random.poisson(lam=0.2, size=n_agents)

    scores = []
    for i in range(n_agents):
        row = {
            "jobs_completed": jobs_completed[i],
            "jobs_failed": jobs_failed[i],
            "ratings": ratings[i],
            "account_age": account_age[i],
            "unique_clients": unique_clients[i],
            "disputes": disputes[i],
        }
        scores.append(compute_reputation_score(row))

    df = pd.DataFrame({
        "jobs_completed": jobs_completed,
        "jobs_failed": jobs_failed,
        "success_rate": success_rate,
        "total_volume_eth": total_volume,
        "avg_transaction_eth": np.round(avg_transaction, 4),
        "ratings": np.round(ratings, 2),
        "account_age_days": account_age,
        "unique_clients": unique_clients,
        "disputes": disputes,
        "reputation_score": scores,
    })

    return df


if __name__ == "__main__":
    df = generate_agent_reputation_dataset(500)
    print("Sample Agent Reputation Dataset:")
    print(df.head(10))
    print("\nReputation Score Summary:")
    print(df["reputation_score"].describe())
