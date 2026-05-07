"""Load saved model and run hybrid decision logic."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import joblib
import pandas as pd

from health_rules import evaluate_health

HealthStatus = Literal["SAFE", "OBSERVE", "WARNING", "ALERT", "CRITICAL"]


def load_bundle(path: str | Path = "model_bundle.joblib") -> dict:
    return joblib.load(Path(path))


def predict_model_status(bundle: dict, temperature: float, heart_rate: int, spo2: int) -> tuple[HealthStatus, float]:
    model = bundle["model"]
    label_encoder = bundle["label_encoder"]
    X = pd.DataFrame([
        {"temperature": float(temperature), "heart_rate": int(heart_rate), "spo2": int(spo2)}
    ])

    pred_idx = model.predict(X)[0]
    pred_status = label_encoder.inverse_transform([pred_idx])[0]

    confidence = 0.0
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)[0]
        confidence = float(max(probs))

    return pred_status, confidence


def predict_hybrid(bundle: dict, temperature: float, heart_rate: int, spo2: int) -> dict:
    """
    Safety-first decision:
      - If explicit rule says CRITICAL or ALERT, keep it.
      - Otherwise use selected ML model prediction.
    """
    rule_eval = evaluate_health(float(temperature), int(heart_rate), int(spo2))
    model_status, confidence = predict_model_status(bundle, temperature, heart_rate, spo2)

    if rule_eval.status in ("CRITICAL", "ALERT"):
        final_status = rule_eval.status
        source = "rule_override"
    else:
        final_status = model_status
        source = "model"

    return {
        "input": {"temperature": float(temperature), "heart_rate": int(heart_rate), "spo2": int(spo2)},
        "rule_status": rule_eval.status,
        "model_status": model_status,
        "model_confidence": confidence,
        "final_status": final_status,
        "decision_source": source,
        "recommendation": evaluate_health(float(temperature), int(heart_rate), int(spo2)).recommendation,
    }


if __name__ == "__main__":
    bundle = load_bundle()
    sample = predict_hybrid(bundle, temperature=37.2, heart_rate=104, spo2=96)
    print(sample)
