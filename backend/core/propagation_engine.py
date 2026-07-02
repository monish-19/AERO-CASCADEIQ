"""
Failure Propagation Engine — Member 4 (Backend & API Engineer)
Core logic: given an anomalous LRU, simulate cascade through Neo4j graph.
Called by: POST /api/v1/predict-failure
"""
import networkx as nx
import logging
from collections import deque
from backend.db.neo4j_client import neo4j_client

# Configure logger
logger = logging.getLogger("propagation_engine")
logging.basicConfig(level=logging.INFO)

def score_to_state(score: float) -> str:
    """Map anomaly score to health state matching twin_sync state thresholds."""
    if score < 0.30:  return "HEALTHY"
    if score < 0.65:  return "DEGRADED"
    if score < 0.90:  return "CRITICAL"
    return "FAILED"

def simulate_propagation(root_lru_code: str, initial_severity: float) -> dict:
    """
    Simulates the cascading failures starting from a root cause LRU.
    
    Args:
        root_lru_code: The code of the anomalous LRU triggering the cascade.
        initial_severity: The starting anomaly score (severity) of the root LRU (0.0 to 1.0).
        
    Returns:
        A dictionary with two keys:
          - "nodes": list of dicts describing each affected LRU.
          - "edges": list of dicts describing the traversal edges.
    """
    logger.info(f"Simulating failure propagation from root={root_lru_code} with severity={initial_severity}")
    
    # 1. Fetch graph structure from Neo4j client
    edges_data = neo4j_client.get_all_edges()
    
    # 2. Build local NetworkX graph
    g = nx.DiGraph()
    for edge in edges_data:
        g.add_edge(
            edge["source"],
            edge["target"],
            edge_type=edge["edge_type"],
            base_weight=edge["base_weight"]
        )
    
    # Check if the root node actually exists in our graph or database.
    # If not in edges, add it as a standalone node so the root itself can be returned.
    if root_lru_code not in g:
        g.add_node(root_lru_code)

    # 3. Deterministic path traversal to compute cascade impact
    # To handle potential cycles or multiple paths, we track max score/prob per node
    node_impacts = {}
    node_impacts[root_lru_code] = {
        "lru_code": root_lru_code,
        "anomaly_score": round(initial_severity, 4),
        "state": score_to_state(initial_severity),
        "depth": 0,
        "path": [root_lru_code],
        "probability": 1.0
    }
    
    queue = deque([root_lru_code])
    traversed_edges = []
    
    while queue:
        curr = queue.popleft()
        curr_score = node_impacts[curr]["anomaly_score"]
        curr_depth = node_impacts[curr]["depth"]
        curr_path = node_impacts[curr]["path"]
        curr_prob = node_impacts[curr]["probability"]
        
        # Traverse outgoing edges
        if curr in g:
            for neighbor in g.successors(curr):
                edge_data = g[curr][neighbor]
                base_weight = edge_data.get("base_weight", 0.5)
                edge_type = edge_data.get("edge_type", "unknown")
                
                # Calculate propagated score
                neighbor_score = round(curr_score * base_weight, 4)
                
                # We only propagate if the score is above a minimal threshold (e.g. 0.05)
                # to avoid infinite propagation of negligible noise
                if neighbor_score < 0.05:
                    continue
                    
                # Update if we find a higher score path
                is_update = False
                if neighbor not in node_impacts:
                    is_update = True
                elif neighbor_score > node_impacts[neighbor]["anomaly_score"]:
                    is_update = True
                    
                if is_update:
                    node_impacts[neighbor] = {
                        "lru_code": neighbor,
                        "anomaly_score": neighbor_score,
                        "state": score_to_state(neighbor_score),
                        "depth": curr_depth + 1,
                        "path": curr_path + [neighbor],
                        "probability": round(curr_prob * base_weight, 4)
                    }
                    queue.append(neighbor)
                    
                    # Record this edge as part of the cascade
                    # Remove previous edge for this target if we updated it to a better path
                    traversed_edges = [e for e in traversed_edges if e["target"] != neighbor]
                    traversed_edges.append({
                        "source": curr,
                        "target": neighbor,
                        "edge_type": edge_type,
                        "base_weight": base_weight,
                        "propagated_severity": neighbor_score
                    })
                    
    # Format and return results
    # Sort nodes by depth then code
    sorted_nodes = sorted(node_impacts.values(), key=lambda x: (x["depth"], x["lru_code"]))
    
    return {
        "nodes": sorted_nodes,
        "edges": traversed_edges
    }
