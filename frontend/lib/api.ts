import { HospitalInfo, PatientTransfer, TransferResponse, ResourceRequest, MLPrediction, HeatmapHospital, SwytchcodeLog } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
let useMock = false;

async function fetchWithFallback<T>(endpoint: string, options?: RequestInit, mockFallback?: () => T): Promise<T> {
  if (useMock && mockFallback) return mockFallback();
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers }
    });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[CareMatrix API] Backend unavailable for ${endpoint}. Fallback engaged.`, err);
    if (mockFallback) return mockFallback();
    throw err;
  }
}

export const api = {
  // Real Hospital List
  getHospitals: () => fetchWithFallback<any[]>('/api/hospitals', undefined, () => []),

  // Hospital Auth & Info
  getHospitalInfo: (id: string) => fetchWithFallback<HospitalInfo>(`/api/hospital/info/${id}`, undefined, () => ({
    id,
    name: 'Facility Node',
    lat: 28.4450,
    lng: 76.9970,
    status: 'online',
    capacities: []
  })),

  updateCapacity: (data: { hospital_id: string; department: string; total: number; available: number }) =>
    fetchWithFallback<{ status: string }>('/api/hospital/capacity', { method: 'POST', body: JSON.stringify(data) }, () => ({ status: 'success' })),

  // Patient Transfer
  createTransfer: (data: { department: string; priority: string; lat: number; lng: number }) =>
    fetchWithFallback<{ id: string; status: string }>('/api/request', { method: 'POST', body: JSON.stringify(data) }),

  getOpenTransfers: (department?: string) =>
    fetchWithFallback<PatientTransfer[]>(`/api/hospital/open-requests${department ? `?department=${department}` : ''}`, undefined, () => []),

  respondTransfer: (patient_id: string, hospital_id: string, status: 'accepted' | 'rejected') =>
    fetchWithFallback<{ status: string }>('/api/hospital/respond', { method: 'POST', body: JSON.stringify({ patient_id, hospital_id, status }) }),

  getResponsesForTransfer: (patient_id: string) =>
    fetchWithFallback<TransferResponse[]>(`/api/patient/responses?patient_id=${patient_id}`, undefined, () => []),

  selectTransferMatch: (patient_id: string, hospital_id: string) =>
    fetchWithFallback<{ status: string }>('/api/patient/select', { method: 'POST', body: JSON.stringify({ patient_id, hospital_id }) }),

  // Real Resource Stock & Requests
  getHospitalResources: (hospital_id: string) =>
    fetchWithFallback<{ hospital_id: string; resource_type: string; available: number }[]>(`/api/hospital/resources/${hospital_id}`, undefined, () => []),

  updateHospitalResource: (data: { hospital_id: string; resource_type: string; delta?: number; available?: number }) =>
    fetchWithFallback<{ status: string; available: number }>('/api/hospital/resources/update', { method: 'POST', body: JSON.stringify(data) }),

  getResourceRequests: () =>
    fetchWithFallback<ResourceRequest[]>('/api/resources/requests', undefined, () => []),

  createResourceRequest: (data: { requester_hospital_id: string; resource_type: string; quantity: number }) =>
    fetchWithFallback<{ id: string; status: string }>('/api/resources/request', { method: 'POST', body: JSON.stringify(data) }),

  fulfillResourceRequest: (request_id: string) =>
    fetchWithFallback<{ status: string }>('/api/resources/fulfill', { method: 'POST', body: JSON.stringify({ request_id }) }),

  // ML Surge Prediction
  predictSurge: (hospital_id: string, date: string) =>
    fetchWithFallback<MLPrediction>('/api/hospital/predict', { method: 'POST', body: JSON.stringify({ hospital_id, date }) }),

  // Heatmap
  getHeatmap: () => fetchWithFallback<HeatmapHospital[]>('/api/heatmap', undefined, () => []),

  // Swytchcode Logs
  getSwytchcodeLogs: () => fetchWithFallback<SwytchcodeLog[]>('/api/swytchcode/logs', undefined, () => []),

  dispatchSwytchcodeEmergency: (payload: Record<string, any>) =>
    fetchWithFallback<{ status: string; dispatch_id: string }>('/api/swytchcode/dispatch', { method: 'POST', body: JSON.stringify(payload) })
};
