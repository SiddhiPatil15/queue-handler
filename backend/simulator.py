"""
simulator.py
------------
Advanced multi-facility queue simulation & single-source queue state engine for QueueWatch AI Pro.
Supports Real Computer Vision Modes (Photo, Video, Live Camera), Real Manual Overrides,
and Demo Simulation Modes.

Zero external dependencies - standard library only.
"""

import math
import random
import time

FACILITY_PRESETS = {
    "airport": {
        "name": "Airport Security & Terminal Check-in",
        "counters": [
            {"id": "c1", "name": "Lane A (General)", "rate": 4.5, "phase": 0},
            {"id": "c2", "name": "Lane B (General)", "rate": 5.0, "phase": 15},
            {"id": "c3", "name": "Lane C (Priority/TSA)", "rate": 6.5, "phase": 30},
            {"id": "c4", "name": "Lane D (Baggage Drop)", "rate": 4.0, "phase": 45},
        ]
    },
    "hospital": {
        "name": "Hospital Emergency Triage & Admissions",
        "counters": [
            {"id": "c1", "name": "Triage Desk 1 (Urgent)", "rate": 3.5, "phase": 5},
            {"id": "c2", "name": "Triage Desk 2 (Standard)", "rate": 4.2, "phase": 20},
            {"id": "c3", "name": "Admissions Desk 3", "rate": 3.8, "phase": 35},
            {"id": "c4", "name": "Pediatric Counter", "rate": 5.0, "phase": 50},
        ]
    },
    "bank": {
        "name": "Central Bank Branch Counters",
        "counters": [
            {"id": "c1", "name": "Teller 1 (Cash & Deposit)", "rate": 5.2, "phase": 0},
            {"id": "c2", "name": "Teller 2 (Personal Banking)", "rate": 4.0, "phase": 18},
            {"id": "c3", "name": "Teller 3 (Corporate Service)", "rate": 3.5, "phase": 32},
            {"id": "c4", "name": "Teller 4 (Express Counter)", "rate": 6.0, "phase": 48},
        ]
    },
    "retail": {
        "name": "Supermarket Checkout Plaza",
        "counters": [
            {"id": "c1", "name": "Express Lane 1 (< 10 Items)", "rate": 7.0, "phase": 0},
            {"id": "c2", "name": "Express Lane 2 (< 10 Items)", "rate": 6.5, "phase": 12},
            {"id": "c3", "name": "Standard Checkout 3", "rate": 4.2, "phase": 28},
            {"id": "c4", "name": "Standard Checkout 4", "rate": 4.0, "phase": 42},
        ]
    }
}


class Counter:
    def __init__(self, counter_id, name, base_service_rate, phase_offset=0, active=True):
        self.id = counter_id
        self.name = name
        self.base_service_rate = base_service_rate
        self.phase_offset = phase_offset
        self.active = active
        self.queue_length = random.randint(3, 8)
        self.history = []  # [(sim_minute, queue_length)]
        self.observations_log = [] # Detailed observation records
        self.total_served = 0
        self.total_arrived = 0
        self.last_source = "simulation"

    def arrival_rate(self, sim_minute, global_surge=0.0):
        if not self.active:
            return 0.0
        t = sim_minute + self.phase_offset
        k = 2 * math.pi / 40.0
        wave = 3.2 * math.sin(k * t) + 1.4 * math.sin(k * 2.2 * t + 0.5)
        noise = random.uniform(-0.5, 0.5)
        rate = self.base_service_rate + wave + noise + global_surge
        return max(0.4, rate)

    def service_rate(self, sim_minute):
        if not self.active:
            return 0.0
        return max(0.8, self.base_service_rate + random.uniform(-0.4, 0.4))

    def tick(self, sim_minute, global_surge=0.0, force_wave=True):
        if not self.active:
            self.history.append((sim_minute, round(self.queue_length, 2)))
            if len(self.history) > 60:
                self.history.pop(0)
            return

        if force_wave:
            arrivals = self.arrival_rate(sim_minute, global_surge)
            served = min(self.queue_length + arrivals, self.service_rate(sim_minute))

            self.total_arrived += round(arrivals, 1)
            self.total_served += round(served, 1)

            self.queue_length = max(0, self.queue_length + arrivals - served)
        else:
            # When real CV or manual override is active, process queue decrement by service rate
            served = min(self.queue_length, self.service_rate(sim_minute) * (3.0 / 60.0))
            self.total_served += round(served, 1)
            self.queue_length = max(0.0, self.queue_length - served)

        self.history.append((sim_minute, round(self.queue_length, 2)))
        if len(self.history) > 60:
            self.history.pop(0)

    def wait_time_minutes(self, sim_minute=None):
        """Estimate wait using stable base_service_rate (no random noise) for consistent UI display."""
        if not self.active or self.base_service_rate <= 0:
            return 0.0
        return round(self.queue_length / self.base_service_rate, 1)

    def status(self, sim_minute=None):
        if not self.active:
            return "closed"
        wait = self.wait_time_minutes(sim_minute)
        if wait < 8:
            return "normal"
        elif wait < 15:
            return "watch"
        else:
            return "critical"


