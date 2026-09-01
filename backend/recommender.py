"""
recommender.py
--------------
Operational Decision & Recommendation Engine for QueueWatch AI Pro.
Applies a rule-based expert framework to recommend high-impact queue management actions.

Produces machine-readable execution commands (for 1-click execution in the UI)
as well as plain-language explanations for operators and demo judges.
"""

OVERLOAD_WAIT_MIN = 12
SLACK_WAIT_MIN = 6


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

    # Rule 1: Every active counter is overloaded -> Recommend opening an extra counter / backup lane
    if len(overloaded) == len(counters):
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
                "executable": True,
                "payload": {"name": f"Counter {len(all_counters) + 1} (Express)", "service_rate": 5.0}
            }

    # Rule 2: Active overload + slack pairing -> Recommend instant customer redirection
    if overloaded and slack:
        busiest = max(overloaded, key=lambda c: c["wait_time_min"])
        quietest = min(slack, key=lambda c: c["wait_time_min"])
        shift_count = min(8, max(3, round(busiest["people_waiting"] * 0.35)))

        return {
            "priority": "high",
            "action_type": "redirect",
            "action": f"Redirect {shift_count} customers from {busiest['name']} to {quietest['name']}",
            "reason": (
                f"{busiest['name']} has a {busiest['wait_time_min']} min wait time ({busiest['people_waiting']} people), "
                f"while {quietest['name']} has only a {quietest['wait_time_min']} min wait time ({quietest['people_waiting']} people). "
                f"Rerouting will equalize queue density."
            ),
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

        if target_counter:
            shift_count = min(5, max(2, round(target_counter["people_waiting"] * 0.25)))
            return {
                "priority": "medium",
                "action_type": "preemptive_redirect",
                "action": f"Pre-emptively divert arrivals from {rising['name']} to {quietest['name']}",
                "reason": f"Forecast alert trigger: {rising['alert']}",
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
        "executable": False
    }
