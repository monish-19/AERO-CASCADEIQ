import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import QARTrendChart from '../components/QARTrendChart';
import { Calendar, Plane, Activity, Clock, ShieldAlert, TrendingDown, AlertOctagon } from 'lucide-react';

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function ReportStatCard({ label, value, icon: Icon, accentColor, suffix = '', delay = 0 }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0, 900);
  return (
    <div className="card stat-card fade-in" style={{ animationDelay: `${delay}ms`, borderTop: `2px solid ${accentColor}` }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 700 }}>{label}</span>
        <div className="stat-value count-up" style={{ color: accentColor, animationDelay: `${delay + 100}ms` }}>
          {typeof value === 'number' ? animated : value}{suffix}
        </div>
      </div>
      <div className="stat-icon" style={{ borderColor: `${accentColor}22`, color: accentColor }}>
        <Icon size={19} />
      </div>
    </div>
  );
}

export const Reports = () => {
  const [aircraftList, setAircraftList]     = useState([]);
  const [selectedAcId, setSelectedAcId]     = useState(null);
  const [report, setReport]                 = useState(null);
  const [loading, setLoading]               = useState(true);
  const [reportLoading, setReportLoading]   = useState(false);
  const [error, setError]                   = useState(null);

  useEffect(() => {
    const loadFleet = async () => {
      try {
        setLoading(true);
        const list = await api.listAircraft();
        setAircraftList(list);
        if (list.length > 0) setSelectedAcId(list[0].aircraft_id);
      } catch {
        setError('Failed to fetch registered aircraft fleet.');
      } finally {
        setLoading(false);
      }
    };
    loadFleet();
  }, []);

  useEffect(() => {
    if (!selectedAcId) return;
    const loadReport = async () => {
      try {
        setReportLoading(true);
        const data = await api.getAircraftReport(selectedAcId);
        setReport(data);
      } catch {
        /* silently skip */
      } finally {
        setReportLoading(false);
      }
    };
    loadReport();
  }, [selectedAcId]);

  if (loading) return (
    <div className="loader-container">
      <div className="spinner" />
      <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8 }}>
        COMPILING 30-DAY FLEET ANALYTICAL JOURNAL...
      </p>
    </div>
  );

  if (error) return (
    <div className="card fade-in" style={{ margin: '40px auto', maxWidth: 560, borderTop: '2px solid var(--color-failed)' }}>
      <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
    </div>
  );

  const selectedAc = aircraftList.find(ac => ac.aircraft_id === selectedAcId);

  return (
    <div className="fade-in">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.3px' }}>30-Day Fleet Telemetry Reports</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
            Historical QAR readings, flight parameter logs, and anomaly detection trends.
          </p>
        </div>

        {/* Aircraft selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Plane size={15} color="var(--text-muted)" />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px' }}>
            Twin Ref:
          </span>
          <div style={{ position: 'relative' }}>
            <select
              className="form-select"
              style={{ width: 200, padding: '8px 14px', paddingRight: 36, fontSize: '0.85rem' }}
              value={selectedAcId || ''}
              onChange={e => setSelectedAcId(parseInt(e.target.value, 10))}
              disabled={reportLoading}
            >
              {aircraftList.map(ac => (
                <option key={ac.aircraft_id} value={ac.aircraft_id}>
                  {ac.tail_number} ({ac.aircraft_type})
                </option>
              ))}
            </select>
            {/* Custom dropdown arrow */}
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
              ▾
            </div>
          </div>
        </div>
      </div>

      {reportLoading ? (
        <div className="loader-container" style={{ minHeight: 320 }}>
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8 }}>
            PROCESSING QAR MATRIX TIMESERIES...
          </p>
        </div>
      ) : report ? (
        <div>

          {/* ── Stat cards ── */}
          <div className="grid-cols-4" style={{ marginBottom: 28 }}>
            <ReportStatCard label="Total Flights" value={report.total_flights} icon={Plane}
              accentColor="var(--border-focus)" delay={0} />
            <ReportStatCard label="Airborne Hours" value={Math.round(report.total_flight_hours)} icon={Clock}
              accentColor="#7c3aed" suffix=" hrs" delay={80} />
            <ReportStatCard label="Telemetry Anomalies" value={report.anomalies_detected_count} icon={Activity}
              accentColor={report.anomalies_detected_count > 0 ? 'var(--color-critical)' : 'var(--color-healthy)'}
              delay={160} />
            <ReportStatCard label="Open Alert Nodes" value={report.open_alerts_count} icon={ShieldAlert}
              accentColor={report.open_alerts_count > 0 ? 'var(--color-failed)' : 'var(--color-healthy)'}
              delay={240} />
          </div>

          {/* ── Trend chart ── */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header-flex">
              <div>
                <h3 className="card-title">Timeseries Diagnostic Trend Index</h3>
                <p className="card-subtitle">
                  Average anomaly score (line) vs. daily count of anomalous sensor readings (bars)
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedAc && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                    padding: '4px 10px', borderRadius: 6,
                    background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.2)',
                    color: 'var(--border-focus)',
                  }}>
                    {selectedAc.tail_number}
                  </span>
                )}
                <Calendar size={15} color="var(--text-muted)" />
              </div>
            </div>

            {/* Chart wrapper with subtle grid overlay */}
            <div style={{
              position: 'relative', borderRadius: 10, overflow: 'hidden',
              background: 'rgba(0,0,0,0.2)', padding: '4px',
              border: '1px solid var(--border-color)',
            }}>
              <QARTrendChart data={report.health_trend} />
            </div>
          </div>

          {/* ── Analysis summary ── */}
          <div className="card">
            <div className="card-header-flex" style={{ marginBottom: 14 }}>
              <h4 className="card-title">Operational Safety Summary</h4>
              <AlertOctagon size={15} color="var(--text-muted)" />
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {/* Risk level indicator */}
              <div style={{
                padding: '14px 18px', borderRadius: 10,
                background: report.anomalies_detected_count > 5 ? 'rgba(255,145,0,0.06)' : 'rgba(0,230,118,0.06)',
                border: `1px solid ${report.anomalies_detected_count > 5 ? 'rgba(255,145,0,0.2)' : 'rgba(0,230,118,0.2)'}`,
                minWidth: 130, textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
                  Risk Level
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.1rem',
                  color: report.anomalies_detected_count > 5 ? 'var(--color-critical)' : 'var(--color-healthy)',
                }}>
                  {report.anomalies_detected_count > 10 ? 'HIGH' : report.anomalies_detected_count > 5 ? 'MODERATE' : 'LOW'}
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, flex: 1 }}>
                The 30-day QAR telemetry trend for <strong style={{ color: 'var(--text-primary)' }}>{selectedAc?.tail_number}</strong> shows{' '}
                {report.anomalies_detected_count > 0
                  ? <><strong style={{ color: 'var(--color-critical)' }}>{report.anomalies_detected_count} anomaly events</strong> over the period.</>
                  : 'no significant anomaly events.'
                }{' '}
                Persistent anomaly levels above <strong style={{ color: 'var(--color-critical)', fontFamily: 'var(--font-mono)' }}>0.20</strong> indicate
                mechanical degradation of Line Replaceable Units requiring priority inspection review.
                {report.open_alerts_count > 0 && (
                  <><br /><span style={{ color: 'var(--color-failed)', fontWeight: 600 }}>
                    ⚠ {report.open_alerts_count} open alert{report.open_alerts_count > 1 ? 's' : ''} currently unresolved.
                  </span></>
                )}
              </p>
            </div>

            {/* Progress bar for anomaly rate */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Anomaly Rate ({report.total_flights > 0 ? ((report.anomalies_detected_count / report.total_flights) * 100).toFixed(1) : 0}%)</span>
                <span>{report.anomalies_detected_count} / {report.total_flights} flights</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${report.total_flights > 0 ? Math.min((report.anomalies_detected_count / report.total_flights) * 100, 100) : 0}%`,
                    background: report.anomalies_detected_count > 5 ? 'var(--color-critical)' : 'var(--color-healthy)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card empty-state">
          <Plane size={32} style={{ opacity: 0.3 }} />
          <h4>No Aircraft Selected</h4>
          <p>Select an aircraft from the registry above to view its 30-day QAR report.</p>
        </div>
      )}
    </div>
  );
};

export default Reports;
