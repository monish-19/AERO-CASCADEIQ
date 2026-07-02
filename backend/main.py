"""
Backend Entry Point — Member 4 (Backend & API Engineer)
FastAPI application. Run with: uvicorn main:app --reload
"""
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.db.postgres import initialize_db_engine, init_db
from backend.db.neo4j_client import neo4j_client

# Import routers
from backend.api.routes.aircraft import router as aircraft_router
from backend.api.routes.alerts import router as alerts_router
from backend.api.routes.predictions import router as predictions_router
from backend.api.routes.maintenance import router as maintenance_router
from backend.api.routes.reports import router as reports_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Postgres engine and seed fallback if necessary
    await initialize_db_engine()
    await init_db()
    
    # Establish graph DB connection and seed initial topology
    neo4j_client.connect()
    neo4j_client.seed_graph()
    
    yield
    
    # Shutdown: Clean up connections
    neo4j_client.close()

app = FastAPI(
    title="Aircraft Failure Propagation Analyzer API",
    description="Digital Twin REST API for predicting cascading failures in aircraft subsystems.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS Middleware for the React dashboard
# By default allow localhost:3000 (standard React port) and wildcard in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under /api/v1 prefix
app.include_router(aircraft_router, prefix="/api/v1", tags=["Aircraft"])
app.include_router(alerts_router, prefix="/api/v1", tags=["Alerts"])
app.include_router(predictions_router, prefix="/api/v1", tags=["Predictions"])
app.include_router(maintenance_router, prefix="/api/v1", tags=["Maintenance"])
app.include_router(reports_router, prefix="/api/v1", tags=["Reports"])

@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "healthy",
        "service": "Aircraft Failure Propagation Analyzer API",
        "db_mode": "SQLite Fallback" if getattr(neo4j_client, "is_fallback", True) else "PostgreSQL + Neo4j"
    }

if __name__ == "__main__":
    # Get port from env or default to 8000
    port = int(os.getenv("API_PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)

