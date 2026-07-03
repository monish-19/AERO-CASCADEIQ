/**
 * DigitalTwin3D.jsx — Member 5 (Frontend & Presentation)
 * Interactive 3D Digital Twin viewer for the AERO-CascadeIQ system.
 * Enhanced with organic micro-animations, particle data streams,
 * multi-scan rings, telemetry ticker, and glassmorphism HUD overlays.
 */

import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { api } from '../api/client';
import { AlertTriangle, RefreshCw, Zap, X, ChevronRight, Info, Wifi } from 'lucide-react';

// ─────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────

const STATE_COLORS = {
  HEALTHY:  '#00e676',
  DEGRADED: '#ffc400',
  CRITICAL: '#ff9100',
  FAILED:   '#ff1744',
};

const LRU_POSITIONS = {
  'HYD-2A':     [-1.6, -0.35, -0.2],
  'ACT-L4':     [-2.2,  0.0,   0.4],
  'FCU-L':      [ 0.0,  0.4,   2.8],
  'ENG1-FADEC': [-1.8, -0.5,   0.6],
  'BLEED-V1':   [-1.8, -0.2,  -0.5],
  'AVNX-COOL':  [ 0.0,  0.3,  -1.5],
  'ADIRU-1':    [ 0.0,  0.2,   2.0],
  'GEN-1':      [-1.8, -0.7,   0.3],
  'FUEL-P1':    [ 0.0, -0.5,  -0.5],
  'APU':        [ 0.0,  0.1,  -3.2],
};

function getLruPosition(code, index, total) {
  if (LRU_POSITIONS[code]) return LRU_POSITIONS[code];
  const angle = (index / total) * Math.PI * 2;
  return [Math.cos(angle) * 0.9, Math.sin(angle) * 0.9, (index % 3) - 1.0];
}

// ─────────────────────────────────────────────
// 3D Sub-components
// ─────────────────────────────────────────────

