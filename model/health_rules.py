"""Threshold rules aligned with src/lib/healthLogic.ts and DEVICE_INTEGRATION_GUIDE.md."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

HealthStatus = Literal["SAFE", "WARNING", "ALERT"]


@dataclass(frozen=True)
class HealthEvaluation:
    status: HealthStatus
    recommendation: str


def evaluate_health(temperature: float, heart_rate: int, spo2: int) -> HealthEvaluation:
    if temperature > 38.0 or spo2 < 94:
        return HealthEvaluation(
            status="ALERT",
            recommendation="Visit the clinic immediately",
        )
    if heart_rate > 100:
        return HealthEvaluation(
            status="WARNING",
            recommendation="Rest and monitor your condition",
        )
    return HealthEvaluation(
        status="SAFE",
        recommendation="You are in good health",
    )


def rule_status_series(df):
    """Return a Series of rule-derived status for each row (expects columns temperature, heart_rate, spo2)."""
    import pandas as pd

    out = []
    for _, row in df.iterrows():
        out.append(
            evaluate_health(
                float(row["temperature"]),
                int(row["heart_rate"]),
                int(row["spo2"]),
            ).status
        )
    return pd.Series(out, index=df.index, name="rule_status")
