"""
action_simulator.py
-------------------
What-If Action Simulator for QueueWatch AI Pro.
Simulates the expected outcome of different interventions on a specific queue.
"""

def simulate_scenarios(counter_snapshot, prediction, horizon=20):
    """
    Simulates different queue management actions and returns expected outcomes.
    """
    current_queue = counter_snapshot.get("people_waiting", 0)
    service_rate = counter_snapshot.get("service_rate", 4.0)
    
    # Try to extract base metrics from prediction features
    arrival_rate = 0.0
    if prediction and prediction.get("rf_features"):
        arrival_rate = prediction["rf_features"].get("arrival_rate", service_rate * 1.1)
    else:
        # Fallback estimation if features missing
        arrival_rate = service_rate + (prediction.get("slope", 0.0) if prediction else 0.5)

    scenarios = []

    # 1. Do Nothing
    base_growth = arrival_rate - service_rate
    proj_nothing = max(0, round(current_queue + (base_growth * horizon)))
    scenarios.append({
        "action_id": "do_nothing",
        "action_name": "Do Nothing",
        "projected_queue": proj_nothing,
        "projected_wait_min": round(proj_nothing / service_rate, 1) if service_rate > 0 else 99,
        "risk_reduction": "None",
        "cost": "None"
    })

    # 2. Open Additional Backup Counter (Effectively cuts arrival rate in half for this lane)
    proj_open = max(0, round(current_queue + (((arrival_rate / 2) - service_rate) * horizon)))
    scenarios.append({
        "action_id": "open_counter",
        "action_name": "Open Backup Counter",
        "projected_queue": proj_open,
        "projected_wait_min": round(proj_open / service_rate, 1) if service_rate > 0 else 99,
        "risk_reduction": "High",
        "cost": "High (Requires 1 Staff)"
    })

    # 3. Redirect 30% of Arrivals
    proj_redirect = max(0, round(current_queue + (((arrival_rate * 0.7) - service_rate) * horizon)))
    scenarios.append({
        "action_id": "redirect_30",
        "action_name": "Redirect 30% of Queue",
        "projected_queue": proj_redirect,
        "projected_wait_min": round(proj_redirect / service_rate, 1) if service_rate > 0 else 99,
        "risk_reduction": "Medium",
        "cost": "Low"
    })

    # 4. Increase Service Rate by 25% (Add helper staff)
    boosted_service = service_rate * 1.25
    proj_boost = max(0, round(current_queue + ((arrival_rate - boosted_service) * horizon)))
    scenarios.append({
        "action_id": "boost_service",
        "action_name": "Boost Service Rate (+25%)",
        "projected_queue": proj_boost,
        "projected_wait_min": round(proj_boost / boosted_service, 1) if boosted_service > 0 else 99,
        "risk_reduction": "Medium",
        "cost": "Medium (Helper Staff)"
    })

    return {
        "counter_id": counter_snapshot["id"],
        "counter_name": counter_snapshot["name"],
        "horizon_min": horizon,
        "scenarios": scenarios
    }

def simulate_all_whatifs(snapshot, predictions, horizon=20):
    pred_by_id = {p["id"]: p for p in predictions}
    results = []
    
    for c in snapshot["counters"]:
        if c.get("active", True):
            results.append(simulate_scenarios(c, pred_by_id.get(c["id"]), horizon))
            
    return results
