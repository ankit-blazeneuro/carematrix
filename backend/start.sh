#!/bin/bash

# ==============================================================================
# CareMatrix Backend Launcher (Auto-Env Activation & Seeding)
# ==============================================================================

set -e

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$BACKEND_DIR/.venv"

# Terminal formatting colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}         CAREMATRIX BACKEND SEAMLESS LAUNCHER              ${NC}"
echo -e "${CYAN}============================================================${NC}\n"

# 1. Check Python Virtual Environment
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}[!] Virtual environment not found. Creating $VENV_DIR ...${NC}"
    python3 -m venv "$VENV_DIR"
    echo -e "${GREEN}[✓] Virtual environment created.${NC}"
fi

# 2. Activate Python Virtual Environment
echo -e "${BLUE}[*] Activating virtual environment...${NC}"
source "$VENV_DIR/bin/activate"

# 3. Check & Install Dependencies
if ! "$VENV_DIR/bin/python" -c "import fastapi, uvicorn, sklearn, requests, websockets" 2>/dev/null; then
    echo -e "${YELLOW}[!] Installing required backend dependencies...${NC}"
    "$VENV_DIR/bin/pip" install --upgrade pip setuptools wheel --quiet
    "$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt" requests websockets==12.0
    echo -e "${GREEN}[✓] Backend dependencies installed.${NC}"
fi

# 4. Seed Database
echo -e "${BLUE}[*] Initializing & seeding database...${NC}"
cd "$BACKEND_DIR"
"$VENV_DIR/bin/python" seed.py

# 5. Launch FastAPI Backend
echo -e "${GREEN}[✓] Launching FastAPI Backend on http://localhost:8000 ...${NC}"
echo -e "${YELLOW}API Documentation: http://localhost:8000/docs${NC}\n"

exec "$VENV_DIR/bin/uvicorn" main:app --host 0.0.0.0 --port 8000 --reload
