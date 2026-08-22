import os
import glob
import json
import math
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple, Union

import pandas as pd
import numpy as np
import joblib

from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.neighbors import KNeighborsRegressor
from sklearn.linear_model import Ridge
from sklearn.tree import DecisionTreeRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

logger = logging.getLogger("carematrix.prediction_engine")

# Define base paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "data")
LOGS_DIR = os.path.join(BASE_DIR, "logs")
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")

# Ensure required directories exist
for path in [MODELS_DIR, DATA_DIR, LOGS_DIR, EXPORTS_DIR]:
    os.makedirs(path, exist_ok=True)

# Climate Priors
CLIMATE_PRIORS = {
    "semi_arid": [1.00, 0.96, 0.93, 1.04, 1.18, 1.22, 1.06, 0.97, 0.93, 1.01, 1.06, 1.08],
    "tropical": [1.00, 0.97, 0.95, 1.04, 1.14, 1.08, 0.96, 0.93, 0.92, 0.98, 1.06, 1.08],
    "temperate": [1.08, 1.05, 0.98, 0.96, 0.95, 0.97, 1.00, 0.98, 1.02, 1.08, 1.12, 1.14],
    "cold": [1.18, 1.15, 1.06, 0.95, 0.92, 0.90, 0.88, 0.90, 0.95, 1.05, 1.14, 1.20],
    "equatorial": [1.00] * 12
}

SPECIALTY_MODEL_PRIORS = {
    "dental": "RF",
    "general medicine": "GBM",
    "ent": "GBM",
    "orthopaedic": "RF",
    "emergency": "GBM",
    "obstetrics": "RF",
    "paediatrics": "GBM",
    "cardiology": "GBM",
    "surgery": "GBM",
    "ophthalmology": "RF",
    "dermatology": "GBM",
    "psychiatry": "GBM"
}

COLUMN_MAPS = {
    "_date": ["date", "day", "dt", "timestamp", "created", "visit_date"],
    "_patients": ["patient", "count", "visit", "arriv", "total", "cases", "attend", "volume", "opd", "admission"],
    "_facility": ["facility", "spec", "dept", "site", "unit", "depart", "clinic", "hosp", "ward", "service", "speciality"],
    "_hour": ["hour", "hh", "hr", "time"],
    "_temp": ["temp", "celsius", "fahrenheit", "tmax", "tmin", "temperature"],
    "_aqi": ["aqi", "air", "pm2", "pm10", "pollution"],
    "_rain": ["rain", "precip", "mm", "rainfall"],
    "_holiday": ["holiday", "hol", "flag", "closed", "public"],
    "_revisit": ["revisit", "repeat", "return", "follow", "reattend"],
    "_lagged": ["lag", "yesterday", "prev", "prior", "last_day"],
    "_doctors": ["doctor", "doc", "physician", "staff", "clinician", "md"],
    "_counters": ["counter", "window", "desk", "registration_point"],
    "_beds_occ": ["bed_occ", "beds_used", "occupied_bed", "ipd_occ", "census"]
}


