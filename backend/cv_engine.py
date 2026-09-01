"""
cv_engine.py
------------
Real Computer Vision (CV) Analytics & Person Detection Engine for QueueWatch AI Pro.
Uses Ultralytics YOLOv8 for:
  1. Real Photo Person Detection (class 0 only)
  2. Real Video Frame-by-Frame Person Tracking (ByteTrack / Unique Person Track IDs)
  3. Real Live Webcam Frame Analysis
  4. Region of Interest (ROI) Queue Filtering

Also retains synthetic CCTV analytics for Demo Simulation Mode.
"""

import base64
import io
import os
import random
import tempfile
import time
from datetime import datetime
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

_yolo_model = None
_yolo_loaded = False
_yolo_error = None

CAMERAS = {
    "cam_01": {
        "id": "cam_01",
        "name": "CAM-01 — Live Camera / Photo Analysis",
        "resolution": "1920x1080",
        "roi_name": "Primary Queue Zone",
        "model": "YOLOv8n Person Detector",
    },
    "cam_02": {
        "id": "cam_02",
        "name": "CAM-02 — Video File Tracking Stream",
        "resolution": "1920x1080",
        "roi_name": "Multi-Lane Tracking ROI",
        "model": "YOLOv8n + ByteTrack Object Tracker",
    },
    "cam_03": {
        "id": "cam_03",
        "name": "CAM-03 — Demo Simulation Stream",
        "resolution": "1280x720 @ 30fps",
        "roi_name": "Demo Overflow Zone",
        "model": "Synthetic Stream Generator",
    }
}


def get_yolo_model():
    """
    Lazy initialization of YOLO person detection model.
    """
    global _yolo_model, _yolo_loaded, _yolo_error
    if _yolo_loaded:
        return _yolo_model, _yolo_error

    try:
        from ultralytics import YOLO
        model_name = os.environ.get("YOLO_MODEL", "yolov8n.pt")
        _yolo_model = YOLO(model_name)
        _yolo_loaded = True
        _yolo_error = None
        return _yolo_model, None
    except Exception as e:
        _yolo_error = str(e)
        _yolo_loaded = False
        return None, _yolo_error


def _is_in_roi(x1, y1, x2, y2, roi_box, img_w, img_h):
    """
    Checks if center point of bounding box falls inside ROI rectangle.
    """
    if not roi_box or not isinstance(roi_box, dict):
        return True
    rx = float(roi_box.get("x", 0))
    ry = float(roi_box.get("y", 0))
    rw = float(roi_box.get("width", img_w))
    rh = float(roi_box.get("height", img_h))
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    return (rx <= cx <= rx + rw) and (ry <= cy <= ry + rh)


def analyze_image_bytes(image_bytes, roi_box=None):
    """
    Processes an uploaded photo using YOLO person detection (class 0 only).
    Returns total detected person count, average confidence %, inference time ms,
    bounding box coordinates, and base64 processed image.
    """
    model, err = get_yolo_model()
    if model is None:
        return {
            "success": False,
            "error": f"YOLO Model initialization failed: {err or 'Model not loaded'}"
        }

    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        return {
            "success": False,
            "error": f"Invalid image file format: {str(e)}"
        }

    img_w, img_h = pil_img.size

    t0 = time.perf_counter()
    # Run YOLO detection ONLY for Person class (class_id = 0)
    results = model(pil_img, classes=[0], verbose=False)
    t1 = time.perf_counter()

    inference_ms = round((t1 - t0) * 1000, 1)

    bounding_boxes = []
    confidences = []

    draw = ImageDraw.Draw(pil_img)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    if results and len(results) > 0:
        boxes = results[0].boxes
        if boxes is not None and len(boxes) > 0:
            for idx, box in enumerate(boxes):
                xyxy = box.xyxy[0].tolist()
                conf = float(box.conf[0].item())
                x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                w, h = x2 - x1, y2 - y1

                if not _is_in_roi(x1, y1, x2, y2, roi_box, img_w, img_h):
                    continue

                confidences.append(conf)
                bounding_boxes.append({
                    "id": f"p_{idx+1}",
                    "x": x1,
                    "y": y1,
                    "width": w,
                    "height": h,
                    "confidence": round(conf, 3)
                })

                # Draw bounding box
                draw.rectangle([x1, y1, x2, y2], outline="#EA580C", width=3)

                # Draw label badge
                label_text = f"Person #{idx+1} {int(conf * 100)}%"
                text_bbox = font.getbbox(label_text) if hasattr(font, 'getbbox') else (0, 0, 80, 12)
                text_w = text_bbox[2] - text_bbox[0] + 6
                text_h = text_bbox[3] - text_bbox[1] + 4

                draw.rectangle([x1, max(0, y1 - text_h - 2), x1 + text_w, y1], fill="#EA580C")
                draw.text((x1 + 3, max(0, y1 - text_h)), label_text, fill="#FFFFFF", font=font)

    buffered = io.BytesIO()
    pil_img.save(buffered, format="JPEG", quality=90)
    base64_img = "data:image/jpeg;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")

    people_count = len(bounding_boxes)
    avg_conf = round(sum(confidences) / people_count, 3) if people_count > 0 else 0.0
    model_name = os.environ.get("YOLO_MODEL", "YOLOv8n")

    return {
        "success": True,
        "people_count": people_count,
        "average_confidence": avg_conf,
        "inference_time_ms": inference_ms,
        "model": model_name,
        "bounding_boxes": bounding_boxes,
        "processed_image": base64_img,
        "image_width": img_w,
        "image_height": img_h,
        "source": "image"
    }


