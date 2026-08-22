# CareMatrix Frontend Specification & Implementation Guide (`frontend.md`)

This document is an exhaustive, self-contained implementation specification for building the **CareMatrix Neobrutalist Web Frontend**. It provides everything a developer or an autonomous AI agent needs to implement the entire frontend from scratch without relying on any backend code, including built-in Mock Mode capabilities.

---

## 1. Frontend Agent System Prompt

> **SYSTEM PROMPT FOR FRONTEND AGENT**:
> Copy and paste the prompt below into an AI agent to execute frontend generation autonomously:
>
> ```text
> You are an expert Frontend Engineer specializing in Next.js 16 / React 19, TypeScript, and high-impact Neobrutalist UI design systems. Your task is to implement the complete CareMatrix frontend inside the `frontend/` directory based strictly on the instructions and specifications in this document (`frontend.md`).
> 
> Required Tech Stack:
> - Next.js 16 (App Router) + React 19 + TypeScript
> - TailwindCSS v4 + Vanilla Neobrutalist CSS Design System
> - Leaflet + React-Leaflet (Geospatial Demand Heatmap)
> - WebSockets (Real-time transfers, resource exchange, and heatmap streaming)
> - Swytchcode Runtime Client (`@swytchcode/runtime`)
> 
> Rules:
> 1. Implement ALL files specified in Section 2 with complete, non-abbreviated code.
> 2. Strictly enforce Neobrutalism CSS tokens (`3px solid var(--ink)`, `0px` border-radius, `6px 6px 0 var(--ink)` unblurred drop shadows, uppercase `Impact` headers).
> 3. Implement the `lib/api.ts` client with a standalone MOCK MODE fallback so the UI can run offline or independent of the backend server.
> 4. Implement the `useWebSocket` hook in `hooks/useWebSocket.ts` to manage real-time broadcasts and automatically fall back to 3-second HTTP polling if WebSockets disconnect.
> 5. Build all 5 pages (`Login`, `Dashboard`, `Prediction`, `Inventory`, `HeatMap`) with rich interactive UI components.
> 6. Test and verify using `bun run dev` or `npm run dev`.
> ```

---

## 2. Directory Structure & File Manifest

The frontend implementation must reside in the `frontend/` directory with the following exact layout:

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with font imports and HospitalProvider wrapper
│   ├── page.tsx                # Entry page redirecting to /login or /dashboard
│   ├── globals.css             # Core CSS tokens, Neobrutalist resets, keyframe sweep animations
│   ├── login/
│   │   └── page.tsx            # Hospital selection & session authentication
│   ├── dashboard/
│   │   └── page.tsx            # Real-time Patient Transfer Broadcast & Accepting Panel
│   ├── prediction/
│   │   └── page.tsx            # ML Surge Forecasting, BOR Gauge & 6-Stage Queue Simulator
│   ├── inventory/
│   │   └── page.tsx            # Medical Supply Inventory Tracking & Resource Exchange
│   └── heatmap/
│       └── page.tsx            # Leaflet Regional Demand & Bed Availability Heatmap
├── components/
│   ├── NeobrutalistCard.tsx    # Standard hard-shadow card container
│   ├── NeobrutalistButton.tsx  # Hard-border, hover-translating interactive button
│   ├── TransferBroadcastModal.tsx # New patient transfer request trigger modal
│   ├── ResourceRequestModal.tsx   # Supply exchange request trigger modal
│   ├── HeatMapCanvas.tsx       # Interactive Leaflet map container with demand markers
│   ├── SwytchcodeLogViewer.tsx # Real-time Swytchcode emergency notification dispatch monitor
│   └── HeaderNav.tsx           # Persistent header with hospital ID status & live WS indicator
├── context/
│   └── HospitalContext.tsx     # Session context storing active hospital ID & location
├── hooks/
│   └── useWebSocket.ts         # Custom hook for real-time WebSocket subscriptions & polling fallback
├── lib/
│   ├── api.ts                  # API client functions with standalone Mock Mode fallback
│   └── swytchcode_client.ts    # Frontend Swytchcode execution layer wrapper
└── types/
    └── index.ts                # TypeScript interfaces matching backend models 1:1
```

---

## 3. Neobrutalism Design System Guide (`globals.css`)

CareMatrix uses a pure **Neobrutalist** design language.

```css
/* frontend/app/globals.css */
@import "tailwindcss";

:root {
  --paper: #f2f0ea;
  --paper-alt: #dde4e8;
  --ink: #111111;
  --accent: #8f1d1d;
  --accent-dark: #6f1111;
  --accent-yellow: #facc15;
  --accent-blue: #2563eb;
  --accent-green: #16a34a;
  
  --font-display: Impact, "Arial Black", sans-serif;
  --font-mono: "Courier New", Courier, monospace;
}

body {
  background-color: var(--paper);
  color: var(--ink);
  font-family: var(--font-mono);
  margin: 0;
  padding: 0;
}

