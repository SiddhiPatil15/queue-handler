"""
server.py
---------
REST API Server & Static HTTP Asset Handler for QueueWatch AI Pro.
Uses Python standard library (http.server) - no Flask/FastAPI required.

Supported Endpoints:
  GET  /api/state
  GET  /api/prediction?model=linear|ewma|rf&horizon=20
  GET  /api/recommendation?model=linear|ewma|rf&horizon=20
  GET  /api/history
  GET  /api/cv/state
  GET  /api/cv/model-status
  GET  /api/cv/status
  GET  /api/export
  POST /api/queue/set
  POST /api/cv/analyze
  POST /api/cv/analyze-image
  POST /api/cv/analyze-video
  POST /api/cv/frame
  POST /api/mode/set
  POST /api/control
  POST /api/action/execute
  POST /api/data/upload
"""

import base64
import csv
import io
import json
import os
import re
import sys
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(__file__))

from cv_engine import analyze_image_bytes, analyze_video_bytes, analyze_frame_bytes, get_vision_snapshot, get_yolo_model
from predictor import predict_all
from recommender import recommend
from simulator import QueueSimulator
from risk_engine import evaluate_all_risks
from action_simulator import simulate_all_whatifs
from camera_health import get_all_camera_health

PORT = int(os.environ.get("PORT", 8000))
HOST = os.environ.get("HOST", "0.0.0.0")

sim = QueueSimulator(facility_key="airport")
sim_lock = threading.Lock()


def background_tick_loop():
    while True:
        time.sleep(3.0)
        with sim_lock:
            sim.tick()


tick_thread = threading.Thread(target=background_tick_loop, daemon=True)
tick_thread.start()

MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".csv": "text/csv",
    ".mp4": "video/mp4",
}


def get_frontend_dir():
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"),
        os.path.join(os.path.dirname(__file__), "dist"),
        os.path.join(os.getcwd(), "frontend", "dist"),
    ]
    for c in candidates:
        norm = os.path.normpath(c)
        if os.path.exists(norm) and os.path.isdir(norm):
            return norm
    return os.path.normpath(candidates[0])


class APIHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, filepath, content_type="text/html"):
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        except OSError:
            self.send_error(404, "File Not Found")

    def _send_csv(self, filename, csv_content):
        body = csv_content.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_post_json(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                return {}
            raw = self.rfile.read(content_length)
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def _parse_multipart(self):
        content_type = self.headers.get("Content-Type", "")
        content_length = int(self.headers.get("Content-Length", 0))
        raw_data = self.rfile.read(content_length)

        match = re.search(r'boundary=([^;]+)', content_type)
        if not match:
            return {}, {}
        boundary = match.group(1).strip().encode('utf-8')
        if boundary.startswith(b'"') and boundary.endswith(b'"'):
            boundary = boundary[1:-1]

        parts = raw_data.split(b'--' + boundary)
        fields = {}
        files = {}

        for part in parts:
            if not part or part == b'--\r\n' or part == b'--':
                continue
            if b'\r\n\r\n' not in part:
                continue

            headers_raw, body = part.split(b'\r\n\r\n', 1)
            if body.endswith(b'\r\n'):
                body = body[:-2]

            headers_str = headers_raw.decode('utf-8', errors='ignore')
            disposition_match = re.search(r'Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?', headers_str, re.IGNORECASE)

            if disposition_match:
                name = disposition_match.group(1)
                filename = disposition_match.group(2)

                if filename:
                    files[name] = {"filename": filename, "content": body}
                else:
                    fields[name] = body.decode('utf-8', errors='ignore')

        return fields, files

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/state":
            with sim_lock:
                snapshot = sim.snapshot()
            self._send_json(snapshot)
            return

        if path == "/api/prediction":
            model_type = query.get("model", ["linear"])[0]
            try:
                horizon = int(query.get("horizon", [20])[0])
            except ValueError:
                horizon = 20
            with sim_lock:
                snapshot = sim.snapshot()
            preds = predict_all(snapshot, horizon=horizon, model_type=model_type)
            self._send_json({"predictions": preds})
            return

        if path == "/api/recommendation":
            model_type = query.get("model", ["linear"])[0]
            try:
                horizon = int(query.get("horizon", [20])[0])
            except ValueError:
                horizon = 20
            with sim_lock:
                snapshot = sim.snapshot()
            preds = predict_all(snapshot, horizon=horizon, model_type=model_type)
            rec = recommend(snapshot, preds)
            self._send_json(rec)
            return

        if path == "/api/risk":
            model_type = query.get("model", ["linear"])[0]
            try:
                horizon = int(query.get("horizon", [20])[0])
            except ValueError:
                horizon = 20
            with sim_lock:
                snapshot = sim.snapshot()
            preds = predict_all(snapshot, horizon=horizon, model_type=model_type)
            risks = evaluate_all_risks(snapshot, preds)
            self._send_json({"risks": risks})
            return

        if path == "/api/whatif":
            model_type = query.get("model", ["linear"])[0]
            try:
                horizon = int(query.get("horizon", [20])[0])
            except ValueError:
                horizon = 20
            with sim_lock:
                snapshot = sim.snapshot()
            preds = predict_all(snapshot, horizon=horizon, model_type=model_type)
            whatifs = simulate_all_whatifs(snapshot, preds, horizon=horizon)
            self._send_json({"whatifs": whatifs})
            return
            
        if path == "/api/outcomes":
            with sim_lock:
                outcomes = list(sim.outcome_log)
            self._send_json({"outcomes": outcomes})
            return
            
        if path == "/api/camera/health":
            with sim_lock:
                snapshot = sim.snapshot()
            health = get_all_camera_health(snapshot)
            self._send_json({"camera_health": health})
            return

        if path == "/api/history":
            with sim_lock:
                history = list(sim.action_history)
            self._send_json({"history": history})
            return

        if path == "/api/cv/state":
            with sim_lock:
                snapshot = sim.snapshot()
            cv_state = get_vision_snapshot(snapshot.get("counters", []))
            self._send_json(cv_state)
            return

        if path in ("/api/cv/model-status", "/api/cv/status"):
            model_ok, err = get_yolo_model()
            self._send_json({
                "available": model_ok is not None,
                "model": os.environ.get("YOLO_MODEL", "YOLOv8n"),
                "error": err,
                "status": "ready" if model_ok is not None else "error"
            })
            return

        if path == "/api/export":
            with sim_lock:
                snapshot = sim.snapshot()
                sim_min = sim.sim_minute
            pred_list = predict_all(snapshot, horizon=20, model_type="linear")
            pred_map = {p["id"]: p for p in pred_list}

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow([
                "sim_minute", "facility", "counter_id", "counter_name",
                "status", "people_waiting", "wait_time_min", "service_rate",
                "last_source", "predicted_waiting_20m", "predicted_trend", "alert"
            ])

            fac_name = snapshot["facility_name"]
            for c in snapshot["counters"]:
                p = pred_map.get(c["id"], {})
                writer.writerow([
                    sim_min, fac_name, c["id"], c["name"],
                    c["status"], c["people_waiting"], c["wait_time_min"], c["service_rate"],
                    c.get("last_source", "simulation"),
                    p.get("predicted_people", c["people_waiting"]),
                    p.get("trend", "flat"), p.get("alert") or "None"
                ])

            filename = f"queue_report_t{sim_min}.csv"
            self._send_csv(filename, output.getvalue())
            return

        frontend_dir = get_frontend_dir()
        rel_path = "index.html" if path in ("/", "") else path.lstrip("/")
        full_path = os.path.normpath(os.path.join(frontend_dir, rel_path))

        if not full_path.startswith(frontend_dir):
            self.send_error(403, "Access denied")
            return

        ext = os.path.splitext(full_path)[1]
        content_type = MIME_TYPES.get(ext, "application/octet-stream")
        self._send_file(full_path, content_type)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        ctype = self.headers.get("Content-Type", "")

        # POST /api/mode/set (Switch system mode: real_cv vs simulation)
        if path == "/api/mode/set":
            body = self._read_post_json()
            mode = body.get("mode", "real_cv")
            with sim_lock:
                sim.set_mode(mode)
                snapshot = sim.snapshot()
            self._send_json({"success": True, "active_mode": mode, "snapshot": snapshot})
            return

        # POST /api/queue/set (Real manual queue count input)
        if path == "/api/queue/set":
            body = self._read_post_json()
            counter_id = body.get("counter_id")
            people_count = body.get("people_count")

            if not counter_id or people_count is None:
                self._send_json({"error": "Missing counter_id or people_count"}, status=400)
                return

            try:
                count_val = float(people_count)
                if count_val < 0:
                    raise ValueError()
            except (ValueError, TypeError):
                self._send_json({"error": "people_count must be a non-negative number"}, status=400)
                return

            with sim_lock:
                counter = sim.set_queue_length(counter_id, count_val, source="manual", input_type="manual", confidence=1.0)
                if not counter:
                    self._send_json({"error": f"Counter with id '{counter_id}' not found"}, status=404)
                    return
                snapshot = sim.snapshot()
                sim_min = sim.sim_minute

            self._send_json({
                "success": True,
                "counter_id": counter.id,
                "counter_name": counter.name,
                "people_count": round(counter.queue_length),
                "wait_time_minutes": counter.wait_time_minutes(sim_min),
                "queue_status": counter.status(sim_min),
                "source": "manual",
                "message": f"Updated {counter.name} queue count to {int(counter.queue_length)} people",
                "snapshot": snapshot
            })
            return

        # POST /api/cv/analyze or /api/cv/analyze-image (Real photo analysis)
        if path in ("/api/cv/analyze", "/api/cv/analyze-image"):
            image_bytes = None
            counter_id = "c1"
            roi_box = None

            if "multipart/form-data" in ctype:
                fields, files = self._parse_multipart()
                counter_id = fields.get("counter_id", "c1")
                img_file = files.get("image") or files.get("file")
                if img_file:
                    image_bytes = img_file["content"]
                if "roi" in fields:
                    try:
                        roi_box = json.loads(fields["roi"])
                    except Exception:
                        pass
            else:
                body = self._read_post_json()
                image_b64 = body.get("image") or body.get("image_base64")
                counter_id = body.get("counter_id", "c1")
                roi_box = body.get("roi")
                if image_b64:
                    if "," in image_b64:
                        image_b64 = image_b64.split(",", 1)[1]
                    try:
                        image_bytes = base64.b64decode(image_b64)
                    except Exception:
                        image_bytes = None

            if not image_bytes:
                self._send_json({"error": "No valid image file or image payload provided"}, status=400)
                return

            analysis = analyze_image_bytes(image_bytes, roi_box=roi_box)
            if not analysis.get("success"):
                self._send_json({"error": analysis.get("error", "Failed to analyze image")}, status=400)
                return

            people_detected = analysis["people_count"]

            with sim_lock:
                counter = sim.set_queue_length(
                    counter_id, people_detected, source="computer_vision", input_type="image",
                    confidence=analysis["average_confidence"], extra_info=f"{analysis['inference_time_ms']}ms"
                )
                if not counter and sim.counters:
                    counter = sim.counters[0]
                    sim.set_queue_length(counter.id, people_detected, source="computer_vision", input_type="image", confidence=analysis["average_confidence"])

                snapshot = sim.snapshot()
                sim_minute = sim.sim_minute

            wait_mins = counter.wait_time_minutes(sim_minute) if counter else 0.0
            queue_status = counter.status(sim_minute) if counter else "normal"

            self._send_json({
                "success": True,
                "counter_id": counter.id if counter else counter_id,
                "counter_name": counter.name if counter else "Unknown",
                "people_count": people_detected,
                "average_confidence": analysis["average_confidence"],
                "inference_time_ms": analysis["inference_time_ms"],
                "model": analysis["model"],
                "source": "image",
                "queue_status": queue_status,
                "estimated_wait_minutes": wait_mins,
                "bounding_boxes": analysis["bounding_boxes"],
                "processed_image": analysis["processed_image"],
                "snapshot": snapshot
            })
            return

        # POST /api/cv/analyze-video (Real video file object tracking)
        if path == "/api/cv/analyze-video":
            video_bytes = None
            counter_id = "c1"
            filename = "video.mp4"
            roi_box = None

            if "multipart/form-data" in ctype:
                fields, files = self._parse_multipart()
                counter_id = fields.get("counter_id", "c1")
                vid_file = files.get("video") or files.get("file")
                if vid_file:
                    video_bytes = vid_file["content"]
                    filename = vid_file.get("filename", "video.mp4")
                if "roi" in fields:
                    try:
                        roi_box = json.loads(fields["roi"])
                    except Exception:
                        pass
            else:
                body = self._read_post_json()
                vid_b64 = body.get("video") or body.get("video_base64")
                counter_id = body.get("counter_id", "c1")
                filename = body.get("filename", "video.mp4")
                roi_box = body.get("roi")
                if vid_b64:
                    if "," in vid_b64:
                        vid_b64 = vid_b64.split(",", 1)[1]
                    try:
                        video_bytes = base64.b64decode(vid_b64)
                    except Exception:
                        video_bytes = None

            if not video_bytes:
                self._send_json({"error": "No valid video file provided"}, status=400)
                return

            analysis = analyze_video_bytes(video_bytes, filename=filename, roi_box=roi_box)
            if not analysis.get("success"):
                self._send_json({"error": analysis.get("error", "Failed to analyze video")}, status=400)
                return

            current_people = analysis["people_count"]

            with sim_lock:
                counter = sim.set_queue_length(
                    counter_id, current_people, source="computer_vision", input_type="video",
                    confidence=analysis["average_confidence"],
                    extra_info=f"Peak: {analysis['peak_people']}, Unique IDs: {analysis['unique_people_seen']}"
                )
                if not counter and sim.counters:
                    counter = sim.counters[0]
                    sim.set_queue_length(counter.id, current_people, source="computer_vision", input_type="video", confidence=analysis["average_confidence"])

                snapshot = sim.snapshot()
                sim_minute = sim.sim_minute

            wait_mins = counter.wait_time_minutes(sim_minute) if counter else 0.0
            queue_status = counter.status(sim_minute) if counter else "normal"

            self._send_json({
                "success": True,
                "counter_id": counter.id if counter else counter_id,
                "counter_name": counter.name if counter else "Unknown",
                "people_count": current_people,
                "peak_people": analysis["peak_people"],
                "average_people": analysis["average_people"],
                "unique_people_seen": analysis["unique_people_seen"],
                "video_duration_sec": analysis["video_duration_sec"],
                "average_confidence": analysis["average_confidence"],
                "inference_time_ms": analysis["inference_time_ms"],
                "model": analysis["model"],
                "source": "video",
                "queue_status": queue_status,
                "estimated_wait_minutes": wait_mins,
                "processed_image": analysis["processed_image"],
                "snapshot": snapshot
            })
            return

        # POST /api/cv/frame (Real live webcam frame stream)
        if path == "/api/cv/frame":
            body = self._read_post_json()
            image_b64 = body.get("image") or body.get("frame")
            counter_id = body.get("counter_id", "c1")
            roi_box = body.get("roi")

            if not image_b64:
                self._send_json({"error": "No frame payload provided"}, status=400)
                return

            if "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            try:
                frame_bytes = base64.b64decode(image_b64)
            except Exception:
                self._send_json({"error": "Invalid base64 frame data"}, status=400)
                return

            analysis = analyze_frame_bytes(frame_bytes, roi_box=roi_box)
            if not analysis.get("success"):
                self._send_json({"error": analysis.get("error", "Frame analysis failed")}, status=400)
                return

            people_detected = analysis["people_count"]

            with sim_lock:
                counter = sim.set_queue_length(
                    counter_id, people_detected, source="computer_vision", input_type="camera",
                    confidence=analysis["average_confidence"], extra_info=f"Live Camera stream"
                )
                if not counter and sim.counters:
                    counter = sim.counters[0]
                    sim.set_queue_length(counter.id, people_detected, source="computer_vision", input_type="camera", confidence=analysis["average_confidence"])

                snapshot = sim.snapshot()
                sim_minute = sim.sim_minute

            wait_mins = counter.wait_time_minutes(sim_minute) if counter else 0.0
            queue_status = counter.status(sim_minute) if counter else "normal"

            self._send_json({
                "success": True,
                "counter_id": counter.id if counter else counter_id,
                "counter_name": counter.name if counter else "Unknown",
                "people_count": people_detected,
                "average_confidence": analysis["average_confidence"],
                "inference_time_ms": analysis["inference_time_ms"],
                "model": analysis["model"],
                "source": "camera",
                "queue_status": queue_status,
                "estimated_wait_minutes": wait_mins,
                "bounding_boxes": analysis["bounding_boxes"],
                "processed_image": analysis["processed_image"],
                "snapshot": snapshot
            })
            return

        # POST /api/control
        if path == "/api/control":
            body = self._read_post_json()
            action = body.get("action")

            with sim_lock:
                if action == "surge":
                    amount = float(body.get("amount", 3.0))
                    sim.inject_surge(amount)
                    message = f"Injected crowd surge (+{amount} arrivals/min)"

                elif action == "pause":
                    sim.is_paused = not sim.is_paused
                    status_text = "paused" if sim.is_paused else "resumed"
                    sim.log_action(f"Simulation {status_text}", "operator")
                    message = f"Simulation is now {status_text}"

                elif action == "preset":
                    facility_key = body.get("facility_key", "airport")
                    sim.load_preset(facility_key)
                    message = f"Switched facility to {sim.facility_info['name']}"

                elif action == "rate":
                    counter_id = body.get("counter_id")
                    rate = float(body.get("rate", 4.0))
                    sim.set_service_rate(counter_id, rate)
                    message = "Updated service rate"

                elif action == "add_counter":
                    c = sim.add_counter()
                    message = f"Opened additional counter: {c.name}"

                elif action == "toggle":
                    counter_id = body.get("counter_id")
                    c = sim.toggle_counter_active(counter_id)
                    message = f"Toggled counter state for {c.name if c else counter_id}"

                else:
                    self._send_json({"error": f"Unknown action: {action}"}, status=400)
                    return

                snapshot = sim.snapshot()

            self._send_json({"success": True, "message": message, "snapshot": snapshot})
            return

        # POST /api/action/execute
        if path == "/api/action/execute":
            body = self._read_post_json()
            action_type = body.get("action_type")
            payload = body.get("payload", {})
            success = False

            with sim_lock:
                if action_type == "open_counter" or action_type == "OPEN_COUNTER":
                    cid = payload.get("counter_id")
                    if cid:
                        if sim.toggle_counter_active(cid, active_state=True):
                            sim.register_action_for_outcome(cid, "Open Counter", -5, horizon=5)
                            success = True
                    else:
                        c = sim.add_counter(name="Backup Counter (Auto-Opened)", service_rate=5.0)
                        if c:
                            sim.register_action_for_outcome(c.id, "Open Counter", 0, horizon=5)
                            success = True
                    sim.log_action("Executed Recommendation: Opened backup counter", "execution")

                elif action_type in ("redirect", "preemptive_redirect", "REROUTE"):
                    from_id = payload.get("from_id") or payload.get("from_counter_id")
                    to_id = payload.get("to_id") or payload.get("to_counter_id")
                    count = payload.get("count", 5)
                    if sim.redirect_people(from_id, to_id, count=count):
                        sim.register_action_for_outcome(from_id, "Redirect Departures", -count, horizon=5)
                        sim.register_action_for_outcome(to_id, "Redirect Arrivals", count, horizon=5)
                        success = True

                elif action_type == "add_counter":
                    c = sim.add_counter(name=payload.get("name"), service_rate=payload.get("service_rate", 4.5))
                    if c:
                        sim.register_action_for_outcome(c.id, "Add New Counter", 0, horizon=5)
                        success = True

                elif action_type == "ADJUST_RATE":
                    cid = payload.get("counter_id")
                    new_rate = payload.get("new_rate", 5.5)
                    if sim.set_service_rate(cid, new_rate):
                        success = True

                snapshot = sim.snapshot()

            self._send_json({
                "success": success,
                "message": f"Successfully executed action ticket: {action_type}",
                "snapshot": snapshot
            })
            return

        # POST /api/action/approve
        if path == "/api/action/approve":
            body = self._read_post_json()
            action_type = body.get("action_type")
            payload = body.get("payload", {})
            with sim_lock:
                sim.log_action(f"Human operator approved action: {action_type}", "operator")
            
            # Delegate to execute logic
            self.path = "/api/action/execute"
            return self.do_POST()

        # POST /api/data/upload
        if path == "/api/data/upload":
            body = self._read_post_json()
            csv_text = body.get("csv_text")
            custom_state = body.get("state")

            with sim_lock:
                if csv_text:
                    lines = csv_text.strip().split("\n")
                    reader = csv.DictReader(lines)
                    count = 0
                    for row in reader:
                        idx = count
                        if idx < len(sim.counters):
                            try:
                                pw = float(row.get("people_waiting", row.get("queue_length", 10)))
                                sr = float(row.get("service_rate", 4.5))
                                sim.counters[idx].queue_length = pw
                                sim.counters[idx].base_service_rate = sr
                                sim.counters[idx].last_source = "csv"
                                count += 1
                            except Exception:
                                pass
                    sim.log_action(f"Uploaded historical CSV test dataset ({count} counters loaded)", "data")
                    message = f"Successfully loaded {count} counters from CSV data (historical test mode)"

                elif custom_state and isinstance(custom_state, list):
                    count = 0
                    for item in custom_state:
                        cid = item.get("counter_id") or item.get("id")
                        pw = item.get("people_waiting") or item.get("queue_length")
                        c = next((cnt for cnt in sim.counters if cnt.id == cid), None)
                        if c and pw is not None:
                            c.queue_length = float(pw)
                            c.last_source = "json"
                            if "service_rate" in item:
                                c.base_service_rate = float(item["service_rate"])
                            count += 1
                    sim.log_action(f"Loaded custom JSON state ({count} counters updated)", "data")
                    message = f"Successfully loaded custom JSON dataset for {count} counters"

                else:
                    self._send_json({"error": "Invalid upload format. Provide 'csv_text' or 'state' JSON array."}, status=400)
                    return

                snapshot = sim.snapshot()

            self._send_json({"success": True, "message": message, "snapshot": snapshot})
            return

        self.send_error(404, "API Endpoint Not Found")


def run_server():
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, APIHandler)
    print(f"QueueWatch AI Pro Operations Server running on http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
