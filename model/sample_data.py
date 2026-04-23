"""Generate synthetic vitals CSV for offline analysis when no Supabase export exists."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from health_rules import evaluate_health


def make_synthetic_vitals(n: int = 400, random_state: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(random_state)
    rows = []
    for i in range(n):
        # Mixture: mostly normal, some warning (high HR), some alert (fever or low SpO2)
        u = rng.random()
        if u < 0.65:
            temperature = float(rng.normal(36.5, 0.35))
            heart_rate = int(rng.integers(60, 95))
            spo2 = int(rng.integers(95, 100))
        elif u < 0.85:
            temperature = float(rng.normal(36.6, 0.3))
            heart_rate = int(rng.integers(105, 125))
            spo2 = int(rng.integers(94, 99))
        else:
            if rng.random() < 0.5:
                temperature = float(rng.uniform(38.1, 39.5))
                heart_rate = int(rng.integers(70, 110))
            else:
                temperature = float(rng.normal(36.8, 0.4))
                heart_rate = int(rng.integers(65, 95))
            spo2 = int(rng.integers(88, 93))

        temperature = round(temperature, 2)
        ev = evaluate_health(temperature, heart_rate, spo2)
        rows.append(
            {
                "id": str(rng.integers(1_000_000, 9_999_999)),
                "temperature": temperature,
                "heart_rate": heart_rate,
                "spo2": spo2,
                "status": ev.status,
                "recommendation": ev.recommendation,
                "created_at": pd.Timestamp.utcnow().isoformat(),
            }
        )
    return pd.DataFrame(rows)


def ensure_sample_csv(path: Path, n: int = 400) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df = make_synthetic_vitals(n=n)
    df.to_csv(path, index=False)
