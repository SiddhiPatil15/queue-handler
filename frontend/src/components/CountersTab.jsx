import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, Plus, Minus, Users, Clock, ShieldAlert, CheckCircle2, UserCheck } from 'lucide-react';

const LANE_VISUAL_CAPACITY = 35;

export default function CountersTab({ snapshot, onToggleCounter, onUpdateServiceRate, onSetQueueCount }) {
  const [selectedCounterId, setSelectedCounterId] = useState('');
  const [inputCount, setInputCount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!snapshot || !snapshot.counters) return null;

  const activeCounters = snapshot.counters.filter(c => c.active);
  const currentSelectedId = selectedCounterId || (activeCounters[0]?.id || snapshot.counters[0]?.id);

  const handleApplyCount = async (e) => {
    e.preventDefault();
    if (!currentSelectedId || inputCount === '') return;
    setIsSubmitting(true);
    try {
      await onSetQueueCount(currentSelectedId, inputCount);
      setInputCount('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tab-content">
      {/* REAL MANUAL QUEUE INPUT CARD */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header" style={{ marginBottom: "16px" }}>
          <div>
            <h2>Real Manual Queue Input Control</h2>
            <p className="card-subtitle">Manually override counter queue lengths to drive real wait-time calculations, alerts, and predictions</p>
          </div>
          <span className="model-badge">MANUAL OVERRIDE</span>
        </div>

        <form onSubmit={handleApplyCount} style={{ display: "flex", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 220px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>Select Operational Counter:</label>
            <select
              className="custom-select"
              value={currentSelectedId}
              onChange={(e) => setSelectedCounterId(e.target.value)}
              style={{ width: "100%" }}
            >
              {snapshot.counters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.people_waiting} currently waiting {!c.active ? '• CLOSED' : ''})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 180px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>Current People in Queue:</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 24"
              value={inputCount}
              onChange={(e) => setInputCount(e.target.value)}
              className="custom-select mono"
              style={{ width: "100%" }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || inputCount === ''}
            style={{ padding: "10px 22px" }}
          >
            <UserCheck size={16} /> {isSubmitting ? "Updating State..." : "Apply Queue Count"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Live Service Counters &amp; Physical Crowd Grid</h2>
            <p className="card-subtitle">Real-time lane occupancy, visual crowd density, processing speed adjusters &amp; maintenance toggles</p>
          </div>

          <div className="legend-status-indicators">
            <span className="legend-item">
              <span className="dot dot-normal"></span> &lt; 8 min (Healthy)
            </span>
            <span className="legend-item">
              <span className="dot dot-watch"></span> 8 - 15 min (Moderate)
            </span>
            <span className="legend-item">
              <span className="dot dot-critical"></span> &gt; 15 min (Critical)
            </span>
          </div>
        </div>

        <div className="lanes-container">
          {snapshot.counters.map((c) => {
            const fillPct = c.active
              ? Math.min(100, Math.round((c.people_waiting / LANE_VISUAL_CAPACITY) * 100))
              : 0;

            const dotCount = c.active ? Math.min(30, c.people_waiting) : 0;
            const dots = Array.from({ length: dotCount });
            const sourceLabel = c.last_source ? c.last_source.toUpperCase().replace('_', ' ') : 'SIMULATION';

            return (
              <div key={c.id} className={`lane-item ${!c.active ? 'closed' : ''}`}>
                <div className="lane-top">
                  <div className="lane-header-group">
                    <span className="lane-name">{c.name}</span>
                    <span className={`lane-status-badge ${c.active ? c.status : 'closed'}`}>
                      {c.active ? (c.status === 'normal' ? 'HEALTHY' : c.status === 'watch' ? 'MODERATE' : 'CRITICAL') : 'CLOSED'}
                    </span>
                    <span className="model-badge" style={{ fontSize: "10px", padding: "2px 8px" }}>
                      Source: {sourceLabel}
                    </span>
                  </div>

                  <div className="lane-metrics-group">
                    <div className="lane-metric-block">
                      <div className="mono metric-val">{c.people_waiting}</div>
                      <div className="metric-lbl">waiting</div>
                    </div>
                    <div className="lane-metric-block">
                      <div className="mono metric-val">{c.wait_time_min}m</div>
                      <div className="metric-lbl">wait time</div>
                    </div>
                    <div className="lane-metric-block">
                      <div className="mono metric-val">{c.service_rate}</div>
                      <div className="metric-lbl">p/min rate</div>
                    </div>
                  </div>
                </div>

                {/* VISUAL CAPACITY BAR */}
                <div className="lane-progress-track">
                  <div
                    className={`lane-progress-fill ${c.status}`}
                    style={{ width: `${fillPct}%` }}
                  ></div>
                </div>

                {/* PHYSICAL CROWD DOTS GRID */}
                <div className="crowd-grid">
                  {dots.length > 0 ? (
                    dots.map((_, i) => (
                      <span key={i} className={`crowd-dot ${c.status}`}></span>
                    ))
                  ) : (
                    <span className="crowd-grid-empty">
                      {c.active ? "No queue currently forming at this counter" : "Counter is currently closed for operational maintenance"}
                    </span>
                  )}
                </div>

                {/* CONTROLS & SPEED ADJUSTMENT */}
                <div className="lane-footer-controls">
                  <div className="service-rate-controls">
                    <span className="control-label">Adjust Processing Speed:</span>
                    <button
                      className="btn btn-icon btn-secondary"
                      onClick={() => onUpdateServiceRate(c.id, Math.max(1.0, c.service_rate - 0.5))}
                      title="Decrease rate (-0.5)"
                      disabled={!c.active}
                    >
                      <Minus size={13} />
                    </button>
                    <span className="mono rate-display">{c.service_rate} /m</span>
                    <button
                      className="btn btn-icon btn-secondary"
                      onClick={() => onUpdateServiceRate(c.id, c.service_rate + 0.5)}
                      title="Increase rate (+0.5)"
                      disabled={!c.active}
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <button
                    className={`btn ${c.active ? 'btn-outline-danger' : 'btn-primary'}`}
                    onClick={() => onToggleCounter(c.id)}
                  >
                    {c.active ? "Close Counter" : "Open Counter"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
