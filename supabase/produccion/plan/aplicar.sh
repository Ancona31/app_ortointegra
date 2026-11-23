#!/usr/bin/env bash
# supabase/produccion/plan/aplicar.sh
#
# Aplica las 9 migraciones nuevas («agenda v2 lista para producción») UNA A
# UNA, con psql y confirmación escrita antes de cada una, y registra cada
# versión en supabase_migrations.schema_migrations con
# `supabase migration repair --status applied` (CLI 2.117.0). Lo corre Angel,
# desde la raíz del repo, con Docker encendido. Ver PLAN-DE-APLICACION.md.
#
#   bash supabase/produccion/plan/aplicar.sh estado            # sólo lee: versión, ida y vuelta, cuentas, historial, qué falta
#   bash supabase/produccion/plan/aplicar.sh respaldo          # volcado lógico CIFRADO (estructura + datos)
#   bash supabase/produccion/plan/aplicar.sh aplicar           # las 9, una a una
#   bash supabase/produccion/plan/aplicar.sh reversa           # las 7 reversas de la agenda (T, F5b … F1), en orden inverso
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
# el entorno de este proceso y de los contenedores efímeros (`docker run -e
# PGPASSWORD`, sin valor en la línea). La URL que recibe la CLI va SIN
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
)
# Orden inverso: T, F5b, F4, F2, F3, F5a, F1. Las dos de TRUNCATE van aparte (reversa-truncate).
REVERSAS=(
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

die() { echo "ALTO: $*" >&2; exit 1; }
[[ "$MODO" =~ ^(estado|respaldo|aplicar|reversa|reversa-truncate)$ ]] || { sed -n '2,50p' "$0"; exit 2; }
[[ -f "$REPO/supabase/config.toml" && -d "$REPO/supabase/migrations" ]] || die "córrelo desde el repo (no encuentro supabase/)."
docker info >/dev/null 2>&1 || die "Docker no responde; enciéndelo primero."
IMAGEN="${IMAGEN_PG:-$(docker inspect --format '{{.Config.Image}}' supabase_db_app_ortointegra 2>/dev/null || echo public.ecr.aws/supabase/postgres:17.6.1.167)}"

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
      echo "Destino: ENSAYO ($USUARIO@$HOST:$PUERTO/$BASE)." ;;
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
  # Sin -i a propósito: el contenedor no lee la entrada (las confirmaciones son de este script).
  docker run --rm ${APL_RED:+--network "$APL_RED"} -v "$REPO/supabase:/s:ro" \
    -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE "$IMAGEN" "$@"
}
q() { pg psql -X -q -At -v ON_ERROR_STOP=1 -c "$1"; }  # una consulta, salida cruda

registradas() {  # versiones del historial, una por línea (vacío si la tabla no existe). Si no puede leer, DETIENE.
  q "select case when to_regclass('supabase_migrations.schema_migrations') is null then ''
       else (select string_agg(version, E'\n' order by version) from supabase_migrations.schema_migrations) end" \
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
  if pg psql -X -q -v ON_ERROR_STOP=1 -P pager=off -At -c "$SESION_SQL" -c "$sql" > "$salida" 2>&1; then
    t1=$(date +%s.%N)
    grep '^humo:' "$salida"
    echo "   aceptada; $(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f s", b-a}') de punta a punta (arranque del contenedor incluido). No se escribió nada."
  else
    cat "$salida"
    echo "   ⚠️ NO aceptada (arriba el error). No se escribió nada. No apliques hasta saber por qué: plan §2."
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
  [[ -n "$hist" ]] && echo "$hist" || echo "(vacío o NO EXISTE la tabla: ver el plan, §1, antes de seguir)"
  local v falta=0
  for v in "${MAIN[@]}"; do en_historial "$v" "$hist" || { echo "FALTA de main: $v"; falta=1; }; done
  for v in "${MIGRACIONES[@]}"; do
    en_historial "${v%%_*}" "$hist" && echo "ya registrada: $v" || echo "pendiente:     $v"
  done
  return $falta
}

