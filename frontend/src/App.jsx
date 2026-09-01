import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import OverviewTab from './components/OverviewTab';
import CountersTab from './components/CountersTab';
import PredictorTab from './components/PredictorTab';
import CommandTab from './components/CommandTab';
import VisionTab from './components/VisionTab';
import { playAlertSound } from './utils/audio';

const POLL_INTERVAL_MS = 3000;

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFacility, setSelectedFacility] = useState('airport');
  const [selectedModel, setSelectedModel] = useState('linear');
  const [selectedHorizon, setSelectedHorizon] = useState(20);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const [snapshot, setSnapshot] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [history, setHistory] = useState([]);

  // Fetch wrapper
  const apiFetch = async (url, options = {}) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const res = await fetch(baseUrl + url, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API Error (${res.status}): ${errText}`);
    }
    return res.json();
  };

  const refreshDashboard = useCallback(async () => {
    try {
      const params = `?model=${selectedModel}&horizon=${selectedHorizon}`;
      const [stateRes, predRes, recRes, histRes] = await Promise.all([
        apiFetch('/api/state'),
        apiFetch(`/api/prediction${params}`),
        apiFetch(`/api/recommendation${params}`),
        apiFetch('/api/history'),
      ]);

      setSnapshot(stateRes);
      setPredictions(predRes.predictions || []);
      setRecommendation(recRes);
      setHistory(histRes.history || []);

      if (recRes && (recRes.priority === 'critical' || recRes.priority === 'high')) {
        playAlertSound(audioEnabled);
      }
    } catch (err) {
      console.error("Failed to refresh dashboard:", err);
    }
  }, [selectedModel, selectedHorizon, audioEnabled]);

  useEffect(() => {
    refreshDashboard();
    const interval = setInterval(refreshDashboard, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshDashboard]);

  // Handlers
  const handleFacilityChange = async (newKey) => {
    setSelectedFacility(newKey);
    await apiFetch('/api/control', {
      method: 'POST',
      body: JSON.stringify({ action: 'preset', facility_key: newKey })
    });
    refreshDashboard();
  };

  const handleTogglePause = async () => {
    await apiFetch('/api/control', {
      method: 'POST',
      body: JSON.stringify({ action: 'pause' })
    });
    refreshDashboard();
  };

  const handleToggleMode = async (newMode) => {
    try {
      await apiFetch('/api/mode/set', {
        method: 'POST',
        body: JSON.stringify({ mode: newMode })
      });
      await refreshDashboard();
    } catch (err) {
      console.error("Failed to toggle mode:", err);
    }
  };

  const handleInjectSurge = async () => {
    await apiFetch('/api/control', {
      method: 'POST',
      body: JSON.stringify({ action: 'surge', amount: 3.5 })
    });
    refreshDashboard();
  };

  const handleAddLane = async () => {
    await apiFetch('/api/control', {
      method: 'POST',
      body: JSON.stringify({ action: 'add_counter' })
    });
    refreshDashboard();
  };

  const handleToggleCounter = async (counterId) => {
    await apiFetch('/api/control', {
      method: 'POST',
      body: JSON.stringify({ action: 'toggle', counter_id: counterId })
    });
    refreshDashboard();
  };

  const handleUpdateServiceRate = async (counterId, newRate) => {
    await apiFetch('/api/control', {
      method: 'POST',
      body: JSON.stringify({ action: 'rate', counter_id: counterId, rate: newRate })
    });
    refreshDashboard();
  };

  const handleSetQueueCount = async (counterId, peopleCount) => {
    try {
      await apiFetch('/api/queue/set', {
        method: 'POST',
        body: JSON.stringify({ counter_id: counterId, people_count: Number(peopleCount) })
      });
      await refreshDashboard();
    } catch (err) {
      alert(`Failed to set queue count: ${err.message}`);
    }
  };

  const handleExecuteRecommendation = async () => {
    if (!recommendation || !recommendation.executable) return;
    await apiFetch('/api/action/execute', {
      method: 'POST',
      body: JSON.stringify({
        action_type: recommendation.action_type,
        payload: recommendation.payload
      })
    });
    refreshDashboard();
  };

  const handleUploadCsv = async (filename, content) => {
    try {
      if (filename.endsWith('.json')) {
        const parsed = JSON.parse(content);
        await apiFetch('/api/data/upload', {
          method: 'POST',
          body: JSON.stringify({ state: Array.isArray(parsed) ? parsed : parsed.counters })
        });
      } else {
        await apiFetch('/api/data/upload', {
          method: 'POST',
          body: JSON.stringify({ csv_text: content })
        });
      }
      refreshDashboard();
      alert(`Loaded historical test dataset: ${filename}`);
    } catch (err) {
      alert(`Error loading data: ${err.message}`);
    }
  };

  const handleExportCsv = () => {
    window.location.href = '/api/export';
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedFacility={selectedFacility}
        onFacilityChange={handleFacilityChange}
        snapshot={snapshot}
        onTogglePause={handleTogglePause}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        activeMode={snapshot?.active_mode}
        onToggleMode={handleToggleMode}
      />

      {activeTab === 'overview' && (
        <OverviewTab
          snapshot={snapshot}
          predictions={predictions}
          recommendation={recommendation}
          selectedModel={selectedModel}
          selectedHorizon={selectedHorizon}
          onInjectSurge={handleInjectSurge}
          onAddLane={handleAddLane}
          onExportCsv={handleExportCsv}
          onExecuteRecommendation={handleExecuteRecommendation}
        />
      )}

      {activeTab === 'counters' && (
        <CountersTab
          snapshot={snapshot}
          onToggleCounter={handleToggleCounter}
          onUpdateServiceRate={handleUpdateServiceRate}
          onSetQueueCount={handleSetQueueCount}
        />
      )}

      {activeTab === 'predictor' && (
        <PredictorTab
          snapshot={snapshot}
          predictions={predictions}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          selectedHorizon={selectedHorizon}
          setSelectedHorizon={setSelectedHorizon}
        />
      )}

      {activeTab === 'vision' && (
        <VisionTab
          snapshot={snapshot}
          onSetQueueCount={handleSetQueueCount}
          onRefreshDashboard={refreshDashboard}
        />
      )}

      {activeTab === 'command' && (
        <CommandTab
          recommendation={recommendation}
          onExecuteRecommendation={handleExecuteRecommendation}
          history={history}
          onUploadCsv={handleUploadCsv}
          onExportCsv={handleExportCsv}
        />
      )}

      <footer className="footer">
        <p>🚀 QueueWatch — Real-Time Crowd Detection, Wait-Time Estimation &amp; Queue Operations Control System</p>
      </footer>
    </div>
  );
}
