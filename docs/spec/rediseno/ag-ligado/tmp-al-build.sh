#!/bin/sh
# Regenera las 4 vistas, ensambla la página y prepara tmp-ver.html (lee las piezas base de ../agenda-base sin escribir allí)
cd "$(dirname "$0")"
python3 tmp-al-gen.py >/dev/null && python3 ../kit/build.py . "Agenda · Ligado y Google" && (printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat pagina.html) > tmp-ver.html
