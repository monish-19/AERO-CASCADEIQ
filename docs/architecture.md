# System Architecture

See Section 5 of the blueprint (docs/blueprint.md) for the full architecture.

## Services
- **PostgreSQL** (port 5432): main relational database — owned by M1
- **Neo4j** (port 7474/7687): graph database for dependency graph — owned by M2
- **FastAPI backend** (port 8000): REST API — owned by M4
- **React frontend** (port 3000): dashboard — owned by M5

## Data Flow
QAR data → M1 pipeline → PostgreSQL → M3 anomaly models → M4 propagation engine → M5 dashboard
