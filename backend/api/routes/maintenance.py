"""
Maintenance Routes — Member 4 (Backend & API Engineer)
Generates maintenance recommendation plans based on LRU anomaly scores and criticality weights.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from backend.db.postgres import get_db, Aircraft, LRU
from backend.api.schemas.models import MaintenancePlanResponse, MaintenanceRecommendation

router = APIRouter()

@router.get("/maintenance-plan/{id}", response_model=MaintenancePlanResponse)
async def generate_maintenance_plan(id: int, db: AsyncSession = Depends(get_db)):
    """
    Generate a prioritized maintenance plan and list of recommendations for an aircraft
    by analyzing the health states of all its Line Replaceable Units (LRUs).
    """
    # 1. Verify aircraft exists
    aircraft_result = await db.execute(select(Aircraft).filter_by(aircraft_id=id))
    aircraft = aircraft_result.scalars().first()
    if not aircraft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aircraft with ID {id} not found"
        )
        
    try:
        # 2. Query LRUs
        result = await db.execute(select(LRU).filter_by(aircraft_id=id))
        lrus = result.scalars().all()
        
        recommendations = []
        highest_severity_state = "HEALTHY"
        
        for lru in lrus:
            score = lru.anomaly_score or 0.0
            weight = lru.criticality_weight or 0.5
            state = lru.current_state or "HEALTHY"
            
            # Map state to priority and specific actions
            if state == "FAILED" or score >= 0.90:
                priority = "CRITICAL"
                action = f"CRITICAL: Immediate replacement of {lru.name} ({lru.lru_code}) is required. Ground the aircraft until resolved to prevent system-wide cascading failure."
                highest_severity_state = "FAILED"
            elif state == "CRITICAL" or score >= 0.65:
                priority = "HIGH"
                action = f"HIGH: Schedule physical inspection and sensor recalibration for {lru.name} ({lru.lru_code}) within 24-48 flight hours. Prepare replacement stock."
                if highest_severity_state != "FAILED":
                    highest_severity_state = "CRITICAL"
            elif state == "DEGRADED" or score >= 0.30:
                priority = "MEDIUM"
                action = f"MEDIUM: Inspect electrical/mechanical connections of {lru.name} ({lru.lru_code}) during next routine overnight check. Monitor telemetry trends."
                if highest_severity_state not in ["FAILED", "CRITICAL"]:
                    highest_severity_state = "DEGRADED"
            else:
                continue # Skip healthy units from the recommendations list to keep focus on actions
                
            recommendations.append(MaintenanceRecommendation(
                lru_code=lru.lru_code,
                lru_name=lru.name or "Unknown LRU",
                current_state=state,
                anomaly_score=round(score, 4),
                criticality_weight=weight,
                priority=priority,
                action=action
            ))
            
        # Sort recommendations by criticality weight and anomaly score desc
        recommendations.sort(
            key=lambda x: (
                {"CRITICAL": 3, "HIGH": 2, "MEDIUM": 1}.get(x.priority, 0),
                x.anomaly_score * x.criticality_weight
            ),
            reverse=True
        )
        
        # Determine plan-level maintenance status
        if highest_severity_state == "FAILED":
            plan_status = "AIRCRAFT_GROUNDED"
        elif highest_severity_state == "CRITICAL":
            plan_status = "URGENT_MAINTENANCE_REQUIRED"
        elif highest_severity_state == "DEGRADED":
            plan_status = "SCHEDULED_INSPECTION_REQUIRED"
        else:
            plan_status = "MONITOR_AND_OPERATE"
            
        return MaintenancePlanResponse(
            aircraft_id=id,
            tail_number=aircraft.tail_number,
            status=plan_status,
            recommendations=recommendations,
            generated_at=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating maintenance plan: {str(e)}"
        )
