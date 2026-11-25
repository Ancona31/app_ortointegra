#!/usr/bin/env bash
# F5 · Mide el costo de guardar una cita en varios clones, alternándolos para
# que la deriva del equipo caiga por igual en todos.
#   bash supabase/fusion/notas/F5/medir-disparadores.sh SALIDA.jsonl CONTENEDOR...
# Variables: N (filas por operación, 2000), REPS (vueltas, 3).
# Cada corrida es medir-disparadores.sql: una transacción con ROLLBACK.
set -euo pipefail
OUT="${1:?uso: $0 SALIDA.jsonl CONTENEDOR...}"; shift
N="${N:-2000}"; REPS="${REPS:-3}"
SQL="$(dirname "${BASH_SOURCE[0]}")/medir-disparadores.sql"
: > "$OUT"
for rep in $(seq 1 "$REPS"); do
  for op in alta notas notas_put mueve estado eco_google borra_evento; do
    for rol in authenticated service_role; do
      for c in "$@"; do
        linea=$(docker exec -i "$c" psql -X -q -U supabase_admin -d postgres -v rol="$rol" -v op="$op" -v n="$N" < "$SQL" | grep '^{"op"')
        printf '{"contenedor":"%s","rep":%s,"r":%s}\n' "$c" "$rep" "$linea" >> "$OUT"
      done
    done
  done
done
echo "listo: $(wc -l < "$OUT") corridas en $OUT"
