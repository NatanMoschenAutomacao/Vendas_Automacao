#!/usr/bin/env bash
# Roda os testes e2e contra um banco PostgreSQL NOVO, criado só para esta execução.
# Requer: E2E_ADMIN_URL apontando para um PostgreSQL local (ex.: postgresql://postgres:postgres@localhost:5432/postgres)
# e um build feito (pnpm build). Nunca usa DATABASE_URL, para não tocar no banco de trabalho.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${E2E_ADMIN_URL:?Defina E2E_ADMIN_URL com a URL de um PostgreSQL local}"
NOME="e2e_$(date +%s)"
BASE="${E2E_ADMIN_URL%/*}"
psql "$E2E_ADMIN_URL" -qc "CREATE DATABASE $NOME"
export DATABASE_URL="$BASE/$NOME"
export DIRECT_URL="$DATABASE_URL"
export SESSION_SECRET="${SESSION_SECRET:-e2e-secret-0123456789abcdef0123456789abcdef}"
export SEED_ADMIN_USUARIO=admin
export SEED_ADMIN_SENHA="${SEED_ADMIN_SENHA:-Trocar@123}"

pnpm prisma migrate deploy
pnpm prisma db seed

pnpm next start --port 3100 > /tmp/e2e-server.log 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null || true; pkill -f "next start --port 3100" 2>/dev/null || true; pkill -f next-server 2>/dev/null || true' EXIT
if curl -fs -o /dev/null http://localhost:3100/login; then echo "Porta 3100 ocupada"; exit 1; fi
for _ in $(seq 1 30); do curl -fs -o /dev/null http://localhost:3100/login && break; sleep 1; done

E2E_BASE_URL=http://localhost:3100 pnpm playwright test "$@"
echo "Banco usado: $NOME (pode ser apagado)."
