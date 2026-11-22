#!/usr/bin/env bash
# F5 · Comprobación «quitar lo mío y volver a ponerlo» (ENCARGO-OLEADA-2 §7).
#
#   bash supabase/fusion/notas/F5/ensayo-quitar-y-poner.sh CONTENEDOR
#
# CONTENEDOR: un clon de ~/spinus-fusion/ref-originales (clonar-desde-foto.sh),
# p. ej. spinus-f5-trab en 54382. Lo deja con F5a y F5b fundidos aplicados.
# Pasos:
#   0. colateral F1: agenda_v2_encendida(uuid) (F1 aún no está en la referencia);
#   1. reversa de F5b;
#   2. colateral F2/F3: se guardan y se quitan las tres funciones que nombran
#      agenda_bloqueos (reserva_ocupacion, reservar_por_enlace, gcal_bloqueo_aplicar);
#   3. reversa de F5a → comparación con base-main (sólo objetos de F5);
#   4. F5a fundida; se reponen las tres funciones del paso 2, tal cual;
#   5. F5b fundida → comparación con ref-originales (con diferencias/F5.tsv);
#   6. segunda pasada de F5a y F5b.
set -euo pipefail
C="${1:?uso: $0 CONTENEDOR}"
R="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
F="$R/supabase/fusion"
SAL="${SALIDA:-$(mktemp -d)}"
pg() { docker exec -i "$C" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
# Objetos de F5 (para filtrar la comparación con base-main, donde F1-F4 sí siguen).
F5_RE='agenda_bloque|cita_proteger|trg_appointments_proteger|cita_tiene_nota_ligada|cerrada_en|sustituida_por|cierre_check|idx_appointments_clinica_(medico_)?inicio|horario_bloqueado'

echo "→ 0 · colateral F1 (agenda_v2_encendida)"
pg < "$F/notas/F5/ensayo-f1-agenda_v2_encendida.sql"

echo "→ 1 · reversa F5b"
pg -At < "$F/reversas/20261201170000_agenda_f5b_protecciones_cita_reversa.sql"

echo "→ 2 · colateral F2/F3: guardar y quitar las funciones que nombran agenda_bloqueos"
pg -At > "$SAL/colateral-reponer.sql" <<'SQL'
SELECT pg_get_functiondef(p.oid) || E';\n'
       || 'REVOKE ALL ON FUNCTION ' || p.oid::regprocedure::text || ' FROM PUBLIC, anon, authenticated, service_role;' || E'\n'
       || coalesce((SELECT string_agg('GRANT EXECUTE ON FUNCTION ' || p.oid::regprocedure::text || ' TO ' || quote_ident(r.rolname) || ';', E'\n')
                      FROM aclexplode(p.proacl) x JOIN pg_roles r ON r.oid = x.grantee
                     WHERE x.grantee <> p.proowner), '') || E'\n'
       || coalesce('COMMENT ON FUNCTION ' || p.oid::regprocedure::text || ' IS ' || quote_literal(obj_description(p.oid, 'pg_proc')) || ';', '')
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname IN ('reserva_ocupacion', 'reservar_por_enlace', 'gcal_bloqueo_aplicar');
SQL
pg -At <<'SQL'
DROP FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz);
DROP FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid);
DROP FUNCTION public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date);
SQL

echo "→ 3 · reversa F5a"
pg -At < "$F/reversas/20261201130000_agenda_f5a_bloqueos_reversa.sql"
echo "   comparación con base-main (sólo F5; F1-F4 siguen en el clon):"
bash "$R/scripts/produccion/comparar-estructura.sh" --tsv "$SAL/vs-base-main.tsv" --etiquetas base-main,clon \
  ~/spinus-fusion/base-main/05-catalogo.jsonl "contenedor:$C" > "$SAL/vs-base-main.txt" 2>&1 || true
awk -F'\t' -v re="$F5_RE" 'NR > 1 && $4 ~ re' "$SAL/vs-base-main.tsv" > "$SAL/vs-base-main-F5.tsv" || true
echo "   diferencias de objetos F5 con base-main: $(wc -l < "$SAL/vs-base-main-F5.tsv")"

echo "→ 4 · F5a fundida + reponer el colateral"
pg -At < "$F/fundidas/20261201130000_agenda_f5a_bloqueos.sql" | tee "$SAL/f5a-1.txt"
pg -At < "$SAL/colateral-reponer.sql" > /dev/null

echo "→ 5 · F5b fundida"
pg -At < "$F/fundidas/20261201170000_agenda_f5b_protecciones_cita.sql" | tee "$SAL/f5b-1.txt"
echo "   comparación con ref-originales:"
cat "$R/scripts/produccion/esperadas-clon.tsv" "$F/diferencias/F5.tsv" > "$SAL/esperadas.tsv"
bash "$R/scripts/produccion/comparar-estructura.sh" --etiquetas ref,clon --tsv "$SAL/vs-ref.tsv" \
  --esperadas "$SAL/esperadas.tsv" \
  ~/spinus-fusion/ref-originales/05-catalogo.jsonl "contenedor:$C" | tee "$SAL/vs-ref.txt" | tail -n 40 || true

echo "→ 6 · segunda pasada"
pg -At < "$F/fundidas/20261201130000_agenda_f5a_bloqueos.sql" > "$SAL/f5a-2.txt"
pg -At < "$F/fundidas/20261201170000_agenda_f5b_protecciones_cita.sql" > "$SAL/f5b-2.txt"
grep -c '|OK$' "$SAL/f5a-2.txt" "$SAL/f5b-2.txt" || true
grep '|REVISAR$' "$SAL"/f5?-?.txt || echo "   sin REVISAR en ninguna pasada"
echo "Salida en $SAL"
