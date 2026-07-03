import React, { useState, useRef, useEffect } from 'react';

export const QARTrendChart = ({ data = [] }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No trend data available.</div>;
  }

  // Dimension settings
  const svgWidth = 1000;
  const svgHeight = 320;
  const paddingLeft = 60;
  const paddingRight = 60;
  const paddingTop = 30;
  const paddingBottom = 50;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Find max values for scaling
  const maxScore = 1.0; // Anomaly score is bound between 0.0 and 1.0
  const maxCount = Math.max(...data.map(d => d.anomalous_readings_count), 5); // default min max of 5

  // Map data to coordinates
  const points = data.map((d, i) => {
    const x = paddingLeft + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : 0);
    // Y scales downwards in SVG
    const yScore = paddingTop + chartHeight - (d.avg_anomaly_score / maxScore) * chartHeight;
    const yCount = paddingTop + chartHeight - (d.anomalous_readings_count / maxCount) * chartHeight;
    return { x, yScore, yCount, original: d };
  });

  // Construct SVG Path strings
  let scorePathD = '';
  let fillPathD = '';

  if (points.length > 0) {
    // Generate a smooth cubic curve path
    scorePathD = `M ${points[0].x} ${points[0].yScore}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.yScore;
      const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
      const cpY2 = p1.yScore;
      scorePathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.yScore}`;
    }

    fillPathD = `${scorePathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  }

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    
    // Find closest index
    let closestIndex = 0;
    let minDistance = Infinity;
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    setHoveredIdx(closestIndex);

    // Calculate tooltip coordinates relative to client screen / container
    const tooltipX = e.clientX - rect.left + 15;
    const tooltipY = e.clientY - rect.top - 70;
    setTooltipPos({ x: tooltipX, y: tooltipY });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  // Label ticks
  const horizontalGridLines = [0, 0.25, 0.5, 0.75, 1];
  
  return (
    <div style={{ position: 'relative', width: '100%' }} ref={containerRef}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height="100%"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'crosshair', overflow: 'visible' }}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#00d2ff" floodOpacity="0.6"/>
          </filter>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00d2ff" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines and Y-axis labels */}
        {horizontalGridLines.map((val, idx) => {
          const y = paddingTop + chartHeight - val * chartHeight;
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={svgWidth - paddingRight}
                y2={y}
                stroke="var(--border-color)"
                strokeDasharray="4 6"
              />
              <text
                x={paddingLeft - 10}
                y={y + 4}
                fill="var(--text-muted)"
                fontSize="11px"
                fontFamily="var(--font-mono)"
                textAnchor="end"
              >
                {val.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Secondary Y-axis labels (right side - Count) */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const val = Math.round(ratio * maxCount);
          const y = paddingTop + chartHeight - ratio * chartHeight;
          return (
            <text
              key={idx}
              x={svgWidth - paddingRight + 10}
              y={y + 4}
              fill="rgba(255, 145, 0, 0.7)"
              fontSize="11px"
              fontFamily="var(--font-mono)"
              textAnchor="start"
            >
              {val}
            </text>
          );
        })}

        {/* X-axis labels (Dates - show every 5th element) */}
        {data.map((d, i) => {
          if (i % 5 !== 0 && i !== data.length - 1) return null;
          const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
          // Format date string from YYYY-MM-DD to DD/MM
          let label = d.date;
          try {
            const parts = d.date.split('-');
            label = `${parts[2]}/${parts[1]}`;
          } catch(e) {}
          
          return (
            <text
              key={i}
              x={x}
              y={svgHeight - 15}
              fill="var(--text-muted)"
              fontSize="11px"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              {label}
            </text>
          );
        })}

        {/* Draw anomalous counts as glowing orange bars */}
        {points.map((p, idx) => {
          const barHeight = paddingTop + chartHeight - p.yCount;
          if (barHeight <= 1) return null;
          return (
            <rect
              key={idx}
              x={p.x - 3}
              y={p.yCount}
              width={6}
              height={barHeight}
              fill="rgba(255, 145, 0, 0.35)"
              stroke="rgba(255, 145, 0, 0.6)"
              strokeWidth="0.5"
              rx={1.5}
            />
          );
        })}

        {/* Draw score line fill area */}
        {fillPathD && (
          <path d={fillPathD} fill="url(#chartGradient)" />
        )}

        {/* Draw score line path */}
        {scorePathD && (
          <path
            d={scorePathD}
            fill="none"
            stroke="#00d2ff"
            strokeWidth="3"
            filter="url(#glow)"
          />
        )}

        {/* Interactive hover overlay vertical line and circle point */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line
              x1={points[hoveredIdx].x}
              y1={paddingTop}
              x2={points[hoveredIdx].x}
              y2={paddingTop + chartHeight}
              stroke="rgba(0, 210, 255, 0.4)"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            <circle
              cx={points[hoveredIdx].x}
              cy={points[hoveredIdx].yScore}
              r={6}
              fill="#00d2ff"
              stroke="#070a13"
              strokeWidth="2"
              filter="url(#glow)"
            />
            <circle
              cx={points[hoveredIdx].x}
              cy={points[hoveredIdx].yCount}
              r={4}
              fill="#ff9100"
              stroke="#070a13"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {/* Floating HTML tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            backgroundColor: 'rgba(15, 21, 36, 0.95)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5), inset 0 0 10px rgba(0, 210, 255, 0.05)',
            backdropFilter: 'blur(8px)',
            padding: '12px 16px',
            borderRadius: '8px',
            pointerEvents: 'none',
            fontSize: '13px',
            zIndex: 100,
            whiteSpace: 'nowrap',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
            Date: {data[hoveredIdx].date}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d2ff' }}></span>
            <span style={{ color: 'var(--text-secondary)' }}>Avg Anomaly Score:</span>
            <strong style={{ color: '#00d2ff', fontFamily: 'var(--font-mono)' }}>{data[hoveredIdx].avg_anomaly_score.toFixed(4)}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff9100' }}></span>
            <span style={{ color: 'var(--text-secondary)' }}>Anomalous Readings:</span>
            <strong style={{ color: '#ff9100', fontFamily: 'var(--font-mono)' }}>{data[hoveredIdx].anomalous_readings_count}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default QARTrendChart;
