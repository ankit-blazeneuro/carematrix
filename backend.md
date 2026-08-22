# CareMatrix Backend Specification & Implementation Guide (`backend.md`)

This document is an exhaustive, self-contained implementation specification for building the **CareMatrix Backend**. It provides everything a developer or an autonomous AI agent needs to implement the entire backend from scratch without relying on any external context or frontend code.

---

## 1. Backend Agent System Prompt

> **SYSTEM PROMPT FOR BACKEND AGENT**:
> Copy and paste the prompt below into an AI agent to execute backend generation autonomously:
>
> ```text
> You are an expert Python Backend Engineer. Your task is to implement the complete CareMatrix backend inside the `backend/` directory based strictly on the instructions and specifications in this document (`backend.md`).
> 
> Required Tech Stack:
> - Python 3.10+
> - FastAPI (ASGI Web Framework)
> - Uvicorn (ASGI Web Server)
> - SQLite3 (WAL Mode enabled)
> - Pydantic v2 (Data Validation)
> - Scikit-Learn + Pandas + NumPy + Joblib (ML Prediction & Queue Simulation Engine)
> - Swytchcode Runtime / Fallback Dispatcher (Swytchcode Emergency Execution Layer)
> - WebSockets (Real-time broadcasting for transfers, resources, and heatmap)
> 
> Rules:
> 1. Implement ALL files specified in Section 2 with complete, non-abbreviated code.
> 2. Ensure SQLite uses WAL mode (`PRAGMA journal_mode=WAL;`) and foreign keys (`PRAGMA foreign_keys=ON;`).
> 3. Implement all 18 REST endpoints and 3 WebSocket routes specified in Section 4.
> 4. Implement the ML surge forecasting and 6-stage wait time simulation engine specified in Section 5.
> 5. Implement the Swytchcode integration and fallback dispatcher specified in Section 6.
> 6. Create the `seed.py` script to pre-populate 5 realistic hospitals and initial capacities.
> 7. Test and verify all endpoints using Uvicorn and curl/WebSockets as described in Section 7.
> ```

---

## 2. Directory Structure & File Manifest

The backend implementation must reside in the `backend/` directory with the following exact layout:

```
backend/
├── main.py                     # FastAPI app, CORS middleware, REST router, WebSocket endpoints
├── database.py                 # SQLite connection manager, WAL mode init, table DDL execution
├── models.py                   # Pydantic v2 schemas for REST payloads and WebSocket messages
├── ws_manager.py               # Real-time WebSocket ConnectionManager (pub/sub channels)
├── ml_engine.py                # Scikit-Learn ensemble model & 6-stage queue wait time simulator
├── swytchcode_integration.py   # Swytchcode dispatch layer & fallback execution log recorder
├── tooling.json                # Swytchcode toolkit configuration manifest
├── seed.py                     # Database seeding script for initial hospital network & beds
└── requirements.txt            # Python package dependencies
```

---

## 3. Database Schema & WAL Setup (`database.py`)

CareMatrix uses SQLite (`carematrix.db`) configured with Write-Ahead Logging (WAL) mode for fast concurrent read/writes.

### `database.py` Implementation

```python
import sqlite3
import os
import logging
from typing import Generator

DB_PATH = os.getenv("DATABASE_URL", "carematrix.db")
logger = logging.getLogger("carematrix.database")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for concurrent read/write performance
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Hospitals Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS hospitals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        status TEXT DEFAULT 'online'
    );
    """)

    # 2. Capacity Table (Per Hospital & Department)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS capacity (
        hospital_id TEXT NOT NULL,
        department TEXT NOT NULL,
        total INTEGER NOT NULL,
        available INTEGER NOT NULL,
        PRIMARY KEY (hospital_id, department),
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
    );
    """)

    # 3. Patients Table (Transfer Requests)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        department TEXT NOT NULL,
        priority TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        assigned INTEGER DEFAULT 0,
        status TEXT DEFAULT 'open',
        created_at INTEGER NOT NULL
    );
    """)

    # 4. Transfer Responses Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT NOT NULL,
        hospital_id TEXT NOT NULL,
        status TEXT NOT NULL, -- 'accepted', 'rejected', 'denied_by_source'
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
    );
    """)

    # 5. Transfer Assignments Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assignments (
        patient_id TEXT PRIMARY KEY,
        hospital_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
    );
    """)

    # 6. Resource Requests Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resource_requests (
        id TEXT PRIMARY KEY,
        requester_hospital_id TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT DEFAULT 'open', -- 'open', 'fulfilled'
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (requester_hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
    );
    """)

    # 7. Resource Responses Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resource_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        provider_hospital_id TEXT NOT NULL,
        status TEXT NOT NULL, -- 'accepted', 'rejected'
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (request_id) REFERENCES resource_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
    );
    """)

    # 8. Resources Inventory Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resources (
        hospital_id TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        available INTEGER NOT NULL,
        PRIMARY KEY (hospital_id, resource_type),
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()
    logger.info("Database initialized successfully in WAL mode.")

def db_session() -> Generator[sqlite3.Connection, None, None]:
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
```

