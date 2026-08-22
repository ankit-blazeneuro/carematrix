import sqlite3
import os
import logging
from typing import Generator

DB_PATH = os.getenv("DATABASE_URL", "carematrix.db")
logger = logging.getLogger("carematrix.database")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for high concurrent read/write performance
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
