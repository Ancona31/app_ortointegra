#!/usr/bin/env bash
# F5 · Equivalencia de los disparadores de appointments entre dos clones.
#   bash supabase/fusion/notas/F5/casos-disparadores.sh CONTENEDOR_ANTES CONTENEDOR_DESPUES [DIR]
# Corre casos-disparadores.sql en los dos (cada uno en una transacción con
# ROLLBACK) y compara caso por caso: clínica|operación|cita|rol|SQLSTATE|HINT|mensaje.
# Sale 0 si son idénticos, 1 si alguno difiere (y los enseña).
set -euo pipefail
A="${1:?uso: $0 ANTES DESPUES [DIR]}"; B="${2:?uso: $0 ANTES DESPUES [DIR]}"
DIR="${3:-$(mktemp -d)}"
SQL="$(dirname "${BASH_SOURCE[0]}")/casos-disparadores.sql"
for c in "$A" "$B"; do
  docker exec -i "$c" psql -X -q -U supabase_admin -d postgres < "$SQL" | grep -E '^[AB]\|' > "$DIR/casos-$c.txt"
done
echo "casos: $(wc -l < "$DIR/casos-$A.txt") en $A, $(wc -l < "$DIR/casos-$B.txt") en $B"
echo "rechazados (SQLSTATE ≠ 00000): $(grep -vc '|00000|' "$DIR/casos-$A.txt") en $A"
if diff -u "$DIR/casos-$A.txt" "$DIR/casos-$B.txt" > "$DIR/diferencias.diff"; then
  echo "IDÉNTICOS: mismo SQLSTATE, HINT, mensaje y filas en todos los casos."
else
  echo "DIFIEREN:"; cat "$DIR/diferencias.diff"; exit 1
fi
