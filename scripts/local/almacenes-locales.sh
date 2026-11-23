#!/usr/bin/env bash
# scripts/local/almacenes-locales.sh — SÓLO LOCAL.
#
# Crea (o deja como están) los seis buckets de Storage de producción y sus
# policies en la Supabase LOCAL (`almacenes-locales.sql`, al lado). Hace falta
# tras cada `supabase db reset --local`, que los borra; la semilla
# (`scripts/agenda-semilla.ts`) lo llama sola al empezar.
#
#   bash scripts/local/almacenes-locales.sh
#
# Se niega a correr si `NEXT_PUBLIC_SUPABASE_URL` de `.env.local` no apunta a
# 127.0.0.1 o localhost. Sólo habla con el contenedor local por `docker exec`
# (nunca con una cadena de conexión).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTENEDOR="${SPINUS_CONTENEDOR_DB:-supabase_db_app_ortointegra}"

url="${NEXT_PUBLIC_SUPABASE_URL:-}"
if [[ -z "$url" && -f "$RAIZ/.env.local" ]]; then
  url="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$RAIZ/.env.local" | tail -n1 | cut -d= -f2- | tr -d "\"' \r")"
fi
host="$(printf '%s' "$url" | sed -E 's#^[a-z]+://##; s#[/:].*$##')"
if [[ "$host" != "127.0.0.1" && "$host" != "localhost" ]]; then
  echo "almacenes-locales: NEXT_PUBLIC_SUPABASE_URL no es local (host «${host:-vacío}»). No se toca nada." >&2
  exit 1
fi

docker exec -i "$CONTENEDOR" psql -U postgres -d postgres -X -q -At -v ON_ERROR_STOP=1 < "$RAIZ/scripts/local/almacenes-locales.sql"
