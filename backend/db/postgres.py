"""
PostgreSQL Client — Member 4 (Backend & API Engineer)
Database connection pool and query helpers for FastAPI.
Schema defined by M1 in data_pipeline/schemas/init_db.sql
"""
import os
import sys
import logging
from datetime import datetime, timedelta
from typing import AsyncGenerator
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, BigInteger
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.exc import SQLAlchemyError

# Configure logger
logger = logging.getLogger("db_postgres")
logging.basicConfig(level=logging.INFO)

# Declarative Base
class Base(DeclarativeBase):
    pass

# ORM Models matching PostgreSQL schema
class Aircraft(Base):
    __tablename__ = "aircraft"
    aircraft_id = Column(Integer, primary_key=True, index=True)
    tail_number = Column(String(20), unique=True, nullable=False)
    aircraft_type = Column(String(20), nullable=False)
    operator = Column(String(100))
    msn = Column(String(20))
    total_flight_hours = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    lrus = relationship("LRU", back_populates="aircraft", cascade="all, delete-orphan")
    flights = relationship("Flight", back_populates="aircraft", cascade="all, delete-orphan")

class LRU(Base):
    __tablename__ = "lrus"
    lru_id = Column(Integer, primary_key=True, index=True)
    aircraft_id = Column(Integer, ForeignKey("aircraft.aircraft_id", ondelete="CASCADE"))
    lru_code = Column(String(30), nullable=False)
    name = Column(String(100))
    ata_chapter = Column(String(10))
    lru_type = Column(String(50))
    current_state = Column(String(20), default="HEALTHY")
    anomaly_score = Column(Float, default=0.0)
    criticality_weight = Column(Float, default=0.5)
    last_updated = Column(DateTime, default=datetime.utcnow)

    aircraft = relationship("Aircraft", back_populates="lrus")
    qar_readings = relationship("QARReading", back_populates="lru", cascade="all, delete-orphan")

class Flight(Base):
    __tablename__ = "flights"
    flight_id = Column(Integer, primary_key=True, index=True)
    aircraft_id = Column(Integer, ForeignKey("aircraft.aircraft_id", ondelete="CASCADE"))
    flight_number = Column(String(20))
    departure = Column(String(10))
    arrival = Column(String(10))
    flight_hours = Column(Float, default=1.0)
    departed_at = Column(DateTime)
    landed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    aircraft = relationship("Aircraft", back_populates="flights")
    qar_readings = relationship("QARReading", back_populates="flight", cascade="all, delete-orphan")

class QARReading(Base):
    __tablename__ = "qar_readings"
    id = Column(Integer().with_variant(BigInteger, "postgresql"), primary_key=True, index=True)
    aircraft_id = Column(Integer, ForeignKey("aircraft.aircraft_id"))
    flight_id = Column(Integer, ForeignKey("flights.flight_id", ondelete="CASCADE"))
    lru_id = Column(Integer, ForeignKey("lrus.lru_id", ondelete="CASCADE"))
    param_type = Column(String(30), nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String(20))
    timestamp = Column(DateTime, nullable=False)
    is_anomalous = Column(Boolean, default=False)
    anomaly_score = Column(Float, default=0.0)

    lru = relationship("LRU", back_populates="qar_readings")
    flight = relationship("Flight", back_populates="qar_readings")

class CascadeEvent(Base):
    __tablename__ = "cascade_events"
    event_id = Column(Integer, primary_key=True, index=True)
    aircraft_id = Column(Integer, ForeignKey("aircraft.aircraft_id"))
    flight_id = Column(Integer, ForeignKey("flights.flight_id"))
    root_cause_lru_id = Column(Integer, ForeignKey("lrus.lru_id"))
    affected_lru_id = Column(Integer, ForeignKey("lrus.lru_id"))
    injection_flight = Column(Integer, nullable=False)
    onset_flight = Column(Integer, nullable=False)
    propagation_delay_flights = Column(Integer)
    edge_type = Column(String(30))
    base_weight = Column(Float)
    scenario_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"
    alert_id = Column(Integer, primary_key=True, index=True)
    aircraft_id = Column(Integer, ForeignKey("aircraft.aircraft_id"))
    lru_id = Column(Integer, ForeignKey("lrus.lru_id"))
    severity = Column(String(20), default="medium")
    message = Column(Text)
    status = Column(String(20), default="open")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    lru = relationship("LRU")


# Database URL setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin123@localhost:5432/aircraft_db")

# Convert postgresql:// to postgresql+asyncpg:// if needed
if DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    ASYNC_DATABASE_URL = DATABASE_URL

# In-memory or workspace SQLite fallback URL
SQLITE_FALLBACK_URL = "sqlite+aiosqlite:///:memory:"

engine = None
async_session_maker = None
IS_FALLBACK = False

async def initialize_db_engine():
    global engine, async_session_maker, IS_FALLBACK
    
    # Try PostgreSQL first
    try:
        logger.info(f"Connecting to primary database: {ASYNC_DATABASE_URL}")
        engine = create_async_engine(ASYNC_DATABASE_URL, echo=False, future=True)
        # Test connection
        async with engine.connect() as conn:
            await conn.execute(Base.metadata.tables[Aircraft.__tablename__].select().limit(1))
        logger.info("Successfully connected to PostgreSQL database.")
    except Exception as e:
        logger.warning(f"Could not connect to PostgreSQL ({e}). Falling back to SQLite...")
        IS_FALLBACK = True
        engine = create_async_engine(SQLITE_FALLBACK_URL, connect_args={"check_same_thread": False})
        logger.info("SQLite fallback engine initialized.")
    
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