/** Single data-stream particle travelling along an edge */
function EdgeParticle({ from, to, speed = 0.6, color = '#00d2ff', offset = 0 }) {
  const meshRef = useRef();
  const fromV = useMemo(() => new THREE.Vector3(...from), [from]);
  const toV   = useMemo(() => new THREE.Vector3(...to),   [to]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = ((clock.elapsedTime * speed + offset) % 1.0);
    meshRef.current.position.lerpVectors(fromV, toV, t);
    meshRef.current.material.opacity = Math.sin(t * Math.PI) * 0.85;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.028, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

/** Dependency edge line with travelling particles */
function DependencyEdge({ from, to, active }) {
  const points = useMemo(() => [new THREE.Vector3(...from), new THREE.Vector3(...to)], [from, to]);
  const pColor = active ? '#ff6b6b' : '#00d2ff';
  return (
    <group>
      <Line
        points={points}
        color={active ? '#ff174455' : 'rgba(0,210,255,0.18)'}
        lineWidth={active ? 2.0 : 0.6}
        dashed={!active}
        dashSize={0.15}
        gapSize={0.1}
      />
      <EdgeParticle from={from} to={to} speed={active ? 1.2 : 0.55} color={pColor} offset={0}    />
      <EdgeParticle from={from} to={to} speed={active ? 1.2 : 0.55} color={pColor} offset={0.4}  />
      {active && <EdgeParticle from={from} to={to} speed={1.5} color="#ff1744" offset={0.75} />}
    </group>
  );
}

/** Animated LRU node sphere */
function LruNode({ position, lru, isSelected, isCascaded, cascadeDelay, onClick }) {
  const meshRef  = useRef();
  const glowRef  = useRef();
  const ringRef  = useRef();
  const [hovered, setHovered] = useState(false);
  const [cascadeVisible, setCascadeVisible] = useState(isCascaded ? false : true);

  const state     = lru?.current_state || 'HEALTHY';
  const color     = STATE_COLORS[state] || STATE_COLORS.HEALTHY;
  const isPulsing = state === 'CRITICAL' || state === 'FAILED';

  useEffect(() => {
    if (!isCascaded) { setCascadeVisible(true); return; }
    setCascadeVisible(false);
    const t = setTimeout(() => setCascadeVisible(true), cascadeDelay);
    return () => clearTimeout(t);
  }, [isCascaded, cascadeDelay]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    meshRef.current.position.y = position[1] + Math.sin(t * 1.1 + position[0] * 2.3) * 0.045;
    if (isPulsing) {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 4.5) * 0.22);
    } else if (hovered) {
      meshRef.current.scale.setScalar(1.28);
    } else {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 0.9 + position[2]) * 0.03);
    }
    if (glowRef.current) glowRef.current.material.opacity = 0.10 + Math.sin(t * 1.8 + position[0]) * 0.07;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * (isPulsing ? 2.2 : 0.6);
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.3;
    }
  });

  if (!cascadeVisible) return null;

  const nodeColor = isCascaded ? STATE_COLORS.FAILED : color;
  const radius    = isSelected ? 0.16 : 0.12;

  return (
    <group position={position} ref={meshRef}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * 2.4, 16, 16]} />
        <meshBasicMaterial color={nodeColor} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      {(isSelected || isPulsing) && (
        <mesh ref={ringRef}>
          <torusGeometry args={[radius * 2.0, 0.008, 8, 48]} />
          <meshBasicMaterial color={nodeColor} transparent opacity={0.5} />
        </mesh>
      )}
      <mesh
        onClick={e => { e.stopPropagation(); onClick(lru); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial color={nodeColor} emissive={nodeColor}
          emissiveIntensity={isPulsing || isSelected ? 1.4 : 0.65} roughness={0.08} metalness={0.4} />
      </mesh>
      <pointLight color={nodeColor} intensity={isPulsing ? 1.8 : 0.9} distance={1.4} decay={2} />
      {(hovered || isSelected) && (
        <Html distanceFactor={8} center>
          <div style={{
            background: 'rgba(7,10,19,0.93)', border: `1px solid ${nodeColor}`,
            borderRadius: 6, padding: '4px 9px', color: nodeColor,
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            whiteSpace: 'nowrap', boxShadow: `0 0 12px ${nodeColor}55`,
            pointerEvents: 'none', letterSpacing: '0.05em',
          }}>
            {lru?.lru_code || '???'}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Scan ring that oscillates along the fuselage Z axis */
function ScanRing({ speed = 0.45, radius = 1.05, color = '#00d2ff', phase = 0 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed + phase;
    ref.current.position.z = Math.sin(t) * 3.2;
    ref.current.material.opacity = 0.06 + Math.sin(t * 2.1) * 0.04;
    ref.current.rotation.z += 0.007;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.008, 8, 72]} />
      <meshBasicMaterial color={color} transparent opacity={0.08} />
    </mesh>
  );
}

/** Expanding holographic pulse ring rising from the floor */
function PulseRing({ position = [0, 0, 0], color = '#00d2ff', period = 3 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime % period) / period;
    ref.current.scale.setScalar(0.5 + t * 3.5);
    ref.current.material.opacity = (1 - t) * 0.12;
  });
  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.6, 0.006, 6, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
    </mesh>
  );
}

/** Engine inlet torus with animated emissive */
function EngineInletRing({ position }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 3.5 + position[0]) * 0.25;
  });
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[0.15, 0.025, 12, 24]} />
      <meshStandardMaterial color="#00d2ff" emissive="#00d2ff" emissiveIntensity={0.4} />
    </mesh>
  );
}

