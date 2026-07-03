import React, { useState } from 'react';

const NODE_POSITIONS = {
  'HYD-2A': { x: 150, y: 100, label: 'HYD-2A', name: 'Hydraulic Pump 2A', system: 'Hydraulics' },
  'ACT-L4': { x: 400, y: 100, label: 'ACT-L4', name: 'Left Aileron Actuator', system: 'Flight Controls' },
  'FCU-L': { x: 650, y: 100, label: 'FCU-L', name: 'Rudder PCU Left', system: 'Flight Controls' },
  
  'BLEED-V1': { x: 150, y: 230, label: 'BLEED-V1', name: 'Engine 1 Bleed Valve', system: 'Pneumatics' },
  'AVNX-COOL': { x: 400, y: 230, label: 'AVNX-COOL', name: 'Avionics Cooling Unit', system: 'Avionics' },
  'ADIRU-1': { x: 650, y: 230, label: 'ADIRU-1', name: 'Air Data / Inertial Unit 1', system: 'Navigation' },
  
  'ENG1-FADEC': { x: 150, y: 380, label: 'ENG1-FADEC', name: 'Engine 1 FADEC', system: 'Powerplant' },
  'GEN-1': { x: 310, y: 380, label: 'GEN-1', name: 'Engine 1 Generator', system: 'Electrical' },
  'FUEL-P1': { x: 490, y: 380, label: 'FUEL-P1', name: 'Engine 1 Fuel Pump', system: 'Fuel' },
  'APU': { x: 660, y: 380, label: 'APU', name: 'Auxiliary Power Unit', system: 'Powerplant' }
};

const EDGE_COLORS = {
  hydraulic: '#2f80ed',
  mechanical: '#828282',
  pneumatic: '#00d2ff',
  thermal: '#ff9100',
  default: '#56ccf2'
};

