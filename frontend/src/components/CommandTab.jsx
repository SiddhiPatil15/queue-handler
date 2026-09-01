import React, { useRef } from 'react';
import { Zap, Upload, FileText, History, CheckCircle, AlertOctagon } from 'lucide-react';

export default function CommandTab({
  recommendation,
  onExecuteRecommendation,
  history,
  onUploadCsv,
  onExportCsv,
  outcomes
}) {
  const fileInputRef = useRef(null);

  const priority = recommendation?.priority || "normal";
  const executable = recommendation?.executable || false;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      onUploadCsv(file.name, evt.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div className="tab-content">
      <div className="dashboard-grid">
        {/* LEFT COLUMN: RECOMMENDATION TICKET & CSV UPLOADER */}
        <div className="command-col-left">
          {/* 1-CLICK OPERATIONAL RECOMMENDATION TICKET */}
          <div className={`card ticket-card priority-${priority}`}>
            <div className="ticket-header">
              <span className="mono ticket-category">
                AUTOMATED AI RECOMMENDATION TICKET
              </span>
              <span className={`lane-status-badge ${priority === 'critical' ? 'critical' : priority === 'high' ? 'watch' : 'normal'}`}>
                {priority.toUpperCase()} PRIORITY
              </span>
            </div>

            <div className="ticket-body">
              <h3 className="ticket-action">{recommendation?.action || "Gathering real-time counter metrics..."}</h3>
              <p className="ticket-reason">{recommendation?.reason || "Analyzing throughput and service capacity."}</p>
              
              {recommendation && (
                <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <div><strong>Evidence:</strong> {recommendation.evidence || 'N/A'}</div>
                  <div><strong>Expected Impact:</strong> {recommendation.expected_impact || 'N/A'}</div>
                  <div><strong>AI Confidence:</strong> {recommendation.confidence || 'N/A'}</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-execute"
                style={{ flex: 1 }}
                disabled={!executable}
                onClick={onExecuteRecommendation}
              >
                <Zap size={16} /> Execute Action Now
              </button>
            </div>
          </div>

          {/* DYNAMIC CSV & DATASET UPLOADER */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2>Ingest Custom CSV / JSON Queue Data</h2>
                <p className="card-subtitle">Drag-and-drop or upload custom datasets to drive live queue dynamics</p>
              </div>
            </div>

            <div
              className="dropzone-area"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              <Upload size={32} className="dropzone-icon" />
              <div className="dropzone-title">Click or Drag CSV / JSON dataset here</div>
              <div className="dropzone-sub">
                Supports columns: <code>people_waiting</code>, <code>service_rate</code>, <code>counter_name</code>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv, .json"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>

            <div className="uploader-footer">
              <button className="btn btn-primary" onClick={onExportCsv}>
                <FileText size={16} /> Download CSV Queue Log Report
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: OPERATIONAL AUDIT & OUTCOMES HISTORY LOG */}
        <div className="command-col-right">
          {/* OUTCOME EFFECTIVENESS LOG */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <div>
                <h2>Closed-Loop Action Outcomes</h2>
                <p className="card-subtitle">Measured effectiveness of executed interventions</p>
              </div>
            </div>

            <div style={{ padding: '12px' }}>
              {outcomes && outcomes.length > 0 ? (
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                      <th style={{ padding: '6px' }}>Time</th>
                      <th style={{ padding: '6px' }}>Action</th>
                      <th style={{ padding: '6px' }}>Before</th>
                      <th style={{ padding: '6px' }}>After</th>
                      <th style={{ padding: '6px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcomes.map((o, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px' }}>{o.timestamp}</td>
                        <td style={{ padding: '6px' }}>{o.action_name}</td>
                        <td style={{ padding: '6px' }}>{o.queue_before}</td>
                        <td style={{ padding: '6px' }}>{o.queue_after}</td>
                        <td style={{ padding: '6px' }}>
                          <span style={{ color: o.success ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                            {o.success ? 'SUCCESS' : 'FAILED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No outcome measurements available yet. Executed actions are evaluated 5m post-execution.</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Operational Audit Log</h2>
                <p className="card-subtitle">Real-time audit history of executed actions &amp; system triggers</p>
              </div>
              <History size={18} color="var(--text-muted)" />
            </div>

            <div className="audit-log-container">
              {(history || []).length > 0 ? (
                history.slice(0, 20).map((item, idx) => (
                  <div key={idx} className="audit-log-row">
                    <div className="audit-log-left">
                      <CheckCircle size={15} className="audit-icon-success" />
                      <span className="audit-desc">{item.description}</span>
                    </div>
                    <span className="mono audit-timestamp">
                      {item.timestamp}
                    </span>
                  </div>
                ))
              ) : (
                <div className="audit-log-empty">No audit log events recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