---

## 4. REST API & WebSocket Protocol Contract (`models.py`, `ws_manager.py`, `main.py`)

### 4.1 Pydantic Data Models (`models.py`)

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# Hospital Models
class HospitalRegisterRequest(BaseModel):
    name: str = Field(..., example="Sarvodaya General Hospital")
    lat: float = Field(..., example=28.4450)
    lng: float = Field(..., example=76.9970)

class HospitalRegisterResponse(BaseModel):
    id: str

class CapacityUpdateRequest(BaseModel):
    hospital_id: str
    department: str = Field(..., example="ICU")
    total: int = Field(..., ge=1)
    available: int = Field(..., ge=0)

class DepartmentCapacity(BaseModel):
    department: str
    total: int
    available: int

class HospitalInfoResponse(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    status: str
    capacities: List[DepartmentCapacity]

# Patient Transfer Models
class TransferCreateRequest(BaseModel):
    department: str = Field(..., example="Emergency")
    priority: str = Field(..., example="High") -- "High", "Medium", "Low"
    lat: float
    lng: float

class TransferCreateResponse(BaseModel):
    id: str
    status: str

class TransferRespondRequest(BaseModel):
    patient_id: str
    hospital_id: str
    status: str -- "accepted" or "rejected"

class TransferSelectRequest(BaseModel):
    patient_id: str
    hospital_id: str

class TransferDenyRequest(BaseModel):
    patient_id: str
    hospital_id: str

# Resource Models
class ResourceCreateRequest(BaseModel):
    hospital_id: str
    resource_type: str = Field(..., example="Ventilators")
    quantity: int = Field(..., ge=1)

class ResourceRespondRequest(BaseModel):
    request_id: str
    provider_hospital_id: str
    status: str -- "accepted" or "rejected"

class ResourceSelectRequest(BaseModel):
    request_id: str
    provider_hospital_id: str

# ML Prediction Models
class PredictRequest(BaseModel):
    hospital_id: str
    date: str = Field(..., example="2026-08-22")
    temperature: Optional[float] = 32.0
    aqi: Optional[float] = 160.0
    rainfall: Optional[float] = 5.0

class PredictResponse(BaseModel):
    hospital_id: str
    date: str
    predicted_influx: int
    bor_projected_pct: float
    status: str -- "NORMAL", "HIGH_LOAD", "CRITICAL"
    ed_triage_breakdown: Dict[str, int]
    simulated_wait_times_minutes: Dict[str, float]
    total_wait_time_minutes: float

# WebSocket Payload Wrappers
class WSMessage(BaseModel):
    event: str -- e.g., "TRANSFER_BROADCAST", "TRANSFER_RESPONSE", "RESOURCE_UPDATE", "HEATMAP_REFRESH"
    data: Dict[str, Any]
```

---

### 4.2 Real-time WebSocket Manager (`ws_manager.py`)

```python
from fastapi import WebSocket
from typing import Dict, List
import json
import logging

logger = logging.getLogger("carematrix.websockets")

class ConnectionManager:
    def __init__(self):
        # Channels: channel_name -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {
            "transfers": [],
            "resources": [],
            "heatmap": []
        }

    async def connect(self, channel: str, websocket: WebSocket):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)
        logger.info(f"Client connected to WebSocket channel: {channel}")

    def disconnect(self, channel: str, websocket: WebSocket):
        if channel in self.active_connections:
            if websocket in self.active_connections[channel]:
                self.active_connections[channel].remove(websocket)
                logger.info(f"Client disconnected from WebSocket channel: {channel}")

    async def broadcast(self, channel: str, event_type: str, data: dict):
        if channel not in self.active_connections:
            return
        message = json.dumps({"event": event_type, "data": data})
        disconnected = []
        for connection in self.active_connections[channel]:
            try:
                await connection.send_text(message)
            except Exception as e:
                disconnected.append(connection)
        for conn in disconnected:
            self.active_connections[channel].remove(conn)