def _match_column(col_name: str) -> Optional[str]:
    clean = col_name.lower().strip()
    for internal_name, keywords in COLUMN_MAPS.items():
        for kw in keywords:
            if kw in clean:
                return internal_name
    return None


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {}
    for col in df.columns:
        matched = _match_column(col)
        if matched and matched not in renamed.values():
            renamed[col] = matched

    norm_df = df.rename(columns=renamed).copy()

    # Ensure required columns exist
    if "_date" not in norm_df.columns:
        raise ValueError("CSV must contain a recognizable date column.")
    if "_patients" not in norm_df.columns:
        raise ValueError("CSV must contain a recognizable patient count column.")

    # Parse date
    norm_df["_date"] = pd.to_datetime(norm_df["_date"], errors="coerce")
    norm_df = norm_df.dropna(subset=["_date"]).sort_values("_date")

    # Numeric conversions
    norm_df["_patients"] = pd.to_numeric(norm_df["_patients"], errors="coerce").fillna(0).astype(float)

    # Optional defaults
    defaults = {
        "_facility": "general medicine",
        "_hour": 10,
        "_temp": 32.0,
        "_aqi": 160.0,
        "_rain": 5.0,
        "_holiday": 0,
        "_revisit": 0.0,
        "_lagged": None,
        "_doctors": 5,
        "_counters": 3,
        "_beds_occ": 70
    }

    for col, default_val in defaults.items():
        if col not in norm_df.columns:
            norm_df[col] = default_val
        else:
            if col != "_facility":
                norm_df[col] = pd.to_numeric(norm_df[col], errors="coerce").fillna(default_val)
            else:
                norm_df[col] = norm_df[col].fillna("general medicine").astype(str).str.lower()

    # Fill lagged counts if missing
    if norm_df["_lagged"].isnull().any():
        norm_df["_lagged"] = norm_df["_patients"].shift(1).fillna(norm_df["_patients"].mean())

    return norm_df


def extract_features(df: pd.DataFrame, stats: Dict[str, Any], climate: str = "semi_arid") -> np.ndarray:
    features = []
    climate_profile = CLIMATE_PRIORS.get(climate.lower(), CLIMATE_PRIORS["semi_arid"])
    global_mean = max(1.0, stats.get("global_mean", 120.0))

    for _, row in df.iterrows():
        dt = row["_date"]
        dow = dt.weekday()  # 0-6
        month = dt.month  # 1-12
        dom = dt.day  # 1-31
        hour = float(row.get("_hour", 10))
        temp = float(row.get("_temp", 32.0))
        aqi = float(row.get("_aqi", 160.0))
        rain = float(row.get("_rain", 5.0))
        holiday = float(row.get("_holiday", 0))
        revisit = float(row.get("_revisit", 0.0))
        lagged = float(row.get("_lagged", global_mean))
        doctors = float(row.get("_doctors", 5))

        f1 = dow / 6.0
        f2 = (month - 1) / 11.0
        f3 = (dom - 1) / 30.0
        f4 = lagged / global_mean
        f5 = revisit / max(1.0, global_mean)
        f6 = 1.0 if holiday > 0 else 0.0
        f7 = hour / 23.0
        f8 = 1.0 if 6 <= hour <= 11 else 0.0
        f9 = np.clip((temp + 20.0) / 75.0, 0.0, 1.0)
        f10 = np.clip(aqi / 500.0, 0.0, 1.0)
        f11 = np.clip(rain / 150.0, 0.0, 1.0)
        f12 = climate_profile[month - 1]
        f13 = float(row["_patients"]) / max(1.0, doctors) if "_patients" in row else global_mean / max(1.0, doctors)
        f14 = 1.0 if dow >= 5 else 0.0
        f15 = 1.0 if month in [5, 6, 11, 12] else 0.0
        f16 = 1.0 if dom <= 7 else 0.0
        f17 = min(2.0, lagged / max(1.0, global_mean))

        feat_vector = [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15, f16, f17]
        features.append(feat_vector)

    return np.array(features)