huella_ok() {  # $1 = ruta relativa al repo; compara con huellas.sha256 del plan
  local esperada actual
  esperada="$(awk -v f="$1" '$2 == f {print $1}' "$DIR/huellas.sha256")"
  actual="$(cd "$REPO" && sha256sum "$1" | cut -d' ' -f1)"
  [[ -n "$esperada" && "$esperada" == "$actual" ]]
}

correr_sql() {  # $1 = ruta relativa a supabase/; $2 = «con-datos» para confirmar la pérdida en una reversa.
  local salida rc sql pre="$SESION_SQL" bytes
  salida="$DESTINO/$(basename "$1" .sql).salida.txt"
  bytes=$(wc -c < "$REPO/supabase/$1")
  (( bytes < MAX_BYTES )) || die "supabase/$1 tiene $bytes bytes: no cabe en una sola petición (-c, máximo $MAX_BYTES). No se aplicó nada; consultar."
  sql="$(<"$REPO/supabase/$1")"
  # Ajuste de SESIÓN (no del archivo): las reversas leen current_setting('spinus.reversa_con_datos').
  [[ "${2:-}" == con-datos ]] && pre="$pre; SET spinus.reversa_con_datos = 'si'"
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

registrar() {  # $1 = versión; $2 = applied|reverted
  ( cd "$REPO" && "${CLI[@]}" migration repair --status "$2" "$1" --db-url "$URL" ) 2>&1 \
    | grep -v -e 'new version of Supabase CLI' -e 'We recommend updating' | tee -a "$LOG"
}

# Tras un fallo de la IDA: pregunta al catálogo y dice qué quedó (A2).
tras_fallo_ida() {  # $1 = nombre; $2 = versión
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
  if en_historial "$v" "$hist"; then echo "ya está en el historial: se salta."; return 0; fi
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
    die "la rejilla de $1 tiene filas REVISAR. Quedó APLICADA (COMMIT hecho) pero NO registrada. No sigas; plan §8."
  fi
  grep -Eq '\|[[:space:]]*OK[[:space:]]*$' "$ULTIMA_SALIDA" || die "no veo la rejilla de $1 con filas OK. Quedó APLICADA (psql salió bien) pero NO se registra; revísalo (plan §8)."
  registrar "$v" applied
  hist="$(registradas)" || exit 1
  en_historial "$v" "$hist" || die "$1 se aplicó pero no quedó en el historial. Repite sólo: migration repair --status applied $v (plan §8)."
  echo "✓ $1 aplicada y registrada."
}

aplicar() {
  estado || { leer "Faltan versiones de main en el historial (plan §1). Escribe SEGUIR si ya lo decidiste: "; [[ "$RESP" == SEGUIR ]] || die "parado."; }
  local m; for m in "${MIGRACIONES[@]}"; do aplicar_una "$m"; done
  echo; echo "Las 9 aplicadas y registradas. Sigue con COMPROBACION-POSTERIOR.md."
}

# Tras un fallo de una REVERSA: pregunta al catálogo (A2).
tras_fallo_reversa() {  # $1 = nombre; $2 = versión
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
  if ! correr_sql "$f" "${2:-}"; then
    grep -q 'reversa_con_datos' "$ULTIMA_SALIDA" \
      && die "la reversa de $1 se NEGÓ por datos que la comprobación previa no vio (¿se escribieron después?). No tocó nada. Repite «reversa» desde el principio: volverá a preguntar."
    tras_fallo_reversa "$1" "$v"
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

reversa() {
  estado || true
  echo; echo "── comprobación previa de toda la cadena (sólo lee)"
  reversa_previa
  local m; for m in "${REVERSAS[@]}"; do revertir_una "$m" "$CON_DATOS"; done
  echo; echo "Reversa de la agenda completa. Las dos de TRUNCATE NO se deshicieron (reversa-truncate; plan §10.2)."
}

reversa_truncate() {
  local hist
  estado || true
  hist="$(registradas)" || exit 1
  en_historial 20261201180000 "$hist" \
    && die "T (20261201180000) sigue aplicada y usa prohibir_truncate(): deshaz antes la agenda (aplicar.sh reversa). No se tocó nada."
  echo "OJO: deshacer estas dos REABRE el TRUNCATE de los tres roles sobre audit_log y las tablas de public (plan §10.2)."
  local m; for m in "${REVERSAS_TRUNCATE[@]}"; do revertir_una "$m"; done
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
