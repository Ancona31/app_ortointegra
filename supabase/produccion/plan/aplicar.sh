#!/usr/bin/env bash
# supabase/produccion/plan/aplicar.sh
#
# Aplica las 8 migraciones nuevas del conjunto «agenda v2 lista para
# producción» UNA A UNA, con psql y confirmación escrita antes de cada una, y
# registra cada versión en supabase_migrations.schema_migrations con
# `supabase migration repair --status applied` (CLI 2.117.0). Lo corre Angel,
# desde la raíz del repo, con Docker encendido. Ver PLAN-DE-APLICACION.md.
#
#   bash supabase/produccion/plan/aplicar.sh estado     # sólo lee: versión, historial, qué falta
#   bash supabase/produccion/plan/aplicar.sh respaldo   # volcado lógico CIFRADO (estructura + datos)
#   bash supabase/produccion/plan/aplicar.sh aplicar    # las 8, una a una
#   bash supabase/produccion/plan/aplicar.sh reversa    # las 6 reversas de la agenda, en orden inverso
#
# La contraseña se pide con `read -rs`: no va a la línea de comandos ni al
# historial de zsh, ni se escribe en disco. Vive en el entorno de este proceso
# y de los contenedores efímeros (`docker run -e PGPASSWORD`, sin valor en la
# línea). La URL que recibe la CLI va SIN contraseña: la toma de PGPASSWORD.
# Nunca usa `supabase link` ni `--linked`, y nunca `db push`.
#
# Ensayo contra una base local (lo que se probó; ver el plan):
#   APL_HOST=127.0.0.1 APL_PUERTO=54415 APL_USUARIO=postgres APL_SSL=disable \
#   APL_RED=host APL_DESTINO=/ruta/ensayo bash supabase/produccion/plan/aplicar.sh aplicar
# Sin terminal (ensayos automáticos) lee de stdin, una por línea: la contraseña,
# [la frase del cifrado, sólo en «respaldo»] y cada confirmación.
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

# El orden es el de nombre de archivo, y es obligatorio (ver el plan, §4).
MIGRACIONES=(
  20261125170000_audit_log_sin_truncate
  20261126120000_public_sin_truncate
  20261201120000_agenda_f1_ajustes_tipos_horarios
  20261201130000_agenda_f5a_bloqueos
  20261201140000_agenda_f3_reserva_enlace
  20261201150000_agenda_f2_google
  20261201160000_agenda_f4_confirmacion_correos_avisos
  20261201170000_agenda_f5b_protecciones_cita
)
# Orden inverso de bloques (F5b, F4, F2, F3, F5a, F1). Las dos de TRUNCATE no entran.
REVERSAS=(
  20261201170000_agenda_f5b_protecciones_cita
  20261201160000_agenda_f4_confirmacion_correos_avisos
  20261201150000_agenda_f2_google
  20261201140000_agenda_f3_reserva_enlace
  20261201130000_agenda_f5a_bloqueos
  20261201120000_agenda_f1_ajustes_tipos_horarios
)
MAIN=(20260912190416 20260913 20260914 20260919 20260919230000)

die() { echo "ALTO: $*" >&2; exit 1; }
[[ "$MODO" =~ ^(estado|respaldo|aplicar|reversa)$ ]] || { sed -n '2,24p' "$0"; exit 2; }
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
  if [[ "$HOST" == "aws-0-us-west-2.pooler.supabase.com" ]]; then
    echo "Destino: PRODUCCIÓN ($USUARIO@$HOST:$PUERTO/$BASE)."
    leer "Escribe PRODUCCION para seguir: "; [[ "$RESP" == PRODUCCION ]] || die "no confirmado."
  else
    echo "Destino: ENSAYO ($USUARIO@$HOST:$PUERTO/$BASE)."
  fi
  umask 077
  mkdir -p "$DESTINO"; chmod 700 "$DESTINO"
  LOG="$DESTINO/$MODO-$FECHA.log"
  leer "Contraseña de la base ($USUARIO@$HOST): " s; PGPASSWORD="$RESP"
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

registradas() {  # versiones del historial, una por línea (vacío si la tabla no existe)
  q "select case when to_regclass('supabase_migrations.schema_migrations') is null then ''
       else (select string_agg(version, E'\n' order by version) from supabase_migrations.schema_migrations) end"
}

estado() {
  echo "── servidor"; q "select version()"
  echo "── tamaños (sólo cuentas; ningún dato): citas, consultorios, clínicas, audit_log"
  q "select (select count(*) from public.appointments), (select count(*) from public.consultorios),
            (select count(*) from public.clinicas), (select count(*) from public.audit_log)"
  local hist; hist="$(registradas)"
  echo "── historial (supabase_migrations.schema_migrations)"
  [[ -n "$hist" ]] && echo "$hist" || echo "(vacío o NO EXISTE la tabla: ver el plan, §1.4, antes de seguir)"
  local v falta=0
  for v in "${MAIN[@]}"; do grep -qx "$v" <<<"$hist" || { echo "FALTA de main: $v"; falta=1; }; done
  for v in "${MIGRACIONES[@]}"; do
    grep -qx "${v%%_*}" <<<"$hist" && echo "ya registrada: $v" || echo "pendiente:     $v"
  done
  return $falta
}

huella_ok() {  # $1 = ruta relativa al repo; compara con huellas.sha256 del plan
  local esperada actual
  esperada="$(awk -v f="$1" '$2 == f {print $1}' "$DIR/huellas.sha256")"
  actual="$(cd "$REPO" && sha256sum "$1" | cut -d' ' -f1)"
  [[ -n "$esperada" && "$esperada" == "$actual" ]]
}

