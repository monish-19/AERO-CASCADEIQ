import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import RiskBadge from '../components/RiskBadge';
import { Plane, AlertTriangle, Activity, BarChart2, ShieldAlert, ChevronRight, TrendingUp } from 'lucide-react';

/* ── Animated counter hook ─────────────────────────────── */
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

/* ── Stat Card ─────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, accentColor, subLabel, delay = 0 }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0, 900);
  return (
    <div className="card stat-card fade-in" style={{
      animationDelay: `${delay}ms`,
      borderTop: `2px solid ${accentColor || 'rgba(0,210,255,0.4)'}`,
    }}>
      <div style={{ flex: 1 }}>
        <span className="stat-label" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
          {label}
        </span>
        <div className="stat-value count-up" style={{ color: accentColor || 'var(--text-primary)', animationDelay: `${delay + 100}ms` }}>
          {typeof value === 'string' ? value : animated}
        </div>
        {subLabel && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{subLabel}</div>}
      </div>
      <div className="stat-icon" style={{ borderColor: `${accentColor}22`, color: accentColor }}>
        <Icon size={20} />
      </div>
    </div>
  );
}

/* ── Health bar sparkline ──────────────────────────────── */
function HealthBar({ dist }) {
  const colorMap = { HEALTHY: '#00e676', DEGRADED: '#ffc400', CRITICAL: '#ff9100', FAILED: '#ff1744' };
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No data</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
      <div className="health-bar">
        {Object.entries(dist).map(([state, count]) =>
          count > 0 ? (
            <div
              key={state}
              className="health-segment"
              style={{ width: `${(count / total) * 100}%`, background: colorMap[state] || '#64748b' }}
              title={`${state}: ${count}`}
            />
          ) : null
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(dist).map(([state, count]) =>
          count > 0 ? (
            <span key={state} style={{ fontSize: '0.65rem', color: colorMap[state], fontFamily: 'var(--font-mono)', letterSpacing: '0.3px' }}>
              {state[0]}{count}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

/* ── Severity glow dot ─────────────────────────────────── */
function SevDot({ severity }) {
  const colors = { high: 'var(--color-failed)', medium: 'var(--color-critical)', low: 'var(--color-degraded)' };
  const c = colors[severity] || 'var(--text-muted)';
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%', background: c,
      boxShadow: `0 0 7px ${c}`,
      animation: severity === 'high' ? 'blinkDot 1.4s ease-in-out infinite' : 'none',
      flexShrink: 0,
    }} />
  );
}

/* ── Main Dashboard ────────────────────────────────────── */
export const Dashboard = () => {
  const [fleet, setFleet] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [aircraftList, alertsList] = await Promise.all([api.listAircraft(), api.listAlerts()]);
        const fleetData = await Promise.all(
          aircraftList.map(async (ac) => {
            try {
              const risk = await api.getAircraftRisk(ac.aircraft_id);
              return { ...ac, risk };
            } catch {
              return { ...ac, risk: { risk_score: 0, status: 'HEALTHY', critical_lrus_count: 0, total_lrus_count: 0, state_distribution: {} } };
            }
          })
        );
        setFleet(fleetData);
        setAlerts(alertsList);
      } catch (err) {
        setError('Failed to connect to M4 API backend. Ensure FastAPI is running.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div className="loader-container">
      <div className="spinner" />
      <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8 }}>
        COMMUNICATION WITH COGNITIVE TWIN ENGINE...
      </p>
    </div>
  );

  if (error) return (
    <div className="card fade-in" style={{ margin: '40px auto', maxWidth: 560, borderTop: '2px solid var(--color-failed)', textAlign: 'center', padding: 40 }}>
      <AlertTriangle size={44} color="var(--color-failed)" style={{ marginBottom: 16, opacity: 0.9 }} />
      <h3 style={{ marginBottom: 10, fontSize: '1.1rem' }}>API Link Offline</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.6 }}>{error}</p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry Connection</button>
    </div>
  );

  const totalFleet = fleet.length;
  const criticalAircraft = fleet.filter(ac => ['CRITICAL', 'FAILED'].includes(ac.risk?.status)).length;
  const activeAlertsCount = alerts.length;
  const averageRisk = totalFleet > 0
    ? (fleet.reduce((a, ac) => a + (ac.risk?.risk_score || 0), 0) / totalFleet).toFixed(1)
    : '0.0';

  return (
    <div className="fade-in">

      {/* ── Stat Cards ── */}
      <div className="grid-cols-4" style={{ marginBottom: 28 }}>
        <StatCard label="Active Fleet" value={totalFleet} icon={Plane} accentColor="#00d2ff" subLabel="Digital twins online" delay={0} />
        <StatCard label="Critical / Grounded" value={criticalAircraft} icon={ShieldAlert}
          accentColor={criticalAircraft > 0 ? 'var(--color-failed)' : 'var(--color-healthy)'}
          subLabel={criticalAircraft > 0 ? 'Require immediate action' : 'All operational'} delay={80} />
        <StatCard label="Open Alert Nodes" value={activeAlertsCount} icon={AlertTriangle}
          accentColor={activeAlertsCount > 0 ? 'var(--color-critical)' : 'var(--color-healthy)'}
          subLabel={activeAlertsCount > 0 ? 'Unresolved warnings' : 'Fleet nominal'} delay={160} />
        <StatCard label="Fleet Risk Index" value={`${averageRisk}%`} icon={TrendingUp}
          accentColor="var(--border-focus)" subLabel="Average anomaly score" delay={240} />
      </div>

      {/* ── Fleet Table ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header-flex">
          <div>
            <h3 className="card-title">Fleet System Diagnostic Monitor</h3>
            <p className="card-subtitle">Operational status of all registered digital aircraft twins</p>
          </div>
          <BarChart2 size={16} color="var(--text-muted)" />
        </div>
        <div className="table-container">
          <table className="hud-table">
            <thead>
              <tr>
                <th>Aircraft Ref</th>
                <th>Model</th>
                <th>MSN</th>
                <th>Flight Hours</th>
                <th>Status</th>
                <th>LRU Distribution</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((ac, idx) => {
                const riskInfo = ac.risk || { risk_score: 0, status: 'HEALTHY', state_distribution: {} };
                const dist = riskInfo.state_distribution || {};
                const isCritical = ['CRITICAL', 'FAILED'].includes(riskInfo.status);
                return (
                  <tr key={ac.aircraft_id} style={{ animationDelay: `${idx * 40}ms` }}>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: isCritical ? 'var(--color-failed)' : 'var(--border-focus)',
                        letterSpacing: '0.05em',
                      }}>
                        {ac.tail_number}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{ac.aircraft_type}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ac.msn || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {ac.total_flight_hours?.toFixed(1)} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>hrs</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RiskBadge state={riskInfo.status} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {riskInfo.risk_score?.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td><HealthBar dist={dist} /></td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem', gap: 5 }}
                        onClick={() => navigate(`/aircraft/${ac.aircraft_id}`)}
                      >
                        Inspect <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Alert Preview ── */}
      <div className="card">
        <div className="card-header-flex">
          <div>
            <h3 className="card-title">Critical Alert Log</h3>
            <p className="card-subtitle">Most recent unresolved system warnings</p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={() => navigate('/alerts')}>
            View All
          </button>
        </div>

        {alerts.length === 0 ? (
          <div className="empty-state">
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={22} color="var(--color-healthy)" />
            </div>
            <h4>All Systems Nominal</h4>
            <p>No open component alerts. Fleet operating within boundaries.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.slice(0, 4).map((alert, i) => (
              <div key={alert.alert_id} className={`alert-card severity-${alert.severity}`} style={{ animationDelay: `${i * 60}ms` }}>
                <SevDot severity={alert.severity} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--border-focus)', fontSize: '0.82rem' }}>
                      {alert.lru_code}
                    </span>
                    <span className={`badge badge-${alert.severity === 'high' ? 'failed' : alert.severity === 'medium' ? 'critical' : 'degraded'}`}>
                      {alert.severity}
                    </span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      AL-{alert.alert_id}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{alert.message}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
