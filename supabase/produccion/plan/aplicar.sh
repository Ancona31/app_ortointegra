#!/usr/bin/env bash
# supabase/produccion/plan/aplicar.sh
#
# Aplica las 12 migraciones nuevas (las 9 de «agenda v2 lista para producción»,
# ya aplicadas en producción el 2026-11-23, las 2 de «avisos globales» y la de
# «agenda para todos», M3) UNA A
# UNA, con psql y confirmación escrita antes de cada una, y registra cada
# versión en supabase_migrations.schema_migrations con
# `supabase migration repair --status applied` (CLI 2.117.0). Lo corre Angel,
# desde la raíz del repo, con Docker encendido. Ver PLAN-DE-APLICACION.md.
#
#   bash supabase/produccion/plan/aplicar.sh estado            # sólo lee: versión, ida y vuelta, cuentas, historial, qué falta
#   bash supabase/produccion/plan/aplicar.sh respaldo          # volcado lógico CIFRADO (estructura + datos)
#   bash supabase/produccion/plan/aplicar.sh aplicar           # las 12, una a una (las ya registradas y aplicadas se saltan)
#   bash supabase/produccion/plan/aplicar.sh reversa           # las reversas de la agenda (M3, M2, M1, T, F5b … F1), en orden inverso
#   bash supabase/produccion/plan/aplicar.sh reversa-truncate  # las 2 de TRUNCATE (20261126, luego 20261125); reabre el hueco
#
# CÓMO VIAJA CADA ARCHIVO (hallazgo A1 de auditoria/RONDA-1.md): ENTERO, EN UNA
# SOLA PETICIÓN (`psql -c "<archivo>"`: un solo mensaje de consulta simple).
# El servidor ejecuta el BEGIN … COMMIT del archivo sin esperar al cliente entre
# sentencias, así que los candados duran lo que tarda el servidor, no N viajes
# por el pooler. psql 17 enseña el resultado de CADA sentencia (SHOW_ALL_RESULTS,
# por omisión desde la 15) y los NOTICE: la rejilla se sigue viendo. Ante un
# error el servidor deja de ejecutar el resto del texto y la transacción se
# deshace; psql sale con 1. Antes del archivo, en su propia petición, la sesión
# fija idle_in_transaction_session_timeout, lock_timeout y statement_timeout
# (con SQL, no con PGOPTIONS: así pasa por cualquier pooler de sesión).
#
# TRAS UN FALLO no afirma nada: pregunta al catálogo por el objeto testigo de
# ese archivo y dice «aplicada sin registrar», «no aplicada» o «no lo sé»
# (hallazgo A2). Un fallo al LEER el historial detiene el guion.
#
# La contraseña: si PGPASSWORD ya está en el entorno, se usa esa; si no, se
# pide con `read -rs`. Nunca va en la línea de comandos ni al historial de
# zsh, nunca se escribe en disco ni en los registros, nunca se imprime. Vive en
# el entorno de este proceso; a cada contenedor efímero le llega por su entrada
# estándar y sólo la ve el proceso de psql/pg_dump de dentro (no la
# configuración del contenedor: ver pg()). La URL que recibe la CLI va SIN
# contraseña: la toma de PGPASSWORD. Nunca usa `supabase link`, `--linked` ni
# `db push`.
#
# Destino: si APL_HOST es 127.0.0.1, localhost o ::1, es un ENSAYO; cualquier
# otro host (por omisión, el pooler de producción) es PRODUCCIÓN y exige
# escribir PRODUCCION antes de pedir la contraseña.
#
# Ensayo contra un clon local (lo que se probó; ver el plan):
#   APL_HOST=127.0.0.1 APL_PUERTO=54373 APL_USUARIO=postgres APL_SSL=disable \
#   APL_RED=host APL_DESTINO=/ruta/ensayo bash supabase/produccion/plan/aplicar.sh aplicar
# Sin terminal (ensayos automáticos) lee de stdin, una por línea: [la
# contraseña, si no está en PGPASSWORD], [la frase del cifrado, sólo en
# «respaldo»] y cada confirmación.
set -euo pipefail

HOST="${APL_HOST:-aws-0-us-west-2.pooler.supabase.com}"
PUERTO="${APL_PUERTO:-5432}"
USUARIO="${APL_USUARIO:-postgres.qpnegmmpneseirfyplbf}"
BASE="${APL_BASE:-postgres}"
SSL="${APL_SSL:-require}"
FECHA="$(date +%Y%m%d-%H%M%S)"
DESTINO="${APL_DESTINO:-$HOME/spinus-produccion-foto/aplicacion-$(date +%Y%m%d)}"
CLI=(npx --yes supabase@2.117.0 --agent no)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$DIR/../../.." && pwd)"
MODO="${1:-}"
# Ajustes de la SESIÓN de psql, antes de cada archivo (A1). Las migraciones
# fijan además sus propios SET LOCAL (lock_timeout 5 s; statement_timeout 60 s,
# F5b 120 s), que mandan dentro de su transacción.
#  · idle_in_transaction_session_timeout: si una transacción se queda abierta
#    esperando al cliente (no debería: el archivo va en una petición), el
#    servidor la corta y suelta los candados a los 10 s.
#  · statement_timeout 120 s: tope para lo que no fija el suyo (1, 2, T y las
#    reversas de TRUNCATE). Desde PostgreSQL 13 cuenta POR SENTENCIA también
#    dentro de un texto de varias.
#  · Se quedan A PROPÓSITO a nivel de sesión (A15, ronda 2): sólo hacen más
#    estricta la conexión. Si el pooler la reutilizara sin limpiarla, quien la
#    herede tendría, como mucho, un plazo más corto: nunca un permiso de más. La
#    confirmación de pérdida de datos de una reversa, en cambio, NO va aquí (ver
#    correr_sql): no puede sobrevivir a la petición que la usa.
SESION_SQL="SET idle_in_transaction_session_timeout = '10s'; SET lock_timeout = '5s'; SET statement_timeout = '120s'"
# Un argumento de la línea de órdenes no puede pasar de 128 KiB en Linux
# (MAX_ARG_STRLEN = 131072 bytes); F3, el mayor, tiene ~100 KB.
MAX_BYTES=130000

