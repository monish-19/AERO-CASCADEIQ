import React from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AircraftOverview from './pages/AircraftOverview';
import FailureSimulation from './pages/FailureSimulation';
import GraphView from './pages/GraphView';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import DigitalTwin3D from './pages/DigitalTwin3D';
import { LayoutDashboard, Plane, Activity, Network, AlertTriangle, BarChart3, Shield, Box } from 'lucide-react';

export const App = () => {
  return (
    <Router>
      {/* Sidebar Navigation HUD */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">
              <Shield size={17} color="#00d2ff" />
            </div>
            <span>Cascade<span className="brand-accent">IQ</span></span>
          </div>
          <div className="brand-subtitle">
            AIRCRAFT COGNITIVE TWIN v1.0
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">Navigation</span>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={17} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/simulation" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Activity size={17} />
            <span>Simulator</span>
          </NavLink>
          <NavLink to="/graph" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Network size={17} />
            <span>Schematics</span>
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={17} />
            <span>Alert Log</span>
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <BarChart3 size={17} />
            <span>QAR Reports</span>
          </NavLink>
          <NavLink to="/twin3d" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Box size={17} />
            <span>3D Twin</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="system-status">
            <span className="status-dot" />
            <span>SYSTEM CONNECTED</span>
          </div>
          <LiveClock />
        </div>
      </aside>

      {/* Main Panel Viewport */}
      <main className="main-content">
        <header className="header">
          <div className="header-title">
            <h1>Aero-CascadeIQ Control Console</h1>
            <p>Digital Twin Failure Propagation &amp; Telemetry Anomaly Analyzer</p>
          </div>
          <div className="header-meta">
            <div className="header-pill">
              <span className="ping-dot" />
              <span>127.0.0.1:8000</span>
            </div>
          </div>
        </header>

        <div className="content-body">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/aircraft/:id" element={<AircraftOverview />} />
            <Route path="/simulation" element={<FailureSimulation />} />
            <Route path="/graph" element={<GraphView />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/twin3d" element={<DigitalTwin3D />} />
          </Routes>
        </div>
      </main>
    </Router>
  );
};

function LiveClock() {
  const [time, setTime] = React.useState(() => new Date().toUTCString().slice(17, 25));
  React.useEffect(() => {
    const id = setInterval(() => setTime(new Date().toUTCString().slice(17, 25)), 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="sidebar-clock">UTC {time}</div>;
}

export default App;
