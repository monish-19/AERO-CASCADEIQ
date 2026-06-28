"""
Cascade Injector — Member 1 (Data & Digital Twin Engineer)
Takes clean QAR data and injects realistic failure cascades.
Produces:
  - output/labeled/qar_with_cascades.csv  → training data for M3
  - output/labeled/cascade_labels.csv     → ground truth labels for M3's GNN
"""

import numpy as np
import pandas as pd
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from qar_generator import generate_all_flights, LRU_PARAMS, AIRCRAFT_ID

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../output")

# ── Cascade Scenarios ──────────────────────────────────────────────────────
# Each scenario describes one root-cause failure and how it propagates.
# Matches the dependency graph M2 will build in Neo4j.
#
# drift_per_flight: how much the sensor value shifts each flight
#   (negative = dropping, positive = rising — direction depends on param)
# base_weight: probability that this edge causes propagation (from blueprint)

CASCADE_SCENARIOS = [
    {
        "scenario_id": 1,
        "name": "Hydraulic pump → flight control cascade",
        "description": "HYD-2A pump seal degrades → pressure drops → ACT-L4 stressed → FCU-L affected",
        "events": [
            {
                "lru_code":    "HYD-2A",
                "param_type":  "HYD_PRESS",
                "start_flight": 50,
                "end_flight":   80,
                "drift_per_flight": -15.0,  # pressure drops 15 psi/flight (normal=3000)
                "label":       "root_cause",
                "lru_id":      1,
            },
            {
                "lru_code":    "ACT-L4",
                "param_type":  "ACT_POS",
                "start_flight": 53,          # 3 flights after root cause
                "end_flight":   80,
                "drift_per_flight": 0.15,    # actuator drifts off-centre
                "label":       "downstream_1",
                "lru_id":      2,
                "caused_by_lru":  "HYD-2A",
                "edge_type":      "hydraulic",
                "base_weight":    0.80,
            },
            {
                "lru_code":    "FCU-L",
                "param_type":  "ACT_POS",
                "start_flight": 58,          # 5 flights after ACT-L4
                "end_flight":   80,
                "drift_per_flight": 0.08,
                "label":       "downstream_2",
                "lru_id":      3,
                "caused_by_lru":  "ACT-L4",
                "edge_type":      "mechanical",
                "base_weight":    0.60,
            },
        ],
    },
    {
        "scenario_id": 2,
        "name": "Bleed valve → avionics overheating cascade",
        "description": "BLEED-V1 flow drops → AVNX-COOL loses cooling air → avionics bay overheats → ADIRU-1 drifts",
        "events": [
            {
                "lru_code":    "BLEED-V1",
                "param_type":  "BLEED_PRESS",
                "start_flight": 120,
                "end_flight":   155,
                "drift_per_flight": -1.2,   # bleed pressure drops 1.2 psi/flight (normal=35)
                "label":       "root_cause",
                "lru_id":      5,
            },
            {
                "lru_code":    "AVNX-COOL",
                "param_type":  "AVNX_TEMP",
                "start_flight": 124,         # 4 flights after root cause
                "end_flight":   155,
                "drift_per_flight": 2.5,    # avionics bay heats up 2.5°C/flight (normal=45)
                "label":       "downstream_1",
                "lru_id":      6,
                "caused_by_lru":  "BLEED-V1",
                "edge_type":      "pneumatic",
                "base_weight":    0.70,
            },
            {
                "lru_code":    "ADIRU-1",
                "param_type":  "IRS_DRIFT",
                "start_flight": 131,         # 7 flights after AVNX overheating
                "end_flight":   155,
                "drift_per_flight": 0.003,  # inertial drift increases (normal=0.01)
                "label":       "downstream_2",
                "lru_id":      7,
                "caused_by_lru":  "AVNX-COOL",
                "edge_type":      "thermal",
                "base_weight":    0.50,
            },
        ],
    },
]


def get_root_event(scenario: dict) -> dict:
    """Return the root cause event from a scenario."""
    return next(e for e in scenario["events"] if e["label"] == "root_cause")


