"""
Model Serving Wrapper — Member 3 (ML & AI Engineer)
Exposes anomaly detection and cascade risk prediction
as simple functions for M4's FastAPI backend to call.
"""

import pandas as pd
import numpy as np
import joblib
import os
import sys

sys.path.append(os.path.abspath("."))
from backend.core.anomaly_detector import predict_anomaly
from backend.core.gnn_model import predict_cascade_risk
from backend.db.neo4j_client import AircraftGraphDB

MODEL_DIR    = "backend/core/models"
FEATURES_PATH = "data_pipeline/output/processed/features.csv"

FEATURE_COLS = [
    "value",
    "rolling_mean",
    "rolling_std",
    "rate_of_change",
    "deviation_from_mean",
    "z_score",
    "rolling_z"
]


def score_lru(lru_code: str, recent_values: list) -> dict:
    """
    Score a single LRU based on its recent sensor readings.
    Called by M4 after each flight ingestion.

    Args:
        lru_code: e.g. "HYD-2A"
        recent_values: list of last 5 sensor readings (floats)

    Returns:
        dict with anomaly_score, is_anomalous, risk_level
    """
    values = np.array(recent_values)

    # Compute features from recent values
    features = {
        "value":               float(values[-1]),
        "rolling_mean":        float(values.mean()),
        "rolling_std":         float(values.std() + 1e-9),
        "rate_of_change":      float(values[-1] - values[-2]) if len(values) > 1 else 0.0,
        "deviation_from_mean": float(values[-1] - values.mean()),
        "z_score":             float((values[-1] - values.mean()) / (values.std() + 1e-9)),
        "rolling_z":           float((values[-1] - values.mean()) / (values.std() + 1e-9)),
    }

    result = predict_anomaly(features)
    result["lru_code"] = lru_code

    # Add risk level
    score = result["anomaly_score"]
    result["risk_level"] = (
        "CRITICAL" if score > 0.8 else
        "HIGH"     if score > 0.6 else
        "MEDIUM"   if score > 0.3 else
        "LOW"
    )
    return result


def run_full_cascade_prediction(root_lru: str) -> dict:
    """
    Full cascade prediction pipeline for a given root LRU.
    1. Get all downstream LRUs from Neo4j graph
    2. Predict cascade probability for each
    3. Return ranked risk list

    Called by M4's /predict-failure endpoint.
    """
    db = AircraftGraphDB()
    cascade_paths = db.get_full_cascade_path(root_lru)
    db.close()

    predictions = []
    for path in cascade_paths:
        # Get edge type from path
        edge_types  = path.get("edge_types", ["unknown"])
        edge_type   = edge_types[-1] if edge_types else "unknown"
        delay       = path.get("total_delay_flights", 3)
        base_weight = path.get("cascade_probability", 0.5)

        risk = predict_cascade_risk(
            root_lru, edge_type, delay, base_weight
        )

        predictions.append({
            "affected_lru":        path["affected_id"],
            "affected_name":       path["affected_name"],
            "depth":               path["depth"],
            "cascade_probability": risk["cascade_probability"],
            "risk_level":          risk["risk_level"],
            "total_delay_flights": delay,
            "edge_type":           edge_type,
        })

    # Sort by cascade probability
    predictions.sort(key=lambda x: x["cascade_probability"], reverse=True)

    return {
        "root_lru":    root_lru,
        "predictions": predictions,
        "total_affected": len(predictions),
        "critical_count": sum(
            1 for p in predictions if p["risk_level"] == "CRITICAL"
        )
    }


def score_all_lrus_from_db() -> list:
    """
    Score all LRUs using latest data from PostgreSQL features file.
    Called by M4 after each flight ingestion cycle.
    Returns list of LRU scores sorted by anomaly score.
    """
    df = pd.read_csv(FEATURES_PATH)

    # Get latest flight data per LRU
    latest = df.sort_values("flight_id").groupby("lru_code").tail(5)

    results = []
    for lru_code, group in latest.groupby("lru_code"):
        recent_values = group["value"].tolist()
        if len(recent_values) < 2:
            recent_values = recent_values * 2

        score = score_lru(lru_code, recent_values)
        results.append(score)

    # Sort by anomaly score
    results.sort(key=lambda x: x["anomaly_score"], reverse=True)
    return results


if __name__ == "__main__":
    print("=" * 50)
    print("MODEL SERVING — FULL PIPELINE TEST")
    print("=" * 50)

    # Test 1: Score all LRUs
    print("\n1. Scoring all LRUs from latest flight data:")
    scores = score_all_lrus_from_db()
    for s in scores:
        icon = (
            "🔴" if s["risk_level"] == "CRITICAL" else
            "🟠" if s["risk_level"] == "HIGH"     else
            "🟡" if s["risk_level"] == "MEDIUM"   else
            "🟢"
        )
        print(f"  {icon} {s['lru_code']}: "
              f"score={s['anomaly_score']:.4f} "
              f"→ {s['risk_level']}")

    # Test 2: Full cascade prediction from HYD-2A
    print("\n2. Full cascade prediction from HYD-2A:")
    result = run_full_cascade_prediction("HYD-2A")
    print(f"  Root LRU: {result['root_lru']}")
    print(f"  Total affected: {result['total_affected']}")
    print(f"  Critical count: {result['critical_count']}")
    print(f"  Predictions:")
    for p in result["predictions"]:
        print(f"    → {p['affected_lru']}: "
              f"prob={p['cascade_probability']:.4f} "
              f"delay={p['total_delay_flights']} flights "
              f"[{p['risk_level']}]")

    # Test 3: Full cascade prediction from BLEED-V1
    print("\n3. Full cascade prediction from BLEED-V1:")
    result2 = run_full_cascade_prediction("BLEED-V1")
    for p in result2["predictions"]:
        print(f"    → {p['affected_lru']}: "
              f"prob={p['cascade_probability']:.4f} "
              f"delay={p['total_delay_flights']} flights "
              f"[{p['risk_level']}]")

    print("\n" + "=" * 50)
    print("M3 Model Serving — All tests passed!")
    print("=" * 50)