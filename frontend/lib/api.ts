import {
  HospitalInfo,
  PatientTransfer,
  TransferResponse,
  ResourceRequest,
  ResourcePoolEntry,
  SurgeAlert,
  PredictionResponse,
  HeatmapHospital,
  SwytchcodeLog,
} from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchWithFallback<T>(
  endpoint: string,
  options?: RequestInit,
  mockFallback?: () => T
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (mockFallback) return mockFallback();
    throw err;
  }
}

function normalizePrediction(raw: any, date: string): PredictionResponse {
  if (!raw) return getMockPrediction(date);

  const full = raw.full_prediction_details || raw;

  return {
    prediction: full.prediction || {
      date: raw.date || date,
      facility: "Sarvodaya General Hospital",
      predicted: raw.predicted_influx || 58,
      low: Math.max(0, (raw.predicted_influx || 58) - 16),
      high: (raw.predicted_influx || 58) + 18,
      confidence_pct: 91,
      model_used: "Surge-Ensemble-v2",
      ml_blend_pct: 88,
      season_used: "MONSOON_SURGE",
    },
    bed_occupancy: full.bed_occupancy || {
      total_beds: 150,
      current_occupied: 114,
      new_admissions: 28,
      projected_occupied: 142,
      beds_free_now: 36,
      beds_free_after: 8,
      current_bor_pct: 76,
      projected_bor_pct: raw.bor_projected_pct || 94.7,
      over_capacity: (raw.bor_projected_pct || 94.7) > 85,
      status: (raw.status || "critical").toLowerCase(),
      nhm_target_pct: 85,
    },
    opd_load: full.opd_load || {
      patients_per_hour: 42,
      patients_per_hr_per_ctr: 14,
      patients_per_doctor: 10.5,
      counters_available: 3,
      counters_needed: 5,
      doctors_available: 4,
      doctors_needed: 6,
      counter_status: "heavy",
      doctor_status: "warning",
      counter_util_pct: 92,
      nhm_ctr_norm_min: 10,
      nhm_ctr_norm_max: 20,
    },
    emergency_load: full.emergency_load || {
      ed_beds: 40,
      ed_occupied_now: 28,
      opd_transfers: 12,
      direct_walkins: 16,
      new_ed_patients: 28,
      projected_occupied: 38,
      utilisation_pct: 95.0,
      triage_immediate: raw.ed_triage_breakdown?.Immediate || 6,
      triage_urgent: raw.ed_triage_breakdown?.Urgent || 14,
      triage_non_urgent: raw.ed_triage_breakdown?.Non_Urgent || 12,
      triage_observation: raw.ed_triage_breakdown?.Observation || 6,
      status: (raw.status || "critical").toLowerCase(),
    },
    waiting_times: full.waiting_times || {
      transport: raw.simulated_wait_times_minutes?.transport || 14.5,
      registration: raw.simulated_wait_times_minutes?.registration || 12.0,
      triage: raw.simulated_wait_times_minutes?.triage || 18.5,
      consultation: raw.simulated_wait_times_minutes?.consultation || 32.0,
      pharmacy: raw.simulated_wait_times_minutes?.pharmacy || 15.0,
      billing: raw.simulated_wait_times_minutes?.billing || 11.5,
      total: raw.total_wait_time_minutes || 103.5,
    },
    alerts: full.alerts || [
      {
        level: (raw.status || "critical").toLowerCase(),
        code: "ED_SURGE_CRITICAL",
        message: `Projected BOR ${raw.bor_projected_pct || 94.7}% requires active monitoring.`,
      },
    ],
  };
}