correr_sql() {  # $1 = ruta relativa a supabase/. Devuelve el código de psql; la salida va a pantalla y al registro.
  local salida rc
  salida="$DESTINO/$(basename "$1" .sql).salida.txt"
  set +e
  pg psql -X -v ON_ERROR_STOP=1 -P pager=off -f "/s/$1" 2>&1 | tee "$salida" | tee -a "$LOG"
  rc=${PIPESTATUS[0]}
  set -e
  ULTIMA_SALIDA="$salida"
  return "$rc"
}

registrar() {  # $1 = versión; $2 = applied|reverted
  ( cd "$REPO" && "${CLI[@]}" migration repair --status "$2" "$1" --db-url "$URL" ) 2>&1 \
    | grep -v -e 'new version of Supabase CLI' -e 'We recommend updating' | tee -a "$LOG"
}

aplicar_una() {  # $1 = nombre sin .sql
  local v="${1%%_*}" f="migrations/$1.sql" t0 t1
  echo; echo "════ $1"
  if grep -qx "$v" <<<"$(registradas)"; then echo "ya está en el historial: se salta."; return 0; fi
  huella_ok "supabase/$f" || die "la huella de supabase/$f no es la de huellas.sha256 (¿cambió el archivo?)."
  leer "Para aplicarla escribe su versión ($v); cualquier otra cosa para parar: "
  [[ "$RESP" == "$v" ]] || die "parado antes de $1, a petición. Nada a medias."
  t0=$(date +%s.%N)
  correr_sql "$f" || die "$1 FALLÓ (ver arriba). Va en una transacción: no quedó nada de ella y NO se registró. Plan §7."
  t1=$(date +%s.%N)
  echo "duración: $(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f s", b-a}')" | tee -a "$LOG"
  if grep -Eq '\|[[:space:]]*REVISAR[[:space:]]*$' "$ULTIMA_SALIDA"; then
    die "la rejilla de $1 tiene filas REVISAR. Quedó APLICADA (COMMIT hecho) pero NO registrada. No sigas; plan §7."
  fi
  grep -Eq '\|[[:space:]]*OK[[:space:]]*$' "$ULTIMA_SALIDA" || die "no veo la rejilla de $1 con filas OK. No se registra; revísalo."
  registrar "$v" applied
  grep -qx "$v" <<<"$(registradas)" || die "$1 se aplicó pero no quedó en el historial. Repite sólo: migration repair --status applied $v (plan §1.3)."
  echo "✓ $1 aplicada y registrada."
}

aplicar() {
  estado || { leer "Faltan versiones de main en el historial (plan §1.4). Escribe SEGUIR si ya lo decidiste: "; [[ "$RESP" == SEGUIR ]] || die "parado."; }
  local m; for m in "${MIGRACIONES[@]}"; do aplicar_una "$m"; done
  echo; echo "Las 8 aplicadas y registradas. Sigue con COMPROBACION-POSTERIOR.md."
}

revertir_una() {  # $1 = nombre de la migración sin .sql
  local v="${1%%_*}" f="reversas/$1_reversa.sql"
  echo; echo "════ reversa de $1"
  if ! grep -qx "$v" <<<"$(registradas)"; then echo "no está en el historial: se salta."; return 0; fi
  huella_ok "supabase/$f" || die "la huella de supabase/$f no es la de huellas.sha256."
  leer "Para DESHACERLA escribe REVERTIR $v; cualquier otra cosa para parar: "
  [[ "$RESP" == "REVERTIR $v" ]] || die "parado antes de la reversa de $1."
  correr_sql "$f" || die "la reversa de $1 FALLÓ (va en una transacción: no tocó nada). Plan §7.3."
  registrar "$v" reverted
  echo "✓ reversa de $1 hecha y su versión quitada del historial."
}

reversa() {
  estado || true
  local m; for m in "${REVERSAS[@]}"; do revertir_una "$m"; done
  echo; echo "Reversa de la agenda completa. Las dos de TRUNCATE NO se deshicieron (plan §7.4)."
}

respaldo() {
  local out="$DESTINO/respaldo-$FECHA.dump.gpg" frase
  command -v gpg >/dev/null || die "falta gpg."
  echo "Volcado lógico COMPLETO (estructura + DATOS DE PACIENTES), cifrado con gpg AES256 al vuelo:"
  echo "  $out   (el volcado en claro nunca toca el disco)"
  if [[ -t 0 ]]; then
    export GPG_TTY; GPG_TTY="$(tty)"
    pg pg_dump -Fc --no-password --lock-wait-timeout=30s ${RESPALDO_EXTRA:-} \
      | gpg --symmetric --cipher-algo AES256 -o "$out"
  else
    leer "Frase del cifrado: " s; frase="$RESP"
    pg pg_dump -Fc --no-password --lock-wait-timeout=30s ${RESPALDO_EXTRA:-} \
      | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 -o "$out" 3<<<"$frase"
  fi
  [[ ${PIPESTATUS[0]} -eq 0 ]] || die "pg_dump falló: el respaldo NO vale. Bórralo (shred -u $out) y repite."
  chmod 600 "$out"; ( cd "$DESTINO" && sha256sum "$(basename "$out")" > "$(basename "$out").sha256" )
  echo "Hecho: $(du -h "$out" | cut -f1). Compruébalo (pide la frase; no escribe nada en claro):"
  echo "  gpg -d $out | docker run --rm -i $IMAGEN pg_restore -l | grep -c 'TABLE DATA'"
}

preparar
case "$MODO" in
  estado)   estado | tee -a "$LOG" ;;
  respaldo) respaldo 2>&1 | tee -a "$LOG" ;;
  aplicar)  aplicar ;;
  reversa)  reversa ;;
esac
unset PGPASSWORD
