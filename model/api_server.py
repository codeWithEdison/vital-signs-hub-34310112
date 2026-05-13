"""FastAPI endpoint for model inference and Supabase persistence.

Environment (Supabase admin client):
- Primary: ``SUPABASE_URL`` and ``SUPABASE_SERVICE_ROLE_KEY`` on the **process**
  environment (Docker, systemd, Railway, Render, Fly, etc.). These always win over
  any file.
- Optional local dev: ``model/.env.server`` is read only for keys **not** already
  set in the environment (same names as Supabase Edge Functions / dashboard API
  settings).

Lovable Cloud **Secrets** are injected into Lovable-managed backends (for example
Edge Functions), not into a Python ``uvicorn`` process on your laptop. To avoid a
local file entirely: deploy this API somewhere that supports env vars and set the
two variables there, or move the persist step into a Lovable / Supabase Edge
Function and keep using the same secret names there.

Set ``SKIP_ENV_SERVER_FILE=1`` (or ``true``) to ignore ``.env.server`` completely
(e.g. production containers).
"""

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


def _truthy_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def _load_local_server_env() -> None:
    """Load key=value pairs from model/.env.server if present (fills gaps only)."""
    if _truthy_env("SKIP_ENV_SERVER_FILE"):
        return
    if not _SERVER_ENV_FILE.exists():
        return
    for raw_line in _SERVER_ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        # Do not override already-exported env vars (cloud / CI / shell).
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
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the process "
            "environment (recommended for cloud) or in model/.env.server for local "
            f"dev. See .env.server.example. File path: {_SERVER_ENV_FILE}"
        )
    if service_key.startswith("REPLACE_") or "YOUR_SERVICE_ROLE" in service_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is still a placeholder. "
            f"Paste your real service role key in {_SERVER_ENV_FILE} (Supabase Dashboard → Settings → API)."
        )
    return create_client(url, service_key)


app = FastAPI(title="Vitals Prediction API", version="1.0.0")
_bundle: dict[str, Any] | None = None
_bundle_error: str | None = None
_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = _build_supabase()
    return _supabase


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


def _supabase_env_ok() -> bool:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return False
    if key.startswith("REPLACE_") or "YOUR_SERVICE_ROLE" in key:
        return False
    return True


@app.get("/health")
def health() -> dict[str, str]:
    out: dict[str, str] = {}
    if _bundle_error:
        out["status"] = "degraded"
        out["bundle"] = "error"
    else:
        out["status"] = "ok"
        out["bundle"] = "ready"
    out["supabase"] = "configured" if _supabase_env_ok() else "missing_or_placeholder"
    if out["supabase"] != "configured":
        out["supabase_hint"] = (
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the host (same names "
            "as Supabase Edge Functions), or use model/.env.server locally unless "
            "SKIP_ENV_SERVER_FILE=1."
        )
        if not _truthy_env("SKIP_ENV_SERVER_FILE"):
            out["supabase_file"] = str(_SERVER_ENV_FILE)
    return out


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

    try:
        sb = _get_supabase()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    response = (
        sb.table("vitals")
        .update(update_payload)
        .eq("id", payload.vital_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail=f"Vital record not found: {payload.vital_id}")

    return {"vital_id": payload.vital_id, **result}
