export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'online' | 'offline';
}

export interface DepartmentCapacity {
  department: string;
  total: number;
  available: number;
}

export interface HospitalInfo extends Hospital {
  short?: string;
  location?: string;
  capacities: DepartmentCapacity[];
}

export interface PatientTransfer {
  id: string;
  department: string;
  priority: 'Critical' | 'High' | 'Moderate' | 'Low' | 'Medium';
  lat?: number;
  lng?: number;
  requester_hospital_id?: string;
  requester_hospital_name?: string;
  hospital_name?: string;
  assigned?: number;
  status: 'PENDING' | 'ACCEPTED_PENDING' | 'CONFIRMED' | 'DENIED' | 'DECLINED' | 'open' | 'accepted_pending' | 'fulfilled' | 'cancelled';
  created_at?: number;
  receivedAt?: string;
}

export interface TransferResponse {
  id?: number | string;
  patient_id?: string;
  hospital_id: string;
  hospital_name?: string;
  name?: string;
  lat?: number;
  lng?: number;
  status?: 'accepted' | 'rejected' | 'denied_by_source' | 'confirmed';
  decided?: boolean;
  timestamp?: number;
}

export interface RegisteredPatient {
  patientId: string;
  name: string;
  department: string;
  priority: string;
  matches: { hospital_id: string; name: string; decided: boolean }[];
  confirmed: string | null;
}

export interface AdmittedRecord {
  id: string;
  department: string;
  priority: string;
  admittedAt: string;
}

export interface ResourceRequest {
  id: string;
  requester_hospital_id: string;
  requester_hospital_name?: string;
  resource_type: string;
  quantity: number;
  status: 'open' | 'fulfilled';
  timestamp: number;
}

export interface ResourcePoolEntry {
  hospital: string;
  hospital_id: string;
  distance_km: number;
  resources: { type: string; available: number; icon: string }[];
}

export interface SurgeAlert {
  id: string;
  level: 'HIGH' | 'MODERATE' | 'LOW';
  code: string;
  message: string;
  source: string;
}

export interface PredictionResponse {
  prediction: {
    date: string;
    facility: string;
    predicted: number;
    low: number;
    high: number;
    confidence_pct: number;
    model_used: string;
    ml_blend_pct: number;
    season_used: string;
  };
  bed_occupancy: {
    total_beds: number;
    current_occupied: number;
    new_admissions: number;
    projected_occupied: number;
    beds_free_now: number;
    beds_free_after: number;
    current_bor_pct: number;
    projected_bor_pct: number;
    over_capacity: boolean;
    status: string;
    nhm_target_pct: number;
  };
  opd_load: {
    patients_per_hour: number;
    patients_per_hr_per_ctr: number;
    patients_per_doctor: number;
    counters_available: number;
    counters_needed: number;
    doctors_available: number;
    doctors_needed: number;
    counter_status: string;
    doctor_status: string;
    counter_util_pct: number;
    nhm_ctr_norm_min: number;
    nhm_ctr_norm_max: number;
  };
  emergency_load: {
    ed_beds: number;
    ed_occupied_now: number;
    opd_transfers: number;
    direct_walkins: number;
    new_ed_patients: number;
    projected_occupied: number;
    utilisation_pct: number;
    triage_immediate: number;
    triage_urgent: number;
    triage_non_urgent: number;
    triage_observation: number;
    status: string;
  };
  waiting_times: {
    transport: number;
    registration: number;
    triage: number;
    consultation: number;
    pharmacy: number;
    billing: number;
    total: number;
    bed_delay_mult?: number;
    effective_doctors?: number;
  };
  alerts: { level: string; code: string; message: string }[];
}

export interface MLPrediction {
  hospital_id: string;
  date: string;
  predicted_influx: number;
  bor_projected_pct: number;
  status: 'NORMAL' | 'HIGH_LOAD' | 'CRITICAL';
  ed_triage_breakdown: Record<string, number>;
  simulated_wait_times_minutes: {
    transport: number;
    registration: number;
    triage?: number;
    t_triage?: number;
    consultation: number;
    pharmacy: number;
    billing: number;
  };
  total_wait_time_minutes: number;
}

export interface HeatmapHospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  total_beds: number;
  available_beds: number;
  demand_pct: number;
  total?: number;
  available?: number;
  demand?: number;
}

export interface SwytchcodeLog {
  id: string;
  timestamp: number;
  time_iso: string;
  method: string;
  payload: Record<string, any>;
  status: string;
  details: string;
  engine: string;
}
