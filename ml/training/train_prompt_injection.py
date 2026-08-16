"""Train Lightweight TF-IDF + Logistic Regression Prompt Injection Classifier."""

from pathlib import Path
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

import sys
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from ml.datasets.prompt_injection import generate_prompt_dataset


def train_and_save_prompt_classifier():
    print("Generating synthetic prompt dataset (2,400 samples)...")
    df = generate_prompt_dataset(n_samples=2400, random_seed=42)

    X_train, X_test, y_train, y_test = train_test_split(
        df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
    )

    print(f"Training TF-IDF + LogisticRegression on {len(X_train)} samples...")

    pipeline = Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                ngram_range=(1, 2),
                max_features=3000,
                lowercase=True,
                strip_accents="unicode",
            ),
        ),
        (
            "clf",
            LogisticRegression(
                C=3.0,
                max_iter=1000,
                random_state=42,
                class_weight="balanced",
            ),
        ),
    ])

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    print("\n=== PROMPT INJECTION CLASSIFIER REPORT ===")
    print(classification_report(y_test, y_pred))
    print(f"Accuracy: {acc:.4f}")

    # Save pipeline
    models_dir = Path(__file__).resolve().parent.parent / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    pkl_path = models_dir / "prompt_injection.pkl"

    with open(pkl_path, "wb") as f:
        pickle.dump(pipeline, f)

    print(f"Saved prompt injection model to {pkl_path}")
    return acc


if __name__ == "__main__":
    train_and_save_prompt_classifier()
