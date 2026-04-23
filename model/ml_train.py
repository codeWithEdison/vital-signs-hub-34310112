"""Train and compare classifiers against rule-derived labels."""

from __future__ import annotations

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, LabelEncoder


FEATURES = ["temperature", "heart_rate", "spo2"]


def build_preprocess() -> ColumnTransformer:
    return ColumnTransformer(
        [("scale", StandardScaler(), FEATURES)],
        remainder="drop",
    )


def train_and_evaluate(df: pd.DataFrame, target_col: str = "rule_status", random_state: int = 42):
    """Fit several models; return dict of metrics and fitted pipelines."""
    X = df[FEATURES]
    y = df[target_col].astype(str)
    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.25, stratify=y_enc, random_state=random_state
    )

    models = {
        "logistic_regression": LogisticRegression(
            max_iter=1000,
            random_state=random_state,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=200,
            random_state=random_state,
            class_weight="balanced",
        ),
        "knn_k5": KNeighborsClassifier(n_neighbors=5, weights="distance"),
    }

    results = {}
    fitted = {}

    for name, clf in models.items():
        pipe = Pipeline(
            [
                ("prep", build_preprocess()),
                ("clf", clf),
            ]
        )
        pipe.fit(X_train, y_train)
        pred = pipe.predict(X_test)
        acc = accuracy_score(y_test, pred)
        report = classification_report(
            y_test,
            pred,
            target_names=le.classes_,
            zero_division=0,
        )
        results[name] = {"accuracy": acc, "report": report}
        fitted[name] = pipe

    return {
        "label_encoder": le,
        "results": results,
        "models": fitted,
        "X_test": X_test,
        "y_test": y_test,
    }
