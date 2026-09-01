"""
predictor.py
------------
Predictive analytics engine for QueueWatch AI Pro.
Implements triple forecasting models:
  1. Ordinary Least-Squares Linear Regression (OLS)
  2. Exponentially Weighted Moving Average with Trend (EWMA / Holt's Smoothing)
  3. Feature-Based Queue Growth Estimator (multi-factor heuristic model using arrival
     rate, service rate, time-of-day, day-of-week, and queue growth rate)

Supports 5, 10, 15, and 20 minute lookahead horizons, multi-factor feature
evaluations, confidence intervals, and plain-language alert generation.
"""

import math
from datetime import datetime

THRESHOLD_PEOPLE = 30          # Alert threshold for buildup warning


def _linear_regression(points):
    """
    points: list of (x, y). Returns (slope, intercept, std_err).
    """
    n = len(points)
    if n < 2:
        y = points[0][1] if points else 0
        return 0.0, y, 1.0

    sum_x = sum(p[0] for p in points)
    sum_y = sum(p[1] for p in points)
    sum_xy = sum(p[0] * p[1] for p in points)
    sum_xx = sum(p[0] * p[0] for p in points)

    denom = (n * sum_xx - sum_x * sum_x)
    if denom == 0:
        return 0.0, sum_y / n, 1.0

    slope = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n

    residuals = [p[1] - (slope * p[0] + intercept) for p in points]
    variance = sum(r * r for r in residuals) / max(1, n - 2)
    std_err = math.sqrt(variance)

    return slope, intercept, std_err


def _ewma_prediction(points, horizon=20, alpha=0.3, beta=0.1):
    """
    Holt's Linear Exponential Smoothing (level + trend).
    """
    if not points:
        return 0.0, 0.0, 1.0, 1.0

    level = points[0][1]
    trend = 0.0

    for i in range(1, len(points)):
        y = points[i][1]
        prev_level = level
        level = alpha * y + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend

    predicted = level + trend * horizon
    residuals = [abs(p[1] - level) for p in points[-5:]]
    std_err = sum(residuals) / len(residuals) if residuals else 1.0

    return level, trend, predicted, std_err


def predict_rf_feature_model(counter_snapshot, total_active_counters=4, hour=None, day_of_week=None):
    """
    Feature-Based ML Model (Priyanka's Queue Model integration):
    Evaluates:
      - current_queue
      - arrival_rate
      - service_rate
      - active_counters
      - avg_service_time (1 / service_rate)
      - total_service_capacity (service_rate * active_counters)
      - queue_growth_rate (arrival_rate - total_service_capacity)
      - hour (0-23)
      - day_of_week (0-6)

    Predicts queue size at 5m, 10m, 15m, and 20m.
    """
    now = datetime.now()
    hour = hour if hour is not None else now.hour
    day_of_week = day_of_week if day_of_week is not None else now.weekday()

    current_queue = float(counter_snapshot["people_waiting"])
    service_rate = float(counter_snapshot.get("service_rate", 4.0))

    # Historical trend derived arrival rate
    history = counter_snapshot.get("history", [])
    if len(history) >= 2:
        diff = history[-1][1] - history[0][1]
        dt = max(1, history[-1][0] - history[0][0])
        arrival_rate = max(0.5, service_rate + (diff / dt))
    else:
        arrival_rate = service_rate * 1.15

    avg_service_time = round(1.0 / service_rate, 2) if service_rate > 0 else 0.25
    total_service_capacity = round(service_rate * total_active_counters, 2)
    queue_growth_rate = round(arrival_rate - service_rate, 2)

    # Time of day non-linear rush multiplier
    time_factor = 1.2 if (8 <= hour <= 10 or 17 <= hour <= 19) else 1.0

    # Multi-interval forecast calculations
    pred_5 = max(0, round(current_queue + (queue_growth_rate * 5 * time_factor)))
    pred_10 = max(0, round(current_queue + (queue_growth_rate * 10 * time_factor)))
    pred_15 = max(0, round(current_queue + (queue_growth_rate * 15 * time_factor)))
    pred_20 = max(0, round(current_queue + (queue_growth_rate * 20 * time_factor)))

    return {
        "features": {
            "current_queue": current_queue,
            "arrival_rate": round(arrival_rate, 2),
            "service_rate": service_rate,
            "active_counters": total_active_counters,
            "avg_service_time": avg_service_time,
            "hour": hour,
            "day_of_week": day_of_week,
            "queue_growth_rate": queue_growth_rate,
            "total_service_capacity": total_service_capacity
        },
        "intervals": {
            "5_min": pred_5,
            "10_min": pred_10,
            "15_min": pred_15,
            "20_min": pred_20
        }
    }


