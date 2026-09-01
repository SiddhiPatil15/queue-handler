"""
camera_health.py
----------------
Camera Health & Data Quality Monitor for QueueWatch AI Pro.
Ensures fail-safe AI behavior by downgrading confidence on bad camera feeds.
"""

def evaluate_camera_health(counter_snapshot):
    """
    Evaluates the reliability of the CV data for a given counter.
    Returns status: GOOD, DEGRADED, or OFFLINE.
    """
    history = counter_snapshot.get("history", [])
    observations = counter_snapshot.get("observations_log", [])
    
    # If no data, it's offline or not collecting yet
    if not observations:
        return {
            "status": "OFFLINE",
            "message": "No camera data received yet.",
            "reliability_score": 0.0,
            "can_recommend": False
        }
        
    last_obs = observations[-1]
    
    # Check freshness (if last observation was too long ago compared to sim_minute)
    # Simulator doesn't explicitly store absolute timestamps in history, but we can assume
    # if it's the active source, it's fresh.
    
    confidence = last_obs.get("confidence", 1.0)
    
    if confidence < 0.60:
        return {
            "status": "DEGRADED",
            "message": "Low YOLO detection confidence. Camera visibility may be poor.",
            "reliability_score": round(confidence, 2),
            "can_recommend": False
        }
        
    # Check for sudden unrealistic drops in history (e.g. 40 -> 3 in one tick)
    if len(history) >= 2:
        last_val = history[-1][1]
        prev_val = history[-2][1]
        if prev_val > 15 and last_val < (prev_val * 0.2):
            return {
                "status": "DEGRADED",
                "message": "Sudden unrealistic count drop detected. Possible occlusion.",
                "reliability_score": 0.40,
                "can_recommend": False
            }
            
    return {
        "status": "GOOD",
        "message": "Camera feed stable. Detections reliable.",
        "reliability_score": round(confidence, 2),
        "can_recommend": True
    }

def get_all_camera_health(snapshot):
    health_data = {}
    for c in snapshot["counters"]:
        health_data[c["id"]] = evaluate_camera_health(c)
    return health_data
