# AI-Powered Failure Propagation Analyzer for Aircraft Systems

A Digital Twin + Graph AI platform for predicting cascading failures in aviation.

---

## Team

| Member | Role | Owns |
|--------|------|------|
| M1 | Data & Digital Twin Engineer | `data_pipeline/` |
| M2 | Graph & Knowledge Engineer   | Neo4j graph, `backend/db/neo4j_client.py` |
| M3 | ML & AI Engineer             | Anomaly detection, GNN |
| M4 | Backend & API Engineer       | `backend/` |
| M5 | Frontend & Presentation      | `frontend/` |

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Python 3.10+
- Node.js 18+ (for frontend)

### 1. Clone and setup environment
```bash
git clone <repo-url>
cd aircraft-failure-analyzer
cp .env.example .env
```

### 2. Start all services (PostgreSQL + Neo4j + Backend + Frontend)
```bash
docker compose up -d
docker compose ps   # verify all services are healthy
```

### 3. Set up Python environment (for M1 scripts)
```bash
cd data_pipeline
python3 -m venv venv
source venv/bin/activate
pip install -r ../requirements.txt
```

### 4. Run the M1 data pipeline
```bash
# Option A: Run all steps at once
bash scripts/run_pipeline.sh

# Option B: Run steps individually
cd data_pipeline/generators
python3 qar_generator.py        # Step 1: generate 200 flights of clean sensor data
python3 cascade_injector.py     # Step 2: inject failure cascades + create labels

cd ../ingestion
python3 ingest.py               # Step 3: load everything into PostgreSQL

cd ../twin_sync
python3 twin_sync.py            # Step 4: sync LRU health states
```

### 5. Verify data is in the database
```bash
docker exec -it aircraft_pg psql -U admin -d aircraft_db -c "SELECT COUNT(*) FROM qar_readings;"
docker exec -it aircraft_pg psql -U admin -d aircraft_db -c "SELECT * FROM cascade_events;"
```

---

## Service URLs

| Service    | URL                        |
|------------|----------------------------|
| Backend API | http://localhost:8000      |
| API Docs   | http://localhost:8000/docs  |
| Neo4j Browser | http://localhost:7474   |
| Frontend   | http://localhost:3000       |

---

## Project Structure

```
aircraft-failure-analyzer/
├── data_pipeline/          ← M1: data generation & ingestion
│   ├── generators/
│   │   ├── qar_generator.py       # synthetic sensor data
│   │   └── cascade_injector.py    # inject failure cascades
│   ├── ingestion/
│   │   └── ingest.py              # CSV → PostgreSQL
│   ├── twin_sync/
│   │   └── twin_sync.py           # update LRU health states
│   ├── schemas/
│   │   └── init_db.sql            # PostgreSQL schema + seed data
│   └── output/
│       ├── raw/                   # clean QAR data
│       └── labeled/               # data with injected cascades
├── backend/                ← M4: FastAPI REST API
│   ├── api/routes/                # aircraft, alerts, predictions, reports
│   ├── core/propagation_engine.py # cascade simulation
│   ├── db/                        # Postgres + Neo4j clients
│   └── main.py
├── frontend/               ← M5: React dashboard
│   └── src/
│       ├── pages/                 # Dashboard, GraphView, etc.
│       └── components/
├── docs/
│   ├── architecture.md
│   └── api-reference.md
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## Data Files (M1 outputs → shared with M3)

| File | Size | Description |
|------|------|-------------|
| `output/raw/qar_normal.csv` | ~15MB | 240k rows of clean sensor readings |
| `output/labeled/qar_with_cascades.csv` | ~15MB | Same data with injected failures |
| `output/labeled/cascade_labels.csv` | <1KB | Ground truth cascade event labels |

> **Note:** The `output/` directory is in `.gitignore`. Share these files via Google Drive or an S3 bucket.
