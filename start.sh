#!/bin/bash

# ==============================================================================
# CareMatrix Full-Stack Seamless Launcher (Frontend + Backend + Auto-Env Setup)
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

# Terminal formatting colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "============================================================"
echo "           CAREMATRIX FULL-STACK SEAMLESS LAUNCHER          "
echo "============================================================"
echo -e "${NC}"

# Cleanup function for graceful termination on Ctrl+C
cleanup() {
    echo -e "\n${YELLOW}[!] Gracefully stopping CareMatrix services...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    fuser -k 8000/tcp 2>/dev/null || true
    fuser -k 3000/tcp 2>/dev/null || true
    echo -e "${GREEN}[✓] All CareMatrix services stopped cleanly.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Clean up stale ports
echo -e "${BLUE}[*] Checking port availability...${NC}"
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true

# 2. Check Python & Virtual Environment Setup
echo -e "${BLUE}[*] Checking Python environment in $VENV_DIR ...${NC}"
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}[!] Virtual environment not found. Creating $VENV_DIR ...${NC}"
    python3 -m venv "$VENV_DIR"
    echo -e "${GREEN}[✓] Virtual environment created.${NC}"
fi

# Activate Python Virtual Environment
echo -e "${BLUE}[*] Activating virtual environment...${NC}"
source "$VENV_DIR/bin/activate"

# Check & Install Backend Dependencies
if ! "$VENV_DIR/bin/python" -c "import fastapi, uvicorn, sklearn, requests, websockets" 2>/dev/null; then
    echo -e "${YELLOW}[!] Installing required backend dependencies...${NC}"
    "$VENV_DIR/bin/pip" install --upgrade pip setuptools wheel --quiet
    "$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt" requests websockets==12.0
    echo -e "${GREEN}[✓] Backend dependencies installed.${NC}"
fi

# 3. Seed Database
echo -e "${BLUE}[*] Initializing & seeding CareMatrix database...${NC}"
cd "$BACKEND_DIR"
"$VENV_DIR/bin/python" seed.py || true

# 4. Launch FastAPI Backend
echo -e "${BLUE}[*] Launching FastAPI Backend on http://localhost:8000 ...${NC}"
"$VENV_DIR/bin/uvicorn" main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}[✓] Backend running (PID: $BACKEND_PID)${NC}"

# 5. Launch Next.js Frontend (if available)
if [ -d "$FRONTEND_DIR" ] && [ -f "$FRONTEND_DIR/package.json" ]; then
    echo -e "${BLUE}[*] Checking frontend dependencies in $FRONTEND_DIR ...${NC}"
    cd "$FRONTEND_DIR"
    
    if [ ! -f "node_modules/.bin/next" ]; then
        echo -e "${YELLOW}[!] Frontend node_modules missing or incomplete. Installing...${NC}"
        if command -v bun &>/dev/null; then
            bun install || true
        elif command -v npm &>/dev/null; then
            npm install || true
        fi
    fi

    if [ -f "node_modules/.bin/next" ]; then
        echo -e "${BLUE}[*] Launching Frontend on http://localhost:3000 ...${NC}"
        if command -v bun &>/dev/null; then
            bun run dev --port 3000 &
            FRONTEND_PID=$!
        elif command -v npm &>/dev/null; then
            npm run dev --port 3000 &
            FRONTEND_PID=$!
        fi
        if [ -n "$FRONTEND_PID" ]; then
            echo -e "${GREEN}[✓] Frontend running (PID: $FRONTEND_PID)${NC}"
        fi
    else
        echo -e "${YELLOW}[!] Skipping frontend launch (installing node_modules in background). Backend is fully operational.${NC}"
    fi
fi

echo -e "\n${GREEN}============================================================${NC}"
echo -e "${GREEN}  🚀 CAREMATRIX IS LIVE & SEAMLESS!${NC}"
echo -e "  - Frontend UI:   ${YELLOW}http://localhost:3000${NC}"
echo -e "  - Backend API:   ${YELLOW}http://localhost:8000${NC}"
echo -e "  - Swagger Docs:  ${YELLOW}http://localhost:8000/docs${NC}"
echo -e "  - Health Check:  ${YELLOW}http://localhost:8000/api/heatmap${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "${YELLOW}Press [CTRL+C] at any time to stop all services.${NC}\n"

# Keep script active to maintain background services
wait
