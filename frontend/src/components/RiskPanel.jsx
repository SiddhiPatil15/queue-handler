import React from 'react';

export default function RiskPanel({ risks = [], cameraHealth = {} }) {
  const getBadgeStyle = (level) => {
    switch (level) {
      case 'RED':
        return { background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' };
      case 'ORANGE':
        return { background: '#ffedd5', color: '#9a3412', border: '1px solid #fb923c' };
      case 'YELLOW':
        return { background: '#fef9c3', color: '#854d0e', border: '1px solid #facc15' };
      default:
        return { background: '#dcfce7', color: '#166534', border: '1px solid #4ade80' };
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: '#1f2937' }}>
        🛡️ Real-Time Risk & Time-to-Crisis Assessment
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {risks.map((r) => {
          const health = cameraHealth[r.counter_id] || { status: 'GOOD' };
          return (
            <div key={r.counter_id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>Counter {r.counter_id.toUpperCase()}</span>
                <span style={{ ...getBadgeStyle(r.risk_level), padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  {r.risk_level}
                </span>
              </div>
              
              <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                <div><strong>Growth Rate:</strong> {r.growth_rate > 0 ? `+${r.growth_rate}` : r.growth_rate} /min</div>
                <div>
                  <strong>Time-to-Crisis:</strong>{' '}
                  {r.time_to_crisis_min === 0 ? (
                    <span style={{ color: '#dc2626', fontWeight: 'bold' }}>IN CRISIS NOW</span>
                  ) : r.time_to_crisis_min ? (
                    <span style={{ color: '#d97706', fontWeight: 'bold' }}>~{r.time_to_crisis_min} mins</span>
                  ) : (
                    <span style={{ color: '#16a34a' }}>Stable (&gt;20m)</span>
                  )}
                </div>
                <div style={{ marginTop: '4px', fontSize: '0.75rem', color: health.status === 'GOOD' ? '#16a34a' : '#d97706' }}>
                  Feed: {health.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
