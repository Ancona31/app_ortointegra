#!/usr/bin/env bash
# scripts/produccion/sin-datos.sh — comprueba que un volcado no trae DATOS.
#
#   scripts/produccion/sin-datos.sh [--historial NOMBRE] ARCHIVO.sql [ARCHIVO…]
#
# Falla (≠ 0) y nombra archivo:línea ante un INSERT/UPDATE/DELETE/MERGE/VALUES de
# nivel superior, un COPY … FROM stdin con filas, un setval distinto de
# setval(…, 1, false) o un objeto grande. Los INSERT dentro de cuerpos de
# funciones no cuentan (se analizan las sentencias de nivel superior).
# Excepción acotada: el historial de migraciones (04-migraciones.tsv, o el
# nombre que se pase con --historial) sólo puede traer «versión<TAB>nombre».
set -euo pipefail
exec python3 -I "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sin_datos.py" "$@"
