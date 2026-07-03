import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import DependencyGraph from '../components/DependencyGraph';
import { Settings, Plane, RotateCcw } from 'lucide-react';

export const GraphView = () => {
  const [aircraftList, setAircraftList] = useState([]);
  const [selectedAcId, setSelectedAcId] = useState(null);
  const [nodeStates, setNodeStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadFleet = async () => {
      try {
        setLoading(true);
        const list = await api.listAircraft();
        setAircraftList(list);
        if (list.length > 0) {
          setSelectedAcId(list[0].aircraft_id);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching fleet list for schematic', err);
        setError('Failed to fetch registered aircraft list.');
        setLoading(false);
      }
    };
    loadFleet();
  }, []);

  useEffect(() => {
    if (!selectedAcId) return;

    const loadAircraftLrus = async () => {
      try {
        const lruList = await api.listAircraftLrus(selectedAcId);
        
        // Map list to code states dictionary
        const statesDict = {};
        lruList.forEach(l => {
          statesDict[l.lru_code] = {
            current_state: l.current_state,
            anomaly_score: l.anomaly_score,
            criticality_weight: l.criticality_weight
          };
        });
        
        setNodeStates(statesDict);
      } catch (err) {
        console.error(`Error loading LRU states for aircraft ${selectedAcId}`, err);
      }
    };

    loadAircraftLrus();
  }, [selectedAcId]);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>LOADING STATIC AND DYNAMIC TOPOLOGY REGISTRY...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card fade-in" style={{ margin: '40px auto', maxWidth: '600px', borderLeft: '4px solid var(--color-failed)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    );
  }

  const highlightNodesList = Object.keys(nodeStates).filter(
    code => nodeStates[code]?.anomaly_score > 0.15
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Aircraft System Schematic Viewer</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Interactive dependency map linking mechanical, hydraulic, pneumatic, and thermal interfaces.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Plane size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Inspect Fleet Ref:</span>
          <select 
            className="form-select" 
            style={{ width: '160px', padding: '8px 12px' }}
            value={selectedAcId || ''} 
            onChange={(e) => setSelectedAcId(parseInt(e.target.value, 10))}
          >
            {aircraftList.map(ac => (
              <option key={ac.aircraft_id} value={ac.aircraft_id}>{ac.tail_number} ({ac.aircraft_type})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
            Selected Twin Schematic Map
          </h4>
          {highlightNodesList.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-critical)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <span className="status-dot loading" style={{ width: '6px', height: '6px' }} />
              {highlightNodesList.length} Active Anomaly Warning Indicators
            </span>
          )}
        </div>
        
        <DependencyGraph 
          highlightNodes={highlightNodesList}
          nodeStates={nodeStates}
        />
      </div>

      <div className="card">
        <h4 className="card-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={14} /> Topological Connectivity Rules
        </h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          This schematic shows physical interfaces where anomalies propagate. Edges are weighted based on empirical safety limits and propagation risks. 
          When an anomaly score exceeds **0.30** (DEGRADED), the unit begins to impact linked components downstream. An anomaly score exceeding **0.90** implies a total system unit fault, likely grounding the aircraft.
        </p>
      </div>
    </div>
  );
};

export default GraphView;
