#!/usr/bin/env bash
# scripts/produccion/clonar-desde-foto.sh
#
# Levanta un Postgres APARTE (contenedor propio, sólo en 127.0.0.1) con la
# estructura de una foto (la de foto-produccion.sh). No toca el stack local de
# Supabase ni ninguna base remota.
#
#   scripts/produccion/clonar-desde-foto.sh FOTO_DIR [NOMBRE_CONTENEDOR] [PUERTO]
#     (por omisión: spinus-clon-produccion, 54330)
#
# Orden: roles (de la foto de catálogos + 01-roles.sql) → base «postgres» vacía
# → 03-esquema-completo.sql (todos los esquemas, como supabase_admin) →
# historial de migraciones (04-migraciones.tsv) → comparación con la foto.
# Sale ≠ 0 si el contenedor ya existe o si algo de la restauración falla de
# forma no esperada; deja el registro en FOTO_DIR/../clon-<nombre>.log.
set -euo pipefail

FOTO="${1:?uso: $0 FOTO_DIR [NOMBRE] [PUERTO]}"
NOMBRE="${2:-spinus-clon-produccion}"
PUERTO="${3:-54330}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGEN="${IMAGEN_PG:-$(docker inspect --format '{{.Config.Image}}' supabase_db_app_ortointegra 2>/dev/null || echo public.ecr.aws/supabase/postgres:17.6.1.167)}"
LOG="$(dirname "$FOTO")/clon-$NOMBRE.log"

for f in 01-roles.sql 03-esquema-completo.sql 04-migraciones.tsv 05-catalogo.jsonl; do
  [[ -s "$FOTO/$f" ]] || { echo "error: falta $FOTO/$f" >&2; exit 2; }
done
"$DIR/sin-datos.sh" "$FOTO"/0*.sql "$FOTO/04-migraciones.tsv" >/dev/null \
  || { echo "error: la foto no pasa sin-datos.sh; no se restaura." >&2; exit 2; }
if docker inspect "$NOMBRE" >/dev/null 2>&1; then
  echo "error: ya existe el contenedor $NOMBRE (bórralo con: docker rm -f $NOMBRE)" >&2; exit 2
fi

echo "→ contenedor $NOMBRE ($IMAGEN) en 127.0.0.1:$PUERTO"
docker run -d --name "$NOMBRE" -e POSTGRES_PASSWORD=postgres -p "127.0.0.1:$PUERTO:5432" "$IMAGEN" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NOMBRE" pg_isready -U supabase_admin -d postgres -q 2>/dev/null \
    && docker logs "$NOMBRE" 2>&1 | grep -q "PostgreSQL init process complete" && break
  sleep 2
done
sleep 2
sa() { docker exec -i "$NOMBRE" psql -X -q -U supabase_admin "$@"; }

: > "$LOG"
echo "→ roles"
python3 -I "$DIR/roles_desde_catalogo.py" "$FOTO/05-catalogo.jsonl" | sa -d postgres -v ON_ERROR_STOP=1 >>"$LOG" 2>&1
sa -d postgres < "$FOTO/01-roles.sql" >>"$LOG" 2>&1 || true

echo "→ base postgres vacía (la de la imagen trae esquemas de arranque que chocarían)"
# Dueño postgres, como en el stack local y en Supabase: public es de
# pg_database_owner, así que con la base de supabase_admin (lo que deja un
# CREATE DATABASE a secas) postgres no podría crear nada en public.
sa -d template1 -v ON_ERROR_STOP=1 -c "DROP DATABASE postgres WITH (FORCE)" -c "CREATE DATABASE postgres OWNER postgres" >>"$LOG" 2>&1

echo "→ estructura (03-esquema-completo.sql)"
sa -d postgres < "$FOTO/03-esquema-completo.sql" >>"$LOG" 2>&1 || true

echo "→ historial de migraciones"
tail -n +2 "$FOTO/04-migraciones.tsv" | grep -v '^# ' | docker exec -i "$NOMBRE" sh -c 'cat > /tmp/historial.tsv'
sa -d postgres -v ON_ERROR_STOP=1 -c "\\copy supabase_migrations.schema_migrations(version, name) from '/tmp/historial.tsv'" >>"$LOG" 2>&1 \
  || echo "aviso: no se cargó el historial (¿no existe la tabla en la foto?)" >&2

errores=$(grep -c 'ERROR' "$LOG" || true)
echo "→ $errores error(es) de restauración en $LOG:"
grep 'ERROR' "$LOG" | sed -E 's/^psql:[^:]*:[0-9]+: //' | sort | uniq -c | sort -rn | head -20 || true

echo "→ comparación clon ↔ foto"
"$DIR/comparar-estructura.sh" --silencioso --etiquetas foto,clon \
  ${ESPERADAS:+--esperadas "$ESPERADAS"} "$FOTO/05-catalogo.jsonl" "contenedor:$NOMBRE"
