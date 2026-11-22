#!/usr/bin/env bash
# aplicar.sh CONTENEDOR LISTA DIR LOG  -- aplica en orden, como postgres, ON_ERROR_STOP
set -uo pipefail
C="$1"; LISTA="$2"; DIR="$3"; LOG="$4"
: > "$LOG"
n=0
while read -r f; do
  [[ -z "$f" ]] && continue
  echo "=== $f" >> "$LOG"
  if ! docker exec -i "$C" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$DIR/$f" >> "$LOG" 2>&1; then
    echo "FALLO en $f"; exit 1
  fi
  n=$((n+1))
done < "$LISTA"
echo "aplicadas $n"