# El orden es el de nombre de archivo, y es obligatorio (ver el plan, §1).
MIGRACIONES=(
  20261125170000_audit_log_sin_truncate
  20261126120000_public_sin_truncate
  20261201120000_agenda_f1_ajustes_tipos_horarios
  20261201130000_agenda_f5a_bloqueos
  20261201140000_agenda_f3_reserva_enlace
  20261201150000_agenda_f2_google
  20261201160000_agenda_f4_confirmacion_correos_avisos
  20261201170000_agenda_f5b_protecciones_cita
  20261201180000_agenda_sin_truncate
  20261202120000_avisos_globales_modelo
  20261202130000_avisos_globales_rsvp_rechazo
  20261203120000_agenda_para_todos
  20261203130000_avisos_globales_cierre_auditoria
  20261204120000_reserva_purga_y_tope
)
# Orden inverso: M4, MA, M3, M2, M1, T, F5b, F4, F2, F3, F5a, F1. Las dos de TRUNCATE van aparte (reversa-truncate).
# M4 (purga y tope de la reserva) antes que F3: devuelve reserva_codigo_emitir a su cuerpo.
# MA (cierre de la auditoría de M1) antes que M2 y M1: reescribe tres funciones de M1.
# M3 antes que F1 (su disparador de clinicas escribe agenda_ajustes, que borra la de F1; no depende de
# M1 ni de M2). M2 antes que M1 (M2 exige M1) y M1 antes que T y F4 (la de F4 borra avisos_clinica,
# de la que cuelgan los escritores de M1).
# OJO con M3: toda reversa exige la v2 APAGADA en todas las clínicas (correr_sql), y M3 la enciende
# en todas. Para deshacerla hay que apagarla antes, fila a fila, como postgres: ver
# docs/spec/agenda-para-todos/ENSAYO-M3.md, «Deshacer M3».
REVERSAS=(
  20261204120000_reserva_purga_y_tope
  20261203130000_avisos_globales_cierre_auditoria
  20261203120000_agenda_para_todos
  20261202130000_avisos_globales_rsvp_rechazo
  20261202120000_avisos_globales_modelo
  20261201180000_agenda_sin_truncate
  20261201170000_agenda_f5b_protecciones_cita
  20261201160000_agenda_f4_confirmacion_correos_avisos
  20261201150000_agenda_f2_google
  20261201140000_agenda_f3_reserva_enlace
  20261201130000_agenda_f5a_bloqueos
  20261201120000_agenda_f1_ajustes_tipos_horarios
)
REVERSAS_TRUNCATE=(
  20261126120000_public_sin_truncate
  20261125170000_audit_log_sin_truncate
)
MAIN=(20260912190416 20260913 20260914 20260919 20260919230000)
HUMO_OK=0; INCOHERENTES=0; PENDIENTES=0; FALTA_MAIN=0; CON_DATOS=""

die() { echo "ALTO: $*" >&2; exit 1; }
[[ "$MODO" =~ ^(estado|respaldo|aplicar|reversa|reversa-truncate)$ ]] || { sed -n '2,50p' "$0"; exit 2; }
# G9 (ronda 2 del guion): dos aplicar.sh que escriben, a la vez en este equipo,
# no. Cerrojo de archivo (flock) mientras dura el proceso; lo heredan sus hijos
# (los contenedores de psql y la CLI), que son cortos y no arrancan servidores.
CERROJO="${XDG_RUNTIME_DIR:-/tmp}/spinus-aplicar.lock"
if [[ "$MODO" =~ ^(aplicar|reversa|reversa-truncate)$ ]]; then
  exec 9>"$CERROJO"
  flock -n 9 || die "ya hay otro aplicar.sh (aplicar o reversa) corriendo en este equipo (cerrojo $CERROJO). Espera a que termine; no corras dos a la vez."
fi
[[ -f "$REPO/supabase/config.toml" && -d "$REPO/supabase/migrations" ]] || die "córrelo desde el repo (no encuentro supabase/)."
docker info >/dev/null 2>&1 || die "Docker no responde; enciéndelo primero."
# Sin el contenedor local, «docker inspect» deja una línea VACÍA antes de fallar: «grep .» la quita
# (si no, la imagen quedaba con un salto de línea delante: «docker: invalid reference format»).
IMAGEN="${IMAGEN_PG:-$(docker inspect --format '{{.Config.Image}}' supabase_db_app_ortointegra 2>/dev/null | grep . || echo public.ecr.aws/supabase/postgres:17.6.1.167)}"

leer() {  # $1 = aviso; $2 = s para no mostrar lo escrito. Deja la respuesta en RESP.
  if [[ -t 0 ]]; then
    if [[ "${2:-}" == s ]]; then read -rsp "$1" RESP; echo; else read -rp "$1" RESP; fi
  else
    echo -n "$1"; read -r RESP || RESP=""; [[ "${2:-}" == s ]] && echo || echo "$RESP"
  fi
}