function getMockPrediction(date: string): PredictionResponse {
  return {
    prediction: {
      date,
      facility: "Sarvodaya General Hospital",
      predicted: 58,
      low: 42,
      high: 76,
      confidence_pct: 91,
      model_used: "Surge-Ensemble-v2",
      ml_blend_pct: 88,
      season_used: "MONSOON_SURGE",
    },
    bed_occupancy: {
      total_beds: 150,
      current_occupied: 114,
      new_admissions: 28,
      projected_occupied: 142,
      beds_free_now: 36,
      beds_free_after: 8,
      current_bor_pct: 76,
      projected_bor_pct: 94.7,
      over_capacity: true,
      status: "critical",
      nhm_target_pct: 85,
    },
    opd_load: {
      patients_per_hour: 42,
      patients_per_hr_per_ctr: 14,
      patients_per_doctor: 10.5,
      counters_available: 3,
      counters_needed: 5,
      doctors_available: 4,
      doctors_needed: 6,
      counter_status: "heavy",
      doctor_status: "warning",
      counter_util_pct: 92,
      nhm_ctr_norm_min: 10,
      nhm_ctr_norm_max: 20,
    },
    emergency_load: {
      ed_beds: 40,
      ed_occupied_now: 28,
      opd_transfers: 12,
      direct_walkins: 16,
      new_ed_patients: 28,
      projected_occupied: 38,
      utilisation_pct: 95.0,
      triage_immediate: 6,
      triage_urgent: 14,
      triage_non_urgent: 12,
      triage_observation: 6,
      status: "critical",
    },
    waiting_times: {
      transport: 14.5,
      registration: 12.0,
      triage: 18.5,
      consultation: 32.0,
      pharmacy: 15.0,
      billing: 11.5,
      total: 103.5,
    },
    alerts: [
      {
        level: "critical",
        code: "ED_SURGE_CRITICAL",
        message: "Projected BOR 94.7% exceeds NHM safety ceiling of 85%.",
      },
      {
        level: "warning",
        code: "OPD_PHYSICIAN_DEFICIT",
        message: "OPD load requires 2 additional physicians during peak 11am-2pm.",
      },
    ],
  };
}

