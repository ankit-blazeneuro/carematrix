import time
import uuid
import logging
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import sqlite3

from database import init_db, get_db_connection
from models import (
    HospitalRegisterRequest, HospitalRegisterResponse,
    CapacityUpdateRequest, HospitalInfoResponse, DepartmentCapacity,
    TransferCreateRequest, TransferCreateResponse,
    TransferRespondRequest, TransferSelectRequest, TransferDenyRequest,
    ResourceCreateRequest, ResourceRespondRequest, ResourceSelectRequest,
    PredictRequest, PredictResponse
)
from ws_manager import ws_manager
from ml_engine import ml_engine
from swytchcode_integration import (
    dispatch_surge_alert, dispatch_patient_transfer, dispatch_resource_request,
    get_swytchcode_status, get_swytchcode_logs
)

import os
import PridictionModel.core as coree

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("carematrix.api")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HOSPITAL_CSV = {
    "hospital123": os.path.join(BASE_DIR, "PridictionModel", "data", "hospital123.csv"),
    "hospital321": os.path.join(BASE_DIR, "PridictionModel", "data", "hospital321.csv"),
    "hospital456": os.path.join(BASE_DIR, "PridictionModel", "data", "hospital123.csv"),
    "hospital789": os.path.join(BASE_DIR, "PridictionModel", "data", "hospital321.csv")
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite tables on startup
    init_db()
    logger.info("CareMatrix Backend API started successfully.")
    yield

app = FastAPI(
    title="CareMatrix API",
    description="Real-Time Hospital Coordination, Surge Forecasting & Emergency Dispatch Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend environments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. Hospital Operations
# ==========================================

@app.post("/api/hospital/register", response_model=HospitalRegisterResponse)
async def register_hospital(req: HospitalRegisterRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    hospital_id = f"hosp_{uuid.uuid4().hex[:8]}"
    
    cursor.execute(
        "INSERT INTO hospitals (id, name, lat, lng, status) VALUES (?, ?, ?, ?, 'online')",
        (hospital_id, req.name, req.lat, req.lng)
    )
    conn.commit()
    conn.close()
    
    await ws_manager.broadcast("heatmap", "HEATMAP_REFRESH", {"hospital_id": hospital_id})
    return HospitalRegisterResponse(id=hospital_id)

@app.post("/api/hospital/capacity")
async def update_capacity(req: CapacityUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Upsert capacity
    cursor.execute("""
    INSERT INTO capacity (hospital_id, department, total, available)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(hospital_id, department) DO UPDATE SET
        total=excluded.total,
        available=excluded.available
    """, (req.hospital_id, req.department, req.total, req.available))
    conn.commit()

    # Calculate overall hospital BOR to check for surge alert
    cursor.execute("SELECT SUM(total) as tot, SUM(available) as avail FROM capacity WHERE hospital_id = ?", (req.hospital_id,))
    row = cursor.fetchone()
    total_beds = row["tot"] or 0
    avail_beds = row["avail"] or 0
    conn.close()

    if total_beds > 0:
        occ_pct = ((total_beds - avail_beds) / total_beds) * 100.0
        if occ_pct >= 85.0:
            # Trigger Swytchcode surge alert
            dispatch_surge_alert(
                hospital_id=req.hospital_id,
                hospital_name="Hospital Network Partner",
                occupancy_pct=round(occ_pct, 1),
                message=f"CRITICAL SURGE: {req.department} occupancy at {round(occ_pct, 1)}%"
            )

    await ws_manager.broadcast("heatmap", "HEATMAP_REFRESH", {"hospital_id": req.hospital_id})
    return {"status": "success", "hospital_id": req.hospital_id, "department": req.department}

@app.get("/api/hospitals")
async def get_all_hospitals():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT h.id, h.name, h.lat, h.lng, h.status,
           COALESCE(SUM(c.total), 0) as total_beds,
           COALESCE(SUM(c.available), 0) as available_beds
    FROM hospitals h
    LEFT JOIN capacity c ON h.id = c.hospital_id
    GROUP BY h.id
    ORDER BY h.name ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/hospital/resources/{hospital_id}")
async def get_hospital_resources(hospital_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT hospital_id, resource_type, available
    FROM resources
    WHERE hospital_id = ?
    ORDER BY resource_type ASC
    """, (hospital_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/hospital/resources/update")
async def update_hospital_resource(data: dict):
    hosp_id = data.get("hospital_id")
    res_type = data.get("resource_type")
    delta = data.get("delta", 0)
    avail = data.get("available")

    conn = get_db_connection()
    cursor = conn.cursor()

    if avail is not None:
        new_avail = max(0, int(avail))
    else:
        cursor.execute("SELECT available FROM resources WHERE hospital_id = ? AND resource_type = ?", (hosp_id, res_type))
        row = cursor.fetchone()
        current = row["available"] if row else 0
        new_avail = max(0, current + int(delta))

    cursor.execute("""
    INSERT INTO resources (hospital_id, resource_type, available)
    VALUES (?, ?, ?)
    ON CONFLICT (hospital_id, resource_type) DO UPDATE SET
        available = EXCLUDED.available
    """, (hosp_id, res_type, new_avail))

    conn.commit()
    conn.close()

    await ws_manager.broadcast("resources", "RESOURCE_UPDATE", {
        "hospital_id": hosp_id,
        "resource_type": res_type,
        "available": new_avail
    })

    return {"status": "success", "available": new_avail}

@app.get("/api/hospital/info/{hospital_id}", response_model=HospitalInfoResponse)
async def get_hospital_info(hospital_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, lat, lng, status FROM hospitals WHERE id = ?", (hospital_id,))
    hosp = cursor.fetchone()
    if not hosp:
        conn.close()
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    cursor.execute("SELECT department, total, available FROM capacity WHERE hospital_id = ?", (hospital_id,))
    caps = [DepartmentCapacity(department=r["department"], total=r["total"], available=r["available"]) for r in cursor.fetchall()]
    conn.close()

    return HospitalInfoResponse(
        id=hosp["id"],
        name=hosp["name"],
        lat=hosp["lat"],
        lng=hosp["lng"],
        status=hosp["status"],
        capacities=caps
    )

# ==========================================
# 2. Patient Transfer Workflow
# ==========================================

@app.post("/api/request", response_model=TransferCreateResponse)
async def create_transfer_request(req: TransferCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    patient_id = f"pt_{uuid.uuid4().hex[:8]}"
    now = int(time.time())
    hosp_id = req.hospital_id or "hospital123"
    hosp_name = req.hospital_name or "Sarvodaya General Hospital"
    lat = req.lat if req.lat is not None else 28.6
    lng = req.lng if req.lng is not None else 77.1

    cursor.execute(
        """
        INSERT INTO patients (
            id, department, priority, lat, lng, requester_hospital_id,
            requester_hospital_name, assigned, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'open', ?)
        """,
        (patient_id, req.department, req.priority, lat, lng, hosp_id, hosp_name, now)
    )
    conn.commit()
    conn.close()

    # Swytchcode Dispatch
    dispatch_patient_transfer(patient_id, req.department, req.priority)

    # Real-time WebSocket Broadcast
    broadcast_payload = {
        "id": patient_id,
        "department": req.department,
        "priority": req.priority,
        "hospital_id": hosp_id,
        "hospital_name": hosp_name,
        "requester_hospital_id": hosp_id,
        "requester_hospital_name": hosp_name,
        "lat": lat,
        "lng": lng,
        "created_at": now
    }
    await ws_manager.broadcast("transfers", "TRANSFER_BROADCAST", broadcast_payload)

    return {"id": patient_id, "patient_id": patient_id, "status": "open"}

@app.get("/api/hospital/open-requests")
async def get_open_requests(department: Optional[str] = None, hospital_id: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    params = []
    filters = ["status = 'open'"]
    if department:
        filters.append("department = ?")
        params.append(department)
    if hospital_id:
        filters.append("COALESCE(requester_hospital_id, '') != ?")
        params.append(hospital_id)

    cursor.execute(f"""
    SELECT id, department, priority, lat, lng, requester_hospital_id,
           requester_hospital_name, assigned, status, created_at
    FROM patients
    WHERE {' AND '.join(filters)}
    ORDER BY created_at DESC
    """, tuple(params))
        
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": r["id"],
            "department": r["department"],
            "priority": r["priority"],
            "lat": r["lat"],
            "lng": r["lng"],
            "requester_hospital_id": r["requester_hospital_id"],
            "requester_hospital_name": r["requester_hospital_name"],
            "hospital_id": r["requester_hospital_id"],
            "hospital_name": r["requester_hospital_name"],
            "assigned": r["assigned"],
            "status": r["status"],
            "created_at": r["created_at"]
        } for r in rows
    ]

@app.post("/api/hospital/respond")
async def respond_to_transfer(req: TransferRespondRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = int(time.time())

    cursor.execute(
        "INSERT INTO responses (patient_id, hospital_id, status, timestamp) VALUES (?, ?, ?, ?)",
        (req.patient_id, req.hospital_id, req.status, now)
    )

    # An accepted response claims the open request so other hospitals stop seeing it.
    if req.status.lower() == "accepted":
        cursor.execute("UPDATE patients SET status = 'accepted_pending' WHERE id = ? AND status = 'open'", (req.patient_id,))

    conn.commit()
    conn.close()

    await ws_manager.broadcast("transfers", "TRANSFER_RESPONSE", {
        "patient_id": req.patient_id,
        "hospital_id": req.hospital_id,
        "status": req.status,
        "timestamp": now
    })

    return {"status": "recorded"}

@app.get("/api/patient/responses")
async def get_patient_responses(patient_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT r.hospital_id, h.name as hospital_name, h.lat, h.lng, r.status, r.timestamp
    FROM responses r
    JOIN hospitals h ON r.hospital_id = h.id
    WHERE r.patient_id = ? AND r.status = 'accepted'
    ORDER BY r.timestamp DESC
    """, (patient_id,))
    
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "hospital_id": r["hospital_id"],
            "hospital_name": r["hospital_name"],
            "lat": r["lat"],
            "lng": r["lng"],
            "status": r["status"],
            "timestamp": r["timestamp"]
        } for r in rows
    ]

@app.post("/api/patient/select")
async def select_transfer_match(req: TransferSelectRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = int(time.time())

    # Get patient department
    cursor.execute("SELECT department FROM patients WHERE id = ?", (req.patient_id,))
    patient = cursor.fetchone()
    if not patient:
        conn.close()
        raise HTTPException(status_code=404, detail="Patient request not found")
    
    dept = patient["department"]

    # Decrement available bed count
    cursor.execute("""
    UPDATE capacity
    SET available = MAX(0, available - 1)
    WHERE hospital_id = ? AND department = ?
    """, (req.hospital_id, dept))

    # Mark patient as assigned
    cursor.execute("UPDATE patients SET assigned = 1, status = 'fulfilled' WHERE id = ?", (req.patient_id,))

    cursor.execute("""
    UPDATE responses SET status = 'confirmed'
    WHERE patient_id = ? AND hospital_id = ? AND status = 'accepted'
    """, (req.patient_id, req.hospital_id))

    # Record assignment
    cursor.execute("INSERT OR REPLACE INTO assignments (patient_id, hospital_id, timestamp) VALUES (?, ?, ?)",
                   (req.patient_id, req.hospital_id, now))
    
    conn.commit()
    conn.close()

    await ws_manager.broadcast("transfers", "TRANSFER_CONFIRMED", {
        "patient_id": req.patient_id,
        "hospital_id": req.hospital_id,
        "department": dept
    })
    await ws_manager.broadcast("heatmap", "HEATMAP_REFRESH", {"hospital_id": req.hospital_id})

    return {"status": "assigned", "patient_id": req.patient_id, "hospital_id": req.hospital_id}

@app.post("/api/patient/deny-response")
async def deny_transfer_response(req: TransferDenyRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    UPDATE responses SET status = 'denied_by_source'
    WHERE patient_id = ? AND hospital_id = ?
    """, (req.patient_id, req.hospital_id))

    cursor.execute("SELECT 1 FROM responses WHERE patient_id = ? AND status = 'accepted' LIMIT 1", (req.patient_id,))
    has_other_acceptance = cursor.fetchone()
    if not has_other_acceptance:
        cursor.execute("UPDATE patients SET status = 'open' WHERE id = ? AND status = 'accepted_pending'", (req.patient_id,))

    conn.commit()
    conn.close()

    await ws_manager.broadcast("transfers", "TRANSFER_DENIED", {
        "patient_id": req.patient_id,
        "hospital_id": req.hospital_id
    })

    return {"status": "denied"}

@app.get("/api/patient/acceptance-status")
async def get_acceptance_status(patient_id: str, hospital_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT status FROM responses
    WHERE patient_id = ? AND hospital_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
    """, (patient_id, hospital_id))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"status": "pending"}
    return {"status": row["status"]}

# ==========================================
# 3. Resource Supply Exchange
# ==========================================

@app.post("/api/resource/request")
@app.post("/api/resources/request")
async def create_resource_request(req: ResourceCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    request_id = f"res_{uuid.uuid4().hex[:8]}"
    now = int(time.time())

    hosp_id = req.get_hospital_id()
    cursor.execute("""
    INSERT INTO resource_requests (id, requester_hospital_id, resource_type, quantity, status, timestamp)
    VALUES (?, ?, ?, ?, 'open', ?)
    """, (request_id, hosp_id, req.resource_type, req.quantity, now))
    conn.commit()
    conn.close()

    dispatch_resource_request(request_id, hosp_id, req.resource_type, req.quantity)

    await ws_manager.broadcast("resources", "RESOURCE_BROADCAST", {
        "id": request_id,
        "requester_hospital_id": hosp_id,
        "resource_type": req.resource_type,
        "quantity": req.quantity,
        "timestamp": now
    })

    return {"id": request_id, "status": "open"}

@app.get("/api/resource/open")
@app.get("/api/resources/requests")
async def get_open_resource_requests():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT r.id, r.requester_hospital_id, h.name as requester_hospital_name, r.resource_type, r.quantity, r.status, r.timestamp
    FROM resource_requests r
    JOIN hospitals h ON r.requester_hospital_id = h.id
    WHERE r.status = 'open'
    ORDER BY r.timestamp DESC
    """)
    
    rows = cursor.fetchall()
    conn.close()

    return [dict(r) for r in rows]

@app.post("/api/resource/respond")
async def respond_resource_request(req: ResourceRespondRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = int(time.time())

    cursor.execute("""
    INSERT INTO resource_responses (request_id, provider_hospital_id, status, timestamp)
    VALUES (?, ?, ?, ?)
    """, (req.request_id, req.provider_hospital_id, req.status, now))
    conn.commit()
    conn.close()

    await ws_manager.broadcast("resources", "RESOURCE_RESPONSE", {
        "request_id": req.request_id,
        "provider_hospital_id": req.provider_hospital_id,
        "status": req.status
    })

    return {"status": "recorded"}

@app.post("/api/resource/select")
@app.post("/api/resources/fulfill")
async def select_resource_fulfillment(req: ResourceSelectRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("UPDATE resource_requests SET status = 'fulfilled' WHERE id = ?", (req.request_id,))
    conn.commit()
    conn.close()

    await ws_manager.broadcast("resources", "RESOURCE_FULFILLED", {
        "request_id": req.request_id,
        "provider_hospital_id": req.provider_hospital_id
    })

    return {"status": "fulfilled"}

# ==========================================
# 4. ML & Analytics
# ==========================================

@app.post("/api/hospital/predict")
async def predict_hospital_surge(req: PredictRequest):
    csv_path = HOSPITAL_CSV.get(req.hospital_id)
    if not csv_path or not os.path.exists(csv_path):
        csv_path = os.path.join(BASE_DIR, "PridictionModel", "data", "hospital123.csv")

    # Train model on hospital CSV
    try:
        coree.run_training(csv_path=csv_path)
    except Exception as e:
        logger.warning(f"Training on {csv_path} fallback: {e}")

    # Fetch capacity info from DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT SUM(total) as tot, SUM(available) as avail FROM capacity WHERE hospital_id = ?", (req.hospital_id,))
    row = cursor.fetchone()
    conn.close()

    total_beds = (row["tot"] if row and row["tot"] else 100)
    avail_beds = (row["avail"] if row and row["avail"] else 20)
    occupied_beds = max(0, total_beds - avail_beds)

    env_overrides = {
        "temperature": req.temperature or 32.0,
        "aqi": req.aqi or 160.0,
        "rainfall": req.rainfall or 5.0
    }
    cap_overrides = {
        "totalBeds": total_beds,
        "bedsOccupied": occupied_beds
    }

    full_res = coree.predict_one(
        date_str=req.date,
        env=env_overrides,
        cap_override=cap_overrides
    )

    pred = full_res["prediction"]
    bor = full_res["bed_occupancy"]
    ed = full_res["emergency_load"]
    waits = full_res["waiting_times"]

    return {
        "hospital_id": req.hospital_id,
        "date": req.date,
        "predicted_influx": pred["predicted"],
        "bor_projected_pct": bor["projected_bor_pct"],
        "status": bor["status"].upper(),
        "ed_triage_breakdown": ed["triage_split"],
        "simulated_wait_times_minutes": {
            "transport": waits["transport_min"],
            "registration": waits["registration_min"],
            "triage": waits["triage_min"],
            "consultation": waits["consultation_min"],
            "pharmacy": waits["pharmacy_min"],
            "billing": waits["billing_min"]
        },
        "total_wait_time_minutes": waits["total_wait_min"],
        "full_prediction_details": full_res
    }

@app.get("/api/heatmap")
async def get_heatmap_data():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT h.id, h.name, h.lat, h.lng,
           COALESCE(SUM(c.total), 0) as total_beds,
           COALESCE(SUM(c.available), 0) as available_beds
    FROM hospitals h
    LEFT JOIN capacity c ON h.id = c.hospital_id
    GROUP BY h.id
    """)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        tot = r["total_beds"] or 1
        avail = r["available_beds"] or 0
        demand_pct = round(((tot - avail) / tot) * 100.0, 1)
        result.append({
            "id": r["id"],
            "name": r["name"],
            "lat": r["lat"],
            "lng": r["lng"],
            "total_beds": tot,
            "available_beds": avail,
            "demand_pct": demand_pct
        })
    return result

@app.get("/api/surge-alerts")
async def get_surge_alerts():
    logs = get_swytchcode_logs(20)
    alerts = [log for log in logs if "surge_alert" in log["method"]]
    return alerts

@app.get("/api/swytchcode/status")
async def get_swytchcode_status_api():
    return get_swytchcode_status()

@app.get("/api/swytchcode/logs")
async def get_swytchcode_logs_api(limit: int = 20):
    return get_swytchcode_logs(limit)

# ==========================================
# 5. Real-Time WebSockets
# ==========================================

@app.websocket("/ws/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str):
    if channel not in ["transfers", "resources", "heatmap"]:
        await websocket.close(code=4000)
        return
    await ws_manager.connect(channel, websocket)
    try:
        while True:
            # Keep-alive heartbeat
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(channel, websocket)