def run_training(
    csv_path: Optional[str] = None,
    csv_bytes: Optional[bytes] = None,
    retrain: bool = False,
    climate: str = "semi_arid",
    n_jobs: int = -1,
    capacity_defaults: Optional[Dict[str, Any]] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    progress_callback: Optional[Any] = None
) -> Dict[str, Any]:

    if csv_path and os.path.exists(csv_path):
        raw_df = pd.read_csv(csv_path)
    elif csv_bytes:
        import io
        raw_df = pd.read_csv(io.BytesIO(csv_bytes))
    else:
        # Fallback to finding latest session CSV in data/
        session_files = sorted(glob.glob(os.path.join(DATA_DIR, "session_*.csv")))
        if session_files:
            raw_df = pd.read_csv(session_files[-1])
        else:
            raise FileNotFoundError("No CSV provided and no existing session files found in data/")

    norm_df = normalize_dataframe(raw_df)

    if from_date:
        norm_df = norm_df[norm_df["_date"] >= pd.to_datetime(from_date)]
    if to_date:
        norm_df = norm_df[norm_df["_date"] <= pd.to_datetime(to_date)]

    # If retrain, merge previous sessions
    if retrain:
        previous_files = glob.glob(os.path.join(DATA_DIR, "session_*.csv"))
        for p_file in previous_files:
            try:
                prev_df = normalize_dataframe(pd.read_csv(p_file))
                norm_df = pd.concat([norm_df, prev_df], ignore_index=True)
            except Exception:
                pass
        norm_df = norm_df.drop_duplicates(subset=["_date", "_facility"]).sort_values("_date")

    if len(norm_df) < 10:
        raise ValueError(f"Insufficient training data. Found {len(norm_df)} rows, minimum 10 required.")

    # Calculate global stats
    patients_series = norm_df["_patients"]
    global_mean = float(patients_series.mean())
    global_std = float(patients_series.std()) if len(patients_series) > 1 else 1.0

    # Multipliers
    dow_groups = norm_df.groupby(norm_df["_date"].dt.weekday)["_patients"].mean()
    dow_mults = {int(k): float(v / max(1.0, global_mean)) for k, v in dow_groups.items()}

    month_groups = norm_df.groupby(norm_df["_date"].dt.month)["_patients"].mean()
    month_mults = {int(k): float(v / max(1.0, global_mean)) for k, v in month_groups.items()}

    dom_groups = norm_df.groupby(norm_df["_date"].dt.day)["_patients"].mean()
    dom_mults = {int(k): float(v / max(1.0, global_mean)) for k, v in dom_groups.items()}

    hol_series = norm_df[norm_df["_holiday"] == 1]["_patients"]
    holiday_mult = float(hol_series.mean() / max(1.0, global_mean)) if len(hol_series) > 0 else 0.82

    facilities = norm_df["_facility"].unique().tolist()
    avg_doctors = float(norm_df["_doctors"].mean()) if "_doctors" in norm_df else 5.0
    avg_counters = float(norm_df["_counters"].mean()) if "_counters" in norm_df else 3.0

    stats = {
        "global_mean": round(global_mean, 2),
        "global_std": round(global_std, 2),
        "total_rows": len(norm_df),
        "dow_mults": dow_mults,
        "month_mults": month_mults,
        "dom_mults": dom_mults,
        "holiday_mult": round(holiday_mult, 3),
        "facilities": facilities,
        "avg_doctors": avg_doctors,
        "avg_counters": avg_counters,
        "last_trained_at": datetime.now().isoformat()
    }

    # Extract 17 features
    X = extract_features(norm_df, stats, climate)
    y = norm_df["_patients"].values

    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)

    # 80/20 Chronological Split
    split_idx = int(len(X_scaled) * 0.8)
    X_train, X_val = X_scaled[:split_idx], X_scaled[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]

    # Regressors dictionary
    candidate_models = {
        "GBM": GradientBoostingRegressor(n_estimators=100, random_state=42),
        "RF": RandomForestRegressor(n_estimators=100, random_state=42),
        "KNN": KNeighborsRegressor(n_neighbors=min(5, max(1, len(X_train)))),
        "Ridge": Ridge(alpha=1.0),
        "DT": DecisionTreeRegressor(max_depth=6, random_state=42)
    }

    evaluated_metrics = {}
    trained_models = {}

    for name, model in candidate_models.items():
        model.fit(X_train, y_train)
        preds = model.predict(X_val)
        mae = float(mean_absolute_error(y_val, preds))
        rmse = float(np.sqrt(mean_squared_error(y_val, preds)))
        mape = float(np.mean(np.abs((y_val - preds) / np.maximum(1, y_val)))) * 100.0
        r2 = float(r2_score(y_val, preds)) if len(y_val) > 1 else 1.0

        evaluated_metrics[name] = {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "mape": round(mape, 2),
            "r2": round(r2, 3),
            "accuracy": round(max(0.0, 100.0 - mape), 2)
        }
        trained_models[name] = model

    # Pick best global model by lowest MAE
    best_global_name = min(evaluated_metrics, key=lambda k: evaluated_metrics[k]["mae"])
    stats["best_global_model"] = best_global_name
    stats["evaluated_metrics"] = evaluated_metrics

    # Per-specialty best routing
    spec_best = {}
    for spec in facilities:
        if spec in SPECIALTY_MODEL_PRIORS:
            spec_best[spec] = SPECIALTY_MODEL_PRIORS[spec]
        else:
            spec_best[spec] = best_global_name

    bundle = {
        "trained_models": trained_models,
        "scaler": scaler,
        "spec_best": spec_best,
        "best_global_name": best_global_name
    }

    # Persist files
    joblib.dump(bundle, os.path.join(MODELS_DIR, "ensemble.pkl"))
    with open(os.path.join(MODELS_DIR, "stats.json"), "w") as f:
        json.dump(stats, f, indent=2)

    session_id = f"session_{len(glob.glob(os.path.join(DATA_DIR, 'session_*.csv'))) + 1:04d}"
    saved_csv_path = os.path.join(DATA_DIR, f"{session_id}.csv")
    norm_df.to_csv(saved_csv_path, index=False)

    memory_data = {
        "active_session": session_id,
        "last_trained": datetime.now().isoformat(),
        "total_sessions": len(glob.glob(os.path.join(DATA_DIR, "session_*.csv"))),
        "climate": climate
    }
    with open(os.path.join(MODELS_DIR, "memory.json"), "w") as f:
        json.dump(memory_data, f, indent=2)

    logger.info(f"ML Training Complete. Session: {session_id}, Best Model: {best_global_name} (MAE: {evaluated_metrics[best_global_name]['mae']})")
    return stats