export const api = {
  // ── Hospital Info & List ──────────────────────────────────────────────────
  getHospitals: () =>
    fetchWithFallback<any[]>("/api/hospitals", undefined, () => [
      {
        id: "hospital123",
        name: "Sarvodaya General Hospital",
        lat: 28.445,
        lng: 76.997,
        total_beds: 150,
        available_beds: 36,
        status: "online",
      },
      {
        id: "hospital321",
        name: "Global Care Medical Centre",
        lat: 28.6329,
        lng: 77.2195,
        total_beds: 220,
        available_beds: 18,
        status: "online",
      },
      {
        id: "hospital456",
        name: "City Care Emergency Center",
        lat: 28.62,
        lng: 77.36,
        total_beds: 115,
        available_beds: 51,
        status: "online",
      },
      {
        id: "hospital789",
        name: "Apex Health Institute",
        lat: 28.43,
        lng: 76.98,
        total_beds: 190,
        available_beds: 19,
        status: "online",
      },
    ]),

  getHospitalInfo: (id: string) =>
    fetchWithFallback<HospitalInfo>(`/api/hospital/info/${id}`, undefined, () => ({
      id,
      name:
        id === "hospital321"
          ? "Global Care Medical Centre"
          : id === "hospital456"
          ? "City Care Emergency Center"
          : id === "hospital789"
          ? "Apex Health Institute"
          : "Sarvodaya General Hospital",
      short: id.slice(0, 3).toUpperCase(),
      location: "NCR Clinical Grid",
      lat: 28.445,
      lng: 76.997,
      status: "online",
      capacities: [
        { department: "Emergency", total: 40, available: 12 },
        { department: "ICU", total: 25, available: 4 },
        { department: "Surgery", total: 30, available: 8 },
        { department: "Radiology", total: 20, available: 10 },
      ],
    })),

  updateCapacity: (data: { hospital_id: string; department: string; total: number; available: number }) =>
    fetchWithFallback<{ status: string }>("/api/hospital/capacity", {
      method: "POST",
      body: JSON.stringify(data),
    }, () => ({ status: "success" })),

  // ── Patient Transfers ─────────────────────────────────────────────────────
  createPatientRequest: (department: string, priority: string, hospital_id?: string, hospital_name?: string) =>
    fetchWithFallback<{ patient_id: string }>("/api/request", {
      method: "POST",
      body: JSON.stringify({
        department,
        priority,
        hospital_id: hospital_id || "hospital123",
        hospital_name: hospital_name || "Sarvodaya General Hospital",
        lat: 28.6,
        lng: 77.1,
      }),
    }, () => ({ patient_id: `pt_${Math.random().toString(36).substring(2, 9)}` })),

  createTransfer: (data: { department: string; priority: string; hospital_id?: string; hospital_name?: string; lat?: number; lng?: number }) =>
    fetchWithFallback<{ id: string; status: string }>("/api/request", {
      method: "POST",
      body: JSON.stringify({
        department: data.department,
        priority: data.priority,
        hospital_id: data.hospital_id || "hospital123",
        hospital_name: data.hospital_name || "Sarvodaya General Hospital",
        lat: data.lat || 28.6,
        lng: data.lng || 77.1,
      }),
    }, () => ({ id: `pt_${Math.random().toString(36).substring(2, 9)}`, status: "open" })),

  getOpenRequests: (department?: string) =>
    fetchWithFallback<PatientTransfer[]>(
      `/api/hospital/open-requests${department ? `?department=${encodeURIComponent(department)}` : ""}`,
      undefined,
      () => [
        {
          id: "pt_req_9921",
          department: "Emergency",
          priority: "Critical",
          lat: 28.61,
          lng: 77.21,
          status: "PENDING",
          created_at: Date.now() - 120000,
        },
        {
          id: "pt_req_8412",
          department: "ICU",
          priority: "High",
          lat: 28.45,
          lng: 77.02,
          status: "PENDING",
          created_at: Date.now() - 340000,
        },
      ]
    ),

  getOpenTransfers: (department?: string) =>
    fetchWithFallback<PatientTransfer[]>(
      `/api/hospital/open-requests${department ? `?department=${encodeURIComponent(department)}` : ""}`,
      undefined,
      () => []
    ),

  respondToPatient: (patient_id: string, hospital_id: string, status: "accepted" | "rejected") =>
    fetchWithFallback<{ status: string }>("/api/hospital/respond", {
      method: "POST",
      body: JSON.stringify({ patient_id, hospital_id, status }),
    }, () => ({ status: "recorded" })),

  respondTransfer: (patient_id: string, hospital_id: string, status: "accepted" | "rejected") =>
    fetchWithFallback<{ status: string }>("/api/hospital/respond", {
      method: "POST",
      body: JSON.stringify({ patient_id, hospital_id, status }),
    }, () => ({ status: "recorded" })),

  getPatientResponses: (patient_id: string) =>
    fetchWithFallback<TransferResponse[]>(
      `/api/patient/responses?patient_id=${encodeURIComponent(patient_id)}`,
      undefined,
      () => [
        {
          id: "resp_1",
          patient_id,
          hospital_id: "hospital321",
          hospital_name: "Global Care Medical Centre",
          name: "Global Care Medical Centre",
          lat: 28.6329,
          lng: 77.2195,
          status: "accepted",
          decided: false,
          timestamp: Date.now() - 60000,
        },
      ]
    ),

  getResponsesForTransfer: (patient_id: string) =>
    fetchWithFallback<TransferResponse[]>(
      `/api/patient/responses?patient_id=${encodeURIComponent(patient_id)}`,
      undefined,
      () => []
    ),

  selectHospital: (patient_id: string, hospital_id: string) =>
    fetchWithFallback<{ status: string }>("/api/patient/select", {
      method: "POST",
      body: JSON.stringify({ patient_id, hospital_id }),
    }, () => ({ status: "assigned" })),

  selectTransferMatch: (patient_id: string, hospital_id: string) =>
    fetchWithFallback<{ status: string }>("/api/patient/select", {
      method: "POST",
      body: JSON.stringify({ patient_id, hospital_id }),
    }, () => ({ status: "assigned" })),

  denyResponse: (patient_id: string, hospital_id: string) =>
    fetchWithFallback<{ status: string }>("/api/patient/deny-response", {
      method: "POST",
      body: JSON.stringify({ patient_id, hospital_id }),
    }, () => ({ status: "denied" })),

  getAcceptanceStatus: (patient_id: string, hospital_id: string) =>
    fetchWithFallback<{ status: "pending" | "confirmed" | "denied_by_source" }>(
      `/api/patient/acceptance-status?patient_id=${patient_id}&hospital_id=${hospital_id}`,
      undefined,
      () => ({ status: "pending" })
    ),

  // ── Inventory & Resources ─────────────────────────────────────────────────
  getHospitalResources: (hospital_id: string) =>
    fetchWithFallback<{ hospital_id: string; resource_type: string; available: number }[]>(
      `/api/hospital/resources/${hospital_id}`,
      undefined,
      () => [
        { hospital_id, resource_type: "Oxygen Cylinders", available: 3 },
        { hospital_id, resource_type: "Ventilators", available: 12 },
        { hospital_id, resource_type: "Blood Units", available: 25 },
        { hospital_id, resource_type: "Syringes", available: 150 },
        { hospital_id, resource_type: "Saline Bottles", available: 8 },
        { hospital_id, resource_type: "Defibrillators", available: 2 },
        { hospital_id, resource_type: "Wheelchairs", available: 18 },
        { hospital_id, resource_type: "Gloves", available: 300 },
      ]
    ),

  updateHospitalResource: (data: { hospital_id: string; resource_type: string; delta?: number; available?: number }) =>
    fetchWithFallback<{ status: string; available: number }>("/api/hospital/resources/update", {
      method: "POST",
      body: JSON.stringify(data),
    }, () => ({ status: "success", available: data.available || 10 })),

  getResourceRequests: () =>
    fetchWithFallback<ResourceRequest[]>("/api/resources/requests", undefined, () => [
      {
        id: "req_res_101",
        requester_hospital_id: "hospital321",
        requester_hospital_name: "Global Care Medical Centre",
        resource_type: "Ventilators",
        quantity: 3,
        status: "open",
        timestamp: Date.now() - 180000,
      },
      {
        id: "req_res_102",
        requester_hospital_id: "hospital789",
        requester_hospital_name: "Apex Health Institute",
        resource_type: "Oxygen Cylinders",
        quantity: 10,
        status: "open",
        timestamp: Date.now() - 450000,
      },
    ]),

  createResourceRequest: (
    arg1: string | { requester_hospital_id?: string; hospital_id?: string; resource_type: string; quantity: number },
    arg2?: string,
    arg3?: number
  ) => {
    let hospId: string;
    let resType: string;
    let qty: number;

    if (typeof arg1 === "object") {
      hospId = arg1.requester_hospital_id || arg1.hospital_id || "hospital123";
      resType = arg1.resource_type;
      qty = arg1.quantity;
    } else {
      hospId = arg1;
      resType = arg2 || "Ventilators";
      qty = arg3 || 1;
    }

    return fetchWithFallback<{ id: string; request_id: string; status: string }>(
      "/api/resource/request",
      {
        method: "POST",
        body: JSON.stringify({ hospital_id: hospId, resource_type: resType, quantity: qty }),
      },
      () => ({ id: `res_${Date.now()}`, request_id: `res_${Date.now()}`, status: "open" })
    );
  },

  fulfillResourceRequest: (request_id: string) =>
    fetchWithFallback<{ status: string }>("/api/resources/fulfill", {
      method: "POST",
      body: JSON.stringify({ request_id }),
    }, () => ({ status: "fulfilled" })),

  getResourcePool: (hospital_id: string) =>
    fetchWithFallback<ResourcePoolEntry[]>(
      `/api/resource/pool?hospital_id=${encodeURIComponent(hospital_id)}`,
      undefined,
      () => [
        {
          hospital: "Global Care Medical Centre",
          hospital_id: "hospital321",
          distance_km: 4.2,
          resources: [
            { type: "Oxygen Cylinders", available: 14, icon: "🫧" },
            { type: "Ventilators", available: 5, icon: "🫁" },
            { type: "Blood Units", available: 32, icon: "🩸" },
          ],
        },
        {
          hospital: "City Care Emergency Center",
          hospital_id: "hospital456",
          distance_km: 6.8,
          resources: [
            { type: "Defibrillators", available: 4, icon: "⚡" },
            { type: "Saline Bottles", available: 45, icon: "🧴" },
            { type: "Wheelchairs", available: 12, icon: "♿" },
          ],
        },
        {
          hospital: "Apex Health Institute",
          hospital_id: "hospital789",
          distance_km: 9.1,
          resources: [
            { type: "Syringes", available: 400, icon: "💉" },
            { type: "Gloves", available: 800, icon: "🧤" },
            { type: "Blood Units", available: 18, icon: "🩸" },
          ],
        },
      ]
    ),

  // ── Surge Prediction ──────────────────────────────────────────────────────
  getPrediction: async (date: string, hospital_id: string): Promise<PredictionResponse> => {
    const raw = await fetchWithFallback<any>(
      "/api/hospital/predict",
      {
        method: "POST",
        body: JSON.stringify({ hospital_id, date }),
      },
      () => getMockPrediction(date)
    );
    return normalizePrediction(raw, date);
  },

  predictSurge: async (hospital_id: string, date: string): Promise<PredictionResponse> => {
    const raw = await fetchWithFallback<any>(
      "/api/hospital/predict",
      {
        method: "POST",
        body: JSON.stringify({ hospital_id, date }),
      },
      () => getMockPrediction(date)
    );
    return normalizePrediction(raw, date);
  },

  // ── Heatmap ───────────────────────────────────────────────────────────────
  getHeatmap: () =>
    fetchWithFallback<HeatmapHospital[]>("/api/heatmap", undefined, () => [
      {
        id: "hospital123",
        name: "Sarvodaya General Hospital",
        lat: 28.445,
        lng: 76.997,
        total_beds: 150,
        available_beds: 36,
        demand_pct: 76.0,
        total: 150,
        available: 36,
        demand: 76,
      },
      {
        id: "hospital321",
        name: "Global Care Medical Centre",
        lat: 28.6329,
        lng: 77.2195,
        total_beds: 220,
        available_beds: 18,
        demand_pct: 91.8,
        total: 220,
        available: 18,
        demand: 92,
      },
      {
        id: "hospital456",
        name: "City Care Emergency Center",
        lat: 28.62,
        lng: 77.36,
        total_beds: 115,
        available_beds: 51,
        demand_pct: 55.7,
        total: 115,
        available: 51,
        demand: 56,
      },
      {
        id: "hospital789",
        name: "Apex Health Institute",
        lat: 28.43,
        lng: 76.98,
        total_beds: 190,
        available_beds: 19,
        demand_pct: 90.0,
        total: 190,
        available: 19,
        demand: 90,
      },
    ]),

  getSurgeAlerts: (hospital_id: string) =>
    fetchWithFallback<SurgeAlert[]>(
      `/api/surge-alerts?hospital_id=${encodeURIComponent(hospital_id)}`,
      undefined,
      () => [
        {
          id: "sa_1",
          level: "HIGH",
          code: "SURGE_BOR_CRITICAL",
          message: "High patient surge predicted for Emergency & ICU departments.",
          source: "Surge ML Engine",
        },
      ]
    ),

  // ── Swytchcode Integration ─────────────────────────────────────────────
  getSwytchcodeLogs: () =>
    fetchWithFallback<SwytchcodeLog[]>("/api/swytchcode/logs", undefined, () => []),

  dispatchSwytchcodeEmergency: (payload: Record<string, any>) =>
    fetchWithFallback<{ status: string; dispatch_id: string }>("/api/swytchcode/dispatch", {
      method: "POST",
      body: JSON.stringify(payload),
    }, () => ({ status: "success", dispatch_id: `disp_${Date.now()}` })),
};
