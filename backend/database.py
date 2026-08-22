import os
import logging
from typing import Generator, Any, Optional
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL", "carematrix.db")
logger = logging.getLogger("carematrix.database")

IS_POSTGRES = DB_URL.startswith("postgres://") or DB_URL.startswith("postgresql://")

if IS_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor

    class PostgresCursorWrapper:
        def __init__(self, cursor):
            self._cursor = cursor

        def execute(self, query: str, params: Optional[tuple | list] = None):
            # Adapt SQLite style '?' placeholders to PostgreSQL '%s'
            if params is not None:
                query = query.replace("?", "%s")
                return self._cursor.execute(query, params)
            return self._cursor.execute(query)

        def fetchone(self):
            return self._cursor.fetchone()

        def fetchall(self):
            return self._cursor.fetchall()

        @property
        def lastrowid(self):
            return self._cursor.lastrowid

    class PostgresConnectionWrapper:
        def __init__(self, conn):
            self._conn = conn
            self.is_postgres = True

        def cursor(self):
            return PostgresCursorWrapper(self._conn.cursor(cursor_factory=RealDictCursor))

        def commit(self):
            return self._conn.commit()

        def rollback(self):
            return self._conn.rollback()

        def close(self):
            return self._conn.close()

        def execute(self, query: str, params: Optional[tuple | list] = None):
            cur = self.cursor()
            cur.execute(query, params)
            return cur

import sqlite3

def get_db_connection():
    if IS_POSTGRES:
        try:
            conn = psycopg2.connect(DB_URL, connect_timeout=1)
            return PostgresConnectionWrapper(conn)
        except Exception as e:
            logger.warning(f"PostgreSQL connection failed ({e}). Falling back to local SQLite 'carematrix.db'.")

    conn = sqlite3.connect("carematrix.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    if IS_POSTGRES and isinstance(conn, PostgresConnectionWrapper):
        # PostgreSQL schemas
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS hospitals (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            lat DOUBLE PRECISION NOT NULL,
            lng DOUBLE PRECISION NOT NULL,
            status TEXT DEFAULT 'online'
        );
        """)

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

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            department TEXT NOT NULL,
            priority TEXT NOT NULL,
            lat DOUBLE PRECISION NOT NULL,
            lng DOUBLE PRECISION NOT NULL,
            assigned INTEGER DEFAULT 0,
            status TEXT DEFAULT 'open',
            created_at BIGINT NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS responses (
            id SERIAL PRIMARY KEY,
            patient_id TEXT NOT NULL,
            hospital_id TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp BIGINT NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS assignments (
            patient_id TEXT PRIMARY KEY,
            hospital_id TEXT NOT NULL,
            timestamp BIGINT NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS resource_requests (
            id TEXT PRIMARY KEY,
            requester_hospital_id TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            status TEXT DEFAULT 'open',
            timestamp BIGINT NOT NULL,
            FOREIGN KEY (requester_hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS resource_responses (
            id SERIAL PRIMARY KEY,
            request_id TEXT NOT NULL,
            provider_hospital_id TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp BIGINT NOT NULL,
            FOREIGN KEY (request_id) REFERENCES resource_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (provider_hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS resources (
            hospital_id TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            available INTEGER NOT NULL,
            PRIMARY KEY (hospital_id, resource_type),
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
        );
        """)

    else:
        # SQLite schemas
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS hospitals (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            status TEXT DEFAULT 'online'
        );
        """)

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

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            hospital_id TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS assignments (
            patient_id TEXT PRIMARY KEY,
            hospital_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS resource_requests (
            id TEXT PRIMARY KEY,
            requester_hospital_id TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            status TEXT DEFAULT 'open',
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (requester_hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS resource_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT NOT NULL,
            provider_hospital_id TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (request_id) REFERENCES resource_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (provider_hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
        );
        """)

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
    logger.info(f"Database initialized successfully ({'Neon PostgreSQL' if IS_POSTGRES and isinstance(conn, PostgresConnectionWrapper) else 'SQLite'}).")


def db_session():
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
