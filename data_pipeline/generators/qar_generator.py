"""
QAR Generator — Member 1 (Data & Digital Twin Engineer)
Generates synthetic but realistic aircraft sensor (QAR/FDR) data.
Produces clean baseline data across NUM_FLIGHTS flights.
Output: data_pipeline/output/raw/qar_normal.csv
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import os

# ── Configuration ──────────────────────────────────────────────────────────
AIRCRAFT_ID        = 1
TAIL_NUMBER        = "VT-INX"
NUM_FLIGHTS        = 200
READINGS_PER_FLIGHT = 60   # 1 reading per minute, ~1hr flight
OUTPUT_DIR         = os.path.join(os.path.dirname(__file__), "../output/raw")

# ── LRU parameter definitions ──────────────────────────────────────────────
# Each LRU emits one or more sensor parameters.
# normal_mean/std define the healthy operating envelope.
LRU_PARAMS = {
    "HYD-2A": [
        {"param_type": "HYD_PRESS", "unit": "psi",
         "normal_mean": 3000, "normal_std": 50, "lru_id": 1},
    ],
    "ENG1-FADEC": [
        {"param_type": "EGT",  "unit": "degC", "normal_mean": 680, "normal_std": 20,  "lru_id": 4},
        {"param_type": "N1",   "unit": "pct",  "normal_mean": 95,  "normal_std": 2,   "lru_id": 4},
        {"param_type": "N2",   "unit": "pct",  "normal_mean": 97,  "normal_std": 1,   "lru_id": 4},
    ],
    "ACT-L4": [
        {"param_type": "ACT_POS", "unit": "deg",
         "normal_mean": 0.0, "normal_std": 0.5, "lru_id": 2},
    ],
    "FCU-L": [
        {"param_type": "ACT_POS", "unit": "deg",
         "normal_mean": 0.0, "normal_std": 0.3, "lru_id": 3},
    ],
    "BLEED-V1": [
        {"param_type": "BLEED_PRESS", "unit": "psi",
         "normal_mean": 35, "normal_std": 3, "lru_id": 5},
    ],
    "AVNX-COOL": [
        {"param_type": "AVNX_TEMP", "unit": "degC",
         "normal_mean": 45, "normal_std": 5, "lru_id": 6},
    ],
    "ADIRU-1": [
        {"param_type": "IRS_DRIFT", "unit": "nm_per_hr",
         "normal_mean": 0.01, "normal_std": 0.005, "lru_id": 7},
    ],
    "GEN-1": [
        {"param_type": "BUS_VOLT", "unit": "V",
         "normal_mean": 115, "normal_std": 2, "lru_id": 8},
    ],
    "FUEL-P1": [
        {"param_type": "FUEL_FLOW", "unit": "kg_per_hr",
         "normal_mean": 2400, "normal_std": 100, "lru_id": 9},
    ],
    "APU": [
        {"param_type": "APU_EGT", "unit": "degC",
         "normal_mean": 580, "normal_std": 15, "lru_id": 10},
    ],
}


def generate_flight_readings(flight_id: int, flight_number: str,
                              base_time: datetime,
                              degradation_overrides: dict = None) -> list:
    """
    Generate sensor readings for one flight.

    Args:
        flight_id: integer flight ID
        flight_number: string like "6E-204"
        base_time: departure datetime
        degradation_overrides: dict {lru_code: {param_type: drift_amount}}
            Applied by cascade_injector — leave None for clean baseline flights.

    Returns:
        List of row dicts ready for DataFrame conversion.
    """
    rows = []
    for lru_code, params in LRU_PARAMS.items():
        for p in params:
            for t in range(READINGS_PER_FLIGHT):
                timestamp = base_time + timedelta(minutes=t)

                # Normal healthy reading
                value = np.random.normal(p["normal_mean"], p["normal_std"])

                # Apply drift if cascade injector has overridden this LRU
                if degradation_overrides and lru_code in degradation_overrides:
                    drift = degradation_overrides[lru_code].get(p["param_type"], 0.0)
                    value += drift

                rows.append({
                    "aircraft_id":   AIRCRAFT_ID,
                    "flight_id":     flight_id,
                    "flight_number": flight_number,
                    "lru_id":        p["lru_id"],
                    "lru_code":      lru_code,
                    "param_type":    p["param_type"],
                    "value":         round(float(value), 4),
                    "unit":          p["unit"],
                    "timestamp":     timestamp.isoformat(),
                    "is_anomalous":  False,
                    "anomaly_score": 0.0,
                })
    return rows


def generate_all_flights(num_flights: int = NUM_FLIGHTS) -> pd.DataFrame:
    """Generate clean baseline QAR data for all flights."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    all_rows = []
    base_time = datetime(2026, 1, 1, 6, 0, 0)

    print(f"Generating {num_flights} normal flights ({READINGS_PER_FLIGHT} readings/flight)...")
    for i in range(num_flights):
        flight_id     = i + 1
        flight_number = f"6E-{200 + i}"
        flight_time   = base_time + timedelta(hours=i * 2)
        rows = generate_flight_readings(flight_id, flight_number, flight_time)
        all_rows.extend(rows)

        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{num_flights} flights done...")

    df = pd.DataFrame(all_rows)
    output_path = os.path.join(OUTPUT_DIR, "qar_normal.csv")
    df.to_csv(output_path, index=False)

    print(f"\nSaved {len(df):,} rows → {output_path}")
    print(f"LRUs: {sorted(df['lru_code'].unique())}")
    print(f"Params: {sorted(df['param_type'].unique())}")
    return df


if __name__ == "__main__":
    df = generate_all_flights()
    print(f"\nSample rows:")
    print(df.head(5).to_string())
