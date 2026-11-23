#!/usr/bin/env bash
# volcar.sh CONTENEDOR SALIDA -- pg_dump --schema-only de toda la base, como supabase_admin
set -euo pipefail
docker exec "$1" pg_dump -U supabase_admin -d postgres --schema-only --no-comments=false 2>/dev/null > "$2" \
 || docker exec "$1" pg_dump -U supabase_admin -d postgres --schema-only > "$2"
# quita la cabecera con versión / restrict key aleatoria de pg_dump 17
sed -i -E '/^\\(un)?restrict /d' "$2"
wc -l "$2"