/** Stylized aircraft body with subtle breathing */
function AircraftBody() {
  const groupRef = useRef();
  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 0.35) * 0.004);
  });
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.22, 6.5, 24]} />
        <meshStandardMaterial color="#0f1a2e" metalness={0.65} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 3.6]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.28, 1.2, 24]} />
        <meshStandardMaterial color="#0f1a2e" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, -3.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.22, 0.9, 24]} />
        <meshStandardMaterial color="#0c1525" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Wings */}
      {[[-2.1, -0.05, 0.2], [2.1, -0.05, 0.2]].map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[3.2, 0.06, 1.4]} />
          <meshStandardMaterial color="#0d1830" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}
      {/* Wing tips */}
      <mesh position={[-3.5, -0.05, 0.55]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.8, 0.05, 0.6]} />
        <meshStandardMaterial color="#0a1422" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[3.5, -0.05, 0.55]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.8, 0.05, 0.6]} />
        <meshStandardMaterial color="#0a1422" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Horizontal stabilizers */}
      {[[-1.0, 0, -2.8], [1.0, 0, -2.8]].map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[1.8, 0.05, 0.7]} />
          <meshStandardMaterial color="#0d1830" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Vertical stabilizer */}
      <mesh position={[0, 0.55, -2.7]}>
        <boxGeometry args={[0.05, 1.1, 0.9]} />
        <meshStandardMaterial color="#0d1830" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Engine nacelles */}
      {[[-1.8, -0.48, 0.6], [1.8, -0.48, 0.6]].map((pos, i) => (
        <mesh key={i} position={pos}>
          <cylinderGeometry args={[0.15, 0.14, 0.9, 16]} />
          <meshStandardMaterial color="#0a1218" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <EngineInletRing position={[-1.8, -0.48, 1.08]} />
      <EngineInletRing position={[ 1.8, -0.48, 1.08]} />
      {/* Wireframe fuselage glow */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.285, 0.225, 6.5, 24]} />
        <meshBasicMaterial color="#00d2ff" transparent opacity={0.03} wireframe />
      </mesh>
      {/* Cockpit windows */}
      <mesh position={[0, 0.16, 3.0]}>
        <boxGeometry args={[0.28, 0.12, 0.06]} />
        <meshStandardMaterial color="#00d2ff" emissive="#00d2ff" emissiveIntensity={0.9} transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

/** Slow-drifting ambient particles */
function AmbientParticles({ count = 55 }) {
  const particles = useMemo(() => Array.from({ length: count }, () => ({
    pos:   [(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 14],
    speed: 0.08 + Math.random() * 0.12,
    phase: Math.random() * Math.PI * 2,
    size:  0.012 + Math.random() * 0.022,
  })), [count]);

  const refs = useRef(particles.map(() => null));

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = particles[i];
      mesh.position.y = p.pos[1] + Math.sin(t * p.speed + p.phase) * 0.6;
      mesh.position.x = p.pos[0] + Math.cos(t * p.speed * 0.7 + p.phase) * 0.3;
      mesh.material.opacity = 0.12 + Math.sin(t * p.speed * 2 + p.phase) * 0.08;
    });
  });

  return (
    <>
      {particles.map((p, i) => (
        <mesh key={i} position={p.pos} ref={el => { refs.current[i] = el; }}>
          <sphereGeometry args={[p.size, 4, 4]} />
          <meshBasicMaterial color="#00d2ff" transparent opacity={0.15} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function GridFloor() {
  return <gridHelper args={[22, 34, '#0d2240', '#091828']} position={[0, -1.8, 0]} />;
}

// ─────────────────────────────────────────────
// Main 3D Scene
// ─────────────────────────────────────────────

function AircraftScene({ lrus, selectedLru, onSelect, cascadedNodes, edges }) {
  return (
    <>
      <ambientLight intensity={0.14} />
      <directionalLight position={[5, 8, 5]}   intensity={0.6} color="#a0c4ff" />
      <directionalLight position={[-5, -3, -5]} intensity={0.2} color="#0040ff" />
      <pointLight position={[0, 3, 0]} intensity={0.4} color="#00d2ff" distance={8} />

      <Stars radius={90} depth={60} count={3500} factor={3} fade speed={0.3} />
      <GridFloor />
      <AmbientParticles count={55} />

      {/* Multi-ring scan effect */}
      <ScanRing speed={0.42} radius={1.05} color="#00d2ff" phase={0}   />
      <ScanRing speed={0.28} radius={0.70} color="#7c3aed" phase={1.8} />
      <ScanRing speed={0.60} radius={0.45} color="#00e676" phase={3.5} />

      {/* Floor pulse rings */}
      <PulseRing position={[0, -1.79, 0]} color="#00d2ff" period={4} />
      <PulseRing position={[0, -1.79, 0]} color="#7c3aed" period={6} />

      <group rotation={[0, Math.PI * 0.08, 0]}>
        <AircraftBody />

        {edges.map((edge, i) => {
          const fromPos = getLruPosition(edge.from, 0, lrus.length);
          const toPos   = getLruPosition(edge.to,   1, lrus.length);
          const active  = cascadedNodes.includes(edge.from) && cascadedNodes.includes(edge.to);
          return <DependencyEdge key={i} from={fromPos} to={toPos} active={active} />;
        })}

        {lrus.map((lru, idx) => {
          const pos        = getLruPosition(lru.lru_code, idx, lrus.length);
          const isCascaded = cascadedNodes.includes(lru.lru_code);
          return (
            <LruNode
              key={lru.lru_id || lru.lru_code}
              position={pos}
              lru={lru}
              isSelected={selectedLru?.lru_code === lru.lru_code}
              isCascaded={isCascaded}
              cascadeDelay={cascadedNodes.indexOf(lru.lru_code) * 600}
              onClick={onSelect}
            />
          );
        })}
      </group>

      <OrbitControls enablePan enableZoom minDistance={3} maxDistance={18} autoRotate autoRotateSpeed={0.38} />
    </>
  );
}

// ─────────────────────────────────────────────
// HUD Overlay components
// ─────────────────────────────────────────────

/** Live telemetry ticker */
const TELEMETRY_MSGS = [
  'ENG1-FADEC: N1=96.2%  N2=94.8%  EGT=642°C',
  'HYD-2A: SYS PRESSURE 3012 PSI  NORM',
  'ADIRU-1: PITCH+1.2° ROLL-0.4° HDG=274°',
  'BLEED-V1: VALVE OPEN  FLOW=12.4 lb/min',
  'APU: SPEED=100%  EGT=428°C  LOAD=62%',
  'AVNX-COOL: TEMP=24°C  FAN=3200 RPM',
  'GEN-1: 115VAC / 400Hz  LOAD=74%',
  'FUEL-P1: FLOW=2.4 t/h  PRESS=18 PSI',
  'FCU-L: ALT HOLD  SPD=0.79M  VS=+200fpm',
  'ACT-L4: DEFLECTION=-2.3°  CURRENT=3.1A',
];

function TelemetryTicker() {
  const [idx,  setIdx]  = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(i => (i + 1) % TELEMETRY_MSGS.length); setFade(true); }, 280);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position: 'absolute', bottom: 42, left: 16,
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
      color: '#00d2ff', opacity: fade ? 0.7 : 0,
      transition: 'opacity 0.28s ease',
      pointerEvents: 'none', maxWidth: 360,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      <span style={{ color: '#7c3aed', marginRight: 6 }}>►</span>
      {TELEMETRY_MSGS[idx]}
    </div>
  );
}

/** Blinking corner HUD label */
function HudCornerLabel({ text, style }) {
  const [blink, setBlink] = useState(true);
  useEffect(() => { const id = setInterval(() => setBlink(b => !b), 1400); return () => clearInterval(id); }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
        background: '#00d2ff', boxShadow: '0 0 6px #00d2ff',
        opacity: blink ? 1 : 0.2, transition: 'opacity 0.35s ease',
      }} />
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(0,210,255,0.55)', letterSpacing: '0.04em' }}>
        {text}
      </span>
    </div>
  );
}

