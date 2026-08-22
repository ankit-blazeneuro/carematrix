import logging
import time
from database import init_db, get_db_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("carematrix.seed")

def seed_database():
    logger.info("Initializing database tables...")
    init_db()

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Hospitals Data
    hospitals = [
        ("hospital123", "Sarvodaya General Hospital", 28.4450, 76.9970, "online"),
        ("hospital456", "City Care Emergency Center", 28.4600, 77.0200, "online"),
        ("hospital789", "Apex Health Institute", 28.4300, 76.9800, "online"),
        ("hospital101", "Metro Critical Care", 28.4750, 77.0400, "online"),
        ("hospital202", "LifeLine Trauma Center", 28.4150, 76.9500, "online")
    ]

    for h in hospitals:
        cursor.execute("""
        INSERT INTO hospitals (id, name, lat, lng, status)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            status = EXCLUDED.status
        """, h)

    # 2. Capacity Data
    capacities = [
        # Sarvodaya General
        ("hospital123", "ICU", 20, 3),
        ("hospital123", "Emergency", 50, 8),
        ("hospital123", "OPD", 80, 25),
        # City Care
        ("hospital456", "ICU", 15, 6),
        ("hospital456", "Emergency", 40, 15),
        ("hospital456", "OPD", 60, 30),
        # Apex Health
        ("hospital789", "ICU", 30, 2),
        ("hospital789", "Emergency", 60, 5),
        ("hospital789", "OPD", 100, 12),
        # Metro Critical Care
        ("hospital101", "ICU", 25, 10),
        ("hospital101", "Emergency", 45, 18),
        ("hospital101", "OPD", 70, 35),
        # LifeLine Trauma
        ("hospital202", "ICU", 18, 4),
        ("hospital202", "Emergency", 35, 7),
        ("hospital202", "OPD", 50, 20)
    ]

    for c in capacities:
        cursor.execute("""
        INSERT INTO capacity (hospital_id, department, total, available)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (hospital_id, department) DO UPDATE SET
            total = EXCLUDED.total,
            available = EXCLUDED.available
        """, c)

    # 3. Resources Inventory Data
    resources = [
        ("hospital123", "Ventilators", 8),
        ("hospital123", "Oxygen Cylinders", 45),
        ("hospital123", "Blood Units (O-)", 12),
        ("hospital456", "Ventilators", 15),
        ("hospital456", "Oxygen Cylinders", 80),
        ("hospital456", "Blood Units (O-)", 25),
        ("hospital789", "Ventilators", 3),
        ("hospital789", "Oxygen Cylinders", 18),
        ("hospital789", "Blood Units (O-)", 5)
    ]

    for r in resources:
        cursor.execute("""
        INSERT INTO resources (hospital_id, resource_type, available)
        VALUES (?, ?, ?)
        ON CONFLICT (hospital_id, resource_type) DO UPDATE SET
            available = EXCLUDED.available
        """, r)

    # 4. Seed Open Patient Transfer Request
    now = int(time.time())
    cursor.execute("""
    INSERT INTO patients (id, department, priority, lat, lng, assigned, status, created_at)
    VALUES ('pt_seed_01', 'Emergency', 'High', 28.4550, 77.0050, 0, 'open', ?)
    ON CONFLICT (id) DO UPDATE SET
        department = EXCLUDED.department,
        priority = EXCLUDED.priority,
        status = EXCLUDED.status
    """, (now - 300,))

    # Seed Open Resource Request
    cursor.execute("""
    INSERT INTO resource_requests (id, requester_hospital_id, resource_type, quantity, status, timestamp)
    VALUES ('res_seed_01', 'hospital789', 'Ventilators', 2, 'open', ?)
    ON CONFLICT (id) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        status = EXCLUDED.status
    """, (now - 600,))

    conn.commit()
    conn.close()
    logger.info("Successfully seeded database with 5 hospitals, department capacities, resources, and sample requests.")

if __name__ == "__main__":
    seed_database()
