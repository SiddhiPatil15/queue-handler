import React from 'react';

export default function WhatIfTab({ whatifs = [], selectedHorizon = 20 }) {
  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: '1.4rem', color: '#1f2937', marginBottom: '16px' }}>
        🔮 What-If Action Simulator ({selectedHorizon}-Minute Lookahead)
      </h2>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        Simulates future queue length and wait times under different operational decisions using our feature-based growth model.
      </p>

      {whatifs.map((w) => (
        <div key={w.counter_id} style={{ background: '#fff', borderRadius: '8px', padding: '16px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#111827' }}>
            {w.counter_name}
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 12px' }}>Scenario / Action</th>
                  <th style={{ padding: '8px 12px' }}>Projected Queue</th>
                  <th style={{ padding: '8px 12px' }}>Projected Wait</th>
                  <th style={{ padding: '8px 12px' }}>Risk Reduction</th>
                  <th style={{ padding: '8px 12px' }}>Operational Cost</th>
                </tr>
              </thead>
              <tbody>
                {w.scenarios.map((s) => (
                  <tr key={s.action_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{s.action_name}</td>
                    <td style={{ padding: '8px 12px' }}>{s.projected_queue} people</td>
                    <td style={{ padding: '8px 12px' }}>{s.projected_wait_min} mins</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                        background: s.risk_reduction === 'High' ? '#dcfce7' : s.risk_reduction === 'Medium' ? '#fef9c3' : '#f3f4f6',
                        color: s.risk_reduction === 'High' ? '#166534' : s.risk_reduction === 'Medium' ? '#854d0e' : '#374151'
                      }}>
                        {s.risk_reduction}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#6b7280' }}>{s.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
