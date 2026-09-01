import React from 'react';
import { Activity, Bell, BellOff, Pause, Play, Layers, BarChart3, Sliders, Cpu, Camera, ShieldCheck, RefreshCw } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  selectedFacility,
  onFacilityChange,
  snapshot,
  onTogglePause,
  audioEnabled,
  onToggleAudio,
  activeMode,
  onToggleMode
}) {
  const isPaused = snapshot?.is_paused || false;
  const simMinute = snapshot?.sim_minute || 0;
  const currentMode = snapshot?.active_mode || activeMode || "real_cv";

  const worstStatus = snapshot?.counters?.reduce((acc, c) => {
    if (!c.active) return acc;
    const rank = { normal: 0, watch: 1, critical: 2 };
    return rank[c.status] > rank[acc] ? c.status : acc;
  }, "normal") || "normal";

  // Derive dominant current data source across counters
  const sources = (snapshot?.counters || []).map(c => c.last_source || "simulation");
  let dominantSource = "SIMULATION";
  if (currentMode === "real_cv") {
    if (sources.includes("camera")) dominantSource = "LIVE CAMERA";
    else if (sources.includes("video")) dominantSource = "VIDEO FILE";
    else if (sources.includes("image")) dominantSource = "PHOTO IMAGE";
    else if (sources.includes("manual")) dominantSource = "MANUAL OVERRIDE";
    else if (sources.includes("csv")) dominantSource = "HISTORICAL CSV";
    else dominantSource = "REAL CV ACTIVE";
  }

  return (
    <header className="app-header">
      <div className="topbar">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            <ShieldCheck size={22} color="#FFFFFF" />
          </div>
          <div>
            <div className="brand-title">
              <h1>QueueWatch <span className="badge-ops">LIVE OPS</span></h1>
            </div>
            <p className="brand-sub">Real-Time Crowd Detection, Wait-Time Estimation &amp; Queue Operations Control</p>
          </div>
        </div>

        <div className="topbar-controls">
          {/* DATA SOURCE INDICATOR BADGE */}
          <div className="status-box" style={{ alignItems: "flex-start" }}>
            <span className="status-box-label">Data Source &amp; System Mode</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className={`lane-status-badge ${currentMode === 'real_cv' ? 'normal' : 'closed'}`}>
                <span className="status-dot"></span>
                {currentMode === 'real_cv' ? `REAL CV MODE (${dominantSource})` : 'DEMO SIMULATION MODE'}
              </span>
              <button
                className="btn btn-outline"
                onClick={() => onToggleMode(currentMode === 'real_cv' ? 'simulation' : 'real_cv')}
                style={{ padding: "3px 8px", fontSize: "11px" }}
                title="Switch between Real Computer Vision Mode and Demo Simulation Mode"
              >
                <RefreshCw size={11} /> {currentMode === 'real_cv' ? "Demo Mode" : "Real CV Mode"}
              </button>
            </div>
          </div>

          <div className="control-group">
            <label htmlFor="facility-select">Facility Profile</label>
            <select
              id="facility-select"
              className="custom-select"
              value={selectedFacility}
              onChange={(e) => onFacilityChange(e.target.value)}
            >
              <option value="airport">✈️ Airport Security Checkpoints</option>
              <option value="hospital">🏥 Hospital Emergency Triage</option>
              <option value="bank">🏦 Central Bank Tellers</option>
              <option value="retail">🛒 Supermarket Checkouts</option>
            </select>
          </div>

          <div className="status-box">
            <span className="status-box-label">System Flow Rating</span>
            <div className={`lane-status-badge ${worstStatus}`}>
              <span className="status-dot"></span>
              <span>{worstStatus === "critical" ? "OVERLOAD WARNING" : worstStatus === "watch" ? "BUILDOUT DETECTED" : "OPTIMAL FLOW"}</span>
            </div>
          </div>

          <div className="status-box">
            <span className="status-box-label">Clock</span>
            <div className="sim-clock-controls">
              <span className="mono sim-clock-time">t + {simMinute} min</span>
              <button
                onClick={onTogglePause}
                className="btn btn-icon btn-secondary"
                title={isPaused ? "Resume Operations Clock" : "Pause Operations Clock"}
              >
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
              </button>
              <button
                onClick={onToggleAudio}
                className={`btn btn-icon ${audioEnabled ? 'btn-active-audio' : 'btn-outline'}`}
                title="Toggle Audio Alerts"
              >
                {audioEnabled ? <Bell size={13} color="var(--accent-orange)" /> : <BellOff size={13} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* OPERATIONAL SECTION NAVIGATION TABS */}
      <nav className="main-nav">
        <button
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={15} /> 1. Overview Dashboard
        </button>
        <button
          className={`nav-tab ${activeTab === 'counters' ? 'active' : ''}`}
          onClick={() => setActiveTab('counters')}
        >
          <Layers size={15} /> 2. Live Counter Monitor
        </button>
        <button
          className={`nav-tab ${activeTab === 'predictor' ? 'active' : ''}`}
          onClick={() => setActiveTab('predictor')}
        >
          <Cpu size={15} /> 3. Predictive ML Studio
        </button>
        <button
          className={`nav-tab ${activeTab === 'vision' ? 'active' : ''}`}
          onClick={() => setActiveTab('vision')}
        >
          <Camera size={15} /> 4. Computer Vision Studio
        </button>
        <button
          className={`nav-tab ${activeTab === 'command' ? 'active' : ''}`}
          onClick={() => setActiveTab('command')}
        >
          <Sliders size={15} /> 5. Command Center &amp; Data Lab
        </button>
      </nav>
    </header>
  );
}
