import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import DependencyGraph from '../components/DependencyGraph';
import PropagationTimeline from '../components/PropagationTimeline';
import { Play, RotateCcw, ShieldAlert, Cpu, Zap, ChevronRight } from 'lucide-react';

const SYSTEM_LRUS = [
  { code: 'HYD-2A',      name: 'Hydraulic Pump 2A' },
  { code: 'ACT-L4',      name: 'Left Aileron Actuator' },
  { code: 'FCU-L',       name: 'Rudder PCU Left' },
  { code: 'ENG1-FADEC',  name: 'Engine 1 FADEC' },
  { code: 'BLEED-V1',    name: 'Engine 1 Bleed Valve' },
  { code: 'AVNX-COOL',   name: 'Avionics Cooling Unit' },
  { code: 'ADIRU-1',     name: 'Air Data / Inertial Unit 1' },
  { code: 'GEN-1',       name: 'Engine 1 Generator' },
  { code: 'FUEL-P1',     name: 'Engine 1 Fuel Pump' },
  { code: 'APU',         name: 'Auxiliary Power Unit' },
];

/* Severity color ramp 0.0 → 1.0 */
function sevColor(v) {
  if (v < 0.35) return 'var(--color-healthy)';
  if (v < 0.6)  return 'var(--color-degraded)';
  if (v < 0.85) return 'var(--color-critical)';
  return 'var(--color-failed)';
}

/* Severity label */
function sevLabel(v) {
  if (v < 0.35) return 'LOW';
  if (v < 0.6)  return 'MODERATE';
  if (v < 0.85) return 'HIGH';
  return 'CRITICAL';
}