def apply_cascade_to_df(df: pd.DataFrame, scenarios: list):
    """
    Injects degradation trends into the clean QAR DataFrame.

    Returns:
        dirty_df   — modified df with drifted sensor values and anomaly flags
        labels_df  — DataFrame of cascade event labels for M3's training
    """
    df = df.copy()
    label_rows = []

    for scenario in scenarios:
        root_event = get_root_event(scenario)

        for event in scenario["events"]:
            lru_code   = event["lru_code"]
            param_type = event["param_type"]
            start      = event["start_flight"]
            end        = event["end_flight"]
            drift      = event["drift_per_flight"]

            # Find the normal std for this param (for anomaly threshold)
            param_std = None
            for params in LRU_PARAMS.get(lru_code, []):
                if params["param_type"] == param_type:
                    param_std = params["normal_std"]
                    break
            if param_std is None:
                param_std = 1.0  # fallback

            # Get all rows for this LRU+param in the affected flight range
            mask = (
                (df["lru_code"]   == lru_code)   &
                (df["param_type"] == param_type) &
                (df["flight_id"]  >= start)       &
                (df["flight_id"]  <= end)
            )

            # Apply cumulative drift per flight
            for fid in df.loc[mask, "flight_id"].unique():
                flight_mask   = mask & (df["flight_id"] == fid)
                flights_elapsed = int(fid) - start
                total_drift   = drift * flights_elapsed

                df.loc[flight_mask, "value"] += total_drift

                # Mark as anomalous once drift exceeds 2 standard deviations
                if abs(total_drift) > 2 * param_std:
                    df.loc[flight_mask, "is_anomalous"] = True
                    severity = min(abs(total_drift) / (6 * param_std), 1.0)
                    df.loc[flight_mask, "anomaly_score"] = round(severity, 4)

            # Record cascade event label (skip root_cause — that's the source)
            if event["label"] != "root_cause":
                label_rows.append({
                    "aircraft_id":                AIRCRAFT_ID,
                    "root_cause_lru_id":          root_event["lru_id"],
                    "root_cause_lru_code":        root_event["lru_code"],
                    "affected_lru_id":            event["lru_id"],
                    "affected_lru_code":          event["lru_code"],
                    "injection_flight":           root_event["start_flight"],
                    "onset_flight":               event["start_flight"],
                    "propagation_delay_flights":  event["start_flight"] - root_event["start_flight"],
                    "edge_type":                  event.get("edge_type", "unknown"),
                    "base_weight":                event.get("base_weight", 0.5),
                    "scenario_id":                scenario["scenario_id"],
                    "scenario_name":              scenario["name"],
                })

    labels_df = pd.DataFrame(label_rows)
    return df, labels_df


if __name__ == "__main__":
    labeled_dir = os.path.join(OUTPUT_DIR, "labeled")
    os.makedirs(labeled_dir, exist_ok=True)

    # Step 1: Generate clean baseline data (or load if already exists)
    raw_path = os.path.join(OUTPUT_DIR, "raw/qar_normal.csv")
    if os.path.exists(raw_path):
        print(f"Loading existing clean data from {raw_path}...")
        clean_df = pd.read_csv(raw_path)
    else:
        print("Generating clean baseline data first...")
        clean_df = generate_all_flights()

    print(f"Clean data shape: {clean_df.shape}")

    # Step 2: Inject cascade failures
    print("\nInjecting cascade scenarios...")
    dirty_df, labels_df = apply_cascade_to_df(clean_df, CASCADE_SCENARIOS)

    # Step 3: Save outputs
    cascade_path = os.path.join(labeled_dir, "qar_with_cascades.csv")
    labels_path  = os.path.join(labeled_dir, "cascade_labels.csv")
    dirty_df.to_csv(cascade_path, index=False)
    labels_df.to_csv(labels_path,  index=False)

    # Summary
    n_anomalous = dirty_df["is_anomalous"].sum()
    print(f"\nResults:")
    print(f"  Total rows:      {len(dirty_df):,}")
    print(f"  Anomalous rows:  {n_anomalous:,}  ({100 * n_anomalous / len(dirty_df):.1f}%)")
    print(f"  Cascade labels:  {len(labels_df)} downstream events")
    print(f"\nFiles saved:")
    print(f"  {cascade_path}  ← send to M3 (ML training data)")
    print(f"  {labels_path}   ← send to M3 (ground truth labels)")
    print(f"\nCascade events:")
    print(labels_df.to_string(index=False))
