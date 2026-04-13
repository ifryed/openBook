#!/usr/bin/env bash
# Step 1 local setup: start Postgres (Docker) and apply Prisma migrations.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH."
  echo "Install Docker Desktop (https://www.docker.com/products/docker-desktop/)"
  echo "or install PostgreSQL locally and set DATABASE_URL in .env, then run: npm run db:migrate"
  exit 1
fi

echo "Starting PostgreSQL (docker compose)..."
docker compose up -d

echo "Waiting for database to accept connections..."
for i in $(seq 1 40); do
  if docker compose exec -T postgres pg_isready -U postgres -d openbook >/dev/null 2>&1; then
    echo "Postgres is ready."
    break
  fi
  if [ "$i" -eq 40 ]; then
    echo "Timeout waiting for Postgres. Check: docker compose logs postgres"
    exit 1
  fi
  sleep 1
done

echo "Applying migrations..."
npm run db:migrate

echo ""
echo "Local database is ready."
echo "DATABASE_URL (default): postgresql://postgres:postgres@localhost:5432/openbook?schema=public"
echo "Next: npm run dev"
