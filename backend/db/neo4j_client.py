"""
Neo4j Client — Member 4 (Backend & API Engineer)
Graph database client. Graph schema owned by M2.
Used by propagation_engine.py to traverse the dependency graph.
"""
# TODO (M4): Neo4j driver setup and graph query helpers
"""
Neo4j Graph Query Layer — Member 2 (Graph & Knowledge Engineer)
Provides graph traversal functions for M4's propagation engine.
"""

from neo4j import GraphDatabase
import os

NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")


class AircraftGraphDB:
    def __init__(self):
        self.driver = GraphDatabase.driver(
            NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD)
        )

    def close(self):
        self.driver.close()

    def get_all_lrus(self):
        """Get all LRU nodes in the graph."""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (n:LRU)
                RETURN n.id AS id, n.name AS name,
                       n.ata_chapter AS ata_chapter,
                       n.criticality AS criticality,
                       n.current_state AS current_state,
                       n.anomaly_score AS anomaly_score
                ORDER BY n.criticality DESC
            """)
            return [dict(r) for r in result]

    def get_downstream_neighbors(self, lru_id: str):
        """
        Get all LRUs directly affected by the given LRU.
        Used by M4's propagation engine for cascade simulation.
        """
        with self.driver.session() as session:
            result = session.run("""
                MATCH (a:LRU {id: $lru_id})-[r:AFFECTS]->(b:LRU)
                RETURN b.id AS affected_id,
                       b.name AS affected_name,
                       b.criticality AS criticality,
                       r.edge_type AS edge_type,
                       r.weight AS weight,
                       r.delay_flights AS delay_flights,
                       r.description AS description
                ORDER BY r.weight DESC
            """, lru_id=lru_id)
            return [dict(r) for r in result]

    def get_full_cascade_path(self, root_lru_id: str, max_depth: int = 5):
        """
        Traverse the full cascade chain from a root LRU.
        Returns all downstream LRUs up to max_depth hops away.
        Used by M4 to simulate the full failure propagation.
        """
        with self.driver.session() as session:
            result = session.run("""
                MATCH path = (root:LRU {id: $root_id})-[:AFFECTS*1..5]->(affected:LRU)
                WITH path, affected,
                     [r in relationships(path) | r.weight] AS weights,
                     [r in relationships(path) | r.delay_flights] AS delays,
                     [r in relationships(path) | r.edge_type] AS edge_types,
                     length(path) AS depth
                RETURN affected.id AS affected_id,
                       affected.name AS affected_name,
                       affected.criticality AS criticality,
                       affected.current_state AS current_state,
                       depth,
                       weights,
                       delays,
                       edge_types,
                       reduce(p = 1.0, w IN weights | p * w) AS cascade_probability,
                       reduce(d = 0, delay IN delays | d + delay) AS total_delay_flights
                ORDER BY cascade_probability DESC
            """, root_id=root_lru_id)
            return [dict(r) for r in result]

    def get_high_risk_lrus(self, threshold: float = 0.3):
        """
        Get all LRUs with anomaly score above threshold.
        Called by M4 to find what needs immediate attention.
        """
        with self.driver.session() as session:
            result = session.run("""
                MATCH (n:LRU)
                WHERE n.anomaly_score >= $threshold
                RETURN n.id AS id, n.name AS name,
                       n.current_state AS current_state,
                       n.anomaly_score AS anomaly_score,
                       n.criticality AS criticality
                ORDER BY n.anomaly_score DESC
            """, threshold=threshold)
            return [dict(r) for r in result]

    def update_lru_state(self, lru_id: str, state: str, anomaly_score: float):
        """
        Update LRU health state in the graph.
        Called by M1's twin_sync after each flight.
        """
        with self.driver.session() as session:
            session.run("""
                MATCH (n:LRU {id: $lru_id})
                SET n.current_state = $state,
                    n.anomaly_score = $anomaly_score
            """, lru_id=lru_id, state=state, anomaly_score=anomaly_score)

    def update_edge_weight(self, from_lru: str, to_lru: str, new_weight: float):
        """
        Update edge weight after M3's GNN model learns better probabilities.
        Called by M3's model serving layer.
        """
        with self.driver.session() as session:
            session.run("""
                MATCH (a:LRU {id: $from_id})-[r:AFFECTS]->(b:LRU {id: $to_id})
                SET r.weight = $new_weight
            """, from_id=from_lru, to_id=to_lru, new_weight=new_weight)


if __name__ == "__main__":
    db = AircraftGraphDB()

    print("All LRUs:")
    for lru in db.get_all_lrus():
        print(f"  {lru['id']}: {lru['current_state']} (criticality={lru['criticality']})")

    print("\nCascade path from HYD-2A:")
    for path in db.get_full_cascade_path("HYD-2A"):
        print(f"  → {path['affected_id']} "
              f"(prob={path['cascade_probability']:.2f}, "
              f"delay={path['total_delay_flights']} flights)")

    print("\nCascade path from BLEED-V1:")
    for path in db.get_full_cascade_path("BLEED-V1"):
        print(f"  → {path['affected_id']} "
              f"(prob={path['cascade_probability']:.2f}, "
              f"delay={path['total_delay_flights']} flights)")

    db.close()
    print("\nGraph query layer working correctly!")
    