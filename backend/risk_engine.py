"""
risk_engine.py
--------------
Multi-factor risk engine for QueueWatch AI Pro.
Calculates risk levels and time-to-crisis based on queue metrics.
"""

def calculate_risk(counter_snapshot, prediction):
    """
    Evaluates current queue metrics and predicts risk level and time-to-crisis.
    """
    queue_size = counter_snapshot.get("people_waiting", 0)
    service_rate = counter_snapshot.get("service_rate", 4.0)
    
    # Using 35 as a standard critical threshold for a single lane
    crisis_threshold = 35 
    
    # Try to extract growth rate from prediction features
    growth_rate = 0.0
    if prediction and prediction.get("rf_features"):
        growth_rate = prediction["rf_features"].get("queue_growth_rate", 0.0)
    elif prediction and prediction.get("slope"):
        growth_rate = prediction.get("slope", 0.0)
        
    time_to_crisis = None
    if queue_size >= crisis_threshold:
        time_to_crisis = 0
    elif growth_rate > 0.1:
        time_to_crisis = max(1, round((crisis_threshold - queue_size) / growth_rate))
        
    # Determine Risk Level
    risk_level = "GREEN"
    if queue_size >= crisis_threshold:
        risk_level = "RED"
    elif queue_size >= crisis_threshold * 0.75:
        if growth_rate > 0:
            risk_level = "ORANGE"
        else:
            risk_level = "YELLOW"
    elif queue_size >= crisis_threshold * 0.5:
        if growth_rate > 2.0:
            risk_level = "ORANGE"
        elif growth_rate > 0:
            risk_level = "YELLOW"
            
    return {
        "counter_id": counter_snapshot["id"],
        "risk_level": risk_level,
        "time_to_crisis_min": time_to_crisis,
        "crisis_threshold": crisis_threshold,
        "growth_rate": round(growth_rate, 2)
    }

def evaluate_all_risks(snapshot, predictions):
    """
    Evaluates risk for all active counters.
    """
    pred_by_id = {p["id"]: p for p in predictions}
    risks = []
    
    for c in snapshot["counters"]:
        if c.get("active", True):
            risks.append(calculate_risk(c, pred_by_id.get(c["id"])))
            
    return risks