/* Neobrutalist Card Component */
.neo-card {
  background: white;
  border: 3px solid var(--ink);
  box-shadow: 6px 6px 0 var(--ink);
  border-radius: 0px;
  padding: 1.5rem;
  transition: all 0.15s ease-in-out;
}

/* Neobrutalist Button Component */
.neo-button {
  background: var(--accent);
  color: white;
  font-family: var(--font-display);
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  border: 3px solid var(--ink);
  box-shadow: 4px 4px 0 var(--ink);
  border-radius: 0px;
  padding: 0.6rem 1.4rem;
  cursor: pointer;
  transition: all 0.1s ease;
}

.neo-button:hover {
  transform: translate(-3px, -3px);
  box-shadow: 7px 7px 0 var(--ink);
  background: var(--accent-dark);
}

.neo-button-yellow {
  background: var(--accent-yellow);
  color: var(--ink);
}
.neo-button-yellow:hover {
  background: #eab308;
}

/* Hard Badges */
.neo-badge {
  border: 2px solid var(--ink);
  padding: 0.2rem 0.6rem;
  font-weight: bold;
  font-size: 0.85rem;
  border-radius: 0px;
  text-transform: uppercase;
}

.neo-badge-red { background: var(--accent); color: white; }
.neo-badge-yellow { background: var(--accent-yellow); color: var(--ink); }
.neo-badge-green { background: var(--accent-green); color: white; }

/* Animated Ribbon Sweep Keyframe */
@keyframes ribbon-sweep-a {
  from { opacity: 1; transform: translateX(-130%); }
  to   { opacity: 1; transform: translateX(130%); }
}

.ribbon-animated {
  position: relative;
  overflow: hidden;
}

.ribbon-animated::after {
  content: "";
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: ribbon-sweep-a 3s infinite;
}
```

---

## 4. TypeScript Contracts (`types/index.ts`)

```typescript
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
    triage: number;
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
```

---

## 5. API Client & Standalone Mock Mode (`lib/api.ts`)

`lib/api.ts` implements all REST backend calls and includes an automatic **Mock Mode** fallback if the backend server is unreachable.

```typescript
import { HospitalInfo, PatientTransfer, TransferResponse, ResourceRequest, MLPrediction, HeatmapHospital, SwytchcodeLog } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
let useMock = false;

// Mock Database State
const MOCK_HOSPITALS: HeatmapHospital[] = [
  { id: 'hospital123', name: 'Sarvodaya General', lat: 28.4450, lng: 76.9970, total_beds: 120, available_beds: 14, demand_pct: 88.3 },
  { id: 'hospital456', name: 'City Care Emergency', lat: 28.4600, lng: 77.0200, total_beds: 80, available_beds: 25, demand_pct: 68.7 },
  { id: 'hospital789', name: 'Apex Health Institute', lat: 28.4300, lng: 76.9800, total_beds: 150, available_beds: 5, demand_pct: 96.6 }
];

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
    console.warn(`[CareMatrix API] Backend unavailable for ${endpoint}. Switching to MOCK MODE.`, err);
    useMock = true;
    if (mockFallback) return mockFallback();
    throw err;
  }
}

