"""
Pydantic Validation Schemas — Member 4 (Backend & API Engineer)
Defines models for request/response validation in FastAPI routes.
"""
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List, Optional, Dict

class AircraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    aircraft_id: int
    tail_number: str
    aircraft_type: str
    operator: Optional[str] = None
    msn: Optional[str] = None
    total_flight_hours: float
    created_at: datetime

class LRUResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    lru_id: int
    aircraft_id: int
    lru_code: str
    name: Optional[str] = None
    ata_chapter: Optional[str] = None
    lru_type: Optional[str] = None
    current_state: str
    anomaly_score: float
    criticality_weight: float
    last_updated: datetime

class RiskScoreResponse(BaseModel):
    aircraft_id: int
    tail_number: str
    risk_score: float = Field(..., description="Overall risk index score from 0.0 to 100.0")
    status: str = Field(..., description="Overall aircraft health status: HEALTHY, DEGRADED, CRITICAL, FAILED")
    critical_lrus_count: int
    total_lrus_count: int
    state_distribution: Dict[str, int] = Field(..., description="Count of LRUs in each health state")

class PredictionRequest(BaseModel):
    lru_code: str = Field(..., description="LRU code that has failed or is anomalous")
    severity: float = Field(..., description="Initial anomaly score/severity (0.0 to 1.0)")

class SimulatedNode(BaseModel):
    lru_code: str
    anomaly_score: float
    state: str
    depth: int
    path: List[str]
    probability: float

class SimulatedEdge(BaseModel):
    source: str
    target: str
    edge_type: str
    base_weight: float
    propagated_severity: float

class PredictionResponse(BaseModel):
    root_cause_lru: str
    initial_severity: float
    nodes: List[SimulatedNode]
    edges: List[SimulatedEdge]

class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    alert_id: int
    aircraft_id: int
    lru_id: int
    lru_code: Optional[str] = None
    severity: str
    message: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

class AlertUpdate(BaseModel):
    status: str = Field(..., description="New status for the alert: open, acknowledged, resolved")

class MaintenanceRecommendation(BaseModel):
    lru_code: str
    lru_name: str
    current_state: str
    anomaly_score: float
    criticality_weight: float
    priority: str = Field(..., description="Priority: CRITICAL, HIGH, MEDIUM, LOW")
    action: str = Field(..., description="Recommended action")

class MaintenancePlanResponse(BaseModel):
    aircraft_id: int
    tail_number: str
    status: str
    recommendations: List[MaintenanceRecommendation]
    generated_at: datetime

class AnomalyTrendPoint(BaseModel):
    date: str
    avg_anomaly_score: float
    anomalous_readings_count: int

class ReportResponse(BaseModel):
    aircraft_id: int
    tail_number: str
    period_days: int
    total_flights: int
    total_flight_hours: float
    anomalies_detected_count: int
    open_alerts_count: int
    health_trend: List[AnomalyTrendPoint]