preparar() {
  case "$HOST" in
    127.0.0.1|localhost|::1)
      # G12: «local» son SÓLO estos tres literales. Un túnel o reenvío local
      # (ssh -L, un proxy) hacia otra base pasaría por aquí como ENSAYO, sin
      # pedir PRODUCCION: no se usa nunca un túnel hacia producción. El servidor
      # no da una marca fiable de «soy producción» (un clon de la foto copia sus
      # roles y su configuración), por eso no se le pregunta.
      echo "Destino: ENSAYO ($USUARIO@$HOST:$PUERTO/$BASE). OJO: «local» = 127.0.0.1, localhost o ::1; por un túnel local hacia otra base NO se pediría PRODUCCION." ;;
    *)
      echo "Destino: PRODUCCIÓN ($USUARIO@$HOST:$PUERTO/$BASE)."
      [[ "$HOST" == "aws-0-us-west-2.pooler.supabase.com" ]] \
        || echo "AVISO: no es el pooler de siempre; trátalo como producción."
      leer "Escribe PRODUCCION para seguir: "; [[ "$RESP" == PRODUCCION ]] || die "no confirmado." ;;
  esac
  umask 077
  mkdir -p "$DESTINO"; chmod 700 "$DESTINO"
  LOG="$DESTINO/$MODO-$FECHA.log"
  if [[ -n "${PGPASSWORD:-}" ]]; then
    echo "Uso la contraseña de PGPASSWORD del entorno (no se imprime)."
  else
    leer "Contraseña de la base ($USUARIO@$HOST): " s; PGPASSWORD="$RESP"; RESP=""
  fi
  [[ -n "$PGPASSWORD" ]] || die "contraseña vacía."
  export PGPASSWORD PGHOST="$HOST" PGPORT="$PUERTO" PGUSER="$USUARIO" PGDATABASE="$BASE" PGSSLMODE="$SSL"
  URL="postgresql://${USUARIO}@${HOST}:${PUERTO}/${BASE}?sslmode=${SSL}"
  echo "Registro completo de esta sesión: $LOG"
}

pg() {  # psql/pg_dump de la imagen local en un contenedor efímero; supabase/ montado sólo lectura.
  # G11 (ronda 2 del guion): la contraseña NO va con «-e PGPASSWORD», que la deja
  # en la configuración del contenedor (docker inspect, Config.Env) mientras vive.
  # Entra por la entrada estándar del contenedor (printf es interno de bash: no
  # sale en ps) y el sh de dentro la lee y la exporta sólo al proceso de psql.
  # La entrada del contenedor es esa tubería: no lee nada más (las
  # confirmaciones son de este script).
  printf '%s\n' "$PGPASSWORD" | docker run --rm -i ${APL_RED:+--network "$APL_RED"} -v "$REPO/supabase:/s:ro" \
    -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE "$IMAGEN" \
    sh -c 'IFS= read -r PGPASSWORD; export PGPASSWORD; exec "$@" </dev/null' sh "$@"
}
q() { pg psql -X -q -At -v ON_ERROR_STOP=1 -c "$1"; }  # una consulta, salida cruda

registradas() {  # versiones del historial, una por línea. Si no puede leerlo, o NO EXISTE la tabla, DETIENE.
  # G6 (ronda 2 del guion): antes decía «vacío si la tabla no existe», pero un
  # subselect que nombra la tabla falla al analizarse aunque el CASE no lo
  # ejecute. Ahora la ausencia se pregunta aparte y es un ALTO propio: sin la
  # tabla del historial no se aplica nada (plan §1: se para y se toma otra foto).
  local hay
  hay="$(q "select to_regclass('supabase_migrations.schema_migrations') is not null")" \
    || die "no pude LEER el historial (supabase_migrations.schema_migrations). No sigo: sin él no sé qué está aplicado. Mira el error de arriba."
  [[ "$hay" == t ]] || die "NO EXISTE supabase_migrations.schema_migrations en el destino. No sigo: el plan (§1) dice parar y tomar otra foto."
  q "select coalesce(string_agg(version, E'\n' order by version), '') from supabase_migrations.schema_migrations" \
    || die "no pude LEER el historial (supabase_migrations.schema_migrations). No sigo: sin él no sé qué está aplicado. Mira el error de arriba."
}
# Uso SIEMPRE así, fuera de un «if»: hist="$(registradas)" || exit 1
# (dentro de un if o de un $(…) en una condición, bash no aplica set -e).
en_historial() { grep -qx "$1" <<<"$2"; }  # $1 = versión; $2 = historial ya leído

# Objeto testigo de cada migración: existe si y sólo si su COMMIT se hizo (y su
# reversa no). Lo crea cada archivo y no existe en la foto de producción.
testigo_sql() {
  case "$1" in
    20261125170000) echo "exists(select 1 from pg_trigger where tgrelid = to_regclass('public.audit_log') and tgname = 'prevent_audit_truncate' and not tgisinternal)" ;;
    20261126120000) echo "to_regprocedure('public.prohibir_truncate()') is not null" ;;
    20261201120000) echo "to_regclass('public.agenda_ajustes') is not null" ;;
    20261201130000) echo "to_regclass('public.agenda_bloqueos') is not null" ;;
    20261201140000) echo "to_regclass('public.reserva_enlaces') is not null" ;;
    20261201150000) echo "to_regclass('public.gcal_sync_estado') is not null" ;;
    20261201160000) echo "to_regclass('public.avisos_clinica') is not null" ;;
    20261201170000) echo "exists(select 1 from pg_trigger where tgrelid = to_regclass('public.appointments') and tgname = 'trg_appointments_proteger_borrado' and not tgisinternal)" ;;
    20261201180000) echo "exists(select 1 from pg_trigger where tgrelid = to_regclass('public.agenda_bloqueos') and tgname = 'trg_agenda_bloqueos_sin_truncate' and not tgisinternal)" ;;
    # M1: la RPC (su reversa SIEMPRE la quita; avisos_vistos no serviría de testigo en una base a medias).
    # Si la reversa de M1 corrió CON datos, avisos_clinica conserva la forma de M1 (no borra avisos) pero
    # la RPC ya no está: M1 sale «pendiente» y «aplicar» la vuelve a ofrecer; su pre-vuelo reconoce esa
    # forma conservada y completa lo que falta (rejilla de M1, fila 11).
    20261202120000) echo "to_regprocedure('public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)') is not null" ;;
    20261202130000) echo "to_regprocedure('public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])') is not null" ;;
    # M3: la función del disparador de clinicas (su reversa la quita; el DEFAULT y las filas no sirven de testigo).
    20261203120000) echo "to_regprocedure('public.agenda_ajustes_de_clinica_nueva()') is not null" ;;
    20261203130000) echo "to_regprocedure('public.avisos_transaccion_mas_antigua()') is not null" ;;
    20261204120000) echo "to_regprocedure('public.reserva_purgar(integer)') is not null" ;;
    *) return 1 ;;
  esac
}
testigo_nombre() {
  case "$1" in
    20261125170000) echo "disparador prevent_audit_truncate en audit_log" ;;
    20261126120000) echo "función public.prohibir_truncate()" ;;
    20261201120000) echo "tabla public.agenda_ajustes" ;;
    20261201130000) echo "tabla public.agenda_bloqueos" ;;
    20261201140000) echo "tabla public.reserva_enlaces" ;;
    20261201150000) echo "tabla public.gcal_sync_estado" ;;
    20261201160000) echo "tabla public.avisos_clinica" ;;
    20261201170000) echo "disparador trg_appointments_proteger_borrado" ;;
    20261201180000) echo "disparador trg_agenda_bloqueos_sin_truncate" ;;
    20261202120000) echo "función public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)" ;;
    20261202130000) echo "función public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])" ;;
    20261203120000) echo "función public.agenda_ajustes_de_clinica_nueva()" ;;
    20261203130000) echo "función public.avisos_transaccion_mas_antigua()" ;;
    20261204120000) echo "función public.reserva_purgar(integer)" ;;
  esac
}

