#!/bin/bash
set -e

echo ""
echo " ================================================="
echo "  AeneasSoft - One-Click Setup"
echo " ================================================="
echo ""

# ── 1. Check Docker ───────────────────────────────────
echo "[1/5] Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo ""
    echo " ERROR: Docker is not running."
    echo ""
    echo " Please install and start Docker Desktop:"
    echo "   Mac:   https://www.docker.com/products/docker-desktop/"
    echo "   Linux: https://docs.docker.com/engine/install/"
    echo ""
    exit 1
fi
echo " Docker is running."

# ── 2. Copy .env if missing ───────────────────────────
echo ""
echo "[2/5] Checking environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo " Created .env from .env.example"
else
    echo " .env already exists"
fi

# ── 3. Start services ─────────────────────────────────
echo ""
echo "[3/5] Starting services (this may take 5-10 min on first run)..."
docker compose up -d --build

# ── 4. Wait for health checks ─────────────────────────
echo ""
echo "[4/5] Waiting for services to become healthy..."
attempts=0
while true; do
    attempts=$((attempts + 1))
    if [ $attempts -gt 90 ]; then
        echo " Timeout. Check: docker compose ps"
        exit 1
    fi
    status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
    if [ "$status" = "200" ]; then
        echo " All services healthy after ${attempts}s!"
        break
    fi
    printf "."
    sleep 1
done
echo ""

# ── 5. Run demo ───────────────────────────────────────
echo "[5/5] Running demo to generate sample traces..."
python3 demo/run.py 2>/dev/null || python demo/run.py 2>/dev/null || echo " (Demo skipped - Python not found, but services are running)"

# ── Done ──────────────────────────────────────────────
echo ""
echo " ================================================="
echo "  Setup complete!"
echo " ================================================="
echo ""
echo "  Dashboard:  http://localhost:3000"
echo "  Backend:    http://localhost:3001/health"
echo "  Proxy:      http://localhost:8080/health"
echo ""

# Open browser if possible
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
elif command -v open &> /dev/null; then
    open http://localhost:3000
fi
