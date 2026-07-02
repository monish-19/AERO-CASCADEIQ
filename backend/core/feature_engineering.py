"""
Feature Engineering — Member 3 (ML & AI Engineer)
Reads raw QAR data and creates ML-ready features.
Output: data_pipeline/output/processed/features.csv
"""

import pandas as pd
import numpy as np
import os

INPUT_PATH  = "data_pipeline/output/labeled/qar_with_cascades.csv"
OUTPUT_PATH = "data_pipeline/output/processed/features.csv"

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each LRU + param combination, compute:
    - Rolling mean (window=5 flights)
    - Rolling std (window=5 flights)
    - Rate of change
    - Deviation from overall mean
    - Z-score
    """
    print("Engineering features...")
    feature_rows = []

    # Group by aircraft + LRU + param
    groups = df.groupby(["aircraft_id", "lru_code", "param_type"])

    for (aircraft_id, lru_code, param_type), group in groups:
        group = group.sort_values("timestamp").copy()

        # Get one row per flight (use mean value per flight)
        flight_data = group.groupby("flight_id").agg(
            value        = ("value", "mean"),
            is_anomalous = ("is_anomalous", "max"),
            anomaly_score= ("anomaly_score", "max")
        ).reset_index()

        flight_data = flight_data.sort_values("flight_id")

        # Overall stats
        overall_mean = flight_data["value"].mean()
        overall_std  = flight_data["value"].std() + 1e-9

        # Rolling features (window=5)
        flight_data["rolling_mean"] = flight_data["value"].rolling(5, min_periods=1).mean()
        flight_data["rolling_std"]  = flight_data["value"].rolling(5, min_periods=1).std().fillna(0)
        flight_data["rate_of_change"] = flight_data["value"].diff().fillna(0)
        flight_data["deviation_from_mean"] = flight_data["value"] - overall_mean
        flight_data["z_score"] = (flight_data["value"] - overall_mean) / overall_std
        flight_data["rolling_z"] = (
            (flight_data["value"] - flight_data["rolling_mean"]) /
            (flight_data["rolling_std"] + 1e-9)
        )

        # Add identifiers
        flight_data["aircraft_id"] = aircraft_id
        flight_data["lru_code"]    = lru_code
        flight_data["param_type"]  = param_type

        feature_rows.append(flight_data)

    features_df = pd.concat(feature_rows, ignore_index=True)

    # Save
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    features_df.to_csv(OUTPUT_PATH, index=False)

    print(f"Features saved → {OUTPUT_PATH}")
    print(f"Shape: {features_df.shape}")
    print(f"Anomalous rows: {features_df['is_anomalous'].sum():,}")
    print(f"Features: {[c for c in features_df.columns]}")
    return features_df


if __name__ == "__main__":
    print("Loading QAR data...")
    df = pd.read_csv(INPUT_PATH)
    print(f"Loaded {len(df):,} rows")
    features_df = engineer_features(df)
    print("\nSample:")
    print(features_df[features_df["is_anomalous"] == True].head(5).to_string())