# ¿Está aplicada? Imprime si, no o «nose» (no se pudo preguntar, o hay otra
# sesión de este usuario con una transacción abierta que aún podría terminarla:
# con el archivo en una petición, el servidor sigue aunque el cliente muera).
# Espera hasta 20 s a que esas sesiones terminen antes de contestar.
aplicada() {  # $1 = versión
  local cond r i
  cond="$(testigo_sql "$1")" || { echo nose; return 0; }
  for i in 1 2 3 4 5 6 7 8 9 10; do
    r="$(q "select case when (select count(*) from pg_stat_activity where usename = current_user and pid <> pg_backend_pid()
                                and xact_start is not null and state <> 'idle') > 0 then 'ocupado'
                        when $cond then 'si' else 'no' end" 2>/dev/null)" || { echo nose; return 0; }
    [[ "$r" != ocupado ]] && { echo "$r"; return 0; }
    sleep 2
  done
  echo nose
}

# Las 12, historial frente a catálogo (G1 y G4, ronda 2 del guion). Imprime una
# línea por migración y deja en INCOHERENTES cuántas no cuadran:
#   pendiente                  (ni registrada ni aplicada)
#   aplicada y registrada
#   ALTO aplicada SIN registrar (testigo sí, historial no)
#   ALTO registrada SIN aplicar (historial sí, testigo no): el historial miente
# $1 = historial ya leído. Si no puede preguntar al catálogo, DETIENE.
testigos_todos() {  # una línea «versión|si|no» por cada una de las 12
  local v filas=()
  for v in "${MIGRACIONES[@]}"; do v="${v%%_*}"; filas+=("('$v', $(testigo_sql "$v"))"); done
  q "select v || '|' || case when c then 'si' else 'no' end from (values $(IFS=,; echo "${filas[*]}")) x(v, c) order by v" \
    || die "no pude preguntar al catálogo por los testigos de las 12. No sigo. Mira el error de arriba."
}
coherencia() {  # $1 = historial
  local t linea v a r m
  t="$(testigos_todos)" || exit 1
  INCOHERENTES=0; PENDIENTES=0
  for m in "${MIGRACIONES[@]}"; do
    v="${m%%_*}"
    linea="$(grep "^$v|" <<<"$t" || true)"; a="${linea#*|}"
    en_historial "$v" "$1" && r=si || r=no
    case "$r$a" in
      sisi) echo "aplicada y registrada:      $m" ;;
      nono) echo "pendiente:                  $m"; PENDIENTES=$((PENDIENTES + 1)) ;;
      nosi) echo "ALTO aplicada SIN registrar: $m ($(testigo_nombre "$v") existe; no está en el historial). Qué hacer: plan §8, «aplicada sin registrar»."
            INCOHERENTES=$((INCOHERENTES + 1)) ;;
      sino) echo "ALTO registrada SIN aplicar: $m (está en el historial; $(testigo_nombre "$v") NO existe). Qué hacer: plan §8, «registrada sin aplicar»."
            INCOHERENTES=$((INCOHERENTES + 1)) ;;
      *)    echo "ALTO sin respuesta del catálogo: $m"; INCOHERENTES=$((INCOHERENTES + 1)) ;;
    esac
  done
}

ida_y_vuelta() {  # 5 × select 1 en una sesión; imprime la mediana en ms (lo que suma cada viaje por la red)
  pg psql -X -q -v ON_ERROR_STOP=1 -c '\timing on' -c 'select 1' -c 'select 1' -c 'select 1' -c 'select 1' -c 'select 1' 2>&1 \
    | awk '/^Time: /{print $2}' | sort -n | awk '{a[NR]=$1} END{if (NR) printf "%.1f ms (mediana de %d)\n", a[int((NR+1)/2)], NR; else print "no medida"}'
}

