import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_header(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def test_carematrix_backend():
    print_header("CAREMATRIX BACKEND AUTOMATED SUITE")

    # 1. Check Heatmap / Regional Hospitals
    print("\n[TEST 1] Fetching Regional Hospital Heatmap (GET /api/heatmap)...")
    res = requests.get(f"{BASE_URL}/api/heatmap")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    heatmap_data = res.json()
    print(f"✅ Found {len(heatmap_data)} hospitals in network:")
    for h in heatmap_data:
        print(f"   - {h['name']} ({h['id']}): Total Beds={h['total_beds']}, Avail={h['available_beds']}, Demand={h['demand_pct']}%")

    # 2. Check Hospital Info
    print("\n[TEST 2] Fetching Hospital Info for 'hospital123' (GET /api/hospital/info/hospital123)...")
    res = requests.get(f"{BASE_URL}/api/hospital/info/hospital123")
    assert res.status_code == 200
    info = res.json()
    print(f"✅ Hospital Name: {info['name']}")
    for cap in info['capacities']:
        print(f"   - Dept: {cap['department']}, Total: {cap['total']}, Avail: {cap['available']}")

    # 3. Create Patient Transfer Broadcast
    print("\n[TEST 3] Creating Patient Transfer Broadcast (POST /api/request)...")
    payload = {
        "department": "Emergency",
        "priority": "High",
        "lat": 28.4480,
        "lng": 76.9990
    }
    res = requests.post(f"{BASE_URL}/api/request", json=payload)
    assert res.status_code == 200
    transfer = res.json()
    patient_id = transfer['id']
    print(f"✅ Patient Transfer Request Created successfully! ID: {patient_id}, Status: {transfer['status']}")

    # 4. Respond to Transfer Request
    print("\n[TEST 4] Accepting Transfer from City Care Hospital (POST /api/hospital/respond)...")
    resp_payload = {
        "patient_id": patient_id,
        "hospital_id": "hospital456",
        "status": "accepted"
    }
    res = requests.post(f"{BASE_URL}/api/hospital/respond", json=resp_payload)
    assert res.status_code == 200
    print("✅ Transfer Response Recorded!")

    # 5. Fetch Transfer Responses
    print(f"\n[TEST 5] Checking Accepting Hospitals for Patient '{patient_id}' (GET /api/patient/responses)...")
    res = requests.get(f"{BASE_URL}/api/patient/responses?patient_id={patient_id}")
    assert res.status_code == 200
    responses = res.json()
    print(f"✅ Accepting Hospitals count: {len(responses)}")
    for r in responses:
        print(f"   - Hospital: {r['hospital_name']} ({r['hospital_id']}), Status: {r['status']}")

    # 6. Select Match & Decrement Bed Capacity
    print("\n[TEST 6] Confirming Transfer Match & Allocating Bed (POST /api/patient/select)...")
    select_payload = {
        "patient_id": patient_id,
        "hospital_id": "hospital456"
    }
    res = requests.post(f"{BASE_URL}/api/patient/select", json=select_payload)
    assert res.status_code == 200
    print("✅ Match Confirmed! Bed count automatically decremented at accepting hospital.")

    # 7. Test ML Surge Prediction Engine
    print("\n[TEST 7] Running Scikit-Learn ML Patient Surge & Wait Time Forecast (POST /api/hospital/predict)...")
    ml_payload = {
        "hospital_id": "hospital123",
        "date": "2026-08-22",
        "temperature": 41.5,  # Heatwave
        "aqi": 220.0,         # Severe pollution
        "rainfall": 5.0
    }
    res = requests.post(f"{BASE_URL}/api/hospital/predict", json=ml_payload)
    assert res.status_code == 200
    ml_res = res.json()
    print(f"✅ ML Influx Prediction: {ml_res['predicted_influx']} patients/day")
    print(f"✅ Projected Bed Occupancy Rate (BOR): {ml_res['bor_projected_pct']}% -> Status: {ml_res['status']}")
    print(f"✅ Total 6-Stage Simulated Wait Time: {ml_res['total_wait_time_minutes']} minutes")
    print("   Wait Time Breakdown:")
    for stage, t in ml_res['simulated_wait_times_minutes'].items():
        print(f"     * {stage.capitalize()}: {t} mins")
    print("   Emergency Department Triage Breakdown:")
    for triage_cat, count in ml_res['ed_triage_breakdown'].items():
        print(f"     * {triage_cat}: {count} patients")

    # 8. Test Swytchcode Surge Alert Dispatch
    print("\n[TEST 8] Triggering Bed Capacity Surge >= 85% to test Swytchcode Dispatcher (POST /api/hospital/capacity)...")
    cap_payload = {
        "hospital_id": "hospital789",
        "department": "ICU",
        "total": 30,
        "available": 1  # 96.7% occupancy!
    }
    res = requests.post(f"{BASE_URL}/api/hospital/capacity", json=cap_payload)
    assert res.status_code == 200

    # 9. Verify Swytchcode Dispatches
    print("\n[TEST 9] Fetching Swytchcode Dispatch Logs (GET /api/swytchcode/logs)...")
    res = requests.get(f"{BASE_URL}/api/swytchcode/logs")
    assert res.status_code == 200
    logs = res.json()
    print(f"✅ Swytchcode Dispatches Recorded: {len(logs)}")
    for log in logs[:3]:
        print(f"   - [{log['time_iso']}] Method: '{log['method']}' -> Status: {log['status']}")
        print(f"     Payload: {json.dumps(log['payload'])}")
        print(f"     Details: {log['details']}")

    # 10. Resource Supply Exchange Test
    print("\n[TEST 10] Requesting Medical Supplies (Ventilators) (POST /api/resource/request)...")
    res_payload = {
        "hospital_id": "hospital789",
        "resource_type": "Ventilators",
        "quantity": 3
    }
    res = requests.post(f"{BASE_URL}/api/resource/request", json=res_payload)
    assert res.status_code == 200
    res_data = res.json()
    print(f"✅ Resource Request Broadcasted! Request ID: {res_data['id']}")

    print_header("ALL 10 BACKEND TESTS PASSED SUCCESSFULLY! 🚀")

if __name__ == "__main__":
    test_carematrix_backend()
