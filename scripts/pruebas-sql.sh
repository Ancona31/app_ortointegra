#!/usr/bin/env bash
# Corre las pruebas SQL de supabase/pruebas-sql/ contra la base local de Docker.
# Cada archivo abre su transacción y termina en rollback. Se detiene en el
# primer error. Nunca toca producción: solo habla con el contenedor local.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
proyecto="$(sed -nE 's/^project_id[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$raiz/supabase/config.toml")"
if [ -z "$proyecto" ]; then
  echo "No encontré project_id en supabase/config.toml" >&2
  exit 1
fi
contenedor="supabase_db_${proyecto}"

if [ "$(docker inspect -f '{{.State.Running}}' "$contenedor" 2>/dev/null)" != "true" ]; then
  echo "La base local no está corriendo (contenedor $contenedor)." >&2
  exit 1
fi

export LC_ALL=C
shopt -s nullglob
archivos=("$raiz"/supabase/pruebas-sql/*.sql)
if [ ${#archivos[@]} -eq 0 ]; then
  echo "No hay pruebas en supabase/pruebas-sql/" >&2
  exit 1
fi

for archivo in "${archivos[@]}"; do
  echo "→ $(basename "$archivo")"
  docker exec -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f - < "$archivo"
done
echo "Pruebas SQL: ${#archivos[@]} archivo(s) en verde (contenedor $contenedor)."