def predict_one(
    date_str: str,
    facility: str = "all",
    season: str = "auto",
    env: Optional[Dict[str, Any]] = None,
    cap_override: Optional[Dict[str, Any]] = None,
    events: Optional[List[str]] = None
) -> Dict[str, Any]:

    ensemble_path = os.path.join(MODELS_DIR, "ensemble.pkl")
    stats_path = os.path.join(MODELS_DIR, "stats.json")

    # Auto-train on default/latest data if model files are missing
    if not os.path.exists(ensemble_path) or not os.path.exists(stats_path):
        sample_csv = os.path.join(DATA_DIR, "hospital123.csv")
        if not os.path.exists(sample_csv):
            _create_default_sample_csv(sample_csv)
        run_training(csv_path=sample_csv)

    bundle = joblib.load(ensemble_path)
    with open(stats_path, "r") as f:
        stats = json.load(f)

    # 1. Choose model
    model_name = bundle.get("best_global_name", "GBM")
    clean_fac = facility.lower().strip()
    if clean_fac != "all" and clean_fac in bundle.get("spec_best", {}):
        model_name = bundle["spec_best"][clean_fac]

    model = bundle["trained_models"].get(model_name, list(bundle["trained_models"].values())[0])

    # 2. Synthetic feature row
    dt = pd.to_datetime(date_str)
    env_dict = env or {}
    temp = float(env_dict.get("temperature", 32.0))
    aqi = float(env_dict.get("aqi", 160.0))
    rain = float(env_dict.get("rainfall", 5.0))
    humidity = float(env_dict.get("humidity", 60.0))
    hour = float(env_dict.get("hour", 10))
    holiday = 1 if (env_dict.get("holiday") or (events and "holiday" in events)) else 0
    revisit = float(env_dict.get("revisit_pct", 15.0))
    lagged = float(env_dict.get("lagged", stats.get("global_mean", 120.0)))
    doctors = float(env_dict.get("doctors", stats.get("avg_doctors", 5)))

    synth_df = pd.DataFrame([{
        "_date": dt,
        "_facility": clean_fac if clean_fac != "all" else "general medicine",
        "_hour": hour,
        "_temp": temp,
        "_aqi": aqi,
        "_rain": rain,
        "_holiday": holiday,
        "_revisit": revisit,
        "_lagged": lagged,
        "_doctors": doctors,
        "_patients": stats.get("global_mean", 120.0)
    }])

    X_feat = extract_features(synth_df, stats)
    X_scaled = bundle["scaler"].transform(X_feat)

    # 3. Model Prediction
    raw_ml_pred = float(model.predict(X_scaled)[0])

    # 4. Pattern-based Baseline Blend
    dow = dt.weekday()
    month = dt.month
    dom = dt.day

    dow_mult = stats.get("dow_mults", {}).get(str(dow), stats.get("dow_mults", {}).get(dow, 1.0))
    month_mult = stats.get("month_mults", {}).get(str(month), stats.get("month_mults", {}).get(month, 1.0))
    dom_mult = stats.get("dom_mults", {}).get(str(dom), stats.get("dom_mults", {}).get(dom, 1.0))

    baseline = stats.get("global_mean", 120.0) * dow_mult * month_mult * dom_mult
    total_rows = stats.get("total_rows", 100)
    blend_weight = min(0.75, total_rows / 500.0)

    blended_pred = (raw_ml_pred * blend_weight) + (baseline * (1.0 - blend_weight))

    # 5. Weather Adjustments
    weather_factor = 1.0
    if temp > 39.0:
        weather_factor += 0.10 + ((temp - 39.0) * 0.02)
    elif temp < 5.0:
        weather_factor += 0.08

    if aqi > 200.0:
        weather_factor += 0.18
    elif aqi > 150.0:
        weather_factor += 0.09
    elif aqi > 100.0:
        weather_factor += 0.04

    if rain > 50.0:
        weather_factor -= 0.15
    elif rain > 20.0:
        weather_factor -= 0.07

    if humidity > 85.0:
        weather_factor += 0.05

    adjusted_pred = blended_pred * weather_factor

    # 6. Event Multipliers
    event_list = events or []
    event_mult = 1.0
    if "holiday" in event_list or holiday:
        event_mult *= stats.get("holiday_mult", 0.82)
    if "festival" in event_list:
        event_mult *= 1.13
    if "heatwave" in event_list:
        event_mult *= 1.25
    if "flu_peak" in event_list:
        event_mult *= 1.30
    if "rain_heavy" in event_list:
        event_mult *= 0.86
    if "long_weekend" in event_list:
        event_mult *= 0.80
    if "epidemic" in event_list:
        event_mult *= 1.35
    if "mass_event" in event_list:
        event_mult *= 1.10

    final_predicted = int(max(1, round(adjusted_pred * event_mult)))

    # 7. Uncertainty Bounds
    low_bound = int(max(1, round(final_predicted * 0.91)))
    high_bound = int(round(final_predicted * 1.09))
    confidence_pct = round(min(94.0, max(65.0, 90.0 - abs(final_predicted - stats.get("global_mean", 120.0)) * 0.05)), 1)

    # Capacity Computations
    cap_dict = cap_override or {}
    bor_res = calc_bor(final_predicted, cap_dict)
    opd_res = calc_opd_load(final_predicted, cap_dict)
    ed_res = calc_ed_load(final_predicted, cap_dict)
    waits_res = calc_wait_times(final_predicted, cap_dict, env_dict)
    alerts_list = _build_alerts(final_predicted, stats.get("global_mean", 120.0), bor_res, opd_res, ed_res, waits_res, env_dict)

    return {
        "prediction": {
            "date": date_str,
            "facility": facility,
            "predicted": final_predicted,
            "low": low_bound,
            "high": high_bound,
            "confidence_pct": confidence_pct,
            "model_used": model_name,
            "ml_blend_pct": round(blend_weight * 100.0, 1),
            "season_used": season
        },
        "bed_occupancy": bor_res,
        "opd_load": opd_res,
        "emergency_load": ed_res,
        "waiting_times": waits_res,
        "alerts": alerts_list,
        "inputs_used": {
            "env": env_dict,
            "cap": cap_dict,
            "events": event_list,
            "season": season
        }
    }