# Prueba de humo de SÓLO LECTURA: una petición del tamaño del archivo mayor,
# por el MISMO camino que una migración (los tres -c), para saber antes del día
# que el pooler acepta ese tamaño y cuánto tarda. BEGIN TRANSACTION READ ONLY:
# el servidor rechaza cualquier escritura en ella (25006), y la propia consulta
# enseña que la transacción no tiene identificador de escritura asignado.
humo_peticion_grande() {
  local mayor=0 f b sql relleno t0 t1 salida
  for f in "${MIGRACIONES[@]}"; do b=$(wc -c < "$REPO/supabase/migrations/$f.sql"); (( b > mayor )) && mayor=$b; done
  for f in "${REVERSAS[@]}" "${REVERSAS_TRUNCATE[@]}"; do b=$(wc -c < "$REPO/supabase/reversas/${f}_reversa.sql"); (( b > mayor )) && mayor=$b; done
  local linea='-- relleno de la prueba de humo de aplicar.sh: solo un comentario (ASCII), no hace nada' n
  n=$(( mayor / (${#linea} + 1) + 1 ))   # sin tubería: con pipefail, un «head» cortaría con SIGPIPE
  relleno="$(printf -- "$linea%.0s\n" $(seq 1 "$n"))"
  sql="BEGIN TRANSACTION READ ONLY;
$relleno
SELECT 'humo: petición de ' || octet_length(current_query()) || ' bytes en UNA petición; transacción de sólo lectura: '
       || current_setting('transaction_read_only') || '; identificador de escritura asignado: '
       || coalesce(pg_current_xact_id_if_assigned()::text, 'ninguno') AS humo;
SELECT 1 AS uno;
COMMIT;"
  salida="$DESTINO/humo-peticion-grande.salida.txt"
  echo "── prueba de humo de SÓLO LECTURA: no escribe nada (BEGIN TRANSACTION READ ONLY). Una petición de ~$mayor bytes, el tamaño del archivo mayor."
  t0=$(date +%s.%N)
  HUMO_OK=0
  if pg psql -X -q -v ON_ERROR_STOP=1 -P pager=off -At -c "$SESION_SQL" -c "$sql" > "$salida" 2>&1; then
    HUMO_OK=1
    t1=$(date +%s.%N)
    grep '^humo:' "$salida" || true
    echo "   aceptada; $(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f s", b-a}') de punta a punta (arranque del contenedor incluido). No se escribió nada."
  else
    cat "$salida"
    echo "   ⚠️ NO aceptada (arriba el error). No se escribió nada. «aplicar» NO ofrecerá ninguna migración hasta que esta prueba pase (G3): plan §2."
  fi
}

estado() {
  echo "── servidor y sesión"; q "select version()" || die "no puedo conectar."; q "select current_user, current_setting('search_path')"
  echo "── ida y vuelta al servidor (select 1): $(ida_y_vuelta)"
  humo_peticion_grande
  echo "── tamaños (sólo cuentas; ningún dato): citas, consultorios, clínicas, audit_log"
  q "select (select count(*) from public.appointments), (select count(*) from public.consultorios),
            (select count(*) from public.clinicas), (select count(*) from public.audit_log)"
  local hist; hist="$(registradas)" || exit 1
  echo "── historial (supabase_migrations.schema_migrations)"
  [[ -n "$hist" ]] && echo "$hist" || echo "(la tabla existe, pero está VACÍA: ver el plan, §1, antes de seguir)"
  local v
  FALTA_MAIN=0
  for v in "${MAIN[@]}"; do en_historial "$v" "$hist" || { echo "FALTA de main: $v"; FALTA_MAIN=1; }; done
  echo "── las 12: historial frente a catálogo (su objeto testigo)"
  coherencia "$hist"
  # Sale ≠ 0 si algo no está bien: falta main, la prueba de humo no pasó (G3) o
  # alguna de las 12 no cuadra entre historial y catálogo (G1/G4).
  (( FALTA_MAIN == 0 && HUMO_OK == 1 && INCOHERENTES == 0 ))
}

huella_ok() {  # $1 = ruta relativa al repo; compara con huellas.sha256 del plan
  local esperada actual
  esperada="$(awk -v f="$1" '$2 == f {print $1}' "$DIR/huellas.sha256")"
  actual="$(cd "$REPO" && sha256sum "$1" | cut -d' ' -f1)"
  [[ -n "$esperada" && "$esperada" == "$actual" ]]
}

# G7 (ronda 2 del guion): psql escribe el ERROR (stderr, sin búfer) antes que
# los resultados de la misma petición (stdout, con búfer), así que lo último que
# se lee encima del «ALTO» parecen órdenes que salieron bien. Tras un fallo se
# repite aquí, al final y bien visible, la línea del error.
repetir_error() {
  local e
  e="$(grep -E '(ERROR|FATAL|PANIC):|server closed the connection|could not connect|connection to server' "$ULTIMA_SALIDA" 2>/dev/null | head -n 3 || true)"
  echo "──────── EL ERROR (repetido; arriba puede salir antes que el resto de la salida):" >&2
  echo "${e:-  (psql no escribió ninguna línea de error: mira $ULTIMA_SALIDA)}" >&2
  echo "────────" >&2
}

correr_sql() {  # $1 = ruta relativa a supabase/; $2 = «con-datos» para confirmar la pérdida en una reversa; $3 = «reversa».
  local salida rc sql pre="$SESION_SQL" bytes
  salida="$DESTINO/$(basename "$1" .sql).salida.txt"
  bytes=$(wc -c < "$REPO/supabase/$1")
  (( bytes < MAX_BYTES )) || die "supabase/$1 tiene $bytes bytes: no cabe en una sola petición (-c, máximo $MAX_BYTES). No se aplicó nada; consultar."
  sql="$(<"$REPO/supabase/$1")"
  # Confirmación de pérdida de datos de una reversa (A15, ronda 2 de la
  # auditoría): NO con un SET de sesión, que viviría lo que la conexión (y el
  # pooler puede reutilizarla). Va con SET LOCAL en una transacción que abre la
  # MISMA petición, delante del archivo: el BEGIN del archivo avisa «there is
  # already a transaction in progress» y sigue dentro de ella (lo que su
  # cabecera documenta), las guardas leen current_setting('spinus.reversa_con_datos',
  # true) dentro de esa transacción, y el ajuste muere con ella: en el COMMIT del
  # archivo si sale bien y en el ROLLBACK si falla. Exige que lo primero del
  # archivo, quitados comentarios y líneas vacías, sea su BEGIN.
  #
  # G2 (ronda 2 del guion): «la v2 apagada en TODAS las clínicas» (regla de
  # Angel) se comprueba en la MISMA transacción de cada reversa, no sólo una vez
  # al principio de la cadena: un bloque DO delante del archivo bloquea las
  # escrituras de agenda_ajustes hasta el COMMIT (LOCK … IN SHARE MODE, con el
  # lock_timeout de la sesión) y aborta sin tocar nada si alguna clínica la tiene
  # encendida, diciendo cuáles. Si la tabla ya no existe (F1 deshecha), no mira.
  if [[ "${3:-}" == reversa ]]; then
    [[ "$(grep -v -E '^[[:space:]]*(--.*)?$' "$REPO/supabase/$1" | head -n 1 || true)" == "BEGIN;" ]] \
      || die "supabase/$1 no empieza por BEGIN;: no puedo poner la guarda de la v2 ni la confirmación dentro de su transacción. No se corrió nada."
    local confirmacion=""
    [[ "${2:-}" == con-datos ]] && confirmacion="SET LOCAL spinus.reversa_con_datos = 'si';"
    sql="BEGIN;
$confirmacion
DO \$aplicar_sh\$
DECLARE v_ids text;
BEGIN
  IF to_regclass('public.agenda_ajustes') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public.agenda_ajustes IN SHARE MODE';
    EXECUTE 'SELECT string_agg(clinica_id::text, '', '' ORDER BY clinica_id) FROM public.agenda_ajustes WHERE agenda_v2_encendida' INTO v_ids;
    IF v_ids IS NOT NULL THEN
      RAISE EXCEPTION 'REVERSA PARADA POR aplicar.sh: la v2 está ENCENDIDA en estas clínicas: %. Apágala en TODAS antes de revertir. No se tocó nada.', v_ids;
    END IF;
  END IF;
END \$aplicar_sh\$;
$sql"
  fi
  set +e
  pg psql -X -v ON_ERROR_STOP=1 -P pager=off -c "$pre" \
     -c "SELECT 'sesión: idle_in_transaction_session_timeout=' || current_setting('idle_in_transaction_session_timeout')
                || ', lock_timeout=' || current_setting('lock_timeout') || ', statement_timeout=' || current_setting('statement_timeout') AS ajustes" \
     -c "$sql" 2>&1 | tee "$salida" | tee -a "$LOG"
  rc=${PIPESTATUS[0]}
  set -e
  ULTIMA_SALIDA="$salida"
  return "$rc"
}

registrar() {  # $1 = versión; $2 = applied|reverted. Nunca mata el guion: quien llama comprueba el historial.
  # A16 (ronda 2): con pipefail, un «grep -v» que no deja pasar ninguna línea
  # devuelve 1 y set -e terminaba el guion en silencio con la versión ya
  # registrada. Ahora el código de la CLI se guarda aparte y el filtro no cuenta.
  local salida rc=0
  salida="$(cd "$REPO" && "${CLI[@]}" migration repair --status "$2" "$1" --db-url "$URL" 2>&1)" || rc=$?
  { printf '%s\n' "$salida" | grep -v -e 'new version of Supabase CLI' -e 'We recommend updating' || true; } | tee -a "$LOG"
  (( rc == 0 )) || echo "AVISO: migration repair salió con $rc (arriba lo que dijo); compruebo el historial." | tee -a "$LOG"
  return 0
}

# Tras un fallo de la IDA: pregunta al catálogo y dice qué quedó (A2).
tras_fallo_ida() {  # $1 = nombre; $2 = versión
  repetir_error
  local a; a="$(aplicada "$2")"
  case "$a" in
    no)  die "$1 FALLÓ (ver arriba). El catálogo dice que NO quedó aplicada (no existe $(testigo_nombre "$2")) y NO se registró. Plan §8 (tabla de abortos)." ;;
    si)  die "$1 FALLÓ (ver arriba) DESPUÉS de su COMMIT: el catálogo dice que SÍ quedó aplicada ($(testigo_nombre "$2") existe), pero NO se registró. No sigas; plan §8, «aplicada sin registrar»." ;;
    *)   die "$1 FALLÓ (ver arriba) y NO SÉ si quedó aplicada: no pude preguntar al catálogo, o otra sesión tuya sigue con una transacción abierta. Comprueba a mano si existe $(testigo_nombre "$2") (plan §8, «no lo sé») antes de nada. NO se registró." ;;
  esac
}

