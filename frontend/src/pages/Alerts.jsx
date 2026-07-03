import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AlertTriangle, CheckCircle, Check, Eye, Filter, RefreshCw } from 'lucide-react';

const SEV_ORDER = { high: 0, medium: 1, low: 2 };

function SevDot({ severity }) {
  return <div className={`sev-dot ${severity}`} />;
}

export const Alerts = () => {
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [filter, setFilter]         = useState('all');

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await api.listAlerts();
      setAlerts(data);
    } catch {
      setError('Failed to pull alert status stream.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAlerts(); }, []);

  const handleUpdateStatus = async (alertId, nextStatus) => {
    try {
      setActioningId(alertId);
      await api.updateAlertStatus(alertId, nextStatus);
      setAlerts(prev => prev.filter(a => a.alert_id !== alertId));
    } catch {
      alert('Failed to update alert state. Backend connection error.');
    } finally {
      setActioningId(null);
    }
  };

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  const sortedAlerts = [...filtered].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
  const counts = { high: alerts.filter(a => a.severity === 'high').length, medium: alerts.filter(a => a.severity === 'medium').length, low: alerts.filter(a => a.severity === 'low').length };

  if (loading && alerts.length === 0) return (
    <div className="loader-container">
      <div className="spinner" />
      <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8 }}>
        FETCHING DYNAMIC LOG STREAM WARNINGS...
      </p>
    </div>
  );

  return (
    <div className="fade-in">

      {/* ── Header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.3px' }}>
            Tactical Warnings &amp; Alerts
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
            Acknowledge anomaly triggers and log repairs in real-time.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Live count badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 16px', borderRadius: 20,
            background: alerts.length > 0 ? 'rgba(255,23,68,0.08)' : 'rgba(0,230,118,0.08)',
            border: `1px solid ${alerts.length > 0 ? 'rgba(255,23,68,0.25)' : 'rgba(0,230,118,0.2)'}`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: alerts.length > 0 ? 'var(--color-failed)' : 'var(--color-healthy)',
              boxShadow: `0 0 7px ${alerts.length > 0 ? 'var(--color-failed)' : 'var(--color-healthy)'}`,
              animation: alerts.length > 0 ? 'blinkDot 1.4s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700,
              color: alerts.length > 0 ? 'var(--color-failed)' : 'var(--color-healthy)',
            }}>
              {alerts.length} {alerts.length === 1 ? 'WARNING' : 'WARNINGS'} ACTIVE
            </span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '7px 14px', fontSize: '0.8rem', gap: 6 }} onClick={loadAlerts}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,23,68,0.2)', background: 'rgba(255,23,68,0.05)', color: 'var(--color-failed)', fontSize: '0.85rem', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ── Summary stat pills ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'High', count: counts.high, color: 'var(--color-failed)' },
          { label: 'Medium', count: counts.medium, color: 'var(--color-critical)' },
          { label: 'Low', count: counts.low, color: 'var(--color-degraded)' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            padding: '10px 18px', borderRadius: 10,
            background: `rgba(0,0,0,0.2)`,
            border: `1px solid ${count > 0 ? color + '33' : 'var(--border-color)'}`,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label} Severity</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: count > 0 ? color : 'var(--text-muted)', lineHeight: 1 }}>
              {count}
            </span>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Filter size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Filter</span>
          <div className="filter-bar">
            {[
              { key: 'all',    label: 'All Alerts' },
              { key: 'high',   label: 'High' },
              { key: 'medium', label: 'Medium' },
              { key: 'low',    label: 'Low' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`filter-pill ${filter === key ? 'active' : ''} ${key === 'high' && filter === 'high' ? 'danger' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label} {key !== 'all' && counts[key] > 0 && `(${counts[key]})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Alert list ── */}
      <div className="card">
        <div className="card-header-flex">
          <h3 className="card-title">Live Alert Queue</h3>
          <AlertTriangle size={16} color="var(--text-muted)" />
        </div>

        {sortedAlerts.length === 0 ? (
          <div className="empty-state">
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={26} color="var(--color-healthy)" />
            </div>
            <h4>All Systems Nominal</h4>
            <p>No {filter !== 'all' ? filter + '-severity ' : ''}alerts in queue. Fleet operating within standard boundaries.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedAlerts.map((alert, i) => {
              const isActioning = actioningId === alert.alert_id;
              return (
                <div
                  key={alert.alert_id}
                  className={`alert-card severity-${alert.severity}`}
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  <SevDot severity={alert.severity} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--border-focus)', fontSize: '0.88rem', letterSpacing: '0.04em' }}>
                        {alert.lru_code}
                      </span>
                      <span className={`badge badge-${alert.severity === 'high' ? 'failed' : alert.severity === 'medium' ? 'critical' : 'degraded'}`}>
                        {alert.severity}
                      </span>
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        AL-{alert.alert_id}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
                      {alert.message}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '5px 12px', fontSize: '0.75rem', gap: 5 }}
                          disabled={isActioning}
                          onClick={() => handleUpdateStatus(alert.alert_id, 'acknowledged')}
                        >
                          <Eye size={12} /> {isActioning ? '...' : 'Acknowledge'}
                        </button>
                        <button
                          className="btn btn-success"
                          style={{ padding: '5px 12px', fontSize: '0.75rem', gap: 5 }}
                          disabled={isActioning}
                          onClick={() => handleUpdateStatus(alert.alert_id, 'resolved')}
                        >
                          <Check size={12} /> Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