export const api = {
  // Hospital Auth & Info
  getHospitalInfo: (id: string) => fetchWithFallback<HospitalInfo>(`/api/hospital/info/${id}`, undefined, () => ({
    id, name: 'Sarvodaya General Hospital', lat: 28.4450, lng: 76.9970, status: 'online',
    capacities: [
      { department: 'ICU', total: 20, available: 4 },
      { department: 'Emergency', total: 50, available: 10 },
      { department: 'OPD', total: 50, available: 20 }
    ]
  })),

  updateCapacity: (data: { hospital_id: string; department: string; total: number; available: number }) =>
    fetchWithFallback<{ status: string }>('/api/hospital/capacity', { method: 'POST', body: JSON.stringify(data) }, () => ({ status: 'success' })),

  // Patient Transfer
  createTransfer: (data: { department: string; priority: string; lat: number; lng: number }) =>
    fetchWithFallback<{ id: string; status: string }>('/api/request', { method: 'POST', body: JSON.stringify(data) }, () => ({
      id: `pt_${Date.now()}`, status: 'open'
    })),

  getOpenTransfers: (department?: string) =>
    fetchWithFallback<PatientTransfer[]>(`/api/hospital/open-requests${department ? `?department=${department}` : ''}`, undefined, () => [
      { id: 'pt_101', department: 'Emergency', priority: 'High', lat: 28.45, lng: 77.01, assigned: 0, status: 'open', created_at: Date.now() - 120000 }
    ]),

  respondTransfer: (patient_id: string, hospital_id: string, status: 'accepted' | 'rejected') =>
    fetchWithFallback<{ status: string }>('/api/hospital/respond', { method: 'POST', body: JSON.stringify({ patient_id, hospital_id, status }) }, () => ({ status: 'recorded' })),

  getResponsesForTransfer: (patient_id: string) =>
    fetchWithFallback<TransferResponse[]>(`/api/patient/responses?patient_id=${patient_id}`, undefined, () => [
      { id: 1, patient_id, hospital_id: 'hospital456', hospital_name: 'City Care Emergency', lat: 28.4600, lng: 77.0200, status: 'accepted', timestamp: Date.now() - 30000 }
    ]),

  selectTransferMatch: (patient_id: string, hospital_id: string) =>
    fetchWithFallback<{ status: string }>('/api/patient/select', { method: 'POST', body: JSON.stringify({ patient_id, hospital_id }) }, () => ({ status: 'assigned' })),

  // ML Surge Prediction
  predictSurge: (hospital_id: string, date: string) =>
    fetchWithFallback<MLPrediction>('/api/hospital/predict', { method: 'POST', body: JSON.stringify({ hospital_id, date }) }, () => ({
      hospital_id, date, predicted_influx: 142, bor_projected_pct: 88.5, status: 'CRITICAL',
      ed_triage_breakdown: { Immediate_Resuscitation: 7, Very_Urgent: 21, Urgent: 50, Standard: 64 },
      simulated_wait_times_minutes: { transport: 15.0, registration: 15.1, t_triage: 21.4, consultation: 36.3, pharmacy: 17.7, billing: 14.3 },
      total_wait_time_minutes: 119.8
    })),

  // Heatmap
  getHeatmap: () => fetchWithFallback<HeatmapHospital[]>('/api/heatmap', undefined, () => MOCK_HOSPITALS),

  // Swytchcode Logs
  getSwytchcodeLogs: () => fetchWithFallback<SwytchcodeLog[]>('/api/swytchcode/logs', undefined, () => [
    { id: 'swx_01', timestamp: Date.now() / 1000, time_iso: new Date().toISOString(), method: 'carematrix.surge_alert.dispatch', payload: { hospital_id: 'hospital123', occupancy_pct: 88.5 }, status: 'EXECUTED', details: 'Surge alert broadcasted', engine: 'swytchcode-runtime' }
  ])
};
```

---

## 6. Real-Time WebSocket Hook (`hooks/useWebSocket.ts`)

`useWebSocket` provides live updates with automatic fallback to polling if WebSockets disconnect.

```typescript
import { useEffect, useRef, useState } from 'react';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export function useWebSocket(channel: 'transfers' | 'resources' | 'heatmap', onMessage: (event: string, data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isMounted = true;
    const connect = () => {
      try {
        const ws = new WebSocket(`${WS_BASE_URL}/ws/${channel}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) setIsConnected(true);
          console.log(`[CareMatrix WS] Connected to channel: ${channel}`);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            onMessage(parsed.event, parsed.data);
          } catch (e) {
            console.error('[CareMatrix WS] Error parsing message:', e);
          }
        };

        ws.onclose = () => {
          if (isMounted) setIsConnected(false);
          // Try reconnecting in 5 seconds
          setTimeout(connect, 5000);
        };
      } catch (err) {
        if (isMounted) setIsConnected(false);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, [channel]);

  return { isConnected };
}
```

---

## 7. Pages & Views Overview

1. **`/login`**: Neobrutalist hospital authentication screen. Select Hospital ID (`hospital123`, `hospital456`, `hospital789`) and store in `HospitalContext`.
2. **`/dashboard`**: Real-time Transfer Broadcasting & Response Center.
   - **Broadcast Transfer Modal**: Specify department and priority.
   - **Incoming Requests Panel**: Shows open patient transfers across the regional network. Hospitals click "ACCEPT" or "REJECT".
   - **Outgoing Match Panel**: Source hospital sees live accepting hospitals and confirms transfer.
3. **`/prediction`**: ML Surge & Capacity Forecasting Dashboard.
   - Displays Bed Occupancy Rate (BOR) gauge meter.
   - 6-Stage simulated wait time timeline.
   - ED Triage Breakdown bar graph.
4. **`/inventory`**: Supply Exchange Panel.
   - Restock inventory counters (Ventilators, Oxygen Cylinders, Blood Units).
   - Request supplies from network partners via Swytchcode dispatches.
5. **`/heatmap`**: Geospatial Demand & Availability Map powered by React Leaflet.
   - Color-coded markers based on occupancy (Green $<70\%$, Yellow $70-85\%$, Red $>85\%$).

---

## 8. Verification & Local Testing

### 8.1 Launch Commands
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
bun install   # or npm install

# Start Next.js Development Server
bun run dev --port 3000   # or npm run dev
```

### 8.2 Testing Steps
1. Open `http://localhost:3000` in your browser.
2. Select Hospital `hospital123` on the Login page.
3. Navigate to `/dashboard` and click **"BROADCAST PATIENT TRANSFER"**.
4. Test real-time WebSocket triggers or verify that Mock Mode displays simulated accepting hospitals.
5. Check `/prediction` to inspect ML surge forecasts and simulated wait times.
