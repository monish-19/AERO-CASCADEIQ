"""
Neo4j Client — Member 4 (Backend & API Engineer)
Graph database client. Graph schema owned by M2.
Used by propagation_engine.py to traverse the dependency graph.
"""
import os
import logging
from datetime import datetime
import networkx as nx

# Configure logger
logger = logging.getLogger("db_neo4j")
logging.basicConfig(level=logging.INFO)

# Try importing neo4j
try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False
    logger.warning("Neo4j python package not installed. Falling back to local graph simulation.")

class Neo4jClient:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "password123")
        self.driver = None
        self.is_fallback = False
        self.local_graph = nx.DiGraph()
        
    def connect(self):
        """Connect to Neo4j. Fall back to local NetworkX graph if unavailable."""
        if not NEO4J_AVAILABLE:
            self.is_fallback = True
            logger.info("Using local NetworkX fallback graph (Neo4j lib not available).")
            return
            
        try:
            logger.info(f"Connecting to Neo4j at {self.uri}")
            self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
            # Verify connectivity
            self.driver.verify_connectivity()
            logger.info("Successfully connected to Neo4j database.")
        except Exception as e:
            logger.warning(f"Could not connect to Neo4j ({e}). Falling back to local NetworkX graph.")
            self.is_fallback = True
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()
            logger.info("Neo4j driver closed.")

    def seed_graph(self):
        """Seed the 10 LRUs and their physical dependency propagation edges."""
        lrus_data = [
            {"id": "HYD-2A",     "name": "Hydraulic Pump 2A",           "ata": "29", "ltype": "hydraulic_pump", "weight": 0.90, "state": "HEALTHY", "score": 0.0},
            {"id": "ACT-L4",     "name": "Left Aileron Actuator",        "ata": "27", "ltype": "actuator",       "weight": 0.95, "state": "HEALTHY", "score": 0.0},
            {"id": "FCU-L",      "name": "Rudder PCU Left",              "ata": "27", "ltype": "pcu",            "weight": 0.90, "state": "HEALTHY", "score": 0.0},
            {"id": "ENG1-FADEC", "name": "Engine 1 FADEC",               "ata": "73", "ltype": "fadec",          "weight": 0.95, "state": "HEALTHY", "score": 0.0},
            {"id": "BLEED-V1",   "name": "Engine 1 Bleed Valve",         "ata": "36", "ltype": "bleed_valve",    "weight": 0.70, "state": "HEALTHY", "score": 0.0},
            {"id": "AVNX-COOL",  "name": "Avionics Cooling Unit",        "ata": "21", "ltype": "cooling",        "weight": 0.60, "state": "HEALTHY", "score": 0.0},
            {"id": "ADIRU-1",    "name": "Air Data / Inertial Unit 1",   "ata": "34", "ltype": "adiru",          "weight": 0.90, "state": "HEALTHY", "score": 0.0},
            {"id": "GEN-1",      "name": "Engine 1 Generator",           "ata": "24", "ltype": "generator",      "weight": 0.80, "state": "HEALTHY", "score": 0.0},
            {"id": "FUEL-P1",    "name": "Engine 1 Fuel Pump",           "ata": "28", "ltype": "fuel_pump",      "weight": 0.85, "state": "HEALTHY", "score": 0.0},
            {"id": "APU",        "name": "Auxiliary Power Unit",         "ata": "49", "ltype": "apu",            "weight": 0.50, "state": "HEALTHY", "score": 0.0}
        ]

        edges_data = [
            # Scenario 1: Hydraulic pump -> Aileron Actuator -> Rudder PCU Left
            {"src": "HYD-2A", "tgt": "ACT-L4", "type": "hydraulic", "weight": 0.80},
            {"src": "ACT-L4", "tgt": "FCU-L",  "type": "mechanical", "weight": 0.60},
            # Scenario 2: Bleed Valve -> Avionics Cooling -> Air Data Unit 1
            {"src": "BLEED-V1", "tgt": "AVNX-COOL", "type": "pneumatic", "weight": 0.70},
            {"src": "AVNX-COOL", "tgt": "ADIRU-1",   "type": "thermal", "weight": 0.50}
        ]

        if not self.is_fallback and self.driver:
            try:
                with self.driver.session() as session:
                    # Seed nodes
                    for node in lrus_data:
                        session.run("""
                            MERGE (n:LRU {id: $id})
                            SET n.name = $name,
                                n.ata_chapter = $ata,
                                n.lru_type = $ltype,
                                n.criticality_weight = $weight,
                                n.current_state = $state,
                                n.anomaly_score = $score,
                                n.last_updated = $ts
                        """, id=node["id"], name=node["name"], ata=node["ata"],
                             ltype=node["ltype"], weight=node["weight"],
                             state=node["state"], score=node["score"],
                             ts=datetime.utcnow().isoformat())
                    
                    # Seed edges
                    for edge in edges_data:
                        session.run("""
                            MATCH (src:LRU {id: $src})
                            MATCH (tgt:LRU {id: $tgt})
                            MERGE (src)-[r:PROPAGATES_TO]->(tgt)
                            SET r.edge_type = $type,
                                r.base_weight = $weight
                        """, src=edge["src"], tgt=edge["tgt"],
                             type=edge["type"], weight=edge["weight"])
                logger.info("Successfully seeded Neo4j graph nodes and relationships.")
            except Exception as e:
                logger.error(f"Failed to seed Neo4j: {e}. Switching to local fallback mode.")
                self.is_fallback = True
                self.driver = None

        if self.is_fallback:
            # Seed NetworkX fallback graph
            logger.info("Seeding local NetworkX fallback graph...")
            self.local_graph.clear()
            for node in lrus_data:
                self.local_graph.add_node(
                    node["id"],
                    name=node["name"],
                    ata_chapter=node["ata"],
                    lru_type=node["ltype"],
                    criticality_weight=node["weight"],
                    current_state=node["state"],
                    anomaly_score=node["score"]
                )
            for edge in edges_data:
                self.local_graph.add_edge(
                    edge["src"],
                    edge["tgt"],
                    edge_type=edge["type"],
                    base_weight=edge["weight"]
                )
            logger.info("Local NetworkX graph seeded.")

    def get_all_edges(self):
        """Retrieve all propagation edges. Returns list of dicts with keys: source, target, edge_type, base_weight."""
        if not self.is_fallback and self.driver:
            try:
                with self.driver.session() as session:
                    result = session.run("""
                        MATCH (src:LRU)-[r:PROPAGATES_TO]->(tgt:LRU)
                        RETURN src.id as source, tgt.id as target, r.edge_type as edge_type, r.base_weight as base_weight
                    """)
                    return [dict(record) for record in result]
            except Exception as e:
                logger.error(f"Neo4j query failed: {e}. Using local graph fallback.")
                self.is_fallback = True
                self.driver = None
                
        # Fallback local query
        edges = []
        for u, v, data in self.local_graph.edges(data=True):
            edges.append({
                "source": u,
                "target": v,
                "edge_type": data.get("edge_type", "unknown"),
                "base_weight": data.get("base_weight", 0.5)
            })
        return edges

    def get_node_states(self) -> dict:
        """Get all node states. Returns a dict mapping lru_code -> {current_state, anomaly_score, criticality_weight}."""
        if not self.is_fallback and self.driver:
            try:
                with self.driver.session() as session:
                    result = session.run("""
                        MATCH (n:LRU)
                        RETURN n.id as id, n.current_state as current_state, n.anomaly_score as anomaly_score, n.criticality_weight as criticality_weight
                    """)
                    return {
                        record["id"]: {
                            "current_state": record["current_state"],
                            "anomaly_score": record["anomaly_score"],
                            "criticality_weight": record["criticality_weight"]
                        }
                        for record in result
                    }
            except Exception as e:
                logger.error(f"Neo4j node state query failed: {e}. Using local graph fallback.")
                self.is_fallback = True
                self.driver = None
                
        # Fallback local query
        return {
            node: {
                "current_state": data.get("current_state", "HEALTHY"),
                "anomaly_score": data.get("anomaly_score", 0.0),
                "criticality_weight": data.get("criticality_weight", 0.5)
            }
            for node, data in self.local_graph.nodes(data=True)
        }

    def sync_node_health(self, lru_code: str, state: str, score: float):
        """Update node health properties in the graph."""
        if not self.is_fallback and self.driver:
            try:
                with self.driver.session() as session:
                    session.run("""
                        MERGE (n:LRU {id: $id})
                        SET n.current_state = $state,
                            n.anomaly_score = $score,
                            n.last_updated = $ts
                    """, id=lru_code, state=state, score=score, ts=datetime.utcnow().isoformat())
                return
            except Exception as e:
                logger.error(f"Neo4j update failed: {e}. Updating local graph fallback.")
                self.is_fallback = True
                self.driver = None
                
        # Fallback local update
        if lru_code in self.local_graph:
            self.local_graph.nodes[lru_code]["current_state"] = state
            self.local_graph.nodes[lru_code]["anomaly_score"] = score
            self.local_graph.nodes[lru_code]["last_updated"] = datetime.utcnow().isoformat()

# Instantiate single client instance
neo4j_client = Neo4jClient()
