#!/bin/bash

# ==============================================================================
# CareMatrix Python Environment Setup Script
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_DIR="$BACKEND_DIR/.venv"
REQUIREMENTS_FILE="$BACKEND_DIR/requirements.txt"

# Terminal formatting colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}      CAREMATRIX PYTHON ENVIRONMENT & DEPENDENCY SETUP      ${NC}"
echo -e "${BLUE}============================================================${NC}\n"

# 1. Detect Python 3
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo -e "${RED}[ERROR] Python 3 was not found on your system. Please install Python 3.10+ to continue.${NC}"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version)
echo -e "${GREEN}[✓] Using $PYTHON_VERSION${NC}"

# 2. Create Virtual Environment
echo -e "${YELLOW}[*] Creating Python virtual environment in $VENV_DIR ...${NC}"
if [ ! -d "$VENV_DIR" ]; then
    $PYTHON_CMD -m venv "$VENV_DIR"
    echo -e "${GREEN}[✓] Virtual environment created successfully.${NC}"
else
    echo -e "${GREEN}[✓] Existing virtual environment found.${NC}"
fi

# 3. Upgrade pip, setuptools, wheel
echo -e "${YELLOW}[*] Upgrading pip, setuptools, and wheel...${NC}"
"$VENV_DIR/bin/pip" install --upgrade pip setuptools wheel --quiet

# 4. Install Dependencies from requirements.txt
echo -e "${YELLOW}[*] Installing dependencies from $REQUIREMENTS_FILE ...${NC}"
"$VENV_DIR/bin/pip" install -r "$REQUIREMENTS_FILE"

# 5. Initialize/Seed Database
echo -e "${YELLOW}[*] Initializing & seeding database tables...${NC}"
cd "$BACKEND_DIR"
"$VENV_DIR/bin/python" seed.py

echo -e "\n${GREEN}============================================================${NC}"
echo -e "${GREEN}  PYTHON ENVIRONMENT SETUP COMPLETED SUCCESSFULLY! 🚀${NC}"
echo -e "  - Virtual Env: ${YELLOW}$VENV_DIR${NC}"
echo -e "  - Python Binary: ${YELLOW}$VENV_DIR/bin/python${NC}"
echo -e "  - Uvicorn Binary: ${YELLOW}$VENV_DIR/bin/uvicorn${NC}"
echo -e "  - Database: ${YELLOW}Initialized & Seeded${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "To activate the environment in your shell, run:"
echo -e "  ${YELLOW}source backend/.venv/bin/activate${NC}\n"
