#!/usr/bin/env bash
# pruebas.sh CONTENEDOR DIR_PRUEBAS SALIDA_DIR -- como scripts/pruebas-sql.sh, pero no se detiene
set -uo pipefail
C="$1"; D="$2"; O="$3"; mkdir -p "$O"
: > "$O/resumen.tsv"
for f in "$D"/*.sql; do
  b=$(basename "$f" .sql)
  if docker exec -i "$C" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f - < "$f" > "$O/$b.out" 2>&1; then
    printf '%s\tPASA\n' "$b" >> "$O/resumen.tsv"
  else
    printf '%s\tFALLA\t%s\n' "$b" "$(grep -m1 -E 'ERROR' "$O/$b.out" | tr '\t' ' ' | cut -c1-300)" >> "$O/resumen.tsv"
  fi
done
cut -f2 "$O/resumen.tsv" | sort | uniq -c