aplicar_una() {  # $1 = nombre sin .sql
  local v="${1%%_*}" f="migrations/$1.sql" t0 t1 hist a
  echo; echo "════ $1"
  hist="$(registradas)" || exit 1
  if en_historial "$v" "$hist"; then
    a="$(aplicada "$v")"
    [[ "$a" == si ]] && { echo "ya está en el historial y aplicada ($(testigo_nombre "$v") existe): se salta."; return 0; }
    [[ "$a" == no ]] && die "$1 está en el historial pero NO aplicada ($(testigo_nombre "$v") no existe): registrada SIN aplicar, el historial miente. No sigo. Plan §8, «registrada sin aplicar»."
    die "no sé si $1 está aplicada (está en el historial): no pude preguntar al catálogo, o otra sesión de $USUARIO tiene una transacción abierta. No se corrió nada. Plan §8, «no lo sé»."
  fi
  a="$(aplicada "$v")"
  [[ "$a" == si ]] && die "$1 no está en el historial pero YA está aplicada ($(testigo_nombre "$v") existe): aplicada sin registrar. No la vuelvo a correr. Plan §8, «aplicada sin registrar»."
  [[ "$a" == no ]] || die "no sé si $1 está aplicada: no pude preguntar al catálogo, o otra sesión de $USUARIO tiene una transacción abierta (G.14/G.15). No se corrió nada. Espera y repite; plan §8, «no lo sé»."
  huella_ok "supabase/$f" || die "la huella de supabase/$f no es la de huellas.sha256 (¿cambió el archivo?)."
  leer "Para aplicarla escribe su versión ($v); cualquier otra cosa para parar: "
  [[ "$RESP" == "$v" ]] || die "parado antes de $1, a petición. Nada a medias."
  t0=$(date +%s.%N)
  correr_sql "$f" || tras_fallo_ida "$1" "$v"
  t1=$(date +%s.%N)
  echo "duración: $(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f s", b-a}') (arranque del contenedor incluido)" | tee -a "$LOG"
  if grep -Eq '\|[[:space:]]*REVISAR[[:space:]]*$' "$ULTIMA_SALIDA"; then
    grep -E '\|[[:space:]]*REVISAR[[:space:]]*$' "$ULTIMA_SALIDA" >&2 || true
    die "la rejilla de $1 tiene filas REVISAR (arriba). Quedó APLICADA (COMMIT hecho) pero NO registrada. No sigas; plan §8."
  fi
  grep -Eq '\|[[:space:]]*OK[[:space:]]*$' "$ULTIMA_SALIDA" || die "no veo la rejilla de $1 con filas OK. Quedó APLICADA (psql salió bien) pero NO se registra; revísalo (plan §8)."
  registrar "$v" applied
  hist="$(registradas)" || exit 1
  en_historial "$v" "$hist" || die "$1 se aplicó pero no quedó en el historial. Repite sólo: migration repair --status applied $v (plan §8)."
  echo "✓ $1 aplicada y registrada."
}

