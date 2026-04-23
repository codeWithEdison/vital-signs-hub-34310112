"""Summary statistics, grouping, and correlation."""

from __future__ import annotations

import pandas as pd


def numeric_summary(df: pd.DataFrame, cols: list[str] | None = None) -> pd.DataFrame:
    cols = cols or ["temperature", "heart_rate", "spo2"]
    present = [c for c in cols if c in df.columns]
    return df[present].describe()


def status_value_counts(df: pd.DataFrame, col: str = "rule_status") -> pd.Series:
    if col not in df.columns:
        return pd.Series(dtype=int)
    return df[col].value_counts()


def group_stats_by_status(df: pd.DataFrame, status_col: str = "rule_status") -> pd.DataFrame:
    metrics = [c for c in ("temperature", "heart_rate", "spo2") if c in df.columns]
    if status_col not in df.columns or not metrics:
        return pd.DataFrame()
    return df.groupby(status_col, observed=True)[metrics].agg(["mean", "std", "count"])


def correlation_matrix(df: pd.DataFrame) -> pd.DataFrame:
    metrics = [c for c in ("temperature", "heart_rate", "spo2") if c in df.columns]
    if len(metrics) < 2:
        return pd.DataFrame()
    return df[metrics].corr()
