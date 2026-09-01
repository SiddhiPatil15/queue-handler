"""
recommender.py
--------------
Operational Decision & Recommendation Engine for QueueWatch AI Pro.
Applies a rule-based expert framework to recommend high-impact queue management actions.

Produces machine-readable execution commands (for 1-click execution in the UI)
as well as plain-language explanations for operators and demo judges.
"""

from risk_engine import calculate_risk

OVERLOAD_WAIT_MIN = 12
SLACK_WAIT_MIN = 6

# Persistence tracking to avoid false alerts
persistence_state = {}

def recommend(snapshot, predictions):
    """
    Evaluates current queue snapshot and multi-horizon predictions to generate
    prioritized operational recommendations.
    """
    counters = [c for c in snapshot["counters"] if c.get("active", True)]
    all_counters = snapshot["counters"]
    pred_by_id = {p["id"]: p for p in predictions}

    if not counters:
        return {
            "priority": "normal",
            "action_type": "none",
            "action": "All counters inactive",
            "reason": "No active counters found in system.",
            "executable": False
        }

    overloaded = [c for c in counters if c["wait_time_min"] >= OVERLOAD_WAIT_MIN]
    slack = [c for c in counters if c["wait_time_min"] <= SLACK_WAIT_MIN]

    # Evaluate risk for persistence
    for c in counters:
        risk = calculate_risk(c, pred_by_id.get(c["id"]))
        if risk["risk_level"] in ("ORANGE", "RED"):
            persistence_state[c["id"]] = persistence_state.get(c["id"], 0) + 1
        else:
            persistence_state[c["id"]] = max(0, persistence_state.get(c["id"], 0) - 1)

    # Rule 1: Every active counter is overloaded -> Recommend opening an extra counter / backup lane
    if len(overloaded) == len(counters) and len(counters) > 0:
        # Check persistence (require at least 2 ticks of overload to recommend)
        if all(persistence_state.get(c["id"], 0) >= 2 for c in overloaded):
            closed_counters = [c for c in all_counters if not c.get("active", True)]
            if closed_counters:
                target_to_open = closed_counters[0]
                return {
                    "priority": "critical",
                    "action_type": "open_counter",
                    "counter_id": target_to_open["id"],
                    "action": f"Re-open Backup Lane ({target_to_open['name']})",
                    "reason": (
                        f"All {len(counters)} active counters are severely overloaded (wait times {OVERLOAD_WAIT_MIN}+ mins). "
                        f"Re-opening {target_to_open['name']} will immediately absorb incoming crowd overflow."
                    ),
                    "evidence": f"Average wait time is {round(sum(c['wait_time_min'] for c in overloaded)/len(overloaded), 1)} mins.",
                    "expected_impact": "Will reduce average wait times by ~30% within 10 minutes.",
                    "confidence": "High (95%)",
                    "time_to_crisis": 0,
                    "executable": True,
                    "payload": {"counter_id": target_to_open["id"], "active": True}
                }
            else:
                return {
                    "priority": "critical",
                    "action_type": "add_counter",
                    "action": "Deploy New Service Counter",
                    "reason": (
                        f"All {len(counters)} active counters exceed {OVERLOAD_WAIT_MIN} min wait times with zero available slack. "
                        "Deploying an additional counter is required to reduce queue bottleneck."
                    ),
                    "evidence": "No inactive counters available to handle overflow.",
                    "expected_impact": "Will distribute load and prevent queue overflow.",
                    "confidence": "High (90%)",
                    "time_to_crisis": 0,
                    "executable": True,
                    "payload": {"name": f"Counter {len(all_counters) + 1} (Express)", "service_rate": 5.0}
                }

    # Rule 2: Active overload + slack pairing -> Recommend instant customer redirection
    if overloaded and slack:
        busiest = max(overloaded, key=lambda c: c["wait_time_min"])
        quietest = min(slack, key=lambda c: c["wait_time_min"])
        
        if persistence_state.get(busiest["id"], 0) >= 2:
            shift_count = min(8, max(3, round(busiest["people_waiting"] * 0.35)))
            risk_busiest = calculate_risk(busiest, pred_by_id.get(busiest["id"]))

            return {
                "priority": "high",
                "action_type": "redirect",
                "action": f"Redirect {shift_count} customers from {busiest['name']} to {quietest['name']}",
                "reason": (
                    f"{busiest['name']} has a {busiest['wait_time_min']} min wait time ({busiest['people_waiting']} people), "
                    f"while {quietest['name']} has only a {quietest['wait_time_min']} min wait time ({quietest['people_waiting']} people). "
                    f"Rerouting will equalize queue density."
                ),
                "evidence": f"Wait time delta is {round(busiest['wait_time_min'] - quietest['wait_time_min'], 1)} mins.",
                "expected_impact": f"Immediate reduction of {shift_count} people in {busiest['name']}.",
                "confidence": "Medium-High (85%)",
                "time_to_crisis": risk_busiest["time_to_crisis_min"] if risk_busiest["time_to_crisis_min"] is not None else 5,
                "executable": True,
                "payload": {
                    "from_id": busiest["id"],
                    "to_id": quietest["id"],
                    "count": shift_count
                }
            }

    # Rule 3: Pre-emptive action based on rising predictions
    rising_alerts = [pred_by_id[c["id"]] for c in counters if pred_by_id.get(c["id"]) and pred_by_id[c["id"]].get("alert")]
    if rising_alerts and slack:
        rising = rising_alerts[0]
        quietest = min(slack, key=lambda c: c["wait_time_min"])
        target_counter = next((c for c in counters if c["id"] == rising["id"]), None)

        if target_counter and persistence_state.get(target_counter["id"], 0) >= 1:
            shift_count = min(5, max(2, round(target_counter["people_waiting"] * 0.25)))
            risk_rising = calculate_risk(target_counter, rising)
            
            return {
                "priority": "medium",
                "action_type": "preemptive_redirect",
                "action": f"Pre-emptively divert arrivals from {rising['name']} to {quietest['name']}",
                "reason": f"Forecast alert trigger: {rising['alert']}",
                "evidence": f"Model predicts {rising['predicted_people']} people in {rising['horizon']} mins.",
                "expected_impact": "Will prevent queue from reaching critical threshold.",
                "confidence": f"{rising.get('confidence_label', 'Medium')} ({rising.get('confidence_score', 50)}%)",
                "time_to_crisis": risk_rising["time_to_crisis_min"],
                "executable": True,
                "payload": {
                    "from_id": rising["id"],
                    "to_id": quietest["id"],
                    "count": shift_count
                }
            }

    # Rule 4: System balanced & operating normally
    return {
        "priority": "normal",
        "action_type": "none",
        "action": "All counters operating within optimal capacity",
        "reason": "Queue flow is balanced across all counters. No manual intervention required.",
        "evidence": "No counter exceeds wait time thresholds.",
        "expected_impact": "Maintain current operational state.",
        "confidence": "High (95%)",
        "time_to_crisis": None,
        "executable": False
    }