def analyze_video_bytes(video_bytes, filename="video.mp4", roi_box=None):
    """
    Processes an uploaded queue video frame-by-frame using YOLO + ByteTrack Object Tracking.
    Tracks unique person IDs to avoid double-counting across frames.
    Returns current visible crowd count, peak crowd, average crowd, and total unique persons seen.
    """
    model, err = get_yolo_model()
    if model is None:
        return {
            "success": False,
            "error": f"YOLO Model initialization failed: {err or 'Model not loaded'}"
        }

    # Save video bytes to temporary file for OpenCV VideoCapture
    ext = os.path.splitext(filename)[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return {"success": False, "error": "Unable to decode video file"}

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        duration_sec = round(total_frames / fps, 1) if fps > 0 else 0.0

        unique_track_ids = set()
        frame_counts = []
        all_confidences = []
        sample_processed_image = None

        frame_idx = 0
        skip_frames = 2  # Process 1 out of 3 frames to optimize speed
        t0 = time.perf_counter()

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % (skip_frames + 1) != 1 and frame_idx != total_frames:
                continue

            h, w, _ = frame.shape
            # Convert BGR (cv2) to RGB (PIL/YOLO)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Run YOLO Tracking for Person class (class 0) using ByteTrack
            results = model.track(rgb_frame, classes=[0], persist=True, tracker="bytetrack.yaml", verbose=False)

            current_frame_people = 0
            if results and len(results) > 0:
                res = results[0]
                boxes = res.boxes
                if boxes is not None and len(boxes) > 0:
                    for box in boxes:
                        xyxy = box.xyxy[0].tolist()
                        conf = float(box.conf[0].item())
                        x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])

                        if not _is_in_roi(x1, y1, x2, y2, roi_box, w, h):
                            continue

                        current_frame_people += 1
                        all_confidences.append(conf)

                        # Check if track ID exists
                        if box.id is not None:
                            track_id = int(box.id[0].item())
                            unique_track_ids.add(track_id)
                            label_str = f"Person #{track_id} {int(conf*100)}%"
                        else:
                            label_str = f"Person {int(conf*100)}%"

                        # Draw bounding box on keyframe
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (12, 88, 234), 2)
                        cv2.putText(frame, label_str, (x1, max(15, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (12, 88, 234), 2)

            frame_counts.append(current_frame_people)

            # Capture keyframe preview (near middle or end of video)
            if sample_processed_image is None or frame_idx >= total_frames // 2:
                # Convert BGR frame to JPEG base64 string
                _, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                sample_processed_image = "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")

        cap.release()
        t1 = time.perf_counter()

        inference_ms = round((t1 - t0) * 1000, 1)

        current_people = frame_counts[-1] if frame_counts else 0
        peak_people = max(frame_counts) if frame_counts else 0
        avg_people = round(sum(frame_counts) / len(frame_counts), 1) if frame_counts else 0.0
        unique_seen = len(unique_track_ids) if unique_track_ids else peak_people
        avg_conf = round(sum(all_confidences) / len(all_confidences), 3) if all_confidences else 0.0

        model_name = os.environ.get("YOLO_MODEL", "YOLOv8n")

        return {
            "success": True,
            "people_count": current_people,
            "peak_people": peak_people,
            "average_people": avg_people,
            "unique_people_seen": unique_seen,
            "total_frames_processed": len(frame_counts),
            "video_duration_sec": duration_sec,
            "average_confidence": avg_conf,
            "inference_time_ms": inference_ms,
            "model": model_name + " + ByteTrack",
            "processed_image": sample_processed_image,
            "source": "video"
        }

    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


def analyze_frame_bytes(frame_bytes, roi_box=None):
    """
    Optimized single-frame analysis for live webcam stream.
    """
    res = analyze_image_bytes(frame_bytes, roi_box=roi_box)
    if res.get("success"):
        res["source"] = "camera"
    return res


def get_vision_snapshot(counters):
    """
    Generates synthetic CCTV analytics for Demo Simulation Mode only.
    """
    vision_counters = []
    total_heads_detected = 0

    for idx, c in enumerate(counters):
        people_count = c["people_waiting"] if c.get("active", True) else 0
        total_heads_detected += people_count

        bounding_boxes = []
        for i in range(min(people_count, 40)):
            x = 80 + (i % 8) * 45 + random.randint(-5, 5)
            y = 120 + (i // 8) * 50 + random.randint(-4, 4)
            conf = round(random.uniform(0.91, 0.99), 2)
            bounding_boxes.append({"id": f"p_{idx}_{i}", "x": x, "y": y, "w": 38, "h": 46, "confidence": conf})

        vision_counters.append({
            "counter_id": c["id"],
            "counter_name": c["name"],
            "detected_heads": people_count,
            "roi_active": c.get("active", True),
            "density_level": "High" if people_count > 25 else "Medium" if people_count > 10 else "Low",
            "detection_confidence_avg": round(random.uniform(0.94, 0.98), 2),
            "bounding_boxes": bounding_boxes,
        })

    model_ok, _ = get_yolo_model()

    return {
        "status": "LIVE_ANALYTICS_ACTIVE",
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "total_heads_detected": total_heads_detected,
        "active_cameras": list(CAMERAS.values()),
        "vision_counters": vision_counters,
        "model_latency_ms": round(random.uniform(12.4, 18.1), 1),
        "fps": round(random.uniform(28.5, 30.0), 1),
        "yolo_ready": model_ok is not None
    }