aplicar() {
  estado || true
  (( HUMO_OK == 1 )) || die "la prueba de humo de petición grande NO pasó (arriba): no ofrezco ninguna migración (G3). Plan §2."
  (( INCOHERENTES == 0 )) || die "historial y catálogo no cuadran en alguna de las 12 (arriba, «ALTO …»). No ofrezco ninguna migración hasta que cuadren. Plan §8."
  if (( FALTA_MAIN )); then
    leer "Faltan versiones de main en el historial (plan §1). Escribe SEGUIR si ya lo decidiste: "; [[ "$RESP" == SEGUIR ]] || die "parado."
  fi
  local m; for m in "${MIGRACIONES[@]}"; do aplicar_una "$m"; done
  # Antes de decir «las 12»: que de verdad estén las 12 en el historial Y en el catálogo (G1).
  local hist; hist="$(registradas)" || exit 1
  echo; echo "── comprobación final: las 12, historial frente a catálogo"
  coherencia "$hist"
  (( INCOHERENTES == 0 && PENDIENTES == 0 )) || die "al terminar, historial y catálogo NO cuadran (arriba). No están las 12. Plan §8."
  echo; echo "Las 12 aplicadas y registradas (historial y catálogo coinciden). Sigue con COMPROBACION-POSTERIOR.md."
}

# Tras un fallo de una REVERSA: pregunta al catálogo (A2).
tras_fallo_reversa() {  # $1 = nombre; $2 = versión
  repetir_error
  local a; a="$(aplicada "$2")"
  case "$a" in
    si)  die "la reversa de $1 FALLÓ (ver arriba). El catálogo dice que la migración SIGUE aplicada ($(testigo_nombre "$2") existe): la reversa no hizo nada. Plan §10.1." ;;
    no)  die "la reversa de $1 FALLÓ (ver arriba) DESPUÉS de su COMMIT: el catálogo dice que la migración YA NO está ($(testigo_nombre "$2") no existe), pero $2 SIGUE en el historial. Repite sólo: migration repair --status reverted $2 (plan §10)." ;;
    *)   die "la reversa de $1 FALLÓ (ver arriba) y NO SÉ si se hizo: comprueba a mano si existe $(testigo_nombre "$2") (plan §10, «no lo sé»). El historial no se tocó." ;;
  esac
}

revertir_una() {  # $1 = nombre de la migración sin .sql; $2 = «con-datos» si ya se confirmó la pérdida por adelantado
  local v="${1%%_*}" f="reversas/$1_reversa.sql" hist
  echo; echo "════ reversa de $1"
  hist="$(registradas)" || exit 1
  if ! en_historial "$v" "$hist"; then echo "no está en el historial: se salta."; return 0; fi
  huella_ok "supabase/$f" || die "la huella de supabase/$f no es la de huellas.sha256."
  leer "Para DESHACERLA escribe REVERTIR $v; cualquier otra cosa para parar: "
  [[ "$RESP" == "REVERTIR $v" ]] || die "parado antes de la reversa de $1."
  if ! correr_sql "$f" "${2:-}" reversa; then
    if grep -q 'REVERSA PARADA POR aplicar.sh' "$ULTIMA_SALIDA"; then
      repetir_error
      die "la reversa de $1 NO se hizo: la v2 está ENCENDIDA en alguna clínica (arriba, cuáles). Apágala en TODAS y repite «reversa». No tocó nada (G2)."
    fi
    if [[ -z "${2:-}" ]] && grep -q 'REVERSA.*ABORTADA.*reversa_con_datos' "$ULTIMA_SALIDA"; then
      repetir_error
      die "la reversa de $1 se NEGÓ por datos que la comprobación previa no vio (¿se escribieron después?). No tocó nada. Repite «reversa» desde el principio: volverá a preguntar."
    fi
    tras_fallo_reversa "$1" "$v"
  fi
  # G8 (ronda 2 del guion): la rejilla de una reversa se mira como la de la ida.
  if grep -Eq '\|[[:space:]]*REVISAR[[:space:]]*$' "$ULTIMA_SALIDA"; then
    grep -E '\|[[:space:]]*REVISAR[[:space:]]*$' "$ULTIMA_SALIDA" >&2 || true
    die "la rejilla de la reversa de $1 tiene filas REVISAR (arriba). La reversa quedó HECHA (COMMIT) pero $v SIGUE en el historial. No sigas; plan §10."
  fi
  registrar "$v" reverted
  hist="$(registradas)" || exit 1
  en_historial "$v" "$hist" && die "la reversa de $1 se hizo pero $v sigue en el historial. Repite sólo: migration repair --status reverted $v."
  echo "✓ reversa de $1 hecha y su versión quitada del historial."
}