export const DependencyGraph = ({ highlightNodes = [], nodeStates = {}, simulatedEdges = [] }) => {
  const [selectedNode, setSelectedNode] = useState(null);

  // Static edges defining aircraft system topology
  const staticEdges = [
    { source: 'HYD-2A', target: 'ACT-L4', type: 'hydraulic', base_weight: 0.80 },
    { source: 'ACT-L4', target: 'FCU-L', type: 'mechanical', base_weight: 0.60 },
    { source: 'BLEED-V1', target: 'AVNX-COOL', type: 'pneumatic', base_weight: 0.70 },
    { source: 'AVNX-COOL', target: 'ADIRU-1', type: 'thermal', base_weight: 0.50 }
  ];

  const handleNodeClick = (code) => {
    const staticInfo = NODE_POSITIONS[code];
    const dynamicInfo = nodeStates[code] || { current_state: 'HEALTHY', anomaly_score: 0.0, criticality_weight: 0.5 };
    setSelectedNode({
      code,
      ...staticInfo,
      ...dynamicInfo
    });
  };

  const getHealthColor = (state, score) => {
    const s = (state || 'HEALTHY').toUpperCase();
    if (s === 'FAILED' || score >= 0.90) return 'var(--color-failed)';
    if (s === 'CRITICAL' || score >= 0.65) return 'var(--color-critical)';
    if (s === 'DEGRADED' || score >= 0.30) return 'var(--color-degraded)';
    return 'var(--color-healthy)';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '3fr 1fr' : '1fr', gap: '20px', width: '100%' }}>
      {/* SVG Canvas Card */}
      <div className="card" style={{ padding: '16px', backgroundColor: '#070a13', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
            System Schematic & Propagation Paths
          </h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Click nodes to inspect physical dependencies
          </span>
        </div>

        <div style={{ position: 'relative', width: '100%', height: '460px' }}>
          <svg viewBox="0 0 800 460" width="100%" height="100%" style={{ background: '#0b0f19', borderRadius: '8px' }}>
            <defs>
              <filter id="glow-healthy-svg" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="var(--color-healthy)" floodOpacity="0.4"/>
              </filter>
              <filter id="glow-degraded-svg" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="var(--color-degraded)" floodOpacity="0.5"/>
              </filter>
              <filter id="glow-critical-svg" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="var(--color-critical)" floodOpacity="0.6"/>
              </filter>
              <filter id="glow-failed-svg" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="var(--color-failed)" floodOpacity="0.7"/>
              </filter>
              
              {/* Arrow definitions for links */}
              {Object.keys(EDGE_COLORS).map(key => (
                <marker
                  key={key}
                  id={`arrow-${key}`}
                  viewBox="0 0 10 10"
                  refX="22"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLORS[key]} />
                </marker>
              ))}
            </defs>

            {/* Drawing Connections */}
            {staticEdges.map((edge, index) => {
              const from = NODE_POSITIONS[edge.source];
              const to = NODE_POSITIONS[edge.target];
              if (!from || !to) return null;

              // Check if this connection is active in the simulation cascade
              const isSimulated = simulatedEdges.some(
                se => se.source === edge.source && se.target === edge.target
              );

              const edgeColor = EDGE_COLORS[edge.type] || EDGE_COLORS.default;

              return (
                <g key={`edge-${index}`}>
                  {/* Outer glowing path if simulated active */}
                  {isSimulated && (
                    <path
                      d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                      stroke={edgeColor}
                      strokeWidth="5"
                      strokeOpacity="0.3"
                      fill="none"
                    />
                  )}
                  {/* Core Line */}
                  <path
                    d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                    stroke={edgeColor}
                    strokeWidth={isSimulated ? 2.5 : 1.5}
                    strokeOpacity={isSimulated ? 0.9 : 0.4}
                    fill="none"
                    markerEnd={`url(#arrow-${edge.type})`}
                    strokeDasharray={isSimulated ? '5, 5' : 'none'}
                  >
                    {isSimulated && (
                      <animate
                        attributeName="stroke-dashoffset"
                        values="50;0"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    )}
                  </path>
                  {/* Weight Badge text */}
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 8}
                    fill="var(--text-muted)"
                    fontSize="9px"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {edge.type} ({edge.base_weight.toFixed(2)})
                  </text>
                </g>
              );
            })}

            {/* Drawing Nodes */}
            {Object.keys(NODE_POSITIONS).map((code) => {
              const node = NODE_POSITIONS[code];
              const dynamic = nodeStates[code] || { current_state: 'HEALTHY', anomaly_score: 0.0 };
              
              const isHighlighted = highlightNodes.includes(code);
              const nodeColor = getHealthColor(dynamic.current_state, dynamic.anomaly_score);
              
              // Glow filter based on health state
              let glowFilter = '';
              const stateUpper = (dynamic.current_state || '').toUpperCase();
              if (stateUpper === 'FAILED') glowFilter = 'url(#glow-failed-svg)';
              else if (stateUpper === 'CRITICAL') glowFilter = 'url(#glow-critical-svg)';
              else if (stateUpper === 'DEGRADED') glowFilter = 'url(#glow-degraded-svg)';
              else if (isHighlighted) glowFilter = 'url(#glow-healthy-svg)';

              return (
                <g
                  key={code}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => handleNodeClick(code)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Outer Ring glow */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isHighlighted ? 22 : 18}
                    fill="none"
                    stroke={nodeColor}
                    strokeWidth={isHighlighted ? 3 : 1.5}
                    strokeOpacity={isHighlighted ? 1.0 : 0.3}
                    filter={glowFilter}
                  />

                  {/* Node fill */}
                  <circle
                    cx="0"
                    cy="0"
                    r="15"
                    fill="var(--bg-surface-elevated)"
                    stroke={selectedNode?.code === code ? 'var(--border-focus)' : 'var(--border-color)'}
                    strokeWidth="2"
                  />

                  {/* Small internal dot reflecting health */}
                  <circle
                    cx="0"
                    cy="0"
                    r="5"
                    fill={nodeColor}
                  />

                  {/* Text Label */}
                  <text
                    x="0"
                    y="32"
                    fill={isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)'}
                    fontSize="10px"
                    fontWeight={isHighlighted ? 700 : 500}
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Simple Legend inside graph */}
          <div className="graph-legend">
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: EDGE_COLORS.hydraulic }}></span>
              <span>Hydraulic Propagation</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: EDGE_COLORS.pneumatic }}></span>
              <span>Pneumatic Flow</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: EDGE_COLORS.thermal }}></span>
              <span>Thermal Exchange</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: EDGE_COLORS.mechanical }}></span>
              <span>Mechanical Connect</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inspector Panel side-drawer */}
      {selectedNode && (
        <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '3px solid var(--border-focus)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>{selectedNode.code}</h3>
              <button 
                onClick={() => setSelectedNode(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>COMPONENT NAME</span>
                <span style={{ fontWeight: 600 }}>{selectedNode.name}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>SUBSYSTEM</span>
                <span style={{ fontWeight: 600 }}>{selectedNode.system}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>ATA CHAPTER</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>CH-{selectedNode.ata_chapter || '00'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>HEALTH STATE</span>
                <span 
                  style={{ 
                    fontWeight: 700, 
                    color: getHealthColor(selectedNode.current_state, selectedNode.anomaly_score) 
                  }}
                >
                  {selectedNode.current_state}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>ANOMALY SCORE</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--border-focus)' }}>
                  {selectedNode.anomaly_score.toFixed(4)}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>CRITICALITY WEIGHT</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {selectedNode.criticality_weight.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '4px' }}>TELEMETRY STATUS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                className="status-dot" 
                style={{ 
                  backgroundColor: getHealthColor(selectedNode.current_state, selectedNode.anomaly_score),
                  boxShadow: `0 0 8px ${getHealthColor(selectedNode.current_state, selectedNode.anomaly_score)}`
                }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {selectedNode.anomaly_score > 0.3 ? 'Anomaly Detected' : 'Operational Nominally'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DependencyGraph;
