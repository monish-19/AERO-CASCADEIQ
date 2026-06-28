"""
Ingestion Pipeline — Member 1 (Data & Digital Twin Engineer)
Loads generated CSV data into PostgreSQL.
Run this after cascade_injector.py has produced the labeled CSV files.
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
import os

DB_CONFIG = {
    "host":     os.getenv("POSTGRES_HOST", "localhost"),
    "port":     int(os.getenv("POSTGRES_PORT", 5432)),
    "dbname":   os.getenv("POSTGRES_DB", "aircraft_db"),
    "user":     os.getenv("POSTGRES_USER", "admin"),
    "password": os.getenv("POSTGRES_PASSWORD", "admin123"),
}

DATA_DIR = os.path.join(os.path.dirname(__file__), "../output")


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def ingest_flights(conn, df: pd.DataFrame):
    """Insert a flight record for each unique flight_id."""
    cur = conn.cursor()
    flight_ids = sorted(df["flight_id"].unique())
    base_time  = datetime(2026, 1, 1, 6, 0, 0)

    rows = []
    for fid in flight_ids:
        fnum       = f"6E-{200 + int(fid)}"
        dep_time   = base_time + timedelta(hours=int(fid) * 2)
        land_time  = dep_time + timedelta(hours=1)
        rows.append((1, fnum, "BOM", "DEL", 1.0, dep_time, land_time))

    execute_values(cur,
        "INSERT INTO flights (aircraft_id, flight_number, departure, arrival, "
        "flight_hours, departed_at, landed_at) VALUES %s ON CONFLICT DO NOTHING",
        rows
    )
    conn.commit()
    print(f"  Inserted {len(rows)} flight records")


def build_lookup_maps(conn):
    """Build flight_number → flight_id and lru_code → lru_id maps."""
    cur = conn.cursor()
    cur.execute("SELECT flight_number, flight_id FROM flights")
    flight_map = {row[0]: row[1] for row in cur.fetchall()}
    cur.execute("SELECT lru_code, lru_id FROM lrus")
    lru_map = {row[0]: row[1] for row in cur.fetchall()}
    return flight_map, lru_map


def ingest_qar_readings(conn, df: pd.DataFrame, batch_size: int = 10000):
    """Batch-insert QAR readings into PostgreSQL."""
    cur = conn.cursor()
    flight_map, lru_map = build_lookup_maps(conn)

    rows_to_insert = []
    total = 0

    for _, row in df.iterrows():
        fnum   = f"6E-{200 + int(row['flight_id'])}"
        fid    = flight_map.get(fnum)
        lru_id = lru_map.get(row["lru_code"])
        if not fid or not lru_id:
            continue

        rows_to_insert.append((
            int(row["aircraft_id"]),
            fid,
            lru_id,
            row["param_type"],
            float(row["value"]),
            row["unit"],
            row["timestamp"],
            bool(row["is_anomalous"]),
            float(row["anomaly_score"]),
        ))

        if len(rows_to_insert) >= batch_size:
            execute_values(cur,
                "INSERT INTO qar_readings (aircraft_id, flight_id, lru_id, "
                "param_type, value, unit, timestamp, is_anomalous, anomaly_score) "
                "VALUES %s",
                rows_to_insert
            )
            conn.commit()
            total += len(rows_to_insert)
            rows_to_insert = []
            print(f"  {total:,} rows inserted...")

    if rows_to_insert:
        execute_values(cur,
            "INSERT INTO qar_readings (aircraft_id, flight_id, lru_id, "
            "param_type, value, unit, timestamp, is_anomalous, anomaly_score) "
            "VALUES %s",
            rows_to_insert
        )
        conn.commit()
        total += len(rows_to_insert)

    print(f"  Total QAR rows inserted: {total:,}")


def ingest_cascade_labels(conn, labels_df: pd.DataFrame):
    """Insert cascade event labels (ground truth for M3)."""
    cur = conn.cursor()
    rows = []
    for _, row in labels_df.iterrows():
        rows.append((
            int(row["aircraft_id"]),
            None,
            int(row["root_cause_lru_id"]),
            int(row["affected_lru_id"]),
            int(row["injection_flight"]),
            int(row["onset_flight"]),
            int(row["propagation_delay_flights"]),
            row["edge_type"],
            float(row["base_weight"]),
            row["scenario_name"],
        ))

    execute_values(cur,
        "INSERT INTO cascade_events (aircraft_id, flight_id, root_cause_lru_id, "
        "affected_lru_id, injection_flight, onset_flight, propagation_delay_flights, "
        "edge_type, base_weight, scenario_name) VALUES %s",
        rows
    )
    conn.commit()
    print(f"  Inserted {len(rows)} cascade event labels")


def run_ingestion():
    print(f"[{datetime.utcnow()}] Starting ingestion pipeline...")

    qar_path    = os.path.join(DATA_DIR, "labeled/qar_with_cascades.csv")
    labels_path = os.path.join(DATA_DIR, "labeled/cascade_labels.csv")

    if not os.path.exists(qar_path):
        raise FileNotFoundError(
            f"Data file not found: {qar_path}\n"
            "Run cascade_injector.py first to generate the labeled data."
        )

    print("Loading CSV files...")
    qar_df     = pd.read_csv(qar_path)
    labels_df  = pd.read_csv(labels_path)
    print(f"  QAR data: {len(qar_df):,} rows")
    print(f"  Labels:   {len(labels_df)} cascade events")

    conn = get_conn()
    print("\nConnected to PostgreSQL")

    print("\nIngesting flights...")
    ingest_flights(conn, qar_df)

    print("\nIngesting QAR readings (this takes a minute)...")
    ingest_qar_readings(conn, qar_df)

    print("\nIngesting cascade labels...")
    ingest_cascade_labels(conn, labels_df)

    conn.close()
    print(f"\nIngestion complete at {datetime.utcnow()}")


if __name__ == "__main__":
    run_ingestion()
