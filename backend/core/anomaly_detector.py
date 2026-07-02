"""
Anomaly Detection Model — Member 3 (ML & AI Engineer)
Trains Isolation Forest on QAR features.
Output: backend/core/models/anomaly_model.pkl
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import os

INPUT_PATH  = "data_pipeline/output/processed/features.csv"
MODEL_DIR   = "backend/core/models"
MODEL_PATH  = f"{MODEL_DIR}/anomaly_model.pkl"
SCALER_PATH = f"{MODEL_DIR}/scaler.pkl"

FEATURE_COLS = [
    "value",
    "rolling_mean",
    "rolling_std",
    "rate_of_change",
    "deviation_from_mean",
    "z_score",
    "rolling_z"
]

def train_anomaly_model(df: pd.DataFrame):
    print("Training Isolation Forest anomaly detector...")
    os.makedirs(MODEL_DIR, exist_ok=True)

    # Prepare features
    X = df[FEATURE_COLS].fillna(0).values
    y = df["is_anomalous"].astype(int).values

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Calculate contamination ratio
    contamination = max(0.01, min(0.5, y.mean()))
    print(f"  Contamination ratio: {contamination:.3f}")

    # Train Isolation Forest
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_scaled)

    # Evaluate
    # Isolation Forest returns -1 for anomaly, 1 for normal
    preds_raw = model.predict(X_scaled)
    preds = (preds_raw == -1).astype(int)

    print("\nModel Performance:")
    print(classification_report(y, preds,
          target_names=["Normal", "Anomalous"]))

    # Save model and scaler
    joblib.dump(model,  MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"\nModel saved  → {MODEL_PATH}")
    print(f"Scaler saved → {SCALER_PATH}")

    return model, scaler


def predict_anomaly(lru_features: dict) -> dict:
    """
    Predict anomaly score for a single LRU reading.
    Called by M4's API for real-time scoring.

    Args:
        lru_features: dict with keys matching FEATURE_COLS

    Returns:
        dict with anomaly_score and is_anomalous
    """
    model  = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)

    X = np.array([[lru_features.get(f, 0) for f in FEATURE_COLS]])
    X_scaled = scaler.transform(X)

    pred  = model.predict(X_scaled)[0]
    score = model.decision_function(X_scaled)[0]

    # Convert decision function score to 0-1 range
    # More negative = more anomalous
    anomaly_score = max(0.0, min(1.0, -score / 2.0 + 0.5))

    return {
        "is_anomalous":  bool(pred == -1),
        "anomaly_score": round(float(anomaly_score), 4),
        "raw_score":     round(float(score), 4)
    }


if __name__ == "__main__":
    print("Loading features...")
    df = pd.read_csv(INPUT_PATH)
    print(f"Loaded {len(df):,} rows")
    print(f"Anomalous: {df['is_anomalous'].sum():,} rows")

    model, scaler = train_anomaly_model(df)

    # Test prediction
    print("\nTesting prediction on a normal reading:")
    normal_test = {
        "value": 3000.0,
        "rolling_mean": 3000.0,
        "rolling_std": 50.0,
        "rate_of_change": 0.0,
        "deviation_from_mean": 0.0,
        "z_score": 0.0,
        "rolling_z": 0.0
    }
    print(predict_anomaly(normal_test))

    print("\nTesting prediction on an anomalous reading:")
    anomaly_test = {
        "value": 2500.0,
        "rolling_mean": 2700.0,
        "rolling_std": 200.0,
        "rate_of_change": -50.0,
        "deviation_from_mean": -500.0,
        "z_score": -3.5,
        "rolling_z": -2.8
    }
    print(predict_anomaly(anomaly_test))