export const FailureSimulation = () => {
  const [searchParams]   = useSearchParams();
  const [lruCode, setLruCode]   = useState('HYD-2A');
  const [severity, setSeverity] = useState(0.8);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    const p = searchParams.get('lru');
    const s = searchParams.get('severity');
    if (p && SYSTEM_LRUS.some(l => l.code === p)) setLruCode(p);
    if (s) { const n = parseFloat(s); if (!isNaN(n) && n >= 0 && n <= 1) setSeverity(n); }
  }, [searchParams]);

  const handleRun = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const result = await api.predictFailure(lruCode, severity);
      setSimResult(result);
    } catch {
      setError('Failed to compute failure propagation. Ensure the backend cognitive engine is online.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => { setSimResult(null); setLruCode('HYD-2A'); setSeverity(0.8); setError(null); };

  const graphNodeStates = {};
  const highlightNodesList = [];
  if (simResult) {
    simResult.nodes.forEach(n => {
      graphNodeStates[n.lru_code] = { current_state: n.state, anomaly_score: n.anomaly_score, criticality_weight: 0.8 };
      highlightNodesList.push(n.lru_code);
    });
  }

  const hasFailed = simResult?.nodes.some(n => n.state === 'FAILED');
  const color = sevColor(severity);

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.3px' }}>AI Cascade Propagation Simulator</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
          Simulate fault propagation cascades and evaluate failure probability indexes across LRU dependency graph.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, marginBottom: 28, alignItems: 'start' }}>

        {/* ── Control panel ── */}
        <div className="card" style={{ borderTop: `2px solid ${color}` }}>
          <h3 className="card-title" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={15} /> Simulator Inputs
          </h3>

          <form onSubmit={handleRun}>
            <div className="form-group">
              <label className="form-label">Seed Root Cause Node</label>
              <select className="form-select" value={lruCode} onChange={e => setLruCode(e.target.value)} disabled={loading}>
                {SYSTEM_LRUS.map(l => (
                  <option key={l.code} value={l.code}>{l.code} — {l.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label className="form-label" style={{ margin: 0 }}>Initial Severity Score</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700,
                    padding: '2px 8px', borderRadius: 4,
                    background: `${color}18`, border: `1px solid ${color}44`, color,
                  }}>
                    {sevLabel(severity)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 800, color }}>
                    {severity.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Gradient track range */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', top: '50%', left: 0, right: 0,
                  height: 5, borderRadius: 3,
                  background: `linear-gradient(90deg, var(--color-healthy) 0%, var(--color-degraded) 40%, var(--color-critical) 70%, var(--color-failed) 100%)`,
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none', opacity: 0.3,
                }} />
                <input
                  type="range" min="0.05" max="1.0" step="0.05" value={severity}
                  onChange={e => setSeverity(parseFloat(e.target.value))}
                  disabled={loading}
                  style={{ position: 'relative', zIndex: 1, accentColor: color }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 6 }}>
                <span>0.05 Negligible</span><span>1.00 Total Failure</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Running...</>
                  : <><Play size={14} fill="currentColor" /> Execute Cascade</>
                }
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={loading || !simResult} style={{ padding: '9px 13px' }}>
                <RotateCcw size={15} />
              </button>
            </div>
          </form>

          {error && (
            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255,23,68,0.2)', background: 'rgba(255,23,68,0.05)', color: 'var(--color-failed)', fontSize: '0.78rem', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Impact overview ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ borderTop: simResult ? `2px solid ${hasFailed ? 'var(--color-failed)' : 'var(--color-critical)'}` : '2px solid var(--border-color)' }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Impact Assessment Overview</h3>

            {simResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Root Cause', value: simResult.root_cause_lru, color: 'var(--color-failed)' },
                    { label: 'Nodes Impacted', value: `${simResult.nodes.length} / 10`, color: hasFailed ? 'var(--color-failed)' : 'var(--color-critical)' },
                    { label: 'Cascade Depth', value: `Level ${Math.max(...simResult.nodes.map(n => n.depth))}`, color: 'var(--border-focus)' },
                  ].map(({ label, value, color: c }) => (
                    <div key={label} style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: c }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Impacted nodes list */}
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
                    Propagation Sequence
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {simResult.nodes.slice(0, 6).map((node, i) => (
                      <div key={node.lru_code} className="impact-row" style={{ animationDelay: `${i * 60}ms` }}>
                        <ChevronRight size={13} color="var(--color-failed)" />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {node.lru_code}
                        </span>
                        <span className={`badge badge-${node.state === 'FAILED' ? 'failed' : node.state === 'CRITICAL' ? 'critical' : 'degraded'}`} style={{ marginLeft: 4 }}>
                          {node.state}
                        </span>
                        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          depth {node.depth} · {node.anomaly_score?.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <Zap size={28} color="var(--text-muted)" style={{ opacity: 0.4 }} />
                <p>Configure inputs and execute the simulation to view impact statistics.</p>
              </div>
            )}
          </div>

          {/* Critical fault banner */}
          {hasFailed && (
            <div style={{
              padding: '14px 18px',
              borderRadius: 10,
              border: '1px solid rgba(255,23,68,0.3)',
              background: 'rgba(255,23,68,0.06)',
              display: 'flex', alignItems: 'center', gap: 14,
              animation: 'pulse-failed 2s ease-in-out infinite',
            }}>
              <ShieldAlert size={22} color="var(--color-failed)" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-failed)', marginBottom: 3, letterSpacing: '0.5px' }}>
                  CRITICAL FAULT DETECTED
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Simulated cascade triggers downstream FAILED states. Proactive LRU replacement is advised.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dependency graph ── */}
      <div style={{ marginBottom: 28 }}>
        <DependencyGraph
          highlightNodes={highlightNodesList}
          nodeStates={graphNodeStates}
          simulatedEdges={simResult ? simResult.edges : []}
        />
      </div>

      {/* ── Propagation timeline ── */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 20 }}>Cascading Impact Timeline</h3>
        <PropagationTimeline nodes={simResult ? simResult.nodes : []} edges={simResult ? simResult.edges : []} />
      </div>
    </div>
  );
};

export default FailureSimulation;
