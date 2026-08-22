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
    priority: str = Field(..., example="High")  # "High", "Medium", "Low"
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None
    lat: Optional[float] = 28.6
    lng: Optional[float] = 77.1

class TransferCreateResponse(BaseModel):
    id: str
    status: str

class TransferRespondRequest(BaseModel):
    patient_id: str
    hospital_id: str
    status: str  # "accepted" or "rejected"

class TransferSelectRequest(BaseModel):
    patient_id: str
    hospital_id: str

class TransferDenyRequest(BaseModel):
    patient_id: str
    hospital_id: str

# Resource Models
class ResourceCreateRequest(BaseModel):
    hospital_id: Optional[str] = None
    requester_hospital_id: Optional[str] = None
    resource_type: str = Field(..., example="Ventilators")
    quantity: int = Field(..., ge=1)

    def get_hospital_id(self) -> str:
        return self.hospital_id or self.requester_hospital_id or "hospital123"

class ResourceRespondRequest(BaseModel):
    request_id: str
    provider_hospital_id: str
    status: str  # "accepted" or "rejected"

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
    status: str  # "NORMAL", "HIGH_LOAD", "CRITICAL"
    ed_triage_breakdown: Dict[str, int]
    simulated_wait_times_minutes: Dict[str, float]
    total_wait_time_minutes: float

# WebSocket Payload Wrappers
class WSMessage(BaseModel):
    event: str  # e.g., "TRANSFER_BROADCAST", "TRANSFER_RESPONSE", "RESOURCE_UPDATE", "HEATMAP_REFRESH"
    data: Dict[str, Any]