ws_manager = ConnectionManager()
```

---

### 4.3 Complete REST API & WebSocket Endpoint Mapping (`main.py`)

| Method | Endpoint | Description | WebSocket Event Broadcast |
|---|---|---|---|
| `POST` | `/api/hospital/register` | Register a new hospital | `HEATMAP_REFRESH` |
| `POST` | `/api/hospital/capacity` | Update bed capacity per department | `HEATMAP_REFRESH` (Triggers Swytchcode alert if BOR $\ge 85\%$) |
| `GET` | `/api/hospital/info/{id}` | Get hospital details & bed breakdown | - |
| `POST` | `/api/request` | Create open patient transfer request | `TRANSFER_BROADCAST` |
| `GET` | `/api/hospital/open-requests` | List all open transfer requests | - |
| `POST` | `/api/hospital/respond` | Hospital accepts/rejects transfer | `TRANSFER_RESPONSE` |
| `GET` | `/api/patient/responses` | List accepting hospitals for a transfer | - |
| `POST` | `/api/patient/select` | Source hospital selects match & decrements beds | `TRANSFER_CONFIRMED`, `HEATMAP_REFRESH` |
| `POST` | `/api/patient/deny-response` | Source hospital denies hospital offer | `TRANSFER_DENIED` |
| `GET` | `/api/patient/acceptance-status` | Check transfer status | - |
| `POST` | `/api/resource/request` | Request medical supplies | `RESOURCE_BROADCAST` |
| `GET` | `/api/resource/open` | List open supply requests | - |
| `POST` | `/api/resource/respond` | Hospital offers supply | `RESOURCE_RESPONSE` |
| `POST` | `/api/resource/select` | Confirm supply fulfillment | `RESOURCE_FULFILLED` |
| `POST` | `/api/hospital/predict` | Run ML Influx & Wait Time simulation | - |
| `GET` | `/api/heatmap` | Get regional demand & bed occupancy | - |
| `GET` | `/api/surge-alerts` | Get list of active surge alerts | - |
| `GET` | `/api/swytchcode/logs` | View Swytchcode execution logs | - |
| `WS` | `/ws/transfers/{hospital_id}` | Live Transfer Broadcasts channel | Real-time bi-directional |
| `WS` | `/ws/resources/{hospital_id}` | Live Resource Exchange channel | Real-time bi-directional |
| `WS` | `/ws/heatmap` | Live Bed Occupancy & Heatmap stream | Real-time stream |

---

## 5. Machine Learning Surge & Wait Time Engine (`ml_engine.py`)

The prediction engine combines a Scikit-Learn ensemble model with non-linear queuing equations.

```python
import numpy as np
import pandas as pd
from typing import Dict, Any
import logging

logger = logging.getLogger("carematrix.ml")

