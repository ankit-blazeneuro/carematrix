#!/bin/bash

# ==============================================================================
# CareMatrix Full-Stack Launcher (Frontend + Backend)
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}"
echo "============================================================"
echo "           CAREMATRIX FULL-STACK SYSTEM LAUNCHER            "
echo "============================================================"
echo -e "${NC}"

# Function to clean up background processes on exit (Ctrl+C)
cleanup() {
    echo -e "\n${YELLOW}[!] Shutting down CareMatrix services...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    # Ensure port 8000 is released
    fuser -k 8000/tcp 2>/dev/null || true
    echo -e "${GREEN}[✓] All services stopped cleanly.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Clean up any stale process on port 8000
echo -e "${BLUE}[*] Checking port availability...${NC}"
fuser -k 8000/tcp 2>/dev/null || true

# 2. Check and start Backend (FastAPI + Neon PostgreSQL)
echo -e "${BLUE}[*] Starting Backend API on http://localhost:8000 ...${NC}"
cd "$BACKEND_DIR"

if [ -f "$BACKEND_DIR/.venv/bin/uvicorn" ]; then
    PYTHON_EXEC="$BACKEND_DIR/.venv/bin/python"
    UVICORN_EXEC="$BACKEND_DIR/.venv/bin/uvicorn"
else
    PYTHON_EXEC="python3"
    UVICORN_EXEC="uvicorn"
fi

# Ensure database tables are initialized/seeded
"$PYTHON_EXEC" seed.py || true

# Launch uvicorn
"$UVICORN_EXEC" main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}[✓] Backend running (PID: $BACKEND_PID)${NC}"

# 3. Start Frontend (Next.js 16)
echo -e "${BLUE}[*] Starting Frontend on http://localhost:3000 ...${NC}"
cd "$FRONTEND_DIR"

npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}[✓] Frontend running (PID: $FRONTEND_PID)${NC}"

echo -e "\n${GREEN}============================================================${NC}"
echo -e "${GREEN}  CAREMATRIX IS RUNNING!${NC}"
echo -e "  - Frontend: ${YELLOW}http://localhost:3000${NC}"
echo -e "  - Backend API: ${YELLOW}http://localhost:8000${NC}"
echo -e "  - API Docs: ${YELLOW}http://localhost:8000/docs${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "${YELLOW}Press [CTRL+C] at any time to stop both servers.${NC}\n"

# Wait for background processes
wait