/** Stat pill with shimmer + entrance animation */
function StatPill({ label, value, color }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 18px',
      background: 'rgba(15,21,36,0.75)',
      border: `1px solid ${color}33`, borderRadius: 10,
      gap: 5, overflow: 'hidden', position: 'relative',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.45s ease, transform 0.45s ease',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
        background: `linear-gradient(90deg, transparent, ${color}18, transparent)`,
        animation: 'shimmer 3.5s ease infinite',
        pointerEvents: 'none',
      }} />
      <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{value}</span>
    </div>
  );
}

function LruInfoPanel({ lru, onClose, onRunCascade, cascadeRunning }) {
  const state   = lru.current_state || 'HEALTHY';
  const color   = STATE_COLORS[state];
  const [entered, setEntered] = useState(false);
  useEffect(() => { const t = setTimeout(() => setEntered(true), 30); return () => clearTimeout(t); }, []);

  return (
    <div style={{
      position: 'absolute', top: 20, right: 20, width: 282,
      background: 'rgba(8,12,24,0.97)',
      border: `1px solid ${color}44`,
      borderRadius: 14, padding: 20, backdropFilter: 'blur(14px)',
      boxShadow: `0 0 36px ${color}1a, 0 8px 32px rgba(0,0,0,0.5)`,
      zIndex: 10,
      opacity: entered ? 1 : 0,
      transform: entered ? 'translateX(0)' : 'translateX(20px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color, fontSize: 14, letterSpacing: '0.04em' }}>
            {lru.lru_code}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {[
          ['System Name',   lru.name || '—'],
          ['ATA Chapter',   lru.ata_chapter || '—'],
          ['LRU Type',      lru.lru_type || '—'],
          ['Health State',  state],
          ['Anomaly Score', (lru.anomaly_score || 0).toFixed(3)],
          ['Criticality',   (lru.criticality_weight || 0).toFixed(2)],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6 }}>{k}</span>
            <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: k === 'Health State' ? color : '#e2e8f0' }}>{v}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => onRunCascade(lru.lru_code)}
        disabled={cascadeRunning}
        style={{
          width: '100%', padding: '11px 0',
          background: cascadeRunning ? 'rgba(255,23,68,0.08)' : 'rgba(255,23,68,0.14)',
          border: '1px solid rgba(255,23,68,0.38)',
          borderRadius: 8, color: '#ff1744',
          fontFamily: 'inherit', fontWeight: 600, fontSize: 12,
          cursor: cascadeRunning ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          letterSpacing: '0.04em', transition: 'background 0.2s ease',
          opacity: cascadeRunning ? 0.6 : 1,
        }}
      >
        {cascadeRunning
          ? <><RefreshCw size={13} style={{ animation: 'spin 0.9s linear infinite' }} /> SIMULATING...</>
          : <><Zap size={13} /> SIMULATE CASCADE</>
        }
      </button>
    </div>
  );
}

