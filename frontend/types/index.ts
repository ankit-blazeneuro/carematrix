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
  capacities: DepartmentCapacity[];
}

export interface PatientTransfer {
  id: string;
  department: string;
  priority: 'High' | 'Medium' | 'Low';
  lat: number;
  lng: number;
  assigned: number;
  status: 'open' | 'fulfilled' | 'cancelled';
  created_at: number;
}

export interface TransferResponse {
  id: number;
  patient_id: string;
  hospital_id: string;
  hospital_name?: string;
  lat?: number;
  lng?: number;
  status: 'accepted' | 'rejected' | 'denied_by_source';
  timestamp: number;
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
