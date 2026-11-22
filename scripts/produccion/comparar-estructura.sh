#!/usr/bin/env bash
# scripts/produccion/comparar-estructura.sh
#
# Compara la ESTRUCTURA completa de dos bases Postgres (o de una base y una foto
# ya extraída) leyendo los catálogos con catalogo.sql. Sólo lee.
#
#   scripts/produccion/comparar-estructura.sh [opciones] FUENTE_A FUENTE_B
#   scripts/produccion/comparar-estructura.sh --extraer FUENTE > foto.jsonl
#
# FUENTE es una de:
#   contenedor:NOMBRE[:BASE]   psql dentro de un contenedor (usuario postgres; BASE por omisión postgres)
#   url:CONNINFO               psql desde la imagen de Postgres (red del host); CONNINFO SIN contraseña,
#                              p. ej. 'host=127.0.0.1 port=54329 user=postgres dbname=postgres'.
#                              La contraseña se lee de PGPASSWORD o se pide con read -rs.
#   archivo:RUTA  o  RUTA.jsonl  una foto ya extraída (p. ej. 05-catalogo.jsonl de producción)
#
# Opciones (se pasan tal cual a comparar_estructura.py):
#   --esperadas ARCHIVO   diferencias esperadas: estado<TAB>tipo<TAB>clave<TAB>razón (glob en tipo y clave)
#   --tsv ARCHIVO --json ARCHIVO   salida para otro script
#   --esquemas RE --excluir-esquemas RE --tipos a,b --excluir-tipos a,b --etiquetas A,B --silencioso
#   --guardar DIR         guarda ahí las fotos extraídas (a.jsonl, b.jsonl)
#
# Salida: 0 = idénticas (o sólo diferencias esperadas); 1 = alguna inesperada; 2 = error.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CATALOGO="$DIR/catalogo.sql"
IMAGEN_PG="${IMAGEN_PG:-$(docker inspect --format '{{.Config.Image}}' supabase_db_app_ortointegra 2>/dev/null || echo public.ecr.aws/supabase/postgres:17.6.1.167)}"

extraer() {  # $1 = fuente; escribe JSONL en stdout
  local f="$1"
  case "$f" in
    contenedor:*)
      local resto="${f#contenedor:}" nombre base
      nombre="${resto%%:*}"; base="postgres"
      [[ "$resto" == *:* ]] && base="${resto#*:}"
      docker exec -i "$nombre" psql -X -q -At -U postgres -d "$base" -v ON_ERROR_STOP=1 -f - < "$CATALOGO"
      ;;
    url:*)
      if [[ -z "${PGPASSWORD:-}" ]]; then
        read -rsp "Contraseña para ${f#url:}: " PGPASSWORD </dev/tty; echo >&2
        export PGPASSWORD
      fi
      docker run --rm -i --network host -e PGPASSWORD "$IMAGEN_PG" \
        psql -X -q -At -v ON_ERROR_STOP=1 "${f#url:}" -f - < "$CATALOGO"
      ;;
    archivo:*) cat -- "${f#archivo:}" ;;
    *.jsonl)   cat -- "$f" ;;
    *) echo "error: fuente desconocida «$f» (contenedor:, url:, archivo: o .jsonl)" >&2; return 2 ;;
  esac
}

if [[ "${1:-}" == "--extraer" ]]; then
  [[ $# -eq 2 ]] || { echo "uso: $0 --extraer FUENTE > foto.jsonl" >&2; exit 2; }
  extraer "$2"; exit $?
fi

guardar=""; opciones=(); fuentes=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --guardar) guardar="$2"; shift 2 ;;
    --esperadas|--tsv|--json|--esquemas|--excluir-esquemas|--tipos|--excluir-tipos|--etiquetas)
      opciones+=("$1" "$2"); shift 2 ;;
    --silencioso) opciones+=("$1"); shift ;;
    -h|--help) sed -n '2,27p' "$0"; exit 0 ;;
    --*) echo "error: opción desconocida $1" >&2; exit 2 ;;
    *) fuentes+=("$1"); shift ;;
  esac
done
[[ ${#fuentes[@]} -eq 2 ]] || { echo "uso: $0 [opciones] FUENTE_A FUENTE_B  (ver --help)" >&2; exit 2; }

if [[ -n "$guardar" ]]; then mkdir -p "$guardar"; trabajo="$guardar"
else trabajo="$(mktemp -d)"; trap 'rm -rf "$trabajo"' EXIT; fi
( umask 077
  extraer "${fuentes[0]}" > "$trabajo/a.jsonl" || { echo "error: no se pudo extraer ${fuentes[0]}" >&2; exit 2; }
  extraer "${fuentes[1]}" > "$trabajo/b.jsonl" || { echo "error: no se pudo extraer ${fuentes[1]}" >&2; exit 2; } )

python3 -I "$DIR/comparar_estructura.py" "$trabajo/a.jsonl" "$trabajo/b.jsonl" "${opciones[@]}"