function CascadeResultPanel({ result, onClear }) {
  if (!result) return null;
  const [entered, setEntered] = useState(false);
  useEffect(() => { const t = setTimeout(() => setEntered(true), 30); return () => clearTimeout(t); }, []);

  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 20, width: 282,
      background: 'rgba(8,12,24,0.97)',
      border: '1px solid rgba(255,23,68,0.28)',
      borderRadius: 14, padding: 18, backdropFilter: 'blur(14px)',
      boxShadow: '0 0 30px rgba(255,23,68,0.1)',
      zIndex: 10,
      opacity: entered ? 1 : 0,
      transform: entered ? 'translateY(0)' : 'translateY(16px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: '#ff1744', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          ⚡ Cascade Result
        </span>
        <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <X size={13} />
        </button>
      </div>
      <p style={{ color: '#64748b', fontSize: 10, marginBottom: 12, fontFamily: 'JetBrains Mono, monospace' }}>
        {result.nodes?.length || 0} nodes impacted · {result.edges?.length || 0} edges traversed
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
        {(result.nodes || []).map((node, i) => (
          <div key={node.lru_code} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px',
            background: 'rgba(255,23,68,0.06)',
            border: '1px solid rgba(255,23,68,0.14)',
            borderRadius: 6,
            opacity: 0,
            animation: `slideInAlert 0.3s ease ${i * 0.07}s forwards`,
          }}>
            <ChevronRight size={11} color="#ff1744" />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#ff6b6b' }}>{node.lru_code}</span>
            <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>{node.anomaly_score?.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inject keyframes once */
function GlobalStyles() {
  useEffect(() => {
    const id = 'dt3d-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes shimmer { 0% { left: -100%; } 100% { left: 200%; } }
      @keyframes spin    { to { transform: rotate(360deg); } }
      @keyframes scanLine {
        0%   { top: 0%;   opacity: 0.6; }
        100% { top: 100%; opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

const DEPENDENCY_EDGES = [
  { from: 'HYD-2A',    to: 'ACT-L4'    },
  { from: 'ACT-L4',    to: 'FCU-L'     },
  { from: 'BLEED-V1',  to: 'AVNX-COOL' },
  { from: 'AVNX-COOL', to: 'ADIRU-1'   },
];

export const DigitalTwin3D = () => {
  const [lrus, setLrus]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedLru, setSelectedLru]     = useState(null);
  const [cascadedNodes, setCascadedNodes] = useState([]);
  const [cascadeResult, setCascadeResult] = useState(null);
  const [cascadeRunning, setCascadeRunning] = useState(false);
  const [lastRefresh, setLastRefresh]     = useState(null);

  const fetchLrus = async () => {
    try {
      const data = await api.listAircraftLrus(1);
      setLrus(data);
      setLastRefresh(new Date());
      setError(null);
    } catch {
      setError('Cannot reach backend API. Ensure FastAPI is running on :8000');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLrus();
    const interval = setInterval(fetchLrus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRunCascade = async (lruCode) => {
    setCascadeRunning(true);
    setCascadedNodes([]);
    setCascadeResult(null);
    try {
      const result = await api.predictFailure(lruCode, 0.85);
      setCascadeResult(result);
      const nodes = (result.nodes || []).map(n => n.lru_code);
      nodes.forEach((code, i) => setTimeout(() => setCascadedNodes(prev => [...prev, code]), i * 600));
    } catch (e) {
      console.error('Cascade simulation failed', e);
    } finally {
      setCascadeRunning(false);
    }
  };

  const handleClearCascade = () => { setCascadedNodes([]); setCascadeResult(null); };

  const stats = useMemo(() => {
    const c = { HEALTHY: 0, DEGRADED: 0, CRITICAL: 0, FAILED: 0 };
    lrus.forEach(l => { c[l.current_state] = (c[l.current_state] || 0) + 1; });
    return c;
  }, [lrus]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 20 }}>
      <GlobalStyles />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>
            3D Digital Twin — <span style={{ color: 'var(--border-focus)', textShadow: 'var(--text-glow)' }}>VT-INX</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Live LRU health overlay · Click any node to inspect · Drag to orbit
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {lastRefresh && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Wifi size={11} style={{ opacity: 0.5 }} />
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button className="btn btn-secondary" onClick={fetchLrus} style={{ padding: '7px 13px', fontSize: '0.78rem', gap: 6 }}>
            <RefreshCw size={13} /> Sync Twin
          </button>
          {cascadedNodes.length > 0 && (
            <button className="btn btn-danger" onClick={handleClearCascade} style={{ padding: '7px 13px', fontSize: '0.78rem', gap: 6 }}>
              <X size={13} /> Clear Cascade
            </button>
          )}
        </div>
      </div>

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatPill label="Healthy"    value={stats.HEALTHY  || 0} color="#00e676" />
        <StatPill label="Degraded"   value={stats.DEGRADED || 0} color="#ffc400" />
        <StatPill label="Critical"   value={stats.CRITICAL || 0} color="#ff9100" />
        <StatPill label="Failed"     value={stats.FAILED   || 0} color="#ff1744" />
        <StatPill label="Total LRUs" value={lrus.length}          color="#00d2ff" />
        {cascadedNodes.length > 0 && <StatPill label="Cascaded" value={cascadedNodes.length} color="#ff1744" />}
      </div>

      {/* 3D Canvas container */}
      <div style={{
        flex: 1, minHeight: 520, position: 'relative',
        borderRadius: 16, overflow: 'hidden',
        border: '1px solid rgba(0,210,255,0.13)',
        background: 'radial-gradient(ellipse at 40% 50%, #060f1f 0%, #020508 100%)',
        boxShadow: '0 0 50px rgba(0,210,255,0.04) inset, 0 4px 40px rgba(0,0,0,0.6)',
      }}>
        {/* Scan line overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.18), transparent)',
          animation: 'scanLine 4s linear infinite',
          pointerEvents: 'none', zIndex: 5,
        }} />

        {loading ? (
          <div className="loader-container">
            <div className="spinner" />
            <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 10 }}>
              INITIALIZING COGNITIVE TWIN...
            </p>
          </div>
        ) : error ? (
          <div className="loader-container">
            <AlertTriangle size={38} color="#ff1744" />
            <p style={{ color: '#ff1744', fontSize: 13, textAlign: 'center', maxWidth: 400, marginTop: 10 }}>{error}</p>
          </div>
        ) : (
          <Canvas camera={{ position: [6, 3, 8], fov: 45 }} gl={{ antialias: true, alpha: true }} style={{ width: '100%', height: '100%' }}>
            <Suspense fallback={null}>
              <AircraftScene lrus={lrus} selectedLru={selectedLru} onSelect={setSelectedLru} cascadedNodes={cascadedNodes} edges={DEPENDENCY_EDGES} />
            </Suspense>
          </Canvas>
        )}

        {/* HUD labels */}
        <HudCornerLabel text="AIRCRAFT_TWIN :: VT-INX :: A320-214"
          style={{ position: 'absolute', top: 16, left: 16, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 16, left: 16, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(0,210,255,0.26)', pointerEvents: 'none', letterSpacing: '0.06em' }}>
          SCROLL TO ZOOM · DRAG TO ORBIT · CLICK NODE TO INSPECT
        </div>

        <TelemetryTicker />

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 16, right: selectedLru ? 310 : 16,
          background: 'rgba(6,9,18,0.88)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 7,
          transition: 'right 0.3s ease',
        }}>
          {Object.entries(STATE_COLORS).map(([state, color]) => (
            <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 7px ${color}` }} />
              <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8 }}>{state}</span>
            </div>
          ))}
        </div>

        {selectedLru && (
          <LruInfoPanel
            lru={selectedLru}
            onClose={() => setSelectedLru(null)}
            onRunCascade={handleRunCascade}
            cascadeRunning={cascadeRunning}
          />
        )}
        {cascadeResult && !selectedLru && (
          <CascadeResultPanel result={cascadeResult} onClear={handleClearCascade} />
        )}
      </div>

      {/* LRU Registry Table */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header-flex">
          <div>
            <h3 className="card-title">LRU Module Registry</h3>
            <p className="card-subtitle">All registered Line Replaceable Units for this digital twin</p>
          </div>
          <Info size={15} color="var(--text-muted)" />
        </div>
        <div className="table-container">
          <table className="hud-table">
            <thead>
              <tr>
                <th>Code</th><th>System Name</th><th>ATA</th>
                <th>Type</th><th>State</th><th>Anomaly Score</th><th>Criticality</th>
              </tr>
            </thead>
            <tbody>
              {lrus.map(lru => {
                const color      = STATE_COLORS[lru.current_state] || STATE_COLORS.HEALTHY;
                const isCascaded = cascadedNodes.includes(lru.lru_code);
                return (
                  <tr
                    key={lru.lru_id}
                    onClick={() => setSelectedLru(lru)}
                    style={{
                      cursor: 'pointer',
                      background: isCascaded ? 'rgba(255,23,68,0.05)' : selectedLru?.lru_code === lru.lru_code ? 'rgba(0,210,255,0.05)' : 'transparent',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: isCascaded ? '#ff1744' : 'var(--border-focus)' }}>
                      {lru.lru_code}
                    </td>
                    <td>{lru.name || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lru.ata_chapter || '—'}</td>
                    <td style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{lru.lru_type || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                        <span style={{ fontSize: '0.78rem', color, fontFamily: 'var(--font-mono)' }}>{lru.current_state}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{(lru.anomaly_score || 0).toFixed(3)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{(lru.criticality_weight || 0).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DigitalTwin3D;
