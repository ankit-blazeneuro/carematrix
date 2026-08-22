import logging
from typing import Dict, Any

logger = logging.getLogger("carematrix.ml")

class SurgePredictionEngine:
    def __init__(self):
        # Baseline daily patient footfall rate per hospital
        self.base_footfall = 120

    def predict_influx(self, date_str: str, temp: float = 32.0, aqi: float = 160.0, rain: float = 5.0) -> int:
        multiplier = 1.0
        
        # Environmental impact multipliers
        if temp > 39.0:
            multiplier += 0.20  # Extreme heatwave (heatstroke & dehydration)
        elif temp < 5.0:
            multiplier += 0.12  # Extreme cold (hypothermia & severe respiratory)
        
        if aqi > 200.0:
            multiplier += 0.20  # Severe AQI (COPD & asthma emergency influx)
        elif aqi > 150.0:
            multiplier += 0.09  # Moderate AQI impact

        if rain > 50.0:
            multiplier -= 0.15  # Heavy rain delays routine walk-ins
        elif rain > 20.0:
            multiplier -= 0.07

        predicted = int(self.base_footfall * multiplier)
        return max(30, predicted)

    def calculate_wait_times(self, influx: int, total_beds: int, occupied_beds: int) -> Dict[str, Any]:
        # Projected Bed Occupancy Rate (BOR)
        bor = ((occupied_beds + (influx * 0.25)) / max(1, total_beds)) * 100.0
        
        # 6-stage simulated wait times in minutes
        t_transport = 15.0
        t_registration = 8.0 + (influx * 0.05)
        t_triage = 10.0 + (influx * 0.08)
        
        # Doctor utilization non-linear escalation equation
        doc_capacity = 25
        doctors_available = 4
        utilization = influx / max(1, (doctors_available * doc_capacity))
        t_consultation = 15.0 * (1.0 + (utilization ** 2))
        
        t_pharmacy = 12.0 + (influx * 0.04)
        t_billing = 10.0 + (influx * 0.03)

        total_wait = t_transport + t_registration + t_triage + t_consultation + t_pharmacy + t_billing

        # Emergency Department (ED) triage breakdown
        ed_triage = {
            "Immediate_Resuscitation": max(1, int(influx * 0.05)),
            "Very_Urgent": max(2, int(influx * 0.15)),
            "Urgent": max(5, int(influx * 0.35)),
            "Standard": max(5, int(influx * 0.45))
        }

        status = "NORMAL"
        if bor >= 85.0:
            status = "CRITICAL"
        elif bor >= 70.0:
            status = "HIGH_LOAD"

        return {
            "predicted_influx": influx,
            "bor_projected_pct": round(bor, 2),
            "status": status,
            "ed_triage_breakdown": ed_triage,
            "simulated_wait_times_minutes": {
                "transport": round(t_transport, 1),
                "registration": round(t_registration, 1),
                "triage": round(t_triage, 1),
                "consultation": round(t_consultation, 1),
                "pharmacy": round(t_pharmacy, 1),
                "billing": round(t_billing, 1)
            },
            "total_wait_time_minutes": round(total_wait, 1)
        }

ml_engine = SurgePredictionEngine()
