"""
Predictions Routes — Member 4 (Backend & API Engineer)
Endpoint for running failure cascade simulations starting from a specified LRU.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.postgres import get_db, LRU
from backend.core.propagation_engine import simulate_propagation
from backend.api.schemas.models import PredictionRequest, PredictionResponse

router = APIRouter()

@router.post("/predict-failure", response_model=PredictionResponse)
async def predict_failure_cascade(payload: PredictionRequest, db: AsyncSession = Depends(get_db)):
    """
    Run a failure cascade simulation starting from a root-cause LRU code and a given initial severity score.
    Returns the predicted impacted nodes (LRUs) and propagation edges.
    """
    # 1. Verify the LRU exists in the database
    query = select(LRU).filter_by(lru_code=payload.lru_code)
    result = await db.execute(query)
    lru = result.scalars().first()
    
    if not lru:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Root cause LRU code '{payload.lru_code}' not found in database."
        )
        
    # 2. Enforce severity boundaries (0.0 to 1.0)
    severity = max(0.0, min(1.0, payload.severity))
    
    try:
        # 3. Execute propagation engine simulation
        simulation_result = simulate_propagation(
            root_lru_code=payload.lru_code,
            initial_severity=severity
        )
        
        # 4. Construct response
        return PredictionResponse(
            root_cause_lru=payload.lru_code,
            initial_severity=severity,
            nodes=simulation_result["nodes"],
            edges=simulation_result["edges"]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation error: {str(e)}"
        )
