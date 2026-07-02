"""
Aircraft Routes — Member 4 (Backend & API Engineer)
Endpoints for listing aircraft, listing LRUs, and computing overall risk scores.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from backend.db.postgres import get_db, Aircraft, LRU
from backend.api.schemas.models import AircraftResponse, LRUResponse, RiskScoreResponse

router = APIRouter()

@router.get("/aircraft", response_model=List[AircraftResponse])
async def list_aircraft(db: AsyncSession = Depends(get_db)):
    """List all registered aircraft in the system."""
    try:
        result = await db.execute(select(Aircraft))
        aircraft_list = result.scalars().all()
        return aircraft_list
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.get("/aircraft/{id}/lrus", response_model=List[LRUResponse])
async def list_aircraft_lrus(id: int, db: AsyncSession = Depends(get_db)):
    """List all LRUs (subsystems) with their current health state for a specific aircraft."""
    # First verify aircraft exists
    aircraft_result = await db.execute(select(Aircraft).filter_by(aircraft_id=id))
    aircraft = aircraft_result.scalars().first()
    if not aircraft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aircraft with ID {id} not found"
        )
        
    try:
        result = await db.execute(select(LRU).filter_by(aircraft_id=id))
        lru_list = result.scalars().all()
        return lru_list
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.get("/aircraft-risk/{id}", response_model=RiskScoreResponse)
async def get_aircraft_risk(id: int, db: AsyncSession = Depends(get_db)):
    """
    Compute the overall risk score index for an aircraft.
    Formula: Risk Score = Sum(anomaly_score * criticality_weight) / Sum(criticality_weight) * 100
    """
    aircraft_result = await db.execute(select(Aircraft).filter_by(aircraft_id=id))
    aircraft = aircraft_result.scalars().first()
    if not aircraft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aircraft with ID {id} not found"
        )
        
    try:
        result = await db.execute(select(LRU).filter_by(aircraft_id=id))
        lrus = result.scalars().all()
        
        if not lrus:
            return RiskScoreResponse(
                aircraft_id=id,
                tail_number=aircraft.tail_number,
                risk_score=0.0,
                status="HEALTHY",
                critical_lrus_count=0,
                total_lrus_count=0,
                state_distribution={"HEALTHY": 0, "DEGRADED": 0, "CRITICAL": 0, "FAILED": 0}
            )
            
        total_weight = 0.0
        weighted_score_sum = 0.0
        critical_count = 0
        max_score = 0.0
        
        distribution = {"HEALTHY": 0, "DEGRADED": 0, "CRITICAL": 0, "FAILED": 0}
        
        for lru in lrus:
            anomaly_score = lru.anomaly_score or 0.0
            weight = lru.criticality_weight or 0.5
            state = lru.current_state or "HEALTHY"
            
            weighted_score_sum += anomaly_score * weight
            total_weight += weight
            max_score = max(max_score, anomaly_score)
            
            if state in ["CRITICAL", "FAILED"]:
                critical_count += 1
                
            if state in distribution:
                distribution[state] += 1
            else:
                distribution["HEALTHY"] += 1
                
        # Calculate risk score (0 to 100)
        risk_score = (weighted_score_sum / total_weight) * 100.0 if total_weight > 0 else 0.0
        risk_score = round(risk_score, 2)
        
        # Determine overall status safely
        if max_score >= 0.90 or risk_score >= 90.0:
            status_val = "FAILED"
        elif max_score >= 0.65 or risk_score >= 65.0:
            status_val = "CRITICAL"
        elif max_score >= 0.30 or risk_score >= 30.0:
            status_val = "DEGRADED"
        else:
            status_val = "HEALTHY"
            
        return RiskScoreResponse(
            aircraft_id=id,
            tail_number=aircraft.tail_number,
            risk_score=risk_score,
            status=status_val,
            critical_lrus_count=critical_count,
            total_lrus_count=len(lrus),
            state_distribution=distribution
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating risk score: {str(e)}"
        )
