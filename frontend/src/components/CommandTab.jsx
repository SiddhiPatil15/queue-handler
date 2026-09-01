import React, { useRef } from 'react';
import { Zap, Upload, FileText, History, CheckCircle, AlertOctagon } from 'lucide-react';

export default function CommandTab({
  recommendation,
  onExecuteRecommendation,
  history,
  onUploadCsv,
  onExportCsv
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
            </div>

            <button
              className="btn btn-execute"
              disabled={!executable}
              onClick={onExecuteRecommendation}
            >
              <Zap size={16} /> Execute Action Now (1-Click Optimization)
            </button>
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

        {/* RIGHT COLUMN: OPERATIONAL AUDIT HISTORY LOG */}
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
  );
}
