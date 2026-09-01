import React, { useState, useEffect, useRef } from 'react';
import { Camera, Eye, Upload, Cpu, Video, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, Zap, ShieldCheck, Play, Square, Info } from 'lucide-react';

export default function VisionTab({ snapshot, onSetQueueCount, onRefreshDashboard }) {
  const [activeInputMode, setActiveInputMode] = useState('photo'); // 'photo' | 'video' | 'camera' | 'demo'
  const [selectedCounterId, setSelectedCounterId] = useState('');
  
  // Photo State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isPhotoAnalyzing, setIsPhotoAnalyzing] = useState(false);
  const [photoResult, setPhotoResult] = useState(null);

  // Video State
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [isVideoAnalyzing, setIsVideoAnalyzing] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoResult, setVideoResult] = useState(null);

  // Live Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraDetecting, setIsCameraDetecting] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [liveCameraResult, setLiveCameraResult] = useState(null);
  const videoRef = useRef(null);
  const cameraIntervalRef = useRef(null);

  // General State
  const [useRoi, setUseRoi] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Demo CCTV Stream state
  const [cvState, setCvState] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const canvasRef = useRef(null);

  const photoFileInputRef = useRef(null);
  const videoFileInputRef = useRef(null);

  const counters = snapshot?.counters || [];
  const activeCounters = counters.filter(c => c.active);
  const targetCounterId = selectedCounterId || (activeCounters[0]?.id || counters[0]?.id || 'c1');
  const targetCounter = counters.find(c => c.id === targetCounterId) || counters[0] || {};

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Fetch synthetic CV demo stream if in demo mode
  useEffect(() => {
    if (activeInputMode !== 'demo') return;
    const fetchCv = async () => {
      try {
        const res = await fetch("/api/cv/state");
        if (res.ok) {
          const data = await res.json();
          setCvState(data);
        }
      } catch (err) {
        console.error("Failed to fetch CV state:", err);
      }
    };

    fetchCv();
    const interval = setInterval(fetchCv, 1500);
    return () => clearInterval(interval);
  }, [activeInputMode]);

  // Handle Photo File Select
  const handlePhotoSelect = (file) => {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage("Unsupported image format. Upload JPG, PNG, or WEBP.");
      return;
    }
    setErrorMessage(null);
    setPhotoFile(file);
    setPhotoResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // Run Real Photo YOLO Detection
  const handleAnalyzePhoto = async () => {
    if (!photoFile) {
      setErrorMessage("Please select a queue photo first.");
      return;
    }
    setIsPhotoAnalyzing(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("image", photoFile);
      formData.append("counter_id", targetCounterId);
      if (useRoi) {
        formData.append("roi", JSON.stringify({ x: 0, y: 0, width: 2000, height: 2000 }));
      }

      const res = await fetch("/api/cv/analyze-image", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze photo.");
      }

      setPhotoResult(data);
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsPhotoAnalyzing(false);
    }
  };

  // Handle Video File Select
  const handleVideoSelect = (file) => {
    if (!file) return;
    const validTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(mp4|avi|mov|webm)$/i)) {
      setErrorMessage("Unsupported video format. Upload MP4, AVI, MOV, or WEBM.");
      return;
    }
    setErrorMessage(null);
    setVideoFile(file);
    setVideoResult(null);
    setVideoPreview(URL.createObjectURL(file));
  };

  // Run Real Video YOLO + ByteTrack Analysis
  const handleAnalyzeVideo = async () => {
    if (!videoFile) {
      setErrorMessage("Please select a queue video first.");
      return;
    }
    setIsVideoAnalyzing(true);
    setVideoProgress(15);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("counter_id", targetCounterId);
      if (useRoi) {
        formData.append("roi", JSON.stringify({ x: 0, y: 0, width: 2000, height: 2000 }));
      }

      const progressInterval = setInterval(() => {
        setVideoProgress(p => (p < 90 ? p + 10 : p));
      }, 400);

      const res = await fetch("/api/cv/analyze-video", {
        method: "POST",
        body: formData
      });

      clearInterval(progressInterval);
      setVideoProgress(100);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze video.");
      }

      setVideoResult(data);
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsVideoAnalyzing(false);
    }
  };

  // Start Live Webcam
  const startCamera = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setErrorMessage(`Camera Permission Error: ${err.message}. Please allow camera access in your browser.`);
    }
  };

  // Stop Live Webcam
  const stopCamera = () => {
    if (cameraIntervalRef.current) {
      clearInterval(cameraIntervalRef.current);
      cameraIntervalRef.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setIsCameraDetecting(false);
  };

  // Start Live Frame Detection Loop
  const toggleLiveDetection = () => {
    if (isCameraDetecting) {
      if (cameraIntervalRef.current) {
        clearInterval(cameraIntervalRef.current);
        cameraIntervalRef.current = null;
      }
      setIsCameraDetecting(false);
    } else {
      setIsCameraDetecting(true);
      captureAndSendFrame();
      cameraIntervalRef.current = setInterval(captureAndSendFrame, 1500);
    }
  };

  // Capture Canvas Frame & Send to API
  const captureAndSendFrame = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frameBase64 = canvas.toDataURL("image/jpeg", 0.85);

    try {
      const res = await fetch("/api/cv/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: frameBase64,
          counter_id: targetCounterId,
          roi: useRoi ? { x: 0, y: 0, width: 2000, height: 2000 } : null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setLiveCameraResult(data);
        if (onRefreshDashboard) await onRefreshDashboard();
      }
    } catch (err) {
      console.error("Live frame upload error:", err);
    }
  };

  // Canvas renderer for Synthetic Demo Mode
  useEffect(() => {
    if (activeInputMode !== 'demo') return;
    const canvas = canvasRef.current;
    if (!canvas || !cvState) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#0F172A";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    if (showHeatmap) {
      const grad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width / 2);
      grad.addColorStop(0, "rgba(239, 68, 68, 0.35)");
      grad.addColorStop(0.5, "rgba(245, 158, 11, 0.2)");
      grad.addColorStop(1, "rgba(16, 185, 129, 0.05)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    const vCounters = cvState.vision_counters || [];
    vCounters.forEach((vc, idx) => {
      const roiX = 20 + idx * 165;
      const roiY = 40;
      const roiW = 150;
      const roiH = 300;

      ctx.strokeStyle = vc.density_level === "High" ? "#EF4444" : vc.density_level === "Medium" ? "#F59E0B" : "#10B981";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(roiX, roiY, roiW, roiH);
      ctx.setLineDash([]);

      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = "600 11px 'IBM Plex Mono', monospace";
      ctx.fillText(`ROI: ${vc.counter_name.split(" ")[0]} (${vc.detected_heads} Heads)`, roiX + 6, roiY + 16);

      const boxes = vc.bounding_boxes || [];
      boxes.forEach((b) => {
        const boxX = roiX + 12 + (b.x % 110);
        const boxY = roiY + 30 + (b.y % 230);
        ctx.strokeStyle = "#EA580C";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(boxX, boxY, 28, 34);
      });
    });

    ctx.fillStyle = "#10B981";
    ctx.font = "600 12px 'IBM Plex Mono', monospace";
    ctx.fillText(`REC ● DEMO SIMULATION STREAM`, 14, 24);
  }, [cvState, showHeatmap, activeInputMode]);

  return (
    <div className="tab-content">
      {/* INPUT METHOD SWITCHER */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div className="card-header card-header-wrap" style={{ marginBottom: 0 }}>
          <div>
            <h2>Computer Vision (CV) Crowd Detection Studio</h2>
            <p className="card-subtitle">Select input method to measure actual crowd headcount using YOLOv8 computer vision</p>
          </div>

          <div className="model-tab-group">
            <button
              className={`tab-btn ${activeInputMode === 'photo' ? 'active' : ''}`}
              onClick={() => setActiveInputMode('photo')}
            >
              📷 Photo Analysis
            </button>
            <button
              className={`tab-btn ${activeInputMode === 'video' ? 'active' : ''}`}
              onClick={() => setActiveInputMode('video')}
            >
              🎥 Video Analysis
            </button>
            <button
              className={`tab-btn ${activeInputMode === 'camera' ? 'active' : ''}`}
              onClick={() => setActiveInputMode('camera')}
            >
              📹 Live Camera
            </button>
            <button
              className={`tab-btn ${activeInputMode === 'demo' ? 'active' : ''}`}
              onClick={() => setActiveInputMode('demo')}
            >
              🖥️ Demo Simulation
            </button>
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {errorMessage && (
        <div className="alert-item" style={{ background: "var(--critical-bg)", borderColor: "var(--critical-border)", color: "var(--critical-text)", marginBottom: "20px" }}>
          <AlertCircle size={16} /> {errorMessage}
        </div>
      )}

      {/* 1. PHOTO ANALYSIS MODE */}
      {activeInputMode === 'photo' && (
        <>
          <div className="card">
            <div className="card-header">
              <div>
                <h2>Real Photo Crowd Analysis</h2>
                <p className="card-subtitle">Upload a photo to run YOLOv8 person detection and calculate actual queue headcount</p>
              </div>
              <span className="model-badge">YOLOv8n (Person Class Only)</span>
            </div>

            <div className="dashboard-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Target Counter / Lane:</label>
                  <select
                    className="custom-select"
                    value={targetCounterId}
                    onChange={(e) => setSelectedCounterId(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {counters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.people_waiting} currently waiting {!c.active ? '• CLOSED' : ''})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="checkbox"
                    id="photo-roi-check"
                    checked={useRoi}
                    onChange={(e) => setUseRoi(e.target.checked)}
                    style={{ cursor: "pointer", width: "16px", height: "16px" }}
                  />
                  <label htmlFor="photo-roi-check" style={{ fontSize: "12.5px", color: "var(--text-secondary)", cursor: "pointer" }}>
                    Filter detections using Queue Region of Interest (ROI)
                  </label>
                </div>

                <div className="dropzone-area" onClick={() => photoFileInputRef.current && photoFileInputRef.current.click()}>
                  <Upload size={32} className="dropzone-icon" />
                  <div className="dropzone-title">
                    {photoFile ? photoFile.name : "Choose Queue Photo or Drag & Drop"}
                  </div>
                  <div className="dropzone-sub">Supported Formats: JPG, JPEG, PNG, WEBP</div>
                  <input
                    type="file"
                    ref={photoFileInputRef}
                    accept=".jpg, .jpeg, .png, .webp"
                    style={{ display: "none" }}
                    onChange={(e) => handlePhotoSelect(e.target.files[0])}
                  />
                </div>

                <button
                  className="btn btn-warning"
                  onClick={handleAnalyzePhoto}
                  disabled={isPhotoAnalyzing || !photoFile}
                  style={{ padding: "12px 20px", justifyContent: "center", fontSize: "14px" }}
                >
                  <Cpu size={16} />
                  {isPhotoAnalyzing ? "Running YOLO Person Detection..." : "ANALYZE CROWD PHOTO"}
                </button>
              </div>

              {/* PHOTO PREVIEW */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "center", alignItems: "center", background: "var(--bg-subtle)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "16px", minHeight: "260px" }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Queue photo preview" style={{ maxWidth: "100%", maxHeight: "280px", borderRadius: "6px", objectFit: "contain" }} />
                ) : (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12.5px" }}>
                    <Camera size={36} style={{ marginBottom: "8px", opacity: 0.4 }} />
                    <p>Photo preview will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PHOTO RESULTS DISPLAY */}
          {photoResult && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>YOLO Photo Person Detection Results</h2>
                  <p className="card-subtitle">Detected headcount propagated directly to counter queue state</p>
                </div>
                <span className="lane-status-badge normal">Source: PHOTO IMAGE</span>
              </div>

              <div className="stats-ribbon" style={{ marginBottom: "20px" }}>
                <div className="stat-card">
                  <div className="stat-value mono">{photoResult.people_count}</div>
                  <div className="stat-label">People Detected</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value mono">{Math.round(photoResult.average_confidence * 100)}%</div>
                  <div className="stat-label">Average Confidence</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value mono">{photoResult.inference_time_ms} ms</div>
                  <div className="stat-label">Processing Time</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value mono">{photoResult.estimated_wait_minutes} min</div>
                  <div className="stat-label">Estimated Wait ({photoResult.counter_name})</div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "10px", color: "var(--text-primary)" }}>
                  Processed Image with YOLO Bounding Boxes
                </h3>
                <div style={{ background: "#0F172A", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "12px", textAlign: "center" }}>
                  <img src={photoResult.processed_image} alt="YOLO detection visualization" style={{ maxWidth: "100%", maxHeight: "480px", borderRadius: "6px", objectFit: "contain" }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 2. VIDEO ANALYSIS MODE */}
      {activeInputMode === 'video' && (
        <>
          <div className="card">
            <div className="card-header">
              <div>
                <h2>Real Video Crowd Analysis &amp; Object Tracking</h2>
                <p className="card-subtitle">Upload queue video for frame-by-frame YOLO detection and ByteTrack unique person tracking</p>
              </div>
              <span className="model-badge">YOLOv8 + ByteTrack Tracker</span>
            </div>

            <div className="dashboard-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Target Counter / Lane:</label>
                  <select
                    className="custom-select"
                    value={targetCounterId}
                    onChange={(e) => setSelectedCounterId(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {counters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.people_waiting} currently waiting {!c.active ? '• CLOSED' : ''})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="dropzone-area" onClick={() => videoFileInputRef.current && videoFileInputRef.current.click()}>
                  <Video size={32} className="dropzone-icon" />
                  <div className="dropzone-title">
                    {videoFile ? videoFile.name : "Choose Queue Video or Drag & Drop"}
                  </div>
                  <div className="dropzone-sub">Supported Formats: MP4, AVI, MOV, WEBM</div>
                  <input
                    type="file"
                    ref={videoFileInputRef}
                    accept=".mp4, .avi, .mov, .webm"
                    style={{ display: "none" }}
                    onChange={(e) => handleVideoSelect(e.target.files[0])}
                  />
                </div>

                {isVideoAnalyzing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                      <span>Tracking video objects frame-by-frame...</span>
                      <span>{videoProgress}%</span>
                    </div>
                    <div className="lane-progress-track">
                      <div className="lane-progress-fill" style={{ width: `${videoProgress}%`, background: "var(--accent-orange)" }}></div>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-warning"
                  onClick={handleAnalyzeVideo}
                  disabled={isVideoAnalyzing || !videoFile}
                  style={{ padding: "12px 20px", justifyContent: "center", fontSize: "14px" }}
                >
                  <Cpu size={16} />
                  {isVideoAnalyzing ? "Processing Video Frames & Tracking Objects..." : "START VIDEO ANALYSIS"}
                </button>
              </div>

              {/* VIDEO PREVIEW */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "center", alignItems: "center", background: "var(--bg-subtle)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "16px", minHeight: "260px" }}>
                {videoPreview ? (
                  <video src={videoPreview} controls style={{ maxWidth: "100%", maxHeight: "280px", borderRadius: "6px" }} />
                ) : (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12.5px" }}>
                    <Video size={36} style={{ marginBottom: "8px", opacity: 0.4 }} />
                    <p>Video preview will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VIDEO RESULTS DISPLAY */}
          {videoResult && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Video Crowd &amp; Tracking Telemetry</h2>
                  <p className="card-subtitle">ByteTrack object tracking avoids double-counting individuals across frames</p>
                </div>
                <span className="lane-status-badge normal">Source: VIDEO FILE</span>
              </div>

              <div className="stats-ribbon" style={{ marginBottom: "20px" }}>
                <div className="stat-card">
                  <div className="stat-value mono">{videoResult.people_count}</div>
                  <div className="stat-label">Current Visible People</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value mono">{videoResult.peak_people}</div>
                  <div className="stat-label">Peak Crowd Visible</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value mono">{videoResult.average_people}</div>
                  <div className="stat-label">Average Visible Crowd</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value mono">{videoResult.unique_people_seen}</div>
                  <div className="stat-label">Unique Person Track IDs</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value mono">{videoResult.estimated_wait_minutes} min</div>
                  <div className="stat-label">Estimated Wait Time</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value mono">{videoResult.video_duration_sec}s</div>
                  <div className="stat-label">Video Duration</div>
                </div>
              </div>

              {videoResult.processed_image && (
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "10px", color: "var(--text-primary)" }}>
                    Keyframe Tracking Visualization (ByteTrack Track IDs)
                  </h3>
                  <div style={{ background: "#0F172A", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "12px", textAlign: "center" }}>
                    <img src={videoResult.processed_image} alt="ByteTrack person tracking preview" style={{ maxWidth: "100%", maxHeight: "480px", borderRadius: "6px", objectFit: "contain" }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 3. LIVE CAMERA MODE */}
      {activeInputMode === 'camera' && (
        <div className="card">
          <div className="card-header card-header-wrap">
            <div>
              <h2>Live Webcam Crowd Monitor</h2>
              <p className="card-subtitle">Connect your browser webcam to stream frames for real-time YOLO person detection</p>
            </div>

            <div className="vision-actions-group">
              {!isCameraActive ? (
                <button className="btn btn-warning" onClick={startCamera}>
                  <Camera size={16} /> Enable Webcam
                </button>
              ) : (
                <>
                  <button
                    className={`btn ${isCameraDetecting ? 'btn-outline-danger' : 'btn-primary'}`}
                    onClick={toggleLiveDetection}
                  >
                    {isCameraDetecting ? <Square size={14} /> : <Play size={14} />}
                    {isCameraDetecting ? "Stop Detection" : "Start Live Detection"}
                  </button>
                  <button className="btn btn-outline" onClick={stopCamera}>
                    Disconnect Camera
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="dashboard-grid" style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Target Counter / Lane:</label>
                <select
                  className="custom-select"
                  value={targetCounterId}
                  onChange={(e) => setSelectedCounterId(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {counters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.people_waiting} currently waiting {!c.active ? '• CLOSED' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* LIVE METRICS RIBBON */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="stat-card" style={{ padding: "12px 14px" }}>
                  <div className="stat-value mono">{liveCameraResult ? liveCameraResult.people_count : 0}</div>
                  <div className="stat-label">Live Crowd Count</div>
                </div>
                <div className="stat-card" style={{ padding: "12px 14px" }}>
                  <div className="stat-value mono">{liveCameraResult ? liveCameraResult.estimated_wait_minutes : 0} m</div>
                  <div className="stat-label">Estimated Wait</div>
                </div>
              </div>
            </div>

            {/* LIVE WEBCAM VIEWER */}
            <div style={{ background: "#0F172A", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "12px", textAlign: "center", position: "relative", minHeight: "280px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", maxHeight: "320px", borderRadius: "4px", display: isCameraActive ? "block" : "none" }}
              />
              {!isCameraActive && (
                <div style={{ color: "#94A3B8", fontSize: "13px" }}>
                  <Camera size={40} style={{ marginBottom: "8px", opacity: 0.5 }} />
                  <p>Webcam is currently disabled.</p>
                  <p style={{ fontSize: "11px", opacity: 0.7, marginTop: "4px" }}>Click "Enable Webcam" above to grant permission.</p>
                </div>
              )}
              {isCameraDetecting && (
                <div style={{ position: "absolute", top: "20px", left: "20px", background: "rgba(220, 38, 38, 0.9)", color: "#FFFFFF", padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em" }}>
                  REC ● LIVE DETECTION ACTIVE
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. DEMO SIMULATION MODE */}
      {activeInputMode === 'demo' && (
        <div className="card">
          <div className="card-header card-header-wrap">
            <div>
              <h2>Synthetic CCTV Demo Camera Feed</h2>
              <p className="card-subtitle">Demonstration multi-camera synthetic stream analytics and bounding box coordinate simulation</p>
            </div>
            <button className={`btn ${showHeatmap ? 'btn-warning' : 'btn-secondary'}`} onClick={() => setShowHeatmap(!showHeatmap)}>
              <Eye size={16} /> {showHeatmap ? "Disable Heatmap" : "Enable Heatmap"}
            </button>
          </div>

          <div className="cctv-canvas-container">
            <canvas ref={canvasRef} width={700} height={360} className="cctv-canvas" />
          </div>
        </div>
      )}

      {/* REQUIREMENT 26: AI CROWD ESTIMATION DISCLAIMER */}
      <div className="card" style={{ background: "var(--accent-orange-bg)", borderColor: "var(--accent-orange-border)", marginTop: "20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <Info size={20} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <h4 style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--accent-orange-hover)", marginBottom: "3px" }}>
              AI Crowd Estimation Reality &amp; Limitations Notice
            </h4>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Crowd headcounts and wait times are generated from actual computer-vision detection (Ultralytics YOLOv8). Detection accuracy depends on image/video resolution, camera angle, lighting, and occlusion in dense crowds. For optimal estimation, maintain an elevated camera angle covering queue entry lanes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
