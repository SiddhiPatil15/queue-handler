import React from 'react';
import { Cpu, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import TrendChart from './TrendChart';

export default function PredictorTab({
  snapshot,
  predictions,
  selectedModel,
  setSelectedModel,
  selectedHorizon,
  setSelectedHorizon
}) {
  if (!snapshot) return null;

  const alerts = (predictions || []).filter((p) => p.alert);
  const isRealCvMode = snapshot.active_mode === "real_cv";
  const totalObs = (snapshot.counters || []).reduce((acc, c) => acc + (c.observations_count || 0), 0);
  const needsMoreObs = isRealCvMode && totalObs < 3;

  return (
    <div className="tab-content">
      {/* REQUIREMENT 17: INSUFFICIENT REAL OBSERVATIONS CALLOUT */}
      {needsMoreObs && (
        <div className="card" style={{ background: "var(--accent-orange-bg)", borderColor: "var(--accent-orange-border)", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Info size={18} color="var(--accent-orange)" />
            <span style={{ fontSize: "12.5px", color: "var(--accent-orange-hover)", fontWeight: 600 }}>
              Not enough real-time observations for trend prediction. Continue collecting observations via Computer Vision Studio or Manual Override.
            </span>
          </div>
        </div>
      )}

      {/* MODEL CONTROLS & CHART */}
      <div className="card">
        <div className="card-header card-header-wrap">
          <div>
            <h2>Predictive Queue Forecasting Engine</h2>
            <p className="card-subtitle">Select predictive model algorithms and lookahead horizon</p>
          </div>

          <div className="predictor-controls-group">
            {/* MODEL SELECTOR TABS */}
            <div className="model-tab-group">
              <button
                className={`tab-btn ${selectedModel === 'linear' ? 'active' : ''}`}
                onClick={() => setSelectedModel('linear')}
              >
                Linear (OLS)
              </button>
              <button
                className={`tab-btn ${selectedModel === 'ewma' ? 'active' : ''}`}
                onClick={() => setSelectedModel('ewma')}
              >
                EWMA Smoothing
              </button>
              <button
                className={`tab-btn ${selectedModel === 'rf' ? 'active' : ''}`}
                onClick={() => setSelectedModel('rf')}
              >
                Feature Estimator
              </button>
            </div>

            {/* HORIZON SELECTOR */}
            <div className="horizon-group">
              <span className="horizon-label">Horizon:</span>
              {[10, 20, 30].map((h) => (
                <button
                  key={h}
                  className={`horizon-btn ${selectedHorizon === h ? 'active' : ''}`}
                  onClick={() => setSelectedHorizon(h)}
                >
                  {h}m
                </button>
              ))}
            </div>
          </div>
        </div>

        <TrendChart
          snapshot={snapshot}
          predictions={predictions}
          selectedModel={selectedModel}
          selectedHorizon={selectedHorizon}
        />
      </div>

      {/* TWO COLUMN PREDICTIVE MATRIX & ALERTS */}
      <div className="dashboard-grid">
        {/* LEFT: MULTI-INTERVAL LOOKAHEAD MATRIX */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Multi-Interval Buildup Forecast</h2>
              <p className="card-subtitle">Short-term predictions at 5, 10, 15 &amp; 20 min lookaheads</p>
            </div>
            <span className="model-badge">{selectedModel.toUpperCase()} Model</span>
          </div>

          <div className="table-responsive">
            <table className="breakdown-table">
              <thead>
                <tr>
                  <th>Counter Name</th>
                  <th>Current Queue</th>
                  <th>+5 Min</th>
                  <th>+10 Min</th>
                  <th>+15 Min</th>
                  <th>+20 Min</th>
                  <th>Growth Rate</th>
                </tr>
              </thead>
              <tbody>
                {(predictions || []).map((p) => {
                  const counterObj = (snapshot.counters || []).find((c) => c.id === p.id) || {};
                  const intervals = p.intervals || {};
                  const growth = p.slope > 0 ? `+${p.slope}/m` : `${p.slope}/m`;
                  const growthClass = p.slope > 0.3 ? "val-rising" : p.slope > 0 ? "val-watch" : "val-steady";

                  return (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td className="mono">{counterObj.people_waiting ?? 0}</td>
                      <td className="mono">{intervals["5_min"] ?? p.predicted_people}</td>
                      <td className="mono">{intervals["10_min"] ?? p.predicted_people}</td>
                      <td className="mono">{intervals["15_min"] ?? p.predicted_people}</td>
                      <td className="mono">{intervals["20_min"] ?? p.predicted_people}</td>
                      <td><span className={`growth-pill ${growthClass}`}>{growth}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: PREDICTIVE ALERTS */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Predictive Capacity Alerts</h2>
              <p className="card-subtitle">Overload threshold warnings &amp; ETA triggers</p>
            </div>
          </div>

          <div className="alerts-feed">
            {alerts.length > 0 ? (
              alerts.map((p, idx) => (
                <div
                  key={idx}
                  className="alert-item"
                >
                  <AlertTriangle size={16} className="alert-item-icon" />
                  <div>
                    <strong>{p.name}:</strong> {p.alert}
                  </div>
                </div>
              ))
            ) : (
              <div className="alert-item-empty">
                <CheckCircle size={16} color="var(--healthy-text)" />
                All active counters are projected to remain within safe operating capacities.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
