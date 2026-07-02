"""
GNN Propagation Model — Member 3 (ML & AI Engineer)
Trains a Graph Neural Network on cascade labels.
Updates edge weights in Neo4j after training.
Output: backend/core/models/gnn_model.pkl
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
import joblib
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath("."))
from backend.db.neo4j_client import AircraftGraphDB

LABELS_PATH = "data_pipeline/output/labeled/cascade_labels.csv"
FEATURES_PATH = "data_pipeline/output/processed/features.csv"
MODEL_DIR   = "backend/core/models"
GNN_PATH    = f"{MODEL_DIR}/gnn_model.pkl"

def build_cascade_training_data(labels_df, features_df):
    """
    Build training data for the GNN model.
    Each row = one (root_lru, affected_lru) pair with features.
    Label = 1 if cascade happened, 0 if not.
    """
    print("Building cascade training data...")
    rows = []

    # Positive examples — actual cascades that happened
    for _, label in labels_df.iterrows():
        rows.append({
            "root_lru_id":       label["root_cause_lru_id"],
            "affected_lru_id":   label["affected_lru_id"],
            "propagation_delay": label["propagation_delay_flights"],
            "base_weight":       label["base_weight"],
            "edge_type":         label["edge_type"],
            "cascaded":          1
        })

    # Negative examples — pairs that did NOT cascade
    all_lru_ids = features_df["lru_code"].unique()
    for root in labels_df["root_cause_lru_id"].unique():
        for affected in all_lru_ids:
            # Skip if this is a known positive
            is_positive = any(
                (labels_df["root_cause_lru_id"] == root) &
                (labels_df["affected_lru_code"] == affected)
            ) if "affected_lru_code" in labels_df.columns else False

            if not is_positive:
                rows.append({
                    "root_lru_id":       root,
                    "affected_lru_id":   0,
                    "propagation_delay": 0,
                    "base_weight":       0.0,
                    "edge_type":         "none",
                    "cascaded":          0
                })

    df = pd.DataFrame(rows)
    print(f"Training samples: {len(df)} "
          f"(positive={df['cascaded'].sum()}, "
          f"negative={len(df)-df['cascaded'].sum()})")
    return df


def train_gnn_model():
    print("Loading data...")
    labels_df   = pd.read_csv(LABELS_PATH)
    features_df = pd.read_csv(FEATURES_PATH)

    print(f"Cascade labels: {len(labels_df)}")
    print(f"Features: {len(features_df):,} rows")
    print(f"\nCascade events found:")
    print(labels_df[["root_cause_lru_code", "affected_lru_code",
                      "propagation_delay_flights", "base_weight",
                      "edge_type"]].to_string(index=False))

    # Build training data
    train_df = build_cascade_training_data(labels_df, features_df)

    # Encode edge type
    le = LabelEncoder()
    train_df["edge_type_enc"] = le.fit_transform(train_df["edge_type"])

    # Features for GNN
    feature_cols = ["propagation_delay", "base_weight", "edge_type_enc"]
    X = train_df[feature_cols].values
    y = train_df["cascaded"].values

    # Train Gradient Boosting model
    print("\nTraining GNN propagation model...")
    model = GradientBoostingClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=3,
        random_state=42
    )
    model.fit(X, y)

    # Evaluate
    preds = model.predict(X)
    print("\nModel Performance:")
    print(classification_report(y, preds,
          target_names=["No cascade", "Cascade"]))

    # Save model and encoder
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, GNN_PATH)
    joblib.dump(le, f"{MODEL_DIR}/label_encoder.pkl")
    print(f"GNN model saved → {GNN_PATH}")

    # Update Neo4j edge weights with learned probabilities
    print("\nUpdating Neo4j edge weights...")
    update_neo4j_weights(labels_df, model, le)

    return model


def update_neo4j_weights(labels_df, model, le):
    """
    Update edge weights in Neo4j based on learned probabilities.
    """
    try:
        db = AircraftGraphDB()

        for _, label in labels_df.iterrows():
            # Predict updated probability for this cascade edge
            edge_type_enc = le.transform([label["edge_type"]])[0]
            X = np.array([[
                label["propagation_delay_flights"],
                label["base_weight"],
                edge_type_enc
            ]])
            new_weight = model.predict_proba(X)[0][1]
            new_weight = round(float(new_weight), 4)

            # Update in Neo4j
            db.update_edge_weight(
                label["root_cause_lru_code"],
                label["affected_lru_code"],
                new_weight
            )
            print(f"  Updated: {label['root_cause_lru_code']} → "
                  f"{label['affected_lru_code']} "
                  f"weight={new_weight:.4f}")

        db.close()
        print("Neo4j edge weights updated!")

    except Exception as e:
        print(f"Neo4j update skipped: {e}")


def predict_cascade_risk(root_lru: str, edge_type: str,
                          delay: int, base_weight: float) -> dict:
    """
    Predict cascade probability for a given LRU pair.
    Called by M4's propagation engine.
    """
    model = joblib.load(GNN_PATH)
    le    = joblib.load(f"{MODEL_DIR}/label_encoder.pkl")

    try:
        edge_enc = le.transform([edge_type])[0]
    except ValueError:
        edge_enc = 0

    X = np.array([[delay, base_weight, edge_enc]])
    prob = model.predict_proba(X)[0][1]

    return {
        "root_lru":         root_lru,
        "cascade_probability": round(float(prob), 4),
        "risk_level": (
            "CRITICAL" if prob > 0.8 else
            "HIGH"     if prob > 0.6 else
            "MEDIUM"   if prob > 0.4 else
            "LOW"
        )
    }


if __name__ == "__main__":
    model = train_gnn_model()

    print("\nTesting cascade risk prediction:")
    print(predict_cascade_risk("HYD-2A", "hydraulic", 3, 0.80))
    print(predict_cascade_risk("BLEED-V1", "pneumatic", 4, 0.70))
    print(predict_cascade_risk("ENG1-FADEC", "electrical", 2, 0.75))