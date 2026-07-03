import React from 'react';

export const RiskBadge = ({ state }) => {
  const normalizedState = (state || 'HEALTHY').toUpperCase();
  
  let badgeClass = 'badge-healthy';
  if (normalizedState === 'DEGRADED' || normalizedState === 'SCHEDULED_INSPECTION_REQUIRED') {
    badgeClass = 'badge-degraded';
  } else if (normalizedState === 'CRITICAL' || normalizedState === 'URGENT_MAINTENANCE_REQUIRED') {
    badgeClass = 'badge-critical';
  } else if (normalizedState === 'FAILED' || normalizedState === 'AIRCRAFT_GROUNDED') {
    badgeClass = 'badge-failed';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span className="dot" style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: 'currentColor',
        display: 'inline-block'
      }}></span>
      {state}
    </span>
  );
};

export default RiskBadge;
