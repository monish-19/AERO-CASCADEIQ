import React from 'react';
import RiskBadge from './RiskBadge';

export const PropagationTimeline = ({ nodes = [], edges = [] }) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
        Configure and run a simulation above to view the propagation cascade timeline.
      </div>
    );
  }

  return (
    <div className="timeline-list">
      {nodes.map((node, index) => {
        // Find incoming edge to show propagation detail
        const incomingEdge = edges.find(e => e.target === node.lru_code);
        
        let connectorText = '';
        if (incomingEdge) {
          connectorText = `propagated via ${incomingEdge.edge_type.toUpperCase()} link (wt: ${incomingEdge.base_weight.toFixed(2)})`;
        } else {
          connectorText = 'ROOT CAUSE TRIGGER';
        }

        const isRoot = node.depth === 0;

        return (
          <div key={node.lru_code} className="timeline-item fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
            {/* Custom Dot reflecting status */}
            <div 
              className={`timeline-dot ${node.state === 'FAILED' ? 'pulse-glow-failed' : node.state === 'CRITICAL' ? 'pulse-glow-critical' : ''}`}
              style={{
                backgroundColor: 
                  node.state === 'FAILED' ? 'var(--color-failed)' : 
                  node.state === 'CRITICAL' ? 'var(--color-critical)' : 
                  node.state === 'DEGRADED' ? 'var(--color-degraded)' : 
                  'var(--color-healthy)',
                width: '14px',
                height: '14px',
                left: '-26px',
                top: '4px',
                borderRadius: '50%',
                position: 'absolute',
                border: '2.5px solid var(--bg-surface)'
              }}
            />

            <div style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              border: `1px solid ${isRoot ? 'rgba(0, 210, 255, 0.25)' : 'var(--border-color)'}`,
              borderRadius: '8px',
              padding: '16px',
              marginLeft: '10px',
              marginBottom: '12px',
              boxShadow: isRoot ? '0 0 15px rgba(0, 210, 255, 0.05)' : 'none'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.05rem', color: isRoot ? 'var(--border-focus)' : 'var(--text-primary)' }}>
                    {node.lru_code}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    T+{node.depth} DEPTH
                  </span>
                  <RiskBadge state={node.state} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Score: </span>
                    <span style={{ color: 'var(--border-focus)', fontWeight: 600 }}>{node.anomaly_score.toFixed(4)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Probability: </span>
                    <span style={{ color: 'var(--color-degraded)', fontWeight: 600 }}>{(node.probability * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{connectorText}</span>
                {node.path && node.path.length > 1 && (
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Path: {node.path.join(' → ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PropagationTimeline;