# Antes de deshacer la primera: ¿se negará alguna de la cadena? (A5)
reversa_previa() {  # imprime CON_DATOS=si|no en la última línea si se puede seguir; si no, se detiene
  local hist filas f v bloquea=() datos=()
  hist="$(registradas)" || exit 1
  huella_ok "supabase/produccion/plan/reversa-previa.sql" || die "la huella de reversa-previa.sql no es la de huellas.sha256 (G10). No se tocó nada."
  filas="$(q "$(<"$DIR/reversa-previa.sql")")" || die "no pude correr la comprobación previa de las reversas (reversa-previa.sql). No se tocó nada."
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    v="${f%%|*}"
    [[ "$v" == previo ]] || en_historial "$v" "$hist" || continue   # esa reversa no va a correr
    case "$f" in
      *'|BLOQUEA|'*) bloquea+=("$v: ${f#*|BLOQUEA|}") ;;
      *'|DATOS|'*)   datos+=("$v: ${f#*|DATOS|}") ;;
    esac
  done <<<"$filas"
  if (( ${#bloquea[@]} )); then
    printf '  · %s\n' "${bloquea[@]}"
    die "la cadena de reversas NO empieza por lo de arriba. No se tocó nada (plan §10)."
  fi
  if (( ${#datos[@]} )); then
    echo "Estas reversas se negarían porque PERDERÍAN datos (todo, por adelantado):"
    printf '  · %s\n' "${datos[@]}"
    leer "¿Respaldados ya? Para hacer la cadena entera PERDIENDO esos datos escribe PERDER DATOS; cualquier otra cosa para parar sin tocar nada: "
    [[ "$RESP" == "PERDER DATOS" ]] || die "parado antes de la primera reversa: no se tocó nada."
    CON_DATOS=con-datos
  else
    echo "Comprobación previa: ninguna reversa de la cadena se va a negar."
    CON_DATOS=""
  fi
}

# Antes de la primera reversa: historial y catálogo cuadran para las 12 (A5,
# ronda 2 del guion). Las guardas de ORDEN de las reversas (F5a: «funciones que
# nombran agenda_bloqueos»; F3: «sigue F2»; F2: «quedan disparadores de F4»; F1:
# «quedan objetos de bloques posteriores»; las de TRUNCATE: la nº 2 antes que la
# nº 1 y T antes que la nº 2) no están en reversa-previa.sql a propósito: con el
# historial coherente, el orden fijo de la cadena (M3, M2, M1, T, F5b, F4, F2, F3, F5a, F1;
# luego 20261126, 20261125) las cumple siempre. Lo que las rompería es una
# versión aplicada sin registrar o registrada sin aplicar, y eso se para aquí.
exigir_coherencia() {
  local hist; hist="$(registradas)" || exit 1
  coherencia "$hist"
  (( INCOHERENTES == 0 )) || die "historial y catálogo NO cuadran (arriba): con eso el orden de la cadena no garantiza sus guardas. No se tocó nada. Plan §8."
}

reversa() {
  estado || true
  echo; echo "── historial frente a catálogo antes de la cadena"
  exigir_coherencia
  echo; echo "── comprobación previa de toda la cadena (sólo lee)"
  reversa_previa
  local m; for m in "${REVERSAS[@]}"; do revertir_una "$m" "$CON_DATOS"; done
  echo; echo "Reversa de la agenda completa. Las dos de TRUNCATE NO se deshicieron (reversa-truncate; plan §10.2)."
}

reversa_truncate() {
  local hist yo
  estado || true
  exigir_coherencia
  # Las dos de TRUNCATE no pasan por reversa-previa.sql: no se niegan por datos;
  # sus guardas son de orden (arriba) y de dueño: se exige postgres aquí.
  yo="$(q "select current_user")" || die "no puedo preguntar quién soy."
  [[ "$yo" == postgres ]] || die "hay que correr las reversas de TRUNCATE como postgres (current_user es $yo). No se tocó nada."
  hist="$(registradas)" || exit 1
  en_historial 20261201180000 "$hist" \
    && die "T (20261201180000) sigue aplicada y usa prohibir_truncate(): deshaz antes la agenda (aplicar.sh reversa). No se tocó nada."
  echo "OJO: deshacer estas dos REABRE el TRUNCATE de los tres roles sobre audit_log y las tablas de public (plan §10.2)."
  local m; for m in "${REVERSAS_TRUNCATE[@]}"; do revertir_una "$m"; done   # con la guarda de la v2 de correr_sql
  echo; echo "Las dos de TRUNCATE deshechas."
}

respaldo() {
  local out="$DESTINO/respaldo-$FECHA.dump.gpg" tmp frase rc=0
  tmp="$out.parcial"
  command -v gpg >/dev/null || die "falta gpg."
  # Se escribe a un nombre temporal y sólo se renombra si pg_dump Y gpg salieron bien (A8).
  trap 'rm -f "$tmp"' EXIT
  echo "Volcado lógico COMPLETO (estructura + DATOS DE PACIENTES), cifrado con gpg AES256 al vuelo:"
  echo "  $out   (el volcado en claro nunca toca el disco)"
  if [[ -t 0 ]]; then
    export GPG_TTY; GPG_TTY="$(tty)"
    pg pg_dump -Fc --no-password --lock-wait-timeout=30s ${RESPALDO_EXTRA:-} \
      | gpg --symmetric --cipher-algo AES256 -o "$tmp" || rc=$?
  else
    leer "Frase del cifrado: " s; frase="$RESP"; RESP=""
    pg pg_dump -Fc --no-password --lock-wait-timeout=30s ${RESPALDO_EXTRA:-} \
      | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 -o "$tmp" 3<<<"$frase" || rc=$?
  fi
  if (( rc != 0 )); then
    rm -f "$tmp"
    die "pg_dump o gpg fallaron (código $rc; el error, arriba): NO hay respaldo. Se borró el archivo a medias; no queda ningún $(basename "$out"). Repite."
  fi
  mv "$tmp" "$out"; trap - EXIT
  chmod 600 "$out"; ( cd "$DESTINO" && sha256sum "$(basename "$out")" > "$(basename "$out").sha256" )
  echo "Hecho: $(du -h "$out" | cut -f1). Compruébalo (pide la frase; no escribe nada en claro):"
  echo "  gpg -d $out | docker run --rm -i $IMAGEN pg_restore -l | grep -c 'TABLE DATA'"
}

preparar
case "$MODO" in
  estado)           estado | tee -a "$LOG" ;;
  respaldo)         respaldo 2>&1 | tee -a "$LOG" ;;
  aplicar)          aplicar ;;
  reversa)          reversa ;;
  reversa-truncate) reversa_truncate ;;
esac
unset PGPASSWORD
