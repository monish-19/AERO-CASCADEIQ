"""
Alerts Routes — Member 4 (Backend & API Engineer)
Endpoints for retrieving open alerts and updating their statuses.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime

from backend.db.postgres import get_db, Alert, LRU
from backend.api.schemas.models import AlertResponse, AlertUpdate

router = APIRouter()

@router.get("/alerts", response_model=List[AlertResponse])
async def list_open_alerts(db: AsyncSession = Depends(get_db)):
    """Retrieve all open failure alerts, including the associated LRU code."""
    try:
        # Join Alert with LRU to retrieve lru_code
        query = (
            select(Alert, LRU.lru_code)
            .join(LRU, Alert.lru_id == LRU.lru_id)
            .filter(Alert.status == "open")
            .order_by(Alert.created_at.desc())
        )
        result = await db.execute(query)
        rows = result.all()
        
        alerts_list = []
        for alert, lru_code in rows:
            alerts_list.append(AlertResponse(
                alert_id=alert.alert_id,
                aircraft_id=alert.aircraft_id,
                lru_id=alert.lru_id,
                lru_code=lru_code,
                severity=alert.severity,
                message=alert.message,
                status=alert.status,
                created_at=alert.created_at,
                updated_at=alert.updated_at
            ))
        return alerts_list
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.put("/alerts/{alert_id}", response_model=AlertResponse)
async def update_alert_status(alert_id: int, payload: AlertUpdate, db: AsyncSession = Depends(get_db)):
    """Update the status of an alert (e.g. acknowledge or resolve it)."""
    # Fetch alert
    query = select(Alert).filter_by(alert_id=alert_id)
    result = await db.execute(query)
    alert = result.scalars().first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found"
        )
        
    valid_statuses = ["open", "acknowledged", "resolved"]
    if payload.status.lower() not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Must be one of: {', '.join(valid_statuses)}"
        )
        
    try:
        alert.status = payload.status.lower()
        alert.updated_at = datetime.utcnow()
        await db.commit()
        
        # Fetch lru_code for response
        lru_result = await db.execute(select(LRU.lru_code).filter_by(lru_id=alert.lru_id))
        lru_code = lru_result.scalars().first()
        
        return AlertResponse(
            alert_id=alert.alert_id,
            aircraft_id=alert.aircraft_id,
            lru_id=alert.lru_id,
            lru_code=lru_code,
            severity=alert.severity,
            message=alert.message,
            status=alert.status,
            created_at=alert.created_at,
            updated_at=alert.updated_at
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating alert: {str(e)}"
        )