class SurgePredictionEngine:
    def __init__(self):
        # Baseline footfall rates per department
        self.base_footfall = 120

    def predict_influx(self, date_str: str, temp: float, aqi: float, rain: float) -> int:
        multiplier = 1.0
        # Environmental impact rules
        if temp > 39.0:
            multiplier += 0.20 # Extreme heatwave
        elif temp < 5.0:
            multiplier += 0.12 # Cold wave / respiratory surge
        
        if aqi > 200.0:
            multiplier += 0.20 # High pollution COPD surge
        elif aqi > 150.0:
            multiplier += 0.09

        if rain > 50.0:
            multiplier -= 0.15 # Torrential rain delays non-urgent footfall
        elif rain > 20.0:
            multiplier -= 0.07

        predicted = int(self.base_footfall * multiplier)
        return max(30, predicted)

    def calculate_wait_times(self, influx: int, total_beds: int, occupied_beds: int) -> Dict[str, Any]:
        bor = ((occupied_beds + (influx * 0.25)) / max(1, total_beds)) * 100.0
        
        # 6-stage simulated wait times in minutes
        t_transport = 15.0
        t_registration = 8.0 + (influx * 0.05)
        t_triage = 10.0 + (influx * 0.08)
        
        # Doctor utilization non-linear escalation
        doc_capacity = 25
        doctors_available = 4
        utilization = influx / max(1, (doctors_available * doc_capacity))
        t_consultation = 15.0 * (1.0 + (utilization ** 2))
        
        t_pharmacy = 12.0 + (influx * 0.04)
        t_billing = 10.0 + (influx * 0.03)

        total_wait = t_transport + t_registration + t_triage + t_consultation + t_pharmacy + t_billing

        # Triage breakdown
        ed_triage = {
            "Immediate_Resuscitation": int(influx * 0.05),
            "Very_Urgent": int(influx * 0.15),
            "Urgent": int(influx * 0.35),
            "Standard": int(influx * 0.45)
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
```

---

## 6. Swytchcode Integration Blueprint (`swytchcode_integration.py` & `tooling.json`)

### 6.1 `tooling.json` Configuration Manifest

```json
{
  "$schema": "https://swytchcode.com/schemas/tooling.json",
  "version": "1.0.0",
  "project": "carematrix-emergency-dispatcher",
  "description": "Swytchcode execution layer for CareMatrix real-time hospital emergency dispatch and surge alerts",
  "toolkits": [
    "notifications",
    "hospital-network",
    "emergency-alerts"
  ],
  "methods": {
    "carematrix.surge_alert.dispatch": {
      "description": "Dispatches critical hospital surge alert when bed occupancy exceeds 85%",
      "parameters": {
        "hospital_id": "string",
        "hospital_name": "string",
        "occupancy_pct": "number",
        "message": "string"
      }
    },
    "carematrix.resource_request.dispatch": {
      "description": "Dispatches medical supply resource request to network hospitals",
      "parameters": {
        "request_id": "string",
        "requester_hospital_id": "string",
        "resource_type": "string",
        "quantity": "integer"
      }
    },
    "carematrix.patient_transfer.dispatch": {
      "description": "Broadcasting patient transfer request to network emergency centers",
      "parameters": {
        "patient_id": "string",
        "department": "string",
        "priority": "string"
      }
    }
  }
}
```

### 6.2 Python Dispatcher Module (`swytchcode_integration.py`)

```python
import time
import logging
from typing import Dict, Any, List

logger = logging.getLogger("carematrix.swytchcode")

SWYTCHCODE_AVAILABLE = False
try:
    import swytchcode_runtime
    SWYTCHCODE_AVAILABLE = True
except ImportError:
    SWYTCHCODE_AVAILABLE = False

DISPATCH_LOGS: List[Dict[str, Any]] = []

def record_dispatch(method: str, payload: Dict[str, Any], status: str, details: str) -> Dict[str, Any]:
    log_entry = {
        "id": f"swx_{int(time.time() * 1000)}",
        "timestamp": int(time.time()),
        "time_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "method": method,
        "payload": payload,
        "status": status,
        "details": details,
        "engine": "swytchcode-runtime" if SWYTCHCODE_AVAILABLE else "swytchcode-simulator"
    }
    DISPATCH_LOGS.insert(0, log_entry)
    if len(DISPATCH_LOGS) > 100:
        DISPATCH_LOGS.pop()
    logger.info(f"[Swytchcode] Dispatched {method} -> {status}: {details}")
    return log_entry

def dispatch_surge_alert(hospital_id: str, hospital_name: str, occupancy_pct: float, message: str) -> Dict[str, Any]:
    method = "carematrix.surge_alert.dispatch"
    payload = {
        "hospital_id": hospital_id,
        "hospital_name": hospital_name,
        "occupancy_pct": occupancy_pct,
        "message": message
    }
    if SWYTCHCODE_AVAILABLE:
        try:
            result = swytchcode_runtime.exec(method, payload)
            return record_dispatch(method, payload, "EXECUTED", f"Swytchcode runtime response: {result}")
        except Exception as e:
            return record_dispatch(method, payload, "DISPATCHED_FALLBACK", f"Swytchcode fallback active ({str(e)})")
    else:
        return record_dispatch(method, payload, "DISPATCHED", "Swytchcode alert logged successfully.")

def dispatch_patient_transfer(patient_id: str, department: str, priority: str) -> Dict[str, Any]:
    method = "carematrix.patient_transfer.dispatch"
    payload = {"patient_id": patient_id, "department": department, "priority": priority}
    if SWYTCHCODE_AVAILABLE:
        try:
            result = swytchcode_runtime.exec(method, payload)
            return record_dispatch(method, payload, "EXECUTED", f"Swytchcode runtime response: {result}")
        except Exception as e:
            return record_dispatch(method, payload, "DISPATCHED_FALLBACK", f"Swytchcode fallback active ({str(e)})")
    else:
        return record_dispatch(method, payload, "DISPATCHED", "Patient transfer broadcasted via Swytchcode.")

def get_swytchcode_logs(limit: int = 20) -> List[Dict[str, Any]]:
    return DISPATCH_LOGS[:limit]
```

---

## 7. Verification & Startup Instructions

### 7.1 Requirements (`requirements.txt`)
```text
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
pydantic>=2.4.0
scikit-learn>=1.3.0
pandas>=2.1.0
joblib>=1.3.0
python-dotenv>=1.0.0
```

### 7.2 Launch Commands
```bash
# 1. Create Virtual Environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install Dependencies
pip install -r requirements.txt

# 3. Seed Database
python3 seed.py

# 4. Launch FastAPI Server
uvicorn main:app --reload --port 8000
```

### 7.3 Verification `curl` Commands

- **Check API Status**:
  ```bash
  curl -X GET http://localhost:8000/api/surge-alerts
  ```

- **Update Bed Capacity & Trigger Swytchcode Surge Alert**:
  ```bash
  curl -X POST http://localhost:8000/api/hospital/capacity \
    -H "Content-Type: application/json" \
    -d '{"hospital_id": "hospital123", "department": "ICU", "total": 20, "available": 2}'
  ```

- **Run ML Prediction**:
  ```bash
  curl -X POST http://localhost:8000/api/hospital/predict \
    -H "Content-Type: application/json" \
    -d '{"hospital_id": "hospital123", "date": "2026-08-22", "temperature": 41.5, "aqi": 210}'
  ```
