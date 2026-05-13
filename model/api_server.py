"""FastAPI endpoint for model inference and Supabase persistence."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from supabase import Client, create_client

from predict_final import load_bundle, predict_hybrid

_SERVER_ENV_FILE = Path(__file__).resolve().parent / ".env.server"


def _load_local_server_env() -> None:
    """Load key=value pairs from model/.env.server if present."""
    if not _SERVER_ENV_FILE.exists():
        return
    for raw_line in _SERVER_ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        # Do not override already-exported env vars from the shell.
        os.environ.setdefault(key, value)


_load_local_server_env()


class PredictRequest(BaseModel):
    temperature: float = Field(..., description="Body temperature in Celsius")
    heart_rate: int = Field(..., ge=0)
    spo2: int = Field(..., ge=0)


class PredictAndPersistRequest(PredictRequest):
    vital_id: str = Field(..., description="UUID from public.vitals.id")


def _build_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, service_key)


app = FastAPI(title="Vitals Prediction API", version="1.0.0")
_bundle: dict[str, Any] | None = None
_bundle_error: str | None = None
_supabase = _build_supabase()


def _ensure_bundle_loaded() -> dict[str, Any]:
    global _bundle, _bundle_error
    if _bundle is not None:
        return _bundle
    try:
        _bundle = load_bundle(Path(__file__).resolve().parent / "model_bundle.joblib")
        _bundle_error = None
        return _bundle
    except Exception as exc:
        _bundle_error = str(exc)
        raise HTTPException(
            status_code=503,
            detail=(
                "Model bundle failed to load. Rebuild model_bundle.joblib with current sklearn. "
                f"Original error: {exc}"
            ),
        ) from exc


@app.get("/health")
def health() -> dict[str, str]:
    if _bundle_error:
        return {"status": "degraded", "bundle": "error"}
    return {"status": "ok", "bundle": "ready"}


@app.post("/predict")
def predict(payload: PredictRequest) -> dict[str, Any]:
    bundle = _ensure_bundle_loaded()
    return predict_hybrid(
        bundle,
        temperature=payload.temperature,
        heart_rate=payload.heart_rate,
        spo2=payload.spo2,
    )


@app.post("/predict-and-persist")
def predict_and_persist(payload: PredictAndPersistRequest) -> dict[str, Any]:
    bundle = _ensure_bundle_loaded()
    result = predict_hybrid(
        bundle,
        temperature=payload.temperature,
        heart_rate=payload.heart_rate,
        spo2=payload.spo2,
    )

    update_payload = {
        "model_status": result["model_status"],
        "final_status": result["final_status"],
        "model_confidence": result["model_confidence"],
        "decision_source": result["decision_source"],
        "recommendation": result["recommendation"],
        # Keep current dashboard compatibility by mirroring final decision to status.
        "status": result["final_status"],
        "model_updated_at": datetime.now(timezone.utc).isoformat(),
    }

    response = (
        _supabase.table("vitals")
        .update(update_payload)
        .eq("id", payload.vital_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail=f"Vital record not found: {payload.vital_id}")

    return {"vital_id": payload.vital_id, **result}