class QueueSimulator:
    def __init__(self, facility_key="airport"):
        random.seed(42)
        self.sim_minute = 0
        self.facility_key = facility_key
        self.facility_info = FACILITY_PRESETS.get(facility_key, FACILITY_PRESETS["airport"])
        self.global_surge = 0.0
        self.is_paused = False
        self.counters = []
        self.action_history = []
        self.active_mode = "real_cv"  # "real_cv" | "simulation"
        self.load_preset(facility_key)

    def load_preset(self, facility_key):
        if facility_key not in FACILITY_PRESETS:
            facility_key = "airport"
        self.facility_key = facility_key
        self.facility_info = FACILITY_PRESETS[facility_key]
        self.sim_minute = 0
        self.global_surge = 0.0

        preset_counters = self.facility_info["counters"]
        self.counters = [
            Counter(
                c["id"],
                c["name"],
                base_service_rate=c["rate"],
                phase_offset=c["phase"]
            )
            for c in preset_counters
        ]

        self.log_action(f"Loaded facility preset: {self.facility_info['name']}", "system")

        for _ in range(15):
            self._advance()

    def log_action(self, description, category="operator"):
        timestamp = time.strftime("%H:%M:%S")
        self.action_history.insert(0, {
            "id": len(self.action_history) + 1,
            "timestamp": timestamp,
            "sim_minute": self.sim_minute,
            "description": description,
            "category": category
        })
        if len(self.action_history) > 50:
            self.action_history.pop()

    def _advance(self):
        for c in self.counters:
            # If in real CV mode and counter has real observation, don't overwrite with random wave
            is_real = self.active_mode == "real_cv" and c.last_source in ("image", "video", "camera", "manual", "computer_vision")
            c.tick(self.sim_minute, self.global_surge, force_wave=not is_real)
        self.sim_minute += 1

        if self.global_surge > 0:
            self.global_surge = max(0.0, self.global_surge - 0.2)

    def tick(self):
        if not self.is_paused:
            self._advance()

    def set_mode(self, mode):
        if mode in ("real_cv", "simulation"):
            self.active_mode = mode
            self.log_action(f"Switched system mode to: {mode.upper()}", "system")

    def add_counter(self, name=None, service_rate=4.5):
        new_id = f"c{len(self.counters) + 1}"
        default_name = f"Counter {len(self.counters) + 1} (Backup)"
        c = Counter(new_id, name or default_name, base_service_rate=service_rate, phase_offset=random.randint(0, 50))
        self.counters.append(c)
        self.log_action(f"Opened additional lane: {c.name}", "operational")
        return c

    def toggle_counter_active(self, counter_id, active_state=None):
        for c in self.counters:
            if c.id == counter_id:
                c.active = (not c.active) if active_state is None else bool(active_state)
                status_str = "Opened" if c.active else "Closed for maintenance"
                self.log_action(f"{status_str}: {c.name}", "operational")
                return c
        return None

    def redirect_people(self, from_id, to_id, count=5):
        from_c = next((c for c in self.counters if c.id == from_id), None)
        to_c = next((c for c in self.counters if c.id == to_id), None)

        if from_c and to_c and from_c.active and to_c.active:
            actual_shift = min(round(from_c.queue_length), count)
            from_c.queue_length = max(0.0, from_c.queue_length - actual_shift)
            to_c.queue_length += actual_shift
            self.log_action(
                f"Redirected {actual_shift} customers from {from_c.name} to {to_c.name}",
                "execution"
            )
            return True
        return False

    def inject_surge(self, surge_amount=3.0):
        self.global_surge += surge_amount
        self.log_action(f"Crowd surge event injected (+{surge_amount} arrivals/min)", "simulation")

    def set_service_rate(self, counter_id, new_rate):
        for c in self.counters:
            if c.id == counter_id:
                old_rate = c.base_service_rate
                c.base_service_rate = max(0.5, float(new_rate))
                self.log_action(f"Adjusted service rate for {c.name}: {old_rate} -> {c.base_service_rate} p/min", "config")
                return True
        return False

    def set_queue_length(self, counter_id, people_count, source="manual", input_type="image", confidence=0.9, extra_info=""):
        """
        Single Source of Truth queue length updater.
        Propagates count from Photo, Video, Live Camera, or Manual input onto Counter.queue_length.
        """
        for c in self.counters:
            if c.id == counter_id:
                count = max(0.0, float(people_count))
                c.queue_length = count
                c.last_source = source

                c.history.append((self.sim_minute, round(c.queue_length, 2)))
                if len(c.history) > 60:
                    c.history.pop(0)

                obs_entry = {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "sim_minute": self.sim_minute,
                    "counter_id": c.id,
                    "people_count": int(count),
                    "source": source,
                    "input_type": input_type,
                    "confidence": round(float(confidence), 3),
                    "estimated_wait_minutes": c.wait_time_minutes(self.sim_minute)
                }
                c.observations_log.append(obs_entry)
                if len(c.observations_log) > 50:
                    c.observations_log.pop(0)

                src_label = source.upper().replace('_', ' ')
                info_suffix = f" ({extra_info})" if extra_info else ""
                self.log_action(f"[{src_label}] Queue count updated: {c.name} → {int(count)} people{info_suffix}", "operational")
                return c
        return None

    def snapshot(self):
        total_people = sum(round(c.queue_length) for c in self.counters if c.active)
        active_counters = [c for c in self.counters if c.active]
        avg_wait = (
            sum(c.wait_time_minutes(self.sim_minute) for c in active_counters) / len(active_counters)
            if active_counters else 0.0
        )

        return {
            "facility_key": self.facility_key,
            "facility_name": self.facility_info["name"],
            "sim_minute": self.sim_minute,
            "is_paused": self.is_paused,
            "active_mode": self.active_mode,
            "generated_at": time.strftime("%H:%M:%S"),
            "summary": {
                "total_waiting": total_people,
                "avg_wait_min": round(avg_wait, 1),
                "active_counters": len(active_counters),
                "total_counters": len(self.counters),
                "global_surge": round(self.global_surge, 1),
            },
            "counters": [
                {
                    "id": c.id,
                    "name": c.name,
                    "active": c.active,
                    "people_waiting": round(c.queue_length),
                    "wait_time_min": c.wait_time_minutes(self.sim_minute),
                    "service_rate": round(c.base_service_rate, 1),
                    "status": c.status(self.sim_minute),
                    "history": c.history[-30:],
                    "total_served": round(c.total_served),
                    "last_source": getattr(c, "last_source", "simulation"),
                    "observations_count": len(c.observations_log),
                }
                for c in self.counters
            ]
        }
