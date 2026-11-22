#!/usr/bin/env bash
# scripts/produccion/foto-produccion.sh
#
# Descarga SÓLO LA ESTRUCTURA de la base de producción (ningún dato de tablas)
# a ~/spinus-produccion-foto/. Lo corre Angel en su terminal, desde la raíz del
# repo, con Docker encendido:
#
#   bash scripts/produccion/foto-produccion.sh
#
# La contraseña se pide con `read -rs` (no se ve, no va a la línea de comandos
# ni al historial de zsh) y vive sólo en el entorno de este proceso y de los
# contenedores efímeros que lanza (`docker run -e PGPASSWORD`, sin valor en la
# línea). Nunca se escribe en disco.
#
# Todo lo que hace es de lectura: pg_dump --schema-only, pg_dumpall --roles-only
# (vía la CLI de Supabase) y SELECT sobre catálogos y dos tablas de metadatos
# (supabase_migrations.schema_migrations y storage.buckets), en transacciones
# de sólo lectura.
#
# Variables para ensayarlo contra otra base (por omisión, producción):
#   FOTO_HOST FOTO_PUERTO FOTO_USUARIO FOTO_BASE FOTO_SSL (require|disable)
#   FOTO_RED (red de docker, p. ej. host)  FOTO_DESTINO (carpeta)
set -euo pipefail

HOST="${FOTO_HOST:-aws-0-us-west-2.pooler.supabase.com}"
PUERTO="${FOTO_PUERTO:-5432}"
USUARIO="${FOTO_USUARIO:-postgres.qpnegmmpneseirfyplbf}"
BASE="${FOTO_BASE:-postgres}"
SSL="${FOTO_SSL:-require}"
DESTINO="${FOTO_DESTINO:-$HOME/spinus-produccion-foto}"
CLI=(npx --yes supabase@2.117.0)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$DIR/../.." && pwd)"

docker info >/dev/null 2>&1 || { echo "error: Docker no responde; enciéndelo primero." >&2; exit 2; }
IMAGEN="${IMAGEN_PG:-$(docker inspect --format '{{.Config.Image}}' supabase_db_app_ortointegra 2>/dev/null || echo public.ecr.aws/supabase/postgres:17.6.1.167)}"

if [[ -e "$DESTINO" && -n "$(ls -A "$DESTINO" 2>/dev/null)" ]]; then
  echo "error: $DESTINO ya tiene archivos. Muévelo o bórralo antes (no se sobrescribe una foto)." >&2
  exit 2
fi
umask 077
mkdir -p "$DESTINO"; chmod 700 "$DESTINO"

if [[ -t 0 ]]; then
  read -rsp "Contraseña de la base ($USUARIO@$HOST): " PGPASSWORD; echo
else
  read -r PGPASSWORD   # sólo para ensayos automáticos (se pasa por stdin, nunca por argumento)
fi
[[ -n "$PGPASSWORD" ]] || { echo "error: contraseña vacía" >&2; exit 2; }
export PGPASSWORD PGHOST="$HOST" PGPORT="$PUERTO" PGUSER="$USUARIO" PGDATABASE="$BASE" PGSSLMODE="$SSL"
# La URL NO lleva la contraseña: la CLI la toma de PGPASSWORD (comprobado con --dry-run en local).
URL="postgresql://${USUARIO}@${HOST}:${PUERTO}/${BASE}?sslmode=${SSL}"

pg() {  # $1 = programa (psql, pg_dump); resto = argumentos. Contenedor efímero de la imagen local.
  docker run --rm -i ${FOTO_RED:+--network "$FOTO_RED"} \
    -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE "$IMAGEN" "$@"
}
fallos=()
paso() { echo "→ $1"; }

paso "00-version.txt"
pg psql -X -At -v ON_ERROR_STOP=1 -c "select version()" -c "show server_version" > "$DESTINO/00-version.txt" \
  || { echo "error: no se pudo conectar; revisa contraseña y red." >&2; exit 1; }

cd "$REPO"   # la CLI lee supabase/config.toml (major_version) para elegir la imagen de pg_dump
paso "01-roles.sql (CLI --role-only)"
"${CLI[@]}" db dump --db-url "$URL" --role-only -f "$DESTINO/01-roles.sql" || fallos+=("01-roles.sql")
paso "02-esquema.sql (CLI, esquemas de la app: excluye auth, storage, realtime, extensions, vault…)"
"${CLI[@]}" db dump --db-url "$URL" -f "$DESTINO/02-esquema.sql" || fallos+=("02-esquema.sql")

paso "03-esquema-completo.sql (pg_dump --schema-only de TODOS los esquemas, con permisos)"
# --lock-wait-timeout: si producción tiene un bloqueo largo, pg_dump se rinde en vez de esperar.
# FOTO_PGDUMP_EXTRA: argumentos extra (p. ej. "--exclude-schema=vault") si algún esquema da «permission denied».
# shellcheck disable=SC2086
pg pg_dump --schema-only --quote-all-identifiers --no-password --lock-wait-timeout=30s \
  ${FOTO_PGDUMP_EXTRA:-} > "$DESTINO/03-esquema-completo.sql" \
  || fallos+=("03-esquema-completo.sql")

paso "04-migraciones.tsv (historial: sólo versión y nombre)"
pg psql -X -q -At -F $'\t' -v ON_ERROR_STOP=1 > "$DESTINO/04-migraciones.tsv" <<'SQL' || fallos+=("04-migraciones.tsv")
begin transaction read only;
select 'version' || chr(9) || 'name';
select case
  when to_regclass('supabase_migrations.schema_migrations') is null
    then 'select ''# NO EXISTE supabase_migrations.schema_migrations'''
  when not exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
                   and table_name = 'schema_migrations' and column_name = 'name')
    then 'select version || chr(9) from supabase_migrations.schema_migrations order by version'
  else 'select version || chr(9) || coalesce(name, '''') from supabase_migrations.schema_migrations order by version'
end \gexec
commit;
SQL

paso "05-catalogo.jsonl (foto de catálogos para comparar-estructura.sh)"
pg psql -X -q -At -v ON_ERROR_STOP=1 -f - < "$DIR/catalogo.sql" > "$DESTINO/05-catalogo.jsonl" \
  || fallos+=("05-catalogo.jsonl")

paso "06-buckets.tsv (configuración de Storage: id, nombre, público, límites; sin objetos)"
pg psql -X -q -At -F $'\t' -v ON_ERROR_STOP=1 > "$DESTINO/06-buckets.tsv" <<'SQL' || fallos+=("06-buckets.tsv")
begin transaction read only;
select 'id' || chr(9) || 'name' || chr(9) || 'public' || chr(9) || 'file_size_limit' || chr(9) || 'allowed_mime_types';
select id, name, public, coalesce(file_size_limit::text, ''), coalesce(array_to_string(allowed_mime_types, ','), '')
from storage.buckets order by id;
commit;
SQL

unset PGPASSWORD
( cd "$DESTINO" && sha256sum 0*.* > 99-sha256.txt )
chmod 600 "$DESTINO"/*

paso "Comprobación: ningún dato en la foto"
"$DIR/sin-datos.sh" "$DESTINO"/0*.sql "$DESTINO/04-migraciones.tsv" || fallos+=("sin-datos")

echo
ls -l "$DESTINO"
if [[ ${#fallos[@]} -gt 0 ]]; then
  echo "FALLARON: ${fallos[*]} — manda la salida de arriba (no tiene la contraseña)." >&2
  exit 1
fi
echo "Foto completa en $DESTINO"