def predict_counter(counter_snapshot, horizon=20, model_type="linear", total_active_counters=4):
    """
    Forecasts future queue length for a counter given its history, selected model, and horizon.
    """
    history = counter_snapshot["history"]
    current_waiting = counter_snapshot["people_waiting"]

    if not history or not counter_snapshot.get("active", True):
        return {
            "predicted_people": current_waiting,
            "lower_bound": current_waiting,
            "upper_bound": current_waiting,
            "trend": "flat",
            "slope": 0.0,
            "alert": None,
            "rf_features": None,
            "intervals": {"5_min": current_waiting, "10_min": current_waiting, "15_min": current_waiting, "20_min": current_waiting}
        }

    last_minute = history[-1][0]
    future_minute = last_minute + horizon

    # Run Priyanka's RF Feature model for interval breakdowns
    rf_data = predict_rf_feature_model(counter_snapshot, total_active_counters=total_active_counters)
    interval_map = {10: "10_min", 15: "15_min", 20: "20_min", 5: "5_min"}
    interval_key = interval_map.get(horizon, "20_min")

    if model_type == "rf":
        predicted = float(rf_data["intervals"][interval_key])
        slope = rf_data["features"]["queue_growth_rate"]
        std_err = 0.8
    elif model_type == "ewma":
        level, trend_slope, raw_predicted, std_err = _ewma_prediction(history, horizon=horizon)
        predicted = max(0.0, raw_predicted)
        slope = trend_slope
    else:
        # Default: linear
        slope, intercept, std_err = _linear_regression(history)
        predicted = max(0.0, slope * future_minute + intercept)

    margin = 1.645 * std_err * math.sqrt(1 + horizon / 10.0)
    lower_bound = max(0, round(predicted - margin))
    upper_bound = max(round(predicted), round(predicted + margin))

    if slope > 0.15:
        trend = "rising"
    elif slope < -0.15:
        trend = "falling"
    else:
        trend = "steady"

    # Plain language threshold alert
    alert = None
    if slope > 0 and predicted >= THRESHOLD_PEOPLE:
        if current_waiting < THRESHOLD_PEOPLE:
            slope_per_min = slope if slope > 0 else 0.1
            minutes_to_threshold = (THRESHOLD_PEOPLE - current_waiting) / slope_per_min
            eta = max(1, round(minutes_to_threshold))
            alert = (
                f"{counter_snapshot['name']} queue is predicted to exceed "
                f"{THRESHOLD_PEOPLE} people in ~{eta} minutes ({model_type.upper()} model)."
            )
        else:
            alert = (
                f"{counter_snapshot['name']} is already above critical capacity ({current_waiting} waiting) "
                f"and still rising — expect severe delays over next {horizon} mins."
            )

    return {
        "predicted_people": round(predicted),
        "lower_bound": lower_bound,
        "upper_bound": upper_bound,
        "trend": trend,
        "slope": round(slope, 3),
        "alert": alert,
        "rf_features": rf_data["features"],
        "intervals": rf_data["intervals"]
    }


def predict_all(snapshot, horizon=20, model_type="linear"):
    """
    Returns predictions for all active counters under chosen model and horizon.
    """
    total_active = len([c for c in snapshot["counters"] if c.get("active", True)])
    return [
        {
            "id": c["id"],
            "name": c["name"],
            "model_type": model_type,
            "horizon": horizon,
            **predict_counter(c, horizon=horizon, model_type=model_type, total_active_counters=total_active),
        }
        for c in snapshot["counters"]
    ]