# FastAPI session dependency
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if async_session_maker is None:
        await initialize_db_engine()
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

# Startup Database Init & Seed (specifically for fallback or clean DB)
async def init_db():
    if engine is None:
        await initialize_db_engine()
    
    # If fallback (or we want to guarantee table existence), run create_all
    if IS_FALLBACK:
        logger.info("Initializing schema in SQLite database...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Seed initial data
        async with async_session_maker() as session:
            # Check if aircraft already exists
            from sqlalchemy import select
            result = await session.execute(select(Aircraft).filter_by(tail_number="VT-INX"))
            aircraft_exists = result.scalars().first()
            
            if not aircraft_exists:
                logger.info("Seeding database tables...")
                # Seed Aircraft
                ac = Aircraft(
                    tail_number="VT-INX",
                    aircraft_type="A320",
                    operator="IndiGo",
                    msn="10294",
                    total_flight_hours=18430.0
                )
                session.add(ac)
                await session.flush() # Get aircraft_id
                
                # Seed LRUs matching data_pipeline schema seed data
                lrus_data = [
                    ("HYD-2A",     "Hydraulic Pump 2A",           "29", "hydraulic_pump", 0.90, "HEALTHY", 0.0),
                    ("ACT-L4",     "Left Aileron Actuator",        "27", "actuator",       0.95, "HEALTHY", 0.0),
                    ("FCU-L",      "Rudder PCU Left",              "27", "pcu",            0.90, "HEALTHY", 0.0),
                    ("ENG1-FADEC", "Engine 1 FADEC",               "73", "fadec",          0.95, "HEALTHY", 0.0),
                    ("BLEED-V1",   "Engine 1 Bleed Valve",         "36", "bleed_valve",    0.70, "HEALTHY", 0.0),
                    ("AVNX-COOL",  "Avionics Cooling Unit",        "21", "cooling",        0.60, "HEALTHY", 0.0),
                    ("ADIRU-1",    "Air Data / Inertial Unit 1",   "34", "adiru",          0.90, "HEALTHY", 0.0),
                    ("GEN-1",      "Engine 1 Generator",           "24", "generator",      0.80, "HEALTHY", 0.0),
                    ("FUEL-P1",    "Engine 1 Fuel Pump",           "28", "fuel_pump",      0.85, "HEALTHY", 0.0),
                    ("APU",        "Auxiliary Power Unit",         "49", "apu",            0.50, "HEALTHY", 0.0)
                ]
                
                lru_objects = []
                for code, name, ata, ltype, weight, state, score in lrus_data:
                    lru = LRU(
                        aircraft_id=ac.aircraft_id,
                        lru_code=code,
                        name=name,
                        ata_chapter=ata,
                        lru_type=ltype,
                        criticality_weight=weight,
                        current_state=state,
                        anomaly_score=score
                    )
                    session.add(lru)
                    lru_objects.append(lru)
                
                await session.flush()
                
                # Seed some flight history for reports (last 30 flights)
                flights = []
                base_time = datetime.utcnow() - timedelta(days=15)
                for i in range(1, 31):
                    dep_time = base_time + timedelta(hours=i * 12)
                    arr_time = dep_time + timedelta(hours=2)
                    flight = Flight(
                        aircraft_id=ac.aircraft_id,
                        flight_number=f"6E-{200 + i}",
                        departure="BOM",
                        arrival="DEL",
                        flight_hours=2.0,
                        departed_at=dep_time,
                        landed_at=arr_time
                    )
                    session.add(flight)
                    flights.append(flight)
                
                await session.flush()
                
                # Seed QAR Readings: some normal, some anomalous
                # Let's add some readings for the last 5 flights
                import random
                lru_id_map = {l.lru_code: l.lru_id for l in lru_objects}
                
                for flight in flights[-5:]:
                    # Normal readings for all LRUs
                    for lru in lru_objects:
                        reading = QARReading(
                            aircraft_id=ac.aircraft_id,
                            flight_id=flight.flight_id,
                            lru_id=lru.lru_id,
                            param_type="TEMP" if "COOL" in lru.lru_code or "AVNX" in lru.lru_code else "PRESS" if "HYD" in lru.lru_code or "BLEED" in lru.lru_code else "DRIFT",
                            value=random.uniform(20.0, 50.0),
                            unit="C" if "COOL" in lru.lru_code else "psi",
                            timestamp=flight.landed_at,
                            is_anomalous=False,
                            anomaly_score=random.uniform(0.0, 0.15)
                        )
                        session.add(reading)
                
                # Seed a couple of open Alerts
                alert1 = Alert(
                    aircraft_id=ac.aircraft_id,
                    lru_id=lru_id_map["HYD-2A"],
                    severity="high",
                    message="Hydraulic pump 2A pressure is dropping over flights.",
                    status="open",
                    created_at=datetime.utcnow() - timedelta(hours=4)
                )
                alert2 = Alert(
                    aircraft_id=ac.aircraft_id,
                    lru_id=lru_id_map["BLEED-V1"],
                    severity="medium",
                    message="Engine 1 bleed valve pressure fluctuations observed.",
                    status="open",
                    created_at=datetime.utcnow() - timedelta(hours=10)
                )
                session.add(alert1)
                session.add(alert2)
                
                await session.commit()
                logger.info("Database seed complete.")
            else:
                logger.info("Database already seeded.")
