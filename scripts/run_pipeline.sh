#!/bin/bash
# run_pipeline.sh — Member 1
# Runs the full M1 pipeline from scratch: generate → inject → ingest → sync

set -e
cd "$(dirname "$0")/.."

echo "======================================"
echo " Aircraft Failure Analyzer — M1 Pipeline"
echo "======================================"

echo ""
echo "Step 1: Generate clean QAR data..."
cd data_pipeline/generators
python3 qar_generator.py

echo ""
echo "Step 2: Inject cascade failures..."
python3 cascade_injector.py

echo ""
echo "Step 3: Load data into PostgreSQL..."
cd ../ingestion
python3 ingest.py

echo ""
echo "Step 4: Run twin sync..."
cd ../twin_sync
python3 twin_sync.py

echo ""
echo "======================================"
echo " Pipeline complete!"
echo "======================================"
