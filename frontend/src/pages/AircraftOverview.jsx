import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import RiskBadge from '../components/RiskBadge';
import { ArrowLeft, Cpu, Activity, Wrench, Settings, Play } from 'lucide-react';

export const AircraftOverview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState(null);
  const [lrus, setLrus] = useState([]);
  const [risk, setRisk] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAircraftData = async () => {
      try {
        setLoading(true);
        const acId = parseInt(id, 10);
        
        // Load fleet list to find this specific aircraft
        const fleet = await api.listAircraft();
        const currentAc = fleet.find(a => a.aircraft_id === acId);
        
        if (!currentAc) {
          setError(`Aircraft with ID ${id} not found in registered fleet.`);
          setLoading(false);
          return;
        }
        
        // Fetch twin dynamic details
        const [lruList, riskScore, maintPlan] = await Promise.all([
          api.listAircraftLrus(acId),
          api.getAircraftRisk(acId),
          api.getMaintenancePlan(acId)
        ]);

        setAircraft(currentAc);
        setLrus(lruList);
        setRisk(riskScore);
        setMaintenance(maintPlan);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching aircraft detail data', err);
        setError('Failed to fetch digital twin telemetry. Ensure the backend FastAPI engine is online.');
        setLoading(false);
      }
    };

    fetchAircraftData();
  }, [id]);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>CONNECTING DIGITAL TWIN INTERRUPT TELEMETRY STREAM...</p>
      </div>
    );
  }

  if (error || !aircraft) {
    return (
      <div className="card fade-in" style={{ margin: '40px auto', maxWidth: '600px', borderLeft: '4px solid var(--color-failed)', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '12px' }}>Twin Diagnostic Error</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{error || 'Selected aircraft could not be loaded.'}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  // Count of LRU states
  const healthyCount = lrus.filter(l => l.current_state === 'HEALTHY').length;
  const degradedCount = lrus.filter(l => l.current_state === 'DEGRADED').length;
  const criticalCount = lrus.filter(l => l.current_state === 'CRITICAL').length;
  const failedCount = lrus.filter(l => l.current_state === 'FAILED').length;

  return (
    <div className="fade-in">
      {/* Back nav & Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 800 }}>
            {aircraft.tail_number} // Twin Status
          </h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            OPERATOR: {aircraft.operator || 'IndiGo'} | MODEL: {aircraft.aircraft_type} | MSN: {aircraft.msn || 'N/A'} | FLIGHT HOURS: {aircraft.total_flight_hours}
          </span>
        </div>
      </div>

      <div className="grid-main" style={{ marginBottom: '32px' }}>
        {/* Left Side: Subsystem Matrices & Health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Health Index Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card-header-flex">
              <h3 className="card-title">Overall Risk Assessment</h3>
              <Activity size={18} color="var(--text-muted)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>
                  Risk Score Index
                </span>
                <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--border-focus)', textShadow: 'var(--text-glow)', fontFamily: 'var(--font-mono)' }}>
                  {risk?.risk_score.toFixed(1)}%
                </div>
                <RiskBadge state={risk?.status} />
              </div>

              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Subsystem Health State Partitioning
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Healthy Operations', count: healthyCount, color: 'var(--color-healthy)', percent: lrus.length > 0 ? (healthyCount/lrus.length)*100 : 0 },
                    { label: 'Degraded telemetry', count: degradedCount, color: 'var(--color-degraded)', percent: lrus.length > 0 ? (degradedCount/lrus.length)*100 : 0 },
                    { label: 'Critical Anomaly', count: criticalCount, color: 'var(--color-critical)', percent: lrus.length > 0 ? (criticalCount/lrus.length)*100 : 0 },
                    { label: 'System Fault / Failure', count: failedCount, color: 'var(--color-failed)', percent: lrus.length > 0 ? (failedCount/lrus.length)*100 : 0 },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px' }}>
                        <span>{item.label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.count} units</span>
                      </div>
                      <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${item.percent}%`, height: '100%', backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* LRU Matrix list */}
          <div className="card">
            <div className="card-header-flex">
              <h3 className="card-title">Line Replaceable Unit (LRU) Directory</h3>
              <Cpu size={18} color="var(--text-muted)" />
            </div>

            <div className="table-container">
              <table className="hud-table">
                <thead>
                  <tr>
                    <th>LRU Code</th>
                    <th>Component Name</th>
                    <th>ATA Chapter</th>
                    <th>Module Type</th>
                    <th>Anomaly Score</th>
                    <th>Health State</th>
                    <th>Criticality Wt</th>
                    <th>Simulation</th>
                  </tr>
                </thead>
                <tbody>
                  {lrus.map((lru) => (
                    <tr key={lru.lru_code}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{lru.lru_code}</td>
                      <td>{lru.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>CH-{lru.ata_chapter}</td>
                      <td>{lru.lru_type}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: lru.anomaly_score > 0.1 ? 'var(--color-critical)' : 'var(--text-primary)' }}>
                        {lru.anomaly_score.toFixed(4)}
                      </td>
                      <td>
                        <RiskBadge state={lru.current_state} />
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{lru.criticality_weight.toFixed(2)}</td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                          title="Simulate Failure Cascade"
                          onClick={() => navigate(`/simulation?lru=${lru.lru_code}&severity=${lru.anomaly_score || 0.8}`)}
                        >
                          <Play size={12} fill="currentColor" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Maintenance recommendations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div className="card" style={{ borderLeft: '3px solid var(--border-focus)' }}>
            <div className="card-header-flex" style={{ marginBottom: '12px' }}>
              <h3 className="card-title">Priority Maintenance Plan</h3>
              <Wrench size={18} color="var(--text-muted)" />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>PLAN ACTION STATUS</span>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--border-focus)', letterSpacing: '0.5px' }}>
                {maintenance?.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {maintenance?.recommendations && maintenance.recommendations.length > 0 ? (
                maintenance.recommendations.map((rec, idx) => {
                  let borderCol = 'rgba(255,255,255,0.05)';
                  let titleCol = 'var(--text-primary)';
                  if (rec.priority === 'CRITICAL') {
                    borderCol = 'rgba(255, 23, 68, 0.2)';
                    titleCol = 'var(--color-failed)';
                  } else if (rec.priority === 'HIGH') {
                    borderCol = 'rgba(255, 145, 0, 0.2)';
                    titleCol = 'var(--color-critical)';
                  } else if (rec.priority === 'MEDIUM') {
                    borderCol = 'rgba(255, 196, 0, 0.2)';
                    titleCol = 'var(--color-degraded)';
                  }
                  
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        border: '1px solid var(--border-color)',
                        borderLeft: `3px solid ${borderCol.replace('0.2', '1.0')}`,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderRadius: '6px',
                        padding: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: titleCol }}>
                          {rec.lru_code} // {rec.priority}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          Score: {rec.anomaly_score.toFixed(3)}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {rec.action}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                  All components operating nominally. No proactive maintenance required.
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Diagnostic Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn btn-primary" onClick={() => navigate('/simulation')}>
                <Play size={16} fill="currentColor" /> Open Cascade Simulator
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/graph')}>
                <Settings size={16} /> View System Schematic
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AircraftOverview;
