import React, { useEffect, useState } from 'react';

// Define fixed coordinates for nodes to avoid hydration mismatches 
// and keep the network looking consistent.
const NODES = [
  { id: 1, label: 'Incident Command', top: '30%', left: '20%', danger: false },
  { id: 2, label: 'Medical Unit', top: '60%', left: '35%', danger: false },
  { id: 3, label: 'Fire Response', top: '25%', left: '60%', danger: true },
  { id: 4, label: 'Rescue Unit', top: '70%', left: '70%', danger: false },
  { id: 5, label: 'Supply Hub', top: '45%', left: '80%', danger: false },
  { id: 6, label: 'Response Team', top: '80%', left: '25%', danger: false },
  { id: 7, label: 'Mobile Unit', top: '15%', left: '40%', danger: false }
];

const CONNECTIONS = [
  { from: 1, to: 2, dist: 35, angle: 63 },
  { from: 1, to: 7, dist: 25, angle: -37 },
  { from: 2, to: 3, dist: 43, angle: -54 },
  { from: 2, to: 6, dist: 22, angle: 117 },
  { from: 3, to: 5, dist: 28, angle: 45 },
  { from: 4, to: 5, dist: 27, angle: -68 },
  { from: 2, to: 4, dist: 35, angle: 16 }
];

export const EmergencyNetwork: React.FC = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return (
    <div className="network-container" aria-hidden="true">
      <div className="network-grid"></div>
      
      {/* Draw Nodes */}
      {NODES.map((node) => (
        <div 
          key={`node-${node.id}`} 
          className={`node ${node.danger ? 'danger' : ''}`}
          style={{ top: node.top, left: node.left }}
        >
          <div className="node-dot">
            {!prefersReducedMotion && <div className="node-pulse"></div>}
          </div>
          <div className="node-label">{node.label}</div>
        </div>
      ))}

      {/* Draw Connections (approximated for visual effect) */}
      {!prefersReducedMotion && CONNECTIONS.map((conn, idx) => {
        const fromNode = NODES.find(n => n.id === conn.from);
        if (!fromNode) return null;
        
        return (
          <div 
            key={`conn-${idx}`}
            className="connection-line"
            style={{
              top: fromNode.top,
              left: fromNode.left,
              width: `${conn.dist}%`,
              transform: `rotate(${conn.angle}deg)`,
              animationDelay: `${idx * 0.7}s`
            }}
          />
        );
      })}
    </div>
  );
};
