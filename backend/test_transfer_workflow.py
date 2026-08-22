import requests
import json

BASE_URL = "http://localhost:8000"

def test_transfer_lifecycle():
    print("==================================================")
    print(" TESTING CAREMATRIX PATIENT TRANSFER LIFECYCLE  ")
    print("==================================================")

    # 1. Hospital123 creates a transfer request
    print("\n[STEP 1] Hospital123 creating transfer request...")
    req_payload = {
        "department": "ICU",
        "priority": "Critical",
        "hospital_id": "hospital123",
        "hospital_name": "Sarvodaya General Hospital",
        "lat": 28.4450,
        "lng": 76.9970
    }
    res = requests.post(f"{BASE_URL}/api/request", json=req_payload)
    assert res.status_code == 200
    res_json = res.json()
    patient_id = res_json["patient_id"]
    print(f"✅ Transfer Created! ID: {patient_id}, Status: {res_json['status']}")

    # 2. Hospital321 queries open requests
    print(f"\n[STEP 2] Hospital321 querying open requests (GET /api/hospital/open-requests?hospital_id=hospital321)...")
    res = requests.get(f"{BASE_URL}/api/hospital/open-requests?hospital_id=hospital321")
    assert res.status_code == 200
    open_reqs = res.json()
    target = next((r for r in open_reqs if r["id"] == patient_id), None)
    assert target is not None, f"Expected patient {patient_id} to be visible to hospital321"
    print(f"✅ Hospital321 sees transfer {patient_id} from {target['requester_hospital_name']}")

    # 3. Hospital123 queries open requests for itself
    print(f"\n[STEP 3] Hospital123 querying open requests (GET /api/hospital/open-requests?hospital_id=hospital123)...")
    res = requests.get(f"{BASE_URL}/api/hospital/open-requests?hospital_id=hospital123")
    assert res.status_code == 200
    own_open_reqs = res.json()
    assert not any(r["id"] == patient_id for r in own_open_reqs), f"Hospital123 should not see its own transfer in incoming queue"
    print(f"✅ Hospital123 correctly excludes its own request from incoming queue.")

    # 4. Hospital321 accepts the transfer
    print(f"\n[STEP 4] Hospital321 accepting transfer {patient_id}...")
    resp_payload = {
        "patient_id": patient_id,
        "hospital_id": "hospital321",
        "status": "accepted"
    }
    res = requests.post(f"{BASE_URL}/api/hospital/respond", json=resp_payload)
    assert res.status_code == 200
    print("✅ Hospital321 accepted response recorded.")

    # 5. Hospital456 queries open requests and verifies request is no longer open
    print(f"\n[STEP 5] Hospital456 querying open requests (GET /api/hospital/open-requests?hospital_id=hospital456)...")
    res = requests.get(f"{BASE_URL}/api/hospital/open-requests?hospital_id=hospital456")
    assert res.status_code == 200
    open_reqs_456 = res.json()
    assert not any(r["id"] == patient_id for r in open_reqs_456), f"Accepted transfer {patient_id} should no longer appear in open queue"
    print(f"✅ Transfer {patient_id} is automatically removed from open queues for other hospitals.")

    # 6. Source Hospital123 checks patient responses
    print(f"\n[STEP 6] Source Hospital123 checking responses for {patient_id}...")
    res = requests.get(f"{BASE_URL}/api/patient/responses?patient_id={patient_id}")
    assert res.status_code == 200
    responses = res.json()
    assert len(responses) > 0, "Expected at least 1 accepted response"
    assert responses[0]["hospital_id"] == "hospital321"
    print(f"✅ Source Hospital123 sees accepted offer from: {responses[0]['hospital_name']} ({responses[0]['hospital_id']})")

    print("\n==================================================")
    print("  ALL TRANSFER LIFECYCLE TESTS PASSED! 🚀         ")
    print("==================================================")

if __name__ == "__main__":
    test_transfer_lifecycle()