def calc_bor(predicted: int, cap: Dict[str, Any]) -> Dict[str, Any]:
    total_beds = int(cap.get("totalBeds", 100))
    beds_occ_now = int(cap.get("bedsOccupied", int(total_beds * 0.72)))
    admit_rate = float(cap.get("admitRate", 8.0))

    new_admissions = int(round(predicted * (admit_rate / 100.0)))
    proj_occ = min(total_beds, beds_occ_now + new_admissions)

    current_bor = round((beds_occ_now / max(1, total_beds)) * 100.0, 1)
    proj_bor = round((proj_occ / max(1, total_beds)) * 100.0, 1)

    free_now = max(0, total_beds - beds_occ_now)
    free_after = max(0, total_beds - proj_occ)
    over_cap = (beds_occ_now + new_admissions) > total_beds

    status = "very_low"
    if proj_bor >= 95.0:
        status = "critical"
    elif proj_bor >= 80.0:
        status = "target"
    elif proj_bor >= 60.0:
        status = "low"

    return {
        "total_beds": total_beds,
        "beds_occupied_now": beds_occ_now,
        "new_admissions": new_admissions,
        "projected_occupied": proj_occ,
        "current_bor_pct": current_bor,
        "projected_bor_pct": proj_bor,
        "beds_free_now": free_now,
        "beds_free_after": free_after,
        "over_capacity": over_cap,
        "status": status
    }


