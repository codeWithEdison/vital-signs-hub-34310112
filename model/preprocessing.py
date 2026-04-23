"""Cleaning, outlier handling, and categorical encoding."""

from __future__ import annotations

import pandas as pd
from sklearn.preprocessing import OneHotEncoder


# Plausible clinical bounds for flagging extreme values (adjust for your population/device).
BOUNDS = {
    "temperature": (30.0, 42.0),
    "heart_rate": (35, 220),
    "spo2": (70, 100),
}


def coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    numeric = ["temperature", "heart_rate", "spo2"]
    for c in numeric:
        if c in out.columns:
            out[c] = pd.to_numeric(out[c], errors="coerce")
    return out


def drop_invalid_rows(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Drop rows with missing vitals; return (clean, removed)."""
    cols = ["temperature", "heart_rate", "spo2"]
    mask = df[cols].notna().all(axis=1)
    return df.loc[mask].copy(), df.loc[~mask].copy()


def flag_outliers_iqr(df: pd.DataFrame, columns: list[str], k: float = 1.5) -> pd.Series:
    """Per-column IQR mask; row is flagged if any selected column is an outlier."""
    flags = pd.Series(False, index=df.index)
    for col in columns:
        if col not in df.columns:
            continue
        s = df[col]
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        low, high = q1 - k * iqr, q3 + k * iqr
        flags = flags | (s < low) | (s > high)
    return flags


def flag_extreme_clinical(df: pd.DataFrame) -> pd.Series:
    """True where any vital is outside BOUNDS."""
    m = pd.Series(False, index=df.index)
    for col, (lo, hi) in BOUNDS.items():
        if col not in df.columns:
            continue
        m = m | (df[col] < lo) | (df[col] > hi)
    return m


def clean_frame(
    df: pd.DataFrame,
    *,
    drop_iqr_outliers: bool = False,
    drop_clinical_extreme: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """Return cleaned DataFrame and a report dict."""
    report: dict = {"initial_rows": len(df)}
    d = coerce_types(df)
    d, removed = drop_invalid_rows(d)
    report["rows_after_drop_na"] = len(d)
    report["removed_invalid"] = len(removed)

    if drop_clinical_extreme and len(d):
        bad = flag_extreme_clinical(d)
        report["clinical_extreme_count"] = int(bad.sum())
        d = d.loc[~bad].copy()

    if drop_iqr_outliers and len(d):
        cols = [c for c in ("temperature", "heart_rate", "spo2") if c in d.columns]
        bad = flag_outliers_iqr(d, cols)
        report["iqr_outlier_rows_removed"] = int(bad.sum())
        d = d.loc[~bad].copy()

    report["final_rows"] = len(d)
    return d, report


def one_hot_status(status: pd.Series) -> tuple[pd.DataFrame, OneHotEncoder]:
    """Binary/categorical indicators for status labels (fit on training slice in production)."""
    enc = OneHotEncoder(sparse_output=False, handle_unknown="ignore")
    mat = enc.fit_transform(status.astype(str).values.reshape(-1, 1))
    names = [f"status_{c}" for c in enc.categories_[0]]
    return pd.DataFrame(mat, columns=names, index=status.index), enc
