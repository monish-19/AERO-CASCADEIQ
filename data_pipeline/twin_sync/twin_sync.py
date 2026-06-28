"""
Digital Twin Sync Service — Member 1 (Data & Digital Twin Engineer)
Reads latest anomaly scores from PostgreSQL after each flight,
maps them to health states, and syncs both:
  1. PostgreSQL lrus.current_state
  2. Neo4j LRU node properties (for M2's graph)
Called by M4's backend after each ingestion cycle.
"""

import psycopg2
import os
from datetime import datetime

# Neo4j is optional — if not connected, only Postgres is updated
try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False

DB_CONFIG = {
    "host":     os.getenv("POSTGRES_HOST", "localhost"),
    "port":     int(os.getenv("POSTGRES_PORT", 5432)),
    "dbname":   os.getenv("POSTGRES_DB", "aircraft_db"),
    "user":     os.getenv("POSTGRES_USER", "admin"),
    "password": os.getenv("POSTGRES_PASSWORD", "admin123"),
}

NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")


# ── State thresholds (Section 6.2 of blueprint) ────────────────────────────
def score_to_state(score: float) -> str:
    if score < 0.30:  return "HEALTHY"
    if score < 0.65:  return "DEGRADED"
    if score < 0.90:  return "CRITICAL"
    return "FAILED"


def get_latest_anomaly_scores(cur, aircraft_id: int) -> list:
    """
    Get the max anomaly_score per LRU from the most recent flight.
    Returns list of (lru_id, lru_code, max_score).
    """
    cur.execute("""
        SELECT l.lru_id, l.lru_code, COALESCE(MAX(q.anomaly_score), 0.0) AS max_score
        FROM lrus l
        LEFT JOIN qar_readings q
            ON q.lru_id = l.lru_id
            AND q.flight_id = (
                SELECT MAX(flight_id)
                FROM qar_readings
                WHERE aircraft_id = %s
            )
        WHERE l.aircraft_id = %s
        GROUP BY l.lru_id, l.lru_code
        ORDER BY max_score DESC
    """, (aircraft_id, aircraft_id))
    return cur.fetchall()


def update_postgres_state(cur, lru_id: int, state: str, score: float):
    cur.execute("""
        UPDATE lrus
        SET current_state = %s,
            anomaly_score = %s,
            last_updated  = %s
        WHERE lru_id = %s
    """, (state, round(score, 4), datetime.utcnow(), lru_id))


def update_neo4j_state(driver, lru_code: str, state: str, score: float):
    """Push updated health state to M2's Neo4j graph node."""
    with driver.session() as session:
        session.run("""
            MERGE (n:LRU {id: $lru_code})
            SET n.current_state = $state,
                n.anomaly_score = $score,
                n.last_updated  = $ts
        """, lru_code=lru_code, state=state,
             score=round(score, 4),
             ts=datetime.utcnow().isoformat())


def run_twin_sync(aircraft_id: int = 1) -> list:
    """
    Main sync function. Call this after each new batch of QAR data is ingested.
    Returns list of updated LRU states (for M4's API to use).

    Args:
        aircraft_id: the aircraft to sync

    Returns:
        List of dicts: [{lru_id, lru_code, state, anomaly_score}, ...]
    """
    print(f"[{datetime.utcnow().isoformat()}] Twin sync — aircraft_id={aircraft_id}")

    pg_conn = psycopg2.connect(**DB_CONFIG)
    cur     = pg_conn.cursor()

    # Connect to Neo4j if available
    neo4j_driver = None
    if NEO4J_AVAILABLE:
        try:
            neo4j_driver = GraphDatabase.driver(
                NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD)
            )
        except Exception as e:
            print(f"  Neo4j connection failed (continuing without it): {e}")

    scores  = get_latest_anomaly_scores(cur, aircraft_id)
    updates = []

    for lru_id, lru_code, max_score in scores:
        state = score_to_state(max_score)
        update_postgres_state(cur, lru_id, state, max_score)

        if neo4j_driver:
            try:
                update_neo4j_state(neo4j_driver, lru_code, state, max_score)
            except Exception as e:
                print(f"  Neo4j update skipped for {lru_code}: {e}")

        updates.append({
            "lru_id":        lru_id,
            "lru_code":      lru_code,
            "state":         state,
            "anomaly_score": round(max_score, 4),
        })
        icon = {"HEALTHY": "✅", "DEGRADED": "⚠️", "CRITICAL": "🔴", "FAILED": "💀"}.get(state, "?")
        print(f"  {icon} {lru_code}: {max_score:.4f} → {state}")

    pg_conn.commit()
    pg_conn.close()
    if neo4j_driver:
        neo4j_driver.close()

    print(f"  Sync complete — {len(updates)} LRUs updated\n")
    return updates


if __name__ == "__main__":
    results = run_twin_sync(aircraft_id=1)
    print("\nFinal states:")
    for r in results:
        print(f"  {r['lru_code']}: {r['state']} (score={r['anomaly_score']})")