def calc_opd_load(predicted: int, cap: Dict[str, Any]) -> Dict[str, Any]:
    opd_hrs = float(cap.get("opdHrs", 6.0))
    counters = int(cap.get("counters", 3))
    doctors = int(cap.get("doctors", 5))

    pts_per_hr = round(predicted / max(1.0, opd_hrs), 1)
    pts_per_hr_per_counter = round(pts_per_hr / max(1, counters), 1)
    pts_per_doctor = round(predicted / max(1, doctors), 1)

    # NHM Norm: max 20 pts/hr/counter
    counters_needed = int(math.ceil(pts_per_hr / 20.0))
    # Safe norm: 20 pts/doctor/day
    doctors_needed = int(math.ceil(predicted / 20.0))

    counter_status = "ok"
    if pts_per_hr_per_counter > 20.0:
        counter_status = "over"
    elif pts_per_hr_per_counter < 12.0:
        counter_status = "low"

    doc_status = "ok"
    if pts_per_doctor > 30.0:
        doc_status = "over"
    elif pts_per_doctor > 20.0:
        doc_status = "warn"

    return {
        "opd_hours": opd_hrs,
        "counters_available": counters,
        "doctors_available": doctors,
        "patients_per_hour": pts_per_hr,
        "patients_per_counter_hr": pts_per_hr_per_counter,
        "patients_per_doctor": pts_per_doctor,
        "counters_needed": max(1, counters_needed),
        "doctors_needed": max(1, doctors_needed),
        "counter_status": counter_status,
        "doctor_status": doc_status
    }


