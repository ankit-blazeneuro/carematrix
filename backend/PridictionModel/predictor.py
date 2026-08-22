from datetime import datetime
from typing import Dict, Any, Optional, List
from . import core

class PredictionWrapper:
    def __init__(self, data: Dict[str, Any]):
        self._raw = data
        pred = data.get("prediction", {})
        bor = data.get("bed_occupancy", {})
        opd = data.get("opd_load", {})
        ed = data.get("emergency_load", {})
        waits = data.get("waiting_times", {})
        alerts_raw = data.get("alerts", [])

        self.patients = pred.get("predicted", 0)
        self.low = pred.get("low", 0)
        self.high = pred.get("high", 0)
        self.confidence = pred.get("confidence_pct", 0.0)
        self.model_used = pred.get("model_used", "GBM")

        self.bor_current = bor.get("current_bor_pct", 0.0)
        self.bor_projected = bor.get("projected_bor_pct", 0.0)
        self.beds_total = bor.get("total_beds", 0)
        self.beds_occupied_now = bor.get("beds_occupied_now", 0)
        self.beds_new_admits = bor.get("new_admissions", 0)
        self.beds_free_after = bor.get("beds_free_after", 0)

        self.opd_pts_per_hour = opd.get("patients_per_hour", 0.0)
        self.opd_load_per_counter = opd.get("patients_per_counter_hr", 0.0)
        self.opd_load_per_doctor = opd.get("patients_per_doctor", 0.0)
        self.opd_counters_needed = opd.get("counters_needed", 1)
        self.opd_doctors_needed = opd.get("doctors_needed", 1)

        self.ed_util_pct = ed.get("utilization_pct", 0.0)
        self.ed_new_patients = ed.get("new_ed_patients", 0)

        self.wait_total = waits.get("total_wait_min", 0.0)
        self.wait_consultation = waits.get("consultation_min", 0.0)

        self.alerts = alerts_raw
        self.alert_messages = [a.get("message", "") for a in alerts_raw]
        self.has_danger = any(a.get("level") == "danger" for a in alerts_raw)
        self.has_warning = any(a.get("level") == "warning" for a in alerts_raw)

    def to_dict(self) -> Dict[str, Any]:
        return self._raw


def train(csv_file: Optional[str] = None, retrain: bool = False, climate: str = "semi_arid") -> Dict[str, Any]:
    return core.run_training(csv_path=csv_file, retrain=retrain, climate=climate)


def predict(date: Optional[str] = None, specialty: str = "all", env: Optional[Dict[str, Any]] = None, cap: Optional[Dict[str, Any]] = None, events: Optional[List[str]] = None) -> PredictionWrapper:
    dt_str = date or datetime.now().strftime("%Y-%m-%d")
    raw_res = core.predict_one(date_str=dt_str, facility=specialty, env=env, cap_override=cap, events=events)
    return PredictionWrapper(raw_res)


def forecast(days: int = 30, start: Optional[str] = None, specialty: str = "all", env: Optional[Dict[str, Any]] = None, cap: Optional[Dict[str, Any]] = None, events: Optional[List[str]] = None) -> List[PredictionWrapper]:
    raw_list = core.forecast_range(days=days, facility=specialty, start=start, env=env, cap_override=cap, events=events)
    return [PredictionWrapper(r) for r in raw_list]


def capacity_report(date: Optional[str] = None, cap: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    p = predict(date=date, cap=cap)
    return {
        "date": date or datetime.now().strftime("%Y-%m-%d"),
        "bed_occupancy": p._raw["bed_occupancy"],
        "opd_load": p._raw["opd_load"],
        "emergency_load": p._raw["emergency_load"],
        "waiting_times": p._raw["waiting_times"],
        "alerts": p.alerts
    }


def status() -> Dict[str, Any]:
    return core.get_status()


def model_info() -> Dict[str, Any]:
    return core.get_model_info()


def storage() -> Dict[str, Any]:
    return {
        "models_dir": core.MODELS_DIR,
        "data_dir": core.DATA_DIR,
        "logs_dir": core.LOGS_DIR,
        "exports_dir": core.EXPORTS_DIR
    }


def clear_all_data():
    core.clear_memory()
