#!/usr/bin/env bash
# invariante.sh CONTENEDOR LISTA DIR SALIDA -- corre invariante.sql sobre la base tal cual y después
# de aplicar CADA archivo de LISTA (en orden, como postgres, ON_ERROR_STOP). Se detiene si un
# archivo falla. Deja en SALIDA las filas de cada pasada y en SALIDA.logs/ el registro de cada archivo.
set -uo pipefail
C="$1"; LISTA="$2"; DIR="$3"; O="$4"
INV="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/invariante.sql"
mkdir -p "$O.logs"; : > "$O"
pasada() {
  echo "### $1" >> "$O"
  docker exec -i "$C" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -At -f - < "$INV" >> "$O" 2>&1
  echo "$1 rc=$? $(grep RESUMEN "$O" | tail -1)"
}
pasada base
while read -r f; do
  [[ -z "$f" ]] && continue
  if ! docker exec -i "$C" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$DIR/$f" > "$O.logs/$f.log" 2>&1; then
    echo "FALLO al aplicar $f"; exit 1
  fi
  pasada "$f"
done < "$LISTA"
