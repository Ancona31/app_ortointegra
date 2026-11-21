#!/bin/sh
# Regenera las vistas, ensambla la página y prepara tmp-ver.html
cd "$(dirname "$0")"
python3 tmp-gen-ah.py && python3 ../kit/build.py . "Agenda · Herramientas" && (printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat pagina.html) > tmp-ver.html
