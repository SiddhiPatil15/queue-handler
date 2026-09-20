# 🚀 QueueHandler AI Pro — Real-Time Queue & Crowd Prediction System

[![Spiderverse Hackathon](https://img.shields.io/badge/Spiderverse-Hackathon_2026-blue.svg)](https://github.com)
[![Python 3.10+](https://img.shields.io/badge/Backend-Python_3.10%2B-green.svg)](https://python.org)
[![React 19](https://img.shields.io/badge/Frontend-React_19_%2B_Vite-cyan.svg)](https://reactjs.org)
[![Computer Vision](https://img.shields.io/badge/AI-YOLOv8_Ultralytics-purple.svg)](https://github.com/ultralytics/ultralytics)

**QueueHandler AI Pro** is a modern, high-performance queue monitoring, real image computer vision detector, multi-factor predictive intelligence dashboard, and automated decision engine built for high-footfall operational environments (Airports, Hospitals, Banks, and Supermarkets).

```
 ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
 │ 1. DETECT DATA  │───>│ 2. ESTIMATE     │───>│ 3. PREDICT      │───>│ 4. RECOMMEND     │───>│ 5. EXECUTE      │
 │ YOLO / Manual   │    │ Queue & Wait    │    │ Multi-Interval  │    │ Action Ticket    │    │ 1-Click Reroute │
 └─────────────────┘    └─────────────────┘    └─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 🌟 Key Features & Capabilities

### 📷 1. Real YOLOv8 Computer Vision Image Analysis & Person Detection
- **Real Image Upload Detection**: Upload JPG, JPEG, PNG, or WEBP images of queues/crowds.
- **Ultralytics YOLOv8 Integration**: Detects human `person` class, returning exact bounding boxes, confidence score %, and inference time in milliseconds.
- **Visual Bounding Box Overlay**: Draws color-coded bounding boxes and `Person XX%` badges directly onto the uploaded image.
- **ROI (Region of Interest) Filtering**: Filter detections within designated queue zones.
- **State Propagation**: Automatically feeds detected people counts into counter queue lengths, wait time calculations, forecast models, and decision recommendations.

### ✋ 2. Real Manual Queue Input Control
- **Direct Counter Overrides**: Select any counter/lane, enter the current headcount, and click **Apply Queue Count**.
- **Source Tracking**: Displays data lineage source (`MANUAL`, `CV`, `CSV`, `JSON`, `SIMULATION`) across the dashboard.
- **Audit Logging**: Logs all manual entries and computer-vision detections to the operational audit log timeline.

### 🧠 3. Triple AI Prediction Engine & Multi-Interval Matrix
- **Linear Regression (OLS)**: Fits a least-squares trend line over telemetry history with confidence bounds.
- **EWMA Exponential Smoothing**: Adapts dynamically to sudden non-linear surge spikes using Holt's model.
- **Feature-Based ML Model**: Evaluates queue density, arrival rates, service capacities, active counters, and rush multipliers.
- **Multi-Interval Matrix**: Granular lookaheads at **+5 Min**, **+10 Min**, **+15 Min**, and **+20 Min** with color-coded **Queue Growth Rate** status pills (`val-rising`, `val-watch`, `val-steady`).

### 🔀 4. 5-Section React Modern Dashboard UI
- **📊 1. Overview Dashboard**: High-level KPI ribbon, live facility flow chart, ticker, and quick action bar.
- **🔀 2. Live Counter Monitor**: Lane cards, manual count input panel, animated crowd density dots, progress bars, service rate adjusters (+/-), and open/close counter toggles.
- **🧠 3. Predictive ML Studio**: Model tab switcher, horizon selector (10m, 20m, 30m), multi-interval lookup table, and capacity alert feed.
- **📷 4. Computer Vision Studio**: Real YOLO image uploader, detection visualizer, metrics cards, plus synthetic CCTV demo stream mode.
- **⚙️ 5. Command Center & Data Lab**: 1-Click recommendation ticket, drag-and-drop CSV/JSON dataset loader, CSV exporter, and audit log timeline.

---

## 🛠️ Tech Stack & Architecture

- **Backend**: Python 3.10+ (`http.server`, `threading`, `json`, `math`, `csv`, `io`).
- **Computer Vision**: Ultralytics YOLOv8 (`yolov8n.pt`), OpenCV (`cv2`), Pillow (`PIL`).
- **Frontend**: React 19, Vite, Chart.js (`react-chartjs-2`), Lucide Icons, Modern Light Glassmorphism UI.

---

## ⚡ Quick Start & Deployment

### Prerequisites
- **Python 3.10+** installed.
- **Node.js 18+ & npm** (for building React frontend).

### 1. Install Dependencies

```bash
# Install Python backend dependencies
pip install -r backend/requirements.txt

# Install React frontend dependencies
cd frontend
npm install
cd ..
```

*Note: The YOLO model weights (`yolov8n.pt`) will automatically download on first run if not already present locally.*

### 2. Build & Launch Application (Production Mode)

```bash
# Build React frontend
cd frontend
npm run build
cd ..

# Start Python server
python backend/server.py
```
👉 Open **`http://localhost:8000`** in your browser.

---

### React Development Mode (Hot Reload)

```bash
# Terminal 1: Start Python API backend
python backend/server.py

# Terminal 2: Start Vite React dev server
cd frontend
npm run dev
```
👉 Open **`http://localhost:5173`** in your browser.

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `GET /api/state` | `GET` | Returns real-time counter snapshot, wait times, total crowd, and facility status. |
| `POST /api/queue/set` | `POST` | Sets manual queue headcount for a counter (`{"counter_id": "c1", "people_count": 24}`). |
| `POST /api/cv/analyze` | `POST` | Accepts uploaded image (`multipart/form-data` or base64), runs YOLO person detection, returns bounding boxes, confidence %, and updates backend counter state. |
| `GET /api/cv/model-status` | `GET` | Checks if YOLO model is loaded and ready. |
| `GET /api/prediction` | `GET` | Computes forecasts (`?model=linear\|ewma\|rf&horizon=20`) with confidence intervals and 5-20m lookaheads. |
| `GET /api/recommendation` | `GET` | Returns automated operational recommendation ticket and 1-click execution payload. |
| `GET /api/cv/state` | `GET` | Returns synthetic CCTV demo stream camera feeds and ROI head counts. |
| `POST /api/control` | `POST` | Simulator control actions (surge, pause, reset, facility preset, rate). |
| `POST /api/action/execute` | `POST` | Executes operational action payload (e.g. reroute customers, open backup counter). |
| `POST /api/data/upload` | `POST` | Ingests custom CSV or JSON queue dataset onto counter class objects. |
| `GET /api/export` | `GET` | Downloads dynamic CSV queue log report with data source tracking. |

---

## 💡 System Limitations & Considerations

- **Single Image Analysis**: A single uploaded image provides an accurate **instantaneous crowd count and wait-time estimate** for the selected counter.
- **Predictive Trends**: Multi-step lookahead trend forecasting (5m, 10m, 15m, 20m) achieves maximum accuracy when multiple observation samples are recorded over time into the counter's history buffer.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
