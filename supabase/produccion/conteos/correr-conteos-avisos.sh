#!/usr/bin/env bash
# supabase/produccion/conteos/correr-conteos-avisos.sh
#
# Corre conteos-avisos-globales.sql (SÓLO LECTURA) contra producción y guarda la
# rejilla: los conteos de ANTES de aplicar M1 y M2 de «avisos globales»
# (20261202120000 y 20261202130000). Es correr-conteos.sh con otro archivo SQL y
# otro nombre de salida; ese (conteos.sql) es de antes de las 9 de la agenda y
# contra la base de hoy da ALTO en casi todo.
# Lo corre Angel en su terminal, desde la raíz del repo, con Docker encendido:
#
#   bash supabase/produccion/conteos/correr-conteos-avisos.sh
#
# Mismo mecanismo que scripts/produccion/foto-produccion.sh: la contraseña se
# pide con `read -rs` (no se ve, no va a la línea de comandos ni al historial
# de zsh), vive sólo en el entorno de este proceso y del contenedor efímero de
# psql (`docker run -e PGPASSWORD`, sin valor en la línea) y nunca se escribe
# en disco. psql sale de la imagen de Postgres del stack local: nada que
# instalar.
#
# Dónde guarda: ~/spinus-produccion-conteos-avisos/conteos-avisos-<fecha>.txt, una carpeta PROPIA
# (700): ni la de la foto vieja (~/spinus-produccion-foto, la del 22-nov) ni la de una foto nueva,
# en la que foto-produccion.sh se niega a escribir si ya tiene archivos. CONTEOS_DESTINO fuerza otra.
#
# Salida: 0 = todo OK/INFO · 1 = hay algún ALTO · 4 = sin ALTO pero con AVISO ·
#         3 = psql falló (conexión, permiso o timeout) · 2 = error de uso.
#
# Variables para ensayarlo contra otra base (por omisión, producción):
#   CONTEOS_HOST CONTEOS_PUERTO CONTEOS_USUARIO CONTEOS_BASE
#   CONTEOS_SSL (require|disable)  CONTEOS_RED (red de docker, p. ej. host)
#   CONTEOS_DESTINO (carpeta)  IMAGEN_PG (imagen con psql)
set -euo pipefail

HOST="${CONTEOS_HOST:-aws-0-us-west-2.pooler.supabase.com}"
PUERTO="${CONTEOS_PUERTO:-5432}"
USUARIO="${CONTEOS_USUARIO:-postgres.qpnegmmpneseirfyplbf}"
BASE="${CONTEOS_BASE:-postgres}"
SSL="${CONTEOS_SSL:-require}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="$DIR/conteos-avisos-globales.sql"

[[ -s "$SQL" ]] || { echo "error: no encuentro $SQL" >&2; exit 2; }
docker info >/dev/null 2>&1 || { echo "error: Docker no responde; enciéndelo primero." >&2; exit 2; }
# Sin el contenedor local, «docker inspect» deja una línea VACÍA antes de fallar: «grep .» la quita
# (si no, la imagen quedaba con un salto de línea delante: «docker: invalid reference format»).
IMAGEN="${IMAGEN_PG:-$(docker inspect --format '{{.Config.Image}}' supabase_db_app_ortointegra 2>/dev/null | grep . || echo public.ecr.aws/supabase/postgres:17.6.1.167)}"

DESTINO="${CONTEOS_DESTINO:-$HOME/spinus-produccion-conteos-avisos}"
umask 077
mkdir -p "$DESTINO"; chmod 700 "$DESTINO"
SALIDA="$DESTINO/conteos-avisos-$(date +%Y%m%d-%H%M%S).txt"

if [[ -t 0 ]]; then
  read -rsp "Contraseña de la base ($USUARIO@$HOST): " PGPASSWORD; echo
else
  read -r PGPASSWORD   # sólo para ensayos automáticos (por stdin, nunca por argumento)
fi
[[ -n "$PGPASSWORD" ]] || { echo "error: contraseña vacía" >&2; exit 2; }
export PGPASSWORD PGHOST="$HOST" PGPORT="$PUERTO" PGUSER="$USUARIO" PGDATABASE="$BASE" PGSSLMODE="$SSL"
export PGAPPNAME="spinus-conteos-avisos"   # se reconoce en pg_stat_activity

rc=0
docker run --rm -i ${CONTEOS_RED:+--network "$CONTEOS_RED"} \
  -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE -e PGAPPNAME "$IMAGEN" \
  psql -X -q -v ON_ERROR_STOP=1 -P pager=off -f - < "$SQL" > "$SALIDA" 2>&1 || rc=$?
unset PGPASSWORD
chmod 600 "$SALIDA"

cat "$SALIDA"
echo
if [[ $rc -ne 0 ]]; then
  echo "FALLÓ psql (código $rc). La salida de arriba dice por qué (no contiene la contraseña)." >&2
  echo "Guardado en $SALIDA" >&2
  exit 3
fi

# Resumen: las filas que no son OK ni INFO (id, veredicto y valor), para leerlas sin desplazarse.
resumen=$(awk -F'|' 'NF >= 6 {
    v = $NF; gsub(/^ +| +$/, "", v); id = $1; gsub(/^ +| +$/, "", id); val = $4; gsub(/^ +| +$/, "", val)
    if (v == "ALTO" || v == "AVISO") printf "  %-6s %-5s %s\n", id, v, val }' "$SALIDA")
altos=$(printf '%s\n' "$resumen" | grep -c ' ALTO ' || true)
avisos=$(printf '%s\n' "$resumen" | grep -c ' AVISO ' || true)
echo "Resumen: $altos ALTO, $avisos AVISO. Guardado en $SALIDA"
[[ -n "$resumen" ]] && printf '%s\n' "$resumen"
echo "Qué hacer con cada fila: supabase/produccion/conteos/LEEME.md, «Avisos globales (M1 y M2)»"
if (( altos > 0 )); then exit 1; elif (( avisos > 0 )); then exit 4; fi
exit 0
