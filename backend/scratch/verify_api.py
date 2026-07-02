"""
API Verification Script — Member 4 (Backend & API Engineer)
Tests all FastAPI endpoints using TestClient to verify correct responses and schemas.
Run this from the workspace root directory with:
  python -m backend.scratch.verify_api
"""
import sys
import os
import json

# Add workspace root to python path to allow absolute imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from fastapi.testclient import TestClient
from backend.main import app

def print_result(name: str, passed: bool, data: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}")
    if data:
        print(f"         Response: {data}")

def main():
    print("==================================================")
    print(" Running Backend API Endpoint Verification Tests ")
    print("==================================================\n")
    
    # We use TestClient as a context manager to trigger lifespan startup & shutdown
    with TestClient(app) as client:
        # Test 1: Health & Root Endpoint
        print("Test 1: Health Check...")
        res = client.get("/")
        if res.status_code == 200:
            print_result("GET /", True, json.dumps(res.json()))
        else:
            print_result("GET /", False, f"Status: {res.status_code}")
            
        # Test 2: List Aircraft
        print("\nTest 2: List Aircraft...")
        res = client.get("/api/v1/aircraft")
        if res.status_code == 200 and isinstance(res.json(), list) and len(res.json()) > 0:
            print_result("GET /api/v1/aircraft", True, f"Found {len(res.json())} aircraft. Tail: {res.json()[0]['tail_number']}")
            aircraft_id = res.json()[0]["aircraft_id"]
        else:
            print_result("GET /api/v1/aircraft", False, f"Status: {res.status_code}, Body: {res.text}")
            aircraft_id = 1 # Fallback for next tests
            
        # Test 3: List LRUs
        print("\nTest 3: List Aircraft LRUs...")
        res = client.get(f"/api/v1/aircraft/{aircraft_id}/lrus")
        if res.status_code == 200 and isinstance(res.json(), list) and len(res.json()) > 0:
            print_result(f"GET /api/v1/aircraft/{aircraft_id}/lrus", True, f"Found {len(res.json())} LRUs. First: {res.json()[0]['lru_code']}")
        else:
            print_result(f"GET /api/v1/aircraft/{aircraft_id}/lrus", False, f"Status: {res.status_code}, Body: {res.text}")
            
        # Test 4: Aircraft Risk Score
        print("\nTest 4: Get Aircraft Risk Score...")
        res = client.get(f"/api/v1/aircraft-risk/{aircraft_id}")
        if res.status_code == 200:
            data = res.json()
            print_result(
                f"GET /api/v1/aircraft-risk/{aircraft_id}", 
                True, 
                f"Score: {data['risk_score']}, Status: {data['status']}, State Dist: {data['state_distribution']}"
            )
        else:
            print_result(f"GET /api/v1/aircraft-risk/{aircraft_id}", False, f"Status: {res.status_code}, Body: {res.text}")
            
        # Test 5: Open Alerts
        print("\nTest 5: List Open Alerts...")
        res = client.get("/api/v1/alerts")
        if res.status_code == 200 and isinstance(res.json(), list):
            data = res.json()
            print_result("GET /api/v1/alerts", True, f"Found {len(data)} open alerts.")
            alert_id = data[0]["alert_id"] if len(data) > 0 else None
        else:
            print_result("GET /api/v1/alerts", False, f"Status: {res.status_code}, Body: {res.text}")
            alert_id = None
            
        # Test 6: Acknowledge Alert (if any found)
        if alert_id:
            print(f"\nTest 6: Update Alert {alert_id} Status...")
            res = client.put(f"/api/v1/alerts/{alert_id}", json={"status": "acknowledged"})
            if res.status_code == 200:
                print_result(f"PUT /api/v1/alerts/{alert_id}", True, f"New status: {res.json()['status']}")
            else:
                print_result(f"PUT /api/v1/alerts/{alert_id}", False, f"Status: {res.status_code}, Body: {res.text}")
        else:
            print("\nTest 6: Skip Alert Status Update (No alerts found).")
            
        # Test 7: Failure Cascade Prediction
        print("\nTest 7: Simulate Failure Cascade (HYD-2A with severity 0.85)...")
        res = client.post("/api/v1/predict-failure", json={"lru_code": "HYD-2A", "severity": 0.85})
        if res.status_code == 200:
            data = res.json()
            affected_codes = [node["lru_code"] for node in data["nodes"]]
            print_result(
                "POST /api/v1/predict-failure", 
                True, 
                f"Simulated {len(data['nodes'])} affected nodes: {', '.join(affected_codes)}. Edges traversed: {len(data['edges'])}"
            )
        else:
            print_result("POST /api/v1/predict-failure", False, f"Status: {res.status_code}, Body: {res.text}")
            
        # Test 8: Generate Maintenance Plan
        print("\nTest 8: Generate Maintenance Plan...")
        res = client.get(f"/api/v1/maintenance-plan/{aircraft_id}")
        if res.status_code == 200:
            data = res.json()
            recs = [f"{rec['lru_code']} ({rec['priority']})" for rec in data["recommendations"]]
            print_result(
                f"GET /api/v1/maintenance-plan/{aircraft_id}", 
                True, 
                f"Status: {data['status']}. Recommended: {', '.join(recs) if recs else 'None (All Healthy)'}"
            )
        else:
            print_result(f"GET /api/v1/maintenance-plan/{aircraft_id}", False, f"Status: {res.status_code}, Body: {res.text}")
            
        # Test 9: 30-Day Summary Report
        print("\nTest 9: Get Aircraft 30-Day Summary Report...")
        res = client.get(f"/api/v1/aircraft/{aircraft_id}/report")
        if res.status_code == 200:
            data = res.json()
            print_result(
                f"GET /api/v1/aircraft/{aircraft_id}/report", 
                True, 
                f"Flights: {data['total_flights']}, Hours: {data['total_flight_hours']}, Anomalies: {data['anomalies_detected_count']}, Trend Points: {len(data['health_trend'])}"
            )
        else:
            print_result(f"GET /api/v1/aircraft/{aircraft_id}/report", False, f"Status: {res.status_code}, Body: {res.text}")
            
    print("\n==================================================")
    print(" Verification Complete!")
    print("==================================================")

if __name__ == "__main__":
    main()
