"""Bootstrap-style dataset expansion with NumPy (sampling rows with replacement)."""

from __future__ import annotations

import numpy as np
import pandas as pd


def bootstrap_expand(df: pd.DataFrame, n_rows: int, random_state: int | None = 42) -> pd.DataFrame:
    """
    Build a larger DataFrame by sampling existing rows with replacement.
    Preserves column structure; numeric/string columns copied from sampled rows.
    """
    if len(df) == 0:
        raise ValueError("Cannot augment an empty DataFrame")
    rng = np.random.default_rng(random_state)
    idx = rng.integers(0, len(df), size=n_rows)
    return df.iloc[idx].reset_index(drop=True)
