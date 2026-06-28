-- ============================================================
-- Aircraft Failure Propagation Analyzer — PostgreSQL Schema
-- Owner: Member 1 (Data & Digital Twin Engineer)
-- ============================================================

-- TABLE 1: Aircraft
CREATE TABLE IF NOT EXISTS aircraft (
    aircraft_id        SERIAL PRIMARY KEY,
    tail_number        VARCHAR(20) UNIQUE NOT NULL,
    aircraft_type      VARCHAR(20) NOT NULL,
    operator           VARCHAR(100),
    msn                VARCHAR(20),
    total_flight_hours FLOAT DEFAULT 0,
    created_at         TIMESTAMP DEFAULT NOW()
);

-- TABLE 2: LRUs (Line Replaceable Units / subsystems)
CREATE TABLE IF NOT EXISTS lrus (
    lru_id             SERIAL PRIMARY KEY,
    aircraft_id        INT REFERENCES aircraft(aircraft_id) ON DELETE CASCADE,
    lru_code           VARCHAR(30) NOT NULL,
    name               VARCHAR(100),
    ata_chapter        VARCHAR(10),
    lru_type           VARCHAR(50),
    current_state      VARCHAR(20) DEFAULT 'HEALTHY',
    anomaly_score      FLOAT DEFAULT 0.0,
    criticality_weight FLOAT DEFAULT 0.5,
    last_updated       TIMESTAMP DEFAULT NOW(),
    UNIQUE(aircraft_id, lru_code)
);

-- TABLE 3: Flights
CREATE TABLE IF NOT EXISTS flights (
    flight_id    SERIAL PRIMARY KEY,
    aircraft_id  INT REFERENCES aircraft(aircraft_id) ON DELETE CASCADE,
    flight_number VARCHAR(20),
    departure    VARCHAR(10),
    arrival      VARCHAR(10),
    flight_hours FLOAT DEFAULT 1.0,
    departed_at  TIMESTAMP,
    landed_at    TIMESTAMP,
    created_at   TIMESTAMP DEFAULT NOW()
);

-- TABLE 4: QAR Readings (main sensor data table)
CREATE TABLE IF NOT EXISTS qar_readings (
    id            BIGSERIAL PRIMARY KEY,
    aircraft_id   INT REFERENCES aircraft(aircraft_id),
    flight_id     INT REFERENCES flights(flight_id),
    lru_id        INT REFERENCES lrus(lru_id),
    param_type    VARCHAR(30) NOT NULL,
    value         FLOAT NOT NULL,
    unit          VARCHAR(20),
    timestamp     TIMESTAMP NOT NULL,
    is_anomalous  BOOLEAN DEFAULT FALSE,
    anomaly_score FLOAT DEFAULT 0.0
);

-- TABLE 5: Cascade Events (labeled ground truth for ML training)
CREATE TABLE IF NOT EXISTS cascade_events (
    event_id                  SERIAL PRIMARY KEY,
    aircraft_id               INT REFERENCES aircraft(aircraft_id),
    flight_id                 INT REFERENCES flights(flight_id),
    root_cause_lru_id         INT REFERENCES lrus(lru_id),
    affected_lru_id           INT REFERENCES lrus(lru_id),
    injection_flight          INT NOT NULL,
    onset_flight              INT NOT NULL,
    propagation_delay_flights INT,
    edge_type                 VARCHAR(30),
    base_weight               FLOAT,
    scenario_name             VARCHAR(100),
    created_at                TIMESTAMP DEFAULT NOW()
);

-- TABLE 6: Alerts (for M4's API)
CREATE TABLE IF NOT EXISTS alerts (
    alert_id    SERIAL PRIMARY KEY,
    aircraft_id INT REFERENCES aircraft(aircraft_id),
    lru_id      INT REFERENCES lrus(lru_id),
    severity    VARCHAR(20) DEFAULT 'medium',
    message     TEXT,
    status      VARCHAR(20) DEFAULT 'open',
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_qar_aircraft  ON qar_readings(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_qar_lru       ON qar_readings(lru_id);
CREATE INDEX IF NOT EXISTS idx_qar_flight    ON qar_readings(flight_id);
CREATE INDEX IF NOT EXISTS idx_qar_timestamp ON qar_readings(timestamp);
CREATE INDEX IF NOT EXISTS idx_qar_anomalous ON qar_readings(is_anomalous);
CREATE INDEX IF NOT EXISTS idx_lru_aircraft  ON lrus(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO aircraft (tail_number, aircraft_type, operator, total_flight_hours)
VALUES ('VT-INX', 'A320', 'IndiGo', 18430)
ON CONFLICT DO NOTHING;

INSERT INTO lrus (aircraft_id, lru_code, name, ata_chapter, lru_type, criticality_weight)
VALUES
  (1, 'HYD-2A',     'Hydraulic Pump 2A',           '29', 'hydraulic_pump', 0.90),
  (1, 'ACT-L4',     'Left Aileron Actuator',        '27', 'actuator',       0.95),
  (1, 'FCU-L',      'Rudder PCU Left',              '27', 'pcu',            0.90),
  (1, 'ENG1-FADEC', 'Engine 1 FADEC',               '73', 'fadec',          0.95),
  (1, 'BLEED-V1',   'Engine 1 Bleed Valve',         '36', 'bleed_valve',    0.70),
  (1, 'AVNX-COOL',  'Avionics Cooling Unit',        '21', 'cooling',        0.60),
  (1, 'ADIRU-1',    'Air Data / Inertial Unit 1',   '34', 'adiru',          0.90),
  (1, 'GEN-1',      'Engine 1 Generator',           '24', 'generator',      0.80),
  (1, 'FUEL-P1',    'Engine 1 Fuel Pump',           '28', 'fuel_pump',      0.85),
  (1, 'APU',        'Auxiliary Power Unit',         '49', 'apu',            0.50)
ON CONFLICT DO NOTHING;
