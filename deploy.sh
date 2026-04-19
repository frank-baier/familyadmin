#!/bin/bash
set -e

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> Pulling latest changes..."
git pull

echo "==> Building and restarting containers..."
$COMPOSE up --build -d

echo "==> Waiting for backend health check..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T backend wget -qO- http://localhost:8080/actuator/health 2>/dev/null | grep -q '"status":"UP"'; then
    echo "==> Backend is healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Backend did not become healthy after 60s."
    $COMPOSE logs --tail=50 backend
    exit 1
  fi
  sleep 2
done

echo "==> Deploy complete."
$COMPOSE ps