def calc_ed_load(predicted: int, cap: Dict[str, Any]) -> Dict[str, Any]:
    ed_beds = int(cap.get("edBeds", 20))
    ed_occ = int(cap.get("edOccupied", 12))
    ed_rate = float(cap.get("edRate", 3.0))

    opd_transfers = int(round(predicted * (ed_rate / 100.0)))
    direct_walkins = int(round(ed_beds * 0.40))
    new_ed_total = opd_transfers + direct_walkins
    proj_ed_occ = min(ed_beds, ed_occ + new_ed_total)
    util_pct = round((proj_ed_occ / max(1, ed_beds)) * 100.0, 1)

    immediate = max(1, int(round(new_ed_total * 0.05)))
    urgent = max(1, int(round(new_ed_total * 0.25)))
    non_urgent = max(1, int(round(new_ed_total * 0.65)))
    observation = max(0, new_ed_total - (immediate + urgent + non_urgent))

    status = "normal"
    if util_pct >= 95.0:
        status = "critical"
    elif util_pct >= 80.0:
        status = "high"
    elif util_pct >= 60.0:
        status = "moderate"

    return {
        "ed_beds_total": ed_beds,
        "ed_occupied_now": ed_occ,
        "opd_transfers": opd_transfers,
        "direct_walkins": direct_walkins,
        "new_ed_patients": new_ed_total,
        "projected_ed_occupancy": proj_ed_occ,
        "utilization_pct": util_pct,
        "triage_split": {
            "immediate": immediate,
            "urgent": urgent,
            "non_urgent": non_urgent,
            "observation": observation
        },
        "status": status
    }


def calc_wait_times(predicted: int, cap: Dict[str, Any], env: Dict[str, Any]) -> Dict[str, Any]:
    counters = int(cap.get("counters", 3))
    doctors = int(cap.get("doctors", 5))
    staffing = float(env.get("staffing_pct", 100.0)) / 100.0

    eff_docs = max(1.0, doctors * staffing)
    opd_hrs = float(cap.get("opdHrs", 6.0))
    rate = predicted / max(1.0, opd_hrs)

    t_transport = 22.0
    t_reg = 15.0 * (1.0 + (rate / max(1.0, counters * 20.0)))
    t_triage = 8.0 * (1.0 + (rate / max(1.0, eff_docs * 10.0)))
    t_consult = 60.0 * (1.0 + ((rate / max(1.0, eff_docs * 5.0)) ** 2))
    t_pharmacy = 20.0 * (1.0 + (rate / max(1.0, counters * 15.0)))
    t_billing = 35.0 * (1.0 + (rate / max(1.0, counters * 18.0)))

    total_wait = t_transport + t_reg + t_triage + t_consult + t_pharmacy + t_billing

    return {
        "transport_min": round(t_transport, 1),
        "registration_min": round(t_reg, 1),
        "triage_min": round(t_triage, 1),
        "consultation_min": round(t_consult, 1),
        "pharmacy_min": round(t_pharmacy, 1),
        "billing_min": round(t_billing, 1),
        "total_wait_min": round(total_wait, 1),
        "effective_doctors": round(eff_docs, 1)
    }


