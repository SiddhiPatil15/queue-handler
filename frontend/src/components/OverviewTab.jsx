import React from 'react';
import { Zap, PlusCircle, Download, CheckCircle2, AlertTriangle, AlertCircle, Users, Clock, Flame, ShieldCheck, TrendingUp, ArrowRight } from 'lucide-react';
import TrendChart from './TrendChart';
import RiskPanel from './RiskPanel';

export default function OverviewTab({
  snapshot,
  predictions,
  recommendation,
  selectedModel,
  selectedHorizon,
  onInjectSurge,
  onAddLane,
  onExportCsv,
  onExecuteRecommendation,
  risks,
  cameraHealth
}) {
  if (!snapshot) return <div className="loading-state">Loading overview metrics...</div>;

  const summary = snapshot.summary || {};
  const activeCounters = (snapshot.counters || []).filter((c) => c.active);
  const busiest = activeCounters.length
    ? activeCounters.reduce((a, b) => (b.wait_time_min > a.wait_time_min ? b : a))
    : { name: "N/A", wait_time_min: 0 };
  const normalCount = activeCounters.filter((c) => c.status === "normal").length;

  // Threshold alerts from predictions
  const thresholdAlerts = (predictions || []).filter((p) => p.alert);
  const priority = recommendation?.priority || "normal";
  const executable = recommendation?.executable || false;

  return (
    <div className="tab-content">
      {/* QUICK ACTION BAR */}
      <div className="control-bar">
        <div className="control-bar-left">
          <button className="btn btn-warning" onClick={onInjectSurge}>
            <Zap size={16} /> Inject Crowd Surge (+3.5/min)
          </button>
          <button className="btn btn-secondary" onClick={onAddLane}>
            <PlusCircle size={16} /> Open Backup Operational Lane
          </button>
        </div>
        <div className="control-bar-right">
          <button className="btn btn-primary" onClick={onExportCsv}>
            <Download size={16} /> Export Live CSV Report
          </button>
        </div>
      </div>

      {/* KPI RIBBON */}
      <div className="stats-ribbon">
        <div className={`stat-card ${summary.total_waiting > 45 ? 'stat-critical' : summary.total_waiting > 25 ? 'stat-warning' : 'stat-healthy'}`}>
          <div className="stat-card-header">
            <span className="stat-icon-wrapper crowd-icon"><Users size={18} /></span>
            <span className={`stat-badge ${summary.total_waiting > 45 ? 'critical' : summary.total_waiting > 25 ? 'watch' : 'normal'}`}>
              {summary.total_waiting > 45 ? 'High Volume' : summary.total_waiting > 25 ? 'Moderate' : 'Normal'}
            </span>
          </div>
          <div className="stat-value mono">{summary.total_waiting}</div>
          <div className="stat-label">Total Waiting Crowd</div>
        </div>

        <div className={`stat-card ${summary.avg_wait_min >= 15 ? 'stat-critical' : summary.avg_wait_min >= 8 ? 'stat-warning' : 'stat-healthy'}`}>
          <div className="stat-card-header">
            <span className="stat-icon-wrapper wait-icon"><Clock size={18} /></span>
            <span className={`stat-badge ${summary.avg_wait_min >= 15 ? 'critical' : summary.avg_wait_min >= 8 ? 'watch' : 'normal'}`}>
              {summary.avg_wait_min >= 15 ? 'Heavy Delay' : summary.avg_wait_min >= 8 ? 'Moderate' : 'Fast Flow'}
            </span>
          </div>
          <div className="stat-value mono">{summary.avg_wait_min}m</div>
          <div className="stat-label">System Average Wait Time</div>
        </div>

        <div className={`stat-card ${busiest.wait_time_min >= 15 ? 'stat-critical' : 'stat-healthy'}`}>
          <div className="stat-card-header">
            <span className="stat-icon-wrapper peak-icon"><Flame size={18} /></span>
            <span className="stat-badge neutral">{busiest.wait_time_min}m wait</span>
          </div>
          <div className="stat-value mono stat-value-text">{busiest.name}</div>
          <div className="stat-label">Peak Wait Lane</div>
        </div>

        <div className="stat-card stat-healthy">
          <div className="stat-card-header">
            <span className="stat-icon-wrapper counter-icon"><ShieldCheck size={18} /></span>
            <span className="stat-badge normal">Ratio</span>
          </div>
          <div className="stat-value mono">{normalCount} / {activeCounters.length}</div>
          <div className="stat-label">Optimal Active Counter Ratio</div>
        </div>
      </div>

      {/* RISK PANEL */}
      <RiskPanel risks={risks} cameraHealth={cameraHealth} />

      {/* THRESHOLD PREDICTION ALERTS — shown when queues are forecast to exceed capacity */}
      {thresholdAlerts.length > 0 && (
        <div className="overview-alert-strip">
          <div className="overview-alert-icon"><TrendingUp size={16} /></div>
          <div className="overview-alert-content">
            <span className="overview-alert-title">Predictive Capacity Warning</span>
            {thresholdAlerts.map((p, i) => (
              <span key={i} className="overview-alert-text">{p.alert}</span>
            ))}
          </div>
        </div>
      )}

      {/* AI OPERATIONAL RECOMMENDATION — prominent panel on the main dashboard */}
      {recommendation && (
        <div className={`overview-recommendation priority-${priority}`}>
          <div className="overview-rec-left">
            <div className="overview-rec-label">
              <Zap size={14} />
              SYSTEM RECOMMENDATION &nbsp;·&nbsp;
              <span className={`rec-priority-tag ${priority}`}>{priority.toUpperCase()} PRIORITY</span>
            </div>
            <div className="overview-rec-action">{recommendation.action}</div>
            <div className="overview-rec-reason">{recommendation.reason}</div>
          </div>
          {executable && (
            <button className="btn btn-execute overview-rec-btn" onClick={onExecuteRecommendation}>
              <ArrowRight size={15} /> Execute
            </button>
          )}
        </div>
      )}

      {/* TWO COLUMN OVERVIEW LAYOUT */}
      <div className="dashboard-grid">
        {/* LEFT: MAIN OVERVIEW CHART */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Facility Crowd Flow Overview</h2>
              <p className="card-subtitle">Real-time throughput tracking across active service counters</p>
            </div>
            <span className="facility-pill">{snapshot.facility_name}</span>
          </div>
          <TrendChart
            snapshot={snapshot}
            predictions={predictions}
            selectedModel={selectedModel}
            selectedHorizon={selectedHorizon}
          />
        </div>

        {/* RIGHT: COUNTER SNAPSHOT CARDS */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Counter Status Summary</h2>
              <p className="card-subtitle">Live occupancy &amp; service rate distribution</p>
            </div>
          </div>

          <div className="counter-summary-list">
            {(snapshot.counters || []).map((c) => {
              const sourceLabel = c.last_source
                ? c.last_source.toUpperCase().replace('_', ' ')
                : 'SIM';
              return (
                <div
                  key={c.id}
                  className={`counter-summary-row ${c.status} ${!c.active ? 'is-closed' : ''}`}
                >
                  <div className="counter-summary-left">
                    <div className="counter-summary-title">
                      {c.status === "normal" && <CheckCircle2 size={16} className="icon-status-normal" />}
                      {c.status === "watch" && <AlertTriangle size={16} className="icon-status-watch" />}
                      {c.status === "critical" && <AlertCircle size={16} className="icon-status-critical" />}
                      <span>{c.name}</span>
                    </div>
                    <div className="counter-summary-sub">
                      Rate: <strong>{c.service_rate}</strong> p/min
                      {' '}&middot;{' '}
                      <span className="source-inline-tag">{sourceLabel}</span>
                      {!c.active && ' · Closed'}
                    </div>
                  </div>

                  <div className="counter-summary-right">
                    <div className="mono counter-summary-count">{c.people_waiting} waiting</div>
                    <div className="counter-summary-wait">Est. {c.wait_time_min}m wait</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