def _build_alerts(predicted: int, mean_val: float, bor: Dict[str, Any], opd: Dict[str, Any], ed: Dict[str, Any], waits: Dict[str, Any], env: Dict[str, Any]) -> List[Dict[str, Any]]:
    alerts = []

    if predicted > 1.4 * mean_val:
        alerts.append({
            "level": "warning",
            "code": "high_influx",
            "message": f"High Patient Surge Expected: {predicted} patients (+{round(((predicted-mean_val)/mean_val)*100)}% over average)."
        })

    if opd["counter_status"] == "over":
        alerts.append({
            "level": "warning",
            "code": "counter_overload",
            "message": f"OPD Counters Overloaded: {opd['patients_per_counter_hr']} pts/hr/counter (Capacity: {opd['counters_needed']} counters needed)."
        })

    if opd["doctor_status"] == "over":
        alerts.append({
            "level": "danger",
            "code": "doctor_overload",
            "message": f"Critical Doctor Overload: {opd['patients_per_doctor']} patients per doctor (Recommended max: 20)."
        })

    if bor["over_capacity"]:
        alerts.append({
            "level": "danger",
            "code": "bed_over_capacity",
            "message": f"Bed Capacity Exceeded: Projected occupancy {bor['projected_bor_pct']}% ({bor['projected_occupied']}/{bor['total_beds']} beds)."
        })
    elif bor["projected_bor_pct"] >= 90.0:
        alerts.append({
            "level": "warning",
            "code": "bed_near_critical",
            "message": f"Bed Occupancy Near Critical: {bor['projected_bor_pct']}% projected occupancy."
        })

    if ed["status"] == "critical":
        alerts.append({
            "level": "danger",
            "code": "ed_critical",
            "message": f"Emergency Department Critical: {ed['utilization_pct']}% utilization."
        })

    if waits["consultation_min"] > 90.0:
        alerts.append({
            "level": "warning",
            "code": "long_wait",
            "message": f"Severe Doctor Consultation Wait Time: {waits['consultation_min']} minutes."
        })

    aqi = float(env.get("aqi", 0))
    if aqi > 150.0:
        alerts.append({
            "level": "info",
            "code": "high_aqi",
            "message": f"Elevated AQI ({aqi}): Expect increased respiratory emergencies."
        })

    if not alerts:
        alerts.append({
            "level": "ok",
            "code": "nominal",
            "message": "Hospital operational load and bed occupancy within standard limits."
        })

    return alerts


def forecast_range(days: int = 30, facility: str = "all", start: Optional[str] = None, env: Optional[Dict[str, Any]] = None, cap_override: Optional[Dict[str, Any]] = None, events: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    start_dt = pd.to_datetime(start) if start else datetime.now()
    results = []
    for i in range(days):
        cur_date = (start_dt + timedelta(days=i)).strftime("%Y-%m-%d")
        res = predict_one(date_str=cur_date, facility=facility, env=env, cap_override=cap_override, events=events)
        results.append(res)
    return results


def get_status() -> Dict[str, Any]:
    ensemble_exists = os.path.exists(os.path.join(MODELS_DIR, "ensemble.pkl"))
    stats_exists = os.path.exists(os.path.join(MODELS_DIR, "stats.json"))
    return {
        "engine_ready": ensemble_exists and stats_exists,
        "models_dir": MODELS_DIR,
        "data_dir": DATA_DIR,
        "status": "ONLINE" if (ensemble_exists and stats_exists) else "UNINITIALIZED"
    }


def get_model_info() -> Dict[str, Any]:
    stats_path = os.path.join(MODELS_DIR, "stats.json")
    if os.path.exists(stats_path):
        with open(stats_path, "r") as f:
            return json.load(f)
    return {"error": "Model has not been trained yet."}


def clear_memory():
    for folder in [MODELS_DIR, DATA_DIR, LOGS_DIR, EXPORTS_DIR]:
        for f in glob.glob(os.path.join(folder, "*")):
            try:
                os.remove(f)
            except Exception:
                pass
    logger.info("Cleared all model memory and data sessions.")


def _create_default_sample_csv(target_path: str):
    dates = pd.date_range(end=datetime.now(), periods=60, freq="D")
    data = []
    np.random.seed(42)
    for dt in dates:
        base = 120 + np.random.randint(-20, 30)
        data.append({
            "date": dt.strftime("%Y-%m-%d"),
            "hour": 10,
            "patients": base,
            "specialty": "general medicine",
            "temperature": 32 + np.random.randint(-5, 5),
            "aqi": 160 + np.random.randint(-30, 40),
            "rainfall": 5,
            "holiday": 1 if dt.weekday() == 6 else 0,
            "revisit": 15,
            "doctors": 5,
            "counters": 3,
            "beds_occ": 72
        })
    df = pd.DataFrame(data)
    df.to_csv(target_path, index=False)
